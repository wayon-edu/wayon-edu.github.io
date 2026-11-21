// 教务管理（协作共享，#nav-ledger / #ledger）与个人私密（仅管理员本人 + PBKDF2-SHA256 二级密码，#private）双空间。
// Zero private data lives in this file or any public page; academic tables and private tables are strictly separated.
(() => {
  if (globalThis.wayonLedger || typeof document === 'undefined') return;
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const num = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const fmtMoney = (v, masked) => masked ? '••••' : num(v).toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const fmtDays = v => {
    const n = num(v);
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  };
  const fmtHours = v => {
    const n = num(v);
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  };
  const fmtBytes = b => {
    const n = num(b);
    if (n <= 0) return '';
    if (n < 1048576) return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${Math.round(n / 104857) / 10} MB`;
  };

  const PBKDF2_ITERATIONS = 210000;
  const IDLE_LOCK_MS = 10 * 60 * 1000;
  const MIN_PIN_LEN = 4;
  const MAX_PIN_LEN = 64;
  const SPLIT_TEACHERS = new Set(['王银屏', '徐梓淞']);
  const SHEET_COLS = [
    {letter: 'A', key: 'date', label: '日期', type: 'text', cls: 'nowrap', minW: 108, placeholder: 'YYYY-MM-DD'},
    {letter: 'B', key: 'weekday', label: '星期', type: 'text', cls: 'nowrap center', minW: 66, placeholder: '星期一'},
    {letter: 'C', key: 'time', label: '时间', type: 'text', cls: 'nowrap', minW: 108, placeholder: '10:00-12:00'},
    {letter: 'D', key: 'teacher', label: '讲师', type: 'text', cls: 'nowrap', minW: 80, placeholder: '讲师姓名'},
    {letter: 'E', key: 'student', label: '学生', type: 'text', cls: '', minW: 118, placeholder: '学生姓名'},
    {letter: 'F', key: 'subject', label: '科目/班级', type: 'text', cls: '', minW: 196, placeholder: '科目/班级'},
    {letter: 'G', key: 'kind', label: '类型', type: 'text', cls: 'nowrap', minW: 84, placeholder: '听说读写'},
    {letter: 'H', key: 'count', label: '人数', type: 'number', cls: 'num nowrap', minW: 62, placeholder: '1'},
    {letter: 'I', key: 'hours', label: '课时', type: 'number', cls: 'num nowrap', minW: 68, placeholder: '2'},
    {letter: 'J', key: 'location', label: '地点', type: 'text', cls: '', minW: 126, placeholder: '线下/线上'},
    {letter: 'K', key: 'note', label: '备注', type: 'text', cls: '', minW: 140, placeholder: '备注'},
  ];
  const SHEET_COLLATOR = typeof Intl !== 'undefined' && Intl.Collator
    ? new Intl.Collator('zh-CN', {numeric: true, sensitivity: 'base'})
    : {compare: (a, b) => String(a).localeCompare(String(b))};

  const ACADEMIC_TABS = [
    {id: 'billing', label: '课时汇总'},
    {id: 'profiles', label: '学员与校历'},
  ];
  const PRIVATE_TABS = [
    {id: 'salary', label: '工资记录'},
    {id: 'leave', label: '个人调休'},
    {id: 'commission', label: '月度提成'},
  ];

  let open = false;
  let activeSpace = 'academic'; // academic | private
  let academicTab = 'billing';  // billing | profiles
  let privateTab = 'salary';    // salary | leave | commission
  let ownerCheckState = 'idle'; // idle | checking | owner | denied | error
  let ownerCheckError = '';
  let privateUnlocked = false;
  let privateLockState = 'idle'; // idle | checking | setup | locked | unlocked | error
  let lockRecord = null;
  let lockNotice = '';
  let lockError = '';
  let lockBusy = false;
  let checkLockPromise = null;
  let lastActiveAt = 0;
  let idleTimer = null;
  let root = null;
  let modal = null;
  let liveAnnouncer = null;
  let announceTimer = null;
  let authBoundClient = null;
  let loading = false;
  let reloadQueued = false;
  let reloadForce = false;
  let loadPromise = null;
  let privateLoading = false;
  let privateReloadQueued = false;
  let privateReloadForce = false;
  let privateLoadState = 'idle'; // idle | loading | ready | error
  let privateLoadError = '';
  let privateLoadPromise = null;
  let deferredRender = false;
  let loadState = 'idle'; // idle | loading | ready | signedout | error
  let loadError = '';
  let actionError = '';
  let actionInfo = '';
  let salaryMasked = true;
  let selectedMonth = '';
  let commissionMonth = '';
  let billingView = 'monthly'; // monthly | longterm
  let billingTeacherFilter = '';
  let billingSearchQuery = '';
  let sheetDraft = null;
  let sheetRidSeq = 1;
  let ltDraft = null;
  let inlineEditing = false;
  let navBtn = null;
  let leaveFilter = 'all';
  let leaveQuery = '';
  let profileFilter = '在读';
  let profileQuery = '';
  let signedUrls = new Map();
  let docOpenState = new Map();
  let mountObserver = null;
  let attrObserver = null;
  let mounting = false;

  const store = {
    billing: [],
    leave: [],
    salary: [],
    profiles: [],
    docs: [],
  };

  const style = make('style');
  style.id = 'wayon-ledger-style';
  style.textContent = `
    :root{--ldg-accent-bg:#0066cc;--ldg-accent-bg-hover:#0055b3;--ldg-accent-fg:#fff}
    @media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--ldg-accent-bg:#0a66d6;--ldg-accent-bg-hover:#1774e8;--ldg-accent-fg:#fff}}
    :root[data-theme="light"]{--ldg-accent-bg:#0066cc;--ldg-accent-bg-hover:#0055b3;--ldg-accent-fg:#fff}
    :root[data-theme="dark"]{--ldg-accent-bg:#0a66d6;--ldg-accent-bg-hover:#1774e8;--ldg-accent-fg:#fff}
    #nav-ledger{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;background:transparent;color:var(--muted,#6e6e73);cursor:pointer;border-radius:12px;padding:4px 6px}
    #nav-ledger svg{width:17px;height:17px;flex:none}
    #nav-ledger.on{color:var(--accent,#0071e3);background:var(--accent-subtle,rgba(0,113,227,.11))}
    body[data-ledger-open] #tabs button:not(#nav-ledger){background:transparent!important;color:var(--fg-secondary)!important}
    body[data-ledger-open] #list,body[data-ledger-open] .workspace-top-bar,body[data-ledger-open] .workspace-sub-bar,body[data-ledger-open] #aircon-panel,body[data-ledger-open] #memo-panel,body[data-ledger-open] #feedback-panel,body[data-ledger-open] #mocks-panel,body[data-ledger-open] .sidebar-footer .bar{display:none!important}
    body[data-aircon-open] #ledger-panel,body[data-memo-open] #ledger-panel,body[data-feedback-open] #ledger-panel,body[data-mocks-open] #ledger-panel{display:none!important}
    #ledger-panel{display:flex;flex-direction:column;gap:14px;width:100%;min-width:0;padding-bottom:32px}
    #ledger-panel[hidden]{display:none!important}
    #ledger-panel [hidden]:not([hidden="until-found"]),.ldg-dialog [hidden]:not([hidden="until-found"]),.ldg-btn[hidden],.ldg-lightbox-stage img[hidden]{display:none!important}
    .ldg-visually-hidden{position:absolute!important;clip-path:inset(50%)!important;overflow:hidden!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;border:0!important;white-space:nowrap!important}
    .ldg-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .ldg-head-left{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
    .ldg-head-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .ldg-head h2{margin:0;font-size:22px;font-weight:650;letter-spacing:-.02em}
    .ldg-sub{font-size:12.5px;color:var(--muted,#6e6e73)}
    .ldg-banner-err,.ldg-banner-ok{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.45}
    .ldg-banner-err{border:1px solid var(--bad-border,#f1c8c5);background:var(--bad-bg,#fff1f0);color:var(--bad,#d93025)}
    .ldg-banner-ok{border:1px solid var(--done-border,#cce6d2);background:var(--done-bg,#edf7ef);color:var(--done,#248a3d)}
    .ldg-banner-err[hidden],.ldg-banner-ok[hidden]{display:none!important}
    .ldg-tablist{display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--line,rgba(30,30,40,.09));padding-bottom:2px}
    .ldg-tablist::-webkit-scrollbar{display:none}
    .ldg-tab{position:relative;flex:none;border:0;background:transparent;color:var(--fg-secondary,#515156);padding:10px 14px;font-size:14px;font-weight:500;white-space:nowrap;cursor:pointer;border-radius:10px 10px 0 0}
    .ldg-tab.right{margin-inline-start:auto}
    .ldg-tab:hover{color:var(--fg,#1d1d1f);background:var(--code-bg,rgba(118,118,128,.08))}
    .ldg-tab[aria-selected="true"]{color:var(--accent,#0071e3)}
    .ldg-tab[aria-selected="true"]::after{content:"";position:absolute;inset:auto 10px 0;border-block-end:2.5px solid var(--accent,#0071e3)}
    .ldg-panel-wrap,.ldg-rows-slot{display:flex;flex-direction:column;gap:14px;min-width:0}
    .ldg-lock{padding:32px 22px;border-radius:18px;background:var(--card,#fff);border:1px solid var(--line,rgba(30,30,40,.09));display:flex;flex-direction:column;align-items:center;gap:12px;max-width:460px;width:100%;margin:16px auto 0;box-sizing:border-box;text-align:center}
    .ldg-lock h3{margin:0;font-size:18px;font-weight:650;letter-spacing:-.015em}
    .ldg-lock p{margin:0;color:var(--fg-secondary,#515156);font-size:13.5px;line-height:1.55;max-width:380px}
    .ldg-lock-notice{margin:0;padding:8px 12px;border-radius:10px;background:var(--code-bg,#f5f5f7);color:var(--fg-secondary,#515156);font-size:12.5px;line-height:1.45;width:100%;box-sizing:border-box}
    .ldg-lock-form{width:100%;display:flex;flex-direction:column;gap:12px;text-align:left;margin-top:4px}
    .ldg-lock-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:100%;margin-top:4px}
    .ldg-lock-actions .ldg-btn.primary{flex:1 1 160px;min-height:44px}
    .ldg-lock-actions .ldg-btn:not(.primary){min-height:44px}
    .ldg-link-btn{border:0;background:transparent;color:var(--muted,#6e6e73);font-size:12.5px;font-family:inherit;cursor:pointer;padding:6px 10px;border-radius:8px;text-decoration:underline;text-underline-offset:3px}
    .ldg-link-btn:hover{color:var(--fg,#1d1d1f);background:var(--code-bg,rgba(118,118,128,.08))}
    .ldg-pw-wrap{position:relative;display:flex;align-items:center}
    .ldg-pw-wrap input{padding-right:58px}
    .ldg-pw-toggle{position:absolute;inset-inline-end:6px;min-height:32px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--fg-secondary,#515156);font-size:12.5px;font-weight:500;cursor:pointer}
    .ldg-pw-toggle:hover{background:var(--line,rgba(30,30,40,.09));color:var(--fg,#1d1d1f)}
    .ldg-hint{display:block;font-size:12px;color:var(--muted,#6e6e73);line-height:1.4}
    .ldg-field-err{margin:2px 0 0;font-size:12.5px;line-height:1.4;color:var(--bad,#d93025)}
    .ldg-field-err[hidden]{display:none!important}
    .ldg-field input:is(:user-invalid,.ldg-user-invalid),.ldg-field select:is(:user-invalid,.ldg-user-invalid),.ldg-field textarea:is(:user-invalid,.ldg-user-invalid){border-color:var(--bad,#d93025);background:var(--bad-bg,#fff1f0)}
    .ldg-field input:focus-visible,.ldg-field select:focus-visible,.ldg-field textarea:focus-visible,.ldg-btn:focus-visible,.ldg-pw-toggle:focus-visible,.ldg-link-btn:focus-visible{outline:2px solid var(--accent,#0071e3);outline-offset:2px}
    .ldg-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    .ldg-stat{padding:14px 16px;border-radius:14px;background:var(--card,#fff);border:1px solid var(--line,rgba(30,30,40,.09));display:flex;flex-direction:column;gap:4px}
    .ldg-stat-label{font-size:12px;color:var(--muted,#6e6e73)}
    .ldg-stat-val{font-size:22px;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
    .ldg-stat-val.accent{color:var(--accent,#0071e3)}.ldg-stat-val.ok{color:var(--done,#248a3d)}.ldg-stat-val.warn{color:var(--warning-fg,#805300)}
    .ldg-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .ldg-pills{display:flex;gap:6px;flex-wrap:wrap}
    .ldg-pill{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--line-strong,rgba(30,30,40,.18));background:var(--card,#fff);color:var(--fg-secondary,#515156);font-size:13px;font-weight:500;cursor:pointer}
    .ldg-pill.on{background:var(--ldg-accent-bg);border-color:var(--ldg-accent-bg);color:var(--ldg-accent-fg)}
    .ldg-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:34px;padding:0 13px;border-radius:10px;border:1px solid var(--line-strong,rgba(30,30,40,.18));background:var(--card,#fff);color:var(--fg,#1d1d1f);font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap}
    .ldg-btn:disabled{opacity:.55;cursor:default}
    .ldg-btn.primary{background:var(--ldg-accent-bg);border-color:transparent;color:var(--ldg-accent-fg)}
    .ldg-btn.primary:hover:not(:disabled){background:var(--ldg-accent-bg-hover)}
    .ldg-btn.danger{color:var(--bad,#d93025);border-color:var(--bad-border,#f1c8c5);background:var(--bad-bg,#fff1f0)}
    .ldg-btn.sm{min-height:28px;padding:0 9px;font-size:12px;border-radius:8px}
    .ldg-search{flex:1 1 200px;min-width:0;min-height:36px;padding:6px 12px;border-radius:10px;border:1px solid var(--line-strong,rgba(30,30,40,.18));background:var(--card,#fff);color:var(--fg,#1d1d1f);font-size:14px}
    .ldg-card{padding:16px 18px;border-radius:16px;background:var(--card,#fff);border:1px solid var(--line,rgba(30,30,40,.09));display:flex;flex-direction:column;gap:12px;min-width:0}
    .ldg-card h3{margin:0;font-size:16px;font-weight:620}
    .ldg-table-wrap{overflow:auto;max-inline-size:100%;max-block-size:min(620px,72vh);container-type:inline-size;border-radius:12px;border:1px solid var(--line,rgba(30,30,40,.09));background:var(--card,#fff)}
    .ldg-table{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px;font-variant-numeric:tabular-nums}
    .ldg-table thead{position:sticky;inset-block-start:0;z-index:2;background:var(--code-bg,#f5f5f7)}
    .ldg-table thead th:first-child{position:sticky;inset-inline-start:0;z-index:3;background:var(--code-bg,#f5f5f7)}
    .ldg-table th,.ldg-table td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line,rgba(30,30,40,.09));vertical-align:top}
    .ldg-table thead th{font-size:12px;font-weight:600;color:var(--muted,#6e6e73);white-space:nowrap}
    .ldg-table tbody th{position:sticky;inset-inline-start:0;z-index:1;background:var(--card,#fff);font-weight:600;white-space:nowrap}
    .ldg-table .num{text-align:right;white-space:nowrap}
    .ldg-table .ops{white-space:nowrap;display:flex;gap:6px;flex-wrap:wrap}
    .ldg-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap}
    .ldg-badge.ok{background:var(--done-bg,#edf7ef);color:var(--done,#248a3d)}
    .ldg-badge.warn{background:var(--warning-bg,#fff8e8);color:var(--warning-fg,#805300)}
    .ldg-badge.danger{background:var(--bad-bg,#fff1f0);color:var(--bad,#d93025)}
    .ldg-badge.muted{background:var(--code-bg,#f5f5f7);color:var(--muted,#6e6e73)}
    .ldg-subbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .ldg-backup-tag{font-size:12px;color:var(--muted,#6e6e73);padding:4px 10px;border-radius:999px;background:var(--code-bg,#f5f5f7);border:1px solid var(--line,rgba(30,30,40,.08))}
    .ldg-month-select{min-height:36px;padding:6px 10px;border-radius:10px;border:1px solid var(--line-strong,rgba(30,30,40,.18));background:var(--card,#fff);color:var(--fg,#1d1d1f);font-size:13.5px;font-weight:500;font-family:inherit;cursor:pointer}
    .ldg-bar-list{display:flex;flex-direction:column;gap:8px}
    .ldg-bar-item{display:flex;align-items:stretch;gap:8px}
    .ldg-bar-item .ldg-bar-row{flex:1 1 auto;min-width:0}
    .ldg-bar-card-btn{flex:none;align-self:center}
    .ldg-bar-row{display:flex;flex-direction:column;gap:6px;width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--line,rgba(30,30,40,.09));background:var(--code-bg,#f5f5f7);color:var(--fg,#1d1d1f);text-align:left;cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s}
    .ldg-bar-row:hover{border-color:var(--ldg-accent-bg)}
    .ldg-bar-row.on{border-color:var(--ldg-accent-bg);background:color-mix(in srgb,var(--ldg-accent-bg) 10%,var(--card,#fff))}
    .ldg-bar-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .ldg-bar-name{font-size:14px;font-weight:620;display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
    .ldg-bar-meta{font-size:12px;color:var(--muted,#6e6e73);font-weight:450}
    .ldg-bar-hrs{font-size:14px;font-weight:650;font-variant-numeric:tabular-nums;color:var(--accent,#0071e3);white-space:nowrap}
    .ldg-buckets{display:flex;gap:5px;flex-wrap:wrap}
    .ldg-bucket{padding:1px 7px;border-radius:999px;font-size:11.5px;background:var(--card,#fff);border:1px solid var(--line,rgba(30,30,40,.1));color:var(--fg-secondary,#515156);font-variant-numeric:tabular-nums}
    progress.ldg-progress{appearance:none;border:0 solid;overflow:clip;width:100%;height:8px;--progress-bar-radius:999px;border-radius:var(--progress-bar-radius);background:var(--line,rgba(30,30,40,.1));--progress-bar-fill:var(--ldg-accent-bg)}
    progress.ldg-progress.ok{--progress-bar-fill:var(--done,#248a3d)}
    progress.ldg-progress.warn{--progress-bar-fill:#d97706}
    progress.ldg-progress.danger{--progress-bar-fill:var(--bad,#d93025)}
    progress.ldg-progress::-webkit-progress-bar{background:transparent}
    progress.ldg-progress::-webkit-progress-value{background:var(--progress-bar-fill);border-radius:var(--progress-bar-radius);transition:inline-size .25s}
    progress.ldg-progress::-moz-progress-bar{background:var(--progress-bar-fill);border-radius:var(--progress-bar-radius);transition:inline-size .25s}
    .ldg-files{display:flex;gap:8px;flex-wrap:wrap}
    .ldg-cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
    .ldg-card-img{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:12px;border:1px solid var(--line,rgba(30,30,40,.09));background:var(--code-bg,#f5f5f7)}
    .ldg-card-thumb{padding:0;border:0;background:var(--card,#fff);border-radius:8px;overflow:hidden;cursor:zoom-in;width:100%;aspect-ratio:4 / 3;display:flex;align-items:center;justify-content:center}
    .ldg-card-thumb img{width:100%;height:100%;object-fit:contain;display:block}
    .ldg-card-cap{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;flex-wrap:wrap}
    .ldg-card-fname{font-size:12px;color:var(--fg-secondary,#515156);word-break:break-all;line-height:1.35;flex:1 1 120px}
    .ldg-card-ops{display:flex;gap:6px;flex-wrap:wrap}
    .ldg-tip-wrap{position:relative;display:inline-flex;align-items:center;vertical-align:middle}
    .ldg-info-tip{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--muted,#6e6e73);font-size:13px;line-height:1;cursor:help;font-family:inherit}
    .ldg-info-tip:hover,.ldg-info-tip:focus-visible{color:var(--accent,#0071e3);background:var(--code-bg,rgba(118,118,128,.12));outline:none}
    .ldg-tip-pop{position:absolute;left:0;bottom:calc(100% + 6px);transform:none;z-index:70;width:max-content;max-width:min(280px,calc(100vw - 32px));padding:7px 10px;border-radius:10px;background:var(--fg,#1d1d1f);color:var(--card,#fff);font-size:12px;font-weight:450;line-height:1.45;white-space:normal;text-align:left;box-shadow:0 8px 24px rgba(0,0,0,.22);pointer-events:none;opacity:0;visibility:hidden;transition:opacity .15s,visibility .15s}
    .ldg-tip-wrap.right .ldg-tip-pop{left:auto;right:0}
    .ldg-tip-wrap.below .ldg-tip-pop{top:calc(100% + 6px);bottom:auto}
    .ldg-tip-wrap:hover .ldg-tip-pop,.ldg-tip-wrap:focus-within .ldg-tip-pop{opacity:1;visibility:visible}
    .ldg-title-row{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
    .ldg-ed-cell{cursor:cell;transition:background .12s}
    .ldg-ed-cell:hover{background:color-mix(in srgb,#1a73e8 6%,var(--card,#fff))}
    .ldg-ed-cell.readonly{cursor:default}
    .ldg-ed-cell.readonly:hover{background:transparent}
    .ldg-ed-cell.editing{padding:2px 4px!important;background:var(--card,#fff)}
    .ldg-ed-cell.saving{opacity:.6}
    .ldg-inline-input{width:100%;min-width:64px;box-sizing:border-box;padding:4px 7px;border-radius:6px;border:1.5px solid #1a73e8;background:var(--card,#fff);color:var(--fg,#1d1d1f);font:inherit;text-align:inherit;outline:none}
    dialog.ldg-dialog.ldg-card-editor{max-width:min(960px,calc(100vw - 24px));max-height:min(94dvh,880px)}
    .ldg-ce-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,420px);gap:16px;align-items:start}
    .ldg-ce-form{display:flex;flex-direction:column;gap:10px;min-width:0}
    .ldg-ce-rows{display:flex;flex-direction:column;gap:6px}
    .ldg-ce-row{display:grid;grid-template-columns:1fr 96px 32px;gap:6px;align-items:center}
    .ldg-ce-row input{box-sizing:border-box;width:100%;padding:7px 9px;border-radius:9px;border:1px solid var(--line-strong,rgba(30,30,40,.18));background:var(--code-bg,#f5f5f7);color:var(--fg,#1d1d1f);font-size:13.5px;font-family:inherit}
    .ldg-ce-row input.num{text-align:right;font-variant-numeric:tabular-nums}
    .ldg-ce-preview{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px;border-radius:14px;background:var(--code-bg,#f4f5f7);border:1px solid var(--line,rgba(30,30,40,.09))}
    .ldg-ce-preview canvas{width:100%;max-width:390px;height:auto;border-radius:12px;display:block;box-shadow:0 4px 16px rgba(20,30,60,.12)}
    @media(max-width:820px){.ldg-ce-grid{grid-template-columns:1fr}}
    .ldg-subtotal{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--muted,#6e6e73);font-variant-numeric:tabular-nums}
    .ldg-lt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
    .ldg-lt-card{padding:16px;border-radius:16px;background:var(--card,#fff);border:1px solid var(--line,rgba(30,30,40,.09));display:flex;flex-direction:column;gap:10px}
    .ldg-lt-card.danger{border-color:var(--bad-border,#f1c8c5)}
    .ldg-lt-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .ldg-lt-title{font-size:16px;font-weight:650;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .ldg-lt-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .ldg-lt-num{padding:8px 10px;border-radius:10px;background:var(--code-bg,#f5f5f7);display:flex;flex-direction:column;gap:2px}
    .ldg-lt-num small{font-size:11.5px;color:var(--muted,#6e6e73)}
    .ldg-lt-num strong{font-size:16px;font-weight:650;font-variant-numeric:tabular-nums}
    .ldg-lt-num strong.danger{color:var(--bad,#d93025)}
    .ldg-lt-num strong.warn{color:var(--warning-fg,#805300)}
    .ldg-lt-num strong.ok{color:var(--done,#248a3d)}
    .ldg-lt-note{margin:0;font-size:12px;color:var(--muted,#6e6e73);line-height:1.45}
    .ldg-summary-details>summary{cursor:pointer;font-weight:620;font-size:15px;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .ldg-summary-details>summary::-webkit-details-marker{display:none}
    .ldg-summary-details>summary::after{content:"展开 ▾";font-size:12px;font-weight:500;color:var(--muted,#6e6e73)}
    .ldg-summary-details[open]>summary::after{content:"收起 ▴"}
    dialog.ldg-dialog.ldg-lightbox{max-width:min(940px,calc(100vw - 24px));max-height:min(94dvh,920px)}
    .ldg-lightbox-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .ldg-lightbox-stage{display:flex;align-items:center;justify-content:center;min-height:220px;background:var(--code-bg,#f5f5f7);border-radius:12px;padding:10px;overflow:auto}
    .ldg-lightbox-stage img{max-width:100%;max-height:70dvh;width:auto;height:auto;object-fit:contain;border-radius:6px;display:block}
    .ldg-btn.gsheet{background:#188038;border-color:#188038;color:#fff}
    .ldg-btn.gsheet:hover:not(:disabled){background:#137333;border-color:#137333}
    .ldg-sheet-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .ldg-sheet-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .ldg-fx-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;border:1px solid var(--line-strong,rgba(30,30,40,.16));background:var(--code-bg,#f8f9fa);font-size:13px;flex-wrap:wrap}
    .ldg-fx-ref{min-width:86px;padding:3px 8px;border-radius:6px;background:var(--card,#fff);border:1px solid var(--line,rgba(30,30,40,.12));font-size:12px;font-weight:600;color:var(--fg-secondary,#515156);text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}
    .ldg-fx-sym{font-style:italic;font-weight:700;color:var(--muted,#6e6e73);font-family:ui-serif,Georgia,serif;user-select:none}
    .ldg-fx-input{flex:1 1 220px;min-width:0;min-height:30px;padding:4px 8px;border-radius:6px;border:1px solid transparent;background:var(--card,#fff);color:var(--fg,#1d1d1f);font-size:13.5px;font-family:inherit}
    .ldg-fx-input:focus{outline:2px solid #1a73e8;border-color:transparent}
    .ldg-fx-state{font-size:12px;white-space:nowrap;padding:2px 8px;border-radius:999px;font-weight:550}
    .ldg-fx-state.clean{color:var(--muted,#6e6e73);background:var(--card,#fff)}
    .ldg-fx-state.dirty{color:var(--warning-fg,#805300);background:var(--warning-bg,#fff8e8)}
    .ldg-sheet-wrap{overflow:auto;max-inline-size:100%;max-block-size:min(640px,74vh);border-radius:10px;border:1px solid var(--line-strong,rgba(30,30,40,.2));background:var(--card,#fff);content-visibility:auto;contain-intrinsic-size:auto 560px}
    @supports not (content-visibility:auto){.ldg-sheet-wrap{contain:layout style paint}}
    .ldg-sheet{width:100%;min-inline-size:1120px;border-collapse:separate;border-spacing:0;font-size:13px;font-variant-numeric:tabular-nums}
    .ldg-sheet caption{position:absolute;clip-path:inset(50%);overflow:hidden;width:1px;height:1px;margin:-1px}
    .ldg-sheet thead th{position:sticky;inset-block-start:0;z-index:3;background:var(--code-bg,#f8f9fa);border-right:1px solid var(--line-strong,rgba(30,30,40,.14));border-bottom:2px solid var(--line-strong,rgba(30,30,40,.2));padding:0;font-size:12px;font-weight:600;color:var(--fg-secondary,#515156);white-space:nowrap;user-select:none}
    .ldg-sheet thead th:not(:has(> button)){padding:7px 8px;text-align:center}
    .ldg-sheet thead th.ldg-rownum-col{inset-inline-start:0;z-index:4;width:42px;min-width:42px}
    .ldg-sort-btn{display:flex;align-items:center;justify-content:space-between;gap:5px;width:100%;min-height:32px;padding:6px 8px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;text-align:left;white-space:nowrap}
    .ldg-sort-btn:hover{background:var(--line,rgba(30,30,40,.06));color:var(--fg,#1d1d1f)}
    .ldg-sort-btn:focus-visible{outline:2px solid #1a73e8;outline-offset:-2px}
    .ldg-col-letter{font-size:10.5px;font-weight:700;color:var(--muted,#6e6e73);margin-right:4px}
    .ldg-sort-icon{font-size:10px;opacity:.35}
    .ldg-sort-icon::before{content:"⇅"}
    .ldg-sheet thead th[aria-sort="ascending"] .ldg-sort-icon{opacity:1;color:#1a73e8}
    .ldg-sheet thead th[aria-sort="ascending"] .ldg-sort-icon::before{content:"▲"}
    .ldg-sheet thead th[aria-sort="descending"] .ldg-sort-icon{opacity:1;color:#1a73e8}
    .ldg-sheet thead th[aria-sort="descending"] .ldg-sort-icon::before{content:"▼"}
    .ldg-sheet tbody th.ldg-rownum{position:sticky;inset-inline-start:0;z-index:2;background:var(--code-bg,#f8f9fa);border-right:1px solid var(--line-strong,rgba(30,30,40,.16));border-bottom:1px solid var(--line,rgba(30,30,40,.1));padding:6px 4px;text-align:center;font-size:11.5px;font-weight:500;color:var(--muted,#6e6e73);white-space:nowrap;user-select:none}
    .ldg-sheet tbody tr:hover td{background:color-mix(in srgb,#1a73e8 4%,var(--card,#fff))}
    .ldg-sheet tbody td.ldg-cell{position:relative;padding:6px 8px;border-right:1px solid var(--line,rgba(30,30,40,.1));border-bottom:1px solid var(--line,rgba(30,30,40,.1));background:var(--card,#fff);color:var(--fg,#1d1d1f);vertical-align:middle;cursor:cell;line-height:1.4;max-width:320px;overflow-wrap:anywhere}
    .ldg-sheet tbody td.ldg-cell.nowrap{white-space:nowrap}
    .ldg-sheet tbody td.ldg-cell.center{text-align:center}
    .ldg-sheet tbody td.ldg-cell.num{text-align:right;font-variant-numeric:tabular-nums}
    .ldg-sheet tbody td.ldg-cell.sel{outline:2px solid #1a73e8;outline-offset:-2px;background:color-mix(in srgb,#1a73e8 7%,var(--card,#fff));z-index:1}
    .ldg-sheet tbody td.ldg-cell.editing{padding:0;outline:2px solid #1a73e8;outline-offset:-2px;z-index:2}
    .ldg-cell-input{display:block;width:100%;height:100%;min-height:31px;box-sizing:border-box;border:0;padding:5px 7px;background:var(--card,#fff);color:var(--fg,#1d1d1f);font:inherit;text-align:inherit;outline:none}
    .ldg-sheet tbody td.ldg-row-ops{padding:3px 6px;border-bottom:1px solid var(--line,rgba(30,30,40,.1));background:var(--card,#fff);white-space:nowrap;text-align:center}
    .ldg-row-op-btn{border:0;background:transparent;color:var(--muted,#6e6e73);width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:13px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center}
    .ldg-row-op-btn:hover{background:var(--code-bg,#ebebf0);color:var(--fg,#1d1d1f)}
    .ldg-row-op-btn.del:hover{background:var(--bad-bg,#fff1f0);color:var(--bad,#d93025)}
    .ldg-sheet tfoot td{position:sticky;inset-block-end:0;z-index:3;background:var(--code-bg,#f8f9fa);border-top:2px solid var(--line-strong,rgba(30,30,40,.18));border-right:1px solid var(--line,rgba(30,30,40,.1));padding:7px 8px;font-weight:650;font-size:12.5px;white-space:nowrap}
    .ldg-salary-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .ldg-salary-tools-grp{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .ldg-md{display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.6}
    .ldg-md h1,.ldg-md h2,.ldg-md h3,.ldg-md h4,.ldg-md h5,.ldg-md h6{margin:8px 0 2px;font-weight:650}
    .ldg-md h1{font-size:18px}.ldg-md h2{font-size:15.5px}.ldg-md h3{font-size:14.5px}.ldg-md h4,.ldg-md h5,.ldg-md h6{font-size:13.5px;color:var(--fg-secondary,#515156)}
    .ldg-md p{margin:0}.ldg-md ul,.ldg-md ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px}
    .ldg-md li>ul,.ldg-md li>ol{margin-top:4px}
    .ldg-md code{padding:1px 5px;border-radius:5px;background:var(--code-bg,#f5f5f7);font-size:12.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .ldg-md a{color:var(--accent,#0071e3);text-decoration:underline;text-underline-offset:2px}
    .ldg-md hr,.ldg-hr{border:0;border-top:1px solid var(--line,rgba(30,30,40,.12));margin:6px 0}
    .ldg-md blockquote{margin:0;padding:8px 12px;border-left:3px solid var(--accent,#0071e3);background:var(--code-bg,#f5f5f7);border-radius:0 8px 8px 0;color:var(--fg-secondary,#515156)}
    .ldg-empty{padding:24px;text-align:center;color:var(--muted,#6e6e73);font-size:13.5px;display:flex;flex-direction:column;align-items:center;gap:10px;border-radius:12px;border:1px dashed var(--line-strong,rgba(30,30,40,.18));background:var(--card,#fff)}
    dialog.ldg-dialog{max-width:min(520px,calc(100vw - 24px));max-height:min(90dvh,720px);width:100%;padding:0;overflow:auto;border:1px solid var(--line-strong,rgba(30,30,40,.18));border-radius:18px;background:var(--card,#fff);color:var(--fg,#1d1d1f);box-shadow:0 24px 64px rgba(0,0,0,.22)}
    dialog.ldg-dialog[open]{display:flex;flex-direction:column}
    dialog.ldg-dialog:modal{overscroll-behavior:contain}
    dialog.ldg-dialog::backdrop{background:rgba(0,0,0,.38);backdrop-filter:blur(4px);overflow:hidden;overscroll-behavior:contain}
    .ldg-dialog-body{padding:20px;display:flex;flex-direction:column;gap:12px}
    .ldg-dialog-body h3{margin:0;font-size:17px;font-weight:650}
    .ldg-form-err{margin:0;padding:8px 10px;border-radius:8px;background:var(--bad-bg,#fff1f0);border:1px solid var(--bad-border,#f1c8c5);color:var(--bad,#d93025);font-size:12.5px;line-height:1.45}
    .ldg-form-err:empty{display:none}
    .ldg-field{display:flex;flex-direction:column;gap:4px;font-size:13px}
    .ldg-field label{color:var(--fg-secondary,#515156);font-weight:500}
    .ldg-field input,.ldg-field select,.ldg-field textarea{box-sizing:border-box;width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--line-strong,rgba(30,30,40,.18));background:var(--code-bg,#f5f5f7);color:var(--fg,#1d1d1f);font-size:14px;font-family:inherit}
    .ldg-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .ldg-dialog-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
    @container (width < 600px){
      .ldg-table,.ldg-table thead,.ldg-table tbody,.ldg-table tr,.ldg-table th,.ldg-table td{display:block}
      .ldg-table thead{display:none}
      .ldg-table thead th:first-child{position:static}
      .ldg-table tr{margin:10px;border:1px solid var(--line,rgba(30,30,40,.09));border-radius:12px;overflow:clip;background:var(--card,#fff)}
      .ldg-table tbody th{position:sticky;inset-block-start:0;inset-inline-start:auto;z-index:2;background:var(--code-bg,#f5f5f7);border-bottom:1px solid var(--line,rgba(30,30,40,.09));white-space:normal;overflow-wrap:anywhere}
      .ldg-table td{display:flex;justify-content:space-between;gap:10px;text-align:right;border-bottom:1px solid var(--line,rgba(30,30,40,.06))}
      .ldg-table td:last-child{border-bottom:0}
      .ldg-table td::before{content:attr(data-label);font-weight:500;color:var(--muted,#6e6e73);text-align:left;flex:none}
      .ldg-table .num{text-align:right}
    }
    @media(pointer:coarse),(max-width:599px){
      .ldg-btn,.ldg-btn.sm,.ldg-pill,.ldg-tab{min-height:44px}
      .ldg-search,.ldg-month-select,.ldg-field input,.ldg-field select,.ldg-field textarea,.ldg-ce-row input{font-size:16px;min-height:44px}
      .ldg-field-grid{grid-template-columns:1fr}
      .ldg-lt-nums{grid-template-columns:repeat(3,1fr)}
    }
  `;
  document.head.append(style);

  const client = () => globalThis.wayonSupabaseClient?.client || null;

  function clearPrivateSensitiveStore() {
    store.salary = [];
    store.leave = [];
    salaryMasked = true;
    privateLoadState = 'idle';
    privateLoadError = '';
    commissionMonth = '';
  }

  function clearAllStore() {
    store.billing = [];
    store.profiles = [];
    store.docs = [];
    clearPrivateSensitiveStore();
    selectedMonth = '';
    billingView = 'monthly';
    billingTeacherFilter = '';
    billingSearchQuery = '';
    sheetDraft = null;
    ltDraft = null;
    inlineEditing = false;
    signedUrls.clear();
    actionError = '';
    actionInfo = '';
  }

  function bytesToB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    const bin = atob(String(b64 || ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function timingSafeEqualB64(a, b) {
    try {
      const ba = b64ToBytes(a), bb = b64ToBytes(b);
      if (ba.length !== bb.length || ba.length === 0) return false;
      let diff = 0;
      for (let i = 0; i < ba.length; i++) diff |= (ba[i] ^ bb[i]);
      return diff === 0;
    } catch {
      return false;
    }
  }

  function randomSaltB64() {
    const cryptoObj = globalThis.crypto;
    if (!cryptoObj?.getRandomValues) throw new Error('当前环境不支持安全随机数生成，请使用 HTTPS 访问');
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return bytesToB64(bytes);
  }

  async function derivePinHash(pin, saltB64, iterations = PBKDF2_ITERATIONS) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('当前环境不支持 WebCrypto 加密，请使用 HTTPS 访问');
    const enc = new TextEncoder();
    const key = await subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      {name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(saltB64), iterations},
      key,
      256
    );
    return bytesToB64(new Uint8Array(bits));
  }

  function cooldownSeconds(attempts) {
    if (attempts >= 10) return 900;
    if (attempts >= 8) return 300;
    if (attempts >= 5) return 60;
    return 0;
  }

  function remainingLockSeconds(rec) {
    if (!rec?.locked_until) return 0;
    const ms = Date.parse(rec.locked_until) - Date.now();
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  }

  function validatePinFormat(pin, label = '二级密码') {
    const raw = String(pin ?? '');
    if (!raw.trim()) return `请填写${label}`;
    if (raw.length < MIN_PIN_LEN) return `${label}至少需要 ${MIN_PIN_LEN} 位字符`;
    if (raw.length > MAX_PIN_LEN) return `${label}不能超过 ${MAX_PIN_LEN} 位字符`;
    return '';
  }

  function ensureAnnouncer() {
    if (liveAnnouncer && liveAnnouncer.parentNode) return liveAnnouncer;
    if (!liveAnnouncer) {
      liveAnnouncer = make('div', 'ldg-visually-hidden');
      liveAnnouncer.setAttribute('aria-live', 'polite');
      liveAnnouncer.setAttribute('aria-atomic', 'true');
    }
    document.body.append(liveAnnouncer);
    return liveAnnouncer;
  }

  function announcePolite(msg) {
    const box = ensureAnnouncer();
    clearTimeout(announceTimer);
    box.textContent = '';
    if (!msg) return;
    announceTimer = setTimeout(() => { box.textContent = String(msg); }, 150);
  }

  function linkFieldError(input, errorId, shown) {
    if (!input || !errorId) return;
    const ids = String(input.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
  }

  function setFieldError(input, errEl, msg, {announce = false} = {}) {
    const hasErr = Boolean(msg);
    if (errEl) {
      errEl.textContent = hasErr ? `❌ ${msg}` : '';
      errEl.hidden = !hasErr;
    }
    if (input) {
      input.setAttribute('aria-invalid', hasErr ? 'true' : 'false');
      input.classList.toggle('ldg-user-invalid', hasErr);
      if (errEl?.id) linkFieldError(input, errEl.id, hasErr);
    }
    if (hasErr && announce) announcePolite(msg);
  }

  function createPasswordField({id, name, label, hint, autocomplete, placeholder, enterkeyhint = 'done', required = true, minLength = MIN_PIN_LEN, maxLength = MAX_PIN_LEN, validator}) {
    const field = make('div', 'ldg-field');
    const lbl = make('label', '', label);
    lbl.setAttribute('for', id);
    field.append(lbl);
    let hintId = '';
    if (hint) {
      hintId = id + '-hint';
      const h = make('span', 'ldg-hint', hint);
      h.id = hintId;
      field.append(h);
    }
    const wrap = make('div', 'ldg-pw-wrap');
    const input = make('input');
    input.id = id;
    input.name = name || id;
    input.type = 'password';
    input.required = required;
    if (minLength) input.minLength = minLength;
    if (maxLength) input.maxLength = maxLength;
    if (autocomplete) input.setAttribute('autocomplete', autocomplete);
    if (placeholder) input.placeholder = placeholder;
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('enterkeyhint', enterkeyhint);
    input.setAttribute('aria-invalid', 'false');
    if (hintId) input.setAttribute('aria-describedby', hintId);

    const toggle = make('button', 'ldg-pw-toggle', '显示');
    toggle.type = 'button';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', `显示${label}`);
    toggle.onclick = () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.textContent = show ? '隐藏' : '显示';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.setAttribute('aria-label', `${show ? '隐藏' : '显示'}${label}`);
    };
    wrap.append(input, toggle);

    const errEl = make('div', 'ldg-field-err', '');
    errEl.id = id + '-err';
    errEl.hidden = true;
    input.dataset.error = errEl.id;
    field.append(wrap, errEl);

    let touched = false;
    input.addEventListener('input', () => {
      touched = true;
      if (input.getAttribute('aria-invalid') === 'true') {
        const nextErr = validator ? validator(input.value) : '';
        if (!nextErr) setFieldError(input, errEl, '');
      }
    });
    input.addEventListener('blur', () => {
      if (!touched || !validator) return;
      const err = validator(input.value);
      setFieldError(input, errEl, err, {announce: Boolean(err)});
    });

    return {
      field,
      input,
      toggle,
      errEl,
      setError: (msg, opts) => setFieldError(input, errEl, msg, opts),
      clearError: () => setFieldError(input, errEl, ''),
      resetMask: () => {
        input.type = 'password';
        toggle.textContent = '显示';
        toggle.setAttribute('aria-pressed', 'false');
        toggle.setAttribute('aria-label', `显示${label}`);
      },
    };
  }

  function touchActivity() {
    if (open && activeSpace === 'private' && privateUnlocked) lastActiveAt = Date.now();
  }

  function stopIdleWatcher() {
    if (idleTimer !== null) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
  }

  function checkIdleTimeout() {
    if (!open || activeSpace !== 'private' || !privateUnlocked || !lastActiveAt) return;
    if (Date.now() - lastActiveAt >= IDLE_LOCK_MS) {
      lockPrivate({reason: '已闲置超过 10 分钟，个人私密空间已自动锁定并清空内存数据', rerender: true});
    }
  }

  function startIdleWatcher() {
    stopIdleWatcher();
    lastActiveAt = Date.now();
    idleTimer = setInterval(checkIdleTimeout, 15000);
  }

  function lockPrivate({reason = '', rerender = false, resetRecord = false} = {}) {
    privateUnlocked = false;
    lastActiveAt = 0;
    stopIdleWatcher();
    clearPrivateSensitiveStore();
    lockError = '';
    lockNotice = reason;
    if (resetRecord) {
      lockRecord = null;
      ownerCheckState = 'idle';
      ownerCheckError = '';
    }
    privateLockState = lockRecord ? 'locked' : 'idle';
    if (activeSpace === 'private' && modal?.open) {
      modal.onclose = null;
      modal.close();
    }
    if (rerender && open && activeSpace === 'private') render();
  }

  function clearAllAndSignOut() {
    lockPrivate({reason: '', rerender: false, resetRecord: true});
    deferredRender = false;
    reloadQueued = false;
    reloadForce = false;
    clearAllStore();
    loadState = 'signedout';
    loadError = '';
    if (modal?.open) {
      modal.onclose = null;
      modal.close();
    }
  }

  async function saveLockRow(pin) {
    const c = client();
    if (!c) throw new Error('云端客户端未就绪');
    const {data: sess, error: sessErr} = await c.auth.getSession();
    if (sessErr) throw sessErr;
    if (!sess?.session?.user?.id) throw new Error('请先登录云端账号');
    const salt_b64 = randomSaltB64();
    const hash_b64 = await derivePinHash(pin, salt_b64, PBKDF2_ITERATIONS);
    const payload = {
      owner_id: sess.session.user.id,
      algo: 'pbkdf2-sha256',
      iterations: PBKDF2_ITERATIONS,
      salt_b64,
      hash_b64,
      failed_attempts: 0,
      locked_until: null,
    };
    let res;
    if (lockRecord) {
      res = await c.from('wayon_ledger_lock').update({
        algo: payload.algo,
        iterations: payload.iterations,
        salt_b64: payload.salt_b64,
        hash_b64: payload.hash_b64,
        failed_attempts: 0,
        locked_until: null,
      }).eq('owner_id', payload.owner_id);
    } else {
      res = await c.from('wayon_ledger_lock').insert(payload);
    }
    if (res.error) throw res.error;
    lockRecord = {
      algo: payload.algo,
      iterations: payload.iterations,
      salt_b64: payload.salt_b64,
      hash_b64: payload.hash_b64,
      failed_attempts: 0,
      locked_until: null,
    };
    return lockRecord;
  }

  function checkOwnerAndPrivateLock() {
    if (checkLockPromise) return checkLockPromise;
    checkLockPromise = (async () => {
      const c = client();
      if (!c) {
        clearAllAndSignOut();
        if (open) render();
        return;
      }
      if (loadState === 'signedout') loadState = 'idle';
      if (!privateUnlocked) {
        ownerCheckState = 'checking';
        ownerCheckError = '';
        privateLockState = 'checking';
        privateLoadError = '';
        if (open && activeSpace === 'private') render();
      }
      try {
        const {data: sess, error: sessErr} = await c.auth.getSession();
        if (sessErr) throw sessErr;
        const uid = sess?.session?.user?.id;
        if (!uid) {
          clearAllAndSignOut();
          if (open) render();
          return;
        }
        if (loadState === 'signedout') loadState = 'idle';
        // Step 1: Verify owner role against public.wayon_owner (never hardcode UUID; non-owners never touch lock/salary/leave).
        const ownerRes = await c.from('wayon_owner').select('user_id').limit(1);
        if (ownerRes?.error) {
          ownerCheckState = 'error';
          ownerCheckError = String(ownerRes.error.message || ownerRes.error || '无法核验管理员权限');
          privateLockState = 'idle';
          if (open && activeSpace === 'private') render();
          return;
        }
        const ownerRow = Array.isArray(ownerRes?.data) ? (ownerRes.data[0] || null) : (ownerRes?.data || null);
        if (!ownerRow || ownerRow.user_id !== uid) {
          ownerCheckState = 'denied';
          ownerCheckError = '';
          privateLockState = 'idle';
          lockRecord = null;
          clearPrivateSensitiveStore();
          if (open && activeSpace === 'private') render();
          return;
        }
        ownerCheckState = 'owner';

        // Step 2: Owner confirmed -> inspect secondary PBKDF2-SHA256 lock row.
        const res = await c.from('wayon_ledger_lock')
          .select('algo,iterations,salt_b64,hash_b64,failed_attempts,locked_until')
          .limit(1);
        if (res.error) throw res.error;
        const row = Array.isArray(res.data) ? (res.data[0] || null) : (res.data || null);
        lockRecord = row;
        if (!privateUnlocked) {
          privateLockState = row ? 'locked' : 'setup';
          if (open && activeSpace === 'private') render();
        }
      } catch (e) {
        if (!privateUnlocked) {
          if (ownerCheckState === 'checking') {
            ownerCheckState = 'error';
            ownerCheckError = String(e?.message || e || '无法核验管理员权限');
          } else {
            privateLockState = 'error';
            privateLoadError = String(e?.message || e || '无法读取个人私密二级密码状态');
          }
          if (open && activeSpace === 'private') render();
        }
      } finally {
        checkLockPromise = null;
      }
    })();
    return checkLockPromise;
  }

  function isInteractionBusy() {
    if (modal?.open) return true;
    if (sheetDraft?.editing || inlineEditing) return true;
    const active = document.activeElement;
    if (!active || !root) return false;
    const insidePanel = typeof root.contains === 'function'
      ? root.contains(active)
      : Boolean(active.closest?.('#ledger-panel'));
    if (!insidePanel) return false;
    if (active.id === 'ldg-sheet-fx-input' || active.classList?.contains('ldg-cell-input') || active.classList?.contains('ldg-inline-input')) return true;
    const tag = String(active.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function makeInfoTip(text, opts = {}) {
    const cfg = typeof opts === 'string' ? {ariaLabel: opts} : (opts || {});
    const cls = ['ldg-tip-wrap', cfg.align === 'right' ? 'right' : '', cfg.placement === 'bottom' ? 'below' : ''].filter(Boolean).join(' ');
    const wrap = make('span', cls);
    const btn = make('button', 'ldg-info-tip', 'ⓘ');
    btn.type = 'button';
    btn.setAttribute('aria-label', cfg.ariaLabel || '说明');
    btn.title = String(text || '');
    const pop = make('span', 'ldg-tip-pop', String(text || ''));
    pop.setAttribute('role', 'tooltip');
    wrap.append(btn, pop);
    return wrap;
  }

  function makeInlineEditableCell({
    tag = 'td',
    cls = '',
    label = '',
    displayText = '',
    editValue = '',
    type = 'text',
    options = null,
    canEdit = () => true,
    onCommit,
    renderDisplay,
  }) {
    const editableNow = Boolean(canEdit());
    const cell = make(tag, cls + ' ldg-ed-cell' + (editableNow ? '' : ' readonly'));
    if (tag === 'td' && label) cell.dataset.label = label;
    if (tag === 'th') cell.scope = 'row';
    cell.tabIndex = editableNow ? 0 : -1;
    const paint = val => {
      cell.classList.remove('editing', 'saving');
      cell.textContent = '';
      if (typeof renderDisplay === 'function') {
        renderDisplay(cell, val);
      } else {
        cell.textContent = String(val ?? '');
      }
    };
    paint(displayText);
    let currentEditVal = editValue;
    let currentDisplayVal = displayText;
    let active = false;

    const begin = () => {
      if (active || !canEdit()) return;
      active = true;
      inlineEditing = true;
      cell.classList.add('editing');
      cell.textContent = '';
      let ctrl;
      if (type === 'select' && Array.isArray(options)) {
        ctrl = make('select', 'ldg-inline-input');
        options.forEach(optVal => {
          const o = make('option', '', String(optVal));
          o.value = String(optVal);
          if (String(optVal) === String(currentEditVal)) o.selected = true;
          ctrl.append(o);
        });
      } else {
        ctrl = make('input', 'ldg-inline-input');
        ctrl.type = type === 'number' ? 'text' : type;
        ctrl.value = String(currentEditVal ?? '');
      }
      ctrl.setAttribute('aria-label', label ? `编辑${label}` : '编辑单元格');
      cell.append(ctrl);
      ctrl.focus?.();
      if (ctrl.tagName === 'INPUT' && typeof ctrl.select === 'function') ctrl.select();

      let finished = false;
      const finish = async commit => {
        if (finished) return;
        finished = true;
        try {
          if (!commit) {
            paint(currentDisplayVal);
            return;
          }
          const nextRaw = String(ctrl.value ?? '').trim();
          if (nextRaw === String(currentEditVal ?? '').trim()) {
            paint(currentDisplayVal);
            return;
          }
          cell.classList.remove('editing');
          cell.classList.add('saving');
          cell.textContent = '保存中…';
          try {
            const res = await onCommit(nextRaw);
            if (res && res.error) {
              showActionError(res.error);
              paint(currentDisplayVal);
            } else {
              clearActionError();
              currentEditVal = res && 'editValue' in res ? res.editValue : nextRaw;
              currentDisplayVal = res && 'displayText' in res ? res.displayText : (nextRaw || '-');
              paint(currentDisplayVal);
            }
          } catch (err) {
            showActionError('保存失败：' + String(err?.message || err || '请稍后重试'));
            paint(currentDisplayVal);
          }
        } finally {
          active = false;
          inlineEditing = false;
          setTimeout(flushDeferredRender, 0);
        }
      };

      ctrl.addEventListener('keydown', e => {
        if (e.isComposing) return;
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); void finish(false); }
      });
      if (type === 'select') {
        ctrl.addEventListener('change', () => void finish(true));
      }
      ctrl.addEventListener('blur', () => void finish(true));
    };

    cell.onclick = e => {
      if (e.target && e.target.classList?.contains('ldg-inline-input')) return;
      begin();
    };
    cell.addEventListener('keydown', e => {
      if (active) return;
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        begin();
      }
    });
    return cell;
  }

  function flushDeferredRender() {
    if (!deferredRender || !open || isInteractionBusy()) return;
    deferredRender = false;
    render();
  }

  function renderOrDefer(force = false) {
    if (!open) return;
    if (!force && loadState !== 'signedout' && isInteractionBusy()) {
      deferredRender = true;
      return;
    }
    deferredRender = false;
    render();
  }

  function showActionError(msg) {
    actionError = String(msg || '操作失败，请稍后重试');
    const banner = root?.querySelector?.('.ldg-banner-err');
    if (banner) {
      const text = banner.querySelector?.('.ldg-banner-err-text');
      if (text) text.textContent = actionError;
      banner.hidden = false;
    } else if (open) {
      render();
    }
  }

  function clearActionError() {
    actionError = '';
    const banner = root?.querySelector?.('.ldg-banner-err');
    if (banner) banner.hidden = true;
  }

  function showActionInfo(msg) {
    actionInfo = String(msg || '');
    const banner = root?.querySelector?.('.ldg-banner-ok');
    if (banner) {
      const text = banner.querySelector?.('.ldg-banner-ok-text');
      if (text) text.textContent = actionInfo;
      banner.hidden = !actionInfo;
    } else if (open) {
      render();
    }
  }

  function clearActionInfo() {
    actionInfo = '';
    const banner = root?.querySelector?.('.ldg-banner-ok');
    if (banner) banner.hidden = true;
  }

  function isValidDateStr(str, allowSlash = false) {
    const s = String(str || '').trim();
    if (!s) return true;
    const re = allowSlash ? /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/;
    const m = s.match(re);
    if (!m) return false;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  }

  function parseRequiredNonNeg(raw, label, max = 99999999.99) {
    const text = String(raw ?? '').trim();
    if (!text) return {ok: false, error: `${label}不能为空`};
    const val = Number(text);
    if (!Number.isFinite(val)) return {ok: false, error: `${label}必须是有效数字`};
    if (val < 0) return {ok: false, error: `${label}不能为负数`};
    if (val > max) return {ok: false, error: `${label}超出允许上限（${max}）`};
    return {ok: true, value: val};
  }

  function parseOptionalPosInt(raw, label) {
    const text = String(raw ?? '').trim();
    if (!text) return {ok: true, value: null};
    if (!/^\d+$/.test(text)) return {ok: false, error: `${label}必须是正整数`};
    const val = Number(text);
    if (!Number.isInteger(val) || val < 1 || val > 2147483647) return {ok: false, error: `${label}必须是正整数`};
    return {ok: true, value: val};
  }

  function setupLightDismissFallback(dialog) {
    if ('closedBy' in (globalThis.HTMLDialogElement?.prototype || {})) return;
    const outside = (e) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', e => {
      pressedOutside = dialog.getAttribute('closedby') === 'any' && outside(e);
    });
    dialog.addEventListener('pointerup', e => {
      const hit = pressedOutside && dialog.getAttribute('closedby') === 'any' && outside(e);
      pressedOutside = false;
      if (hit && dialog.open) dialog.close();
    });
    dialog.addEventListener('pointercancel', () => { pressedOutside = false; });
    dialog.addEventListener('close', () => { pressedOutside = false; });
  }

  function ensureModal() {
    if (modal && modal.parentNode) return modal;
    if (!modal) {
      modal = make('dialog', 'ldg-dialog');
      modal.setAttribute('closedby', 'closerequest');
      modal.setAttribute('aria-labelledby', 'ldg-dialog-title');
      setupLightDismissFallback(modal);
      modal.addEventListener('close', () => {
        setTimeout(flushDeferredRender, 0);
      });
      for (const ev of ['pointerdown', 'keydown', 'input']) {
        modal.addEventListener(ev, touchActivity, {passive: true});
      }
    }
    document.body.append(modal);
    return modal;
  }

  function prepareModal(closedBy = 'closerequest') {
    const dlg = ensureModal();
    dlg.onclose = null;
    if (dlg.open) dlg.close();
    dlg.returnValue = '';
    dlg.classList.remove('ldg-lightbox');
    dlg.classList.remove('ldg-card-editor');
    dlg.setAttribute('closedby', closedBy);
    dlg.textContent = '';
    return dlg;
  }

  function openConfirmDialog(title, message, onConfirm) {
    const dlg = prepareModal('any');
    const box = make('form', 'ldg-dialog-body');
    const h = make('h3', '', title); h.id = 'ldg-dialog-title';
    const p = make('p', '', message); p.style.margin = '0'; p.style.color = 'var(--fg-secondary)';
    const errEl = make('p', 'ldg-form-err', ''); errEl.setAttribute('role', 'alert');
    const foot = make('div', 'ldg-dialog-foot');
    const cancel = make('button', 'ldg-btn', '取消'); cancel.type = 'button'; cancel.setAttribute('autofocus', '');
    cancel.onclick = () => { if (!busy) dlg.close(); };
    const ok = make('button', 'ldg-btn danger', '确认删除'); ok.type = 'submit';
    foot.append(cancel, ok);
    box.append(h, p, errEl, foot);
    let busy = false;
    box.onsubmit = async e => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      ok.disabled = true;
      cancel.disabled = true;
      ok.textContent = '删除中…';
      errEl.textContent = '';
      try {
        await onConfirm();
        dlg.close();
      } catch (err) {
        errEl.textContent = '删除失败：' + String(err?.message || err || '请稍后重试');
      } finally {
        busy = false;
        ok.disabled = false;
        cancel.disabled = false;
        ok.textContent = '确认删除';
      }
    };
    dlg.append(box);
    dlg.showModal();
  }

  // Safe DOM-only Markdown + GFM/HTML table renderer (zero innerHTML).
  const SAFE_URL_RE = /^(?:https?:\/\/|mailto:|#|\.?\/)/i;
  const INLINE_TOKEN_RE = /<br\s*\/?>|\\([\\`*_{}\[\]()#+\-.!|>~])|`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\[([^\]]+)\]\(([^)\s]+)\)/gi;

  function unescapeMarkdown(text) {
    return String(text || '').replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, '$1');
  }

  function stripNonBrHtml(text) {
    return String(text || '').replace(/<(?!\/?br\s*\/?>)[^>]+>/gi, '');
  }

  function appendInlineMarkdown(parent, rawText) {
    const src = stripNonBrHtml(rawText);
    const re = new RegExp(INLINE_TOKEN_RE.source, INLINE_TOKEN_RE.flags);
    let last = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) {
        parent.append(document.createTextNode(src.slice(last, m.index)));
      }
      if (/^<br\s*\/?>$/i.test(m[0])) {
        parent.append(make('br'));
      } else if (m[1] !== undefined) {
        parent.append(document.createTextNode(m[1]));
      } else if (m[2] !== undefined) {
        parent.append(make('code', '', m[2]));
      } else if (m[3] !== undefined || m[4] !== undefined) {
        const strong = make('strong');
        appendInlineMarkdown(strong, m[3] !== undefined ? m[3] : m[4]);
        parent.append(strong);
      } else if (m[5] !== undefined && m[6] !== undefined) {
        const label = m[5];
        const href = m[6].trim();
        if (SAFE_URL_RE.test(href)) {
          const a = make('a');
          a.href = href;
          if (/^https?:\/\//i.test(href)) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
          appendInlineMarkdown(a, label);
          parent.append(a);
        } else {
          appendInlineMarkdown(parent, label);
        }
      }
      last = re.lastIndex;
    }
    if (last < src.length) {
      parent.append(document.createTextNode(src.slice(last)));
    }
  }

  function parseMarkdownBlocks(md) {
    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    const LIST_LINE_RE = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
    const HR_RE = /^\s*(?:---+|\*\*\*+|___+)\s*$/;
    const BLOCK_START_RE = /^(?:#{1,6}\s+|>|\||<table\b|\s*(?:---+|\*\*\*+|___+)\s*$|\s*(?:[-*+]|\d+\.)\s+)/i;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        blocks.push({type: 'heading', level: hMatch[1].length, text: hMatch[2].trim()});
        i++; continue;
      }
      if (HR_RE.test(line)) {
        blocks.push({type: 'hr'});
        i++; continue;
      }
      if (line.trimStart().startsWith('>')) {
        const q = [];
        while (i < lines.length && lines[i].trimStart().startsWith('>')) {
          q.push(lines[i].trimStart().replace(/^>\s?/, '').trimEnd());
          i++;
        }
        blocks.push({type: 'quote', text: q.join('\n')});
        continue;
      }
      if (line.trim().startsWith('|') && i + 1 < lines.length && /^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(lines[i + 1].trim())) {
        const parseRow = raw => raw.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
        const head = parseRow(lines[i]);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(parseRow(lines[i])); i++; }
        blocks.push({type: 'table', head, rows});
        continue;
      }
      if (/^<table\b/i.test(line.trim())) {
        let buf = '';
        while (i < lines.length) {
          buf += lines[i] + '\n';
          if (/<\/table>/i.test(lines[i])) { i++; break; }
          i++;
        }
        const trMatches = [...buf.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
        const parsedRows = trMatches.map(m =>
          [...m[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c => stripNonBrHtml(c[1]).trim())
        );
        if (parsedRows.length) blocks.push({type: 'table', head: parsedRows[0], rows: parsedRows.slice(1)});
        continue;
      }
      const firstList = line.match(LIST_LINE_RE);
      if (firstList) {
        const rootIndent = firstList[1].replace(/\t/g, '  ').length;
        const rootOrdered = /^\d+\.$/.test(firstList[2]);
        const rootList = {type: 'list', ordered: rootOrdered, indent: rootIndent, items: []};
        const stack = [rootList];
        while (i < lines.length) {
          const lm = lines[i].match(LIST_LINE_RE);
          if (!lm) break;
          const indent = lm[1].replace(/\t/g, '  ').length;
          const ordered = /^\d+\.$/.test(lm[2]);
          const text = lm[3].trim();
          while (stack.length > 1 && indent < stack[stack.length - 1].indent) {
            stack.pop();
          }
          const top = stack[stack.length - 1];
          if (indent === top.indent) {
            if (ordered !== top.ordered) {
              if (stack.length === 1) break;
              stack.pop();
              const parentTop = stack[stack.length - 1];
              const hostItem = parentTop.items[parentTop.items.length - 1];
              const siblingList = {type: 'list', ordered, indent, items: [{text, children: []}]};
              hostItem.children.push(siblingList);
              stack.push(siblingList);
            } else {
              top.items.push({text, children: []});
            }
          } else if (indent > top.indent) {
            const hostItem = top.items[top.items.length - 1];
            if (hostItem) {
              const childList = {type: 'list', ordered, indent, items: [{text, children: []}]};
              hostItem.children.push(childList);
              stack.push(childList);
            } else {
              top.items.push({text, children: []});
            }
          } else {
            break;
          }
          i++;
        }
        blocks.push(rootList);
        continue;
      }
      const p = [];
      while (i < lines.length && lines[i].trim() && !BLOCK_START_RE.test(lines[i])) {
        p.push(lines[i].trim());
        i++;
      }
      if (p.length) blocks.push({type: 'p', text: p.join(' ')});
    }
    return blocks;
  }

  function renderListBlock(blk) {
    const list = make(blk.ordered ? 'ol' : 'ul');
    for (const it of blk.items) {
      const li = make('li');
      const text = typeof it === 'string' ? it : it.text;
      appendInlineMarkdown(li, text);
      if (it && Array.isArray(it.children)) {
        for (const sub of it.children) li.append(renderListBlock(sub));
      }
      list.append(li);
    }
    return list;
  }

  function renderResponsiveTable(caption, headers, rows, {markdownCells = false} = {}) {
    const wrap = make('div', 'ldg-table-wrap');
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', caption);
    const tbl = make('table', 'ldg-table');
    const thead = make('thead'), htr = make('tr');
    headers.forEach(h => {
      const th = make('th', typeof h === 'object' && h.num ? 'num' : '');
      th.scope = 'col';
      const label = typeof h === 'object' ? h.label : h;
      if (markdownCells) appendInlineMarkdown(th, label); else th.textContent = String(label ?? '');
      htr.append(th);
    });
    thead.append(htr);
    const tbody = make('tbody');
    rows.forEach(r => {
      const tr = make('tr');
      r.forEach((cell, idx) => {
        const hDef = headers[idx];
        const rawLabel = typeof hDef === 'object' ? hDef.label : (hDef || '');
        const label = markdownCells ? unescapeMarkdown(stripNonBrHtml(rawLabel).replace(/[*_`]/g, '')) : rawLabel;
        const isNum = typeof hDef === 'object' && hDef.num;
        const isNode = cell && typeof cell === 'object' && (typeof Node !== 'undefined' && cell instanceof Node || typeof cell.tagName === 'string');
        if (idx === 0) {
          const th = make('th', '');
          th.scope = 'row';
          if (isNode) th.append(cell);
          else if (markdownCells) appendInlineMarkdown(th, String(cell ?? ''));
          else th.textContent = String(cell ?? '');
          tr.append(th);
        } else {
          const td = make('td', isNum ? 'num' : '');
          td.dataset.label = label;
          if (isNode) td.append(cell);
          else if (markdownCells) appendInlineMarkdown(td, String(cell ?? ''));
          else td.textContent = String(cell ?? '');
          tr.append(td);
        }
      });
      tbody.append(tr);
    });
    tbl.append(thead, tbody);
    wrap.append(tbl);
    return wrap;
  }

  function renderMarkdownNode(md, label) {
    const box = make('div', 'ldg-md');
    for (const blk of parseMarkdownBlocks(md)) {
      if (blk.type === 'heading') {
        const h = make('h' + Math.min(6, Math.max(1, blk.level)));
        appendInlineMarkdown(h, blk.text);
        box.append(h);
      } else if (blk.type === 'hr') {
        box.append(make('hr', 'ldg-hr'));
      } else if (blk.type === 'quote') {
        const bq = make('blockquote');
        const qLines = String(blk.text || '').split('\n');
        qLines.forEach((ql, idx) => {
          if (idx > 0) bq.append(make('br'));
          appendInlineMarkdown(bq, ql);
        });
        box.append(bq);
      } else if (blk.type === 'list') {
        box.append(renderListBlock(blk));
      } else if (blk.type === 'table') {
        box.append(renderResponsiveTable(label || '数据表', blk.head, blk.rows, {markdownCells: true}));
      } else {
        const p = make('p');
        appendInlineMarkdown(p, blk.text);
        box.append(p);
      }
    }
    return box;
  }

  const COMMISSION_HEADING_RE = /(?:提成|阶梯|Leo\s*总结算|Leo\s*结算|工资|薪资)/i;
  const COMMISSION_LINE_RE = /(?:提成课时|提成阶梯|提成|Leo\s*总结算|Leo\s*结算|助教总结算|距下档|距下一阶梯|当前余量|当前阶梯余量|满档阶梯|个人工资|税前工资)/i;

  function sanitizeAcademicSummaryMd(md) {
    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let skipLevel = 0;
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        const lvl = hm[1].length;
        if (skipLevel > 0 && lvl <= skipLevel) skipLevel = 0;
        if (COMMISSION_HEADING_RE.test(hm[2])) {
          skipLevel = lvl;
          i++;
          continue;
        }
      }
      if (skipLevel > 0) { i++; continue; }
      if (line.trim().startsWith('|') && i + 1 < lines.length && /^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(lines[i + 1].trim())) {
        const headLine = line;
        const sepLine = lines[i + 1];
        i += 2;
        const bodyLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          if (!COMMISSION_LINE_RE.test(lines[i])) bodyLines.push(lines[i]);
          i++;
        }
        if (!COMMISSION_LINE_RE.test(headLine) && bodyLines.length) {
          out.push(headLine, sepLine, ...bodyLines);
        }
        continue;
      }
      if (COMMISSION_LINE_RE.test(line)) { i++; continue; }
      out.push(line);
      i++;
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function extractCommissionSummaryMd(md) {
    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let keepLevel = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        const lvl = hm[1].length;
        if (keepLevel > 0 && lvl <= keepLevel) keepLevel = 0;
        if (COMMISSION_HEADING_RE.test(hm[2])) {
          keepLevel = lvl;
          out.push(line);
          continue;
        }
      }
      if (keepLevel > 0) {
        out.push(line);
        continue;
      }
      if (COMMISSION_LINE_RE.test(line)) out.push(line);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function loadAcademic({force = false} = {}) {
    if (force) reloadForce = true;
    if (loading) {
      reloadQueued = true;
      return loadPromise || Promise.resolve();
    }
    loadPromise = runLoadAcademic();
    return loadPromise;
  }

  async function runLoadAcademic() {
    do {
      reloadQueued = false;
      const force = reloadForce;
      reloadForce = false;
      const c = client();
      if (!c) {
        clearAllAndSignOut();
        if (open) renderOrDefer(force);
        break;
      }
      loading = true;
      if (loadState === 'idle' || loadState === 'signedout') { loadState = 'loading'; if (open && activeSpace === 'academic') renderOrDefer(force); }
      try {
        const {data: sess, error: sessErr} = await c.auth.getSession();
        if (sessErr) throw sessErr;
        if (!sess?.session) {
          clearAllAndSignOut();
        } else {
          // NOTE: Strictly academic tables only; NEVER queries wayon_salary_records, wayon_leave_ledger, or wayon_ledger_lock.
          const [bRes, pRes, dRes] = await Promise.all([
            c.from('wayon_billing_months').select('*').order('year_month', {ascending: false}),
            c.from('wayon_student_profiles').select('*').order('name', {ascending: true}),
            c.from('wayon_reference_docs').select('*').order('updated_at', {ascending: false}),
          ]);
          for (const r of [bRes, pRes, dRes]) if (r.error) throw r.error;
          store.billing = bRes.data || [];
          store.profiles = pRes.data || [];
          store.docs = dRes.data || [];
          if (selectedMonth && !store.billing.some(m => m.year_month === selectedMonth)) selectedMonth = '';
          if (!selectedMonth && store.billing.length) selectedMonth = store.billing[0].year_month;
          if (sheetDraft && !sheetDraft.dirty) {
            const matched = store.billing.find(m => m.year_month === sheetDraft.yearMonth);
            if (!matched) sheetDraft = null;
            else sheetDraft.records = cloneSheetRecords(matched.meta?.records);
          }
          if (ltDraft && !ltDraft.dirty) ltDraft = null;
          loadState = 'ready';
          loadError = '';
        }
      } catch (e) {
        loadState = 'error';
        loadError = String(e?.message || e || '加载失败');
      } finally {
        loading = false;
        if (open && activeSpace === 'academic') renderOrDefer(force);
      }
    } while (reloadQueued);
    loadPromise = null;
  }

  function loadPrivate({force = false} = {}) {
    if (!privateUnlocked || ownerCheckState !== 'owner') return Promise.resolve();
    if (force) privateReloadForce = true;
    if (privateLoading) {
      privateReloadQueued = true;
      return privateLoadPromise || Promise.resolve();
    }
    privateLoadPromise = runLoadPrivate();
    return privateLoadPromise;
  }

  async function runLoadPrivate() {
    do {
      privateReloadQueued = false;
      const force = privateReloadForce;
      privateReloadForce = false;
      if (!privateUnlocked || ownerCheckState !== 'owner') break;
      const c = client();
      if (!c) {
        clearAllAndSignOut();
        if (open) render();
        break;
      }
      privateLoading = true;
      if (privateLoadState === 'idle') {
        privateLoadState = 'loading';
        if (open && activeSpace === 'private') renderOrDefer(force);
      }
      try {
        const {data: sess, error: sessErr} = await c.auth.getSession();
        if (sessErr) throw sessErr;
        if (!privateUnlocked || ownerCheckState !== 'owner') { clearPrivateSensitiveStore(); break; }
        if (!sess?.session) { clearAllAndSignOut(); break; }
        const queries = [
          c.from('wayon_salary_records').select('*').order('work_month', {ascending: false}),
          c.from('wayon_leave_ledger').select('*').order('seq', {ascending: true, nullsFirst: false}).order('created_at', {ascending: true}),
        ];
        const needBilling = force || !store.billing.length;
        if (needBilling) {
          queries.push(c.from('wayon_billing_months').select('*').order('year_month', {ascending: false}));
        }
        const results = await Promise.all(queries);
        if (!privateUnlocked || ownerCheckState !== 'owner') { clearPrivateSensitiveStore(); break; }
        for (const r of results) if (r.error) throw r.error;
        store.salary = results[0].data || [];
        store.leave = results[1].data || [];
        if (needBilling && results[2]) {
          store.billing = results[2].data || [];
          if (!selectedMonth && store.billing.length) selectedMonth = store.billing[0].year_month;
        }
        if (commissionMonth && !store.billing.some(m => m.year_month === commissionMonth)) commissionMonth = '';
        if (!commissionMonth && store.billing.length) {
          const withComm = store.billing.find(m => num(m.meta?.commission?.total) > 0);
          commissionMonth = (withComm || store.billing[0]).year_month;
        }
        privateLoadState = 'ready';
        privateLoadError = '';
      } catch (e) {
        if (!privateUnlocked) { clearPrivateSensitiveStore(); break; }
        privateLoadState = 'error';
        privateLoadError = String(e?.message || e || '个人私密数据加载失败');
      } finally {
        privateLoading = false;
        if (open && activeSpace === 'private') renderOrDefer(force);
      }
    } while (privateReloadQueued && privateUnlocked && ownerCheckState === 'owner');
    privateLoadPromise = null;
  }

  async function getSignedUrl(path) {
    if (loadState !== 'ready') return null;
    const cached = signedUrls.get(path);
    if (cached && cached.exp > Date.now()) return cached.url;
    const c = client();
    if (!c) return null;
    const {data, error} = await c.storage.from('wayon-billing').createSignedUrl(path, 300);
    if (loadState !== 'ready' || error || !data?.signedUrl) return null;
    signedUrls.set(path, {url: data.signedUrl, exp: Date.now() + 240_000});
    return data.signedUrl;
  }

  async function sha256Hex(arrayBuffer) {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const digest = await subtle.digest('SHA-256', arrayBuffer);
      return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const rand = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(rand);
    return [...rand].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function triggerBlobDownload(blob, filename) {
    if (typeof globalThis.URL?.createObjectURL === 'function') {
      const blobUrl = globalThis.URL.createObjectURL(blob);
      const a = make('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      setTimeout(() => { try { globalThis.URL.revokeObjectURL(blobUrl); } catch {} }, 10000);
      return true;
    }
    return false;
  }

  async function saveBlobToDesktop(blob, filename, mime = 'image/png') {
    const safeName = String(filename || 'download.png').trim() || 'download.png';
    if (typeof globalThis.showSaveFilePicker === 'function') {
      try {
        const isPng = /\.png$/i.test(safeName) || mime === 'image/png';
        const isXlsx = /\.xlsx$/i.test(safeName);
        const types = isPng
          ? [{description: 'PNG 图片', accept: {'image/png': ['.png']}}]
          : (isXlsx
            ? [{description: 'Excel 表格', accept: {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']}}]
            : undefined);
        const handle = await globalThis.showSaveFilePicker({
          suggestedName: safeName,
          startIn: 'desktop',
          ...(types ? {types} : {}),
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return {saved: true, cancelled: false, method: 'picker'};
      } catch (err) {
        if (err?.name === 'AbortError') return {saved: false, cancelled: true, method: 'picker'};
      }
    }
    triggerBlobDownload(blob, safeName);
    return {saved: true, cancelled: false, method: 'download'};
  }

  async function saveFileToDesktop(fileObj, btn) {
    if (btn && btn.disabled) return;
    if (btn) btn.disabled = true;
    clearActionError();
    try {
      const u = await getSignedUrl(fileObj.path);
      if (!u) throw new Error('获取签名下载链接失败');
      let blob = null;
      if (typeof globalThis.fetch === 'function') {
        try {
          const resp = await globalThis.fetch(u);
          if (resp && resp.ok) blob = await resp.blob();
        } catch {}
      }
      const fname = fileObj.name || 'download';
      if (blob) {
        const res = await saveBlobToDesktop(blob, fname, fileObj.kind === 'image' ? 'image/png' : '');
        if (res.cancelled) return;
        showActionInfo(res.method === 'picker' ? `已保存「${fname}」` : `已开始下载「${fname}」`);
        return;
      }
      const a = make('a');
      a.href = u;
      a.download = fname;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    } catch (err) {
      showActionError('保存失败：' + String(err?.message || err || '请稍后重试'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function downloadSignedFile(fileObj, btn) {
    if (btn && btn.disabled) return;
    if (btn) btn.disabled = true;
    clearActionError();
    try {
      const u = await getSignedUrl(fileObj.path);
      if (!u) throw new Error('获取签名下载链接失败');
      let blobUrl = '';
      if (typeof globalThis.fetch === 'function' && typeof globalThis.URL?.createObjectURL === 'function') {
        try {
          const resp = await globalThis.fetch(u);
          if (resp && resp.ok) {
            const blob = await resp.blob();
            blobUrl = globalThis.URL.createObjectURL(blob);
          }
        } catch {}
      }
      const a = make('a');
      a.href = blobUrl || u;
      a.download = fileObj.name || 'download';
      if (!blobUrl) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      a.click();
      if (blobUrl) {
        setTimeout(() => { try { globalThis.URL.revokeObjectURL(blobUrl); } catch {} }, 10000);
      }
    } catch (err) {
      showActionError('下载失败：' + String(err?.message || err || '请稍后重试'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function formatCardMonthLabel(ym) {
    const m = String(ym || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return String(ym || '');
    return `${m[1].slice(2)}年${Number(m[2])}月`;
  }

  function buildTeacherCardRows(records, teacher) {
    const target = String(teacher || '').trim();
    const rows = (records || []).filter(r => String(r.teacher || '').trim() === target && num(r.hours) > 0);
    const isSplit = SPLIT_TEACHERS.has(target);
    let total = 0;
    let hasOver4Warning = false;
    const out = [];
    if (isSplit) {
      const byCount = new Map();
      for (const r of rows) {
        const cnt = Math.max(1, Math.round(num(r.count || 1)));
        const hrs = Math.round(num(r.hours) * 100) / 100;
        total = Math.round((total + hrs) * 100) / 100;
        if (cnt > 4) hasOver4Warning = true;
        byCount.set(cnt, Math.round((num(byCount.get(cnt)) + hrs) * 100) / 100);
      }
      [...byCount.entries()].sort((a, b) => a[0] - b[0]).forEach(([cnt, hrs]) => {
        if (hrs > 0) {
          out.push({label: cnt > 4 ? `1 对 ${cnt} 课时（请核对）` : `1 对 ${cnt} 课时`, hours: hrs});
        }
      });
    } else {
      let oneOnOne = 0, groupHrs = 0;
      for (const r of rows) {
        const cnt = Math.max(1, Math.round(num(r.count || 1)));
        const hrs = Math.round(num(r.hours) * 100) / 100;
        total = Math.round((total + hrs) * 100) / 100;
        if (cnt === 1) oneOnOne = Math.round((oneOnOne + hrs) * 100) / 100;
        else groupHrs = Math.round((groupHrs + hrs) * 100) / 100;
      }
      if (oneOnOne > 0) out.push({label: '1 对 1 课时', hours: oneOnOne});
      if (groupHrs > 0) out.push({label: '1 对多 课时', hours: groupHrs});
    }
    return {rows: out, total, hasOver4Warning};
  }

  function canvasRoundRectPath(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function wrapCardNoteLines(noteText, maxChars = 30) {
    const raw = String(noteText || '').replace(/\r\n?/g, '\n').trim();
    if (!raw) return [''];
    const lines = [];
    for (const para of raw.split('\n')) {
      if (!para) { lines.push(''); continue; }
      for (let i = 0; i < para.length; i += maxChars) {
        lines.push(para.slice(i, i + maxChars));
      }
    }
    return lines.length ? lines : [''];
  }

  function renderTeacherCardCanvas(canvas, spec) {
    const SCALE = 2;
    const W = 468;
    const PAD = 24;
    const CARD_W = 420;
    const RADIUS = 18;
    const HEAD_H = 133;
    const ROW_H = 56;
    const TOT_H = 68;
    const FONT = '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif';

    const rows = Array.isArray(spec?.rows) && spec.rows.length
      ? spec.rows
      : [{label: '1 对 1 课时', hours: 0}];
    const total = Math.round(rows.reduce((s, r) => s + Math.max(0, num(r.hours)), 0) * 100) / 100;
    const noteLines = wrapCardNoteLines(spec?.note ?? '如有出入请联系 Leo 核对', 30);
    const FOOT_H = Math.max(39, 16 + noteLines.length * 18);
    const cardH = HEAD_H + ROW_H * rows.length + TOT_H + FOOT_H;
    const H = cardH + PAD * 2;

    if (canvas) {
      canvas.width = W * SCALE;
      canvas.height = H * SCALE;
    }
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return {width: W * SCALE, height: H * SCALE, total};

    ctx.save();
    ctx.scale(SCALE, SCALE);

    // Outer canvas background
    ctx.fillStyle = '#f4f5f7';
    ctx.fillRect(0, 0, W, H);

    // Card drop shadow + white body
    ctx.save();
    ctx.shadowColor = 'rgba(20, 30, 60, 0.10)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    canvasRoundRectPath(ctx, PAD, PAD, CARD_W, cardH, RADIUS);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Clip all inner layers to the rounded card
    ctx.save();
    canvasRoundRectPath(ctx, PAD, PAD, CARD_W, cardH, RADIUS);
    ctx.clip();

    // Deep blue header (#1f3a5f, height 133)
    ctx.fillStyle = '#1f3a5f';
    ctx.fillRect(PAD, PAD, CARD_W, HEAD_H);

    // Header left: eyebrow, teacher name, month pill
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `500 13px ${FONT}`;
    ctx.fillText(String(spec?.eyebrow || '课时核对'), PAD + 24, PAD + 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 24px ${FONT}`;
    const teacherRaw = String(spec?.teacher || '').trim();
    const teacherTitle = teacherRaw ? (teacherRaw.endsWith('老师') ? teacherRaw : `${teacherRaw} 老师`) : '老师';
    ctx.fillText(teacherTitle, PAD + 24, PAD + 48);

    const monthTxt = String(spec?.monthLabel || '').trim();
    if (monthTxt) {
      ctx.font = `500 13px ${FONT}`;
      const pillW = Math.max(68, Math.ceil((ctx.measureText?.(monthTxt)?.width || monthTxt.length * 11) + 24));
      const pillX = PAD + 24;
      const pillY = PAD + 92;
      const pillH = 26;
      canvasRoundRectPath(ctx, pillX, pillY, pillW, pillH, 13);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(monthTxt, pillX + 12, pillY + 13);
    }

    // Header top-right: pure-vector white Wayon lockup (W emblem + 维安教育 + WAYON EDUCATION)
    const logoRight = PAD + CARD_W - 22;
    const logoTop = PAD + 22;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const wx = logoRight - 104;
    ctx.beginPath();
    ctx.moveTo(wx, logoTop + 4);
    ctx.lineTo(wx + 5, logoTop + 20);
    ctx.lineTo(wx + 10, logoTop + 9);
    ctx.lineTo(wx + 15, logoTop + 20);
    ctx.lineTo(wx + 20, logoTop + 4);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText('维安教育', logoRight, logoTop + 1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.font = `500 8px ${FONT}`;
    ctx.fillText('WAYON EDUCATION', logoRight, logoTop + 21);
    ctx.restore();

    // Summary rows (height 56 each)
    let curY = PAD + HEAD_H;
    rows.forEach(r => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(PAD, curY, CARD_W, ROW_H);
      ctx.fillStyle = '#eef0f3';
      ctx.fillRect(PAD, curY + ROW_H - 1, CARD_W, 1);

      const midY = curY + ROW_H / 2;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#333333';
      ctx.font = `500 16px ${FONT}`;
      ctx.fillText(String(r.label || ''), PAD + 24, midY);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#888888';
      ctx.font = `400 13px ${FONT}`;
      const unitW = ctx.measureText?.('课时')?.width || 26;
      ctx.fillText('课时', PAD + CARD_W - 24, midY + 1);

      ctx.fillStyle = '#111111';
      ctx.font = `700 17px ${FONT}`;
      ctx.fillText(Math.max(0, num(r.hours)).toFixed(1), PAD + CARD_W - 24 - unitW - 4, midY);

      curY += ROW_H;
    });

    // Total bar (#f7f9fc, height 68)
    ctx.fillStyle = '#f7f9fc';
    ctx.fillRect(PAD, curY, CARD_W, TOT_H);
    const totMidY = curY + TOT_H / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1f3a5f';
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText('总课时（合计）', PAD + 24, totMidY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#888888';
    ctx.font = `400 13px ${FONT}`;
    const totUnitW = ctx.measureText?.('课时')?.width || 26;
    ctx.fillText('课时', PAD + CARD_W - 24, totMidY + 3);

    ctx.fillStyle = '#1f3a5f';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(total.toFixed(1), PAD + CARD_W - 24 - totUnitW - 4, totMidY);

    curY += TOT_H;

    // Footer note (#f7f9fc, adaptive height)
    ctx.fillStyle = '#f7f9fc';
    ctx.fillRect(PAD, curY, CARD_W, FOOT_H);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9aa1ab';
    ctx.font = `400 12px ${FONT}`;
    noteLines.forEach((line, idx) => {
      if (line) ctx.fillText(line, PAD + 24, curY + 8 + idx * 18);
    });

    ctx.restore();
    ctx.restore();
    return {width: W * SCALE, height: H * SCALE, total};
  }

  async function canvasToPngBlob(canvas) {
    if (canvas && typeof canvas.toBlob === 'function') {
      const b = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (b) return b;
    }
    if (canvas && typeof canvas.toDataURL === 'function') {
      const dataUrl = canvas.toDataURL('image/png');
      const b64 = String(dataUrl || '').split(',')[1] || '';
      const bytes = b64 ? b64ToBytes(b64) : new Uint8Array(0);
      if (typeof globalThis.Blob === 'function') return new globalThis.Blob([bytes], {type: 'image/png'});
      return {size: bytes.length, type: 'image/png', async arrayBuffer() { return bytes.buffer; }};
    }
    const fallback = new Uint8Array([137, 80, 78, 71]);
    if (typeof globalThis.Blob === 'function') return new globalThis.Blob([fallback], {type: 'image/png'});
    return {size: fallback.length, type: 'image/png', async arrayBuffer() { return fallback.buffer; }};
  }

  function openTeacherCardEditor(curMonth, teacherName) {
    const dlg = prepareModal('closerequest');
    dlg.classList.add('ldg-card-editor');
    const records = (sheetDraft && sheetDraft.yearMonth === curMonth.year_month)
      ? sheetDraft.records
      : cloneSheetRecords(curMonth.meta?.records);
    const initialTeacher = String(teacherName || '').trim()
      || String(curMonth.meta?.teachers?.[0] || records[0]?.teacher || '').trim();
    const monthLabelDefault = formatCardMonthLabel(curMonth.year_month);
    const computedInit = buildTeacherCardRows(records, initialTeacher);

    const state = {
      teacher: initialTeacher,
      monthLabel: monthLabelDefault,
      eyebrow: '课时核对',
      rows: computedInit.rows.length ? computedInit.rows.map(r => ({...r})) : [{label: '1 对 1 课时', hours: 0}],
      note: computedInit.hasOver4Warning ? '注意：含超过 4 人班课，请核对后再发\n如有出入请联系 Leo 核对' : '如有出入请联系 Leo 核对',
    };

    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const head = make('div', 'ldg-lightbox-head');
    const h = make('h3', '', `核对卡编辑器 · ${state.teacher || '自定义'}`);
    h.id = 'ldg-dialog-title';
    const closeTop = make('button', 'ldg-btn sm', '关闭');
    closeTop.type = 'button';
    head.append(h, closeTop);

    const grid = make('div', 'ldg-ce-grid');
    const left = make('div', 'ldg-ce-form');
    const right = make('div', 'ldg-ce-preview');

    const canvas = make('canvas');
    canvas.id = 'ldg-ce-canvas';
    canvas.setAttribute('aria-label', '老师课时核对卡高清预览');
    const totPill = make('span', 'ldg-sub', '');
    right.append(canvas, totPill);

    const redrawCanvas = () => {
      const res = renderTeacherCardCanvas(canvas, state);
      h.textContent = `核对卡编辑器 · ${state.teacher || '自定义'}`;
      totPill.textContent = `2x 高清 PNG · 合计 ${res.total.toFixed(1)} 课时`;
    };

    const gMeta = make('div', 'ldg-field-grid');
    const fT = make('div', 'ldg-field'), iT = make('input');
    iT.id = 'ldg-ce-teacher'; iT.value = state.teacher; iT.placeholder = '老师姓名'; iT.setAttribute('autofocus', '');
    iT.addEventListener('input', () => { state.teacher = iT.value.trim(); redrawCanvas(); });
    fT.append(make('label', '', '老师姓名'), iT);

    const fM = make('div', 'ldg-field'), iM = make('input');
    iM.id = 'ldg-ce-month'; iM.value = state.monthLabel; iM.placeholder = '例：26年10月';
    iM.addEventListener('input', () => { state.monthLabel = iM.value.trim(); redrawCanvas(); });
    fM.append(make('label', '', '月份胶囊'), iM);
    gMeta.append(fT, fM);

    const rowsHeader = make('div', 'ldg-head');
    rowsHeader.append(make('span', 'ldg-sub', '课型与课时明细行'));
    const rowBtns = make('div', 'ldg-head-actions');
    const recalcBtn = make('button', 'ldg-btn sm', '↻ 从在线表重算');
    recalcBtn.type = 'button';
    recalcBtn.onclick = () => {
      const latest = (sheetDraft && sheetDraft.yearMonth === curMonth.year_month)
        ? sheetDraft.records
        : cloneSheetRecords(curMonth.meta?.records);
      const calc = buildTeacherCardRows(latest, state.teacher);
      state.rows = calc.rows.length ? calc.rows.map(r => ({...r})) : [{label: '1 对 1 课时', hours: 0}];
      paintRows();
      redrawCanvas();
    };
    const addRowBtn = make('button', 'ldg-btn sm', '＋ 加一行');
    addRowBtn.id = 'ldg-ce-add-row';
    addRowBtn.type = 'button';
    addRowBtn.onclick = () => {
      state.rows.push({label: '1 对 1 课时', hours: 0});
      paintRows();
      redrawCanvas();
    };
    rowBtns.append(recalcBtn, addRowBtn);
    rowsHeader.append(rowBtns);

    const rowsBox = make('div', 'ldg-ce-rows');
    function paintRows() {
      rowsBox.textContent = '';
      state.rows.forEach((row, idx) => {
        const line = make('div', 'ldg-ce-row');
        const iLbl = make('input');
        iLbl.value = row.label;
        iLbl.placeholder = '例：1 对 1 课时';
        iLbl.setAttribute('aria-label', `第 ${idx + 1} 行课型`);
        iLbl.addEventListener('input', () => { row.label = iLbl.value; redrawCanvas(); });

        const iHrs = make('input', 'num');
        iHrs.type = 'number';
        iHrs.min = '0';
        iHrs.step = '0.5';
        iHrs.value = String(row.hours);
        iHrs.setAttribute('aria-label', `第 ${idx + 1} 行课时`);
        iHrs.addEventListener('input', () => { row.hours = Math.max(0, num(iHrs.value)); redrawCanvas(); });

        const delBtn = make('button', 'ldg-row-op-btn del', '×');
        delBtn.type = 'button';
        delBtn.setAttribute('aria-label', `删除第 ${idx + 1} 行`);
        delBtn.onclick = () => {
          state.rows.splice(idx, 1);
          paintRows();
          redrawCanvas();
        };
        line.append(iLbl, iHrs, delBtn);
        rowsBox.append(line);
      });
    }

    const fNote = make('div', 'ldg-field'), iNote = make('textarea');
    iNote.id = 'ldg-ce-note';
    iNote.rows = 2;
    iNote.value = state.note;
    iNote.addEventListener('input', () => { state.note = iNote.value; redrawCanvas(); });
    fNote.append(make('label', '', '底部备注'), iNote);

    const errEl = make('p', 'ldg-form-err', '');
    errEl.setAttribute('role', 'alert');

    left.append(gMeta, rowsHeader, rowsBox, fNote, errEl);
    grid.append(left, right);

    const foot = make('div', 'ldg-dialog-foot');
    let busy = false;
    const cancel = make('button', 'ldg-btn', '取消'); cancel.type = 'button';
    cancel.onclick = () => { if (!busy) dlg.close(); };
    closeTop.onclick = () => { if (!busy) dlg.close(); };

    const getEditedFilename = () => {
      const t = state.teacher || '老师';
      const m = state.monthLabel || formatCardMonthLabel(curMonth.year_month);
      return `${t}【${m}】课时核对（编辑版）.png`;
    };

    const deskBtn = make('button', 'ldg-btn', '⬇️ 存到桌面');
    deskBtn.id = 'ldg-ce-desktop-btn';
    deskBtn.type = 'button';
    deskBtn.onclick = async () => {
      if (busy) return;
      errEl.textContent = '';
      busy = true;
      deskBtn.disabled = true;
      try {
        redrawCanvas();
        const blob = await canvasToPngBlob(canvas);
        const res = await saveBlobToDesktop(blob, getEditedFilename(), 'image/png');
        if (!res.cancelled) showActionInfo(`已导出「${getEditedFilename()}」`);
      } catch (err) {
        errEl.textContent = '导出失败：' + String(err?.message || err || '请稍后重试');
      } finally {
        busy = false;
        deskBtn.disabled = false;
      }
    };

    const saveBtn = make('button', 'ldg-btn primary', '💾 保存为编辑版');
    saveBtn.id = 'ldg-ce-save-btn';
    saveBtn.type = 'submit';
    foot.append(cancel, deskBtn, saveBtn);
    form.append(head, grid, foot);

    form.onsubmit = async e => {
      e.preventDefault();
      if (busy) return;
      errEl.textContent = '';
      if (!state.teacher) { errEl.textContent = '请填写老师姓名'; iT.focus?.(); return; }
      const validRows = state.rows.filter(r => String(r.label || '').trim() && num(r.hours) > 0);
      if (!validRows.length) { errEl.textContent = '请至少保留一行课时大于 0 的记录'; return; }
      const c = client();
      if (!c) { errEl.textContent = '尚未登录云端，请先登录后重试'; return; }
      busy = true;
      saveBtn.disabled = true;
      deskBtn.disabled = true;
      cancel.disabled = true;
      saveBtn.textContent = '正在保存…';
      try {
        redrawCanvas();
        const blob = await canvasToPngBlob(canvas);
        const buf = typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : new Uint8Array(0).buffer;
        const sha = await sha256Hex(buf);
        const teacherHash = (await sha256Hex(new TextEncoder().encode(state.teacher).buffer)).slice(0, 8);
        const storagePath = `${curMonth.year_month}/edited-${teacherHash}-${Date.now()}.png`;
        const upRes = await c.storage.from('wayon-billing').upload(storagePath, blob, {
          upsert: true,
          contentType: 'image/png',
        });
        if (upRes?.error) throw upRes.error;
        const fname = getEditedFilename();
        const nextFiles = Array.isArray(curMonth.files) ? curMonth.files.map(x => ({...x})) : [];
        const entry = {
          name: fname,
          path: storagePath,
          sha256: sha,
          kind: 'image',
          variant: 'edited',
          teacher: state.teacher,
          size: blob.size || buf.byteLength || 0,
          is_master: false,
        };
        const existingEditedIdx = nextFiles.findIndex(x => x.name === fname && (x.variant === 'edited' || /\/edited-/.test(String(x.path || ''))));
        if (existingEditedIdx >= 0) nextFiles[existingEditedIdx] = {...nextFiles[existingEditedIdx], ...entry};
        else nextFiles.push(entry);
        signedUrls.delete(storagePath);
        const updRes = await c.from('wayon_billing_months')
          .update({files: nextFiles, verified_at: new Date().toISOString()})
          .eq('year_month', curMonth.year_month);
        if (updRes?.error) throw updRes.error;
        curMonth.files = nextFiles;
        dlg.close();
        showActionInfo(`已保存核对卡编辑版「${fname}」（原版保持不变）`);
        render();
      } catch (err) {
        errEl.textContent = '保存失败：' + String(err?.message || err || '请稍后重试');
      } finally {
        busy = false;
        saveBtn.disabled = false;
        deskBtn.disabled = false;
        cancel.disabled = false;
        saveBtn.textContent = '💾 保存为编辑版';
      }
    };

    paintRows();
    redrawCanvas();
    dlg.append(form);
    dlg.showModal();
  }

  function openImageLightbox(fileObj) {
    const dlg = prepareModal('any');
    dlg.classList.add('ldg-lightbox');
    const body = make('div', 'ldg-dialog-body');
    const head = make('div', 'ldg-lightbox-head');
    const h = make('h3', '', fileObj.name || '老师核对卡预览');
    h.id = 'ldg-dialog-title';
    const closeBtn = make('button', 'ldg-btn sm', '关闭');
    closeBtn.type = 'button';
    closeBtn.setAttribute('autofocus', '');
    closeBtn.onclick = () => dlg.close('close');
    head.append(h, closeBtn);

    const stage = make('div', 'ldg-lightbox-stage');
    const status = make('span', 'ldg-sub', '正在加载高清原图…');
    const img = make('img');
    img.alt = fileObj.name || '老师核对卡';
    img.hidden = true;
    stage.append(status, img);

    const foot = make('div', 'ldg-dialog-foot');
    const dlBtn = make('button', 'ldg-btn primary', '⬇️ 存到桌面');
    dlBtn.type = 'button';
    dlBtn.onclick = () => void saveFileToDesktop(fileObj, dlBtn);
    const openBtn = make('button', 'ldg-btn', '新标签打开');
    openBtn.type = 'button';
    openBtn.onclick = async () => {
      if (openBtn.disabled) return;
      openBtn.disabled = true;
      try {
        const u = await getSignedUrl(fileObj.path);
        if (!u) throw new Error('获取签名图片链接失败');
        globalThis.open?.(u, '_blank', 'noopener,noreferrer');
      } catch (err) {
        showActionError('打开原图失败：' + String(err?.message || err || '请稍后重试'));
      } finally {
        openBtn.disabled = false;
      }
    };
    foot.append(openBtn, dlBtn);
    body.append(head, stage, foot);
    dlg.append(body);
    dlg.addEventListener('close', () => { dlg.returnValue = ''; }, {once: true});
    dlg.showModal();

    void getSignedUrl(fileObj.path).then(u => {
      if (!dlg.open) return;
      if (!u) {
        status.textContent = '无法获取图片链接，请稍后重试。';
        return;
      }
      img.src = u;
      img.hidden = false;
      status.hidden = true;
    }).catch(() => {
      if (dlg.open) status.textContent = '加载原图失败，请稍后重试。';
    });
  }

  function openBillingUploadDialog(curMonth) {
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', `补传/替换附件 · ${curMonth.title || curMonth.year_month}`);
    h.id = 'ldg-dialog-title';
    const desc = make('p', '', '上传的 Excel 课时表或老师核对卡图片会保存到你的私有 Supabase Storage（wayon-billing），同名文件将自动替换为最新版。');
    desc.style.margin = '0'; desc.style.fontSize = '13px'; desc.style.color = 'var(--fg-secondary)';

    const fFile = make('div', 'ldg-field');
    const lbl = make('label', '', '选择文件（支持多选，单个不超过 20 MB）');
    lbl.setAttribute('for', 'ldg-upload-input');
    const inp = make('input');
    inp.id = 'ldg-upload-input';
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = '.xlsx,.xls,.png,.jpg,.jpeg,.webp,.pdf';
    inp.setAttribute('autofocus', '');
    fFile.append(lbl, inp);

    const errEl = make('p', 'ldg-form-err', '');
    errEl.setAttribute('role', 'alert');
    const foot = make('div', 'ldg-dialog-foot');
    let uploading = false;
    const cancel = make('button', 'ldg-btn', '取消');
    cancel.type = 'button';
    cancel.onclick = () => { if (!uploading) dlg.close(); };
    const submit = make('button', 'ldg-btn primary', '上传并绑定本月');
    submit.type = 'submit';
    foot.append(cancel, submit);
    form.append(h, desc, fFile, errEl, foot);

    form.onsubmit = async e => {
      e.preventDefault();
      if (uploading) return;
      errEl.textContent = '';
      const picked = [...(inp.files || [])];
      if (!picked.length) { errEl.textContent = '请先选择至少一个文件'; inp.focus?.(); return; }
      const maxBytes = 20 * 1024 * 1024;
      for (const f of picked) {
        if (f.size <= 0 || f.size > maxBytes) {
          errEl.textContent = `文件「${f.name}」大小超出限制（需在 1 B 至 20 MB 之间）`;
          return;
        }
      }
      const c = client();
      if (!c) { errEl.textContent = '尚未登录云端，请先登录后重试'; return; }
      uploading = true;
      submit.disabled = true;
      cancel.disabled = true;
      submit.textContent = '正在上传…';
      try {
        const nextFiles = Array.isArray(curMonth.files) ? curMonth.files.map(x => ({...x})) : [];
        for (const f of picked) {
          const buf = typeof f.arrayBuffer === 'function' ? await f.arrayBuffer() : new Uint8Array(0).buffer;
          const sha = await sha256Hex(buf);
          const extMatch = String(f.name || '').match(/(\.[a-z0-9]{1,8})$/i);
          const ext = extMatch ? extMatch[1].toLowerCase() : '.bin';
          const storagePath = `${curMonth.year_month}/${sha.slice(0, 12)}${ext}`;
          const upRes = await c.storage.from('wayon-billing').upload(storagePath, f, {
            upsert: true,
            contentType: f.type || undefined,
          });
          if (upRes?.error) throw upRes.error;
          const isImg = /\.(png|jpe?g|webp)$/i.test(ext);
          const entry = {
            name: f.name,
            path: storagePath,
            sha256: sha,
            kind: isImg ? 'image' : 'file',
            size: f.size,
            is_master: false,
          };
          const idx = nextFiles.findIndex(x => x.name === f.name);
          if (idx >= 0) nextFiles[idx] = {...nextFiles[idx], ...entry};
          else nextFiles.push(entry);
          signedUrls.delete(storagePath);
        }
        const updRes = await c.from('wayon_billing_months')
          .update({files: nextFiles, verified_at: new Date().toISOString()})
          .eq('year_month', curMonth.year_month);
        if (updRes?.error) throw updRes.error;
        dlg.close();
        showActionInfo(`已上传 ${picked.length} 个文件到「${curMonth.title || curMonth.year_month}」`);
        await loadAcademic({force: true});
      } catch (err) {
        errEl.textContent = '上传失败：' + String(err?.message || err || '请稍后重试');
      } finally {
        uploading = false;
        submit.disabled = false;
        cancel.disabled = false;
        submit.textContent = '上传并绑定本月';
      }
    };
    dlg.append(form);
    dlg.showModal();
  }

  const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function deriveWeekday(dateStr) {
    const s = String(dateStr || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
    return WEEKDAY_NAMES[dt.getUTCDay()] || '';
  }

  function normalizeSheetRow(raw, rid) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const cntVal = Math.max(1, Math.round(num(r.count ?? 1)));
    const hrsVal = Math.max(0, Math.round(num(r.hours ?? 0) * 100) / 100);
    return {
      _rid: rid || ('r' + (sheetRidSeq++)),
      date: String(r.date ?? '').trim(),
      weekday: String(r.weekday ?? '').trim(),
      time: String(r.time ?? '').trim(),
      teacher: String(r.teacher ?? '').trim(),
      student: String(r.student ?? '').trim(),
      subject: String(r.subject ?? '').trim(),
      kind: String(r.kind ?? '').trim(),
      count: cntVal,
      hours: hrsVal,
      location: String(r.location ?? '').trim(),
      note: String(r.note ?? '').trim(),
    };
  }

  function cloneSheetRecords(records) {
    if (!Array.isArray(records)) return [];
    return records.map(r => normalizeSheetRow(r, r && r._rid ? r._rid : undefined));
  }

  function stripSheetRecords(records) {
    return (records || []).map(r => ({
      date: String(r.date ?? '').trim(),
      weekday: String(r.weekday ?? '').trim(),
      time: String(r.time ?? '').trim(),
      teacher: String(r.teacher ?? '').trim(),
      kind: String(r.kind ?? '').trim(),
      subject: String(r.subject ?? '').trim(),
      student: String(r.student ?? '').trim(),
      location: String(r.location ?? '').trim(),
      count: Math.max(1, Math.round(num(r.count ?? 1))),
      hours: Math.max(0, Math.round(num(r.hours ?? 0) * 100) / 100),
      note: String(r.note ?? '').trim(),
    }));
  }

  function recomputeBillingBreakdown(records) {
    const tMap = new Map();
    const sMap = new Map();
    let totalHours = 0;
    let validRows = 0;
    for (const r of (records || [])) {
      const teacher = String(r.teacher || '').trim();
      const hrs = Math.max(0, Math.round(num(r.hours) * 100) / 100);
      if (!teacher || hrs <= 0) continue;
      validRows += 1;
      totalHours = Math.round((totalHours + hrs) * 100) / 100;
      const cnt = Math.max(1, Math.round(num(r.count || 1)));
      let te = tMap.get(teacher);
      if (!te) { te = {teacher, total: 0, classes: 0, buckets: {}}; tMap.set(teacher, te); }
      te.total = Math.round((te.total + hrs) * 100) / 100;
      te.classes += 1;
      const bkey = SPLIT_TEACHERS.has(teacher) ? `1对${cnt}` : (cnt === 1 ? '1对1' : '1对多');
      te.buckets[bkey] = Math.round((num(te.buckets[bkey]) + hrs) * 100) / 100;

      const st = String(r.student || '').trim() || '未注明';
      let se = sMap.get(st);
      if (!se) { se = {student: st, hours: 0, classes: 0, teachers: new Set()}; sMap.set(st, se); }
      se.hours = Math.round((se.hours + hrs) * 100) / 100;
      se.classes += 1;
      se.teachers.add(teacher);
    }
    const teacher_breakdown = [...tMap.values()].sort((a, b) => (b.total - a.total) || SHEET_COLLATOR.compare(a.teacher, b.teacher));
    const student_breakdown = [...sMap.values()]
      .map(v => ({student: v.student, hours: v.hours, classes: v.classes, teachers: [...v.teachers].sort((a, b) => SHEET_COLLATOR.compare(a, b))}))
      .sort((a, b) => (b.hours - a.hours) || SHEET_COLLATOR.compare(a.student, b.student));
    return {
      rows: validRows,
      hours: totalHours,
      teachers: teacher_breakdown.map(t => t.teacher),
      teacher_breakdown,
      student_breakdown,
    };
  }

  function isSafeGoogleSheetUrl(url) {
    const s = String(url || '').trim();
    if (!s) return true;
    return /^https:\/\/docs\.google\.com\/spreadsheets\/[^\s]+$/i.test(s);
  }

  function exportSheetCsv(filename, records) {
    const esc = val => {
      const s = String(val ?? '');
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [SHEET_COLS.map(c => esc(c.label)).join(',')];
    for (const r of (records || [])) {
      lines.push(SHEET_COLS.map(c => esc(c.key === 'hours' ? fmtHours(r[c.key]) : (r[c.key] ?? ''))).join(','));
    }
    const csv = '\uFEFF' + lines.join('\r\n');
    const safeName = (filename || '课时明细表') + '.csv';
    if (typeof globalThis.Blob === 'function' && typeof globalThis.URL?.createObjectURL === 'function') {
      const blob = new globalThis.Blob([csv], {type: 'text/csv;charset=utf-8;'});
      const url = globalThis.URL.createObjectURL(blob);
      const a = make('a');
      a.href = url;
      a.download = safeName;
      a.click();
      setTimeout(() => { try { globalThis.URL.revokeObjectURL(url); } catch {} }, 10000);
      return csv;
    }
    return csv;
  }

  function openGoogleSheetLinkDialog(curMonth) {
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', `绑定 Google 表格 · ${curMonth.title || curMonth.year_month}`);
    h.id = 'ldg-dialog-title';
    const desc = make('p', '', '粘贴你私人 Google Drive 中该月 Google 表格的链接（以 https://docs.google.com/spreadsheets/ 开头），保存后本月顶部会显示绿色「📊 在 Google 表格中编辑」直达按钮；留空保存可解除绑定。');
    desc.style.margin = '0'; desc.style.fontSize = '13px'; desc.style.color = 'var(--fg-secondary)';

    const fUrl = make('div', 'ldg-field');
    const lbl = make('label', '', 'Google 表格链接');
    lbl.setAttribute('for', 'ldg-gsheet-url');
    const inp = make('input');
    inp.id = 'ldg-gsheet-url';
    inp.type = 'url';
    inp.maxLength = 500;
    inp.placeholder = 'https://docs.google.com/spreadsheets/d/.../edit';
    inp.value = String(curMonth.meta?.google_sheet_url || '');
    inp.setAttribute('autofocus', '');
    fUrl.append(lbl, inp);

    const errEl = make('p', 'ldg-form-err', '');
    errEl.setAttribute('role', 'alert');
    const foot = make('div', 'ldg-dialog-foot');
    let saving = false;
    const cancel = make('button', 'ldg-btn', '取消'); cancel.type = 'button';
    cancel.onclick = () => { if (!saving) dlg.close(); };
    const save = make('button', 'ldg-btn primary', '保存链接'); save.type = 'submit';
    foot.append(cancel, save);
    form.append(h, desc, fUrl, errEl, foot);

    form.onsubmit = async e => {
      e.preventDefault();
      if (saving) return;
      errEl.textContent = '';
      const raw = inp.value.trim();
      if (raw && !isSafeGoogleSheetUrl(raw)) {
        errEl.textContent = '链接必须以 https://docs.google.com/spreadsheets/ 开头';
        inp.focus?.();
        return;
      }
      const c = client();
      if (!c) { errEl.textContent = '尚未登录云端，请先登录后重试'; return; }
      saving = true;
      save.disabled = true;
      cancel.disabled = true;
      try {
        const nextMeta = {...(curMonth.meta || {})};
        if (raw) nextMeta.google_sheet_url = raw;
        else delete nextMeta.google_sheet_url;
        const res = await c.from('wayon_billing_months')
          .update({meta: nextMeta, verified_at: new Date().toISOString()})
          .eq('year_month', curMonth.year_month);
        if (res?.error) throw res.error;
        curMonth.meta = nextMeta;
        dlg.close();
        showActionInfo(raw ? '已绑定 Google 表格链接' : '已解除本月 Google 表格链接');
        render();
      } catch (err) {
        errEl.textContent = '保存失败：' + String(err?.message || err || '请稍后重试');
      } finally {
        saving = false;
        save.disabled = false;
        cancel.disabled = false;
      }
    };
    dlg.append(form);
    dlg.showModal();
  }

  function openUnsavedSheetDialog(onDiscard) {
    const dlg = prepareModal('any');
    const box = make('form', 'ldg-dialog-body');
    const h = make('h3', '', '有未保存的表格修改');
    h.id = 'ldg-dialog-title';
    const p = make('p', '', '当前在线课时表还有尚未保存到云端的修改，切换月份将放弃这些未保存更改。确认放弃吗？');
    p.style.margin = '0'; p.style.color = 'var(--fg-secondary)';
    const foot = make('div', 'ldg-dialog-foot');
    const keep = make('button', 'ldg-btn', '返回继续编辑'); keep.type = 'button'; keep.setAttribute('autofocus', '');
    keep.onclick = () => dlg.close();
    const discard = make('button', 'ldg-btn danger', '放弃修改并切换'); discard.type = 'submit';
    foot.append(keep, discard);
    box.append(h, p, foot);
    box.onsubmit = e => {
      e.preventDefault();
      dlg.close();
      onDiscard();
    };
    dlg.append(box);
    dlg.showModal();
  }

  function openLeaveDialog(existing) {
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', existing ? '编辑调休记录' : '新增调休记录'); h.id = 'ldg-dialog-title';
    const nextSeq = existing ? existing.seq : (store.leave.reduce((m, r) => Math.max(m, num(r.seq)), 0) + 1);
    const fItem = make('div', 'ldg-field'), iItem = make('input');
    fItem.append(make('label', '', '事项'), iItem);
    iItem.required = true; iItem.maxLength = 400; iItem.value = existing?.item || ''; iItem.placeholder = '例：2026-11-22 加班'; iItem.setAttribute('autofocus', '');
    const g1 = make('div', 'ldg-field-grid');
    const fDate = make('div', 'ldg-field'), iDate = make('input');
    fDate.append(make('label', '', '产生日期'), iDate); iDate.maxLength = 20; iDate.value = existing?.produced_date || ''; iDate.placeholder = 'YYYY-MM-DD';
    const fSeq = make('div', 'ldg-field'), iSeq = make('input'); iSeq.type = 'number'; iSeq.min = '1'; iSeq.step = '1'; iSeq.value = nextSeq != null ? String(nextSeq) : '';
    fSeq.append(make('label', '', '序号'), iSeq);
    g1.append(fDate, fSeq);
    const g2 = make('div', 'ldg-field-grid');
    const fProd = make('div', 'ldg-field'), iProd = make('input'); iProd.type = 'number'; iProd.min = '0'; iProd.step = '0.5'; iProd.value = String(existing ? existing.produced_days : 1);
    fProd.append(make('label', '', '产生天数'), iProd);
    const fUsed = make('div', 'ldg-field'), iUsed = make('input'); iUsed.type = 'number'; iUsed.min = '0'; iUsed.step = '0.5'; iUsed.value = String(existing ? existing.used_days : 0);
    fUsed.append(make('label', '', '已休天数'), iUsed);
    g2.append(fProd, fUsed);
    const fDest = make('div', 'ldg-field'), iDest = make('input'); iDest.maxLength = 400;
    fDest.append(make('label', '', '调休去向'), iDest); iDest.value = existing?.destination || '待安排';
    const fNote = make('div', 'ldg-field'), iNote = make('textarea'); iNote.rows = 2; iNote.maxLength = 2000;
    fNote.append(make('label', '', '备注'), iNote); iNote.value = existing?.note || '';
    const errEl = make('p', 'ldg-form-err', ''); errEl.setAttribute('role', 'alert');
    const foot = make('div', 'ldg-dialog-foot');
    let saving = false;
    const cancel = make('button', 'ldg-btn', '取消'); cancel.type = 'button'; cancel.onclick = () => { if (!saving) dlg.close(); };
    const save = make('button', 'ldg-btn primary', '保存'); save.type = 'submit';
    foot.append(cancel, save);
    form.append(h, fItem, g1, g2, fDest, fNote, errEl, foot);
    form.onsubmit = async e => {
      e.preventDefault();
      if (saving) return;
      errEl.textContent = '';
      const itemText = iItem.value.trim();
      if (!itemText) { errEl.textContent = '请填写事项'; iItem.focus?.(); return; }
      if (itemText.length > 400) { errEl.textContent = '事项长度不能超过 400 字'; iItem.focus?.(); return; }
      const dateText = iDate.value.trim();
      if (dateText && !isValidDateStr(dateText, false)) { errEl.textContent = '产生日期格式须为有效 YYYY-MM-DD'; iDate.focus?.(); return; }
      const seqCheck = parseOptionalPosInt(iSeq.value, '序号');
      if (!seqCheck.ok) { errEl.textContent = seqCheck.error; iSeq.focus?.(); return; }
      const prodCheck = parseRequiredNonNeg(iProd.value, '产生天数', 9999.99);
      if (!prodCheck.ok) { errEl.textContent = prodCheck.error; iProd.focus?.(); return; }
      const usedCheck = parseRequiredNonNeg(iUsed.value, '已休天数', 9999.99);
      if (!usedCheck.ok) { errEl.textContent = usedCheck.error; iUsed.focus?.(); return; }
      const c = client();
      if (!c) { errEl.textContent = '尚未登录云端，请先登录后重试'; return; }
      const pDays = prodCheck.value, uDays = usedCheck.value;
      const status = pDays - uDays <= 0 ? '已休完' : (uDays > 0 ? '部分已休' : '待调休');
      const payload = {
        seq: seqCheck.value,
        item: itemText,
        produced_date: dateText,
        produced_days: pDays,
        used_days: uDays,
        status,
        destination: iDest.value.trim().slice(0, 400),
        note: iNote.value.trim().slice(0, 2000),
      };
      saving = true;
      save.disabled = true;
      cancel.disabled = true;
      try {
        const res = existing
          ? await c.from('wayon_leave_ledger').update(payload).eq('id', existing.id)
          : await c.from('wayon_leave_ledger').insert(payload);
        if (res?.error) throw res.error;
        dlg.close();
        await loadPrivate({force: true});
      } catch (err) {
        errEl.textContent = '保存失败：' + String(err?.message || err || '请稍后重试');
      } finally {
        saving = false;
        save.disabled = false;
        cancel.disabled = false;
      }
    };
    dlg.append(form);
    dlg.showModal();
  }

  function openSalaryDialog(existing) {
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', existing ? '编辑工资记录' : '新增工资记录'); h.id = 'ldg-dialog-title';
    const g1 = make('div', 'ldg-field-grid');
    const fM = make('div', 'ldg-field'), iM = make('input'); iM.required = true; iM.maxLength = 80; iM.value = existing?.work_month || ''; iM.placeholder = '例：2026-10'; iM.setAttribute('autofocus', '');
    fM.append(make('label', '', '工作月份'), iM);
    const fP = make('div', 'ldg-field'), iP = make('input'); iP.maxLength = 40; iP.value = existing?.pay_date || ''; iP.placeholder = '例：2026/11/10';
    fP.append(make('label', '', '发薪日'), iP);
    g1.append(fM, fP);
    const g2 = make('div', 'ldg-field-grid');
    const fGross = make('div', 'ldg-field'), iGross = make('input'); iGross.type = 'number'; iGross.min = '0'; iGross.step = '0.01'; iGross.value = String(existing?.gross_salary ?? 0);
    fGross.append(make('label', '', '税前工资（系统内）'), iGross);
    const fTax = make('div', 'ldg-field'), iTax = make('input'); iTax.type = 'number'; iTax.min = '0'; iTax.step = '0.01'; iTax.value = String(existing?.tax ?? 0);
    fTax.append(make('label', '', '扣税'), iTax);
    g2.append(fGross, fTax);
    const g3 = make('div', 'ldg-field-grid');
    const defaultSpecialDeduction = existing?.special_deduction ?? store.salary[0]?.special_deduction ?? 0;
    const fSpec = make('div', 'ldg-field'), iSpec = make('input'); iSpec.type = 'number'; iSpec.min = '0'; iSpec.step = '0.01'; iSpec.value = String(defaultSpecialDeduction);
    fSpec.append(make('label', '', '专项扣除（社保公积金）'), iSpec);
    const fExt = make('div', 'ldg-field'), iExt = make('input'); iExt.type = 'number'; iExt.min = '0'; iExt.step = '0.01'; iExt.value = String(existing?.external_income ?? 0);
    fExt.append(make('label', '', '系统外收入'), iExt);
    g3.append(fSpec, fExt);
    const fNote = make('div', 'ldg-field'), iNote = make('input'); iNote.maxLength = 1000; iNote.value = existing?.note || '';
    fNote.append(make('label', '', '备注'), iNote);
    const errEl = make('p', 'ldg-form-err', ''); errEl.setAttribute('role', 'alert');
    const foot = make('div', 'ldg-dialog-foot');
    let saving = false;
    const cancel = make('button', 'ldg-btn', '取消'); cancel.type = 'button'; cancel.onclick = () => { if (!saving) dlg.close(); };
    const save = make('button', 'ldg-btn primary', '保存'); save.type = 'submit';
    foot.append(cancel, save);
    form.append(h, g1, g2, g3, fNote, errEl, foot);
    form.onsubmit = async e => {
      e.preventDefault();
      if (saving) return;
      errEl.textContent = '';
      const monthText = iM.value.trim();
      if (!monthText) { errEl.textContent = '请填写工作月份'; iM.focus?.(); return; }
      if (monthText.length > 80) { errEl.textContent = '工作月份长度不能超过 80 字'; iM.focus?.(); return; }
      if (!/^\d{4}-(?:0[1-9]|1[0-2])(?:$|[\s（(])/.test(monthText)) { errEl.textContent = '工作月份请以 YYYY-MM 开头（例：2026-10）'; iM.focus?.(); return; }
      const payDateText = iP.value.trim();
      if (payDateText && !isValidDateStr(payDateText, true)) { errEl.textContent = '发薪日格式须为有效 YYYY-MM-DD 或 YYYY/M/D'; iP.focus?.(); return; }
      const grossCheck = parseRequiredNonNeg(iGross.value, '税前工资');
      if (!grossCheck.ok) { errEl.textContent = grossCheck.error; iGross.focus?.(); return; }
      const taxCheck = parseRequiredNonNeg(iTax.value, '扣税');
      if (!taxCheck.ok) { errEl.textContent = taxCheck.error; iTax.focus?.(); return; }
      const specCheck = parseRequiredNonNeg(iSpec.value, '专项扣除');
      if (!specCheck.ok) { errEl.textContent = specCheck.error; iSpec.focus?.(); return; }
      const extCheck = parseRequiredNonNeg(iExt.value, '系统外收入');
      if (!extCheck.ok) { errEl.textContent = extCheck.error; iExt.focus?.(); return; }
      const c = client();
      if (!c) { errEl.textContent = '尚未登录云端，请先登录后重试'; return; }
      const payload = {
        work_month: monthText,
        pay_date: payDateText,
        gross_salary: grossCheck.value,
        tax: taxCheck.value,
        special_deduction: specCheck.value,
        external_income: extCheck.value,
        note: iNote.value.trim().slice(0, 1000),
      };
      saving = true;
      save.disabled = true;
      cancel.disabled = true;
      try {
        const res = existing
          ? await c.from('wayon_salary_records').update(payload).eq('id', existing.id)
          : await c.from('wayon_salary_records').insert(payload);
        if (res?.error) throw res.error;
        dlg.close();
        await loadPrivate({force: true});
      } catch (err) {
        errEl.textContent = '保存失败：' + String(err?.message || err || '请稍后重试');
      } finally {
        saving = false;
        save.disabled = false;
        cancel.disabled = false;
      }
    };
    dlg.append(form);
    dlg.showModal();
  }

  function openProfileDialog(existing) {
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', existing ? '编辑学员档案' : '新增学员档案'); h.id = 'ldg-dialog-title';
    const g1 = make('div', 'ldg-field-grid');
    const fName = make('div', 'ldg-field'), iName = make('input'); iName.required = true; iName.maxLength = 120; iName.value = existing?.name || ''; iName.setAttribute('autofocus', '');
    fName.append(make('label', '', '姓名'), iName);
    const fStatus = make('div', 'ldg-field'), iStatus = make('select');
    ['在读', '暂停', '结课'].forEach(s => { const o = make('option', '', s); o.value = s; if ((existing?.status || '在读') === s) o.selected = true; iStatus.append(o); });
    fStatus.append(make('label', '', '状态'), iStatus);
    g1.append(fName, fStatus);
    const g2 = make('div', 'ldg-field-grid');
    const fCourse = make('div', 'ldg-field'), iCourse = make('input'); iCourse.maxLength = 200; iCourse.value = existing?.course || '';
    fCourse.append(make('label', '', '课程'), iCourse);
    const fForm = make('div', 'ldg-field'), iForm = make('input'); iForm.maxLength = 80; iForm.value = existing?.form || '到校';
    fForm.append(make('label', '', '形式'), iForm);
    g2.append(fCourse, fForm);
    const fMemo = make('div', 'ldg-field'), iMemo = make('input'); iMemo.maxLength = 200; iMemo.value = existing?.memo_name || '';
    fMemo.append(make('label', '', '班级/备忘录名'), iMemo);
    const fNote = make('div', 'ldg-field'), iNote = make('textarea'); iNote.rows = 3; iNote.maxLength = 2000; iNote.value = existing?.note || '';
    fNote.append(make('label', '', '备注'), iNote);
    const errEl = make('p', 'ldg-form-err', ''); errEl.setAttribute('role', 'alert');
    const foot = make('div', 'ldg-dialog-foot');
    let saving = false;
    const cancel = make('button', 'ldg-btn', '取消'); cancel.type = 'button'; cancel.onclick = () => { if (!saving) dlg.close(); };
    const save = make('button', 'ldg-btn primary', '保存'); save.type = 'submit';
    foot.append(cancel, save);
    form.append(h, g1, g2, fMemo, fNote, errEl, foot);
    form.onsubmit = async e => {
      e.preventDefault();
      if (saving) return;
      errEl.textContent = '';
      const nameText = iName.value.trim();
      if (!nameText) { errEl.textContent = '请填写学员姓名'; iName.focus?.(); return; }
      if (nameText.length > 120) { errEl.textContent = '学员姓名长度不能超过 120 字'; iName.focus?.(); return; }
      const c = client();
      if (!c) { errEl.textContent = '尚未登录云端，请先登录后重试'; return; }
      const payload = {
        name: nameText,
        status: iStatus.value,
        course: iCourse.value.trim().slice(0, 200),
        form: iForm.value.trim().slice(0, 80),
        memo_name: iMemo.value.trim().slice(0, 200),
        note: iNote.value.trim().slice(0, 2000),
      };
      saving = true;
      save.disabled = true;
      cancel.disabled = true;
      try {
        const res = existing
          ? await c.from('wayon_student_profiles').update(payload).eq('id', existing.id)
          : await c.from('wayon_student_profiles').insert(payload);
        if (res?.error) throw res.error;
        dlg.close();
        await loadAcademic({force: true});
      } catch (err) {
        errEl.textContent = '保存失败：' + String(err?.message || err || '请稍后重试');
      } finally {
        saving = false;
        save.disabled = false;
        cancel.disabled = false;
      }
    };
    dlg.append(form);
    dlg.showModal();
  }

  function openLongTermAddMonthDialog(onAdd) {
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', '新增长期台账月份列'); h.id = 'ldg-dialog-title';
    const fM = make('div', 'ldg-field'), iM = make('input');
    iM.id = 'ldg-lt-new-month'; iM.placeholder = 'YYYY-MM（例：2026-11）'; iM.maxLength = 7; iM.setAttribute('autofocus', '');
    fM.append(make('label', '', '月份（YYYY-MM）'), iM);
    const errEl = make('p', 'ldg-form-err', ''); errEl.setAttribute('role', 'alert');
    const foot = make('div', 'ldg-dialog-foot');
    const cancel = make('button', 'ldg-btn', '取消'); cancel.type = 'button'; cancel.onclick = () => dlg.close();
    const ok = make('button', 'ldg-btn primary', '添加月份列'); ok.type = 'submit';
    foot.append(cancel, ok);
    form.append(h, fM, errEl, foot);
    form.onsubmit = e => {
      e.preventDefault();
      const ym = iM.value.trim();
      if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(ym)) { errEl.textContent = '请输入有效月份（格式 YYYY-MM）'; iM.focus?.(); return; }
      const err = onAdd(ym);
      if (err) { errEl.textContent = err; iM.focus?.(); return; }
      dlg.close();
    };
    dlg.append(form);
    dlg.showModal();
  }

  function openLongTermAddStudentDialog(onAdd) {
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', '新增长期重点学员'); h.id = 'ldg-dialog-title';
    const g1 = make('div', 'ldg-field-grid');
    const fN = make('div', 'ldg-field'), iN = make('input');
    iN.id = 'ldg-lt-new-name'; iN.placeholder = '学员姓名'; iN.maxLength = 80; iN.setAttribute('autofocus', '');
    fN.append(make('label', '', '学员'), iN);
    const fP = make('div', 'ldg-field'), iP = make('input');
    iP.id = 'ldg-lt-new-plan'; iP.placeholder = '例：A计划 / C计划'; iP.maxLength = 60;
    fP.append(make('label', '', '方案'), iP);
    g1.append(fN, fP);
    const g2 = make('div', 'ldg-field-grid');
    const fT = make('div', 'ldg-field'), iT = make('input');
    iT.id = 'ldg-lt-new-total'; iT.type = 'number'; iT.min = '0'; iT.step = '0.5'; iT.value = '100';
    fT.append(make('label', '', '总购课时'), iT);
    const fG = make('div', 'ldg-field'), iG = make('input');
    iG.id = 'ldg-lt-new-group'; iG.placeholder = '选填（如 2期）'; iG.maxLength = 60;
    fG.append(make('label', '', '班课标识'), iG);
    g2.append(fT, fG);
    const fNote = make('div', 'ldg-field'), iNote = make('input');
    iNote.id = 'ldg-lt-new-note'; iNote.maxLength = 400;
    fNote.append(make('label', '', '备注'), iNote);
    const errEl = make('p', 'ldg-form-err', ''); errEl.setAttribute('role', 'alert');
    const foot = make('div', 'ldg-dialog-foot');
    const cancel = make('button', 'ldg-btn', '取消'); cancel.type = 'button'; cancel.onclick = () => dlg.close();
    const ok = make('button', 'ldg-btn primary', '添加学员'); ok.type = 'submit';
    foot.append(cancel, ok);
    form.append(h, g1, g2, fNote, errEl, foot);
    form.onsubmit = e => {
      e.preventDefault();
      const name = iN.value.trim();
      if (!name) { errEl.textContent = '请填写学员姓名'; iN.focus?.(); return; }
      const tCheck = parseRequiredNonNeg(iT.value, '总购课时', 9999.99);
      if (!tCheck.ok) { errEl.textContent = tCheck.error; iT.focus?.(); return; }
      const err = onAdd(name, {
        plan: iP.value.trim(),
        total: tCheck.value,
        ...(iG.value.trim() ? {group_class: iG.value.trim()} : {}),
        note: iNote.value.trim(),
        months: {},
      });
      if (err) { errEl.textContent = err; iN.focus?.(); return; }
      dlg.close();
    };
    dlg.append(form);
    dlg.showModal();
  }

  function renderLongTermView(wrap) {
    const ltDoc = store.docs.find(d => d.slug === 'long-term-student-ledger');
    if (!ltDoc) {
      wrap.append(make('div', 'ldg-empty', '暂未同步长期学员台账数据，月末自动归档或刷新后会显示在此处。'));
      return;
    }
    let data = null;
    try { data = JSON.parse(ltDoc.body_md || '{}'); } catch { data = null; }
    const studentsMap = (data && data.students && typeof data.students === 'object') ? data.students : null;
    if (!studentsMap || !Object.keys(studentsMap).length) {
      const fallback = make('div', 'ldg-card');
      fallback.append(make('h3', '', ltDoc.title || '长期重点学员课时台账'), renderMarkdownNode(ltDoc.body_md, ltDoc.title));
      wrap.append(fallback);
      return;
    }

    if (!ltDraft || ltDraft.docId !== (ltDoc.id || ltDoc.slug)) {
      const clonedStudents = {};
      const mSet = new Set();
      Object.entries(studentsMap).forEach(([name, info]) => {
        const months = {};
        if (info && info.months && typeof info.months === 'object') {
          Object.entries(info.months).forEach(([ym, v]) => {
            mSet.add(ym);
            months[ym] = Math.round(num(v) * 100) / 100;
          });
        }
        clonedStudents[name] = {
          ...(info || {}),
          plan: String(info?.plan || ''),
          total: Math.round(num(info?.total) * 100) / 100,
          note: String(info?.note || ''),
          months,
        };
      });
      ltDraft = {
        docId: ltDoc.id || ltDoc.slug,
        students: clonedStudents,
        months: [...mSet].sort(),
        notes: Array.isArray(data.notes) ? data.notes.map(String) : [],
        extraMeta: Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'students' && k !== 'notes')),
        dirty: false,
        saving: false,
        sortCol: -1,
        sortDir: '',
      };
    }

    const attList = Array.isArray(ltDoc.attachments) ? ltDoc.attachments : [];
    const topBar = make('div', 'ldg-toolbar');
    const tipWrap = make('span', 'ldg-title-row');
    tipWrap.append(
      make('span', 'ldg-sub', `${Object.keys(ltDraft.students).length} 组长期重点学员`),
      makeInfoTip('余额 ≤ 10h 自动标红预警；点击下方表格单元格可直接原位修改并保存到云端')
    );
    topBar.append(tipWrap);
    attList.forEach(att => {
      const sz = fmtBytes(att.size);
      const dlBtn = make('button', 'ldg-btn', `⬇️ 原版归档 ${att.name}${sz ? ` (${sz})` : ''}`);
      dlBtn.type = 'button';
      dlBtn.onclick = () => void downloadSignedFile(att, dlBtn);
      topBar.append(dlBtn);
    });
    wrap.append(topBar);

    const cardsSlot = make('div', 'ldg-rows-slot');
    cardsSlot.id = 'ldg-lt-cards-slot';
    const matrixSlot = make('div', 'ldg-rows-slot');
    matrixSlot.id = 'ldg-lt-matrix-slot';
    wrap.append(cardsSlot, matrixSlot);

    const computeEntries = () => Object.entries(ltDraft.students).map(([name, info]) => {
      const months = info.months || {};
      const used = Math.round(Object.values(months).reduce((s, v) => s + num(v), 0) * 100) / 100;
      const total = Math.round(num(info.total) * 100) / 100;
      const remaining = Math.round((total - used) * 100) / 100;
      return {name, info, months, used, total, remaining};
    });

    function renderLtCards() {
      cardsSlot.textContent = '';
      const grid = make('div', 'ldg-lt-grid');
      computeEntries().forEach(({name, info, used, total, remaining}) => {
        const level = remaining <= 10 ? 'danger' : (remaining <= 20 ? 'warn' : 'ok');
        const card = make('div', 'ldg-lt-card' + (level === 'danger' ? ' danger' : ''));
        const head = make('div', 'ldg-lt-head');
        const title = make('div', 'ldg-lt-title');
        title.append(make('span', '', name));
        if (info.plan) title.append(make('span', 'ldg-badge muted', info.plan));
        if (info.group_class) title.append(make('span', 'ldg-badge muted', `班课 ${info.group_class}`));
        const badgeText = level === 'danger' ? `⚠️ 仅剩 ${fmtHours(remaining)}h` : (level === 'warn' ? `余额偏低 · ${fmtHours(remaining)}h` : '余额充足');
        head.append(title, make('span', 'ldg-badge ' + level, badgeText));

        const nums = make('div', 'ldg-lt-nums');
        const addNum = (label, val, cls = '') => {
          const box = make('div', 'ldg-lt-num');
          box.append(make('small', '', label), make('strong', cls, val));
          nums.append(box);
        };
        addNum('总购课时', `${fmtHours(total)}h`);
        addNum('累计消耗', `${fmtHours(used)}h`);
        addNum('当前剩余', `${fmtHours(remaining)}h`, level);

        const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((used / total) * 100))) : 0;
        const prog = make('progress', 'ldg-progress ' + level);
        prog.max = total > 0 ? total : 100;
        prog.value = Math.min(prog.max, Math.max(0, used));
        prog.setAttribute('aria-label', `${name} 课时消耗进度 ${pct}%，已消耗 ${fmtHours(used)} 课时，共 ${fmtHours(total)} 课时`);

        const pctNote = make('div', 'ldg-subtotal');
        pctNote.append(make('span', '', `已消耗 ${pct}%`), make('span', '', `${fmtHours(used)} / ${fmtHours(total)}h`));
        card.append(head, nums, prog, pctNote);
        if (info.note) card.append(make('p', 'ldg-lt-note', info.note));
        grid.append(card);
      });
      cardsSlot.append(grid);
    }

    let saveLtBtn = null;
    let discardLtBtn = null;
    function syncLtButtons() {
      if (saveLtBtn) {
        saveLtBtn.disabled = !ltDraft.dirty || ltDraft.saving;
        saveLtBtn.textContent = ltDraft.saving ? '正在保存…' : (ltDraft.dirty ? '💾 保存修改到云端' : '✓ 已同步云端');
      }
      if (discardLtBtn) discardLtBtn.hidden = !ltDraft.dirty;
    }

    async function saveLongTermDraft() {
      if (!ltDraft.dirty || ltDraft.saving) return;
      const c = client();
      if (!c) { showActionError('尚未登录云端，请先登录后重试'); return; }
      clearActionError();
      clearActionInfo();
      ltDraft.saving = true;
      syncLtButtons();
      try {
        const payloadObj = {
          ...ltDraft.extraMeta,
          students: ltDraft.students,
          ...(ltDraft.notes.length ? {notes: ltDraft.notes} : {}),
        };
        const nextBody = JSON.stringify(payloadObj);
        const upd = ltDoc.id
          ? await c.from('wayon_reference_docs').update({body_md: nextBody, updated_at: new Date().toISOString()}).eq('id', ltDoc.id)
          : await c.from('wayon_reference_docs').update({body_md: nextBody, updated_at: new Date().toISOString()}).eq('slug', 'long-term-student-ledger');
        if (upd?.error) throw upd.error;
        ltDoc.body_md = nextBody;
        ltDraft.dirty = false;
        showActionInfo('长期学员台账修改已保存到云端');
        announcePolite('长期学员台账已保存');
      } catch (err) {
        showActionError('保存长期台账失败：' + String(err?.message || err || '请稍后重试'));
      } finally {
        ltDraft.saving = false;
        syncLtButtons();
      }
    }

    function renderLtMatrix() {
      matrixSlot.textContent = '';
      const mCard = make('div', 'ldg-card');
      const head = make('div', 'ldg-head');
      const hLeft = make('div', 'ldg-title-row');
      hLeft.append(
        make('h3', '', '📊 长期学员按月消耗明细'),
        makeInfoTip('点击方案、总课时、各月课时或备注单元格直接原位编辑，实时重算上方进度卡与预警')
      );
      const hActs = make('div', 'ldg-head-actions');
      const addMonthBtn = make('button', 'ldg-btn sm', '＋ 新增月份列');
      addMonthBtn.id = 'ldg-lt-add-month'; addMonthBtn.type = 'button';
      addMonthBtn.onclick = () => openLongTermAddMonthDialog(ym => {
        if (ltDraft.months.includes(ym)) return `月份 ${ym} 已存在`;
        ltDraft.months.push(ym);
        ltDraft.months.sort();
        ltDraft.dirty = true;
        renderLtMatrix();
        return '';
      });
      const addStuBtn = make('button', 'ldg-btn sm', '＋ 新增学员');
      addStuBtn.id = 'ldg-lt-add-student'; addStuBtn.type = 'button';
      addStuBtn.onclick = () => openLongTermAddStudentDialog((name, info) => {
        if (Object.prototype.hasOwnProperty.call(ltDraft.students, name)) return `学员「${name}」已存在`;
        ltDraft.students[name] = info;
        ltDraft.dirty = true;
        renderLtCards();
        renderLtMatrix();
        return '';
      });
      discardLtBtn = make('button', 'ldg-btn sm', '↩ 放弃修改');
      discardLtBtn.type = 'button';
      discardLtBtn.hidden = !ltDraft.dirty;
      discardLtBtn.onclick = () => { ltDraft = null; render(); };
      saveLtBtn = make('button', 'ldg-btn sm primary', ltDraft.dirty ? '💾 保存修改到云端' : '✓ 已同步云端');
      saveLtBtn.id = 'ldg-lt-save'; saveLtBtn.type = 'button';
      saveLtBtn.disabled = !ltDraft.dirty || ltDraft.saving;
      saveLtBtn.onclick = () => void saveLongTermDraft();
      hActs.append(addMonthBtn, addStuBtn, discardLtBtn, saveLtBtn);
      head.append(hLeft, hActs);
      mCard.append(head);

      const sortedMonths = ltDraft.months;
      const cols = [
        {key: 'name', label: '学员', type: 'text', editable: false},
        {key: 'plan', label: '方案', type: 'text', editable: true},
        {key: 'total', label: '总课时', type: 'number', editable: true},
        ...sortedMonths.map(ym => ({key: 'month:' + ym, ym, label: ym.slice(2), type: 'number', editable: true})),
        {key: 'used', label: '累计消耗', type: 'number', editable: false},
        {key: 'remaining', label: '剩余', type: 'number', editable: false},
        {key: 'note', label: '备注', type: 'text', editable: true},
      ];

      const tblWrap = make('div', 'ldg-table-wrap');
      tblWrap.tabIndex = 0;
      tblWrap.setAttribute('role', 'region');
      tblWrap.setAttribute('aria-label', '长期学员按月消耗明细');
      const tbl = make('table', 'ldg-table');
      tbl.id = 'ldg-lt-sheet';
      const thead = make('thead'), htr = make('tr');
      const tbody = make('tbody');

      const sortLtInPlace = cIdx => {
        const ths = thead.querySelectorAll('th[data-col-idx]');
        const targetTh = [...ths].find(th => Number(th.dataset.colIdx) === cIdx);
        if (!targetTh) return;
        const nextDir = targetTh.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
        ths.forEach(th => th.removeAttribute('aria-sort'));
        targetTh.setAttribute('aria-sort', nextDir);
        ltDraft.sortCol = cIdx;
        ltDraft.sortDir = nextDir;
        const col = cols[cIdx];
        const factor = nextDir === 'ascending' ? 1 : -1;
        const trs = [...tbody.children].filter(el => el.tagName === 'TR');
        const keyed = trs.map(tr => {
          const cell = tr.children[cIdx];
          const raw = cell?.dataset?.value ?? cell?.textContent ?? '';
          return {tr, val: col.type === 'number' ? num(raw) : String(raw)};
        });
        keyed.sort((a, b) => factor * (col.type === 'number' ? (a.val - b.val) : SHEET_COLLATOR.compare(a.val, b.val)));
        for (const item of keyed) {
          if (typeof tbody.moveBefore === 'function') tbody.moveBefore(item.tr, null);
          else tbody.append(item.tr);
        }
        announcePolite(`已按${col.label}${nextDir === 'ascending' ? '升序' : '降序'}排列`);
      };

      if (typeof ltDraft.sortCol === 'number' && ltDraft.sortCol >= cols.length) {
        ltDraft.sortCol = -1;
        ltDraft.sortDir = '';
      }
      cols.forEach((col, cIdx) => {
        const th = make('th', col.type === 'number' ? 'num' : '');
        th.scope = 'col';
        th.dataset.colIdx = String(cIdx);
        if (ltDraft.sortCol === cIdx && ltDraft.sortDir) th.setAttribute('aria-sort', ltDraft.sortDir);
        const sBtn = make('button', 'ldg-sort-btn');
        sBtn.type = 'button';
        const icon = make('span', 'ldg-sort-icon'); icon.setAttribute('aria-hidden', 'true');
        sBtn.append(make('span', '', col.label), icon);
        sBtn.onclick = () => sortLtInPlace(cIdx);
        th.append(sBtn);
        htr.append(th);
      });
      thead.append(htr);

      const ltEntries = computeEntries();
      if (typeof ltDraft.sortCol === 'number' && ltDraft.sortCol >= 0 && ltDraft.sortCol < cols.length && ltDraft.sortDir) {
        const sCol = cols[ltDraft.sortCol];
        const factor = ltDraft.sortDir === 'ascending' ? 1 : -1;
        const getEntryVal = e => {
          if (sCol.key === 'name') return e.name || '';
          if (sCol.key === 'plan') return e.info.plan || '';
          if (sCol.key === 'total') return num(e.total);
          if (sCol.key === 'used') return num(e.used);
          if (sCol.key === 'remaining') return num(e.remaining);
          if (sCol.key === 'note') return e.info.note || '';
          if (sCol.ym) return num(e.months[sCol.ym]);
          return '';
        };
        ltEntries.sort((a, b) => {
          const va = getEntryVal(a), vb = getEntryVal(b);
          return factor * (sCol.type === 'number' ? (num(va) - num(vb)) : SHEET_COLLATOR.compare(String(va), String(vb)));
        });
      }
      ltEntries.forEach(({name, info, months, used, total, remaining}) => {
        const tr = make('tr');
        tr.dataset.student = name;
        const thName = make('th', '', name);
        thName.scope = 'row';
        thName.dataset.value = name;
        tr.append(thName);

        const tdUsed = make('td', 'num', fmtHours(used));
        tdUsed.dataset.label = '累计消耗';
        tdUsed.dataset.value = String(used);
        const tdRem = make('td', 'num', fmtHours(remaining));
        tdRem.dataset.label = '剩余';
        tdRem.dataset.value = String(remaining);

        const refreshRowTotals = () => {
          const nextUsed = Math.round(Object.values(info.months || {}).reduce((s, v) => s + num(v), 0) * 100) / 100;
          const nextRem = Math.round((num(info.total) - nextUsed) * 100) / 100;
          tdUsed.textContent = fmtHours(nextUsed);
          tdUsed.dataset.value = String(nextUsed);
          tdRem.textContent = fmtHours(nextRem);
          tdRem.dataset.value = String(nextRem);
          ltDraft.dirty = true;
          syncLtButtons();
          renderLtCards();
        };

        const tdPlan = makeInlineEditableCell({
          label: '方案',
          displayText: info.plan || '-',
          editValue: info.plan || '',
          onCommit: async nextVal => {
            info.plan = nextVal.slice(0, 60);
            tdPlan.dataset.value = info.plan;
            ltDraft.dirty = true;
            syncLtButtons();
            renderLtCards();
            return {editValue: info.plan, displayText: info.plan || '-'};
          },
        });
        tdPlan.dataset.value = info.plan || '';

        const tdTotal = makeInlineEditableCell({
          cls: 'num',
          label: '总课时',
          type: 'number',
          displayText: fmtHours(total),
          editValue: String(total),
          onCommit: async nextVal => {
            const chk = parseRequiredNonNeg(nextVal, '总课时', 9999.99);
            if (!chk.ok) return {error: chk.error};
            info.total = Math.round(chk.value * 100) / 100;
            tdTotal.dataset.value = String(info.total);
            refreshRowTotals();
            return {editValue: String(info.total), displayText: fmtHours(info.total)};
          },
        });
        tdTotal.dataset.value = String(total);

        tr.append(tdPlan, tdTotal);

        sortedMonths.forEach(ym => {
          const curVal = months[ym];
          const tdM = makeInlineEditableCell({
            cls: 'num',
            label: ym.slice(2),
            type: 'number',
            displayText: curVal !== undefined ? fmtHours(curVal) : '-',
            editValue: curVal !== undefined ? String(curVal) : '',
            onCommit: async nextVal => {
              if (!nextVal) {
                delete info.months[ym];
                tdM.dataset.value = '0';
                refreshRowTotals();
                return {editValue: '', displayText: '-'};
              }
              const chk = parseRequiredNonNeg(nextVal, ym + ' 课时', 9999.99);
              if (!chk.ok) return {error: chk.error};
              const v = Math.round(chk.value * 100) / 100;
              info.months[ym] = v;
              tdM.dataset.value = String(v);
              refreshRowTotals();
              return {editValue: String(v), displayText: fmtHours(v)};
            },
          });
          tdM.dataset.ym = ym;
          tdM.dataset.value = String(curVal !== undefined ? curVal : 0);
          tr.append(tdM);
        });

        const tdNote = makeInlineEditableCell({
          label: '备注',
          displayText: info.note || '-',
          editValue: info.note || '',
          onCommit: async nextVal => {
            info.note = nextVal.slice(0, 400);
            tdNote.dataset.value = info.note;
            ltDraft.dirty = true;
            syncLtButtons();
            renderLtCards();
            return {editValue: info.note, displayText: info.note || '-'};
          },
        });
        tdNote.dataset.value = info.note || '';

        tr.append(tdUsed, tdRem, tdNote);
        tbody.append(tr);
      });

      tbl.append(thead, tbody);
      tblWrap.append(tbl);
      mCard.append(tblWrap);
      if (ltDraft.notes.length) {
        const ul = make('ul', 'ldg-lt-note');
        ul.style.paddingLeft = '18px';
        ltDraft.notes.forEach(n => ul.append(make('li', '', String(n))));
        mCard.append(ul);
      }
      matrixSlot.append(mCard);
    }

    renderLtCards();
    renderLtMatrix();
  }

  function renderMonthlyBillingView(wrap) {
    if (!store.billing.length) {
      wrap.append(make('div', 'ldg-empty', '暂无已归档的月度课时记录。月末例行运行后会自动写入此处。'));
      return;
    }
    const cur = store.billing.find(m => m.year_month === selectedMonth) || store.billing[0];
    if (!cur) return;
    selectedMonth = cur.year_month;

    if (!sheetDraft || sheetDraft.yearMonth !== cur.year_month) {
      sheetDraft = {
        yearMonth: cur.year_month,
        records: cloneSheetRecords(cur.meta?.records),
        dirty: false,
        saving: false,
        undoStack: [],
        redoStack: [],
        activeRid: null,
        activeCol: 0,
        editing: false,
      };
    }

    const doSwitchMonth = ym => {
      selectedMonth = ym;
      billingTeacherFilter = '';
      billingSearchQuery = '';
      sheetDraft = null;
      render();
    };
    const selectMonth = ym => {
      if (ym === selectedMonth) return;
      if (sheetDraft && sheetDraft.dirty) {
        if (mSelect) mSelect.value = selectedMonth;
        openUnsavedSheetDialog(() => doSwitchMonth(ym));
        return;
      }
      doSwitchMonth(ym);
    };

    const bar = make('div', 'ldg-toolbar');
    const mSelect = make('select', 'ldg-month-select');
    mSelect.id = 'ldg-month-select';
    mSelect.setAttribute('aria-label', '选择归档月份');
    store.billing.forEach(m => {
      const opt = make('option');
      opt.value = m.year_month;
      const hrs = m.meta?.hours !== undefined ? ` · ${fmtHours(m.meta.hours)}h` : '';
      const imgCnt = Array.isArray(m.files) ? m.files.filter(f => f.kind === 'image').length : 0;
      const cardTag = imgCnt ? ` · ${imgCnt}卡` : '';
      opt.textContent = `${m.title || m.year_month}${hrs}${cardTag}`;
      if (m.year_month === selectedMonth) opt.selected = true;
      mSelect.append(opt);
    });
    mSelect.addEventListener('change', () => selectMonth(mSelect.value));

    const pills = make('div', 'ldg-pills');
    store.billing.slice(0, 6).forEach(m => {
      const label = (m.title || m.year_month).replace(/\s*课时汇总$/, '');
      const b = make('button', 'ldg-pill' + (m.year_month === selectedMonth ? ' on' : ''), label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(m.year_month === selectedMonth));
      b.onclick = () => selectMonth(m.year_month);
      pills.append(b);
    });

    const uploadBtn = make('button', 'ldg-btn', '📤 补传/替换文件');
    uploadBtn.id = 'ldg-billing-upload-btn';
    uploadBtn.type = 'button';
    uploadBtn.onclick = () => openBillingUploadDialog(cur);

    bar.append(mSelect, pills, uploadBtn);
    const gsheetUrl = String(cur.meta?.google_sheet_url || '').trim();
    if (gsheetUrl && isSafeGoogleSheetUrl(gsheetUrl)) {
      const gOpen = make('a', 'ldg-btn gsheet', '📊 在 Google 表格中编辑');
      gOpen.id = 'ldg-gsheet-open-link';
      gOpen.href = gsheetUrl;
      gOpen.target = '_blank';
      gOpen.rel = 'noopener noreferrer';
      bar.append(gOpen);
    }
    const gBind = make('button', 'ldg-btn', gsheetUrl ? '🔗 改绑 Google 表格' : '🔗 关联 Google 表格');
    gBind.id = 'ldg-gsheet-bind-btn';
    gBind.type = 'button';
    gBind.onclick = () => openGoogleSheetLinkDialog(cur);
    bar.append(gBind);
    wrap.append(bar);

    const files = Array.isArray(cur.files) ? cur.files : [];
    const docs = files.filter(f => f.kind !== 'image');
    const imgs = files.filter(f => f.kind === 'image');

    const statsSlot = make('div', 'ldg-rows-slot');
    statsSlot.id = 'ldg-billing-stats-slot';
    const barsSlot = make('div', 'ldg-rows-slot');
    barsSlot.id = 'ldg-billing-bars-slot';
    const cardsSlot = make('div', 'ldg-rows-slot');
    cardsSlot.id = 'ldg-billing-cards-slot';
    const recordsSlot = make('div', 'ldg-rows-slot');
    recordsSlot.id = 'ldg-billing-records-slot';

    const barBtnMap = new Map();
    let teacherSelectEl = null;
    let clearFilterBtn = null;
    let recTitleEl = null;
    let undoBtn = null;
    let redoBtn = null;
    let saveSheetBtn = null;
    let fxRefEl = null;
    let fxInputEl = null;
    let fxStateEl = null;
    let sheetTableEl = null;
    let sheetTbodyEl = null;
    let sheetFootCountEl = null;
    let sheetFootHoursEl = null;
    let sortState = {colIdx: -1, dir: ''};

    const currentComputed = () => {
      if (sheetDraft.records.length || sheetDraft.dirty) {
        return recomputeBillingBreakdown(sheetDraft.records);
      }
      const m = cur.meta || {};
      return {
        rows: m.rows ?? 0,
        hours: m.hours ?? 0,
        teachers: Array.isArray(m.teachers) ? m.teachers : [],
        teacher_breakdown: Array.isArray(m.teacher_breakdown) ? m.teacher_breakdown : [],
        student_breakdown: Array.isArray(m.student_breakdown) ? m.student_breakdown : [],
      };
    };

    function renderStatsSlot() {
      statsSlot.textContent = '';
      const comp = currentComputed();
      if (!comp.hours && !sheetDraft.records.length && !docs.length && !imgs.length) return;
      const stats = make('div', 'ldg-stats');
      const addStat = (l, v, cls = '') => {
        const s = make('div', 'ldg-stat');
        s.append(make('span', 'ldg-stat-label', l), make('span', 'ldg-stat-val ' + cls, v));
        stats.append(s);
      };
      // Academic space ALWAYS shows academic-only metrics (never Leo commission/salary).
      const curImgs = (Array.isArray(cur.files) ? cur.files : []).filter(f => f.kind === 'image');
      addStat('全月排课 / 课时', `${comp.rows} 节 · ${fmtHours(comp.hours)}h`);
      addStat('任课老师数', `${comp.teacher_breakdown.length || '-'} 位`, 'accent');
      addStat('活跃学员数', `${comp.student_breakdown.length || '-'} 位`, 'ok');
      addStat('云端附件', `${docs.length} 表 · ${curImgs.length} 核对卡`);
      statsSlot.append(stats);
    }

    function renderBarsSlot() {
      barsSlot.textContent = '';
      barBtnMap.clear();
      const comp = currentComputed();
      const tBreakdown = comp.teacher_breakdown;
      if (!tBreakdown.length) return;
      const card = make('div', 'ldg-card');
      const head = make('div', 'ldg-head');
      const hTitleWrap = make('div', 'ldg-title-row');
      hTitleWrap.append(
        make('h3', '', '📊 老师课时分布'),
        makeInfoTip('点击老师筛选下方核对卡与明细；点击右侧按钮可按最新在线表重绘该老师核对卡')
      );
      head.append(
        hTitleWrap,
        make('span', 'ldg-sub', `${tBreakdown.length} 位 · ${fmtHours(comp.hours)}h`)
      );
      const list = make('div', 'ldg-bar-list');
      const maxHrs = Math.max(1, ...tBreakdown.map(t => num(t.total)));
      tBreakdown.forEach(t => {
        const itemWrap = make('div', 'ldg-bar-item');
        const rowBtn = make('button', 'ldg-bar-row' + (billingTeacherFilter === t.teacher ? ' on' : ''));
        rowBtn.type = 'button';
        rowBtn.setAttribute('aria-pressed', String(billingTeacherFilter === t.teacher));
        rowBtn.onclick = () => {
          billingTeacherFilter = billingTeacherFilter === t.teacher ? '' : t.teacher;
          syncTeacherFilterUI();
        };
        const top = make('div', 'ldg-bar-top');
        const nameBox = make('span', 'ldg-bar-name');
        nameBox.append(make('span', '', t.teacher), make('span', 'ldg-bar-meta', `${t.classes} 节`));
        const hrsEl = make('span', 'ldg-bar-hrs', `${fmtHours(t.total)}h`);
        top.append(nameBox, hrsEl);

        const prog = make('progress', 'ldg-progress');
        prog.max = maxHrs;
        prog.value = num(t.total);
        prog.setAttribute('aria-label', `${t.teacher} 本月 ${fmtHours(t.total)} 课时`);

        const buckets = make('div', 'ldg-buckets');
        Object.entries(t.buckets || {}).forEach(([bk, bv]) => {
          if (num(bv) > 0) buckets.append(make('span', 'ldg-bucket', `${bk} ${fmtHours(bv)}h`));
        });

        rowBtn.append(top, prog);
        if (buckets.childNodes.length) rowBtn.append(buckets);
        barBtnMap.set(t.teacher, rowBtn);

        const genBtn = make('button', 'ldg-btn sm ldg-bar-card-btn', '🎨 核对卡');
        genBtn.type = 'button';
        genBtn.title = `按当前在线表编辑并生成 ${t.teacher} 核对卡`;
        genBtn.onclick = () => openTeacherCardEditor(cur, t.teacher);

        itemWrap.append(rowBtn, genBtn);
        list.append(itemWrap);
      });
      card.append(head, list);
      barsSlot.append(card);
    }

    function refreshTeacherSelectOptions() {
      if (!teacherSelectEl) return;
      const comp = currentComputed();
      const names = comp.teacher_breakdown.length
        ? comp.teacher_breakdown.map(t => t.teacher)
        : [...new Set(sheetDraft.records.map(r => r.teacher).filter(Boolean))];
      teacherSelectEl.textContent = '';
      const allOpt = make('option', '', '全部讲师');
      allOpt.value = '';
      teacherSelectEl.append(allOpt);
      names.forEach(tn => {
        const opt = make('option', '', tn);
        opt.value = tn;
        if (tn === billingTeacherFilter) opt.selected = true;
        teacherSelectEl.append(opt);
      });
    }

    function renderCardsSection() {
      cardsSlot.textContent = '';
      const latestImgs = (Array.isArray(cur.files) ? cur.files : []).filter(f => f.kind === 'image');
      if (!latestImgs.length) return;
      const shown = billingTeacherFilter
        ? latestImgs.filter(f => String(f.name || '').includes(billingTeacherFilter) || f.teacher === billingTeacherFilter)
        : latestImgs;
      const card = make('div', 'ldg-card');
      const head = make('div', 'ldg-head');
      const hTitleWrap = make('div', 'ldg-title-row');
      const hTitle = billingTeacherFilter
        ? `🪪 老师核对卡 · ${billingTeacherFilter}（${shown.length}/${latestImgs.length}）`
        : `🪪 老师课时核对卡（${latestImgs.length}）`;
      hTitleWrap.append(
        make('h3', '', hTitle),
        makeInfoTip('原版为月末自动归档件（永不覆盖）；点击「✏️ 编辑」可基于最新在线表重绘并另存编辑版；点击「⬇️ 存到桌面」可一键保存 PNG')
      );
      head.append(hTitleWrap);
      const hActs = make('div', 'ldg-head-actions');
      const newCardBtn = make('button', 'ldg-btn sm', '🎨 生成核对卡');
      newCardBtn.type = 'button';
      newCardBtn.onclick = () => openTeacherCardEditor(cur, billingTeacherFilter || '');
      hActs.append(newCardBtn);
      if (billingTeacherFilter) {
        const showAll = make('button', 'ldg-btn sm', '显示全部');
        showAll.type = 'button';
        showAll.onclick = () => { billingTeacherFilter = ''; syncTeacherFilterUI(); };
        hActs.append(showAll);
      }
      head.append(hActs);
      card.append(head);

      if (!shown.length) {
        card.append(make('div', 'ldg-empty', `本月暂无「${billingTeacherFilter}」核对卡，可点击上方「🎨 生成核对卡」立即重绘。`));
        cardsSlot.append(card);
        return;
      }

      const grid = make('div', 'ldg-cards-grid');
      shown.forEach(f => {
        const isEdited = f.variant === 'edited' || /\/edited-/.test(String(f.path || '')) || /（编辑版）/.test(String(f.name || ''));
        const extractedTeacher = f.teacher || (String(f.name || '').match(/^([^\s【\[]+)[【\[]/)?.[1] || '');
        const item = make('div', 'ldg-card-img');
        const thumbBtn = make('button', 'ldg-card-thumb');
        thumbBtn.type = 'button';
        thumbBtn.setAttribute('aria-label', `放大预览 ${f.name}`);
        thumbBtn.onclick = () => openImageLightbox(f);
        const img = make('img');
        img.alt = f.name;
        img.loading = 'lazy';
        thumbBtn.append(img);

        const capRow = make('div', 'ldg-card-cap');
        capRow.append(
          make('span', 'ldg-card-fname', f.name),
          make('span', 'ldg-badge ' + (isEdited ? 'warn' : 'ok'), isEdited ? '编辑版' : '原版')
        );
        const ops = make('div', 'ldg-card-ops');
        const deskBtn = make('button', 'ldg-btn sm primary', '⬇️ 存到桌面');
        deskBtn.type = 'button';
        deskBtn.onclick = () => void saveFileToDesktop(f, deskBtn);
        const editBtn = make('button', 'ldg-btn sm', '✏️ 编辑');
        editBtn.type = 'button';
        editBtn.onclick = () => openTeacherCardEditor(cur, extractedTeacher);
        const zoomBtn = make('button', 'ldg-btn sm', '放大');
        zoomBtn.type = 'button';
        zoomBtn.onclick = () => openImageLightbox(f);
        ops.append(deskBtn, editBtn, zoomBtn);
        item.append(thumbBtn, capRow, ops);
        grid.append(item);
        void getSignedUrl(f.path).then(u => { if (u) img.src = u; }).catch(() => {});
      });
      card.append(grid);
      cardsSlot.append(card);
    }

    function pushUndoSnapshot() {
      sheetDraft.undoStack.push(cloneSheetRecords(sheetDraft.records));
      if (sheetDraft.undoStack.length > 50) sheetDraft.undoStack.shift();
      sheetDraft.redoStack = [];
    }

    function syncSheetMetaUI() {
      if (recTitleEl) {
        recTitleEl.textContent = `📋 在线课时电子表（${sheetDraft.records.length} 节）`;
      }
      if (undoBtn) undoBtn.disabled = sheetDraft.undoStack.length === 0 || sheetDraft.saving;
      if (redoBtn) redoBtn.disabled = sheetDraft.redoStack.length === 0 || sheetDraft.saving;
      if (saveSheetBtn) {
        saveSheetBtn.disabled = !sheetDraft.dirty || sheetDraft.saving;
        saveSheetBtn.textContent = sheetDraft.saving ? '正在保存…' : (sheetDraft.dirty ? '💾 保存修改到云端' : '✓ 已同步云端');
      }
      if (fxStateEl) {
        fxStateEl.className = 'ldg-fx-state ' + (sheetDraft.dirty ? 'dirty' : 'clean');
        fxStateEl.textContent = sheetDraft.dirty ? '● 有未保存修改 (Ctrl+S)' : '已同步云端';
      }
      renderStatsSlot();
      renderBarsSlot();
      refreshTeacherSelectOptions();
    }

    function syncFormulaBar() {
      if (!fxRefEl || !fxInputEl) return;
      const rowIdx = sheetDraft.records.findIndex(r => r._rid === sheetDraft.activeRid);
      const col = SHEET_COLS[sheetDraft.activeCol];
      if (rowIdx < 0 || !col) {
        fxRefEl.textContent = '未选中';
        fxInputEl.value = '';
        fxInputEl.disabled = true;
        return;
      }
      const row = sheetDraft.records[rowIdx];
      fxRefEl.textContent = `${col.letter}${rowIdx + 1} · ${col.label}`;
      fxInputEl.disabled = false;
      const val = col.key === 'hours' ? fmtHours(row.hours) : String(row[col.key] ?? '');
      if (document.activeElement !== fxInputEl) fxInputEl.value = val;
    }

    function applyCellValue(rid, colIdx, rawVal, {pushHistory = true} = {}) {
      const row = sheetDraft.records.find(r => r._rid === rid);
      const col = SHEET_COLS[colIdx];
      if (!row || !col) return {changed: false};
      let nextVal = String(rawVal ?? '').trim();
      let parsed = nextVal;
      if (col.key === 'count') {
        const n = Number(nextVal);
        if (!Number.isFinite(n) || n < 1) return {changed: false, error: '人数须为 ≥ 1 的整数'};
        parsed = Math.round(n);
      } else if (col.key === 'hours') {
        const n = Number(nextVal);
        if (!Number.isFinite(n) || n < 0 || n > 9999.99) return {changed: false, error: '课时须为 ≥ 0 的有效数字'};
        parsed = Math.round(n * 100) / 100;
      }
      if (row[col.key] === parsed) return {changed: false};
      if (pushHistory) pushUndoSnapshot();
      const oldDateWeekday = col.key === 'date' ? deriveWeekday(row.date) : '';
      row[col.key] = parsed;
      if (col.key === 'date') {
        const nextWd = deriveWeekday(parsed);
        if (nextWd && (!row.weekday || row.weekday === oldDateWeekday)) {
          row.weekday = nextWd;
        }
      }
      sheetDraft.dirty = true;
      return {changed: true};
    }

    async function saveBillingSheet() {
      if (sheetDraft.saving || !sheetDraft.dirty) return;
      const c = client();
      if (!c) { showActionError('尚未登录云端，请先登录后重试'); return; }
      clearActionError();
      clearActionInfo();
      sheetDraft.saving = true;
      syncSheetMetaUI();
      try {
        const cleanRecords = stripSheetRecords(sheetDraft.records);
        const comp = recomputeBillingBreakdown(cleanRecords);
        const nextMeta = {
          ...(cur.meta || {}),
          rows: comp.rows,
          hours: comp.hours,
          teachers: comp.teachers,
          teacher_breakdown: comp.teacher_breakdown,
          student_breakdown: comp.student_breakdown,
          records: cleanRecords,
        };
        const res = await c.from('wayon_billing_months')
          .update({meta: nextMeta, verified_at: new Date().toISOString()})
          .eq('year_month', cur.year_month);
        if (res?.error) throw res.error;
        cur.meta = nextMeta;
        sheetDraft.dirty = false;
        showActionInfo(`已保存「${cur.title || cur.year_month}」在线课时表（${comp.rows} 节 · 共 ${fmtHours(comp.hours)}h）到云端`);
        announcePolite('课时表修改已保存到云端');
      } catch (err) {
        showActionError('保存课时表失败：' + String(err?.message || err || '请稍后重试'));
      } finally {
        sheetDraft.saving = false;
        syncSheetMetaUI();
      }
    }

    function getVisibleRowElements() {
      return sheetTbodyEl ? [...sheetTbodyEl.children].filter(tr => tr.tagName === 'TR') : [];
    }

    function updateFooterTotals() {
      const trs = getVisibleRowElements();
      let sumHrs = 0;
      trs.forEach((tr, idx) => {
        const rn = tr.querySelector('th.ldg-rownum');
        if (rn) rn.textContent = String(idx + 1);
        const rec = sheetDraft.records.find(r => r._rid === tr.dataset.rid);
        if (rec) sumHrs = Math.round((sumHrs + num(rec.hours)) * 100) / 100;
      });
      if (sheetFootCountEl) sheetFootCountEl.textContent = `合计 ${trs.length} / ${sheetDraft.records.length} 节`;
      if (sheetFootHoursEl) sheetFootHoursEl.textContent = `${fmtHours(sumHrs)}h`;
      const subEl = recordsSlot.querySelector('.ldg-subtotal-main');
      if (subEl) subEl.textContent = `当前显示 ${trs.length} / ${sheetDraft.records.length} 节 · 合计 ${fmtHours(sumHrs)} 课时`;
    }

    function findCellEl(rid, colIdx) {
      if (!sheetTbodyEl || !rid) return null;
      return sheetTbodyEl.querySelector(`td.ldg-cell[data-rid="${rid}"][data-col="${colIdx}"]`);
    }

    function selectCell(rid, colIdx, {focusCell = true} = {}) {
      const clampedCol = Math.max(0, Math.min(SHEET_COLS.length - 1, colIdx));
      if (sheetTbodyEl) {
        const prev = sheetTbodyEl.querySelector('td.ldg-cell.sel');
        if (prev) prev.classList.remove('sel');
      }
      sheetDraft.activeRid = rid;
      sheetDraft.activeCol = clampedCol;
      sheetDraft.editing = false;
      const td = findCellEl(rid, clampedCol);
      if (td) {
        td.classList.add('sel');
        if (focusCell) td.focus?.();
      }
      syncFormulaBar();
    }

    function moveSelection(dRow, dCol) {
      const trs = getVisibleRowElements();
      if (!trs.length) return;
      let rIdx = trs.findIndex(tr => tr.dataset.rid === sheetDraft.activeRid);
      if (rIdx < 0) rIdx = 0;
      let cIdx = sheetDraft.activeCol + dCol;
      if (cIdx >= SHEET_COLS.length) { cIdx = 0; rIdx += 1; }
      else if (cIdx < 0) { cIdx = SHEET_COLS.length - 1; rIdx -= 1; }
      rIdx = Math.max(0, Math.min(trs.length - 1, rIdx + dRow));
      selectCell(trs[rIdx].dataset.rid, cIdx, {focusCell: true});
    }

    function renderCellDisplay(td, row, col) {
      td.classList.remove('editing');
      const val = col.key === 'hours' ? fmtHours(row.hours) : String(row[col.key] ?? '');
      td.dataset.value = col.type === 'number' ? String(num(row[col.key])) : val;
      td.textContent = val;
    }

    function startEditCell(rid, colIdx, initialText = null) {
      const row = sheetDraft.records.find(r => r._rid === rid);
      const col = SHEET_COLS[colIdx];
      const td = findCellEl(rid, colIdx);
      if (!row || !col || !td) return;
      selectCell(rid, colIdx, {focusCell: false});
      sheetDraft.editing = true;
      td.classList.add('editing');
      td.textContent = '';
      const inp = make('input', 'ldg-cell-input');
      inp.type = 'text';
      inp.setAttribute('aria-label', `${col.label}编辑框`);
      const orig = col.key === 'hours' ? fmtHours(row.hours) : String(row[col.key] ?? '');
      inp.value = initialText !== null ? initialText : orig;
      td.append(inp);
      inp.focus?.();
      if (initialText === null && typeof inp.select === 'function') inp.select();

      let done = false;
      const finish = (commit, moveDir = null) => {
        if (done) return;
        done = true;
        sheetDraft.editing = false;
        if (commit) {
          const res = applyCellValue(rid, colIdx, inp.value, {pushHistory: true});
          if (res.error) showActionError(res.error);
          else clearActionError();
          renderCellDisplay(td, row, col);
          if (col.key === 'date') {
            const wdTd = findCellEl(rid, 1);
            if (wdTd) renderCellDisplay(wdTd, row, SHEET_COLS[1]);
          }
          if (res.changed) {
            updateFooterTotals();
            syncSheetMetaUI();
          }
        } else {
          renderCellDisplay(td, row, col);
        }
        syncFormulaBar();
        if (moveDir) moveSelection(moveDir[0], moveDir[1]);
        else td.focus?.();
      };

      inp.addEventListener('keydown', e => {
        if (e.isComposing) return;
        if ((e.metaKey || e.ctrlKey) && String(e.key || '').toLowerCase() === 's') {
          e.preventDefault(); e.stopPropagation(); finish(true, null); void saveBillingSheet(); return;
        }
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(true, [e.shiftKey ? -1 : 1, 0]); }
        else if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); finish(true, [0, e.shiftKey ? -1 : 1]); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false, null); }
      });
      inp.addEventListener('blur', () => finish(true, null));
    }

    function handleSheetPaste(rid, startColIdx, rawText) {
      const text = String(rawText || '').replace(/\r\n?/g, '\n');
      if (!text) return;
      const lines = text.split('\n');
      if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
      const matrix = lines.map(l => l.split('\t'));
      const trs = getVisibleRowElements();
      const startVisibleIdx = trs.findIndex(tr => tr.dataset.rid === rid);
      if (startVisibleIdx < 0) return;
      pushUndoSnapshot();
      let changedAny = false;
      for (let rOff = 0; rOff < matrix.length; rOff++) {
        let targetRow;
        if (startVisibleIdx + rOff < trs.length) {
          const targetRid = trs[startVisibleIdx + rOff].dataset.rid;
          targetRow = sheetDraft.records.find(r => r._rid === targetRid);
        } else {
          targetRow = normalizeSheetRow({date: '', weekday: '', time: '', teacher: '', student: '', subject: '', kind: '', count: 1, hours: 0, location: '', note: ''});
          sheetDraft.records.push(targetRow);
          changedAny = true;
        }
        if (!targetRow) continue;
        const cells = matrix[rOff];
        for (let cOff = 0; cOff < cells.length; cOff++) {
          const cIdx = startColIdx + cOff;
          if (cIdx >= SHEET_COLS.length) break;
          const res = applyCellValue(targetRow._rid, cIdx, cells[cOff], {pushHistory: false});
          if (res.changed) changedAny = true;
        }
      }
      if (changedAny) {
        sheetDraft.dirty = true;
        syncSheetMetaUI();
        renderRecordsRows();
        selectCell(rid, startColIdx, {focusCell: true});
      } else {
        sheetDraft.undoStack.pop();
      }
    }

    function insertRowAfter(afterRid = null) {
      pushUndoSnapshot();
      const idx = afterRid ? sheetDraft.records.findIndex(r => r._rid === afterRid) : sheetDraft.records.length - 1;
      const refRow = idx >= 0 ? sheetDraft.records[idx] : null;
      const newRow = normalizeSheetRow({
        date: refRow?.date || `${cur.year_month}-01`,
        weekday: refRow?.weekday || deriveWeekday(`${cur.year_month}-01`),
        time: '',
        teacher: billingTeacherFilter || refRow?.teacher || '',
        student: '',
        subject: '',
        kind: '',
        count: 1,
        hours: 2,
        location: refRow?.location || '深圳维安教育线下',
        note: '',
      });
      if (idx >= 0) sheetDraft.records.splice(idx + 1, 0, newRow);
      else sheetDraft.records.push(newRow);
      sheetDraft.dirty = true;
      sheetDraft.activeRid = newRow._rid;
      sheetDraft.activeCol = 4;
      syncSheetMetaUI();
      renderRecordsRows();
      selectCell(newRow._rid, 4, {focusCell: true});
    }

    function deleteRowByRid(rid) {
      const idx = sheetDraft.records.findIndex(r => r._rid === rid);
      if (idx < 0) return;
      pushUndoSnapshot();
      sheetDraft.records.splice(idx, 1);
      sheetDraft.dirty = true;
      if (sheetDraft.activeRid === rid) {
        const nextRow = sheetDraft.records[Math.min(idx, sheetDraft.records.length - 1)] || null;
        sheetDraft.activeRid = nextRow ? nextRow._rid : null;
      }
      syncSheetMetaUI();
      renderRecordsRows();
      if (sheetDraft.activeRid) selectCell(sheetDraft.activeRid, sheetDraft.activeCol, {focusCell: false});
      else syncFormulaBar();
    }

    function sortSheetInPlace(colIdx) {
      if (!sheetTableEl || !sheetTbodyEl) return;
      const headers = sheetTableEl.querySelectorAll('thead th[data-col-idx]');
      const targetTh = [...headers].find(th => Number(th.dataset.colIdx) === colIdx);
      if (!targetTh) return;
      const nextDir = targetTh.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
      headers.forEach(th => th.removeAttribute('aria-sort'));
      targetTh.setAttribute('aria-sort', nextDir);
      sortState = {colIdx, dir: nextDir};
      const col = SHEET_COLS[colIdx];
      const factor = nextDir === 'ascending' ? 1 : -1;
      const rows = getVisibleRowElements();
      const keyed = rows.map(tr => {
        const cell = tr.querySelector(`td.ldg-cell[data-col="${colIdx}"]`);
        const raw = cell?.dataset?.value ?? cell?.textContent ?? '';
        return {tr, val: col.type === 'number' ? num(raw) : String(raw)};
      });
      keyed.sort((a, b) => factor * (col.type === 'number' ? (a.val - b.val) : SHEET_COLLATOR.compare(a.val, b.val)));
      for (const item of keyed) {
        if (typeof sheetTbodyEl.moveBefore === 'function') sheetTbodyEl.moveBefore(item.tr, null);
        else sheetTbodyEl.append(item.tr);
      }
      updateFooterTotals();
      announcePolite(`已按${col.label}${nextDir === 'ascending' ? '升序' : '降序'}排列，共 ${rows.length} 行`);
    }

    function renderRecordsRows() {
      recordsSlot.textContent = '';
      sheetTableEl = null;
      sheetTbodyEl = null;
      const needle = billingSearchQuery.trim().toLowerCase();
      const filtered = sheetDraft.records.filter(r => {
        if (billingTeacherFilter && r.teacher !== billingTeacherFilter) return false;
        if (needle) {
          const hay = `${r.date || ''} ${r.weekday || ''} ${r.time || ''} ${r.teacher || ''} ${r.student || ''} ${r.subject || ''} ${r.kind || ''} ${r.location || ''} ${r.note || ''}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
      if (sortState.colIdx >= 0 && sortState.dir && SHEET_COLS[sortState.colIdx]) {
        const sCol = SHEET_COLS[sortState.colIdx];
        const factor = sortState.dir === 'ascending' ? 1 : -1;
        filtered.sort((a, b) => {
          const va = sCol.type === 'number' ? num(a[sCol.key]) : String(a[sCol.key] ?? '');
          const vb = sCol.type === 'number' ? num(b[sCol.key]) : String(b[sCol.key] ?? '');
          return factor * (sCol.type === 'number' ? (va - vb) : SHEET_COLLATOR.compare(va, vb));
        });
      }
      const totalHrs = Math.round(filtered.reduce((s, r) => s + num(r.hours), 0) * 100) / 100;
      const sub = make('div', 'ldg-subtotal');
      const subMain = make('span', 'ldg-subtotal-main', `当前显示 ${filtered.length} / ${sheetDraft.records.length} 节 · 合计 ${fmtHours(totalHrs)} 课时`);
      const subSrc = make('span', '', billingTeacherFilter ? `筛选：${billingTeacherFilter}` : (cur.meta?.master_file ? `来源：${cur.meta.master_file}` : ''));
      sub.append(subMain, subSrc);
      recordsSlot.append(sub);

      if (!filtered.length) {
        const empty = make('div', 'ldg-empty');
        empty.append(make('span', '', sheetDraft.records.length ? '没有匹配的课时记录。' : '本月暂无排课明细，点击「＋ 加一行」开始在线录入。'));
        if (billingTeacherFilter || billingSearchQuery.trim()) {
          const clr = make('button', 'ldg-btn sm', '清空筛选');
          clr.type = 'button';
          clr.onclick = () => {
            billingTeacherFilter = '';
            billingSearchQuery = '';
            const inp = document.getElementById('ldg-billing-search');
            if (inp) inp.value = '';
            syncTeacherFilterUI();
          };
          empty.append(clr);
        }
        recordsSlot.append(empty);
        syncFormulaBar();
        return;
      }

      const sheetWrap = make('div', 'ldg-sheet-wrap');
      sheetWrap.tabIndex = 0;
      sheetWrap.setAttribute('role', 'region');
      sheetWrap.setAttribute('aria-labelledby', 'ldg-sheet-caption');

      const tbl = make('table', 'ldg-sheet');
      tbl.id = 'ldg-billing-sheet';
      const cap = make('caption', '', `${cur.title || cur.year_month} 可编辑课时电子表格`);
      cap.id = 'ldg-sheet-caption';
      tbl.append(cap);

      const thead = make('thead');
      const htr = make('tr');
      const rnTh = make('th', 'ldg-rownum-col', '#');
      rnTh.scope = 'col';
      htr.append(rnTh);

      SHEET_COLS.forEach((col, cIdx) => {
        const th = make('th');
        th.scope = 'col';
        th.dataset.colIdx = String(cIdx);
        th.dataset.type = col.type;
        th.style.minWidth = col.minW + 'px';
        if (sortState.colIdx === cIdx && sortState.dir) th.setAttribute('aria-sort', sortState.dir);
        const btn = make('button', 'ldg-sort-btn');
        btn.type = 'button';
        const left = make('span');
        left.append(make('span', 'ldg-col-letter', col.letter), document.createTextNode(col.label));
        const icon = make('span', 'ldg-sort-icon');
        icon.setAttribute('aria-hidden', 'true');
        btn.append(left, icon);
        btn.onclick = () => sortSheetInPlace(cIdx);
        th.append(btn);
        htr.append(th);
      });

      const opTh = make('th', '', '行');
      opTh.scope = 'col';
      opTh.style.minWidth = '60px';
      htr.append(opTh);
      thead.append(htr);

      const tbody = make('tbody');
      filtered.forEach((r, idx) => {
        const tr = make('tr');
        tr.dataset.rid = r._rid;
        const rn = make('th', 'ldg-rownum', String(idx + 1));
        rn.scope = 'row';
        tr.append(rn);

        SHEET_COLS.forEach((col, cIdx) => {
          const td = make('td', 'ldg-cell' + (col.cls ? ' ' + col.cls : ''));
          td.tabIndex = 0;
          td.dataset.rid = r._rid;
          td.dataset.col = String(cIdx);
          renderCellDisplay(td, r, col);
          if (sheetDraft.activeRid === r._rid && sheetDraft.activeCol === cIdx) td.classList.add('sel');

          td.onclick = () => {
            if (sheetDraft.editing && sheetDraft.activeRid === r._rid && sheetDraft.activeCol === cIdx) return;
            selectCell(r._rid, cIdx, {focusCell: true});
          };
          td.ondblclick = () => startEditCell(r._rid, cIdx);
          td.addEventListener('keydown', e => {
            if (sheetDraft.editing) return;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void saveBillingSheet(); return; }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
              e.preventDefault();
              if (e.shiftKey) redoBtn?.click();
              else undoBtn?.click();
              return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redoBtn?.click(); return; }
            if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startEditCell(r._rid, cIdx); return; }
            if (e.key === 'Tab') { e.preventDefault(); moveSelection(0, e.shiftKey ? -1 : 1); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); moveSelection(0, 1); return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); moveSelection(0, -1); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1, 0); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1, 0); return; }
            if (e.key === 'Backspace' || e.key === 'Delete') {
              e.preventDefault();
              const clearVal = col.key === 'count' ? '1' : (col.key === 'hours' ? '0' : '');
              const res = applyCellValue(r._rid, cIdx, clearVal, {pushHistory: true});
              if (res.changed) {
                renderCellDisplay(td, r, col);
                updateFooterTotals();
                syncSheetMetaUI();
                syncFormulaBar();
              }
              return;
            }
            if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
              e.preventDefault();
              startEditCell(r._rid, cIdx, e.key);
            }
          });
          td.addEventListener('paste', e => {
            if (sheetDraft.editing) return;
            const clip = e.clipboardData?.getData?.('text/plain');
            if (clip) {
              e.preventDefault();
              handleSheetPaste(r._rid, cIdx, clip);
            }
          });
          tr.append(td);
        });

        const opTd = make('td', 'ldg-row-ops');
        const addBelow = make('button', 'ldg-row-op-btn', '＋');
        addBelow.type = 'button';
        addBelow.title = '在下方插入一行';
        addBelow.setAttribute('aria-label', `在第 ${idx + 1} 行下方插入新行`);
        addBelow.onclick = () => insertRowAfter(r._rid);
        const delRow = make('button', 'ldg-row-op-btn del', '×');
        delRow.type = 'button';
        delRow.title = '删除这一行（可撤销）';
        delRow.setAttribute('aria-label', `删除第 ${idx + 1} 行`);
        delRow.onclick = () => deleteRowByRid(r._rid);
        opTd.append(addBelow, delRow);
        tr.append(opTd);
        tbody.append(tr);
      });

      const tfoot = make('tfoot');
      const ftr = make('tr');
      const fNum = make('td', '', 'Σ');
      fNum.style.textAlign = 'center';
      const fCount = make('td', '', `合计 ${filtered.length} / ${sheetDraft.records.length} 节`);
      fCount.colSpan = 8;
      sheetFootCountEl = fCount;
      const fHrs = make('td', '', `${fmtHours(totalHrs)}h`);
      fHrs.style.textAlign = 'right';
      sheetFootHoursEl = fHrs;
      const fTail = make('td', '', '');
      fTail.colSpan = 3;
      ftr.append(fNum, fCount, fHrs, fTail);
      tfoot.append(ftr);

      tbl.append(thead, tbody, tfoot);
      sheetWrap.append(tbl);
      recordsSlot.append(sheetWrap);
      sheetTableEl = tbl;
      sheetTbodyEl = tbody;

      if (!sheetDraft.activeRid || !filtered.some(r => r._rid === sheetDraft.activeRid)) {
        sheetDraft.activeRid = filtered[0]._rid;
        sheetDraft.activeCol = 0;
        const firstTd = findCellEl(sheetDraft.activeRid, 0);
        if (firstTd) firstTd.classList.add('sel');
      }
      syncFormulaBar();
    }

    const syncTeacherFilterUI = () => {
      for (const [tName, rowBtn] of barBtnMap) {
        const active = billingTeacherFilter === tName;
        rowBtn.classList.toggle('on', active);
        rowBtn.setAttribute('aria-pressed', String(active));
      }
      if (teacherSelectEl && teacherSelectEl.value !== billingTeacherFilter) {
        teacherSelectEl.value = billingTeacherFilter;
      }
      if (clearFilterBtn) {
        clearFilterBtn.hidden = !billingTeacherFilter && !billingSearchQuery.trim();
      }
      renderCardsSection();
      renderRecordsRows();
    };

    wrap.append(statsSlot, barsSlot, cardsSlot);
    renderStatsSlot();
    renderBarsSlot();
    renderCardsSection();

    // Google Sheets-style editable table card (always available so user can add/edit rows even on empty months)
    const recCard = make('div', 'ldg-card');
    const recHeadRow = make('div', 'ldg-title-row');
    recTitleEl = make('h3', '', `📋 在线课时电子表（${sheetDraft.records.length} 节）`);
    recHeadRow.append(
      recTitleEl,
      makeInfoTip('单击选中，双击或回车编辑，支持方向键/Tab/撤销重做与 Excel/Google 表格粘贴；保存同步云端，不影响月末原版 Excel')
    );
    recCard.append(recHeadRow);

    const tBar = make('div', 'ldg-sheet-toolbar');
    const filterGrp = make('div', 'ldg-toolbar');
    filterGrp.style.flex = '1 1 320px';

    teacherSelectEl = make('select', 'ldg-month-select');
    teacherSelectEl.id = 'ldg-billing-teacher';
    teacherSelectEl.setAttribute('aria-label', '按讲师筛选课时明细');
    refreshTeacherSelectOptions();
    teacherSelectEl.addEventListener('change', () => {
      billingTeacherFilter = teacherSelectEl.value;
      syncTeacherFilterUI();
    });

    const q = make('input', 'ldg-search');
    q.id = 'ldg-billing-search';
    q.type = 'search';
    q.placeholder = '搜学生 / 科目 / 老师 / 日期 / 备注…';
    q.value = billingSearchQuery;
    let composing = false;
    q.addEventListener('compositionstart', () => { composing = true; });
    q.addEventListener('compositionend', () => {
      composing = false;
      billingSearchQuery = q.value;
      if (clearFilterBtn) clearFilterBtn.hidden = !billingTeacherFilter && !billingSearchQuery.trim();
      renderRecordsRows();
    });
    q.addEventListener('input', () => {
      if (composing) return;
      billingSearchQuery = q.value;
      if (clearFilterBtn) clearFilterBtn.hidden = !billingTeacherFilter && !billingSearchQuery.trim();
      renderRecordsRows();
    });

    clearFilterBtn = make('button', 'ldg-btn sm', '清空筛选');
    clearFilterBtn.type = 'button';
    clearFilterBtn.hidden = !billingTeacherFilter && !billingSearchQuery.trim();
    clearFilterBtn.onclick = () => {
      billingTeacherFilter = '';
      billingSearchQuery = '';
      q.value = '';
      syncTeacherFilterUI();
    };
    filterGrp.append(teacherSelectEl, q, clearFilterBtn);

    const sheetActs = make('div', 'ldg-sheet-actions');
    const addRowBtn = make('button', 'ldg-btn sm', '＋ 加一行');
    addRowBtn.id = 'ldg-sheet-add-row';
    addRowBtn.type = 'button';
    addRowBtn.onclick = () => insertRowAfter(sheetDraft.activeRid);

    undoBtn = make('button', 'ldg-btn sm', '↩ 撤销');
    undoBtn.id = 'ldg-sheet-undo';
    undoBtn.type = 'button';
    undoBtn.onclick = () => {
      if (!sheetDraft.undoStack.length || sheetDraft.saving) return;
      sheetDraft.redoStack.push(cloneSheetRecords(sheetDraft.records));
      sheetDraft.records = sheetDraft.undoStack.pop();
      sheetDraft.dirty = true;
      syncSheetMetaUI();
      renderRecordsRows();
    };

    redoBtn = make('button', 'ldg-btn sm', '↪ 重做');
    redoBtn.id = 'ldg-sheet-redo';
    redoBtn.type = 'button';
    redoBtn.onclick = () => {
      if (!sheetDraft.redoStack.length || sheetDraft.saving) return;
      sheetDraft.undoStack.push(cloneSheetRecords(sheetDraft.records));
      sheetDraft.records = sheetDraft.redoStack.pop();
      sheetDraft.dirty = true;
      syncSheetMetaUI();
      renderRecordsRows();
    };

    const expBtn = make('button', 'ldg-btn sm', '📥 导出编辑版 CSV');
    expBtn.id = 'ldg-sheet-export';
    expBtn.type = 'button';
    expBtn.onclick = () => {
      exportSheetCsv(`${cur.title || cur.year_month}_在线编辑版`, sheetDraft.records);
      showActionInfo('已导出编辑版 CSV（可用 Excel 或 Google 表格打开）');
    };

    saveSheetBtn = make('button', 'ldg-btn sm primary', '✓ 已同步云端');
    saveSheetBtn.id = 'ldg-sheet-save';
    saveSheetBtn.type = 'button';
    saveSheetBtn.onclick = () => void saveBillingSheet();

    sheetActs.append(addRowBtn, undoBtn, redoBtn, expBtn, saveSheetBtn);
    tBar.append(filterGrp, sheetActs);

    const fxBar = make('div', 'ldg-fx-bar');
    fxBar.id = 'ldg-sheet-fx';
    fxRefEl = make('span', 'ldg-fx-ref', '未选中');
    const fxSym = make('span', 'ldg-fx-sym', 'fx');
    fxInputEl = make('input', 'ldg-fx-input');
    fxInputEl.id = 'ldg-sheet-fx-input';
    fxInputEl.type = 'text';
    fxInputEl.placeholder = '点击下方任意单元格，可在此或格内直接编辑…';
    fxInputEl.setAttribute('aria-label', '公式栏：编辑当前选中单元格内容');
    fxInputEl.addEventListener('change', () => {
      if (!sheetDraft.activeRid) return;
      const res = applyCellValue(sheetDraft.activeRid, sheetDraft.activeCol, fxInputEl.value, {pushHistory: true});
      if (res.error) { showActionError(res.error); syncFormulaBar(); return; }
      clearActionError();
      const row = sheetDraft.records.find(r => r._rid === sheetDraft.activeRid);
      const td = findCellEl(sheetDraft.activeRid, sheetDraft.activeCol);
      if (row && td) renderCellDisplay(td, row, SHEET_COLS[sheetDraft.activeCol]);
      if (row && SHEET_COLS[sheetDraft.activeCol].key === 'date') {
        const wdTd = findCellEl(sheetDraft.activeRid, 1);
        if (wdTd) renderCellDisplay(wdTd, row, SHEET_COLS[1]);
      }
      if (res.changed) {
        updateFooterTotals();
        syncSheetMetaUI();
      }
    });
    fxInputEl.addEventListener('keydown', e => {
      if (e.isComposing) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        fxInputEl.dispatchEvent?.(new Event('change'));
        moveSelection(1, 0);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveBillingSheet();
      }
    });
    fxStateEl = make('span', 'ldg-fx-state clean', '已同步云端');
    fxBar.append(fxRefEl, fxSym, fxInputEl, fxStateEl);

    recCard.append(tBar, fxBar, recordsSlot);
    wrap.append(recCard);
    syncSheetMetaUI();
    renderRecordsRows();

    if (docs.length) {
      const card = make('div', 'ldg-card');
      const dHead = make('div', 'ldg-title-row');
      dHead.append(
        make('h3', '', `📎 原版归档 Excel（${docs.length}）`),
        makeInfoTip('月末归档的原始微软 .xlsx 文件（只读原件永久保留，与上方在线编辑表相互独立）')
      );
      card.append(dHead);
      const row = make('div', 'ldg-files');
      docs.forEach(f => {
        const sz = fmtBytes(f.size);
        const btn = make('button', 'ldg-btn' + (f.is_master ? ' primary' : ''), `⬇️ 原版 ${f.name}${sz ? ` (${sz})` : ''}`);
        btn.type = 'button';
        btn.onclick = () => void downloadSignedFile(f, btn);
        row.append(btn);
      });
      card.append(row);
      wrap.append(card);
    }

    if (cur.summary_md) {
      const safeSummary = sanitizeAcademicSummaryMd(cur.summary_md);
      if (safeSummary) {
        const comp = currentComputed();
        const hasInteractive = comp.teacher_breakdown.length > 0 || sheetDraft.records.length > 0;
        const summaryDetails = make('details', 'ldg-card ldg-summary-details');
        summaryDetails.open = !hasInteractive;
        const sumTitle = make('summary', '', `📝 月度核对汇总报告 · ${cur.title || cur.year_month}`);
        summaryDetails.append(sumTitle, renderMarkdownNode(safeSummary, cur.title || cur.year_month));
        wrap.append(summaryDetails);
      }
    }
  }

  function renderBillingTab(wrap) {
    const subBar = make('div', 'ldg-subbar');
    const subPills = make('div', 'ldg-pills');
    const views = [
      ['monthly', `月度课时与核对卡 (${store.billing.length}月)`],
      ['longterm', '长期学员台账'],
    ];
    views.forEach(([vid, lbl]) => {
      const b = make('button', 'ldg-pill' + (billingView === vid ? ' on' : ''), lbl);
      b.id = 'ldg-billing-view-' + vid;
      b.type = 'button';
      b.setAttribute('aria-pressed', String(billingView === vid));
      b.onclick = () => { billingView = vid; render(); };
      subPills.append(b);
    });
    subBar.append(subPills, makeInfoTip('双保险永久保留：Supabase 私有云 + 私有 GitHub 仓库', {align: 'right', placement: 'bottom'}));
    wrap.append(subBar);

    if (billingView === 'longterm') {
      renderLongTermView(wrap);
    } else {
      renderMonthlyBillingView(wrap);
    }
  }

  function renderLeaveTab(wrap) {
    const statsSlot = make('div', 'ldg-rows-slot');
    statsSlot.id = 'ldg-leave-stats-slot';
    function renderLeaveStats() {
      statsSlot.textContent = '';
      const totalProd = store.leave.reduce((s, r) => s + num(r.produced_days), 0);
      const totalUsed = store.leave.reduce((s, r) => s + num(r.used_days), 0);
      const remaining = Math.round((totalProd - totalUsed) * 100) / 100;
      const stats = make('div', 'ldg-stats');
      [
        ['累计产生调休', fmtDays(totalProd) + ' 天', ''],
        ['已休天数', fmtDays(totalUsed) + ' 天', 'ok'],
        ['当前剩余可休', fmtDays(remaining) + ' 天', remaining > 0 ? 'accent' : ''],
      ].forEach(([l, v, cls]) => {
        const s = make('div', 'ldg-stat');
        s.append(make('span', 'ldg-stat-label', l), make('span', 'ldg-stat-val ' + cls, v));
        stats.append(s);
      });
      statsSlot.append(stats);
    }
    wrap.append(statsSlot);
    renderLeaveStats();

    const bar = make('div', 'ldg-toolbar');
    const pills = make('div', 'ldg-pills');
    const pillBtns = new Map();
    const syncPills = () => {
      for (const [k, b] of pillBtns) {
        const active = leaveFilter === k;
        b.classList.toggle ? b.classList.toggle('on', active) : (active ? b.classList.add('on') : b.classList.remove('on'));
        b.setAttribute('aria-pressed', String(active));
      }
    };
    const rowsSlot = make('div', 'ldg-rows-slot');
    rowsSlot.id = 'ldg-leave-rows';
    [['all', '全部'], ['open', '待调休'], ['done', '已休完']].forEach(([k, lbl]) => {
      const b = make('button', 'ldg-pill' + (leaveFilter === k ? ' on' : ''), lbl);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(leaveFilter === k));
      b.onclick = () => { leaveFilter = k; syncPills(); renderLeaveRows(); };
      pillBtns.set(k, b);
      pills.append(b);
    });
    const q = make('input', 'ldg-search');
    q.id = 'ldg-leave-search';
    q.type = 'search';
    q.placeholder = '搜事项 / 日期 / 备注…';
    q.value = leaveQuery;
    let composing = false;
    q.addEventListener('compositionstart', () => { composing = true; });
    q.addEventListener('compositionend', () => { composing = false; leaveQuery = q.value; renderLeaveRows(); });
    q.addEventListener('input', () => { if (composing) return; leaveQuery = q.value; renderLeaveRows(); });
    const addBtn = make('button', 'ldg-btn primary', '＋ 记一条加班'); addBtn.type = 'button'; addBtn.onclick = () => openLeaveDialog(null);
    bar.append(pills, q, addBtn, makeInfoTip('点击单元格即可原位修改，回车或失焦自动保存并重算剩余调休', {align: 'right'}));
    wrap.append(bar, rowsSlot);

    function renderLeaveRows() {
      rowsSlot.textContent = '';
      if (!store.leave.length) {
        rowsSlot.append(make('div', 'ldg-empty', '暂无调休记录，可点击上方「＋ 记一条加班」添加。'));
        return;
      }
      const needle = leaveQuery.trim().toLowerCase();
      const filtered = store.leave.filter(r => {
        const rem = num(r.produced_days) - num(r.used_days);
        if (leaveFilter === 'open' && rem <= 0) return false;
        if (leaveFilter === 'done' && rem > 0) return false;
        if (needle && !`${r.item || ''} ${r.produced_date || ''} ${r.destination || ''} ${r.note || ''}`.toLowerCase().includes(needle)) return false;
        return true;
      }).slice().reverse();

      if (!filtered.length) {
        const empty = make('div', 'ldg-empty');
        empty.append(make('span', '', '没有匹配的调休记录。'));
        if (leaveFilter !== 'all' || leaveQuery.trim()) {
          const clr = make('button', 'ldg-btn sm', '清空筛选');
          clr.type = 'button';
          clr.onclick = () => { leaveFilter = 'all'; leaveQuery = ''; q.value = ''; syncPills(); renderLeaveRows(); };
          empty.append(clr);
        }
        rowsSlot.append(empty);
        return;
      }

      const tblWrap = make('div', 'ldg-table-wrap');
      tblWrap.tabIndex = 0;
      tblWrap.setAttribute('role', 'region');
      tblWrap.setAttribute('aria-label', 'Leo 调休台账');
      const tbl = make('table', 'ldg-table');
      tbl.id = 'ldg-leave-table';
      const thead = make('thead'), htr = make('tr');
      const headers = ['事项', '产生日期', {label: '产生', num: true}, {label: '已休', num: true}, {label: '剩余', num: true}, '状态', '调休去向', '备注', '操作'];
      headers.forEach(h => {
        const th = make('th', typeof h === 'object' && h.num ? 'num' : '', typeof h === 'object' ? h.label : h);
        th.scope = 'col';
        htr.append(th);
      });
      thead.append(htr);
      const tbody = make('tbody');

      const updateLeaveField = async (r, patch) => {
        const c = client();
        if (!c) throw new Error('尚未登录云端，请先登录');
        const res = await c.from('wayon_leave_ledger').update(patch).eq('id', r.id);
        if (res?.error) throw res.error;
        Object.assign(r, patch);
      };

      filtered.forEach(r => {
        const tr = make('tr');
        tr.dataset.id = String(r.id || '');
        const rem = Math.round((num(r.produced_days) - num(r.used_days)) * 100) / 100;
        const tdRem = make('td', 'num', fmtDays(rem));
        tdRem.dataset.label = '剩余';
        const tdStatus = make('td', '');
        tdStatus.dataset.label = '状态';
        const doneBtn = make('button', 'ldg-btn sm', '标已休');
        doneBtn.type = 'button';
        doneBtn.onclick = async () => {
          if (doneBtn.disabled) return;
          const c = client();
          if (!c) { showActionError('尚未登录云端，请先登录'); return; }
          doneBtn.disabled = true;
          clearActionError();
          try {
            const res = await c.from('wayon_leave_ledger').update({used_days: r.produced_days, status: '已休完'}).eq('id', r.id);
            if (res?.error) throw res.error;
            await loadPrivate({force: true});
          } catch (err) {
            showActionError('标记已休失败：' + String(err?.message || err || '请稍后重试'));
          } finally {
            doneBtn.disabled = false;
          }
        };
        const paintStatus = () => {
          const curRem = Math.round((num(r.produced_days) - num(r.used_days)) * 100) / 100;
          tdRem.textContent = fmtDays(curRem);
          tdStatus.textContent = '';
          tdStatus.append(make('span', 'ldg-badge ' + (curRem > 0 ? 'warn' : 'ok'), curRem > 0 ? '待调休' : '已休完'));
          doneBtn.hidden = curRem <= 0;
        };
        paintStatus();

        const thItem = makeInlineEditableCell({
          tag: 'th',
          label: '事项',
          displayText: r.item || '',
          editValue: r.item || '',
          onCommit: async nextVal => {
            if (!nextVal) return {error: '请填写事项'};
            if (nextVal.length > 400) return {error: '事项长度不能超过 400 字'};
            await updateLeaveField(r, {item: nextVal});
            return {editValue: nextVal, displayText: nextVal};
          },
        });
        thItem.dataset.field = 'item';

        const tdDate = makeInlineEditableCell({
          label: '产生日期',
          displayText: r.produced_date || '-',
          editValue: r.produced_date || '',
          onCommit: async nextVal => {
            if (nextVal && !isValidDateStr(nextVal, false)) return {error: '产生日期格式须为有效 YYYY-MM-DD'};
            await updateLeaveField(r, {produced_date: nextVal});
            return {editValue: nextVal, displayText: nextVal || '-'};
          },
        });
        tdDate.dataset.field = 'produced_date';

        const tdProd = makeInlineEditableCell({
          cls: 'num',
          label: '产生',
          type: 'number',
          displayText: fmtDays(r.produced_days),
          editValue: String(num(r.produced_days)),
          onCommit: async nextVal => {
            const chk = parseRequiredNonNeg(nextVal, '产生天数', 9999.99);
            if (!chk.ok) return {error: chk.error};
            const pDays = chk.value, uDays = num(r.used_days);
            const status = pDays - uDays <= 0 ? '已休完' : (uDays > 0 ? '部分已休' : '待调休');
            await updateLeaveField(r, {produced_days: pDays, status});
            paintStatus();
            renderLeaveStats();
            return {editValue: String(pDays), displayText: fmtDays(pDays)};
          },
        });
        tdProd.dataset.field = 'produced_days';

        const tdUsed = makeInlineEditableCell({
          cls: 'num',
          label: '已休',
          type: 'number',
          displayText: fmtDays(r.used_days),
          editValue: String(num(r.used_days)),
          onCommit: async nextVal => {
            const chk = parseRequiredNonNeg(nextVal, '已休天数', 9999.99);
            if (!chk.ok) return {error: chk.error};
            const pDays = num(r.produced_days), uDays = chk.value;
            const status = pDays - uDays <= 0 ? '已休完' : (uDays > 0 ? '部分已休' : '待调休');
            await updateLeaveField(r, {used_days: uDays, status});
            paintStatus();
            renderLeaveStats();
            return {editValue: String(uDays), displayText: fmtDays(uDays)};
          },
        });
        tdUsed.dataset.field = 'used_days';

        const tdDest = makeInlineEditableCell({
          label: '调休去向',
          displayText: r.destination || '-',
          editValue: r.destination || '',
          onCommit: async nextVal => {
            const v = nextVal.slice(0, 400);
            await updateLeaveField(r, {destination: v});
            return {editValue: v, displayText: v || '-'};
          },
        });
        tdDest.dataset.field = 'destination';

        const tdNote = makeInlineEditableCell({
          label: '备注',
          displayText: r.note || '-',
          editValue: r.note || '',
          onCommit: async nextVal => {
            const v = nextVal.slice(0, 2000);
            await updateLeaveField(r, {note: v});
            return {editValue: v, displayText: v || '-'};
          },
        });
        tdNote.dataset.field = 'note';

        const tdOps = make('td', '');
        tdOps.dataset.label = '操作';
        const ops = make('div', 'ops');
        ops.append(doneBtn);
        const ed = make('button', 'ldg-btn sm', '编辑'); ed.type = 'button'; ed.onclick = () => openLeaveDialog(r);
        const del = make('button', 'ldg-btn sm danger', '删'); del.type = 'button';
        del.onclick = () => openConfirmDialog('删除调休记录', `确认删除「${r.item}」？`, async () => {
          const c = client(); if (!c) throw new Error('尚未登录云端');
          const res = await c.from('wayon_leave_ledger').delete().eq('id', r.id);
          if (res?.error) throw res.error;
          await loadPrivate({force: true});
        });
        ops.append(ed, del);
        tdOps.append(ops);

        tr.append(thItem, tdDate, tdProd, tdUsed, tdRem, tdStatus, tdDest, tdNote, tdOps);
        tbody.append(tr);
      });

      tbl.append(thead, tbody);
      tblWrap.append(tbl);
      rowsSlot.append(tblWrap);
    }

    renderLeaveRows();
  }

  function renderSalaryTab(wrap) {
    const bar = make('div', 'ldg-toolbar');
    const maskBtn = make('button', 'ldg-btn', salaryMasked ? '👁 显示金额' : '🙈 隐藏金额');
    maskBtn.id = 'ldg-salary-mask-btn';
    maskBtn.type = 'button';
    maskBtn.onclick = () => { salaryMasked = !salaryMasked; render(); };
    const addBtn = make('button', 'ldg-btn primary', '＋ 记一月工资');
    addBtn.type = 'button'; addBtn.onclick = () => openSalaryDialog(null);
    bar.append(maskBtn, addBtn, makeInfoTip('点击「显示金额」后可单击单元格原位编辑并自动保存'));

    const statsSlot = make('div', 'ldg-rows-slot');
    statsSlot.id = 'ldg-salary-stats-slot';
    function renderSalaryStats() {
      statsSlot.textContent = '';
      let sumGross = 0, sumNet = 0, sumTot = 0;
      store.salary.forEach(r => {
        const g = num(r.gross_salary), net = g - num(r.tax) - num(r.special_deduction), ext = num(r.external_income);
        sumGross += g; sumNet += net; sumTot += net + ext;
      });
      const stats = make('div', 'ldg-stats');
      [
        ['记录月份', `${store.salary.length} 个月`, ''],
        ['累计税前（系统内）', fmtMoney(sumGross, salaryMasked), ''],
        ['累计实际发放', fmtMoney(sumNet, salaryMasked), 'ok'],
        ['累计总计收入（含系统外）', fmtMoney(sumTot, salaryMasked), 'accent'],
      ].forEach(([l, v, cls]) => {
        const s = make('div', 'ldg-stat');
        s.append(make('span', 'ldg-stat-label', l), make('span', 'ldg-stat-val ' + cls, v));
        stats.append(s);
      });
      statsSlot.append(stats);
    }
    wrap.append(statsSlot, bar);
    renderSalaryStats();

    if (!store.salary.length) {
      wrap.append(make('div', 'ldg-empty', '暂无工资发放记录，可点击上方「＋ 记一月工资」添加。'));
      return;
    }

    const tblWrap = make('div', 'ldg-table-wrap');
    tblWrap.tabIndex = 0;
    tblWrap.setAttribute('role', 'region');
    tblWrap.setAttribute('aria-label', '工资发放记录');
    const tbl = make('table', 'ldg-table');
    tbl.id = 'ldg-salary-table';
    const thead = make('thead'), htr = make('tr');
    const headers = ['工作月份', '发薪日', {label: '税前', num: true}, {label: '扣税', num: true}, {label: '专项扣除', num: true}, {label: '实际发放', num: true}, {label: '系统外', num: true}, {label: '总计收入', num: true}, '备注', '操作'];
    headers.forEach(h => {
      const th = make('th', typeof h === 'object' && h.num ? 'num' : '', typeof h === 'object' ? h.label : h);
      th.scope = 'col';
      htr.append(th);
    });
    thead.append(htr);
    const tbody = make('tbody');

    const updateSalaryField = async (r, patch) => {
      const c = client();
      if (!c) throw new Error('尚未登录云端，请先登录');
      const res = await c.from('wayon_salary_records').update(patch).eq('id', r.id);
      if (res?.error) throw res.error;
      Object.assign(r, patch);
    };

    const canEditSalaryCell = () => privateUnlocked && !salaryMasked;

    store.salary.forEach(r => {
      const tr = make('tr');
      tr.dataset.id = String(r.id || '');
      const tdNet = make('td', 'num');
      tdNet.dataset.label = '实际发放';
      const tdTot = make('td', 'num');
      tdTot.dataset.label = '总计收入';
      const paintRowComputed = () => {
        const net = num(r.gross_salary) - num(r.tax) - num(r.special_deduction);
        const tot = net + num(r.external_income);
        tdNet.textContent = fmtMoney(net, salaryMasked);
        tdTot.textContent = fmtMoney(tot, salaryMasked);
      };
      paintRowComputed();

      const thMonth = makeInlineEditableCell({
        tag: 'th',
        label: '工作月份',
        displayText: r.work_month || '',
        editValue: r.work_month || '',
        canEdit: canEditSalaryCell,
        onCommit: async nextVal => {
          if (!nextVal) return {error: '请填写工作月份'};
          if (nextVal.length > 80) return {error: '工作月份长度不能超过 80 字'};
          if (!/^\d{4}-(?:0[1-9]|1[0-2])(?:$|[\s（(])/.test(nextVal)) return {error: '工作月份请以 YYYY-MM 开头'};
          await updateSalaryField(r, {work_month: nextVal});
          return {editValue: nextVal, displayText: nextVal};
        },
      });
      thMonth.dataset.field = 'work_month';

      const tdPay = makeInlineEditableCell({
        label: '发薪日',
        displayText: r.pay_date || '-',
        editValue: r.pay_date || '',
        canEdit: canEditSalaryCell,
        onCommit: async nextVal => {
          if (nextVal && !isValidDateStr(nextVal, true)) return {error: '发薪日格式须为有效 YYYY-MM-DD 或 YYYY/M/D'};
          await updateSalaryField(r, {pay_date: nextVal});
          return {editValue: nextVal, displayText: nextVal || '-'};
        },
      });
      tdPay.dataset.field = 'pay_date';

      const makeMoneyCell = (fieldKey, label) => {
        const td = makeInlineEditableCell({
          cls: 'num',
          label,
          type: 'number',
          displayText: fmtMoney(r[fieldKey], salaryMasked),
          editValue: String(num(r[fieldKey])),
          canEdit: canEditSalaryCell,
          onCommit: async nextVal => {
            const chk = parseRequiredNonNeg(nextVal, label);
            if (!chk.ok) return {error: chk.error};
            await updateSalaryField(r, {[fieldKey]: chk.value});
            paintRowComputed();
            renderSalaryStats();
            return {editValue: String(chk.value), displayText: fmtMoney(chk.value, salaryMasked)};
          },
        });
        td.dataset.field = fieldKey;
        return td;
      };

      const tdGross = makeMoneyCell('gross_salary', '税前');
      const tdTax = makeMoneyCell('tax', '扣税');
      const tdSpec = makeMoneyCell('special_deduction', '专项扣除');
      const tdExt = makeMoneyCell('external_income', '系统外');

      const tdNote = makeInlineEditableCell({
        label: '备注',
        displayText: r.note || '-',
        editValue: r.note || '',
        canEdit: canEditSalaryCell,
        onCommit: async nextVal => {
          const v = nextVal.slice(0, 1000);
          await updateSalaryField(r, {note: v});
          return {editValue: v, displayText: v || '-'};
        },
      });
      tdNote.dataset.field = 'note';

      const tdOps = make('td', '');
      tdOps.dataset.label = '操作';
      const ops = make('div', 'ops');
      const ed = make('button', 'ldg-btn sm', '编辑'); ed.type = 'button'; ed.onclick = () => openSalaryDialog(r);
      const del = make('button', 'ldg-btn sm danger', '删'); del.type = 'button';
      del.onclick = () => openConfirmDialog('删除工资记录', `确认删除「${r.work_month}」工资记录？`, async () => {
        const c = client(); if (!c) throw new Error('尚未登录云端');
        const res = await c.from('wayon_salary_records').delete().eq('id', r.id);
        if (res?.error) throw res.error;
        await loadPrivate({force: true});
      });
      ops.append(ed, del);
      tdOps.append(ops);

      tr.append(thMonth, tdPay, tdGross, tdTax, tdSpec, tdNet, tdExt, tdTot, tdNote, tdOps);
      tbody.append(tr);
    });

    tbl.append(thead, tbody);
    tblWrap.append(tbl);
    wrap.append(tblWrap);
  }

  function renderCommissionTab(wrap) {
    if (!store.billing.length) {
      wrap.append(make('div', 'ldg-empty', '暂无已归档月度课时记录。'));
      return;
    }
    const withComm = store.billing.filter(m => num(m.meta?.commission?.total) > 0);
    if (!commissionMonth || !store.billing.some(m => m.year_month === commissionMonth)) {
      commissionMonth = (withComm[0] || store.billing[0]).year_month;
    }
    const cur = store.billing.find(m => m.year_month === commissionMonth) || store.billing[0];
    if (!cur) return;

    const bar = make('div', 'ldg-toolbar');
    const sel = make('select', 'ldg-month-select');
    sel.id = 'ldg-commission-month';
    sel.setAttribute('aria-label', '选择提成核算月份');
    store.billing.forEach(m => {
      const opt = make('option');
      opt.value = m.year_month;
      const cTot = num(m.meta?.commission?.total);
      opt.textContent = `${m.title || m.year_month}${cTot > 0 ? ` · ${fmtHours(cTot)}h` : ''}`;
      if (m.year_month === cur.year_month) opt.selected = true;
      sel.append(opt);
    });
    sel.addEventListener('change', () => { commissionMonth = sel.value; render(); });

    const pills = make('div', 'ldg-pills');
    (withComm.length ? withComm : store.billing).slice(0, 6).forEach(m => {
      const b = make('button', 'ldg-pill' + (m.year_month === cur.year_month ? ' on' : ''), (m.title || m.year_month).replace(/\s*课时汇总$/, ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(m.year_month === cur.year_month));
      b.onclick = () => { commissionMonth = m.year_month; render(); };
      pills.append(b);
    });
    bar.append(sel, pills, makeInfoTip('仅管理员本人私密空间可见，教务端「课时汇总」绝不展示个人结算与提成阶梯'));
    wrap.append(bar);

    const meta = cur.meta || {};
    const comm = meta.commission || {};
    if (num(comm.total) > 0) {
      const stats = make('div', 'ldg-stats');
      const addStat = (l, v, cls = '') => {
        const s = make('div', 'ldg-stat');
        s.append(make('span', 'ldg-stat-label', l), make('span', 'ldg-stat-val ' + cls, v));
        stats.append(s);
      };
      addStat('Leo 总结算课时', `${fmtHours(comm.total)}h`, 'accent');
      addStat('提成课时 / 阶梯', `${fmtHours(comm.extra ?? 0)}h · 第 ${comm.tiers ?? 0} 档`, 'ok');
      addStat('当前余量 / 距下档', `余 ${fmtHours(comm.rem ?? 0)}h · 差 ${fmtHours(comm.gap ?? 0)}h`, num(comm.gap) > 0 && num(comm.gap) <= 10 ? 'warn' : '');
      addStat('当月机构总课时', `${meta.rows ?? 0} 节 · ${fmtHours(meta.hours ?? 0)}h`);
      wrap.append(stats);
    } else {
      wrap.append(make('div', 'ldg-empty', `「${cur.title || cur.year_month}」未记录个人提成阶梯数据。`));
    }

    const commMd = extractCommissionSummaryMd(cur.summary_md);
    if (commMd) {
      const card = make('div', 'ldg-card');
      card.append(make('h3', '', `📝 ${cur.title || cur.year_month} · 个人提成摘要`), renderMarkdownNode(commMd, '月度提成摘要'));
      wrap.append(card);
    }

    if (withComm.length) {
      const card = make('div', 'ldg-card');
      card.append(make('h3', '', '📊 历月个人提成核算汇总'));
      const headers = ['月份', {label: '总结算课时', num: true}, {label: '提成课时', num: true}, {label: '阶梯', num: true}, {label: '余量', num: true}, {label: '距下档', num: true}];
      const rows = withComm.map(m => {
        const c = m.meta.commission;
        return [
          m.title || m.year_month,
          `${fmtHours(c.total)}h`,
          `${fmtHours(c.extra ?? 0)}h`,
          `第 ${c.tiers ?? 0} 档`,
          `${fmtHours(c.rem ?? 0)}h`,
          `${fmtHours(c.gap ?? 0)}h`,
        ];
      });
      card.append(renderResponsiveTable('历月个人提成核算汇总', headers, rows));
      wrap.append(card);
    }
  }

  function renderProfilesTab(wrap) {
    const bar = make('div', 'ldg-toolbar');
    const pills = make('div', 'ldg-pills');
    const pillBtns = new Map();
    const syncPills = () => {
      for (const [st, b] of pillBtns) {
        const active = profileFilter === st;
        b.classList.toggle ? b.classList.toggle('on', active) : (active ? b.classList.add('on') : b.classList.remove('on'));
        b.setAttribute('aria-pressed', String(active));
      }
    };
    const rowsSlot = make('div', 'ldg-rows-slot');
    rowsSlot.id = 'ldg-profiles-rows';
    ['在读', '暂停', '结课', '全部'].forEach(st => {
      const b = make('button', 'ldg-pill' + (profileFilter === st ? ' on' : ''), st);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(profileFilter === st));
      b.onclick = () => { profileFilter = st; syncPills(); renderProfileRows(); };
      pillBtns.set(st, b);
      pills.append(b);
    });
    const q = make('input', 'ldg-search');
    q.id = 'ldg-profiles-search';
    q.type = 'search';
    q.placeholder = '搜学员姓名 / 课程 / 备注…';
    q.value = profileQuery;
    let composing = false;
    q.addEventListener('compositionstart', () => { composing = true; });
    q.addEventListener('compositionend', () => { composing = false; profileQuery = q.value; renderProfileRows(); });
    q.addEventListener('input', () => { if (composing) return; profileQuery = q.value; renderProfileRows(); });
    const addBtn = make('button', 'ldg-btn primary', '＋ 新增学员'); addBtn.type = 'button'; addBtn.onclick = () => openProfileDialog(null);
    bar.append(pills, q, addBtn, makeInfoTip('点击单元格即可原位修改，状态列支持下拉切换并自动保存', {align: 'right'}));
    wrap.append(bar, rowsSlot);

    function renderProfileRows() {
      rowsSlot.textContent = '';
      if (!store.profiles.length) {
        rowsSlot.append(make('div', 'ldg-empty', '暂无学员档案，可点击上方「＋ 新增学员」添加。'));
        return;
      }
      const needle = profileQuery.trim().toLowerCase();
      const filtered = store.profiles.filter(r => {
        if (profileFilter !== '全部' && r.status !== profileFilter) return false;
        if (needle && !`${r.name || ''} ${r.memo_name || ''} ${r.course || ''} ${r.note || ''}`.toLowerCase().includes(needle)) return false;
        return true;
      });
      if (!filtered.length) {
        const empty = make('div', 'ldg-empty');
        empty.append(make('span', '', '没有匹配的学员档案。'));
        if (profileFilter !== '全部' || profileQuery.trim()) {
          const clr = make('button', 'ldg-btn sm', '清空筛选');
          clr.type = 'button';
          clr.onclick = () => { profileFilter = '全部'; profileQuery = ''; q.value = ''; syncPills(); renderProfileRows(); };
          empty.append(clr);
        }
        rowsSlot.append(empty);
        return;
      }

      const tblWrap = make('div', 'ldg-table-wrap');
      tblWrap.tabIndex = 0;
      tblWrap.setAttribute('role', 'region');
      tblWrap.setAttribute('aria-label', '学员录入档案');
      const tbl = make('table', 'ldg-table');
      tbl.id = 'ldg-profiles-table';
      const thead = make('thead'), htr = make('tr');
      ['姓名', '状态', '课程', '形式', '班级/备忘录名', '备注', '操作'].forEach(h => {
        const th = make('th', '', h); th.scope = 'col'; htr.append(th);
      });
      thead.append(htr);
      const tbody = make('tbody');

      const updateProfileField = async (r, patch) => {
        const c = client();
        if (!c) throw new Error('尚未登录云端，请先登录');
        const res = await c.from('wayon_student_profiles').update(patch).eq('id', r.id);
        if (res?.error) throw res.error;
        Object.assign(r, patch);
      };

      filtered.forEach(r => {
        const tr = make('tr');
        tr.dataset.id = String(r.id || '');

        const thName = makeInlineEditableCell({
          tag: 'th',
          label: '姓名',
          displayText: r.name || '',
          editValue: r.name || '',
          onCommit: async nextVal => {
            if (!nextVal) return {error: '请填写学员姓名'};
            if (nextVal.length > 120) return {error: '学员姓名长度不能超过 120 字'};
            await updateProfileField(r, {name: nextVal});
            return {editValue: nextVal, displayText: nextVal};
          },
        });
        thName.dataset.field = 'name';

        const tdStatus = makeInlineEditableCell({
          label: '状态',
          type: 'select',
          options: ['在读', '暂停', '结课'],
          displayText: r.status || '在读',
          editValue: r.status || '在读',
          renderDisplay: (el, val) => {
            el.append(make('span', 'ldg-badge ' + (val === '在读' ? 'ok' : 'muted'), val || '在读'));
          },
          onCommit: async nextVal => {
            if (!['在读', '暂停', '结课'].includes(nextVal)) return {error: '无效学员状态'};
            await updateProfileField(r, {status: nextVal});
            return {editValue: nextVal, displayText: nextVal};
          },
        });
        tdStatus.dataset.field = 'status';

        const makeProfTextCell = (fieldKey, label, maxLen) => {
          const td = makeInlineEditableCell({
            label,
            displayText: r[fieldKey] || '-',
            editValue: r[fieldKey] || '',
            onCommit: async nextVal => {
              const v = nextVal.slice(0, maxLen);
              await updateProfileField(r, {[fieldKey]: v});
              return {editValue: v, displayText: v || '-'};
            },
          });
          td.dataset.field = fieldKey;
          return td;
        };

        const tdCourse = makeProfTextCell('course', '课程', 200);
        const tdForm = makeProfTextCell('form', '形式', 80);
        const tdMemo = makeProfTextCell('memo_name', '班级/备忘录名', 200);
        const tdNote = makeProfTextCell('note', '备注', 2000);

        const tdOps = make('td', '');
        tdOps.dataset.label = '操作';
        const ops = make('div', 'ops');
        const ed = make('button', 'ldg-btn sm', '编辑'); ed.type = 'button'; ed.onclick = () => openProfileDialog(r);
        const del = make('button', 'ldg-btn sm danger', '删'); del.type = 'button';
        del.onclick = () => openConfirmDialog('删除学员档案', `确认删除学员「${r.name}」？`, async () => {
          const c = client(); if (!c) throw new Error('尚未登录云端');
          const res = await c.from('wayon_student_profiles').delete().eq('id', r.id);
          if (res?.error) throw res.error;
          await loadAcademic({force: true});
        });
        ops.append(ed, del);
        tdOps.append(ops);

        tr.append(thName, tdStatus, tdCourse, tdForm, tdMemo, tdNote, tdOps);
        tbody.append(tr);
      });

      tbl.append(thead, tbody);
      tblWrap.append(tbl);
      rowsSlot.append(tblWrap);
    }

    renderProfileRows();

    const profileDocs = store.docs.filter(d => d.slug !== 'long-term-student-ledger');
    if (profileDocs.length) {
      profileDocs.forEach(doc => {
        const docKey = String(doc.slug || doc.id || doc.title || '');
        const card = make('details', 'ldg-card');
        card.open = docOpenState.has(docKey) ? docOpenState.get(docKey) : true;
        card.addEventListener('toggle', () => { docOpenState.set(docKey, Boolean(card.open)); });
        const sum = make('summary', '', `🗓️ ${doc.title}`);
        sum.style.cursor = 'pointer'; sum.style.fontWeight = '620'; sum.style.fontSize = '15.5px';
        card.append(sum, renderMarkdownNode(doc.body_md, doc.title));
        wrap.append(card);
      });
    }
  }

  function openChangePinDialog() {
    if (!privateUnlocked || !lockRecord) return;
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', '修改个人私密二级密码'); h.id = 'ldg-dialog-title';
    const curF = createPasswordField({
      id: 'ldg-chg-cur', name: 'current_ledger_pin', label: '当前二级密码',
      autocomplete: 'off', placeholder: '输入当前二级密码', enterkeyhint: 'next',
      minLength: 1, validator: v => String(v || '').trim() ? '' : '请填写当前二级密码',
    });
    const newF = createPasswordField({
      id: 'ldg-chg-new', name: 'new_ledger_pin', label: '新二级密码',
      hint: `${MIN_PIN_LEN}–${MAX_PIN_LEN} 位，支持数字 PIN 或字母数字口令`,
      autocomplete: 'new-password', placeholder: '输入新二级密码', enterkeyhint: 'next',
      validator: v => validatePinFormat(v, '新二级密码'),
    });
    const cfmF = createPasswordField({
      id: 'ldg-chg-cfm', name: 'confirm_ledger_pin', label: '确认新二级密码',
      autocomplete: 'new-password', placeholder: '再次输入新二级密码', enterkeyhint: 'done',
      validator: v => {
        const base = validatePinFormat(v, '确认新二级密码');
        if (base) return base;
        return v !== newF.input.value ? '两次输入的新二级密码不一致' : '';
      },
    });
    const errEl = make('p', 'ldg-form-err', ''); errEl.setAttribute('role', 'alert');
    const foot = make('div', 'ldg-dialog-foot');
    let saving = false;
    const cancel = make('button', 'ldg-btn', '取消'); cancel.type = 'button'; cancel.onclick = () => { if (!saving) dlg.close(); };
    const save = make('button', 'ldg-btn primary', '保存新密码'); save.type = 'submit';
    foot.append(cancel, save);
    form.append(h, curF.field, newF.field, cfmF.field, errEl, foot);

    form.onsubmit = async e => {
      e.preventDefault();
      if (saving) return;
      errEl.textContent = '';
      const eCur = String(curF.input.value || '').trim() ? '' : '请填写当前二级密码';
      const eNew = validatePinFormat(newF.input.value, '新二级密码');
      const eCfm = validatePinFormat(cfmF.input.value, '确认新二级密码') || (cfmF.input.value !== newF.input.value ? '两次输入的新二级密码不一致' : '');
      curF.setError(eCur);
      newF.setError(eNew);
      cfmF.setError(eCfm);
      if (eCur) { curF.input.focus?.(); return; }
      if (eNew) { newF.input.focus?.(); return; }
      if (eCfm) { cfmF.input.focus?.(); return; }

      const waitSecs = remainingLockSeconds(lockRecord);
      if (waitSecs > 0) {
        errEl.textContent = `尝试次数过多，请 ${waitSecs} 秒后再试`;
        return;
      }
      saving = true;
      save.disabled = true;
      cancel.disabled = true;
      save.textContent = '验证并保存…';
      try {
        const derived = await derivePinHash(curF.input.value, lockRecord.salt_b64, lockRecord.iterations || PBKDF2_ITERATIONS);
        if (!timingSafeEqualB64(derived, lockRecord.hash_b64)) {
          curF.input.value = '';
          curF.setError('当前二级密码不正确', {announce: true});
          curF.input.focus?.();
          return;
        }
        await saveLockRow(newF.input.value);
        curF.input.value = '';
        newF.input.value = '';
        cfmF.input.value = '';
        dlg.close();
        showActionInfo('个人私密二级密码已更新');
      } catch (err) {
        errEl.textContent = '更新失败：' + String(err?.message || err || '请稍后重试');
      } finally {
        saving = false;
        save.disabled = false;
        cancel.disabled = false;
        save.textContent = '保存新密码';
      }
    };
    dlg.append(form);
    dlg.showModal();
    curF.input.focus?.();
  }

  function openResetPinDialog() {
    if (ownerCheckState !== 'owner') return;
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', '重置个人私密二级密码'); h.id = 'ldg-dialog-title';
    const desc = make('p', '', '输入当前管理员主账号的登录密码验证身份，再设置新的个人私密二级密码。');
    desc.style.margin = '0'; desc.style.fontSize = '13px'; desc.style.color = 'var(--fg-secondary)';

    const fEmail = make('div', 'ldg-field');
    const lEmail = make('label', '', '当前登录账号'); lEmail.setAttribute('for', 'ldg-rst-email');
    const iEmail = make('input'); iEmail.id = 'ldg-rst-email'; iEmail.name = 'email'; iEmail.type = 'email';
    iEmail.readOnly = true; iEmail.setAttribute('autocomplete', 'username'); iEmail.value = '正在读取…';
    fEmail.append(lEmail, iEmail);

    const mainF = createPasswordField({
      id: 'ldg-rst-main', name: 'password', label: '工作台登录密码',
      autocomplete: 'current-password', placeholder: '输入当前账号登录密码', enterkeyhint: 'next',
      minLength: 1, validator: v => String(v || '').trim() ? '' : '请输入工作台登录密码',
    });
    const newF = createPasswordField({
      id: 'ldg-rst-new', name: 'new_ledger_pin', label: '新个人私密二级密码',
      hint: `${MIN_PIN_LEN}–${MAX_PIN_LEN} 位，支持数字 PIN 或字母数字口令`,
      autocomplete: 'new-password', placeholder: '输入新二级密码', enterkeyhint: 'next',
      validator: v => validatePinFormat(v, '新二级密码'),
    });
    const cfmF = createPasswordField({
      id: 'ldg-rst-cfm', name: 'confirm_ledger_pin', label: '确认新二级密码',
      autocomplete: 'new-password', placeholder: '再次输入新二级密码', enterkeyhint: 'done',
      validator: v => {
        const base = validatePinFormat(v, '确认新二级密码');
        if (base) return base;
        return v !== newF.input.value ? '两次输入的新二级密码不一致' : '';
      },
    });
    const errEl = make('p', 'ldg-form-err', ''); errEl.setAttribute('role', 'alert');
    const foot = make('div', 'ldg-dialog-foot');
    let saving = false;
    const cancel = make('button', 'ldg-btn', '取消'); cancel.type = 'button'; cancel.onclick = () => { if (!saving) dlg.close(); };
    const save = make('button', 'ldg-btn primary', '验证并重置'); save.type = 'submit';
    foot.append(cancel, save);
    form.append(h, desc, fEmail, mainF.field, newF.field, cfmF.field, errEl, foot);

    let sessionEmail = '';
    const c0 = client();
    if (c0?.auth?.getSession) {
      void c0.auth.getSession().then(({data}) => {
        sessionEmail = data?.session?.user?.email || '';
        iEmail.value = sessionEmail || '未获取到账号邮箱';
      }).catch(() => { iEmail.value = '未获取到账号邮箱'; });
    }

    form.onsubmit = async e => {
      e.preventDefault();
      if (saving) return;
      errEl.textContent = '';
      const eMain = String(mainF.input.value || '').trim() ? '' : '请输入工作台登录密码';
      const eNew = validatePinFormat(newF.input.value, '新二级密码');
      const eCfm = validatePinFormat(cfmF.input.value, '确认新二级密码') || (cfmF.input.value !== newF.input.value ? '两次输入的新二级密码不一致' : '');
      mainF.setError(eMain);
      newF.setError(eNew);
      cfmF.setError(eCfm);
      if (eMain) { mainF.input.focus?.(); return; }
      if (eNew) { newF.input.focus?.(); return; }
      if (eCfm) { cfmF.input.focus?.(); return; }

      const c = client();
      if (!c?.auth?.signInWithPassword) {
        errEl.textContent = '当前环境不支持账号密码核验，请刷新页面后重试';
        return;
      }
      saving = true;
      save.disabled = true;
      cancel.disabled = true;
      save.textContent = '正在核验身份…';
      try {
        if (!sessionEmail) {
          const {data: sData} = await c.auth.getSession();
          sessionEmail = sData?.session?.user?.email || '';
          iEmail.value = sessionEmail || '';
        }
        if (!sessionEmail) {
          errEl.textContent = '未检测到有效登录会话，请重新登录工作台';
          return;
        }
        const authRes = await c.auth.signInWithPassword({email: sessionEmail, password: mainF.input.value});
        if (authRes?.error) {
          mainF.input.value = '';
          mainF.setError('工作台登录密码不正确，未修改二级密码', {announce: true});
          mainF.input.focus?.();
          return;
        }
        await saveLockRow(newF.input.value);
        mainF.input.value = '';
        newF.input.value = '';
        cfmF.input.value = '';
        dlg.close();
        privateUnlocked = true;
        privateLockState = 'unlocked';
        lockNotice = '';
        lockError = '';
        actionInfo = '个人私密二级密码已重置并解锁';
        startIdleWatcher();
        render();
        void loadPrivate({force: true});
      } catch (err) {
        errEl.textContent = '重置失败：' + String(err?.message || err || '请稍后重试');
      } finally {
        saving = false;
        save.disabled = false;
        cancel.disabled = false;
        save.textContent = '验证并重置';
      }
    };
    dlg.append(form);
    dlg.showModal();
    mainF.input.focus?.();
  }

  function renderSetupView(container) {
    const card = make('div', 'ldg-lock');
    const h = make('h3', '', '🔐 首次使用：设置个人私密二级密码'); h.id = 'ldg-setup-title';
    const p = make('p', '', '个人工资、个人调休与月度提成仅管理员本人可见；未解锁前不查询任何私密数据，切走或闲置 10 分钟自动清空重锁。');
    const form = make('form', 'ldg-lock-form');
    form.setAttribute('aria-labelledby', 'ldg-setup-title');
    form.noValidate = true;

    const pinF = createPasswordField({
      id: 'ldg-pin-new', name: 'new_ledger_pin', label: '设置二级密码',
      hint: `${MIN_PIN_LEN}–${MAX_PIN_LEN} 位，支持数字 PIN 或字母数字口令（仅云端保存加盐哈希，跨设备通用）`,
      autocomplete: 'new-password', placeholder: '输入至少 4 位二级密码', enterkeyhint: 'next',
      validator: v => validatePinFormat(v, '二级密码'),
    });
    const cfmF = createPasswordField({
      id: 'ldg-pin-confirm', name: 'confirm_ledger_pin', label: '确认二级密码',
      autocomplete: 'new-password', placeholder: '再次输入确认', enterkeyhint: 'done',
      validator: v => {
        const base = validatePinFormat(v, '确认二级密码');
        if (base) return base;
        return v !== pinF.input.value ? '两次输入的二级密码不一致' : '';
      },
    });
    const errEl = make('p', 'ldg-form-err', lockError); errEl.setAttribute('role', 'alert');
    const actions = make('div', 'ldg-lock-actions');
    const submit = make('button', 'ldg-btn primary', '保存密码并进入'); submit.type = 'submit';
    const back = make('button', 'ldg-btn', '返回工作台'); back.type = 'button'; back.onclick = () => closePanel();
    actions.append(submit, back);
    form.append(pinF.field, cfmF.field, errEl, actions);

    form.onsubmit = async e => {
      e.preventDefault();
      if (lockBusy) return;
      errEl.textContent = '';
      lockError = '';
      const e1 = validatePinFormat(pinF.input.value, '二级密码');
      const e2 = validatePinFormat(cfmF.input.value, '确认二级密码') || (cfmF.input.value !== pinF.input.value ? '两次输入的二级密码不一致' : '');
      pinF.setError(e1);
      cfmF.setError(e2);
      if (e1) { pinF.input.focus?.(); return; }
      if (e2) { cfmF.input.focus?.(); return; }

      lockBusy = true;
      submit.disabled = true;
      back.disabled = true;
      submit.textContent = '正在加密保存…';
      try {
        await saveLockRow(pinF.input.value);
        pinF.input.value = '';
        cfmF.input.value = '';
        privateUnlocked = true;
        privateLockState = 'unlocked';
        lockNotice = '';
        actionInfo = '个人私密二级密码已设置并生效';
        startIdleWatcher();
        render();
        void loadPrivate({force: true});
      } catch (err) {
        const msg = '保存失败：' + String(err?.message || err || '请稍后重试');
        lockError = msg;
        errEl.textContent = msg;
      } finally {
        lockBusy = false;
        submit.disabled = false;
        back.disabled = false;
        submit.textContent = '保存密码并进入';
      }
    };

    card.append(h, p, form);
    container.append(card);
    requestAnimationFrame(() => pinF.input.focus?.());
  }

  function renderLockView(container) {
    const card = make('div', 'ldg-lock');
    const h = make('h3', '', '🔒 个人私密空间已锁定'); h.id = 'ldg-unlock-title';
    const p = make('p', '', '输入二级密码后才会从云端加载工资记录、个人调休与月度提成；切走或闲置 10 分钟后自动清空重锁。');
    card.append(h, p);
    if (lockNotice) {
      const note = make('div', 'ldg-lock-notice', lockNotice);
      note.setAttribute('role', 'status');
      card.append(note);
    }

    const form = make('form', 'ldg-lock-form');
    form.setAttribute('aria-labelledby', 'ldg-unlock-title');
    form.noValidate = true;

    const pinF = createPasswordField({
      id: 'ldg-unlock-pin', name: 'ledger_pin', label: '个人私密二级密码',
      autocomplete: 'off', placeholder: '输入二级密码解锁', enterkeyhint: 'done',
      minLength: 1, validator: v => String(v || '').trim() ? '' : '请输入二级密码',
    });
    const waitInit = remainingLockSeconds(lockRecord);
    const errEl = make('p', 'ldg-form-err', waitInit > 0 ? `输错次数过多，请 ${waitInit} 秒后再试，或使用下方账号密码重置` : lockError);
    errEl.setAttribute('role', 'alert');

    const actions = make('div', 'ldg-lock-actions');
    const submit = make('button', 'ldg-btn primary', '解锁个人私密'); submit.type = 'submit';
    const back = make('button', 'ldg-btn', '返回工作台'); back.type = 'button'; back.onclick = () => closePanel();
    actions.append(submit, back);
    form.append(pinF.field, errEl, actions);

    const resetLink = make('button', 'ldg-link-btn', '忘记二级密码？用工作台账号密码重置');
    resetLink.type = 'button';
    resetLink.onclick = () => openResetPinDialog();

    form.onsubmit = async e => {
      e.preventDefault();
      if (lockBusy) return;
      errEl.textContent = '';
      lockError = '';
      if (!lockRecord) {
        void checkOwnerAndPrivateLock();
        return;
      }
      const waitSecs = remainingLockSeconds(lockRecord);
      if (waitSecs > 0) {
        errEl.textContent = `输错次数过多，请 ${waitSecs} 秒后再试，或使用下方账号密码重置`;
        return;
      }
      const val = pinF.input.value;
      if (!String(val || '').trim()) {
        pinF.setError('请输入二级密码');
        pinF.input.focus?.();
        return;
      }
      lockBusy = true;
      submit.disabled = true;
      back.disabled = true;
      submit.textContent = '正在核验…';
      try {
        const derived = await derivePinHash(val, lockRecord.salt_b64, lockRecord.iterations || PBKDF2_ITERATIONS);
        const matched = timingSafeEqualB64(derived, lockRecord.hash_b64);
        pinF.input.value = '';
        const c = client();
        const {data: sessData} = c?.auth?.getSession ? await c.auth.getSession() : {data: null};
        const uid = sessData?.session?.user?.id;
        if (matched) {
          if (c && uid && ((Number(lockRecord.failed_attempts) || 0) > 0 || lockRecord.locked_until)) {
            await c.from('wayon_ledger_lock').update({failed_attempts: 0, locked_until: null}).eq('owner_id', uid);
          }
          lockRecord = {...lockRecord, failed_attempts: 0, locked_until: null};
          privateUnlocked = true;
          privateLockState = 'unlocked';
          lockNotice = '';
          lockError = '';
          startIdleWatcher();
          render();
          void loadPrivate({force: true});
          return;
        }
        const nextFails = (Number(lockRecord.failed_attempts) || 0) + 1;
        const cool = cooldownSeconds(nextFails);
        const lockedUntil = cool > 0 ? new Date(Date.now() + cool * 1000).toISOString() : null;
        lockRecord = {...lockRecord, failed_attempts: nextFails, locked_until: lockedUntil};
        if (c && uid) {
          await c.from('wayon_ledger_lock').update({failed_attempts: nextFails, locked_until: lockedUntil}).eq('owner_id', uid);
        }
        const msg = cool > 0
          ? `二级密码错误（连续失败 ${nextFails} 次），请 ${cool} 秒后再试`
          : `二级密码错误（连续失败 ${nextFails} 次）`;
        lockError = msg;
        pinF.setError(msg, {announce: true});
        pinF.input.focus?.();
      } catch (err) {
        const msg = '验证失败：' + String(err?.message || err || '请稍后重试');
        lockError = msg;
        errEl.textContent = msg;
      } finally {
        lockBusy = false;
        submit.disabled = false;
        back.disabled = false;
        submit.textContent = '解锁个人私密';
      }
    };

    card.append(form, resetLink);
    container.append(card);
    requestAnimationFrame(() => pinF.input.focus?.());
  }

  function appendBanners(container) {
    const okBanner = make('div', 'ldg-banner-ok');
    okBanner.setAttribute('role', 'status');
    okBanner.hidden = !actionInfo;
    const okText = make('span', 'ldg-banner-ok-text', actionInfo);
    const okClose = make('button', 'ldg-btn sm', '关闭'); okClose.type = 'button'; okClose.onclick = clearActionInfo;
    okBanner.append(okText, okClose);
    container.append(okBanner);

    const errBanner = make('div', 'ldg-banner-err');
    errBanner.setAttribute('role', 'alert');
    errBanner.hidden = !actionError;
    const errText = make('span', 'ldg-banner-err-text', actionError);
    const errClose = make('button', 'ldg-btn sm', '关闭'); errClose.type = 'button'; errClose.onclick = clearActionError;
    errBanner.append(errText, errClose);
    container.append(errBanner);
  }

  function renderTabsSection(container, tabsList, currentTabId, onSelect, renderTabBody) {
    const tablist = make('div', 'ldg-tablist');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('focusgroup', 'tablist nomemory');
    tablist.setAttribute('aria-label', activeSpace === 'private' ? '个人私密分类' : '教务管理分类');
    tabsList.forEach(t => {
      const btn = make('button', 'ldg-tab', t.label);
      btn.type = 'button';
      btn.id = 'ldg-tab-' + t.id;
      btn.setAttribute('role', 'tab');
      const sel = t.id === currentTabId;
      btn.setAttribute('aria-selected', String(sel));
      btn.tabIndex = sel ? 0 : -1;
      if (sel) btn.setAttribute('focusgroupstart', '');
      btn.onclick = () => onSelect(t.id);
      btn.onkeydown = e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const idx = tabsList.findIndex(x => x.id === t.id);
        const next = tabsList[(idx + (e.key === 'ArrowRight' ? 1 : -1) + tabsList.length) % tabsList.length];
        onSelect(next.id);
        requestAnimationFrame(() => document.getElementById('ldg-tab-' + next.id)?.focus());
      };
      tablist.append(btn);
    });
    container.append(tablist);

    tabsList.forEach(t => {
      const panel = make('div');
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'ldg-tab-' + t.id);
      const isSelected = t.id === currentTabId;
      if (!isSelected) panel.hidden = 'until-found';
      panel.addEventListener('beforematch', () => {
        if (currentTabId !== t.id) onSelect(t.id);
      });
      if (isSelected) {
        const inner = make('div', 'ldg-panel-wrap');
        renderTabBody(t.id, inner);
        panel.append(inner);
      }
      container.append(panel);
    });
  }

  function render() {
    if (!root) return;
    root.textContent = '';

    const isPrivate = activeSpace === 'private';
    const head = make('div', 'ldg-head');
    const hl = make('div', 'ldg-head-left');
    hl.append(
      make('h2', '', isPrivate ? (privateUnlocked ? '🔓 个人私密' : '🔒 个人私密') : '教务管理'),
      makeInfoTip(isPrivate
        ? '仅管理员本人可访问（含工资记录、个人调休与月度提成）；切走或闲置 10 分钟自动清空重锁'
        : '教务协作空间（课时汇总、老师核对卡、长期台账、学员档案与校历），不含任何个人工资与提成', {placement: 'bottom'})
    );

    if (loadState === 'signedout') {
      const exitBtn = make('button', 'ldg-btn sm', '返回工作台'); exitBtn.type = 'button'; exitBtn.onclick = () => closePanel();
      head.append(hl, exitBtn);
      root.append(head);

      const lock = make('div', 'ldg-lock');
      lock.append(make('h3', '', '🔒 需要本人云端登录'));
      lock.append(make('p', '', '公开静态页不包含任何教务或私有数据，请先登录工作台云端账号。'));
      const acts = make('div', 'ldg-lock-actions');
      const btn = make('button', 'ldg-btn primary', '打开登录设置'); btn.type = 'button';
      btn.onclick = () => {
        if (typeof globalThis.wayonOpenAccount === 'function') {
          globalThis.wayonOpenAccount();
          return;
        }
        const target =
          document.querySelector('.wayon-sync-notice:not([hidden]) .wayon-sync-cta:not([hidden])') ||
          document.querySelector('#account-settings > summary') ||
          document.getElementById('sync') ||
          document.querySelector('.wayon-sync-cta');
        target?.click?.();
      };
      const back = make('button', 'ldg-btn', '返回工作台'); back.type = 'button'; back.onclick = () => closePanel();
      acts.append(btn, back);
      lock.append(acts);
      root.append(lock);
      return;
    }

    if (isPrivate) {
      const hActs = make('div', 'ldg-head-actions');
      if (privateUnlocked) {
        const lockBtn = make('button', 'ldg-btn sm', '🔒 锁定'); lockBtn.id = 'ldg-lock-btn'; lockBtn.type = 'button';
        lockBtn.onclick = () => lockPrivate({reason: '个人私密空间已手动锁定，内存数据已清空', rerender: true});
        const chgBtn = make('button', 'ldg-btn sm', '改密码'); chgBtn.id = 'ldg-change-pin-btn'; chgBtn.type = 'button';
        chgBtn.onclick = () => openChangePinDialog();
        const refreshBtn = make('button', 'ldg-btn sm', '刷新'); refreshBtn.type = 'button';
        refreshBtn.onclick = () => void loadPrivate({force: true});
        hActs.append(lockBtn, chgBtn, refreshBtn);
      }
      const exitBtn = make('button', 'ldg-btn sm', '返回'); exitBtn.id = 'ldg-exit-btn'; exitBtn.type = 'button'; exitBtn.onclick = () => closePanel();
      hActs.append(exitBtn);
      head.append(hl, hActs);
      root.append(head);

      if (ownerCheckState === 'checking' || ownerCheckState === 'idle') {
        root.append(make('div', 'ldg-empty', '正在核验管理员权限…'));
        return;
      }
      if (ownerCheckState === 'denied') {
        const denied = make('div', 'ldg-lock');
        denied.append(make('h3', '', '⛔ 仅管理员本人账号可访问'));
        denied.append(make('p', '', '个人私密空间（工资记录、个人调休、月度提成）仅限管理员本人账号访问，当前账号无权查看或读取相关数据。'));
        const acts = make('div', 'ldg-lock-actions');
        const goAcad = make('button', 'ldg-btn primary', '进入教务管理'); goAcad.type = 'button'; goAcad.onclick = () => openAcademic();
        const back = make('button', 'ldg-btn', '返回工作台'); back.type = 'button'; back.onclick = () => closePanel();
        acts.append(goAcad, back);
        denied.append(acts);
        root.append(denied);
        return;
      }
      if (ownerCheckState === 'error') {
        const err = make('div', 'ldg-lock');
        err.append(make('h3', '', '⚠️ 无法核验管理员权限'));
        err.append(make('p', '', '为确保安全，未完成权限核验前不会加载任何私密数据：' + ownerCheckError));
        const acts = make('div', 'ldg-lock-actions');
        const retry = make('button', 'ldg-btn primary', '重试'); retry.type = 'button'; retry.onclick = () => void checkOwnerAndPrivateLock();
        const back = make('button', 'ldg-btn', '返回工作台'); back.type = 'button'; back.onclick = () => closePanel();
        acts.append(retry, back);
        err.append(acts);
        root.append(err);
        return;
      }

      if (!privateUnlocked) {
        if (privateLockState === 'checking' || privateLockState === 'idle') {
          root.append(make('div', 'ldg-empty', '正在核验个人私密二级密码状态…'));
          return;
        }
        if (privateLockState === 'error') {
          const err = make('div', 'ldg-lock');
          err.append(make('h3', '', '⚠️ 无法核验二级密码状态'));
          err.append(make('p', '', '为确保隐私安全，未完成校验前不会加载私密数据：' + privateLoadError));
          const acts = make('div', 'ldg-lock-actions');
          const retry = make('button', 'ldg-btn primary', '重试'); retry.type = 'button'; retry.onclick = () => void checkOwnerAndPrivateLock();
          const back = make('button', 'ldg-btn', '返回工作台'); back.type = 'button'; back.onclick = () => closePanel();
          acts.append(retry, back);
          err.append(acts);
          root.append(err);
          return;
        }
        if (privateLockState === 'setup') {
          renderSetupView(root);
          return;
        }
        renderLockView(root);
        return;
      }

      appendBanners(root);
      if (privateLoadState === 'loading' || privateLoadState === 'idle') {
        root.append(make('div', 'ldg-empty', '正在加载个人私密数据…'));
        return;
      }
      if (privateLoadState === 'error') {
        const err = make('div', 'ldg-lock');
        err.append(make('p', '', '加载失败：' + privateLoadError));
        const retry = make('button', 'ldg-btn primary', '重试'); retry.type = 'button'; retry.onclick = () => void loadPrivate({force: true});
        err.append(retry);
        root.append(err);
        return;
      }

      renderTabsSection(root, PRIVATE_TABS, privateTab, nextId => {
        touchActivity();
        privateTab = nextId;
        render();
        requestAnimationFrame(() => document.getElementById('ldg-tab-' + nextId)?.scrollIntoView?.({block: 'nearest', inline: 'nearest', container: 'nearest'}));
      }, (tabId, inner) => {
        if (tabId === 'salary') renderSalaryTab(inner);
        else if (tabId === 'leave') renderLeaveTab(inner);
        else if (tabId === 'commission') renderCommissionTab(inner);
      });
      return;
    }

    // Academic space (教务管理)
    const hActs = make('div', 'ldg-head-actions');
    const refreshBtn = make('button', 'ldg-btn sm', '刷新'); refreshBtn.type = 'button';
    refreshBtn.onclick = () => void loadAcademic({force: true});
    const exitBtn = make('button', 'ldg-btn sm', '返回'); exitBtn.id = 'ldg-exit-btn'; exitBtn.type = 'button'; exitBtn.onclick = () => closePanel();
    hActs.append(refreshBtn, exitBtn);
    head.append(hl, hActs);
    root.append(head);

    appendBanners(root);

    if (loadState === 'loading' || loadState === 'idle') {
      root.append(make('div', 'ldg-empty', '正在从云端加载教务数据…'));
      return;
    }
    if (loadState === 'error') {
      const err = make('div', 'ldg-lock');
      err.append(make('p', '', '加载失败：' + loadError));
      const retry = make('button', 'ldg-btn primary', '重试'); retry.type = 'button'; retry.onclick = () => void loadAcademic({force: true});
      err.append(retry);
      root.append(err);
      return;
    }

    renderTabsSection(root, ACADEMIC_TABS, academicTab, nextId => {
      academicTab = nextId;
      render();
      requestAnimationFrame(() => document.getElementById('ldg-tab-' + nextId)?.scrollIntoView?.({block: 'nearest', inline: 'nearest', container: 'nearest'}));
    }, (tabId, inner) => {
      if (tabId === 'billing') renderBillingTab(inner);
      else if (tabId === 'profiles') renderProfilesTab(inner);
    });
  }

  function createLedgerNavIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const mkSvg = (tag, attrs) => {
      const el = typeof document.createElementNS === 'function'
        ? document.createElementNS(NS, tag)
        : document.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
      return el;
    };
    const svg = mkSvg('svg', {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    });
    svg.append(
      mkSvg('path', {d: 'M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1-2-2z'}),
      mkSvg('path', {d: 'M8 3v18'}),
      mkSvg('path', {d: 'M12 8h5'}),
      mkSvg('path', {d: 'M12 12h5'})
    );
    return svg;
  }

  function syncNavButtonState() {
    const btn = document.getElementById('nav-ledger') || navBtn;
    if (!btn) return;
    const isAcademicOpen = open && activeSpace === 'academic';
    btn.classList.toggle('on', isAcademicOpen);
    btn.setAttribute('aria-pressed', String(isAcademicOpen));
  }

  function closePanel() {
    if (!open && !document.body.dataset.ledgerOpen && !privateUnlocked) return;
    open = false;
    lockPrivate({reason: ''});
    if (root) {
      root.textContent = '';
      root.hidden = true;
    }
    delete document.body.dataset.ledgerOpen;
    delete document.body.dataset.ledgerSpace;
    syncNavButtonState();
    const h = globalThis.location?.hash;
    if ((h === '#ledger' || h === '#private') && typeof globalThis.history?.replaceState === 'function') {
      try {
        globalThis.history.replaceState(null, '', (globalThis.location.pathname || '') + (globalThis.location.search || ''));
      } catch {}
    }
  }

  function openAcademic(tabId) {
    mount();
    if (privateUnlocked) lockPrivate({reason: ''});
    activeSpace = 'academic';
    if (tabId && ACADEMIC_TABS.some(t => t.id === tabId)) academicTab = tabId;
    open = true;
    document.body.dataset.ledgerOpen = 'true';
    document.body.dataset.ledgerSpace = 'academic';
    syncNavButtonState();
    globalThis.wayonMemo?.close?.();
    globalThis.wayonMockExams?.close?.();
    globalThis.wayonAircon?.close?.();
    globalThis.wayonVocab?.close?.();
    if (root) root.hidden = false;
    if (!client()) {
      clearAllAndSignOut();
      render();
      return;
    }
    if (loadState === 'signedout') loadState = 'idle';
    render();
    if (loadState !== 'ready') void loadAcademic();
  }

  function openPrivate(tabId) {
    mount();
    activeSpace = 'private';
    if (tabId && PRIVATE_TABS.some(t => t.id === tabId)) privateTab = tabId;
    open = true;
    document.body.dataset.ledgerOpen = 'true';
    document.body.dataset.ledgerSpace = 'private';
    syncNavButtonState();
    globalThis.wayonMemo?.close?.();
    globalThis.wayonMockExams?.close?.();
    globalThis.wayonAircon?.close?.();
    globalThis.wayonVocab?.close?.();
    if (root) root.hidden = false;
    if (!client()) {
      clearAllAndSignOut();
      render();
      return;
    }
    if (loadState === 'signedout') loadState = 'idle';
    if (privateUnlocked && ownerCheckState === 'owner') {
      touchActivity();
      startIdleWatcher();
      render();
      if (privateLoadState !== 'ready') void loadPrivate();
    } else {
      render();
      void checkOwnerAndPrivateLock();
    }
  }

  function mount() {
    if (mounting) return;
    mounting = true;
    try {
      const list = document.getElementById('list');
      if (list) {
        if (!root) {
          root = make('section');
          root.id = 'ledger-panel';
          root.hidden = !open;
          root.setAttribute('aria-label', '教务与私密空间');
          root.addEventListener('focusout', () => setTimeout(flushDeferredRender, 0));
          for (const ev of ['pointerdown', 'keydown', 'input', 'scroll']) {
            root.addEventListener(ev, touchActivity, {passive: true});
          }
          list.before(root);
        } else if (!root.parentNode) {
          list.before(root);
        }
        const notice = list.parentNode && [...list.parentNode.children].find(e => e.classList?.contains('wayon-sync-notice'));
        if (notice && typeof root.compareDocumentPosition === 'function' && (root.compareDocumentPosition(notice) & 4)) {
          notice.after(root);
        }
      }
      if (!document.body.classList?.contains('wayon-room')) {
        let btn = document.getElementById('nav-ledger') || navBtn;
        const isAcademicOpen = open && activeSpace === 'academic';
        if (!btn) {
          btn = make('button', 'wayon-icon-control ux-labelled' + (isAcademicOpen ? ' on' : ''));
          btn.id = 'nav-ledger';
          btn.type = 'button';
          btn.title = '教务管理';
          btn.setAttribute('aria-label', '教务管理');
          btn.setAttribute('aria-pressed', String(isAcademicOpen));
          btn.append(createLedgerNavIcon(), make('span', 'ux-label', '教务'));
          btn.onclick = () => {
            if (open && activeSpace === 'academic') closePanel();
            else openAcademic();
          };
        } else {
          btn.classList.toggle('on', isAcademicOpen);
          btn.setAttribute('aria-pressed', String(isAcademicOpen));
        }
        navBtn = btn;
        const footer = document.querySelector('.sidebar-footer');
        const syncEl = document.getElementById('sync');
        const tabs = document.getElementById('tabs');
        if (footer && syncEl && syncEl.parentNode === footer) {
          const footerChildren = footer.children || [];
          const btnIdx = [...footerChildren].indexOf(btn);
          const syncIdx = [...footerChildren].indexOf(syncEl);
          if (btn.parentNode !== footer || btnIdx !== syncIdx - 1) {
            syncEl.before(btn);
          }
        } else if (footer) {
          if (btn.parentNode !== footer) footer.append(btn);
        } else if (tabs) {
          if (btn.parentNode !== tabs) tabs.append(btn);
        }
      }
    } finally {
      mountObserver?.takeRecords?.();
      mounting = false;
    }
  }

  function bindAuth() {
    const c = client();
    if (!c || authBoundClient === c) return !!c;
    authBoundClient = c;
    c.auth?.onAuthStateChange?.((event) => {
      if (event === 'SIGNED_OUT') {
        clearAllAndSignOut();
        if (open) render();
        return;
      }
      if (event === 'SIGNED_IN') {
        if (open) {
          if (activeSpace === 'private') {
            if (!privateUnlocked) void checkOwnerAndPrivateLock();
          } else if (loadState !== 'ready') {
            void loadAcademic({force: true});
          }
        }
      }
    });
    return true;
  }

  function checkHash() {
    const h = globalThis.location?.hash;
    if (h === '#private') openPrivate();
    else if (h === '#ledger') openAcademic();
  }

  function needsRemount(records) {
    if (!root || !root.parentNode) return true;
    if (!document.body.classList?.contains('wayon-room') && (!navBtn || !navBtn.parentNode)) return true;
    if (!Array.isArray(records) || !records.length) return true;
    const listParent = document.getElementById('list')?.parentNode || null;
    const footer = document.querySelector('.sidebar-footer');
    for (const r of records) {
      const t = r?.target;
      if (!t) continue;
      if (root && (t === root || (typeof root.contains === 'function' && root.contains(t)))) continue;
      if (modal && (t === modal || (typeof modal.contains === 'function' && modal.contains(t)))) continue;
      if (t === listParent || t === footer || t === document.body) return true;
    }
    return false;
  }

  function start() {
    mount();
    document.addEventListener('click', e => {
      const nav = e.target?.closest?.('#tabs button');
      if (open && nav && nav.id !== 'nav-ledger') closePanel();
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkIdleTimeout();
    });
    if (typeof MutationObserver === 'function') {
      mountObserver = new MutationObserver(records => {
        if (needsRemount(records)) mount();
      });
      mountObserver.observe(document.body, {childList: true, subtree: true});
      attrObserver = new MutationObserver(() => {
        const ds = document.body.dataset || {};
        if (open && (ds.airconOpen || ds.memoOpen || ds.feedbackOpen || ds.mocksOpen)) closePanel();
      });
      attrObserver.observe(document.body, {attributes: true, attributeFilter: ['data-aircon-open', 'data-memo-open', 'data-feedback-open', 'data-mocks-open']});
    }
    let tries = 0;
    const wait = setInterval(() => {
      if (bindAuth() || ++tries > 60) {
        clearInterval(wait);
        if (open && activeSpace === 'academic' && loadState !== 'ready') void loadAcademic();
        if (open && activeSpace === 'private' && !privateUnlocked && (ownerCheckState === 'idle' || ownerCheckState === 'error' || privateLockState === 'idle' || privateLockState === 'error')) {
          void checkOwnerAndPrivateLock();
        }
      }
    }, 1000);
    addEventListener('wayon-refresh-ready', () => {
      bindAuth();
      if (open && activeSpace === 'academic' && loadState !== 'ready') void loadAcademic();
      if (open && activeSpace === 'private' && !privateUnlocked && (ownerCheckState === 'idle' || ownerCheckState === 'error' || privateLockState === 'idle' || privateLockState === 'error')) {
        void checkOwnerAndPrivateLock();
      }
    });
    addEventListener('hashchange', checkHash);
    bindAuth();
    checkHash();
  }

  globalThis.wayonLedger = {
    open: openAcademic,
    openAcademic,
    openPrivate,
    close: closePanel,
    lock: (reason) => lockPrivate({reason: reason || '个人私密空间已手动锁定，内存数据已清空', rerender: open && activeSpace === 'private'}),
    isOpen: () => open,
    getSpace: () => activeSpace,
    isUnlocked: () => privateUnlocked,
    isPrivateUnlocked: () => privateUnlocked,
    isOwner: () => ownerCheckState === 'owner',
    checkIdleTimeout,
    parseMarkdownBlocks,
    renderMarkdownNode,
    sanitizeAcademicSummaryMd,
    extractCommissionSummaryMd,
    loadAll: loadAcademic,
    loadAcademic,
    loadPrivate,
    saveBlobToDesktop,
    buildTeacherCardRows,
    renderTeacherCardCanvas,
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
