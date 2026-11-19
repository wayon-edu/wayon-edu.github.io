// 入学模考入口: lazy-mounted standalone exam catalog inside an isolated iframe,
// with a one-click colleague share link and zero interference from workbench sync/translation.
(() => {
  if (globalThis.wayonMockExams || typeof document === 'undefined') return;
  const STAMP = '20261119-02';
  const IFRAME_SRC = './mock-exams.html?embed=1&v=' + STAMP;
  const MIN_FRAME_HEIGHT = 360;
  const MAX_FRAME_HEIGHT = 50000;
  const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="mocks-check-path" d="M5 13l4 4L19 7"/></svg>';
  const NAV_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10L12 5 2 10l10 5 10-5z M6 12v5c0 1.6 2.7 3 6 3s6-1.4 6-3v-5 M22 10v5"/></svg>';
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const shareUrl = () => {
    try {
      const base = globalThis.location?.href;
      if (base && /^https?:|^file:/i.test(base)) return new URL('./mock-exams.html', base).href;
    } catch {}
    return 'https://wayon-edu.github.io/mock-exams.html';
  };

  let open = false, root = null, frame = null, fallbackBox = null, fallbackInput = null;
  let mountObserver = null, mounting = false, copyTimer = 0, lastStatusMsg = '', lastFrameHeight = 0;

  const style = make('style');
  style.id = 'wayon-mocks-style';
  style.textContent = `
    :root{--mocks-accent:#0071e3;--mocks-accent-hover:#0077ed;--mocks-ok-bg:rgba(52,199,89,.14);--mocks-ok-fg:#1b7f37;--mocks-bad-bg:rgba(255,59,48,.12);--mocks-bad-fg:#d70015;--mocks-sheet:rgba(255,255,255,.86);--mocks-ring:rgba(0,0,0,.08);--mocks-input:rgba(118,118,128,.1)}
    @supports(color:light-dark(white,black)){:root{--mocks-accent:light-dark(#0071e3,#2997ff);--mocks-accent-hover:light-dark(#0077ed,#4ca8ff);--mocks-ok-bg:light-dark(rgba(52,199,89,.14),rgba(48,209,88,.2));--mocks-ok-fg:light-dark(#1b7f37,#32d74b);--mocks-bad-bg:light-dark(rgba(255,59,48,.12),rgba(255,69,58,.2));--mocks-bad-fg:light-dark(#d70015,#ff453a);--mocks-sheet:light-dark(rgba(255,255,255,.86),rgba(28,28,30,.92));--mocks-ring:light-dark(rgba(0,0,0,.08),rgba(255,255,255,.14));--mocks-input:light-dark(rgba(118,118,128,.1),rgba(118,118,128,.24))}}
    @media(prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--mocks-accent:#2997ff;--mocks-accent-hover:#4ca8ff;--mocks-ok-bg:rgba(48,209,88,.2);--mocks-ok-fg:#32d74b;--mocks-bad-bg:rgba(255,69,58,.2);--mocks-bad-fg:#ff453a;--mocks-sheet:rgba(28,28,30,.92);--mocks-ring:rgba(255,255,255,.14);--mocks-input:rgba(118,118,128,.24)}}
    :root[data-theme="light"]{color-scheme:light;--mocks-accent:#0071e3;--mocks-accent-hover:#0077ed;--mocks-ok-bg:rgba(52,199,89,.14);--mocks-ok-fg:#1b7f37;--mocks-bad-bg:rgba(255,59,48,.12);--mocks-bad-fg:#d70015;--mocks-sheet:rgba(255,255,255,.86);--mocks-ring:rgba(0,0,0,.08);--mocks-input:rgba(118,118,128,.1)}
    :root[data-theme="dark"]{color-scheme:dark;--mocks-accent:#2997ff;--mocks-accent-hover:#4ca8ff;--mocks-ok-bg:rgba(48,209,88,.2);--mocks-ok-fg:#32d74b;--mocks-bad-bg:rgba(255,69,58,.2);--mocks-bad-fg:#ff453a;--mocks-sheet:rgba(28,28,30,.92);--mocks-ring:rgba(255,255,255,.14);--mocks-input:rgba(118,118,128,.24)}
    #nav-mocks:before{display:none!important}#nav-mocks svg{width:19px;height:19px;flex:none}
    body[data-mocks-open] #tabs button:not(#nav-mocks){background:transparent!important;color:var(--fg-secondary)!important}
    body[data-mocks-open] #list,body[data-mocks-open] .workspace-top-bar,body[data-mocks-open] .workspace-sub-bar,body[data-mocks-open] #aircon-panel,body[data-mocks-open] #memo-panel,body[data-mocks-open] #feedback-panel,body[data-mocks-open] .sidebar-footer .bar{display:none!important}
    body[data-aircon-open] #mocks-panel,body[data-memo-open] #mocks-panel,body[data-feedback-open] #mocks-panel{display:none!important}
    body[data-mocks-open] .main-content{padding-bottom:24px}
    #mocks-panel{display:flex;flex-direction:column;gap:6px;width:100%;min-width:0}
    #mocks-panel[hidden]{display:none!important}
    .mocks-bar{display:flex;align-items:center;justify-content:flex-end;gap:10px 14px;flex-wrap:wrap;min-width:0;padding:0 2px}
    .mocks-actions{display:flex;align-items:center;justify-content:flex-end;gap:14px;flex-wrap:wrap;margin-left:auto;min-width:0}
    .mocks-link{display:inline-flex;align-items:center;gap:4px;min-block-size:34px;padding:0 6px;border:0;border-radius:999px;background:transparent;color:var(--mocks-accent);font:500 13.5px/1 var(--sans,-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",sans-serif);letter-spacing:-.01em;text-decoration:none;white-space:nowrap;cursor:pointer;transition:color .18s cubic-bezier(.28,.11,.32,1)}
    .mocks-link-arrow{display:inline-block;font-size:13px;line-height:1}
    .mocks-copy-wrap{position:relative;display:inline-flex;align-items:center;gap:8px}
    .mocks-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-inline-size:36px;min-block-size:36px;padding:0 16px;border-radius:999px;border:0;background:var(--mocks-accent);color:#fff;font:500 13px/1 var(--sans,-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",sans-serif);letter-spacing:-.01em;text-decoration:none;white-space:nowrap;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 2px 8px rgba(0,113,227,.24);transition:background-color .2s cubic-bezier(.28,.11,.32,1),color .2s cubic-bezier(.28,.11,.32,1),box-shadow .2s cubic-bezier(.28,.11,.32,1)}
    .mocks-btn-copy[data-copied]{background:var(--mocks-ok-bg);color:var(--mocks-ok-fg);box-shadow:none}
    .mocks-btn-copy[data-failed]{background:var(--mocks-bad-bg);color:var(--mocks-bad-fg);box-shadow:none}
    .mocks-btn-ico{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:none;pointer-events:none}
    .mocks-btn-ico svg{width:14px;height:14px;pointer-events:none}
    .mocks-check-path{stroke-dasharray:26;stroke-dashoffset:0}
    .mocks-btn:focus-visible,.mocks-link:focus-visible{outline:2px solid var(--mocks-accent);outline-offset:2px}
    @media(prefers-reduced-motion:no-preference){
      .mocks-btn{transition:background-color .2s cubic-bezier(.28,.11,.32,1),color .2s cubic-bezier(.28,.11,.32,1),box-shadow .2s cubic-bezier(.28,.11,.32,1),transform .16s cubic-bezier(.28,.11,.32,1)}
      .mocks-btn:active{transform:scale(.97)}
      .mocks-link-arrow{transition:transform .2s cubic-bezier(.28,.11,.32,1)}
      @keyframes mocks-check-draw{from{stroke-dashoffset:26}to{stroke-dashoffset:0}}
      .mocks-btn-copy[data-copied] .mocks-check-path{animation:mocks-check-draw .34s cubic-bezier(.22,1,.36,1) forwards}
    }
    @media(hover:hover){
      .mocks-btn-copy:hover{background:var(--mocks-accent-hover)}
      .mocks-btn-copy[data-copied]:hover{background:var(--mocks-ok-bg);color:var(--mocks-ok-fg)}
      .mocks-link:hover{color:var(--mocks-accent-hover);text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
      @media(prefers-reduced-motion:no-preference){.mocks-link:hover .mocks-link-arrow{transform:translate(2px,-1px)}}
    }
    .mocks-copy-status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
    .mocks-fallback{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border:0;border-radius:16px;background:var(--mocks-sheet);box-shadow:0 4px 18px -4px rgba(0,0,0,.08),0 0 0 .5px var(--mocks-ring);font-size:12.5px;color:var(--muted,#6e6e73)}
    .mocks-fallback[hidden]{display:none!important}
    .mocks-fallback input{flex:1 1 220px;min-width:0;min-block-size:36px;padding:6px 12px;border:0;border-radius:10px;background:var(--mocks-input);color:var(--fg,#1d1d1f);font:inherit;font-size:13.5px}
    .mocks-frame{display:block;width:calc(100% + 12px);margin-inline:-6px;height:600px;min-height:360px;border:0;border-radius:0;background:transparent;overflow:hidden;overflow:clip}
    @media(pointer:coarse),(max-width:599px){
      .mocks-actions{gap:10px}
      .mocks-link{min-block-size:44px;padding:0 8px}
      .mocks-btn{min-inline-size:44px;min-block-size:44px;padding:0 16px;font-size:13.5px}
      .mocks-fallback input{min-block-size:44px;font-size:16px}
      .mocks-frame{min-height:360px;border-radius:0}
    }
    @media(prefers-reduced-motion:reduce){
      .mocks-btn,.mocks-link,.mocks-link-arrow{transition:none}
    }
  `;
  document.head.append(style);

  function legacyCopy(text) {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.setAttribute('aria-label', '同事分享链接');
    field.style.cssText = 'position:fixed;inset-block-start:0;inset-inline-start:0;opacity:0';
    document.body.append(field);
    field.focus?.();
    field.select?.();
    try {
      return document.execCommand?.('copy') === true;
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }

  function reportCopy(button, iconEl, labelEl, liveEl, ok, url) {
    clearTimeout(copyTimer);
    button.removeAttribute('data-copied');
    button.removeAttribute('data-failed');
    let announcement = ok ? '已复制同事链接' : '复制失败，请手动复制下方链接';
    if (announcement === lastStatusMsg) announcement += '\u00A0';
    lastStatusMsg = announcement;
    liveEl.textContent = '';
    if (ok) {
      button.setAttribute('data-copied', '');
      iconEl.innerHTML = CHECK_ICON;
      labelEl.textContent = '已复制';
      if (fallbackBox) fallbackBox.hidden = true;
    } else {
      button.setAttribute('data-failed', '');
      iconEl.innerHTML = COPY_ICON;
      labelEl.textContent = '复制失败';
      if (fallbackBox && fallbackInput) {
        fallbackInput.value = url;
        fallbackBox.hidden = false;
        fallbackInput.focus?.();
        fallbackInput.select?.();
      }
    }
    const announce = () => { liveEl.textContent = announcement; };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(announce);
    else announce();
    copyTimer = setTimeout(() => {
      button.removeAttribute('data-copied');
      button.removeAttribute('data-failed');
      iconEl.innerHTML = COPY_ICON;
      labelEl.textContent = '复制同事链接';
      liveEl.textContent = '';
    }, 2200);
  }

  async function copyShareLink(button, iconEl, labelEl, liveEl) {
    const url = shareUrl();
    let ok = false;
    if (globalThis.navigator?.clipboard?.writeText) {
      try {
        await globalThis.navigator.clipboard.writeText(url);
        ok = true;
      } catch {
        ok = legacyCopy(url);
      }
    } else {
      ok = legacyCopy(url);
    }
    reportCopy(button, iconEl, labelEl, liveEl, ok, url);
    return ok;
  }

  function frameTargetOrigin() {
    const origin = globalThis.location?.origin;
    return origin && origin !== 'null' ? origin : '*';
  }

  function applyFrameHeight(rawHeight) {
    if (!frame) return false;
    const n = Number(rawHeight);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_FRAME_HEIGHT) return false;
    const next = Math.max(MIN_FRAME_HEIGHT, Math.ceil(n) + 2);
    if (next === lastFrameHeight && frame.style.height === next + 'px') return true;
    lastFrameHeight = next;
    frame.style.height = next + 'px';
    return true;
  }

  function measureFrameSameOrigin() {
    if (!frame) return 0;
    try {
      const doc = frame.contentDocument;
      if (!doc) return 0;
      const page = doc.querySelector?.('.page');
      if (page) {
        const rectH = page.getBoundingClientRect?.().height || 0;
        const scrollH = page.scrollHeight || 0;
        const offsetH = page.offsetHeight || 0;
        const h = Math.ceil(Math.max(rectH, scrollH, offsetH));
        if (h > 0) return h;
      }
      const bodyH = doc.body?.scrollHeight || 0;
      if (bodyH > 0) return Math.ceil(bodyH);
    } catch {}
    return 0;
  }

  function requestFrameMeasure() {
    if (!open || !frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage({type: 'wayon-mocks-measure'}, frameTargetOrigin());
    } catch {}
  }

  function syncFrameTheme(allowAuto) {
    if (!frame || !frame.contentWindow) return;
    let theme = document.documentElement?.getAttribute?.('data-theme');
    if (theme !== 'dark' && theme !== 'light') {
      const metaContent = document.querySelector?.('meta[name="color-scheme"]')?.getAttribute?.('content');
      if (metaContent === 'dark' || metaContent === 'light') theme = metaContent;
      else if (allowAuto) theme = 'auto';
    }
    if (theme !== 'dark' && theme !== 'light' && theme !== 'auto') return;
    try {
      frame.contentWindow.postMessage({type: 'wayon-theme', theme}, frameTargetOrigin());
    } catch {}
  }

  function fitFrame() {
    if (!open || !frame) return;
    const measured = measureFrameSameOrigin();
    if (measured > 0) {
      applyFrameHeight(measured);
      return;
    }
    requestFrameMeasure();
    if (!lastFrameHeight) {
      const rect = frame.getBoundingClientRect?.();
      const vh = globalThis.innerHeight || document.documentElement?.clientHeight || 0;
      if (rect && Number.isFinite(rect.top) && rect.top >= 0 && vh > 0) {
        const avail = Math.floor(vh - rect.top - 24);
        frame.style.height = Math.max(MIN_FRAME_HEIGHT, Math.min(avail, 720)) + 'px';
      }
    }
  }

  function onWindowMessage(e) {
    if (!frame || !e || !e.data || typeof e.data !== 'object') return;
    if (e.data.type !== 'wayon-mocks-height') return;
    if (!frame.contentWindow || e.source !== frame.contentWindow) return;
    const expectedOrigin = globalThis.location?.origin;
    if (expectedOrigin && expectedOrigin !== 'null' && e.origin !== expectedOrigin) return;
    applyFrameHeight(e.data.height);
  }

  function ensureFrame() {
    if (frame || !root) return;
    frame = make('iframe', 'mocks-frame');
    frame.id = 'mocks-frame';
    frame.title = '维安教育入学模考';
    frame.src = IFRAME_SRC;
    frame.setAttribute('allow', 'clipboard-write');
    frame.addEventListener?.('load', () => {
      syncFrameTheme(false);
      fitFrame();
      requestFrameMeasure();
    });
    root.append(frame);
  }

  function buildPanel() {
    const section = make('section');
    section.id = 'mocks-panel';
    section.hidden = !open;
    section.setAttribute('aria-label', '入学模考');

    const bar = make('div', 'mocks-bar');
    const actions = make('div', 'mocks-actions');

    const openLink = make('a', 'mocks-link');
    openLink.id = 'mocks-open-link';
    openLink.href = './mock-exams.html';
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.append(make('span', '', '新窗口打开'));
    const arrowEl = make('span', 'mocks-link-arrow', '↗');
    arrowEl.setAttribute('aria-hidden', 'true');
    openLink.append(arrowEl);

    const copyWrap = make('span', 'mocks-copy-wrap');
    const copyBtn = make('button', 'mocks-btn mocks-btn-copy');
    copyBtn.id = 'mocks-copy-link';
    copyBtn.type = 'button';
    const iconEl = make('span', 'mocks-btn-ico');
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.innerHTML = COPY_ICON;
    const labelEl = make('span', 'mocks-btn-txt', '复制同事链接');
    copyBtn.append(iconEl, labelEl);
    const liveEl = make('span', 'mocks-copy-status');
    liveEl.id = 'mocks-copy-status';
    liveEl.setAttribute('role', 'status');
    copyBtn.onclick = () => void copyShareLink(copyBtn, iconEl, labelEl, liveEl);
    copyWrap.append(copyBtn, liveEl);

    actions.append(openLink, copyWrap);
    bar.append(actions);

    fallbackBox = make('div', 'mocks-fallback');
    fallbackBox.hidden = true;
    fallbackBox.append(make('span', '', '请手动复制链接：'));
    fallbackInput = make('input');
    fallbackInput.type = 'text';
    fallbackInput.readOnly = true;
    fallbackInput.setAttribute('aria-label', '同事分享链接');
    fallbackBox.append(fallbackInput);

    section.append(bar, fallbackBox);
    return section;
  }

  function openPanel() {
    mount();
    open = true;
    document.body.dataset.mocksOpen = 'true';
    if (root) {
      root.hidden = false;
      ensureFrame();
    }
    const b = document.getElementById('nav-mocks');
    if (b) {
      b.classList.add('on');
      b.setAttribute('aria-pressed', 'true');
    }
    const refreshHeight = () => {
      syncFrameTheme(false);
      fitFrame();
      requestFrameMeasure();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(refreshHeight);
    else refreshHeight();
  }

  function close() {
    if (!open && !document.body.dataset.mocksOpen) return;
    open = false;
    if (root) root.hidden = true;
    delete document.body.dataset.mocksOpen;
    const b = document.getElementById('nav-mocks');
    b?.classList.remove('on');
    b?.setAttribute('aria-pressed', 'false');
  }

  function mount() {
    if (mounting) return;
    mounting = true;
    try {
      const tabs = document.getElementById('tabs');
      const list = document.getElementById('list');
      if (!tabs || !list) return;
      if (!root) {
        root = buildPanel();
        list.before(root);
      } else if (!root.parentNode) {
        list.before(root);
      }
      const notice = list.parentNode && [...list.parentNode.children].find(e => e.classList?.contains('wayon-sync-notice'));
      if (notice && typeof root.compareDocumentPosition === 'function' && (root.compareDocumentPosition(notice) & 4)) {
        notice.after(root);
      }
      let b = document.getElementById('nav-mocks');
      if (!b) {
        b = make('button', 'wayon-icon-control' + (open ? ' on' : ''));
        b.id = 'nav-mocks';
        b.type = 'button';
        b.title = '模考链接';
        b.setAttribute('aria-label', '模考链接');
        b.setAttribute('aria-pressed', String(open));
        b.innerHTML = NAV_ICON;
        b.onclick = () => openPanel();
        tabs.append(b);
      } else {
        if (open && !b.classList.contains('on')) {
          b.classList.add('on');
          b.setAttribute('aria-pressed', 'true');
        }
        const memo = document.getElementById('nav-memo');
        if (memo && memo.parentNode === tabs && b.parentNode === tabs && typeof b.compareDocumentPosition === 'function' && (b.compareDocumentPosition(memo) & 4)) {
          memo.after(b);
        }
      }
    } finally {
      mountObserver?.takeRecords?.();
      mounting = false;
    }
  }

  function start() {
    mount();
    document.addEventListener('click', e => {
      const nav = e.target?.closest?.('#tabs button');
      if (open && nav && nav.id !== 'nav-mocks') close();
    }, true);
    if (typeof MutationObserver === 'function') {
      mountObserver = new MutationObserver(mount);
      mountObserver.observe(document.body, {childList: true, subtree: true});
      new MutationObserver(() => {
        const ds = document.body.dataset || {};
        if (open && (ds.airconOpen || ds.memoOpen || ds.feedbackOpen)) close();
      }).observe(document.body, {attributes: true, attributeFilter: ['data-aircon-open', 'data-memo-open', 'data-feedback-open']});
      if (document.documentElement) {
        new MutationObserver(() => syncFrameTheme(true)).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
      }
    }
    globalThis.addEventListener?.('message', onWindowMessage);
    globalThis.addEventListener?.('resize', fitFrame);
  }

  globalThis.wayonMockExams = {open: openPanel, close, isOpen: () => open, shareUrl, iframeSrc: IFRAME_SRC, fitFrame};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
