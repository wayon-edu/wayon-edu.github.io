// 个人台账与月度课时 (Owner-only private panel, hidden under Settings & Account with secondary lock).
// Zero private data lives in this file or any public page; everything is loaded from Supabase
// under strict owner-only RLS ONLY after secondary PBKDF2-SHA256 verification.
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

  const TABS = [
    {id: 'billing', label: '课时与账单'},
    {id: 'leave', label: '调休台账'},
    {id: 'salary', label: '工资记录'},
    {id: 'profiles', label: '学员与校历'},
  ];

  let open = false;
  let unlocked = false;
  let lockState = 'idle'; // idle | checking | setup | locked | unlocked | signedout | error
  let lockRecord = null;
  let lockNotice = '';
  let lockError = '';
  let lockBusy = false;
  let checkLockPromise = null;
  let lastActiveAt = 0;
  let idleTimer = null;
  let activeTab = 'billing';
  let root = null;
  let modal = null;
  let liveAnnouncer = null;
  let announceTimer = null;
  let authBoundClient = null;
  let loading = false;
  let reloadQueued = false;
  let reloadForce = false;
  let loadPromise = null;
  let deferredRender = false;
  let loadState = 'idle'; // idle | loading | ready | signedout | error
  let loadError = '';
  let actionError = '';
  let actionInfo = '';
  let salaryMasked = true;
  let selectedMonth = '';
  let billingView = 'monthly'; // monthly | longterm
  let billingTeacherFilter = '';
  let billingSearchQuery = '';
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
    body[data-ledger-open] #tabs button{background:transparent!important;color:var(--fg-secondary)!important}
    body[data-ledger-open] #list,body[data-ledger-open] .workspace-top-bar,body[data-ledger-open] .workspace-sub-bar,body[data-ledger-open] #aircon-panel,body[data-ledger-open] #memo-panel,body[data-ledger-open] #feedback-panel,body[data-ledger-open] #mocks-panel,body[data-ledger-open] .sidebar-footer .bar{display:none!important}
    body[data-aircon-open] #ledger-panel,body[data-memo-open] #ledger-panel,body[data-feedback-open] #ledger-panel,body[data-mocks-open] #ledger-panel{display:none!important}
    #ledger-panel{display:flex;flex-direction:column;gap:14px;width:100%;min-width:0;padding-bottom:32px}
    #ledger-panel[hidden]{display:none!important}
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
    .ldg-tablist{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--line,rgba(30,30,40,.09));padding-bottom:2px}
    .ldg-tablist::-webkit-scrollbar{display:none}
    .ldg-tab{position:relative;flex:none;border:0;background:transparent;color:var(--fg-secondary,#515156);padding:10px 14px;font-size:14px;font-weight:500;white-space:nowrap;cursor:pointer;border-radius:10px 10px 0 0}
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
    .ldg-card-img span{font-size:12px;color:var(--fg-secondary,#515156);word-break:break-all;line-height:1.35}
    .ldg-card-ops{display:flex;gap:6px;flex-wrap:wrap}
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
      .ldg-search,.ldg-month-select,.ldg-field input,.ldg-field select,.ldg-field textarea{font-size:16px;min-height:44px}
      .ldg-field-grid{grid-template-columns:1fr}
      .ldg-lt-nums{grid-template-columns:repeat(3,1fr)}
    }
  `;
  document.head.append(style);

  const client = () => globalThis.wayonSupabaseClient?.client || null;

  function clearPrivateStore() {
    store.billing = [];
    store.leave = [];
    store.salary = [];
    store.profiles = [];
    store.docs = [];
    selectedMonth = '';
    billingView = 'monthly';
    billingTeacherFilter = '';
    billingSearchQuery = '';
    signedUrls.clear();
    actionError = '';
    actionInfo = '';
    salaryMasked = true;
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
    if (open && unlocked) lastActiveAt = Date.now();
  }

  function stopIdleWatcher() {
    if (idleTimer !== null) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
  }

  function checkIdleTimeout() {
    if (!open || !unlocked || !lastActiveAt) return;
    if (Date.now() - lastActiveAt >= IDLE_LOCK_MS) {
      lockPanel({keepOpen: true, reason: '已闲置超过 10 分钟，台账已自动锁定并清空内存数据'});
    }
  }

  function startIdleWatcher() {
    stopIdleWatcher();
    lastActiveAt = Date.now();
    idleTimer = setInterval(checkIdleTimeout, 15000);
  }

  function lockAndClear({nextState, reason = ''} = {}) {
    unlocked = false;
    lastActiveAt = 0;
    deferredRender = false;
    reloadQueued = false;
    reloadForce = false;
    stopIdleWatcher();
    clearPrivateStore();
    loadState = 'idle';
    loadError = '';
    lockError = '';
    lockNotice = reason;
    if (modal?.open) {
      modal.onclose = null;
      modal.close();
    }
    if (nextState) lockState = nextState;
    else lockState = lockRecord ? 'locked' : 'idle';
  }

  function lockPanel({keepOpen = true, reason = '台账已手动锁定，本页内存数据已清空'} = {}) {
    lockAndClear({nextState: lockRecord ? 'locked' : 'setup', reason});
    if (keepOpen && open) render();
    else if (!keepOpen) closePanel();
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

  function checkLockStatus() {
    if (checkLockPromise) return checkLockPromise;
    checkLockPromise = (async () => {
      const c = client();
      if (!c) {
        lockRecord = null;
        lockAndClear({nextState: 'signedout'});
        if (open) render();
        return;
      }
      if (!unlocked) {
        lockState = 'checking';
        loadError = '';
        if (open) render();
      }
      try {
        const {data: sess, error: sessErr} = await c.auth.getSession();
        if (sessErr) throw sessErr;
        if (!sess?.session) {
          lockRecord = null;
          lockAndClear({nextState: 'signedout'});
          if (open) render();
          return;
        }
        const res = await c.from('wayon_ledger_lock')
          .select('algo,iterations,salt_b64,hash_b64,failed_attempts,locked_until')
          .limit(1);
        if (res.error) throw res.error;
        const row = Array.isArray(res.data) ? (res.data[0] || null) : (res.data || null);
        lockRecord = row;
        if (!unlocked) {
          lockState = row ? 'locked' : 'setup';
          if (open) render();
        }
      } catch (e) {
        if (!unlocked) {
          lockState = 'error';
          loadError = String(e?.message || e || '无法读取台账锁状态');
          if (open) render();
        }
      } finally {
        checkLockPromise = null;
      }
    })();
    return checkLockPromise;
  }

  function isInteractionBusy() {
    if (modal?.open) return true;
    const active = document.activeElement;
    if (!active || !root) return false;
    const insidePanel = typeof root.contains === 'function'
      ? root.contains(active)
      : Boolean(active.closest?.('#ledger-panel'));
    if (!insidePanel) return false;
    const tag = String(active.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
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

  function loadAll({force = false} = {}) {
    if (!unlocked) return Promise.resolve();
    if (force) reloadForce = true;
    if (loading) {
      reloadQueued = true;
      return loadPromise || Promise.resolve();
    }
    loadPromise = runLoadAll();
    return loadPromise;
  }

  async function runLoadAll() {
    do {
      reloadQueued = false;
      const force = reloadForce;
      reloadForce = false;
      if (!unlocked) break;
      const c = client();
      if (!c) {
        lockRecord = null;
        lockAndClear({nextState: 'signedout'});
        if (open) renderOrDefer(force);
        break;
      }
      loading = true;
      if (loadState === 'idle') { loadState = 'loading'; if (open) renderOrDefer(force); }
      try {
        const {data: sess, error: sessErr} = await c.auth.getSession();
        if (sessErr) throw sessErr;
        if (!unlocked) {
          clearPrivateStore();
          break;
        }
        if (!sess?.session) {
          lockRecord = null;
          lockAndClear({nextState: 'signedout'});
        } else {
          const [bRes, lRes, sRes, pRes, dRes] = await Promise.all([
            c.from('wayon_billing_months').select('*').order('year_month', {ascending: false}),
            c.from('wayon_leave_ledger').select('*').order('seq', {ascending: true, nullsFirst: false}).order('created_at', {ascending: true}),
            c.from('wayon_salary_records').select('*').order('work_month', {ascending: false}),
            c.from('wayon_student_profiles').select('*').order('name', {ascending: true}),
            c.from('wayon_reference_docs').select('*').order('updated_at', {ascending: false}),
          ]);
          if (!unlocked) {
            clearPrivateStore();
            break;
          }
          for (const r of [bRes, lRes, sRes, pRes, dRes]) if (r.error) throw r.error;
          store.billing = bRes.data || [];
          store.leave = lRes.data || [];
          store.salary = sRes.data || [];
          store.profiles = pRes.data || [];
          store.docs = dRes.data || [];
          if (selectedMonth && !store.billing.some(m => m.year_month === selectedMonth)) selectedMonth = '';
          if (!selectedMonth && store.billing.length) selectedMonth = store.billing[0].year_month;
          loadState = 'ready';
          loadError = '';
        }
      } catch (e) {
        if (!unlocked) {
          clearPrivateStore();
          break;
        }
        loadState = 'error';
        loadError = String(e?.message || e || '加载失败');
      } finally {
        loading = false;
        if (open) renderOrDefer(force);
      }
    } while (reloadQueued && unlocked);
    loadPromise = null;
  }

  async function getSignedUrl(path) {
    if (!unlocked) return null;
    const cached = signedUrls.get(path);
    if (cached && cached.exp > Date.now()) return cached.url;
    const c = client();
    if (!c) return null;
    const {data, error} = await c.storage.from('wayon-billing').createSignedUrl(path, 300);
    if (!unlocked || error || !data?.signedUrl) return null;
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
    const dlBtn = make('button', 'ldg-btn primary', '⬇️ 下载原图');
    dlBtn.type = 'button';
    dlBtn.onclick = () => void downloadSignedFile(fileObj, dlBtn);
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
        await loadAll({force: true});
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
        await loadAll({force: true});
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
        await loadAll({force: true});
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
        await loadAll({force: true});
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

    const attList = Array.isArray(ltDoc.attachments) ? ltDoc.attachments : [];
    const topBar = make('div', 'ldg-toolbar');
    const titleWrap = make('span', 'ldg-sub', `共追踪 ${Object.keys(studentsMap).length} 位/组长期重点学员 · 余额 ≤ 10h 自动标红预警`);
    topBar.append(titleWrap);
    attList.forEach(att => {
      const sz = fmtBytes(att.size);
      const dlBtn = make('button', 'ldg-btn primary', `⬇️ 下载 ${att.name}${sz ? ` (${sz})` : ''}`);
      dlBtn.type = 'button';
      dlBtn.onclick = () => void downloadSignedFile(att, dlBtn);
      topBar.append(dlBtn);
    });
    wrap.append(topBar);

    const grid = make('div', 'ldg-lt-grid');
    const allMonthSet = new Set();
    const entries = Object.entries(studentsMap).map(([name, info]) => {
      const months = (info && info.months && typeof info.months === 'object') ? info.months : {};
      Object.keys(months).forEach(k => allMonthSet.add(k));
      const used = Math.round(Object.values(months).reduce((s, v) => s + num(v), 0) * 100) / 100;
      const total = num(info?.total);
      const remaining = Math.round((total - used) * 100) / 100;
      return {name, info: info || {}, months, used, total, remaining};
    });

    entries.forEach(({name, info, used, total, remaining}) => {
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
    wrap.append(grid);

    const sortedMonths = [...allMonthSet].sort();
    if (sortedMonths.length) {
      const mCard = make('div', 'ldg-card');
      mCard.append(make('h3', '', '📊 长期学员按月消耗明细'));
      const headers = [
        '学员',
        '方案',
        {label: '总课时', num: true},
        ...sortedMonths.map(ym => ({label: ym.slice(2), num: true})),
        {label: '累计消耗', num: true},
        {label: '剩余', num: true},
      ];
      const rows = entries.map(({name, info, months, used, total, remaining}) => [
        name,
        info.plan || '-',
        fmtHours(total),
        ...sortedMonths.map(ym => (months[ym] !== undefined ? fmtHours(months[ym]) : '-')),
        fmtHours(used),
        fmtHours(remaining),
      ]);
      mCard.append(renderResponsiveTable('长期学员按月消耗明细', headers, rows));
      if (Array.isArray(data.notes) && data.notes.length) {
        const ul = make('ul', 'ldg-lt-note');
        ul.style.paddingLeft = '18px';
        data.notes.forEach(n => ul.append(make('li', '', String(n))));
        mCard.append(ul);
      }
      wrap.append(mCard);
    }
  }

  function renderMonthlyBillingView(wrap) {
    if (!store.billing.length) {
      wrap.append(make('div', 'ldg-empty', '暂无已归档的月度课时记录。月末例行运行后会自动写入此处。'));
      return;
    }
    const cur = store.billing.find(m => m.year_month === selectedMonth) || store.billing[0];
    if (!cur) return;
    selectedMonth = cur.year_month;

    const selectMonth = ym => {
      if (ym === selectedMonth) return;
      selectedMonth = ym;
      billingTeacherFilter = '';
      billingSearchQuery = '';
      render();
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
    wrap.append(bar);

    const meta = cur.meta || {};
    const comm = meta.commission || {};
    const files = Array.isArray(cur.files) ? cur.files : [];
    const docs = files.filter(f => f.kind !== 'image');
    const imgs = files.filter(f => f.kind === 'image');
    const tBreakdown = Array.isArray(meta.teacher_breakdown) ? meta.teacher_breakdown : [];
    const sBreakdown = Array.isArray(meta.student_breakdown) ? meta.student_breakdown : [];
    const records = Array.isArray(meta.records) ? meta.records : [];

    if (comm.total || meta.hours || records.length) {
      const stats = make('div', 'ldg-stats');
      const addStat = (l, v, cls = '') => {
        const s = make('div', 'ldg-stat');
        s.append(make('span', 'ldg-stat-label', l), make('span', 'ldg-stat-val ' + cls, v));
        stats.append(s);
      };
      addStat('全月排课 / 课时', `${meta.rows ?? records.length} 节 · ${fmtHours(meta.hours ?? 0)}h`);
      if (comm.total) {
        addStat('Leo 总结算课时', `${fmtHours(comm.total)}h`, 'accent');
        addStat('提成课时 / 阶梯', `${fmtHours(comm.extra ?? 0)}h · 第 ${comm.tiers ?? 0} 档`, 'ok');
        addStat('当前余量 / 距下档', `余 ${fmtHours(comm.rem ?? 0)}h · 差 ${fmtHours(comm.gap ?? 0)}h`, num(comm.gap) > 0 && num(comm.gap) <= 10 ? 'warn' : '');
      } else {
        const tCount = tBreakdown.length || (Array.isArray(meta.teachers) ? meta.teachers.length : num(meta.teachers));
        addStat('任课老师数', `${tCount || '-'} 位`, 'accent');
        addStat('活跃学员数', `${sBreakdown.length || '-'} 位`, 'ok');
        addStat('永久云端附件', `${docs.length} 表 · ${imgs.length} 核对卡`);
      }
      wrap.append(stats);
    }

    const barBtnMap = new Map();
    const cardsSlot = make('div', 'ldg-rows-slot');
    cardsSlot.id = 'ldg-billing-cards-slot';
    const recordsSlot = make('div', 'ldg-rows-slot');
    recordsSlot.id = 'ldg-billing-records-slot';
    let teacherSelectEl = null;
    let clearFilterBtn = null;

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

    if (tBreakdown.length) {
      const card = make('div', 'ldg-card');
      const head = make('div', 'ldg-head');
      head.append(
        make('h3', '', '📊 老师课时分布（点击老师筛选下方核对卡与明细）'),
        make('span', 'ldg-sub', `共 ${tBreakdown.length} 位老师 · 合计 ${fmtHours(meta.hours ?? 0)}h`)
      );
      const list = make('div', 'ldg-bar-list');
      const maxHrs = Math.max(1, ...tBreakdown.map(t => num(t.total)));
      tBreakdown.forEach(t => {
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
        list.append(rowBtn);
      });
      card.append(head, list);
      wrap.append(card);
    }

    function renderCardsSection() {
      cardsSlot.textContent = '';
      if (!imgs.length) return;
      const shown = billingTeacherFilter
        ? imgs.filter(f => String(f.name || '').includes(billingTeacherFilter))
        : imgs;
      const card = make('div', 'ldg-card');
      const head = make('div', 'ldg-head');
      const hTitle = billingTeacherFilter
        ? `🪪 老师核对卡 · ${billingTeacherFilter}（${shown.length}/${imgs.length} 张）`
        : `🪪 老师课时核对卡（${imgs.length} 张 · 点击放大 / 一键下载原图）`;
      head.append(make('h3', '', hTitle));
      if (billingTeacherFilter) {
        const showAll = make('button', 'ldg-btn sm', '显示全部核对卡');
        showAll.type = 'button';
        showAll.onclick = () => { billingTeacherFilter = ''; syncTeacherFilterUI(); };
        head.append(showAll);
      }
      card.append(head);

      if (!shown.length) {
        card.append(make('div', 'ldg-empty', `本月暂无「${billingTeacherFilter}」对应的核对卡图片，可点击「显示全部核对卡」或「📤 补传/替换文件」。`));
        cardsSlot.append(card);
        return;
      }

      const grid = make('div', 'ldg-cards-grid');
      shown.forEach(f => {
        const item = make('div', 'ldg-card-img');
        const thumbBtn = make('button', 'ldg-card-thumb');
        thumbBtn.type = 'button';
        thumbBtn.setAttribute('aria-label', `放大预览 ${f.name}`);
        thumbBtn.onclick = () => openImageLightbox(f);
        const img = make('img');
        img.alt = f.name;
        img.loading = 'lazy';
        thumbBtn.append(img);

        const cap = make('span', '', f.name);
        const ops = make('div', 'ldg-card-ops');
        const zoomBtn = make('button', 'ldg-btn sm', '放大');
        zoomBtn.type = 'button';
        zoomBtn.onclick = () => openImageLightbox(f);
        const dlBtn = make('button', 'ldg-btn sm primary', '下载原图');
        dlBtn.type = 'button';
        dlBtn.onclick = () => void downloadSignedFile(f, dlBtn);
        const openRaw = make('button', 'ldg-btn sm', '打开原图');
        openRaw.type = 'button';
        openRaw.onclick = async () => {
          if (openRaw.disabled) return;
          openRaw.disabled = true;
          clearActionError();
          try {
            const u = await getSignedUrl(f.path);
            if (!u) throw new Error('获取签名图片链接失败');
            globalThis.open?.(u, '_blank', 'noopener,noreferrer');
          } catch (err) {
            showActionError('打开原图失败：' + String(err?.message || err || '请稍后重试'));
          } finally {
            openRaw.disabled = false;
          }
        };
        ops.append(zoomBtn, dlBtn, openRaw);
        item.append(thumbBtn, cap, ops);
        grid.append(item);
        void getSignedUrl(f.path).then(u => { if (u) img.src = u; }).catch(() => {});
      });
      card.append(grid);
      cardsSlot.append(card);
    }

    wrap.append(cardsSlot);
    renderCardsSection();

    function renderRecordsRows() {
      recordsSlot.textContent = '';
      if (!records.length) return;
      const needle = billingSearchQuery.trim().toLowerCase();
      const filtered = records.filter(r => {
        if (billingTeacherFilter && r.teacher !== billingTeacherFilter) return false;
        if (needle) {
          const hay = `${r.date || ''} ${r.weekday || ''} ${r.time || ''} ${r.teacher || ''} ${r.student || ''} ${r.subject || ''} ${r.kind || ''} ${r.location || ''} ${r.note || ''}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
      const totalHrs = Math.round(filtered.reduce((s, r) => s + num(r.hours), 0) * 100) / 100;
      const sub = make('div', 'ldg-subtotal');
      sub.append(
        make('span', '', `当前显示 ${filtered.length} / ${records.length} 节 · 合计 ${fmtHours(totalHrs)} 课时`),
        make('span', '', billingTeacherFilter ? `筛选老师：${billingTeacherFilter}` : (meta.master_file ? `数据来源：${meta.master_file}` : ''))
      );
      recordsSlot.append(sub);

      if (!filtered.length) {
        const empty = make('div', 'ldg-empty');
        empty.append(make('span', '', '没有匹配的课时记录。'));
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
        recordsSlot.append(empty);
        return;
      }

      const headers = ['日期', '时间', '讲师', '学生', '科目/班级', '类型', {label: '人数', num: true}, {label: '课时', num: true}, '地点/备注'];
      const rows = filtered.map(r => [
        r.weekday ? `${r.date} ${r.weekday.replace('星期', '周')}` : (r.date || '-'),
        r.time || '-',
        r.teacher || '-',
        r.student || '-',
        r.subject || '-',
        r.kind || '-',
        String(r.count ?? 1),
        fmtHours(r.hours),
        [r.location, r.note].filter(Boolean).join(' · ') || '-',
      ]);
      recordsSlot.append(renderResponsiveTable(`${cur.title || cur.year_month} 课时明细表`, headers, rows));
    }

    if (records.length) {
      const recCard = make('div', 'ldg-card');
      recCard.append(make('h3', '', `📋 在线课时明细表（${records.length} 节）`));
      const tBar = make('div', 'ldg-toolbar');
      teacherSelectEl = make('select', 'ldg-month-select');
      teacherSelectEl.id = 'ldg-billing-teacher';
      teacherSelectEl.setAttribute('aria-label', '按讲师筛选课时明细');
      const allOpt = make('option', '', '全部讲师');
      allOpt.value = '';
      teacherSelectEl.append(allOpt);
      const tNames = tBreakdown.length
        ? tBreakdown.map(t => t.teacher)
        : [...new Set(records.map(r => r.teacher).filter(Boolean))];
      tNames.forEach(tn => {
        const opt = make('option', '', tn);
        opt.value = tn;
        if (tn === billingTeacherFilter) opt.selected = true;
        teacherSelectEl.append(opt);
      });
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

      tBar.append(teacherSelectEl, q, clearFilterBtn);
      recCard.append(tBar, recordsSlot);
      wrap.append(recCard);
      renderRecordsRows();
    }

    if (docs.length) {
      const card = make('div', 'ldg-card');
      card.append(make('h3', '', `📎 原始 Excel 表格永久下载（${docs.length} 个文件）`));
      const row = make('div', 'ldg-files');
      docs.forEach(f => {
        const sz = fmtBytes(f.size);
        const btn = make('button', 'ldg-btn' + (f.is_master ? ' primary' : ''), `下载 ${f.name}${sz ? ` (${sz})` : ''}`);
        btn.type = 'button';
        btn.onclick = () => void downloadSignedFile(f, btn);
        row.append(btn);
      });
      card.append(row);
      wrap.append(card);
    }

    if (cur.summary_md) {
      const hasInteractive = tBreakdown.length > 0 || records.length > 0;
      const summaryDetails = make('details', 'ldg-card ldg-summary-details');
      summaryDetails.open = !hasInteractive;
      const sumTitle = make('summary', '', `📝 月度核对汇总报告 · ${cur.title || cur.year_month}`);
      summaryDetails.append(sumTitle, renderMarkdownNode(cur.summary_md, cur.title || cur.year_month));
      wrap.append(summaryDetails);
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
    const backupTag = make('span', 'ldg-backup-tag', '双保险永久保留：Supabase 私有云 + 私有 GitHub 仓库');
    subBar.append(subPills, backupTag);
    wrap.append(subBar);

    if (billingView === 'longterm') {
      renderLongTermView(wrap);
    } else {
      renderMonthlyBillingView(wrap);
    }
  }

  function renderLeaveTab(wrap) {
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
    wrap.append(stats);

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
    bar.append(pills, q, addBtn);
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

      const headers = ['事项', '产生日期', {label: '产生', num: true}, {label: '已休', num: true}, {label: '剩余', num: true}, '状态', '调休去向', '备注', '操作'];
      const rows = filtered.map(r => {
        const rem = Math.round((num(r.produced_days) - num(r.used_days)) * 100) / 100;
        const badge = make('span', 'ldg-badge ' + (rem > 0 ? 'warn' : 'ok'), rem > 0 ? '待调休' : '已休完');
        const ops = make('div', 'ops');
        if (rem > 0) {
          const doneBtn = make('button', 'ldg-btn sm', '标已休'); doneBtn.type = 'button';
          doneBtn.onclick = async () => {
            if (doneBtn.disabled) return;
            const c = client();
            if (!c) { showActionError('尚未登录云端，请先登录'); return; }
            doneBtn.disabled = true;
            clearActionError();
            try {
              const res = await c.from('wayon_leave_ledger').update({used_days: r.produced_days, status: '已休完'}).eq('id', r.id);
              if (res?.error) throw res.error;
              await loadAll({force: true});
            } catch (err) {
              showActionError('标记已休失败：' + String(err?.message || err || '请稍后重试'));
            } finally {
              doneBtn.disabled = false;
            }
          };
          ops.append(doneBtn);
        }
        const ed = make('button', 'ldg-btn sm', '编辑'); ed.type = 'button'; ed.onclick = () => openLeaveDialog(r);
        const del = make('button', 'ldg-btn sm danger', '删'); del.type = 'button';
        del.onclick = () => openConfirmDialog('删除调休记录', `确认删除「${r.item}」？`, async () => {
          const c = client(); if (!c) throw new Error('尚未登录云端');
          const res = await c.from('wayon_leave_ledger').delete().eq('id', r.id);
          if (res?.error) throw res.error;
          await loadAll({force: true});
        });
        ops.append(ed, del);
        return [r.item, r.produced_date || '-', fmtDays(r.produced_days), fmtDays(r.used_days), fmtDays(rem), badge, r.destination || '-', r.note || '-', ops];
      });
      rowsSlot.append(renderResponsiveTable('Leo 调休台账', headers, rows));
    }

    renderLeaveRows();
  }

  function renderSalaryTab(wrap) {
    let sumGross = 0, sumNet = 0, sumExt = 0, sumTot = 0;
    store.salary.forEach(r => {
      const g = num(r.gross_salary), net = g - num(r.tax) - num(r.special_deduction), ext = num(r.external_income);
      sumGross += g; sumNet += net; sumExt += ext; sumTot += net + ext;
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
    wrap.append(stats);

    const bar = make('div', 'ldg-toolbar');
    const maskBtn = make('button', 'ldg-btn', salaryMasked ? '👁 显示金额' : '🙈 隐藏金额');
    maskBtn.type = 'button';
    maskBtn.onclick = () => { salaryMasked = !salaryMasked; render(); };
    const addBtn = make('button', 'ldg-btn primary', '＋ 记一月工资');
    addBtn.type = 'button'; addBtn.onclick = () => openSalaryDialog(null);
    bar.append(maskBtn, addBtn);
    wrap.append(bar);

    if (!store.salary.length) {
      wrap.append(make('div', 'ldg-empty', '暂无工资发放记录，可点击上方「＋ 记一月工资」添加。'));
      return;
    }

    const headers = ['工作月份', '发薪日', {label: '税前', num: true}, {label: '扣税', num: true}, {label: '专项扣除', num: true}, {label: '实际发放', num: true}, {label: '系统外', num: true}, {label: '总计收入', num: true}, '操作'];
    const rows = store.salary.map(r => {
      const net = num(r.gross_salary) - num(r.tax) - num(r.special_deduction);
      const tot = net + num(r.external_income);
      const ops = make('div', 'ops');
      const ed = make('button', 'ldg-btn sm', '编辑'); ed.type = 'button'; ed.onclick = () => openSalaryDialog(r);
      const del = make('button', 'ldg-btn sm danger', '删'); del.type = 'button';
      del.onclick = () => openConfirmDialog('删除工资记录', `确认删除「${r.work_month}」工资记录？`, async () => {
        const c = client(); if (!c) throw new Error('尚未登录云端');
        const res = await c.from('wayon_salary_records').delete().eq('id', r.id);
        if (res?.error) throw res.error;
        await loadAll({force: true});
      });
      ops.append(ed, del);
      return [
        r.work_month, r.pay_date || '-',
        fmtMoney(r.gross_salary, salaryMasked),
        fmtMoney(r.tax, salaryMasked),
        fmtMoney(r.special_deduction, salaryMasked),
        fmtMoney(net, salaryMasked),
        fmtMoney(r.external_income, salaryMasked),
        fmtMoney(tot, salaryMasked),
        ops,
      ];
    });
    wrap.append(renderResponsiveTable('工资发放记录', headers, rows));
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
    bar.append(pills, q, addBtn);
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
      const headers = ['姓名', '状态', '课程', '形式', '班级/备忘录名', '备注', '操作'];
      const rows = filtered.map(r => {
        const badge = make('span', 'ldg-badge ' + (r.status === '在读' ? 'ok' : 'muted'), r.status || '在读');
        const ops = make('div', 'ops');
        const ed = make('button', 'ldg-btn sm', '编辑'); ed.type = 'button'; ed.onclick = () => openProfileDialog(r);
        const del = make('button', 'ldg-btn sm danger', '删'); del.type = 'button';
        del.onclick = () => openConfirmDialog('删除学员档案', `确认删除学员「${r.name}」？`, async () => {
          const c = client(); if (!c) throw new Error('尚未登录云端');
          const res = await c.from('wayon_student_profiles').delete().eq('id', r.id);
          if (res?.error) throw res.error;
          await loadAll({force: true});
        });
        ops.append(ed, del);
        return [r.name, badge, r.course || '-', r.form || '-', r.memo_name || '-', r.note || '-', ops];
      });
      rowsSlot.append(renderResponsiveTable('学员录入档案', headers, rows));
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
    if (!unlocked || !lockRecord) return;
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', '修改台账二级密码'); h.id = 'ldg-dialog-title';
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
        showActionInfo('台账二级密码已更新');
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
    const dlg = prepareModal('closerequest');
    const form = make('form', 'ldg-dialog-body');
    form.noValidate = true;
    const h = make('h3', '', '重置台账二级密码'); h.id = 'ldg-dialog-title';
    const desc = make('p', '', '为保障安全，请先输入当前工作台主账号的登录密码验证身份，再设置新的台账二级密码。');
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
      id: 'ldg-rst-new', name: 'new_ledger_pin', label: '新台账二级密码',
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
        unlocked = true;
        lockState = 'unlocked';
        lockNotice = '';
        lockError = '';
        actionInfo = '台账二级密码已重置并解锁';
        startIdleWatcher();
        render();
        void loadAll({force: true});
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
    const h = make('h3', '', '🔐 首次使用：设置台账二级密码'); h.id = 'ldg-setup-title';
    const p = make('p', '', '为避免旁人误点看到个人课时、调休或工资明细，进入台账前需先通过二级密码验证。未解锁前不会拉取任何台账数据；切走页面或闲置 10 分钟后自动清空并重锁。');
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
        unlocked = true;
        lockState = 'unlocked';
        lockNotice = '';
        actionInfo = '台账二级密码已设置并生效';
        startIdleWatcher();
        render();
        void loadAll({force: true});
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
    const h = make('h3', '', '🔒 个人台账已锁定'); h.id = 'ldg-unlock-title';
    const p = make('p', '', '输入二级密码后才会从云端加载个人课时、调休、工资与学员档案；切回工作台或闲置 10 分钟后自动清空重锁。');
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
      id: 'ldg-unlock-pin', name: 'ledger_pin', label: '台账二级密码',
      autocomplete: 'off', placeholder: '输入二级密码解锁', enterkeyhint: 'done',
      minLength: 1, validator: v => String(v || '').trim() ? '' : '请输入二级密码',
    });
    const waitInit = remainingLockSeconds(lockRecord);
    const errEl = make('p', 'ldg-form-err', waitInit > 0 ? `输错次数过多，请 ${waitInit} 秒后再试，或使用下方账号密码重置` : lockError);
    errEl.setAttribute('role', 'alert');

    const actions = make('div', 'ldg-lock-actions');
    const submit = make('button', 'ldg-btn primary', '解锁台账'); submit.type = 'submit';
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
        void checkLockStatus();
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
          unlocked = true;
          lockState = 'unlocked';
          lockNotice = '';
          lockError = '';
          startIdleWatcher();
          render();
          void loadAll({force: true});
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
        submit.textContent = '解锁台账';
      }
    };

    card.append(form, resetLink);
    container.append(card);
    requestAnimationFrame(() => pinF.input.focus?.());
  }

  function render() {
    if (!root) return;
    root.textContent = '';

    if (lockState === 'signedout') {
      const head = make('div', 'ldg-head');
      const hl = make('div', 'ldg-head-left');
      hl.append(make('h2', '', '个人台账'), make('span', 'ldg-sub', '入口已收纳至「设置与账户」'));
      const exitBtn = make('button', 'ldg-btn sm', '返回工作台'); exitBtn.type = 'button'; exitBtn.onclick = () => closePanel();
      head.append(hl, exitBtn);
      root.append(head);

      const lock = make('div', 'ldg-lock');
      lock.append(make('h3', '', '🔒 需要本人云端登录'));
      lock.append(make('p', '', '课时汇总、调休台账、工资记录和学员档案全部受本人 RLS 与二级密码双重保护，公开页面不包含任何私有数据。请先在左下角「设置与账户」登录。'));
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

    if (lockState === 'checking' || lockState === 'idle') {
      const head = make('div', 'ldg-head');
      head.append(make('h2', '', '个人台账'));
      const exitBtn = make('button', 'ldg-btn sm', '返回工作台'); exitBtn.type = 'button'; exitBtn.onclick = () => closePanel();
      head.append(exitBtn);
      root.append(head, make('div', 'ldg-empty', '正在核验台账锁状态…'));
      return;
    }

    if (lockState === 'error') {
      const head = make('div', 'ldg-head');
      head.append(make('h2', '', '个人台账'));
      const exitBtn = make('button', 'ldg-btn sm', '返回工作台'); exitBtn.type = 'button'; exitBtn.onclick = () => closePanel();
      head.append(exitBtn);
      const err = make('div', 'ldg-lock');
      err.append(make('h3', '', '⚠️ 无法核验台账锁状态'));
      err.append(make('p', '', '为确保安全，未完成校验前不会加载任何数据：' + loadError));
      const acts = make('div', 'ldg-lock-actions');
      const retry = make('button', 'ldg-btn primary', '重试'); retry.type = 'button'; retry.onclick = () => void checkLockStatus();
      const back = make('button', 'ldg-btn', '返回工作台'); back.type = 'button'; back.onclick = () => closePanel();
      acts.append(retry, back);
      err.append(acts);
      root.append(head, err);
      return;
    }

    if (lockState === 'setup') {
      renderSetupView(root);
      return;
    }

    if (!unlocked || lockState !== 'unlocked') {
      renderLockView(root);
      return;
    }

    const head = make('div', 'ldg-head');
    const hl = make('div', 'ldg-head-left');
    hl.append(make('h2', '', '个人台账'), make('span', 'ldg-sub', '已解锁 · 切走或闲置 10 分钟自动锁定'));
    const hActs = make('div', 'ldg-head-actions');
    const lockBtn = make('button', 'ldg-btn sm', '🔒 锁定'); lockBtn.id = 'ldg-lock-btn'; lockBtn.type = 'button';
    lockBtn.onclick = () => lockPanel({keepOpen: true, reason: '台账已手动锁定，本页内存数据已清空'});
    const chgBtn = make('button', 'ldg-btn sm', '改密码'); chgBtn.id = 'ldg-change-pin-btn'; chgBtn.type = 'button';
    chgBtn.onclick = () => openChangePinDialog();
    const refreshBtn = make('button', 'ldg-btn sm', '刷新'); refreshBtn.type = 'button'; refreshBtn.onclick = () => void loadAll({force: true});
    const exitBtn = make('button', 'ldg-btn sm', '返回'); exitBtn.id = 'ldg-exit-btn'; exitBtn.type = 'button'; exitBtn.onclick = () => closePanel();
    hActs.append(lockBtn, chgBtn, refreshBtn, exitBtn);
    head.append(hl, hActs);
    root.append(head);

    const okBanner = make('div', 'ldg-banner-ok');
    okBanner.setAttribute('role', 'status');
    okBanner.hidden = !actionInfo;
    const okText = make('span', 'ldg-banner-ok-text', actionInfo);
    const okClose = make('button', 'ldg-btn sm', '关闭'); okClose.type = 'button'; okClose.onclick = clearActionInfo;
    okBanner.append(okText, okClose);
    root.append(okBanner);

    const errBanner = make('div', 'ldg-banner-err');
    errBanner.setAttribute('role', 'alert');
    errBanner.hidden = !actionError;
    const errText = make('span', 'ldg-banner-err-text', actionError);
    const errClose = make('button', 'ldg-btn sm', '关闭'); errClose.type = 'button'; errClose.onclick = clearActionError;
    errBanner.append(errText, errClose);
    root.append(errBanner);

    if (loadState === 'loading' || loadState === 'idle') {
      root.append(make('div', 'ldg-empty', '正在从云端加载个人台账…'));
      return;
    }

    if (loadState === 'error') {
      const err = make('div', 'ldg-lock');
      err.append(make('p', '', '加载失败：' + loadError));
      const retry = make('button', 'ldg-btn primary', '重试'); retry.type = 'button'; retry.onclick = () => void loadAll({force: true});
      err.append(retry);
      root.append(err);
      return;
    }

    const tablist = make('div', 'ldg-tablist');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('focusgroup', 'tablist nomemory');
    tablist.setAttribute('aria-label', '私有台账分类');
    TABS.forEach(t => {
      const btn = make('button', 'ldg-tab', t.label);
      btn.type = 'button';
      btn.id = 'ldg-tab-' + t.id;
      btn.setAttribute('role', 'tab');
      const sel = t.id === activeTab;
      btn.setAttribute('aria-selected', String(sel));
      btn.tabIndex = sel ? 0 : -1;
      if (sel) btn.setAttribute('focusgroupstart', '');
      btn.onclick = () => {
        touchActivity();
        activeTab = t.id;
        render();
        requestAnimationFrame(() => {
          const el = document.getElementById('ldg-tab-' + t.id);
          el?.scrollIntoView?.({block: 'nearest', inline: 'nearest', container: 'nearest'});
        });
      };
      btn.onkeydown = e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        touchActivity();
        const idx = TABS.findIndex(x => x.id === t.id);
        const next = TABS[(idx + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length];
        activeTab = next.id;
        render();
        requestAnimationFrame(() => document.getElementById('ldg-tab-' + next.id)?.focus());
      };
      tablist.append(btn);
    });
    root.append(tablist);

    TABS.forEach(t => {
      const panel = make('div');
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'ldg-tab-' + t.id);
      const isSelected = t.id === activeTab;
      if (!isSelected) {
        panel.hidden = 'until-found';
      }
      panel.addEventListener('beforematch', () => {
        if (activeTab !== t.id) { activeTab = t.id; render(); }
      });
      if (isSelected) {
        const inner = make('div', 'ldg-panel-wrap');
        if (t.id === 'billing') renderBillingTab(inner);
        else if (t.id === 'leave') renderLeaveTab(inner);
        else if (t.id === 'salary') renderSalaryTab(inner);
        else if (t.id === 'profiles') renderProfilesTab(inner);
        panel.append(inner);
      }
      root.append(panel);
    });
  }

  function closePanel() {
    if (!open && !document.body.dataset.ledgerOpen && !unlocked) return;
    open = false;
    lockAndClear({nextState: lockRecord ? 'locked' : 'idle', reason: ''});
    if (root) {
      root.textContent = '';
      root.hidden = true;
    }
    delete document.body.dataset.ledgerOpen;
    if (globalThis.location?.hash === '#ledger' && typeof globalThis.history?.replaceState === 'function') {
      try {
        globalThis.history.replaceState(null, '', (globalThis.location.pathname || '') + (globalThis.location.search || ''));
      } catch {}
    }
  }

  function openPanel() {
    mount();
    open = true;
    document.body.dataset.ledgerOpen = 'true';
    globalThis.wayonMemo?.close?.();
    globalThis.wayonMockExams?.close?.();
    globalThis.wayonAircon?.close?.();
    globalThis.wayonVocab?.close?.();
    if (root) root.hidden = false;
    if (unlocked) {
      touchActivity();
      startIdleWatcher();
      render();
      if (loadState !== 'ready') void loadAll();
    } else {
      render();
      void checkLockStatus();
    }
  }

  function mount() {
    if (mounting) return;
    mounting = true;
    try {
      const list = document.getElementById('list');
      if (!list) return;
      if (!root) {
        root = make('section');
        root.id = 'ledger-panel';
        root.hidden = !open;
        root.setAttribute('aria-label', '个人台账');
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
        lockRecord = null;
        lockAndClear({nextState: 'signedout'});
        if (open) render();
        return;
      }
      if (event === 'SIGNED_IN') {
        if (open && !unlocked) void checkLockStatus();
      }
    });
    return true;
  }

  function checkHash() {
    if (globalThis.location?.hash === '#ledger') {
      openPanel();
    }
  }

  function needsRemount(records) {
    if (!root || !root.parentNode) return true;
    if (!Array.isArray(records) || !records.length) return true;
    const listParent = document.getElementById('list')?.parentNode || null;
    for (const r of records) {
      const t = r?.target;
      if (!t) continue;
      if (root && (t === root || (typeof root.contains === 'function' && root.contains(t)))) continue;
      if (modal && (t === modal || (typeof modal.contains === 'function' && modal.contains(t)))) continue;
      if (t === listParent || t === document.body) return true;
    }
    return false;
  }

  function start() {
    mount();
    document.addEventListener('click', e => {
      const nav = e.target?.closest?.('#tabs button');
      if (open && nav) closePanel();
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
        if (open && !unlocked && (lockState === 'signedout' || lockState === 'idle')) void checkLockStatus();
        else if (open && unlocked && loadState !== 'ready') void loadAll();
      }
    }, 1000);
    addEventListener('wayon-refresh-ready', () => {
      bindAuth();
      if (open && !unlocked && (lockState === 'signedout' || lockState === 'idle')) void checkLockStatus();
      else if (open && unlocked && loadState !== 'ready') void loadAll();
    });
    addEventListener('hashchange', checkHash);
    bindAuth();
    checkHash();
  }

  globalThis.wayonLedger = {
    open: openPanel,
    close: closePanel,
    lock: (reason) => lockPanel({keepOpen: open, reason: reason || '台账已手动锁定，本页内存数据已清空'}),
    isOpen: () => open,
    isUnlocked: () => unlocked,
    checkIdleTimeout,
    parseMarkdownBlocks,
    renderMarkdownNode,
    loadAll,
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
