// 个人台账与月度课时 (Owner-only private panel, replacing Notion).
// Zero private data lives in this file or any public page; everything is loaded from Supabase
// under strict owner-only RLS after sign-in, with signed URLs for private Storage downloads.
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
  const NAV_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z M4 18.5A2.5 2.5 0 0 1 6.5 16H20 M9 8h6 M9 12h4"/></svg>';

  const TABS = [
    {id: 'billing', label: '课时与账单'},
    {id: 'leave', label: '调休台账'},
    {id: 'salary', label: '工资记录'},
    {id: 'profiles', label: '学员与校历'},
  ];

  let open = false;
  let activeTab = 'billing';
  let root = null;
  let modal = null;
  let authBoundClient = null;
  let loading = false;
  let reloadQueued = false;
  let reloadForce = false;
  let loadPromise = null;
  let deferredRender = false;
  let loadState = 'idle'; // idle | loading | ready | signedout | error
  let loadError = '';
  let actionError = '';
  let salaryMasked = true;
  let selectedMonth = '';
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
    #nav-ledger:before{display:none!important}#nav-ledger svg{width:19px;height:19px;flex:none}
    body[data-ledger-open] #tabs button:not(#nav-ledger){background:transparent!important;color:var(--fg-secondary)!important}
    body[data-ledger-open] #list,body[data-ledger-open] .workspace-top-bar,body[data-ledger-open] .workspace-sub-bar,body[data-ledger-open] #aircon-panel,body[data-ledger-open] #memo-panel,body[data-ledger-open] #feedback-panel,body[data-ledger-open] #mocks-panel,body[data-ledger-open] .sidebar-footer .bar{display:none!important}
    body[data-aircon-open] #ledger-panel,body[data-memo-open] #ledger-panel,body[data-feedback-open] #ledger-panel,body[data-mocks-open] #ledger-panel{display:none!important}
    #ledger-panel{display:flex;flex-direction:column;gap:14px;width:100%;min-width:0;padding-bottom:32px}
    #ledger-panel[hidden]{display:none!important}
    .ldg-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .ldg-head-left{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
    .ldg-head h2{margin:0;font-size:22px;font-weight:650;letter-spacing:-.02em}
    .ldg-sub{font-size:12.5px;color:var(--muted,#6e6e73)}
    .ldg-banner-err{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-radius:12px;border:1px solid var(--bad-border,#f1c8c5);background:var(--bad-bg,#fff1f0);color:var(--bad,#d93025);font-size:13px;line-height:1.45}
    .ldg-banner-err[hidden]{display:none!important}
    .ldg-tablist{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--line,rgba(30,30,40,.09));padding-bottom:2px}
    .ldg-tablist::-webkit-scrollbar{display:none}
    .ldg-tab{position:relative;flex:none;border:0;background:transparent;color:var(--fg-secondary,#515156);padding:10px 14px;font-size:14px;font-weight:500;white-space:nowrap;cursor:pointer;border-radius:10px 10px 0 0}
    .ldg-tab:hover{color:var(--fg,#1d1d1f);background:var(--code-bg,rgba(118,118,128,.08))}
    .ldg-tab[aria-selected="true"]{color:var(--accent,#0071e3)}
    .ldg-tab[aria-selected="true"]::after{content:"";position:absolute;inset:auto 10px 0;border-block-end:2.5px solid var(--accent,#0071e3)}
    .ldg-panel-wrap,.ldg-rows-slot{display:flex;flex-direction:column;gap:14px;min-width:0}
    .ldg-lock{padding:28px 20px;border-radius:16px;background:var(--card,#fff);border:1px solid var(--line,rgba(30,30,40,.09));text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px}
    .ldg-lock p{margin:0;color:var(--fg-secondary,#515156);font-size:14px;max-width:460px}
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
    .ldg-badge.muted{background:var(--code-bg,#f5f5f7);color:var(--muted,#6e6e73)}
    .ldg-files{display:flex;gap:8px;flex-wrap:wrap}
    .ldg-cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
    .ldg-card-img{display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:12px;border:1px solid var(--line,rgba(30,30,40,.09));background:var(--code-bg,#f5f5f7)}
    .ldg-card-img img{width:100%;height:auto;border-radius:8px;display:block}
    .ldg-card-img span{font-size:12px;color:var(--fg-secondary,#515156);word-break:break-all}
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
      .ldg-search,.ldg-field input,.ldg-field select,.ldg-field textarea{font-size:16px;min-height:44px}
      .ldg-field-grid{grid-template-columns:1fr}
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
    signedUrls.clear();
    actionError = '';
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
    }
    document.body.append(modal);
    return modal;
  }

  function prepareModal(closedBy = 'closerequest') {
    const dlg = ensureModal();
    dlg.onclose = null;
    if (dlg.open) dlg.close();
    dlg.returnValue = '';
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
      const c = client();
      if (!c) {
        clearPrivateStore();
        loadState = 'signedout';
        if (open) renderOrDefer(force);
        break;
      }
      loading = true;
      if (loadState === 'idle') { loadState = 'loading'; if (open) renderOrDefer(force); }
      try {
        const {data: sess, error: sessErr} = await c.auth.getSession();
        if (sessErr) throw sessErr;
        if (!sess?.session) {
          clearPrivateStore();
          loadState = 'signedout';
        } else {
          const [bRes, lRes, sRes, pRes, dRes] = await Promise.all([
            c.from('wayon_billing_months').select('*').order('year_month', {ascending: false}),
            c.from('wayon_leave_ledger').select('*').order('seq', {ascending: true, nullsFirst: false}).order('created_at', {ascending: true}),
            c.from('wayon_salary_records').select('*').order('work_month', {ascending: false}),
            c.from('wayon_student_profiles').select('*').order('name', {ascending: true}),
            c.from('wayon_reference_docs').select('*').order('updated_at', {ascending: false}),
          ]);
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
        loadState = 'error';
        loadError = String(e?.message || e || '加载失败');
      } finally {
        loading = false;
        if (open) renderOrDefer(force);
      }
    } while (reloadQueued);
    loadPromise = null;
  }

  async function getSignedUrl(path) {
    const cached = signedUrls.get(path);
    if (cached && cached.exp > Date.now()) return cached.url;
    const c = client();
    if (!c) return null;
    const {data, error} = await c.storage.from('wayon-billing').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return null;
    signedUrls.set(path, {url: data.signedUrl, exp: Date.now() + 240_000});
    return data.signedUrl;
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

  function renderBillingTab(wrap) {
    if (!store.billing.length) {
      wrap.append(make('div', 'ldg-empty', '暂无已归档的月度课时记录。月末例行运行后会自动写入此处。'));
      return;
    }
    const bar = make('div', 'ldg-toolbar');
    const pills = make('div', 'ldg-pills');
    store.billing.forEach(m => {
      const b = make('button', 'ldg-pill' + (m.year_month === selectedMonth ? ' on' : ''), m.title || m.year_month);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(m.year_month === selectedMonth));
      b.onclick = () => { selectedMonth = m.year_month; render(); };
      pills.append(b);
    });
    bar.append(pills);
    wrap.append(bar);

    const cur = store.billing.find(m => m.year_month === selectedMonth) || store.billing[0];
    if (!cur) return;
    const comm = cur.meta?.commission || {};
    if (comm.total || cur.meta?.hours) {
      const stats = make('div', 'ldg-stats');
      const addStat = (l, v, cls = '') => {
        const s = make('div', 'ldg-stat');
        s.append(make('span', 'ldg-stat-label', l), make('span', 'ldg-stat-val ' + cls, v));
        stats.append(s);
      };
      addStat('全月排课 / 课时', `${cur.meta?.rows ?? '-'} 节 · ${cur.meta?.hours ?? '-'}h`);
      addStat('Leo 总结算课时', `${comm.total ?? '-'}h`, 'accent');
      addStat('提成课时 / 阶梯', `${comm.extra ?? '-'}h · 第 ${comm.tiers ?? 0} 档`, 'ok');
      addStat('当前余量 / 距下档', `余 ${comm.rem ?? 0}h · 差 ${comm.gap ?? 0}h`, num(comm.gap) > 0 && num(comm.gap) <= 10 ? 'warn' : '');
      wrap.append(stats);
    }

    const files = Array.isArray(cur.files) ? cur.files : [];
    const docs = files.filter(f => f.kind !== 'image');
    const imgs = files.filter(f => f.kind === 'image');
    if (docs.length) {
      const card = make('div', 'ldg-card');
      card.append(make('h3', '', '📎 Excel 表格下载'));
      const row = make('div', 'ldg-files');
      docs.forEach(f => {
        const btn = make('button', 'ldg-btn', '下载 ' + f.name);
        btn.type = 'button';
        btn.onclick = async () => {
          if (btn.disabled) return;
          btn.disabled = true;
          clearActionError();
          try {
            const u = await getSignedUrl(f.path);
            if (!u) throw new Error('获取签名下载链接失败');
            const a = make('a'); a.href = u; a.download = f.name; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click();
          } catch (err) {
            showActionError('下载失败：' + String(err?.message || err || '请稍后重试'));
          } finally {
            btn.disabled = false;
          }
        };
        row.append(btn);
      });
      card.append(row);
      wrap.append(card);
    }
    if (imgs.length) {
      const card = make('div', 'ldg-card');
      card.append(make('h3', '', '🪪 老师核对卡（点击预览/长按保存）'));
      const grid = make('div', 'ldg-cards-grid');
      imgs.forEach(f => {
        const item = make('div', 'ldg-card-img');
        const img = make('img'); img.alt = f.name; img.loading = 'lazy';
        const cap = make('span', '', f.name);
        const dl = make('button', 'ldg-btn sm', '打开原图'); dl.type = 'button';
        dl.onclick = async () => {
          if (dl.disabled) return;
          dl.disabled = true;
          clearActionError();
          try {
            const u = await getSignedUrl(f.path);
            if (!u) throw new Error('获取签名图片链接失败');
            globalThis.open?.(u, '_blank', 'noopener,noreferrer');
          } catch (err) {
            showActionError('打开原图失败：' + String(err?.message || err || '请稍后重试'));
          } finally {
            dl.disabled = false;
          }
        };
        item.append(img, cap, dl);
        grid.append(item);
        void getSignedUrl(f.path).then(u => { if (u) img.src = u; }).catch(() => {});
      });
      card.append(grid);
      wrap.append(card);
    }

    const summaryCard = make('div', 'ldg-card');
    summaryCard.append(renderMarkdownNode(cur.summary_md, cur.title || cur.year_month));
    wrap.append(summaryCard);
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

    if (store.docs.length) {
      store.docs.forEach(doc => {
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

  function render() {
    if (!root) return;
    root.textContent = '';
    const head = make('div', 'ldg-head');
    const hl = make('div', 'ldg-head-left');
    hl.append(make('h2', '', '个人台账'), make('span', 'ldg-sub', '仅本人登录后可见 · 数据存 Supabase 私有表与私有 GitHub 仓库'));
    const refreshBtn = make('button', 'ldg-btn sm', '刷新'); refreshBtn.type = 'button'; refreshBtn.onclick = () => void loadAll({force: true});
    head.append(hl, refreshBtn);
    root.append(head);

    const errBanner = make('div', 'ldg-banner-err');
    errBanner.setAttribute('role', 'alert');
    errBanner.hidden = !actionError;
    const errText = make('span', 'ldg-banner-err-text', actionError);
    const errClose = make('button', 'ldg-btn sm', '关闭'); errClose.type = 'button'; errClose.onclick = clearActionError;
    errBanner.append(errText, errClose);
    root.append(errBanner);

    if (loadState === 'signedout') {
      const lock = make('div', 'ldg-lock');
      lock.append(make('h3', '', '🔒 需要本人云端登录'));
      lock.append(make('p', '', '课时汇总、调休台账、工资记录和学员档案全部受本人 RLS 权限保护，公开页面不包含任何私有数据。请先在左下角「设置与账户」登录。'));
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
      lock.append(btn);
      root.append(lock);
      return;
    }

    if (loadState === 'loading') {
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
    if (!open && !document.body.dataset.ledgerOpen) return;
    open = false;
    if (modal?.open) {
      modal.onclose = null;
      modal.close();
    }
    if (root) root.hidden = true;
    delete document.body.dataset.ledgerOpen;
    const b = document.getElementById('nav-ledger');
    b?.classList.remove('on');
    b?.setAttribute('aria-pressed', 'false');
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
    const b = document.getElementById('nav-ledger');
    if (b) {
      b.classList.add('on');
      b.setAttribute('aria-pressed', 'true');
    }
    render();
    void loadAll();
  }

  function mount() {
    if (mounting) return;
    mounting = true;
    try {
      const tabs = document.getElementById('tabs'), list = document.getElementById('list');
      if (!tabs || !list) return;
      if (!root) {
        root = make('section');
        root.id = 'ledger-panel';
        root.hidden = !open;
        root.setAttribute('aria-label', '个人台账');
        root.addEventListener('focusout', () => setTimeout(flushDeferredRender, 0));
        list.before(root);
      } else if (!root.parentNode) {
        list.before(root);
      }
      const notice = list.parentNode && [...list.parentNode.children].find(e => e.classList?.contains('wayon-sync-notice'));
      if (notice && typeof root.compareDocumentPosition === 'function' && (root.compareDocumentPosition(notice) & 4)) {
        notice.after(root);
      }
      let b = document.getElementById('nav-ledger');
      const mocks = document.getElementById('nav-mocks');
      if (!b) {
        b = make('button', 'wayon-icon-control' + (open ? ' on' : ''));
        b.id = 'nav-ledger';
        b.type = 'button';
        b.title = '个人台账与月度课时';
        b.setAttribute('aria-label', '个人台账');
        b.setAttribute('aria-pressed', String(open));
        b.innerHTML = NAV_ICON;
        b.onclick = () => openPanel();
        if (mocks && mocks.parentNode === tabs) mocks.after(b);
        else tabs.append(b);
      } else {
        if (open && !b.classList.contains('on')) {
          b.classList.add('on');
          b.setAttribute('aria-pressed', 'true');
        } else if (!open && b.classList.contains('on')) {
          b.classList.remove('on');
          b.setAttribute('aria-pressed', 'false');
        }
        if (mocks && mocks.parentNode === tabs && b.parentNode === tabs && typeof b.compareDocumentPosition === 'function' && (b.compareDocumentPosition(mocks) & 4)) {
          mocks.after(b);
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
        clearPrivateStore();
        loadState = 'signedout';
        if (modal?.open) {
          modal.onclose = null;
          modal.close();
        }
        if (open) render();
        return;
      }
      if (event === 'SIGNED_IN') {
        if (open) void loadAll();
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
    if (!root || !root.parentNode || !document.getElementById('nav-ledger')) return true;
    if (!Array.isArray(records) || !records.length) return true;
    const tabs = document.getElementById('tabs');
    const listParent = document.getElementById('list')?.parentNode || null;
    for (const r of records) {
      const t = r?.target;
      if (!t) continue;
      if (root && (t === root || (typeof root.contains === 'function' && root.contains(t)))) continue;
      if (modal && (t === modal || (typeof modal.contains === 'function' && modal.contains(t)))) continue;
      if (t === tabs || t === listParent || t === document.body) return true;
    }
    return false;
  }

  function start() {
    mount();
    document.addEventListener('click', e => {
      const nav = e.target?.closest?.('#tabs button');
      if (open && nav && nav.id !== 'nav-ledger') closePanel();
    }, true);
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
        if (open && loadState !== 'ready') void loadAll();
      }
    }, 1000);
    addEventListener('wayon-refresh-ready', () => {
      bindAuth();
      if (open && loadState !== 'ready') void loadAll();
    });
    addEventListener('hashchange', checkHash);
    bindAuth();
    checkHash();
  }

  globalThis.wayonLedger = {
    open: openPanel,
    close: closePanel,
    isOpen: () => open,
    parseMarkdownBlocks,
    renderMarkdownNode,
    loadAll,
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
