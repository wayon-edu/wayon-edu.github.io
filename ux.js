// Workspace clarity layer (2026-11-10). Display only: it reads the page's data and the
// existing views' own counters, and never writes task, schedule, homework or cloud state.
//   - Chinese text labels and "still to do" badges on the navigation and view tabs
//   - per card: has the system work for that day actually gone out
//   - notices carry the air-conditioning request; the separate entry and the
//     "assigned today" tab are folded into those two places
//   - reminders: students whose exam date has passed are collapsed at the bottom
//   - tap a student's name for one page about that student
//   - confirm before a task is deleted; phone navigation no longer overlaps
(() => {
  if (globalThis.wayonUX || typeof document === 'undefined') return;
  globalThis.wayonUX = true;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  // The page keeps its state in top-level bindings; read them defensively.
  const page = {
    get data() { try { return DATA; } catch { return {}; } },
    get mode() { try { return mode; } catch { return ''; } },
    set mode(v) { try { mode = v; } catch {} },
    get cur() { try { return cur; } catch { return ''; } },
    get today() { try { return today; } catch { return new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Shanghai'}); } },
    get tomorrow() { try { return tomorrow; } catch { return ''; } },
    get chasing() { try { return CHASING; } catch { return []; } },
    render() { try { render(); } catch (e) { console.warn('ux render:', e); } },
  };
  const clean = v => String(v || '').replace(/[【】「」\s]/g, '');
  const shown = v => clean(globalThis.wayonDisplayName?.(v) || v);
  const members = v => String(v || '').replace(/^\d+\.\s*/, '').replace(/\s*\[(?:已停止催缴|本人已确认完成|已停止)[^\]]*\]/g, '').replace(/\s*考期[：:]\s*\S+/g, '').replace(/\s*\((?:距考期|考期|已停止)[^)]*\)/g, '').replace(/（.*?）/g, '').split(/[&＆/／、]/).map(shown).filter(Boolean);
  const md = d => { const p = String(d).split('-'); return Number(p[1]) + '月' + Number(p[2]) + '日'; };

  const NAV = {'nav-today': ['今天', '今天的任务'], 'nav-notice': ['通知', '课程通知与空调加时'], 'nav-rooms': ['教室', '教室使用'],
    'nav-feedback': ['反馈', '课堂反馈'], 'nav-memo': ['备忘', '备忘录'], 'nav-mocks': ['模考', '模考链接'], 'wayon-rules-btn': ['规则', '任务规则']};
  const TAB = {'tab-plan': ['安排', '任务安排：复制发群'], 'tab-done': ['完成', '完成记录：勾选完成情况'],
    'tab-quiz': ['抽背', '课前 / 课后抽背'], 'tab-chasing': ['待催', '待催作业']};
  const STATE = {sent: ['已布置', 'ok'], waiting: ['上批未完成', 'wait'], not_sent: ['未布置', 'todo'], decision: ['待老师安排', 'wait'], check: ['需核对', 'bad']};

  const style = make('style'); style.id = 'wayon-ux-style'; style.textContent = `
    .ux-label{display:block;font-size:10px;line-height:1.1;letter-spacing:0;font-weight:500;color:inherit;opacity:.85;margin-top:2px;pointer-events:none}
    #tabs button,#wayon-rules-btn{position:relative}
    .wayon-workbench #tabs button.ux-labelled,.wayon-workbench #wayon-rules-btn.ux-labelled{display:flex!important;flex-direction:column;align-items:center;justify-content:center;height:48px!important;min-height:48px;padding-top:4px;padding-bottom:3px}
    .wayon-workbench #subtabs button.ux-labelled{display:inline-flex!important;align-items:center;gap:6px;width:auto!important;min-width:44px;padding:0 12px!important;position:relative}
    #subtabs .ux-label{display:inline;font-size:13px;margin:0;opacity:1}
    .ux-badge{position:absolute;top:-3px;right:-5px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--bad,#d93025);color:#fff;font:600 10px/16px -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;pointer-events:none;box-sizing:border-box}
    #subtabs .ux-badge{position:static;margin-left:-2px}
    #subtabs .ux-label{white-space:nowrap}
    .ux-badge[data-zero]{display:none}
    #nav-aircon,#tab-assigned{display:none!important}
    body[data-aircon-open] #nav-notice{background:var(--accent-soft,rgba(0,113,227,.12))!important;color:var(--accent,#0071e3)!important}
    .wayon-workbench .item .head .meta{font-size:12px}
    .ux-assign{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:2px 0 10px}
    .ux-chip{display:inline-flex;align-items:center;gap:4px;min-height:26px;padding:2px 10px;border-radius:13px;border:1px solid var(--line,#d2d2d7);background:transparent;font:500 12px/1.3 inherit;color:var(--fg-secondary,#555);cursor:pointer}
    .ux-chip[data-kind=ok]{color:#1a7f37;border-color:#1a7f3755;background:#1a7f370f}
    .ux-chip[data-kind=todo]{color:#b35900;border-color:#b3590066;background:#b3590012}
    .ux-chip[data-kind=wait]{color:#8a6100;border-color:#8a610055;background:#8a61000f}
    .ux-chip[data-kind=bad]{color:var(--bad,#d93025);border-color:currentColor}
    .ux-assign-detail{flex:1 1 100%;margin:2px 0 0;padding:8px 12px;border-radius:10px;background:var(--bg-secondary,rgba(0,0,0,.035));font-size:12.5px;line-height:1.6}
    .ux-assign-detail div{display:flex;gap:8px;justify-content:space-between}.ux-assign-detail small{display:block;color:var(--muted,#888)}
    .ux-assign-detail b{font-weight:500;white-space:nowrap}
    #list .item .head .name{cursor:pointer}@media(hover:hover){#list .item .head .name:hover{text-decoration:underline;text-underline-offset:3px}}
    .ux-aircon{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;margin:0 0 12px;border:1px solid var(--line,#d2d2d7);border-radius:14px;background:var(--card,#fff);font-size:13.5px}
    .ux-aircon b{font-weight:600}.ux-aircon span{color:var(--muted,#888)}.ux-aircon button{margin-left:auto;min-height:36px;padding:6px 14px;border-radius:10px;border:1px solid var(--line,#d2d2d7);background:transparent;font:inherit;cursor:pointer;color:inherit}
    .ux-aircon[data-copied] b:after{content:' · 已复制';color:#1a7f37;font-weight:500}
    .ux-past{margin:8px 0 0;border:1px dashed var(--line,#d2d2d7);border-radius:14px;padding:4px 12px}
    .ux-past>summary{cursor:pointer;padding:10px 4px;font-size:13.5px;color:var(--muted,#888);list-style-position:inside}
    .ux-past[open]>summary{margin-bottom:8px}
    body.wayon-workbench[data-mode=chasing] #list .task{grid-template-columns:minmax(0,1fr) auto auto!important;padding:8px 10px;gap:6px 8px;align-items:center}
    body.wayon-workbench[data-mode=chasing] #list .task.ok{grid-template-columns:minmax(0,1fr) auto!important}
    body.wayon-workbench[data-mode=chasing] #list .task>.txt{grid-area:1/1}
    body.wayon-workbench[data-mode=chasing] #list .task>.mark{grid-area:1/2!important;width:auto!important;padding:5px 10px}
    body.wayon-workbench[data-mode=chasing] #list .task>button.small,.wayon-workbench[data-mode=chasing] .task.no>button.small{grid-column:-2/-1;grid-row:1;width:auto;min-width:44px;justify-self:end}
    .wayon-workbench[data-mode=done] .del-btn{opacity:.45}.wayon-workbench[data-mode=done] .del-btn:hover,.wayon-workbench[data-mode=done] .del-btn:focus-visible{opacity:1}
    #ux-student{width:min(720px,calc(100vw - 24px));max-height:min(86vh,900px);padding:0;border:1px solid var(--line,#d2d2d7);border-radius:18px;background:var(--card,#fff);color:inherit;box-shadow:0 20px 60px #0003}
    #ux-student::backdrop{background:#0006}
    .ux-st-head{position:sticky;top:0;display:flex;align-items:center;gap:12px;padding:16px 20px;background:var(--card,#fff);border-bottom:1px solid var(--line,#d2d2d7)}
    .ux-st-head h2{margin:0;font-size:20px;letter-spacing:-.02em}.ux-st-head button{margin-left:auto;min-width:44px;min-height:44px;border:0;background:transparent;font-size:20px;cursor:pointer;color:inherit}
    .ux-st-body{padding:8px 20px 20px}.ux-st-body h3{margin:18px 0 8px;font-size:13px;font-weight:600;color:var(--muted,#888)}
    .ux-st-row{display:flex;gap:10px;align-items:baseline;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line,#eee);font-size:14px;line-height:1.5}
    .ux-st-row:last-child{border-bottom:0}.ux-st-row small{color:var(--muted,#888);white-space:nowrap}.ux-st-row em{font-style:normal;white-space:nowrap}
    .ux-st-row em[data-kind=ok]{color:#1a7f37}.ux-st-row em[data-kind=todo]{color:#b35900}.ux-st-row em[data-kind=wait]{color:#8a6100}.ux-st-row em[data-kind=bad]{color:var(--bad,#d93025)}
    .ux-st-empty{color:var(--muted,#888);font-size:13.5px;padding:6px 0}.ux-st-note{margin-top:16px;font-size:12px;color:var(--muted,#888)}
    @media(min-width:1024px){
      .wayon-workbench .sidebar{padding-bottom:150px}
      .wayon-workbench .main-content{display:flex;flex-wrap:wrap;align-items:center;align-content:flex-start;column-gap:10px}
      .wayon-workbench .main-content>*{flex:0 0 100%;min-width:0;box-sizing:border-box}
      .wayon-workbench .main-content>.workspace-top-bar,.wayon-workbench .main-content>.workspace-sub-bar{display:contents}
      .wayon-workbench .main-content #subtabs{order:-6;flex:0 0 auto;margin:0 0 14px!important}
      .wayon-workbench .main-content #study-slot{order:-5;flex:0 0 auto;margin:0 0 14px}
      .wayon-workbench .main-content #workflow-tools{order:-4;flex:0 0 auto;margin:0 0 14px auto!important}
      .wayon-workbench .main-content .date-section{order:-3;flex:0 0 auto;margin:0 0 14px!important;width:auto!important}
      .wayon-workbench .main-content #study-slot .meta{display:none}
    }
    @media(max-width:1023px){
      body.wayon-workbench .sidebar .nav-section{flex:1 1 auto;min-width:0}
      body.wayon-workbench #tabs{max-width:100%;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
      body.wayon-workbench #tabs::-webkit-scrollbar{display:none}
      body.wayon-workbench .sidebar-footer{flex:0 0 auto}
      .wayon-workbench #subtabs button.ux-labelled{padding:0 10px!important}
      .wayon-workbench .workspace-sub-bar #study-slot .meta{display:none}
    }
    @media(max-width:599px){
      body.wayon-workbench .sidebar{padding:6px 6px!important;gap:4px!important}
      body.wayon-workbench .sidebar .nav-section{flex:1 1 auto!important;min-width:0!important;max-width:100%!important}
      body.wayon-workbench #tabs{gap:1px!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;scrollbar-width:none;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;padding:4px 0 0!important;margin-top:-4px}
      body.wayon-workbench .sidebar-footer{flex:0 0 auto!important;gap:4px!important}
      body.wayon-workbench #tabs button.ux-labelled,body.wayon-workbench #wayon-rules-btn.ux-labelled{flex:0 0 auto;scroll-snap-align:start;width:44px!important;min-width:44px!important;position:relative!important;left:auto!important;right:auto!important}
      .wayon-workbench .main-content{display:flex;flex-wrap:wrap;align-items:center;gap:0 8px}
      .wayon-workbench .main-content>*{flex:0 0 100%;min-width:0;box-sizing:border-box}
      .wayon-workbench .main-content>.workspace-top-bar,.wayon-workbench .main-content>.workspace-sub-bar{display:contents}
      .wayon-workbench .main-content #subtabs{order:-6;flex:0 0 100%;margin:0 0 8px!important;display:flex}
      .wayon-workbench .main-content #subtabs button{flex:1 1 0;justify-content:center;gap:5px!important;padding:0 4px!important}
      .wayon-workbench .main-content #subtabs button.ux-labelled>span[aria-hidden]:not(.ux-badge){display:none!important}
      .wayon-workbench .main-content #subtabs button.ux-labelled:before{display:none!important}
      .wayon-workbench .main-content .date-section{order:-5;flex:1 1 120px!important;margin:0 0 10px!important;width:auto!important}
      .wayon-workbench .main-content .date-section #day-picker{width:100%}
      .wayon-workbench .main-content #study-slot{order:-4;flex:0 0 auto;margin:0 0 10px}
      .wayon-workbench .main-content #workflow-tools{order:-3;flex:0 0 auto;margin:0 0 10px!important}
    }
    /* ---- 完成记录: one calm row style for class cards and self-study cards ---- */
    body.wayon-workbench[data-mode=done] #list .item{padding:18px 22px 14px}
    body.wayon-workbench[data-mode=done] #list .item .head{margin-bottom:6px}
    body.wayon-workbench[data-mode=done] #list .item .ux-assign{margin:0 0 6px}
    body.wayon-workbench[data-mode=done] #list .item .head button.small,
    body.wayon-workbench[data-mode=done] #list .item .head button.copy{width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;border-radius:10px!important;box-shadow:none!important}
    body.wayon-workbench[data-mode=done] #list .item .head button.small{background:transparent!important;border:1px solid var(--line,#d2d2d7)!important}
    body.wayon-workbench[data-mode=done] #list .item .head button.small:hover{background:var(--code-bg,rgba(0,0,0,.04))!important}
    body.wayon-workbench[data-mode=done] #list .item .head .study-actions{display:inline-flex;gap:8px;margin:0;padding:0}
    /* emoji marks become plain glyphs in the page's own colours */
    body.wayon-workbench[data-mode=done] #list .wayon-emoji,body.wayon-workbench[data-mode=done] #list .study-mark{font-size:0!important;line-height:0!important}
    body.wayon-workbench[data-mode=done] #list .wayon-emoji:before,body.wayon-workbench[data-mode=done] #list .study-mark:before{font:600 15px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;display:block}
    body.wayon-workbench[data-mode=done] #list .head [data-icon-action="All Done"] .wayon-emoji:before{content:'✓✓';letter-spacing:-5px;margin-left:-5px;color:#1a7f37}
    body.wayon-workbench[data-mode=done] #list .head [data-icon-action="All Not Done"] .wayon-emoji:before{content:'✕✕';letter-spacing:-5px;margin-left:-5px;color:var(--bad,#d93025);font-size:13px}
    body.wayon-workbench[data-mode=done] #list .tasks{margin-top:2px}
    body.wayon-workbench[data-mode=done] #list .task{background:transparent!important;border:0!important;border-bottom:1px solid var(--line,#e5e5ea)!important;border-radius:0!important;margin:0!important;padding:3px 0!important;min-height:46px;box-shadow:none!important}
    body.wayon-workbench[data-mode=done] #list .task:last-of-type{border-bottom-color:transparent!important}
    /* text takes the room; the note opens on its own line under the task instead of squeezing it */
    body.wayon-workbench[data-mode=done] #list .task{grid-template-columns:minmax(0,1fr) auto auto auto!important;column-gap:8px!important;align-items:center}
    body.wayon-workbench[data-mode=done] #list .task .note-disclosure{width:auto!important;min-width:0!important;justify-self:end}
    body.wayon-workbench[data-mode=done] #list .task .note-disclosure[open]{grid-column:1/-1;grid-row:2;justify-self:stretch;display:flex;gap:8px;align-items:center;padding:0 0 8px 2px}
    body.wayon-workbench[data-mode=done] #list .task .note-disclosure[open] .note{flex:1;min-width:0}
    body.wayon-workbench[data-mode=done] #list .task.ok .txt{color:var(--muted,#8a8a8e)}
    body.wayon-workbench[data-mode=done] #list .task.no .txt{color:var(--bad,#d93025)}
    body.wayon-workbench[data-mode=done] #list .task .task-num{display:none}
    body.wayon-workbench[data-mode=done] #list .task .txt{padding-left:2px!important;background:transparent!important}
    /* the mark: hollow ring → green tick / red cross; same look whether it is one cycling button or a pair */
    body.wayon-workbench[data-mode=done] #list .task button.mark,body.wayon-workbench[data-mode=done] #list .study-mark{width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;padding:0!important;border-radius:50%!important;border:1.5px solid #b4b4ba!important;background:transparent!important;box-shadow:none!important;display:inline-flex!important;align-items:center;justify-content:center;opacity:1!important;cursor:pointer;transition:background .15s,border-color .15s,transform .1s}
    body.wayon-workbench[data-mode=done] #list .task button.mark:active,body.wayon-workbench[data-mode=done] #list .study-mark:active{transform:scale(.9)}
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Unmarked"]>span{display:none}
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Done"],body.wayon-workbench[data-mode=done] #list .study-mark.on[aria-label$="完成"]:not([aria-label$="未完成"]){background:#1f9d48!important;border-color:#1f9d48!important}
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Not Done"],body.wayon-workbench[data-mode=done] #list .study-mark.on[aria-label$="未完成"]{background:var(--bad,#d93025)!important;border-color:var(--bad,#d93025)!important}
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Done"] .wayon-emoji:before{content:'✓';color:#fff}
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Not Done"] .wayon-emoji:before{content:'✕';color:#fff;font-size:13px}
    body.wayon-workbench[data-mode=done] #list .study-marks{display:inline-flex;gap:8px;align-items:center}
    body.wayon-workbench[data-mode=done] #list .study-mark:before{content:'✓';color:var(--muted,#aeaeb2)}
    body.wayon-workbench[data-mode=done] #list .study-mark[aria-label$="未完成"]:before{content:'✕';font-size:13px}
    body.wayon-workbench[data-mode=done] #list .study-mark.on:before{color:#fff}
    body.wayon-workbench[data-mode=done] #list .task .del-btn{font-size:17px;color:var(--muted,#aeaeb2);background:transparent;border:0}
    @media(hover:hover) and (pointer:fine){
      body.wayon-workbench[data-mode=done] #list .task .del-btn,body.wayon-workbench[data-mode=done] #list .task .note-disclosure:not([open])>summary[data-icon-action="Add Note"]{opacity:0;transition:opacity .15s}
      body.wayon-workbench[data-mode=done] #list .task:hover .del-btn,body.wayon-workbench[data-mode=done] #list .task:focus-within .del-btn{opacity:.7}
      /* as specific as the rule that hides it, or hovering never shows the note button */
      body.wayon-workbench[data-mode=done] #list .task:hover .note-disclosure:not([open])>summary[data-icon-action="Add Note"],body.wayon-workbench[data-mode=done] #list .task:focus-within .note-disclosure:not([open])>summary[data-icon-action="Add Note"],body.wayon-workbench[data-mode=done] #list .task .note-disclosure>summary:focus-visible{opacity:.75}
      body.wayon-workbench[data-mode=done] #list .task:hover{background:var(--code-bg,rgba(0,0,0,.025))!important}
    }
    body.wayon-workbench[data-mode=done] #list .item .tasks~button,body.wayon-workbench[data-mode=done] #list .item .add-task-btn,body.wayon-workbench[data-mode=done] #list .item .add-btn{border:0!important;background:transparent!important;box-shadow:none!important;min-height:32px!important;height:32px!important;margin-top:4px!important;opacity:.75}
    body.wayon-workbench[data-mode=done] #list .item .tasks~button:hover{opacity:1;background:var(--code-bg,rgba(0,0,0,.04))!important}
    /* ---- 抽背: one card per student instead of a card inside a card ---- */
    body.wayon-workbench[data-mode=quiz] #list .quiz{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}
    body.wayon-workbench[data-mode=quiz] #list .quiz>.head{padding:2px 4px 10px;margin:0;border:0;align-items:baseline}
    body.wayon-workbench[data-mode=quiz] #list .quiz>.head h2{font-size:17px;letter-spacing:-.01em}
    body.wayon-workbench[data-mode=quiz] #list .quiz>.head .meta{font-size:12px;color:var(--muted,#8a8a8e)}
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed){background:var(--card,#fff);border:1px solid var(--line,#e5e5ea)!important;border-radius:16px!important;padding:16px 20px!important;margin:0 0 12px!important;box-shadow:0 1px 2px rgba(0,0,0,.04)}
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup.vq-collapsed{padding:9px 14px!important;margin:0 0 10px!important}
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup .qhead{font-size:18px;font-weight:600;letter-spacing:-.01em}
    @media(prefers-color-scheme:dark){.ux-chip[data-kind=ok],.ux-aircon[data-copied] b:after,.ux-st-row em[data-kind=ok]{color:#4ac26b}.ux-chip[data-kind=todo],.ux-st-row em[data-kind=todo]{color:#f0883e}.ux-chip[data-kind=wait],.ux-st-row em[data-kind=wait]{color:#d4a72c}}
  `;
  document.head.append(style);
  try { document.title = 'Wayon-edu'; } catch {}

  const appleStyle = make('style'); appleStyle.id = 'wayon-apple-glass'; appleStyle.textContent = `
    :root{
      color-scheme:light dark;
      --apple-sans:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","Hiragino Sans GB","Helvetica Neue",sans-serif;
      --apple-ease:cubic-bezier(.28,.11,.32,1);
      --apple-ease-out:cubic-bezier(.22,1,.36,1);
      --apple-scroll-p:0;
      --apple-canvas-light:#F5F5F7;--apple-canvas-dark:#000000;
      --apple-surface-light:#FFFFFF;--apple-surface-dark:#1C1C1E;
      --apple-elevated-light:#FFFFFF;--apple-elevated-dark:#242426;
      --apple-fg-light:#1D1D1F;--apple-fg-dark:#F5F5F7;
      --apple-fg2-light:#515154;--apple-fg2-dark:#AEAEB2;
      --apple-muted-light:#6E6E73;--apple-muted-dark:#A1A1A6;
      --apple-accent-light:#0071E3;--apple-accent-dark:#2997FF;
      --apple-accent-hover-light:#0077ED;--apple-accent-hover-dark:#4CA8FF;
      --apple-canvas:var(--apple-canvas-light);
      --apple-surface:var(--apple-surface-light);
      --apple-elevated:var(--apple-elevated-light);
      --apple-glow-key:rgba(255,255,255,.95);
      --apple-glow-sky:rgba(212,229,252,.38);
      --apple-glow-warm:rgba(216,119,86,.055);
      --apple-glass-rail-top:rgba(255,255,255,.72);
      --apple-glass-rail-bot:rgba(246,248,253,.56);
      --apple-glass-bar-top:rgba(255,255,255,.78);
      --apple-glass-bar-bot:rgba(248,249,252,.64);
      --apple-glass-rim-top:rgba(255,255,255,.96);
      --apple-glass-rim-side:rgba(255,255,255,.62);
      --apple-glass-rim-bot:rgba(0,0,0,.055);
      --apple-glass-hairline:rgba(0,0,0,.072);
      --apple-glass-shadow:rgba(0,0,0,.095);
      --apple-glass-shadow-tight:rgba(0,0,0,.04);
      --apple-lens-top:rgba(255,255,255,.98);
      --apple-lens-bot:rgba(235,244,255,.88);
      --apple-lens-rim:rgba(255,255,255,1);
      --apple-lens-hairline:rgba(0,113,227,.2);
      --apple-lens-glow:rgba(0,113,227,.16);
      --apple-rail-hover:rgba(29,29,31,.05);
      --apple-seg-track:rgba(118,118,128,.12);
      --apple-seg-track-inset:rgba(0,0,0,.065);
      --apple-seg-track-lip:rgba(255,255,255,.76);
      --apple-seg-thumb-top:#FFFFFF;
      --apple-seg-thumb-bot:#FAFAFC;
      --apple-seg-thumb-shadow:rgba(0,0,0,.095);
      --apple-seg-thumb-rim:#FFFFFF;
      --apple-hairline:rgba(29,29,31,.08);
      --apple-card-rim:rgba(255,255,255,.96);
      --apple-card-ring:rgba(0,0,0,.04);
      --apple-card-shadow-1:rgba(0,0,0,.045);
      --apple-card-shadow-2:rgba(0,0,0,.025);
      --apple-card-hover-1:rgba(0,0,0,.09);
      --apple-card-hover-2:rgba(0,0,0,.04);
      --apple-folded-bg:rgba(255,255,255,.68);
      --apple-input-ring:rgba(0,0,0,.085);
      --apple-ok-dot:#28CD41;
      --apple-ok-bg:rgba(52,199,89,.14);
      --apple-bad-bg:rgba(255,59,48,.12);
      --bg:var(--apple-canvas-light);
      --card:var(--apple-surface-light);
      --card-elevated:var(--apple-elevated-light);
      --fg:var(--apple-fg-light);
      --fg-secondary:var(--apple-fg2-light);
      --muted:var(--apple-muted-light);
      --line:rgba(29,29,31,.08);
      --line-strong:rgba(29,29,31,.15);
      --accent:var(--apple-accent-light);
      --accent-hover:var(--apple-accent-hover-light);
      --accent-subtle:rgba(0,113,227,.11);
      --accent-soft:rgba(0,113,227,.11);
      --code-bg:#F5F5F7;
      --bg-secondary:rgba(118,118,128,.08);
      --done:#1B7F37;
      --done-dark:#1B7F37;
      --done-bg:rgba(52,199,89,.13);
      --done-border:rgba(52,199,89,.28);
      --bad:#D70015;
      --bad-dark:#B3261E;
      --bad-bg:rgba(255,59,48,.11);
      --bad-border:rgba(255,59,48,.26);
      --shadow-card:inset 0 1px 0 var(--apple-card-rim),0 4px 20px -4px var(--apple-card-shadow-1),0 1px 2px var(--apple-card-shadow-2),0 0 0 .5px var(--apple-card-ring);
      accent-color:var(--accent);
    }
    @supports (color: light-dark(white, black)){
      :root{
        --apple-canvas:light-dark(#F5F5F7,#000000);
        --apple-surface:light-dark(#FFFFFF,#1C1C1E);
        --apple-elevated:light-dark(#FFFFFF,#242426);
        --bg:light-dark(#F5F5F7,#000000);
        --card:light-dark(#FFFFFF,#1C1C1E);
        --card-elevated:light-dark(#FFFFFF,#242426);
        --fg:light-dark(#1D1D1F,#F5F5F7);
        --fg-secondary:light-dark(#515154,#AEAEB2);
        --muted:light-dark(#6E6E73,#A1A1A6);
        --accent:light-dark(#0071E3,#2997FF);
        --accent-hover:light-dark(#0077ED,#4CA8FF);
      }
    }
    @media(prefers-color-scheme:dark){
      :root:not([data-theme="light"]){
        color-scheme:dark;
        --apple-canvas:var(--apple-canvas-dark);
        --apple-surface:var(--apple-surface-dark);
        --apple-elevated:var(--apple-elevated-dark);
        --apple-glow-key:rgba(41,151,255,.09);
        --apple-glow-sky:rgba(255,255,255,.035);
        --apple-glow-warm:rgba(216,119,86,.08);
        --apple-glass-rail-top:rgba(46,46,52,.74);
        --apple-glass-rail-bot:rgba(24,24,28,.62);
        --apple-glass-bar-top:rgba(46,46,52,.78);
        --apple-glass-bar-bot:rgba(24,24,28,.66);
        --apple-glass-rim-top:rgba(255,255,255,.22);
        --apple-glass-rim-side:rgba(255,255,255,.1);
        --apple-glass-rim-bot:rgba(0,0,0,.55);
        --apple-glass-hairline:rgba(255,255,255,.14);
        --apple-glass-shadow:rgba(0,0,0,.72);
        --apple-glass-shadow-tight:rgba(0,0,0,.45);
        --apple-lens-top:rgba(255,255,255,.2);
        --apple-lens-bot:rgba(41,151,255,.2);
        --apple-lens-rim:rgba(255,255,255,.28);
        --apple-lens-hairline:rgba(100,180,255,.26);
        --apple-lens-glow:rgba(0,0,0,.52);
        --apple-rail-hover:rgba(255,255,255,.08);
        --apple-seg-track:rgba(118,118,128,.26);
        --apple-seg-track-inset:rgba(0,0,0,.48);
        --apple-seg-track-lip:rgba(255,255,255,.07);
        --apple-seg-thumb-top:rgba(99,99,102,.9);
        --apple-seg-thumb-bot:rgba(72,72,74,.84);
        --apple-seg-thumb-shadow:rgba(0,0,0,.46);
        --apple-seg-thumb-rim:rgba(255,255,255,.2);
        --apple-hairline:rgba(255,255,255,.11);
        --apple-card-rim:rgba(255,255,255,.1);
        --apple-card-ring:rgba(255,255,255,.07);
        --apple-card-shadow-1:rgba(0,0,0,.55);
        --apple-card-shadow-2:rgba(0,0,0,.38);
        --apple-card-hover-1:rgba(0,0,0,.75);
        --apple-card-hover-2:rgba(0,0,0,.5);
        --apple-folded-bg:rgba(28,28,30,.72);
        --apple-input-ring:rgba(255,255,255,.14);
        --apple-ok-dot:#30D158;
        --apple-ok-bg:rgba(48,209,88,.18);
        --apple-bad-bg:rgba(255,69,58,.2);
        --bg:var(--apple-canvas-dark);
        --card:var(--apple-surface-dark);
        --card-elevated:var(--apple-elevated-dark);
        --fg:var(--apple-fg-dark);
        --fg-secondary:var(--apple-fg2-dark);
        --muted:var(--apple-muted-dark);
        --line:rgba(255,255,255,.1);
        --line-strong:rgba(255,255,255,.18);
        --accent:var(--apple-accent-dark);
        --accent-hover:var(--apple-accent-hover-dark);
        --accent-subtle:rgba(41,151,255,.18);
        --accent-soft:rgba(41,151,255,.18);
        --code-bg:#242426;
        --bg-secondary:rgba(255,255,255,.07);
        --done:#32D74B;
        --done-dark:#32D74B;
        --done-bg:rgba(48,209,88,.18);
        --done-border:rgba(48,209,88,.34);
        --bad:#FF453A;
        --bad-dark:#FF6961;
        --bad-bg:rgba(255,69,58,.2);
        --bad-border:rgba(255,69,58,.36);
      }
    }
    :root[data-theme="dark"]{
      color-scheme:dark;
      --apple-canvas:var(--apple-canvas-dark);
      --apple-surface:var(--apple-surface-dark);
      --apple-elevated:var(--apple-elevated-dark);
      --apple-glow-key:rgba(41,151,255,.09);
      --apple-glow-sky:rgba(255,255,255,.035);
      --apple-glow-warm:rgba(216,119,86,.08);
      --apple-glass-rail-top:rgba(46,46,52,.74);
      --apple-glass-rail-bot:rgba(24,24,28,.62);
      --apple-glass-bar-top:rgba(46,46,52,.78);
      --apple-glass-bar-bot:rgba(24,24,28,.66);
      --apple-glass-rim-top:rgba(255,255,255,.22);
      --apple-glass-rim-side:rgba(255,255,255,.1);
      --apple-glass-rim-bot:rgba(0,0,0,.55);
      --apple-glass-hairline:rgba(255,255,255,.14);
      --apple-glass-shadow:rgba(0,0,0,.72);
      --apple-glass-shadow-tight:rgba(0,0,0,.45);
      --apple-lens-top:rgba(255,255,255,.2);
      --apple-lens-bot:rgba(41,151,255,.2);
      --apple-lens-rim:rgba(255,255,255,.28);
      --apple-lens-hairline:rgba(100,180,255,.26);
      --apple-lens-glow:rgba(0,0,0,.52);
      --apple-rail-hover:rgba(255,255,255,.08);
      --apple-seg-track:rgba(118,118,128,.26);
      --apple-seg-track-inset:rgba(0,0,0,.48);
      --apple-seg-track-lip:rgba(255,255,255,.07);
      --apple-seg-thumb-top:rgba(99,99,102,.9);
      --apple-seg-thumb-bot:rgba(72,72,74,.84);
      --apple-seg-thumb-shadow:rgba(0,0,0,.46);
      --apple-seg-thumb-rim:rgba(255,255,255,.2);
      --apple-hairline:rgba(255,255,255,.11);
      --apple-card-rim:rgba(255,255,255,.1);
      --apple-card-ring:rgba(255,255,255,.07);
      --apple-card-shadow-1:rgba(0,0,0,.55);
      --apple-card-shadow-2:rgba(0,0,0,.38);
      --apple-card-hover-1:rgba(0,0,0,.75);
      --apple-card-hover-2:rgba(0,0,0,.5);
      --apple-folded-bg:rgba(28,28,30,.72);
      --apple-input-ring:rgba(255,255,255,.14);
      --apple-ok-dot:#30D158;
      --apple-ok-bg:rgba(48,209,88,.18);
      --apple-bad-bg:rgba(255,69,58,.2);
      --bg:var(--apple-canvas-dark);
      --card:var(--apple-surface-dark);
      --card-elevated:var(--apple-elevated-dark);
      --fg:var(--apple-fg-dark);
      --fg-secondary:var(--apple-fg2-dark);
      --muted:var(--apple-muted-dark);
      --line:rgba(255,255,255,.1);
      --line-strong:rgba(255,255,255,.18);
      --accent:var(--apple-accent-dark);
      --accent-hover:var(--apple-accent-hover-dark);
      --accent-subtle:rgba(41,151,255,.18);
      --accent-soft:rgba(41,151,255,.18);
      --code-bg:#242426;
      --bg-secondary:rgba(255,255,255,.07);
      --done:#32D74B;
      --done-dark:#32D74B;
      --done-bg:rgba(48,209,88,.18);
      --done-border:rgba(48,209,88,.34);
      --bad:#FF453A;
      --bad-dark:#FF6961;
      --bad-bg:rgba(255,69,58,.2);
      --bad-border:rgba(255,69,58,.36);
    }
    html{scroll-padding-top:76px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
    body.wayon-workbench{
      font-family:var(--apple-sans)!important;
      background-color:var(--apple-canvas)!important;
      background-image:
        radial-gradient(1240px 480px at 20% -10%,var(--apple-glow-key) 0%,transparent 66%),
        radial-gradient(920px 440px at 88% -8%,var(--apple-glow-sky) 0%,transparent 62%),
        radial-gradient(620px 340px at 6% 8%,var(--apple-glow-warm) 0%,transparent 60%)!important;
      background-attachment:fixed!important;
      color:var(--fg)!important;
    }

    /* ---- Desktop >= 1024px: Fixed Floating macOS Tahoe Liquid Glass Rail + 60fps Shrinking Topbar ---- */
    @media(min-width:1024px){
      body.wayon-workbench .app-layout{
        display:block!important;
        padding-inline-start:98px!important;
        min-height:100dvh;
      }
      body.wayon-workbench .sidebar{
        position:fixed!important;
        inset-block:12px!important;
        inset-inline-start:12px!important;
        width:74px!important;
        min-width:74px!important;
        height:calc(100dvh - 24px)!important;
        padding:10px 7px 12px!important;
        border:0!important;
        border-radius:24px!important;
        background:transparent!important;
        box-shadow:none!important;
        overflow:visible!important;
        z-index:45!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        gap:6px!important;
        user-select:none;
      }
      body.wayon-workbench .sidebar::before{
        content:'';
        position:absolute;
        inset:0;
        border-radius:24px;
        z-index:-1;
        pointer-events:none;
        background:linear-gradient(168deg,var(--apple-glass-rail-top) 0%,var(--apple-glass-rail-bot) 100%);
        backdrop-filter:blur(28px) saturate(210%);
        -webkit-backdrop-filter:blur(28px) saturate(210%);
        box-shadow:
          inset 0 1px .5px var(--apple-glass-rim-top),
          inset 1px 0 0 var(--apple-glass-rim-side),
          inset 0 -.5px 0 var(--apple-glass-rim-bot),
          0 10px 34px -8px var(--apple-glass-shadow),
          0 2px 6px var(--apple-glass-shadow-tight),
          0 0 0 .5px var(--apple-glass-hairline);
      }
      body.wayon-workbench .sidebar .nav-section{
        flex:1 1 auto!important;
        min-height:0!important;
        width:100%!important;
        overflow-y:auto!important;
        overflow-x:visible!important;
        scrollbar-width:none;
        padding:0!important;
      }
      body.wayon-workbench .sidebar .nav-section::-webkit-scrollbar{display:none}
      body.wayon-workbench #tabs{
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        gap:4px!important;
        width:100%!important;
        padding:0!important;
      }
      body.wayon-workbench #tabs button,
      body.wayon-workbench #tabs button.ux-labelled{
        width:60px!important;
        min-width:60px!important;
        height:52px!important;
        min-height:52px!important;
        padding:6px 2px!important;
        border:0!important;
        border-radius:16px!important;
        background:transparent!important;
        color:var(--muted)!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:center!important;
        gap:3px!important;
        box-shadow:none!important;
        transition:color .18s var(--apple-ease),background-color .18s var(--apple-ease),box-shadow .22s var(--apple-ease),transform .16s var(--apple-ease);
      }
      body.wayon-workbench #tabs button svg{width:20px!important;height:20px!important;stroke-width:1.78!important}
      body.wayon-workbench #tabs button .ux-label{font-size:10.5px!important;font-weight:500!important;margin-top:0!important;opacity:1!important}
      body.wayon-workbench #tabs button:hover{background:var(--apple-rail-hover)!important;color:var(--fg)!important}
      body.wayon-workbench #tabs button:active{transform:scale(.95)}
      body.wayon-workbench #tabs #nav-aircon,
      body.wayon-workbench #subtabs #tab-assigned{display:none!important}
      body.wayon-workbench #tabs button.on,
      body.wayon-workbench[data-feedback-open] #tabs #nav-feedback,
      body.wayon-workbench[data-memo-open] #tabs #nav-memo,
      body.wayon-workbench[data-mocks-open] #tabs #nav-mocks,
      body.wayon-workbench[data-aircon-open] #tabs #nav-notice{
        background:linear-gradient(180deg,var(--apple-lens-top) 0%,var(--apple-lens-bot) 100%)!important;
        color:var(--accent)!important;
        font-weight:600!important;
        box-shadow:
          inset 0 1px .5px var(--apple-lens-rim),
          inset 0 -.5px 0 rgba(0,113,227,.08),
          0 4px 14px -3px var(--apple-lens-glow),
          0 1px 2px var(--apple-glass-shadow-tight),
          0 0 0 .5px var(--apple-lens-hairline)!important;
      }
      body.wayon-workbench #tabs button.on .ux-label,
      body.wayon-workbench[data-feedback-open] #tabs #nav-feedback .ux-label,
      body.wayon-workbench[data-memo-open] #tabs #nav-memo .ux-label,
      body.wayon-workbench[data-mocks-open] #tabs #nav-mocks .ux-label,
      body.wayon-workbench[data-aircon-open] #tabs #nav-notice .ux-label{font-weight:600!important}
      body.wayon-workbench[data-feedback-open] #tabs button:not(#nav-feedback),
      body.wayon-workbench[data-memo-open] #tabs button:not(#nav-memo),
      body.wayon-workbench[data-mocks-open] #tabs button:not(#nav-mocks),
      body.wayon-workbench[data-aircon-open] #tabs button:not(#nav-notice){
        background:transparent!important;
        color:var(--muted)!important;
        box-shadow:none!important;
      }
      body.wayon-workbench #tabs button .ux-badge,
      body.wayon-workbench #tabs #nav-feedback[data-todo]:after{
        top:3px!important;
        right:5px!important;
        box-shadow:0 0 0 1.5px var(--apple-surface);
      }
      body.wayon-workbench .sidebar-footer{
        position:static!important;
        left:auto!important;
        bottom:auto!important;
        margin-top:auto!important;
        width:100%!important;
        padding:10px 0 0!important;
        border-top:.5px solid var(--apple-hairline)!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        gap:4px!important;
        z-index:auto!important;
      }
      body.wayon-workbench .sidebar #sync{
        width:36px!important;
        max-width:36px!important;
        height:28px!important;
        min-height:28px!important;
        border-radius:999px!important;
        display:grid!important;
        place-items:center!important;
        cursor:pointer!important;
        transition:background-color .16s var(--apple-ease);
      }
      body.wayon-workbench .sidebar #sync:hover{background:var(--apple-rail-hover)!important}
      body.wayon-workbench .sidebar #sync:before{
        width:7px!important;
        height:7px!important;
        box-shadow:0 0 0 3px var(--apple-seg-track);
      }
      body.wayon-workbench .sidebar #sync[data-connection='saved']:before{
        background:var(--apple-ok-dot)!important;
        box-shadow:0 0 0 3px var(--apple-ok-bg)!important;
      }
      body.wayon-workbench .sidebar #sync[data-connection='error']:before{
        background:var(--bad)!important;
        box-shadow:0 0 0 3px var(--apple-bad-bg)!important;
      }
      body.wayon-workbench .sidebar #wayon-rules-btn,
      body.wayon-workbench .sidebar #wayon-rules-btn.ux-labelled,
      body.wayon-workbench .sidebar #account-settings>summary,
      body.wayon-workbench .sidebar #account-settings>summary.wayon-icon-control{
        width:60px!important;
        min-width:60px!important;
        height:44px!important;
        min-height:44px!important;
        padding:4px 2px!important;
        border:0!important;
        border-radius:14px!important;
        background:transparent!important;
        color:var(--muted)!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:center!important;
        gap:2px!important;
        box-shadow:none!important;
        transition:background-color .16s var(--apple-ease),color .16s var(--apple-ease);
      }
      body.wayon-workbench .sidebar #wayon-rules-btn:hover,
      body.wayon-workbench .sidebar #account-settings>summary:hover{
        background:var(--apple-rail-hover)!important;
        color:var(--fg)!important;
      }
      body.wayon-workbench .sidebar #wayon-rules-btn svg,
      body.wayon-workbench .sidebar #account-settings>summary svg{width:17px!important;height:17px!important}
      body.wayon-workbench .sidebar #wayon-rules-btn .ux-label,
      body.wayon-workbench .sidebar #account-settings>summary .ux-label{font-size:10px!important;font-weight:500!important;margin-top:0!important;opacity:1!important}
      body.wayon-workbench .sidebar #account-settings{width:60px!important;min-width:60px!important;padding:0!important;margin:0!important}
      body.wayon-workbench .sidebar #account-settings[open]{
        position:fixed!important;
        left:96px!important;
        bottom:16px!important;
        width:min(400px,calc(100vw - 116px))!important;
        padding:18px!important;
        z-index:100!important;
        border:0!important;
        border-radius:24px!important;
        background:var(--apple-surface)!important;
        box-shadow:0 24px 64px -12px rgba(0,0,0,.28),0 0 0 .5px var(--apple-glass-hairline)!important;
      }
      body.wayon-workbench .sidebar #workflow-tools{flex-direction:column!important;align-items:center!important;gap:6px!important;margin:4px 0 0!important}
      body.wayon-workbench .sidebar #workflow-checks-panel{position:fixed!important;left:96px!important;bottom:80px!important;right:auto!important;top:auto!important;z-index:60!important}

      /* ---- Floating Liquid Glass Topbar & 60fps GPU-Shrinking Wayon Wordmark ---- */
      body.wayon-workbench .app-brand{
        position:fixed!important;
        top:10px!important;
        left:98px!important;
        right:0!important;
        height:54px!important;
        padding:0 clamp(20px,3vw,40px)!important;
        margin:0!important;
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
        box-shadow:none!important;
        overflow:visible!important;
        display:flex!important;
        align-items:flex-start!important;
        justify-content:flex-start!important;
        pointer-events:none!important;
        z-index:40!important;
      }
      body.wayon-workbench .app-brand::before{
        content:'';
        position:fixed;
        top:0;
        left:98px;
        right:0;
        height:22px;
        background:linear-gradient(180deg,var(--apple-canvas) 0%,var(--apple-canvas) 50%,transparent 100%);
        opacity:var(--apple-scroll-p,0);
        pointer-events:none;
        z-index:0;
        will-change:opacity;
      }
      body.wayon-workbench .app-brand::after{
        content:'';
        position:absolute;
        top:0;
        bottom:0;
        left:clamp(8px,1.8vw,24px);
        right:clamp(8px,1.8vw,24px);
        border-radius:27px;
        background:linear-gradient(180deg,var(--apple-glass-bar-top) 0%,var(--apple-glass-bar-bot) 100%);
        backdrop-filter:blur(28px) saturate(210%);
        -webkit-backdrop-filter:blur(28px) saturate(210%);
        box-shadow:
          inset 0 1px .5px var(--apple-glass-rim-top),
          inset 0 -.5px 0 var(--apple-glass-rim-bot),
          0 12px 32px -10px var(--apple-glass-shadow),
          0 2px 6px var(--apple-glass-shadow-tight),
          0 0 0 .5px var(--apple-glass-hairline);
        opacity:var(--apple-scroll-p,0);
        transform:translate3d(0,calc(-4px * (1 - var(--apple-scroll-p,0))),0) scale(calc(.985 + .015 * var(--apple-scroll-p,0)));
        pointer-events:none;
        z-index:1;
        will-change:transform,opacity;
      }
      body.wayon-workbench .app-brand .brand-title{
        position:relative!important;
        z-index:2!important;
        font-size:56px!important;
        line-height:1!important;
        padding:0!important;
        margin:0!important;
        pointer-events:auto!important;
        transform-origin:0 0!important;
        transform:translate3d(calc(4px * var(--apple-scroll-p,0)),calc(8px + 5px * var(--apple-scroll-p,0)),0) scale(calc(1 - .55 * var(--apple-scroll-p,0)));
        will-change:transform;
      }
      body.wayon-workbench .ux-topbar-crumb{
        position:absolute;
        left:calc(clamp(20px,3vw,40px) + 74px);
        top:0;
        height:54px;
        display:inline-flex;
        align-items:center;
        gap:7px;
        z-index:2;
        font-size:13.5px;
        font-weight:600;
        letter-spacing:-.015em;
        color:var(--fg);
        opacity:max(0,calc((var(--apple-scroll-p,0) - .5) / .5));
        transform:translate3d(calc(-6px * (1 - var(--apple-scroll-p,0))),0,0);
        pointer-events:none;
        user-select:none;
        white-space:nowrap;
        will-change:transform,opacity;
      }
      body.wayon-workbench .ux-topbar-crumb-sep{color:var(--muted);font-weight:400;opacity:.65}
      @supports ((animation-timeline: scroll()) and (animation-range: 0% 100%)){
        @media(prefers-reduced-motion:no-preference){
          @keyframes wayon-brand-dock{
            from{transform:translate3d(0,8px,0) scale(1)}
            to{transform:translate3d(4px,13px,0) scale(.45)}
          }
          @keyframes wayon-bar-scrim{
            from{opacity:0}
            to{opacity:1}
          }
          @keyframes wayon-bar-glass{
            from{opacity:0;transform:translate3d(0,-4px,0) scale(.985)}
            to{opacity:1;transform:translate3d(0,0,0) scale(1)}
          }
          @keyframes wayon-crumb-in{
            from{opacity:0;transform:translate3d(-6px,0,0)}
            to{opacity:1;transform:translate3d(0,0,0)}
          }
          body.wayon-workbench:not(:has(#classroom-frame)) .app-brand .brand-title{
            animation:wayon-brand-dock auto linear both;
            animation-timeline:scroll(block root);
            animation-range:0px 64px;
          }
          body.wayon-workbench:not(:has(#classroom-frame)) .app-brand::before{
            animation:wayon-bar-scrim auto linear both;
            animation-timeline:scroll(block root);
            animation-range:8px 58px;
          }
          body.wayon-workbench:not(:has(#classroom-frame)) .app-brand::after{
            animation:wayon-bar-glass auto linear both;
            animation-timeline:scroll(block root);
            animation-range:8px 64px;
          }
          body.wayon-workbench:not(:has(#classroom-frame)) .ux-topbar-crumb{
            animation:wayon-crumb-in auto linear both;
            animation-timeline:scroll(block root);
            animation-range:34px 64px;
          }
        }
      }
      @media(prefers-reduced-motion:reduce){
        body.wayon-workbench .app-brand .brand-title{transform:translate3d(0,8px,0) scale(1)}
        body.wayon-workbench .app-brand::before,
        body.wayon-workbench .app-brand::after,
        body.wayon-workbench .ux-topbar-crumb{opacity:0;transform:none}
        html[data-scrolled="true"] body.wayon-workbench .app-brand .brand-title{transform:translate3d(4px,13px,0) scale(.45)}
        html[data-scrolled="true"] body.wayon-workbench .app-brand::before,
        html[data-scrolled="true"] body.wayon-workbench .app-brand::after,
        html[data-scrolled="true"] body.wayon-workbench .ux-topbar-crumb{opacity:1;transform:none}
      }
      /* Classroom view docks topbar compact immediately for maximum calendar height */
      body.wayon-workbench:has(#classroom-frame) .app-brand .brand-title{
        animation:none!important;
        transform:translate3d(4px,13px,0) scale(.45)!important;
      }
      body.wayon-workbench:has(#classroom-frame) .app-brand::before,
      body.wayon-workbench:has(#classroom-frame) .app-brand::after,
      body.wayon-workbench:has(#classroom-frame) .ux-topbar-crumb{
        animation:none!important;
        opacity:1!important;
        transform:none!important;
      }
      body.wayon-workbench .main-content{
        padding:92px clamp(20px,3vw,40px) 64px!important;
        max-width:none!important;
      }
      body.wayon-workbench:has(#classroom-frame) .main-content{
        padding:70px clamp(16px,2.4vw,32px) 16px!important;
      }
      body.wayon-workbench[data-mocks-open] .main-content{
        padding:88px clamp(20px,3vw,40px) 28px!important;
      }
    }

    /* ---- Mobile & Tablet < 1024px (zero horizontal overflow at 390px) ---- */
    @media(max-width:1023px){
      body.wayon-workbench .app-layout{display:block!important;padding-inline-start:0!important}
      body.wayon-workbench .app-brand{
        position:static!important;
        height:auto!important;
        padding:10px 16px 4px!important;
        margin:0!important;
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
        box-shadow:none!important;
        overflow:visible!important;
      }
      body.wayon-workbench .app-brand::before,
      body.wayon-workbench .app-brand::after,
      body.wayon-workbench .ux-topbar-crumb{display:none!important}
      body.wayon-workbench .app-brand .brand-title{
        font-size:38px!important;
        line-height:1!important;
        padding:0!important;
        margin:0!important;
        transform:none!important;
        animation:none!important;
      }
      body.wayon-workbench .sidebar{
        position:sticky!important;
        top:0!important;
        z-index:45!important;
        width:100%!important;
        height:auto!important;
        border:0!important;
        border-bottom:.5px solid var(--apple-hairline)!important;
        border-radius:0!important;
        background:transparent!important;
        box-shadow:none!important;
        padding:6px 10px!important;
        overflow:visible!important;
      }
      body.wayon-workbench .sidebar::before{
        content:'';
        position:absolute;
        inset:0;
        z-index:-1;
        pointer-events:none;
        background:linear-gradient(180deg,var(--apple-glass-bar-top) 0%,var(--apple-glass-bar-bot) 100%);
        backdrop-filter:blur(24px) saturate(200%);
        -webkit-backdrop-filter:blur(24px) saturate(200%);
      }
      body.wayon-workbench #tabs button.on,
      body.wayon-workbench[data-feedback-open] #tabs #nav-feedback,
      body.wayon-workbench[data-memo-open] #tabs #nav-memo,
      body.wayon-workbench[data-mocks-open] #tabs #nav-mocks,
      body.wayon-workbench[data-aircon-open] #tabs #nav-notice{
        background:var(--accent-subtle)!important;
        color:var(--accent)!important;
        border-radius:12px!important;
      }
      body.wayon-workbench .sidebar #wayon-rules-btn,
      body.wayon-workbench .sidebar #account-settings>summary{
        border:0!important;
        background:transparent!important;
        color:var(--muted)!important;
        border-radius:12px!important;
      }
      body.wayon-workbench .sidebar #account-settings>summary .ux-label{display:block;font-size:10px;margin-top:2px;opacity:.85}
      body.wayon-workbench .sidebar #account-settings>summary{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;height:48px!important;min-height:48px!important}
      body.wayon-workbench .main-content{padding:12px 14px 40px!important}
    }

    /* ---- Apple Sliding Segmented Control (#subtabs: 安排 / 完成 / 抽背 / 待催) ---- */
    body.wayon-workbench #subtabs.view-switch{
      display:inline-flex!important;
      align-items:center!important;
      gap:2px!important;
      padding:3px!important;
      border-radius:999px!important;
      background:var(--apple-seg-track)!important;
      box-shadow:inset 0 .5px 1.5px var(--apple-seg-track-inset),inset 0 -.5px 0 var(--apple-seg-track-lip)!important;
      border:0!important;
    }
    body.wayon-workbench #subtabs button,
    body.wayon-workbench #subtabs button.ux-labelled{
      height:32px!important;
      min-height:32px!important;
      padding:0 15px!important;
      border:0!important;
      border-radius:999px!important;
      background:transparent!important;
      color:var(--muted)!important;
      font-size:13px!important;
      font-weight:500!important;
      letter-spacing:-.01em!important;
      box-shadow:none!important;
      transition:color .18s var(--apple-ease),background-color .18s var(--apple-ease),box-shadow .22s var(--apple-ease);
    }
    body.wayon-workbench #subtabs button.ux-labelled>span[aria-hidden]:not(.ux-badge){display:none!important}
    body.wayon-workbench #subtabs button:hover{color:var(--fg)!important}
    body.wayon-workbench #subtabs button.on{
      background:linear-gradient(180deg,var(--apple-seg-thumb-top) 0%,var(--apple-seg-thumb-bot) 100%)!important;
      color:var(--fg)!important;
      font-weight:600!important;
      box-shadow:inset 0 1px .5px var(--apple-seg-thumb-rim),0 2px 8px -1px var(--apple-seg-thumb-shadow),0 .5px 1.5px var(--apple-glass-shadow-tight)!important;
    }
    body.wayon-workbench #subtabs .ux-badge{
      min-width:17px!important;
      height:17px!important;
      line-height:17px!important;
      padding:0 5px!important;
      border-radius:999px!important;
      font-size:10.5px!important;
      margin-left:2px!important;
    }
    @media(max-width:599px){
      body.wayon-workbench #subtabs.view-switch{display:flex!important;width:100%!important}
      body.wayon-workbench #subtabs button.ux-labelled{padding:0 6px!important;height:36px!important;min-height:36px!important}
    }

    /* ---- Apple Cupertino Controls & Borderless Soft-Shadow Cards Across All Views ---- */
    body.wayon-workbench #day-picker{
      height:36px!important;
      min-height:36px!important;
      border:0!important;
      border-radius:999px!important;
      background-color:var(--apple-surface)!important;
      box-shadow:inset 0 1px 0 var(--apple-card-rim),0 1px 3px var(--apple-glass-shadow-tight),0 0 0 .5px var(--apple-input-ring)!important;
      padding-left:36px!important;
      padding-right:32px!important;
      font-weight:500!important;
    }
    body.wayon-workbench #day-picker:focus{
      box-shadow:0 0 0 2.5px var(--accent-subtle),0 0 0 .5px var(--accent)!important;
    }
    body.wayon-workbench #days .home-btn,
    body.wayon-workbench #study-add,
    body.wayon-workbench .schedule-refresh-btn{
      height:36px!important;
      min-height:36px!important;
      padding:0 15px!important;
      border:0!important;
      border-radius:999px!important;
      font-weight:500!important;
    }
    body.wayon-workbench #study-add{
      background:var(--apple-surface)!important;
      color:var(--fg)!important;
      box-shadow:inset 0 1px 0 var(--apple-card-rim),0 1px 3px var(--apple-glass-shadow-tight),0 0 0 .5px var(--apple-input-ring)!important;
    }
    body.wayon-workbench #study-add:hover{background:var(--accent-subtle)!important;color:var(--accent)!important}
    body.wayon-workbench .workflow-icon{
      width:36px!important;
      height:36px!important;
      border:0!important;
      border-radius:999px!important;
      background:var(--apple-surface)!important;
      color:var(--muted)!important;
      box-shadow:inset 0 1px 0 var(--apple-card-rim),0 1px 3px var(--apple-glass-shadow-tight),0 0 0 .5px var(--apple-input-ring)!important;
      transition:color .16s var(--apple-ease),background-color .16s var(--apple-ease),box-shadow .16s var(--apple-ease);
    }
    body.wayon-workbench .workflow-icon:hover:not(:disabled){color:var(--accent)!important;background:var(--accent-subtle)!important}
    body.wayon-workbench #workflow-checks-panel{
      border:0!important;
      border-radius:18px!important;
      background:linear-gradient(168deg,var(--apple-glass-bar-top) 0%,var(--apple-glass-bar-bot) 100%)!important;
      backdrop-filter:blur(28px) saturate(200%)!important;
      -webkit-backdrop-filter:blur(28px) saturate(200%)!important;
      box-shadow:inset 0 1px .5px var(--apple-glass-rim-top),0 18px 44px -10px var(--apple-glass-shadow),0 0 0 .5px var(--apple-glass-hairline)!important;
    }
    body.wayon-workbench #list .item:not(.folded),
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed),
    body.wayon-workbench .ux-aircon,
    body.wayon-workbench #aircon-panel .aircon-card:not(.folded),
    body.wayon-workbench #aircon-panel .aircon-empty,
    body.wayon-workbench #memo-panel .memo-add,
    body.wayon-workbench #memo-panel .memo-list{
      border:0!important;
      border-radius:20px!important;
      background:var(--apple-surface)!important;
      box-shadow:var(--shadow-card)!important;
      transition:transform .28s var(--apple-ease-out),box-shadow .28s var(--apple-ease-out);
    }
    @media(hover:hover) and (prefers-reduced-motion:no-preference){
      body.wayon-workbench #list .item:not(.folded):hover,
      body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed):hover{
        transform:translateY(-2px);
        box-shadow:inset 0 1px 0 var(--apple-card-rim),0 14px 32px -10px var(--apple-card-hover-1),0 2px 6px var(--apple-card-hover-2),0 0 0 .5px var(--apple-card-ring)!important;
      }
    }
    body.wayon-workbench #list .item.folded,
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup.vq-collapsed,
    body.wayon-workbench #aircon-panel .aircon-card.folded{
      border:0!important;
      border-radius:16px!important;
      background:var(--apple-folded-bg)!important;
      box-shadow:0 0 0 .5px var(--apple-card-ring)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup.vq-collapsed{padding:9px 14px!important}
    body.wayon-workbench .head>.name{
      font-size:20px!important;
      font-weight:600!important;
      letter-spacing:-.022em!important;
      line-height:1.35!important;
    }
    body.wayon-workbench .copy{
      background:var(--accent)!important;
      color:#fff!important;
      border:0!important;
      border-radius:999px!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 2px 8px rgba(0,113,227,.22);
    }
    body.wayon-workbench .copy:hover{background:var(--accent-hover)!important}
    body.wayon-workbench .item.copied .copy{
      background:var(--done-bg)!important;
      color:var(--done)!important;
      box-shadow:none!important;
    }
    body.wayon-workbench .head .small{
      border-radius:12px!important;
      border:0!important;
      background:var(--apple-seg-track)!important;
      color:var(--fg-secondary)!important;
    }
    body.wayon-workbench .head .small:hover{background:var(--apple-rail-hover)!important;color:var(--fg)!important}
    body.wayon-workbench .state{
      border-radius:999px!important;
      padding:3px 10px!important;
      font-weight:500!important;
    }
    body.wayon-workbench pre{
      border:0!important;
      border-radius:14px!important;
      background:var(--code-bg)!important;
      color:var(--fg)!important;
    }
    body.wayon-workbench .ux-chip{
      border-radius:999px!important;
      border:0!important;
      padding:3px 11px!important;
    }
    body.wayon-workbench .ux-aircon button{
      border:0!important;
      border-radius:999px!important;
      background:var(--accent)!important;
      color:#fff!important;
      font-weight:500!important;
      padding:0 16px!important;
    }
    body.wayon-workbench .ux-aircon[data-copied] button{
      background:var(--apple-seg-track)!important;
      color:var(--fg)!important;
    }
    body.wayon-workbench .ux-past{
      border:0!important;
      border-radius:18px!important;
      background:var(--apple-folded-bg)!important;
      box-shadow:0 0 0 .5px var(--apple-card-ring)!important;
      padding:6px 14px!important;
    }
    body.wayon-workbench .memo-head h2,
    body.wayon-workbench .aircon-heading h2,
    body.wayon-workbench .fb-head h2{font-size:18px!important;font-weight:600!important;letter-spacing:-.02em!important}
    body.wayon-workbench #memo-panel .memo-add button{border-radius:999px!important}
    body.wayon-workbench #feedback-panel .fb-tabs{
      border:0!important;
      border-radius:999px!important;
      padding:3px!important;
      background:var(--apple-seg-track)!important;
      box-shadow:inset 0 .5px 1.5px var(--apple-seg-track-inset),inset 0 -.5px 0 var(--apple-seg-track-lip)!important;
    }
    body.wayon-workbench #feedback-panel .fb-tabs button{border-radius:999px!important;min-height:32px!important}
    body.wayon-workbench #feedback-panel .fb-tabs button.on{
      background:linear-gradient(180deg,var(--apple-seg-thumb-top) 0%,var(--apple-seg-thumb-bot) 100%)!important;
      box-shadow:inset 0 1px .5px var(--apple-seg-thumb-rim),0 2px 8px -1px var(--apple-seg-thumb-shadow)!important;
    }
    body.wayon-workbench #feedback-panel .fb-card,
    body.wayon-workbench #feedback-panel .fb-collect,
    body.wayon-workbench #feedback-panel .fb-learner,
    body.wayon-workbench #feedback-panel .fb-lesson{
      border:0!important;
      border-radius:18px!important;
      background:var(--apple-surface)!important;
      box-shadow:var(--shadow-card)!important;
    }
    body.wayon-workbench #feedback-panel .fb-btn{border-radius:999px!important}
    body.wayon-workbench #ux-student,
    body.wayon-workbench #workflow-guide{
      border:0!important;
      border-radius:26px!important;
      background:var(--apple-surface)!important;
      box-shadow:inset 0 1px .5px var(--apple-glass-rim-top),0 32px 72px -16px rgba(0,0,0,.32),0 0 0 .5px var(--apple-glass-hairline)!important;
    }
    body.wayon-workbench #ux-student::backdrop,
    body.wayon-workbench #workflow-guide::backdrop{
      background:rgba(0,0,0,.32)!important;
      backdrop-filter:blur(10px)!important;
      -webkit-backdrop-filter:blur(10px)!important;
    }
    body.wayon-workbench #wayon-rules-dialog[open]{
      border:0!important;
      border-radius:26px!important;
      background:var(--apple-canvas)!important;
      box-shadow:inset 0 1px .5px var(--apple-glass-rim-top),0 32px 84px -16px rgba(0,0,0,.36),0 0 0 .5px var(--apple-glass-hairline)!important;
    }
    body.wayon-workbench #tabs #nav-aircon,
    body.wayon-workbench #subtabs #tab-assigned{display:none!important}
  `;
  document.head.append(appleStyle);

  // ---- still-to-do counts: computed in-memory without redrawing views ---------------
  const left = {};
  const PLAN_GROUPS = [
    {members: ['Leo', 'Iven', 'Ivan'], label: 'Leo & Iven', key: 'Leo&Iven'},
    {members: ['聂彦如', '陈书进'], label: '聂彦如 & 陈书进', key: '聂彦如&陈书进'},
    {members: ['周家琪', '潘韬薄', '苏顺平'], label: '周家琪 / 潘韬薄 / 苏顺平', key: '周家琪/潘韬薄/苏顺平'},
    {members: ['戴荧', '汤馨然'], label: '戴荧 & 汤馨然', key: '戴荧&汤馨然'},
    {members: ['王明泽', '李子熙'], label: '王明泽 & 李子熙', key: '王明泽&李子熙'},
    {members: ['王子居', 'Andy'], label: '王子居 & Andy', key: '王子居&Andy'}
  ];
  const mergePlanGroupTasks = (raw, indices, presentNames) => {
    const entries = new Map();
    indices.forEach((idx, pos) => {
      const owner = presentNames[pos];
      for (const item of raw[idx]?.[3] || []) {
        const txt = String(typeof item === 'string' ? item : item?.[0] || '').trim();
        if (!txt) continue;
        let entry = entries.get(txt);
        if (!entry) { entry = {text: txt, owners: []}; entries.set(txt, entry); }
        if (!entry.owners.includes(owner)) entry.owners.push(owner);
      }
    });
    return [...entries.values()].map(entry => {
      if (entry.owners.length === presentNames.length || /^[「【][^」】]+[」】]/.test(entry.text)) return entry.text;
      const who = entry.owners.map(m => (globalThis.wayonDisplayName?.(m) || m).replace(/[【】「」]/g, '').trim()).join(' & ');
      return '「' + who + '」' + entry.text;
    });
  };
  const planRowsFor = day => {
    const raw = (typeof PLAN !== 'undefined' ? PLAN[day] : page.data._plan?.[day]) || [];
    const consumed = new Set(), rows = [];
    raw.forEach((p, i) => {
      if (consumed.has(i)) return;
      const name = (p[0] || '').replace(/[【】]/g, '').trim(), time = p[1], note = p[4] || '';
      let matchedGroup = null, matchedIndices = [];
      for (const g of PLAN_GROUPS) {
        if (!g.members.includes(name)) continue;
        const found = [];
        raw.forEach((q, j) => {
          if (!consumed.has(j) && q[1] === time && g.members.includes((q[0] || '').replace(/[【】]/g, '').trim())) found.push(j);
        });
        if (found.length >= 2) { matchedGroup = g; matchedIndices = found; break; }
      }
      if (!matchedGroup && note && /[&＆/／、]/.test(note)) {
        const found = [];
        raw.forEach((q, j) => { if (!consumed.has(j) && q[1] === time && q[4] === note) found.push(j); });
        if (found.length >= 2) matchedIndices = found;
      }
      if (matchedIndices.length >= 2) {
        matchedIndices.forEach(idx => consumed.add(idx));
        const presentNames = matchedIndices.map(idx => (raw[idx][0] || '').replace(/[【】]/g, '').trim());
        const groupLabel = matchedGroup && matchedGroup.members.every(m => presentNames.includes(m)) ? matchedGroup.label : presentNames.join(' & ');
        const groupKey = matchedGroup ? matchedGroup.key : presentNames.join('&');
        const baseTitle = p[2] || '';
        const mergedTitle = baseTitle.includes('【') ? baseTitle.replace(/【.*?】/, '【' + groupLabel + '】') : ('【' + groupLabel + '】 ' + baseTitle);
        rows.push([groupLabel, time, mergedTitle, mergePlanGroupTasks(raw, matchedIndices, presentNames), p[4], {
          isGroup: true, key: groupKey, members: presentNames,
          legacyCopyUncertain: matchedIndices.some(idx => !!raw[idx][6]?.legacyCopyUncertain)
        }]);
      } else {
        consumed.add(i);
        rows.push(p);
      }
    });
    return rows;
  };
  // The 今天 badges describe today. While another date is open, keep today's last counts.
  const showsToday = () => !page.cur || page.cur === page.today;
  const readCount = m => {
    if (['plan', 'done', 'quiz'].includes(m) && !showsToday()) return;
    // 待催 hides follow-ups that are not yet due; its own count comes from that same filter.
    if (m === 'chasing' && typeof globalThis.wayonChasingDue === 'function') { void countChasing(); return; }
    if (m === 'plan') {
      const day = page.today, rows = page.data[day] || [];
      if (page.data._schedule_status?.[day]?.status === 'error' && !rows.length) { delete left.plan; return; }
      try {
        const prows = planRowsFor(day);
        const copied = prows.filter(p => {
          const meta = p[5], cardKey = (meta && meta.isGroup) ? meta.key : p[0];
          const body = typeof ptext === 'function' ? ptext(p) : '';
          return typeof planCopyState === 'function' && !!planCopyState(cardKey, typeof planFinalText === 'function' ? planFinalText(body) : body, meta, p[6]);
        }).length;
        const extra = typeof study !== 'undefined' ? study.stats(day, 'plan') : {total: 0, copied: 0};
        left.plan = Math.max(0, (prows.length - copied) + (extra.total - extra.copied));
        return;
      } catch {}
    } else if (m === 'done') {
      const day = page.today, rows = page.data[day] || [];
      if (page.data._schedule_status?.[day]?.status === 'error' && !rows.length) { delete left.done; return; }
      const ended = endedOnly('done');
      if (ended !== undefined) { left.done = ended; return; }
    } else if (m === 'quiz') {
      const day = page.today, rows = page.data[day] || [];
      if (page.data._schedule_status?.[day]?.status === 'error' && !rows.length) { delete left.quiz; return; }
      const ended = endedOnly('quiz');
      if (ended !== undefined) { left.quiz = ended; return; }
      if (typeof qzDay !== 'undefined' && qzDay !== page.today) { delete left.quiz; return; }
    } else if (m === 'notice') {
      const nDay = noticeDay() || page.tomorrow;
      const nRows = (typeof NOTICE !== 'undefined' ? NOTICE[nDay] : page.data._notice?.[nDay]) || [];
      if (page.data._schedule_status?.[nDay]?.status === 'error' && !nRows.length) { delete left.notice; return; }
      try {
        if (typeof noticeCopied === 'function' && typeof ncDay !== 'undefined' && ncDay === nDay) {
          left.notice = nRows.filter(r => !noticeCopied(r)).length;
          return;
        }
      } catch {}
    }
    if (page.mode !== m) return;
    const text = $('#count')?.textContent || '', pair = text.match(/(\d+)\s*\/\s*(\d+)/), people = text.match(/^(\d+)\s*人待催/);
    if (pair) left[m] = Math.max(0, Number(pair[2]) - Number(pair[1]));
    else if (people) left[m] = Number(people[1]);
    else if (/未知/.test(text)) delete left[m];
    const ended = endedOnly(m); if (ended !== undefined && left[m] !== undefined) left[m] = ended;
  };
  // 抽背 / 完成 are only due once the lesson is over (as the 反馈 badge): a 17:00 lesson
  // does not light the badge in the morning. A row with no clock time (自习) counts as before.
  const bjNow = () => new Date().toLocaleTimeString('en-GB', {timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit'});
  const lessonEnded = time => {
    const ends = [...String(time || '').matchAll(/\d{1,2}:\d{2}\s*[-–~～]\s*(\d{1,2}:\d{2})/g)].map(x => x[1].padStart(5, '0')).sort();
    return !ends.length || ends.at(-1) <= bjNow();
  };
  function endedOnly(m) {
    if (!['quiz', 'done'].includes(m) || !showsToday()) return undefined;
    try {
      const rows = page.data[page.today] || [];
      if (m === 'quiz') {
        if (qzDay !== page.today) return undefined;
        return quizRows(rows).filter(r => lessonEnded(r[1]) && !(qget(qk(r)).pre && qget(qk(r)).post)).length;
      }
      const own = typeof study !== 'undefined' ? study.cards(page.today).filter(c => lessonEnded(c.time) && !study.copied(page.today, c.id, 'done')).length : 0;
      return rows.filter(r => lessonEnded(r[1]) && !get(r[0]).c).length + own;
    } catch { return undefined; }
  }
  const airconSaved = day => {
    try { return JSON.parse(localStorage.getItem('wayon-aircon-' + day) || '{}') || {}; } catch { return {}; }
  };
  const airconFor = day => {
    const api = globalThis.wayonAircon;
    if (!api?.buildRequest || !day) return null;
    const request = api.buildRequest(page.data, day);
    const saved = request.status === 'ready' ? airconSaved(day) : {};
    return {day, request, copied: request.status === 'ready' && saved[request.id]?.signature === request.text};
  };
  const airconNoticeEntry = () => {
    const target = noticeDay() || page.tomorrow || page.today;
    const curAir = airconFor(target);
    if (target === page.tomorrow && (!curAir || curAir.request.status === 'none')) {
      const todayAir = airconFor(page.today);
      if (todayAir && todayAir.request.status === 'ready' && !todayAir.copied) return todayAir;
    }
    return curAir || (target ? {day: target, request: {status: 'unknown', days: [target], text: ''}, copied: false} : null);
  };
  const airconDue = () => {
    const tAir = airconFor(page.today), mAir = airconFor(page.tomorrow);
    const tReady = tAir?.request.status === 'ready';
    const mReady = !tAir?.request.days?.includes(page.tomorrow) && mAir?.request.status === 'ready';
    return {hasReady: Boolean(tReady || mAir?.request.status === 'ready'), uncopied: (tReady && !tAir.copied ? 1 : 0) + (mReady && !mAir.copied ? 1 : 0)};
  };
  let chasingAsk = 0;
  async function countChasing() {
    const ask = ++chasingAsk;
    try {
      const n = await globalThis.wayonChasingDue();
      if (ask !== chasingAsk) return;          // a newer count is on its way
      if (n === undefined) delete left.chasing; else left.chasing = n;
      decorateNav();
    } catch (e) { console.warn('ux chasing count:', e); }
  }
  let probing = false, probed = 0;
  // Compute every view's count purely from in-memory state without calling page.render().
  function probe() {
    const active = document.activeElement;
    if (probing || !page.mode || page.mode === 'classroom' || document.body.dataset.airconOpen || document.body.dataset.memoOpen
        || document.body.dataset.feedbackOpen || document.body.dataset.mocksOpen || $('dialog[open], .vx-overlay') || (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
    probing = true;
    // 待催 is counted by its own rule without drawing the view.
    const views = ['plan', 'done', 'quiz', ...(typeof globalThis.wayonChasingDue === 'function' ? [] : ['chasing']), 'notice'];
    try { for (const m of views) readCount(m); if (views.length < 5) readCount('chasing'); }
    finally {
      probing = false; probed = Date.now();
      try { decorateNav(); } catch (e) { console.warn('ux recount:', e); }
    }
  }

  function badge(button, n) {
    let b = $(':scope > .ux-badge', button);
    if (n === undefined) { b?.remove(); return; }
    if (!b) { b = make('span', 'ux-badge'); b.setAttribute('aria-hidden', 'true'); button.append(b); }
    const text = n > 99 ? '99+' : String(n);
    if (b.textContent !== text) b.textContent = text;
    if (n) { if (b.hasAttribute('data-zero')) b.removeAttribute('data-zero'); }
    else if (!b.hasAttribute('data-zero')) b.setAttribute('data-zero', '');
  }
  function label(button, [short, long], count) {
    if (!$(':scope > .ux-label', button)) {
      for (const c of [...button.childNodes]) if (c.nodeType === 3 && c.textContent.trim()) c.remove();
      button.append(make('span', 'ux-label', short)); button.classList.add('ux-labelled');
    }
    const title = long + (count ? '（还有 ' + count + ' 项）' : '');
    if (button.title !== title) button.title = title;
    if (button.getAttribute('aria-label') !== title) button.setAttribute('aria-label', title);
  }
  // Counts made before the cloud copy arrives are counts of this device's stale state: they flashed
  // wrong numbers for a second or two. Show none until the cloud copy is in, or it is clear none is coming.
  const bornAt = Date.now();
  // Today's marks and tomorrow's notices live in two cloud rows; both must be in before the numbers are right.
  // Read-only question put to the sync layer through plan-presentation; this layer never touches it.
  const ready = day => { try { return globalThis.wayonCloudReady?.(day) === true; } catch { return false; } };
  const noticeDay = () => { try { return curN; } catch { return ''; } };
  const cloudReady = () => ready(page.today);
  const cloudComplete = () => cloudReady() && (!noticeDay() || noticeDay() === page.today || ready(noticeDay()));
  // The sync indicator already says when no cloud copy is coming (not signed in, not configured, failed).
  const noCloud = () => { const s = $('#sync'); return s?.dataset.connection === 'error' || /请登录|权限|尚未配置|失败|不可用/.test(s?.title || ''); };
  let cloudCounted = false, readyAt = 0;
  const settled = () => cloudCounted || (cloudReady() ? readyAt > 0 && Date.now() - readyAt > 3000
    : noCloud() || Date.now() - bornAt > 6000);
  function decorateNav() {
    const hold = !settled();
    const air = airconDue();
    const noticeLeft = left.notice === undefined && !air.hasReady ? undefined : (left.notice || 0) + air.uncopied;
    const todayLeft = ['plan', 'done', 'quiz', 'chasing'].some(m => left[m] !== undefined)
      ? (left.plan || 0) + (left.quiz || 0) : undefined;   // what is due today; reminders keep their own count
    for (const [id, text] of Object.entries(NAV)) {
      const b = document.getElementById(id); if (!b) continue;
      const n = id === 'nav-notice' ? noticeLeft : id === 'nav-today' ? todayLeft : undefined;
      label(b, text, hold ? undefined : n); if (hold) badge(b, undefined); else if (n !== undefined) badge(b, n);
    }
    for (const [id, text] of Object.entries(TAB)) {
      const b = document.getElementById(id); if (!b) continue;
      const n = hold ? undefined : left[id.slice(4)];
      label(b, text, n); badge(b, n);
    }
    const accSum = $('#account-settings > summary');
    if (accSum && accSum.dataset?.iconAction && !$(':scope > .ux-label', accSum)) {
      accSum.append(make('span', 'ux-label', '设置'));
      accSum.classList?.add('ux-labelled');
    }
    const brand = $('.app-brand');
    if (brand) {
      const ds = document.body?.dataset || {};
      const sectionName = ds.feedbackOpen ? '反馈' : ds.memoOpen ? '备忘' : ds.mocksOpen ? '模考'
        : ds.airconOpen ? '空调加时' : page.mode === 'notice' ? '通知' : page.mode === 'classroom' ? '教室' : '今天';
      let crumb = $(':scope > .ux-topbar-crumb', brand);
      if (!crumb) {
        crumb = make('span', 'ux-topbar-crumb');
        crumb.setAttribute('aria-hidden', 'true');
        crumb.append(make('span', 'ux-topbar-crumb-sep', '/'), make('span', 'ux-topbar-crumb-text', sectionName));
        brand.append(crumb);
      } else {
        const textNode = $('.ux-topbar-crumb-text', crumb);
        if (textNode && textNode.textContent !== sectionName) textNode.textContent = sectionName;
      }
    }
    try { if (document.title !== 'Wayon-edu') document.title = 'Wayon-edu'; } catch {}
  }

  // ---- has the system work gone out: one word per card ----------------------------
  function assignLines(names, day) {
    const state = page.data._assign_state?.[day]; if (!state) return [];
    const byName = new Map(Object.entries(state).map(([name, lines]) => [clean(name), lines]));
    const sent = new Map((page.data._assigned?.[day]?.students || []).map(s => [clean(s.name), s.tasks || []]));
    const out = [];
    for (const name of names) for (const [text, key] of byName.get(name) || [])
      out.push({name, text, key, details: (sent.get(name) || []).find(t => clean(t.text) === clean(text))?.details || []});
    return out;
  }
  function decorateCards() {
    const m = page.mode, day = page.cur;
    if (!['plan', 'done'].includes(m)) return;
    for (const card of $$('#list > .item, #list .item:not(.aircon-card)')) {
      // A self-study card lists the teacher's own items; the system-homework word belongs on the class card only.
      const nameEl = $('.head .name', card); if (!nameEl || card.classList.contains('folded') || card.classList.contains('study-card')) continue;
      const names = members(nameEl.textContent), sig = day + '|' + names.join(',');
      const lines = assignLines(names, day), existing = $(':scope > .ux-assign', card);
      const summary = JSON.stringify(lines);
      if (existing?.dataset.sig === sig + summary) continue;
      existing?.remove(); if (!lines.length) continue;
      const row = make('div', 'ux-assign'); row.dataset.sig = sig + summary;
      const groups = {};
      for (const line of lines) (groups[line.key] ||= []).push(line);
      const detail = make('div', 'ux-assign-detail'); detail.hidden = true;
      for (const line of lines) {
        const item = make('div'), left = make('span');
        left.append((names.length > 1 ? line.name + '：' : '') + line.text);
        for (const d of line.details) left.append(make('small', '', d));
        const word = make('b', '', STATE[line.key][0]); word.dataset.kind = STATE[line.key][1];
        item.append(left, word); detail.append(item);
      }
      for (const key of ['check', 'not_sent', 'waiting', 'decision', 'sent']) {
        if (!groups[key]) continue;
        const chip = make('button', 'ux-chip', (key === 'sent' ? '✓ ' : '') + STATE[key][0] + (groups[key].length > 1 || key !== 'sent' ? ' ' + groups[key].length + ' 项' : ''));
        chip.type = 'button'; chip.dataset.kind = STATE[key][1]; chip.title = '系统作业布置情况，点开看明细';
        chip.setAttribute('aria-expanded', 'false');
        chip.onclick = () => { detail.hidden = !detail.hidden; $$('.ux-chip', row).forEach(c => c.setAttribute('aria-expanded', String(!detail.hidden))); };
        row.append(chip);
      }
      row.append(detail); $('.head', card).after(row);
    }
  }

  // ---- notices carry the air-conditioning request ---------------------------------
  function decorateNotice() {
    const old = $('#list > .ux-aircon');
    if (page.mode !== 'notice') { old?.remove(); return; }
    const list = $('#list'); if (!list) return;
    const air = airconNoticeEntry();
    if (!air) { old?.remove(); return; }
    const status = air.request.status;
    const sig = [air.day, status, air.request.text || '', air.copied].join('|');
    if (old?.dataset.sig === sig) return;
    old?.remove();
    const row = make('div', 'ux-aircon'); row.dataset.sig = sig;
    if (status === 'ready' && air.copied) row.dataset.copied = '';
    const when = status === 'ready' ? ((air.request.text.match(/开启时间：(.+)/) || [])[1] || '') : '';
    const summary = status === 'ready'
      ? air.request.days.map(md).join('/') + (when ? ' · ' + when : '')
      : status === 'none'
      ? md(air.day) + ' 无需加时 · 可选其他日期'
      : md(air.day) + ' 课表待核实 · 可选其他日期';
    row.append(make('b', '', '空调加时申请'), make('span', '', summary));
    const open = make('button', '', status === 'ready' && !air.copied ? '去复制' : '查看'); open.type = 'button';
    open.onclick = () => {
      if (typeof globalThis.wayonAircon?.open === 'function') globalThis.wayonAircon.open(air.day);
      else document.getElementById('nav-aircon')?.click();
    };
    row.append(open); list.prepend(row);
  }

  // ---- reminders: exam already over goes to the bottom, collapsed -------------------
  function decorateChasing() {
    if (page.mode !== 'chasing') return;
    const list = $('#list'); if (!list) return;
    const past = $$(':scope > .item:not(.folded)', list).filter(card => {
      const date = ($('.head .name', card)?.textContent.match(/考期[：:]\s*(\d{4}-\d{2}-\d{2})/) || [])[1];
      return date && date < page.today;
    });
    let box = $(':scope > .ux-past', list);
    if (past.length) {
      if (!box) { box = make('details', 'ux-past'); box.append(make('summary')); }
      for (const card of past) box.append(card);
      const stoppedShelf = $(':scope > .chasing-stopped', list);
      if (stoppedShelf) stoppedShelf.before(box); else list.append(box);
    } else if (box && !$('.item', box)) {
      box.remove(); box = null;
    }
    if (box) $('summary', box).textContent = '考期已过 · ' + $$('.item', box).length + ' 人（展开查看；仍可复制催交或停止催交）';
    for (const folded of $$(':scope > .item.folded', list)) {
      for (const node of folded.childNodes) {
        if (node.nodeType !== 3) continue;
        const next = node.textContent.replace(/^\d+\.\s*/, '');
        if (next !== node.textContent) node.textContent = next;
        break;
      }
    }
    for (const shelfCard of $$(':scope > .ux-past .item, :scope > .chasing-stopped .item', list)) {
      const name = $('.head .name', shelfCard), next = name?.textContent.replace(/^\d+\.\s*/, '');
      if (name && name.textContent !== next) name.textContent = next;
    }
    // Keep active chasing cards cleanly numbered 1..N without colliding with folded shelves.
    $$(':scope > .item:not(.folded)', list).forEach((card, i) => {
      const name = $('.head .name', card); if (!name) return;
      const text = (i + 1) + '. ' + name.textContent.replace(/^\d+\.\s*/, '');
      if (name.textContent !== text) name.textContent = text;
    });
  }

  // ---- the wordmark (owner request 2026-11-11): hand-drawn "Wayon" (capital W) in the style of the owner's leo mark.
  // The o is shared by both words. Tapping it turns "way…n" into "le…", the blob reshapes, the o stays put;
  // tapping the o again turns it back. Nothing hints at it, and every page load starts as wayon.
  const BLOB = {wayon: 'M400,110 C600,70 880,120 990,250 C1090,370 990,540 760,575 C540,610 330,540 300,380 C275,235 285,130 400,110 Z',
                leo: 'M520,80 C680,60 900,170 980,290 C1050,400 960,560 770,575 C590,590 470,520 450,380 C430,240 400,100 520,80 Z'};
  const MARK = '<svg class="ux-mark" viewBox="20 60 1180 560" role="img" aria-label="Wayon">'
    + '<path class="ux-mark-blob" fill="#D87756" d="' + BLOB.wayon + '"/>'
    + '<g fill="none" stroke="currentColor" stroke-width="42" stroke-linecap="round" stroke-linejoin="round">'
    + '<g class="ux-mark-wayon">'
    + '<path d="M45,438 C75,462 105,468 122,440 C138,410 124,240 116,150 C130,300 145,452 178,452 C210,452 222,320 232,240 C242,330 256,452 290,452 C325,452 345,300 348,160 C349,132 338,126 326,146"/>'
    + '<path d="M512,318 C495,292 458,286 432,304 C397,330 397,438 440,452 C480,464 506,412 514,330 C512,382 516,440 545,452 C566,460 585,440 600,410"/>'
    + '<path d="M600,410 C612,370 610,320 612,300 C618,380 625,450 660,452 C695,454 705,360 708,300 L700,520 C694,585 660,610 630,590 C600,570 625,520 690,480 C720,462 745,440 760,420"/>'
    + '<path d="M948,318 C955,360 955,420 950,452 C962,360 985,300 1025,300 C1060,300 1060,350 1058,400 C1056,440 1070,456 1095,450 C1120,444 1140,420 1160,395"/></g>'
    + '<g class="ux-mark-leo">'
    + '<path d="M330,430 C365,455 395,470 430,458 C480,440 505,360 520,260 C530,190 540,130 568,128 C598,126 596,190 585,240 C570,310 530,370 515,410 C500,450 520,470 552,462 C585,454 610,420 625,395"/>'
    + '<path d="M625,395 C640,350 660,290 690,290 C716,290 715,330 700,355 C685,380 655,405 640,415 C648,455 680,465 710,458 C735,452 752,440 766,420"/>'
    + '<path d="M948,318 C975,335 990,360 1000,380"/></g>'
    + '<path class="ux-mark-o" d="M845,300 C800,295 765,330 762,385 C760,435 790,458 822,455 C865,450 885,400 878,345 C873,315 858,300 845,300 Z M865,315 C890,300 925,300 948,318"/>'
    + '</g><circle class="ux-mark-hit" cx="835" cy="378" r="105" fill="transparent" tabindex="0" role="button" aria-label="o"/></svg>';
  function brandMark() {
    const h = $('.app-brand .brand-title');
    if (!h || h.dataset.uxMark || h.textContent.trim() !== 'Wayon') return;
    h.dataset.uxMark = '1';
    if (!$('#ux-brand-style')) {
      const css = make('style'); css.id = 'ux-brand-style';
      css.textContent = '.app-brand .brand-title .ux-mark{display:block;height:1.12em;width:auto;max-width:100%;overflow:visible;color:var(--fg,#1e1e1e)}'
        + '.ux-mark .ux-mark-blob{transition:d .55s cubic-bezier(.32,.72,0,1)}'
        + '.ux-mark .ux-mark-wayon,.ux-mark .ux-mark-leo{transition:opacity .35s ease,transform .55s cubic-bezier(.32,.72,0,1)}'
        + '.ux-mark .ux-mark-leo{opacity:0;transform:translateX(60px)}'
        + '.ux-mark[data-leo] .ux-mark-wayon{opacity:0;transform:translateX(-60px)}'
        + '.ux-mark[data-leo] .ux-mark-leo{opacity:1;transform:none}'
        + '.ux-mark .ux-mark-hit{cursor:default;outline:none;-webkit-tap-highlight-color:transparent}'
        + '.ux-mark .ux-mark-hit:focus-visible{stroke:var(--accent,#0071e3);stroke-width:6}'
        + '@media (prefers-reduced-motion:reduce){.ux-mark *{transition:none!important}}'
        + '@media (prefers-color-scheme:dark){.ux-mark{color:#f5f5f7}}';
      document.head.append(css);
    }
    h.innerHTML = MARK;   // fixed markup above, no data
    const svg = $('.ux-mark', h), blob = $('.ux-mark-blob', svg), hit = $('.ux-mark-hit', svg);
    const flip = () => {
      const leo = !svg.hasAttribute('data-leo');
      if (leo) svg.setAttribute('data-leo', ''); else svg.removeAttribute('data-leo');
      blob.setAttribute('d', leo ? BLOB.leo : BLOB.wayon); blob.style.d = 'path("' + (leo ? BLOB.leo : BLOB.wayon) + '")';
      svg.setAttribute('aria-label', leo ? 'leo' : 'Wayon');
    };
    hit.addEventListener('click', flip);
    hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  }

  // ---- one page about one student --------------------------------------------------
  let dialog = null;
  async function admitChasingDetails(details, policy) {
    const activeFrom = '2026-10-25';
    const proofs = new Set(policy?.schema === 1 && policy.active_from === activeFrom && Array.isArray(policy.tokens)
      ? policy.tokens.filter(x => /^[a-f0-9]{64}$/.test(x)) : []);
    const out = [];
    for (const item of details || []) {
      const date = String(item.date || ''), id = String(item.id || '');
      const stamp = new Date(date + 'T00:00:00Z');
      let allowed = /^\d{4}-\d{2}-\d{2}$/.test(date) && id && Number.isFinite(stamp.getTime()) && stamp.toISOString().slice(0, 10) === date && date < activeFrom;
      if (!allowed && /^\d{4}-\d{2}-\d{2}$/.test(date) && id && proofs.size && globalThis.crypto?.subtle?.digest) {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode('wayon-reminder-v1:' + date + ':' + id));
        allowed = proofs.has([...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join(''));
      }
      if (allowed) out.push(item);
    }
    return out;
  }
  async function studentPage(raw) {
    const names = members(raw); if (!names.length) return;
    const data = page.data, mine = v => String(v || '').split(/[&＆/／、]/).some(n => names.includes(shown(n)));
    dialog ||= (() => { const d = make('dialog'); d.id = 'ux-student'; d.addEventListener('click', e => { if (e.target === d) d.close(); }); document.body.append(d); return d; })();
    const dayTaskVisible = (day, name, t, idx) => {
      if (day === page.cur && typeof taskVisible === 'function') return taskVisible(name, t, idx);
      const lbl = typeof t === 'string' ? t : t[0];
      if (lbl !== '课堂生词抽背') return true;
      const sessions = (data._sess?.[day] || []).filter(s => String(s[0] || '').split(/[&＆/／、]/).some(n => shown(n) === shown(name) || clean(n) === clean(name)));
      return !sessions.length || sessions.some(s => s[4] !== '线上');
    };
    const days = Object.keys(data).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    const tasks = [];
    for (const day of days) {
      for (const row of data[day] || []) {
        if (!mine(row[0])) continue;
        let marks = {};
        try {
          marks = (day === page.cur && typeof st !== 'undefined' && st?.[row[0]])
            ? st[row[0]]
            : ((JSON.parse(localStorage.getItem('wayon-done-' + day) || '{}') || {})[row[0]] || {});
        } catch {}
        const own = Array.isArray(marks.tk) ? marks.tk.map(t => [t, '', '']) : row[3] || [];
        own.forEach((t, i) => {
          if (!dayTaskVisible(day, row[0], t, i)) return;
          const mark = (marks.m || {})[i] ?? t[1];
          tasks.push([(day === page.today ? '今天 ' : md(day) + ' ') + (typeof t === 'string' ? t : t[0]), mark === 'ok' ? '✅ 完成' : mark === 'no' ? '❌ 未完成' : day > page.today ? '' : '未标', mark === 'ok' ? 'ok' : mark === 'no' ? 'bad' : '']);
        });
      }
      if (typeof study !== 'undefined' && typeof study.cards === 'function') {
        for (const card of study.cards(day)) {
          if (!mine(card.studentName)) continue;
          for (const t of card.tasks || []) {
            tasks.push([(day === page.today ? '今天 ' : md(day) + ' ') + '（自习）' + t.text, t.mark === 'ok' ? '✅ 完成' : t.mark === 'no' ? '❌ 未完成' : day > page.today ? '' : '未标', t.mark === 'ok' ? 'ok' : t.mark === 'no' ? 'bad' : '']);
          }
        }
      }
    }
    const system = [];
    for (const day of days) for (const line of assignLines(names, day))
      system.push([(day === page.today ? '今天 ' : md(day) + ' ') + line.text + (line.details.length ? '（' + line.details.join('；') + '）' : ''), STATE[line.key][0], STATE[line.key][1]]);
    const owed = [];
    const mergedChasing = typeof chasingRows === 'function' ? chasingRows(page.chasing || []) : (page.chasing || []);
    for (const row of mergedChasing) {
      if (!mine(row.name) && !(row.chasing_aliases || []).some(mine)) continue;
      const stopped = typeof chasingStopIds === 'function' ? chasingStopIds(row) : (row.stopped_ids || []).map(String);
      const done = typeof chasingDoneIds === 'function' ? chasingDoneIds(row) : (row.teacher_completed_ids || []).map(String);
      const rawDetails = (row.uncompleted_details || []).filter(d => !stopped.includes(String(d.id)) && !done.includes(String(d.id)));
      const admitted = await admitChasingDetails(rawDetails, data._reminder_admission);
      const items = typeof chasingDisplayItems === 'function' ? chasingDisplayItems(admitted) : admitted;
      for (const d of items) owed.push([d.title || '', (d.date || row.prev_date || '') + ' 布置', '']);
    }
    const lessons = [];
    for (const day of Object.keys(data._sess || {}).sort()) for (const s of data._sess[day] || [])
      if (mine(s[0])) lessons.push([(day === page.today ? '今天' : day === page.tomorrow ? '明天' : md(day)) + ' ' + s[1] + ' · ' + (s[2] || '') + (s[3] ? ' · ' + s[3] : ''), s[4] || '', '']);
    dialog.replaceChildren();
    const head = make('div', 'ux-st-head'), close = make('button', '', '×'); close.type = 'button'; close.setAttribute('aria-label', '关闭'); close.onclick = () => dialog.close();
    head.append(make('h2', '', names.join(' & ')), close);
    const body = make('div', 'ux-st-body');
    const section = (title, rows, empty) => {
      body.append(make('h3', '', title));
      if (!rows.length) { body.append(make('div', 'ux-st-empty', empty)); return; }
      for (const [main, side, kind] of rows) { const r = make('div', 'ux-st-row'); r.append(make('span', '', main)); if (side) { const e = make(kind ? 'em' : 'small', '', side); if (kind) e.dataset.kind = kind; r.append(e); } body.append(r); }
    };
    section('任务与完成情况', tasks, '页面里这几天没有这位学生的任务。');
    section('系统作业布置', system, '这几天没有需要系统布置的作业。');
    section('欠交作业', owed, '没有欠交。');
    section('近期课程', lessons.reverse(), '近期课表里没有这位学生的课。');
    body.append(make('div', 'ux-st-note', '只汇总本页面已有的数据：任务为昨天到明天，课程为最近一周；完成标记取自本机记录。'));
    dialog.append(head, body);
    if (!dialog.open) dialog.showModal();
  }
  document.addEventListener('click', event => {
    const name = event.target.closest?.('#list .item .head .name');
    if (name && !event.target.closest('button,a,input,textarea,summary')) { void studentPage(name.textContent); return; }
  });
  // A task delete sits right beside the completion mark: ask first.
  document.addEventListener('click', event => {
    const del = event.target.closest?.('#list .del-btn');
    if (!del || del.dataset.uxConfirmed) return;
    const text = del.closest('.task')?.querySelector('textarea,.txt')?.value || '这项任务';
    if (!globalThis.confirm('删除「' + String(text).slice(0, 40) + '」？\n删除后今天的清单里不再显示这一项。')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);

  // ---- a group the user opened stays open across redraws --------------------------------
  // The page rebuilds its list on every change (a mark, a cloud update, a recount), which closed any
  // <details> the user had opened. Remember those by view, day, card and heading; re-open after a redraw.
  let lastUser = 0;
  const userOpened = new Set();
  const cardName = el => { const card = el.closest('.item'); return card ? ($('.head .name', card)?.textContent || '') : ''; };
  const detailKey = el => [page.mode, page.cur, el.className, cardName(el),
    ($(':scope > summary', el)?.textContent || '').replace(/[0-9]+/g, '').trim().slice(0, 24)].join('|').replace(/^([^|]*\|[^|]*\|[^|]*\|)[0-9]+\.\s*/, '$1');
  document.addEventListener('toggle', event => {
    const el = event.target;
    if (!(el instanceof HTMLDetailsElement) || !el.closest('#list') || Date.now() - lastUser > 800) return;   // only the user's own click
    if (el.open) userOpened.add(detailKey(el)); else userOpened.delete(detailKey(el));
  }, true);
  function reopen() {
    if (!userOpened.size) return;
    for (const el of $$('#list details')) if (!el.open && userOpened.has(detailKey(el))) el.open = true;
  }

  // ---- keep everything applied as the page re-renders --------------------------------
  let queued = false;
  function apply() {
    queued = false;
    if (probing) return;
    // The cloud copy has just been applied: count every view once on it, then let the numbers show.
    if (!cloudCounted && cloudReady()) { readyAt ||= Date.now(); if (cloudComplete()) { probe(); cloudCounted = probed > 0 && Date.now() - probed < 50; } }
    if (page.mode && !document.body.dataset.airconOpen && !document.body.dataset.memoOpen && !document.body.dataset.feedbackOpen && !document.body.dataset.mocksOpen) readCount(page.mode);
    try { decorateNav(); decorateCards(); decorateNotice(); decorateChasing(); reopen(); brandMark(); } catch (e) { console.warn('ux:', e); }
  }
  function initScrollDock() {
    const docEl = document.documentElement;
    if (!docEl || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const supportsSDA = typeof globalThis.CSS?.supports === 'function'
      && globalThis.CSS.supports('(animation-timeline: scroll()) and (animation-range: 0% 100%)');
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    const syncScroll = () => {
      rafId = 0;
      const y = Math.max(0, Number(window.scrollY) || 0);
      const p = Math.min(1, y / 64);
      if (!supportsSDA || reduced) docEl.style?.setProperty?.('--apple-scroll-p', p.toFixed(4));
      const docked = y > 28 ? 'true' : 'false';
      if (docEl.dataset && docEl.dataset.scrolled !== docked) docEl.dataset.scrolled = docked;
    };
    syncScroll();
    window.addEventListener('scroll', () => {
      if (!rafId) rafId = requestAnimationFrame(syncScroll);
    }, {passive: true});
  }
  const schedule = () => { if (!queued && !probing) { queued = true; requestAnimationFrame(apply); } };
  function start() {
    initScrollDock();
    // A count read for a view you are not on goes stale when marks change underneath it — the cloud copy arriving
    // after the first count, or another device. When the list redraws on its own (not right after a tap or a key),
    // count every view again once it has settled.
    let recount = 0;
    ['pointerdown', 'keydown', 'input'].forEach(t => document.addEventListener(t, () => { lastUser = Date.now(); }, true));
    const inList = n => (n.nodeType === 1 ? n : n.parentElement)?.closest?.('#list');
    const inNav = n => (n.nodeType === 1 ? n : n.parentElement)?.closest?.('#tabs, #subtabs, .sidebar-footer');
    new MutationObserver(records => {
      if (records.some(r => inNav(r.target))) {
        try {
          if (page.mode && !document.body.dataset.airconOpen && !document.body.dataset.memoOpen && !document.body.dataset.feedbackOpen && !document.body.dataset.mocksOpen) readCount(page.mode);
          decorateNav();
        } catch (e) { console.warn('ux nav:', e); }
      }
      schedule();
      if (probing || Date.now() - probed < 1000 || Date.now() - lastUser < 800 || !records.some(r => inList(r.target))) return;
      clearTimeout(recount);
      recount = setTimeout(() => { if (Date.now() - lastUser >= 800) { probe(); apply(); } }, 1200);
    }).observe(document.body, {childList: true, subtree: true, characterData: true});
    apply();
    setTimeout(() => { probe(); apply(); }, 1200);
    setTimeout(apply, 6100);   // no cloud copy came: show this device's counts
    // Local marks may have changed elsewhere (another tab, a cloud sync): recount when the page is looked at again.
    const again = () => { if (document.visibilityState === 'visible' && Date.now() - probed > 60000) { probe(); apply(); } };
    document.addEventListener('visibilitychange', again); window.addEventListener('focus', again);
    // A lesson ending turns into something due without a redraw; re-check the clock once a minute.
    setInterval(() => {
      if (document.hidden || probing) return;
      let changed = false;
      for (const m of ['quiz', 'done']) {
        const n = endedOnly(m);
        if (n !== undefined && left[m] !== undefined && left[m] !== n) { left[m] = n; changed = true; }
      }
      if (changed) decorateNav();
    }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true}); else start();
})();
