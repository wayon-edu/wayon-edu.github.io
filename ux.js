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
    'nav-feedback': ['反馈', '课堂反馈'], 'nav-memo': ['备忘', '备忘录'], 'nav-mocks': ['模考', '模考链接'], 'nav-ledger': ['教务', '教务管理'], 'wayon-rules-btn': ['规则', '任务规则']};
  const TAB = {'tab-plan': ['安排', '任务安排：复制发群'], 'tab-done': ['完成', '完成记录：勾选完成情况'],
    'tab-quiz': ['抽背', '课前 / 课后抽背'], 'tab-chasing': ['待催', '待催作业']};
  const STATE = {sent: ['已布置', 'ok'], waiting: ['上批未完成', 'wait'], not_sent: ['未布置', 'todo'], decision: ['待老师安排', 'wait'], check: ['需核对', 'bad']};

  const style = make('style'); style.id = 'wayon-ux-style'; style.textContent = `
    .ux-label{display:block;font-size:10px;line-height:1.1;letter-spacing:0;font-weight:500;color:inherit;opacity:.85;margin-top:2px;pointer-events:none}
    #tabs button,#wayon-rules-btn,#nav-ledger{position:relative}
    .wayon-workbench #tabs button.ux-labelled,.wayon-workbench #wayon-rules-btn.ux-labelled,.wayon-workbench #nav-ledger.ux-labelled{display:flex!important;flex-direction:column;align-items:center;justify-content:center;height:48px!important;min-height:48px;padding-top:4px;padding-bottom:3px}
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
    .ux-aircon[data-copied]:not([data-multi]) b:after,.ux-aircon-item[data-copied] span:after{content:' · 已复制';color:#1a7f37;font-weight:500}
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
      body.wayon-workbench #tabs button.ux-labelled,body.wayon-workbench #wayon-rules-btn.ux-labelled,body.wayon-workbench #nav-ledger.ux-labelled{flex:0 0 auto;scroll-snap-align:start;width:44px!important;min-width:44px!important;position:relative!important;left:auto!important;right:auto!important}
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
    @media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .ux-chip[data-kind=ok],:root:not([data-theme="light"]) .ux-aircon[data-copied]:not([data-multi]) b:after,:root:not([data-theme="light"]) .ux-aircon-item[data-copied] span:after,:root:not([data-theme="light"]) .ux-st-row em[data-kind=ok]{color:#4ac26b}:root:not([data-theme="light"]) .ux-chip[data-kind=todo],:root:not([data-theme="light"]) .ux-st-row em[data-kind=todo]{color:#f0883e}:root:not([data-theme="light"]) .ux-chip[data-kind=wait],:root:not([data-theme="light"]) .ux-st-row em[data-kind=wait]{color:#d4a72c}}
    :root[data-theme="dark"] .ux-chip[data-kind=ok],:root[data-theme="dark"] .ux-aircon[data-copied]:not([data-multi]) b:after,:root[data-theme="dark"] .ux-aircon-item[data-copied] span:after,:root[data-theme="dark"] .ux-st-row em[data-kind=ok]{color:#4ac26b}
    :root[data-theme="dark"] .ux-chip[data-kind=todo],:root[data-theme="dark"] .ux-st-row em[data-kind=todo]{color:#f0883e}
    :root[data-theme="dark"] .ux-chip[data-kind=wait],:root[data-theme="dark"] .ux-st-row em[data-kind=wait]{color:#d4a72c}
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
        padding-inline-start:100px!important;
        min-height:100dvh;
      }
      body.wayon-workbench .sidebar{
        position:fixed!important;
        inset-block:12px!important;
        inset-inline-start:12px!important;
        width:76px!important;
        min-width:76px!important;
        height:calc(100dvh - 24px)!important;
        padding:8px!important;
        border:0!important;
        border-radius:var(--wayon-r-panel,24px)!important;
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
        border-radius:var(--wayon-r-panel,24px);
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
      body.wayon-workbench:not([data-feedback-open]):not([data-memo-open]):not([data-mocks-open]):not([data-ledger-open]):not([data-aircon-open]) #tabs button.on,
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
      body.wayon-workbench:not([data-feedback-open]):not([data-memo-open]):not([data-mocks-open]):not([data-ledger-open]):not([data-aircon-open]) #tabs button.on .ux-label,
      body.wayon-workbench[data-feedback-open] #tabs #nav-feedback .ux-label,
      body.wayon-workbench[data-memo-open] #tabs #nav-memo .ux-label,
      body.wayon-workbench[data-mocks-open] #tabs #nav-mocks .ux-label,
      body.wayon-workbench[data-aircon-open] #tabs #nav-notice .ux-label{font-weight:600!important}
      body.wayon-workbench[data-feedback-open] #tabs button:not(#nav-feedback),
      body.wayon-workbench[data-memo-open] #tabs button:not(#nav-memo),
      body.wayon-workbench[data-mocks-open] #tabs button:not(#nav-mocks),
      body.wayon-workbench[data-ledger-open] #tabs button:not(#nav-ledger),
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
      body.wayon-workbench .sidebar #nav-ledger,
      body.wayon-workbench .sidebar #nav-ledger.ux-labelled,
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
        cursor:pointer!important;
        transition:background-color .16s var(--apple-ease),color .16s var(--apple-ease),box-shadow .22s var(--apple-ease),transform .16s var(--apple-ease);
      }
      body.wayon-workbench .sidebar #nav-ledger:hover,
      body.wayon-workbench .sidebar #wayon-rules-btn:hover,
      body.wayon-workbench .sidebar #account-settings>summary:hover{
        background:var(--apple-rail-hover)!important;
        color:var(--fg)!important;
      }
      body.wayon-workbench .sidebar #nav-ledger:active{transform:scale(.95)}
      body.wayon-workbench[data-ledger-open]:not([data-ledger-space="private"]) .sidebar #nav-ledger,
      body.wayon-workbench[data-ledger-open]:not([data-ledger-space="private"]) .sidebar #nav-ledger.ux-labelled{
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
      body.wayon-workbench[data-ledger-open]:not([data-ledger-space="private"]) .sidebar #nav-ledger .ux-label{font-weight:600!important}
      body.wayon-workbench .sidebar #nav-ledger svg,
      body.wayon-workbench .sidebar #wayon-rules-btn svg,
      body.wayon-workbench .sidebar #account-settings>summary svg{width:17px!important;height:17px!important;flex:none}
      body.wayon-workbench .sidebar #nav-ledger .ux-label,
      body.wayon-workbench .sidebar #wayon-rules-btn .ux-label,
      body.wayon-workbench .sidebar #account-settings>summary .ux-label{font-size:10px!important;font-weight:500!important;margin-top:0!important;opacity:1!important}
      body.wayon-workbench .sidebar #account-settings{width:60px!important;min-width:60px!important;padding:0!important;margin:0!important}
      body.wayon-workbench .sidebar #account-settings[open]{
        position:fixed!important;
        left:98px!important;
        bottom:16px!important;
        width:min(400px,calc(100vw - 118px))!important;
        padding:18px!important;
        z-index:100!important;
        border:0!important;
        border-radius:var(--wayon-r-panel,24px)!important;
        background:var(--apple-surface)!important;
        box-shadow:0 24px 64px -12px rgba(0,0,0,.28),0 0 0 .5px var(--apple-glass-hairline)!important;
      }
      body.wayon-workbench .sidebar #workflow-tools{flex-direction:column!important;align-items:center!important;gap:6px!important;margin:4px 0 0!important}
      body.wayon-workbench .sidebar #workflow-checks-panel{position:fixed!important;left:98px!important;bottom:80px!important;right:auto!important;top:auto!important;z-index:60!important}

      /* ---- Floating Liquid Glass Topbar & 60fps GPU-Shrinking Wayon Wordmark ---- */
      body.wayon-workbench .app-brand{
        position:fixed!important;
        top:10px!important;
        left:100px!important;
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
        left:100px;
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
        border-radius:var(--wayon-r-bar,26px);
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
          body.wayon-workbench .app-brand .brand-title{
            animation:wayon-brand-dock auto linear both;
            animation-timeline:scroll(block root);
            animation-range:0px 64px;
          }
          body.wayon-workbench .app-brand::before{
            animation:wayon-bar-scrim auto linear both;
            animation-timeline:scroll(block root);
            animation-range:8px 58px;
          }
          body.wayon-workbench .app-brand::after{
            animation:wayon-bar-glass auto linear both;
            animation-timeline:scroll(block root);
            animation-range:8px 64px;
          }
          body.wayon-workbench .ux-topbar-crumb{
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
      /* Classroom view docks topbar compact immediately for maximum calendar height (only when classroom itself is active, not overlays) */
      body.wayon-workbench[data-mode="classroom"]:not([data-mocks-open]):not([data-feedback-open]):not([data-memo-open]):not([data-ledger-open]):not([data-aircon-open]):has(#classroom-frame) .app-brand .brand-title{
        animation:none!important;
        transform:translate3d(4px,13px,0) scale(.45)!important;
      }
      body.wayon-workbench[data-mode="classroom"]:not([data-mocks-open]):not([data-feedback-open]):not([data-memo-open]):not([data-ledger-open]):not([data-aircon-open]):has(#classroom-frame) .app-brand::before,
      body.wayon-workbench[data-mode="classroom"]:not([data-mocks-open]):not([data-feedback-open]):not([data-memo-open]):not([data-ledger-open]):not([data-aircon-open]):has(#classroom-frame) .app-brand::after,
      body.wayon-workbench[data-mode="classroom"]:not([data-mocks-open]):not([data-feedback-open]):not([data-memo-open]):not([data-ledger-open]):not([data-aircon-open]):has(#classroom-frame) .ux-topbar-crumb{
        animation:none!important;
        opacity:1!important;
        transform:none!important;
      }
      body.wayon-workbench .main-content{
        padding:92px clamp(20px,3vw,40px) 64px!important;
        max-width:none!important;
      }
      body.wayon-workbench[data-mode="classroom"]:not([data-mocks-open]):not([data-feedback-open]):not([data-memo-open]):not([data-ledger-open]):not([data-aircon-open]):has(#classroom-frame) .main-content{
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
      body.wayon-workbench:not([data-feedback-open]):not([data-memo-open]):not([data-mocks-open]):not([data-ledger-open]):not([data-aircon-open]) #tabs button.on,
      body.wayon-workbench[data-feedback-open] #tabs #nav-feedback,
      body.wayon-workbench[data-memo-open] #tabs #nav-memo,
      body.wayon-workbench[data-mocks-open] #tabs #nav-mocks,
      body.wayon-workbench[data-aircon-open] #tabs #nav-notice{
        background:var(--wayon-brand-soft)!important;
        color:var(--wayon-brand)!important;
        border-radius:var(--wayon-r-nav)!important;
      }
      body.wayon-workbench[data-feedback-open] #tabs button:not(#nav-feedback),
      body.wayon-workbench[data-memo-open] #tabs button:not(#nav-memo),
      body.wayon-workbench[data-mocks-open] #tabs button:not(#nav-mocks),
      body.wayon-workbench[data-ledger-open] #tabs button:not(#nav-ledger),
      body.wayon-workbench[data-aircon-open] #tabs button:not(#nav-notice){
        background:transparent!important;
        color:var(--muted)!important;
      }
      body.wayon-workbench .sidebar #nav-ledger,
      body.wayon-workbench .sidebar #wayon-rules-btn,
      body.wayon-workbench .sidebar #account-settings>summary{
        border:0!important;
        background:transparent!important;
        color:var(--muted)!important;
        border-radius:var(--wayon-r-nav)!important;
      }
      body.wayon-workbench[data-ledger-open]:not([data-ledger-space="private"]) .sidebar #nav-ledger{
        background:var(--accent-subtle)!important;
        color:var(--accent)!important;
        border-radius:var(--wayon-r-nav)!important;
      }
      body.wayon-workbench .sidebar #nav-ledger svg{width:18px!important;height:18px!important;flex:none}
      body.wayon-workbench .sidebar #account-settings>summary .ux-label{display:block;font-size:10px;margin-top:2px;opacity:.85}
      body.wayon-workbench .sidebar #account-settings>summary{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;height:48px!important;min-height:48px!important}
      body.wayon-workbench .main-content{padding:12px 14px 40px!important}
    }

    /* ---- Apple Sliding Segmented Control (#subtabs: 安排 / 完成 / 抽背 / 待催) ---- */
    body.wayon-workbench #subtabs.view-switch{
      display:inline-flex!important;
      align-items:center!important;
      height:36px!important;
      min-height:36px!important;
      gap:2px!important;
      padding:3px!important;
      border-radius:999px!important;
      background:var(--apple-seg-track)!important;
      box-shadow:inset 0 .5px 1.5px var(--apple-seg-track-inset),inset 0 -.5px 0 var(--apple-seg-track-lip)!important;
      border:0!important;
      box-sizing:border-box!important;
    }
    body.wayon-workbench #subtabs button,
    body.wayon-workbench #subtabs button.ux-labelled{
      height:30px!important;
      min-height:30px!important;
      padding:0 14px!important;
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
    @media(max-width:739px){
      body.wayon-workbench #subtabs.view-switch{display:flex!important;width:100%!important;height:38px!important;min-height:38px!important}
      body.wayon-workbench #subtabs button.ux-labelled{flex:1 1 0!important;justify-content:center!important;padding:0 4px!important;height:32px!important;min-height:32px!important}
    }

    /* ---- Apple Cupertino Controls & Borderless Soft-Shadow Cards Across All Views ---- */
    body.wayon-workbench #days{
      position:relative!important;
      display:inline-flex!important;
      flex-direction:row!important;
      flex-wrap:nowrap!important;
      align-items:center!important;
      gap:0!important;
      padding:0!important;
      overflow:visible!important;
    }
    body.wayon-workbench #day-picker,
    body.wayon-workbench #aircon-day-picker{
      display:inline-flex!important;
      align-items:center!important;
      field-sizing:content!important;
      width:auto!important;
      min-width:0!important;
      max-inline-size:220px!important;
      align-self:center!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      height:36px!important;
      min-height:36px!important;
      line-height:36px!important;
      vertical-align:middle!important;
      border:0!important;
      border-radius:999px!important;
      appearance:none!important;
      -webkit-appearance:none!important;
      -moz-appearance:none!important;
      background-color:var(--apple-surface)!important;
      background-image:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236e6e73%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%224%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3Cline%20x1%3D%2216%22%20y1%3D%222%22%20x2%3D%2216%22%20y2%3D%226%22%2F%3E%3Cline%20x1%3D%228%22%20y1%3D%222%22%20x2%3D%228%22%20y2%3D%226%22%2F%3E%3Cline%20x1%3D%223%22%20y1%3D%2210%22%20x2%3D%2221%22%20y2%3D%2210%22%2F%3E%3C%2Fsvg%3E"),url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236e6e73%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E")!important;
      background-position:left 10px center,right 10px center!important;
      background-repeat:no-repeat!important;
      background-size:15px 15px,11px 11px!important;
      box-shadow:inset 0 1px 0 var(--apple-card-rim),0 1px 3px var(--apple-glass-shadow-tight),0 0 0 .5px var(--apple-input-ring)!important;
      padding:0 28px 0 34px!important;
      font-size:13.5px!important;
      font-weight:500!important;
      color:var(--fg)!important;
    }
    body.wayon-workbench #day-picker option,
    body.wayon-workbench #aircon-day-picker option{line-height:1.4}
    body.wayon-workbench #days:has(>.home-btn:not([hidden])) #day-picker{
      background-image:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236e6e73%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E")!important;
      background-position:right 10px center!important;
      background-size:11px 11px!important;
      padding-left:36px!important;
    }
    body.wayon-workbench #day-picker::picker-icon,
    body.wayon-workbench #aircon-day-picker::picker-icon{display:none!important;content:none!important}
    body.wayon-workbench #day-picker:focus,
    body.wayon-workbench #aircon-day-picker:focus{
      outline:none!important;
      box-shadow:0 0 0 2.5px var(--wayon-brand-soft,rgba(24,24,27,.1)),0 0 0 1px var(--wayon-brand-ring,rgba(24,24,27,.22))!important;
    }
    body.wayon-workbench #days .home-btn,
    body.wayon-workbench #days .home-btn.wayon-icon-control{
      position:absolute!important;
      left:4px!important;
      top:50%!important;
      transform:translateY(-50%)!important;
      z-index:2!important;
      width:28px!important;
      min-width:28px!important;
      height:28px!important;
      min-height:28px!important;
      padding:0!important;
      margin:0!important;
      border:0!important;
      border-radius:999px!important;
      background:var(--wayon-btn-surface)!important;
      color:var(--fg)!important;
      box-shadow:none!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      cursor:pointer!important;
      transition:background-color .16s var(--apple-ease),color .16s var(--apple-ease),transform .12s var(--apple-ease)!important;
    }
    body.wayon-workbench #days .home-btn[hidden]{display:none!important}
    body.wayon-workbench #days .home-btn svg{width:14px!important;height:14px!important;stroke-width:2!important}
    body.wayon-workbench #days .home-btn:hover{
      background:var(--wayon-brand-cta)!important;
      color:var(--wayon-brand-cta-fg)!important;
      border-color:transparent!important;
    }
    body.wayon-workbench #days .home-btn:active{transform:translateY(-50%) scale(.93)!important}
    body.wayon-workbench .schedule-refresh-btn .schedule-refresh-label{display:none!important}
    body.wayon-workbench .schedule-refresh-btn{
      width:36px!important;
      min-width:36px!important;
      height:36px!important;
      min-height:36px!important;
      padding:0!important;
      gap:0!important;
      border:0!important;
      border-radius:999px!important;
      background:var(--apple-surface)!important;
      color:var(--muted)!important;
      box-shadow:inset 0 1px 0 var(--apple-card-rim),0 1px 3px var(--apple-glass-shadow-tight),0 0 0 .5px var(--apple-input-ring)!important;
    }
    body.wayon-workbench .schedule-refresh-btn:hover:not(:disabled){
      background:var(--wayon-btn-hover)!important;
      color:var(--fg)!important;
      box-shadow:inset 0 0 0 1px var(--wayon-brand-ring)!important;
    }
    body.wayon-workbench #study-add,
    body.wayon-workbench #study-add.wayon-icon-control{
      width:36px!important;
      min-width:36px!important;
      height:36px!important;
      min-height:36px!important;
      padding:0!important;
      border:0!important;
      border-radius:999px!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      font-weight:500!important;
      background:var(--apple-surface)!important;
      color:var(--fg)!important;
      box-shadow:inset 0 1px 0 var(--apple-card-rim),0 1px 3px var(--apple-glass-shadow-tight),0 0 0 .5px var(--apple-input-ring)!important;
      transition:color .16s var(--apple-ease),background-color .16s var(--apple-ease),box-shadow .16s var(--apple-ease)!important;
    }
    body.wayon-workbench #study-add>span[aria-hidden]{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:17px!important;height:17px!important;line-height:0!important;flex:none!important}
    body.wayon-workbench #study-add svg{display:block!important;width:17px!important;height:17px!important;stroke-width:1.9!important;flex:none!important;pointer-events:none!important}
    body.wayon-workbench #study-add svg path{stroke-width:1.9!important}
    body.wayon-workbench #study-add:hover{background:var(--wayon-btn-hover)!important;color:var(--fg)!important}
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
    body.wayon-workbench .workflow-icon:hover:not(:disabled),
    body.wayon-workbench #workflow-checks[open]>summary{
      color:var(--fg)!important;
      background:var(--wayon-btn-hover)!important;
      box-shadow:inset 0 0 0 1px var(--wayon-brand-ring)!important;
    }
    body.wayon-workbench #workflow-checks-panel{
      border:0!important;
      border-radius:var(--wayon-r-panel,24px)!important;
      background:linear-gradient(168deg,var(--apple-glass-bar-top) 0%,var(--apple-glass-bar-bot) 100%)!important;
      backdrop-filter:blur(28px) saturate(200%)!important;
      -webkit-backdrop-filter:blur(28px) saturate(200%)!important;
      box-shadow:inset 0 1px .5px var(--apple-glass-rim-top),0 18px 44px -10px var(--apple-glass-shadow),0 0 0 .5px var(--apple-glass-hairline)!important;
    }
    /* Notice page topbar: keep only single schedule-refresh button + date selector; hide redundant circle buttons while preserving status popover when refresh runs */
    body.wayon-workbench[data-mode="notice"] #workflow-checks:not([open]),
    body.wayon-workbench[data-mode="notice"] #workflow-checks>summary,
    body.wayon-workbench[data-mode="notice"] #workflow-guide-open,
    body.wayon-workbench[data-mode="notice"] #completion-refresh{display:none!important}
    body.wayon-workbench[data-mode="notice"] #workflow-checks[open]{position:absolute!important;inset:0!important;pointer-events:none!important}
    body.wayon-workbench[data-mode="notice"] #workflow-checks[open]>#workflow-checks-panel{pointer-events:auto!important}
    body.wayon-workbench #list .item:not(.folded),
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed),
    body.wayon-workbench .ux-aircon,
    body.wayon-workbench #aircon-panel .aircon-card:not(.folded),
    body.wayon-workbench #aircon-panel .aircon-empty,
    body.wayon-workbench #memo-panel .memo-add,
    body.wayon-workbench #memo-panel .memo-list,
    body.wayon-workbench #memo-panel .memo-empty{
      border:0!important;
      border-radius:var(--wayon-r-panel,24px)!important;
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
      border-radius:var(--wayon-r-inner,14px)!important;
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
      background:var(--wayon-brand-cta)!important;
      color:var(--wayon-brand-cta-fg)!important;
      border:0!important;
      border-radius:999px!important;
      box-shadow:0 2px 8px -2px rgba(15,23,42,.22)!important;
    }
    body.wayon-workbench .copy:hover{background:var(--wayon-brand-cta-hover)!important}
    body.wayon-workbench .item.copied .copy{
      background:var(--wayon-btn-surface)!important;
      color:var(--fg)!important;
      box-shadow:inset 0 0 0 1px var(--wayon-btn-ring)!important;
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
      border-radius:var(--wayon-r-inner,14px)!important;
      background:var(--code-bg)!important;
      color:var(--fg)!important;
    }
    body.wayon-workbench .ux-chip{
      border-radius:999px!important;
      border:0!important;
      padding:3px 11px!important;
    }
    body.wayon-workbench .ux-aircon b,
    body.wayon-workbench .ux-aircon span:not(.ux-aircon-sep){cursor:pointer;transition:color .16s ease,opacity .16s ease}
    @media(hover:hover){
      body.wayon-workbench .ux-aircon b:hover,
      body.wayon-workbench .ux-aircon span:not(.ux-aircon-sep):hover{opacity:.72;text-decoration:underline;text-underline-offset:3px}
    }
    body.wayon-workbench .ux-aircon button{
      border:0!important;
      border-radius:999px!important;
      min-inline-size:34px!important;
      min-block-size:34px!important;
      width:34px!important;
      height:34px!important;
      padding:0!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      background:var(--wayon-brand-cta)!important;
      color:var(--wayon-brand-cta-fg)!important;
      box-shadow:none!important;
    }
    body.wayon-workbench .ux-aircon button svg{width:15px!important;height:15px!important;pointer-events:none}
    body.wayon-workbench .ux-aircon button:focus-visible{outline:2px solid var(--accent)!important;outline-offset:2px!important}
    @media(hover:hover){
      body.wayon-workbench .ux-aircon button:hover{background:var(--wayon-brand-cta-hover)!important}
    }
    body.wayon-workbench .ux-aircon[data-copied]:not([data-multi]) button,
    body.wayon-workbench .ux-aircon-item[data-copied] button{
      background:var(--wayon-btn-surface)!important;
      color:var(--done,#248a3d)!important;
    }
    @media(hover:hover){
      body.wayon-workbench .ux-aircon[data-copied]:not([data-multi]) button:hover,
      body.wayon-workbench .ux-aircon-item[data-copied] button:hover{background:var(--wayon-btn-hover)!important}
    }
    body.wayon-workbench #aircon-panel #aircon-back{
      border:0!important;
      background:var(--apple-surface)!important;
      color:var(--fg)!important;
      box-shadow:inset 0 1px 0 var(--apple-card-rim),0 1px 3px var(--apple-glass-shadow-tight),0 0 0 .5px var(--apple-input-ring)!important;
    }
    @media(hover:hover){
      body.wayon-workbench #aircon-panel #aircon-back:hover{
        background:var(--wayon-btn-hover)!important;
        box-shadow:inset 0 0 0 1px var(--wayon-brand-ring)!important;
      }
    }
    /* Aircon full panel, study form, note icons, cloud login dialog & rules login CTA -> unified monochrome ink */
    body.wayon-workbench #aircon-panel .aircon-card:not(.folded),
    body.wayon-workbench #aircon-panel .aircon-empty{
      background:var(--wayon-panel-bg)!important;
      border:1px solid var(--wayon-panel-border)!important;
      border-radius:var(--wayon-r-panel,24px)!important;
      box-shadow:var(--wayon-panel-shadow)!important;
    }
    body.wayon-workbench #aircon-panel .aircon-card:not(.folded){padding:22px 24px!important}
    body.wayon-workbench #aircon-panel .aircon-editor{
      background:var(--wayon-pre-bg)!important;
      border:1px solid var(--wayon-panel-border)!important;
      border-radius:var(--wayon-r-inner,14px)!important;
      color:var(--fg)!important;
      field-sizing:content!important;
      width:100%!important;
      height:auto!important;
      min-block-size:5lh!important;
      max-block-size:24lh!important;
    }
    body.wayon-workbench #aircon-panel .aircon-editor:focus{
      border-color:var(--wayon-brand-ring)!important;
      box-shadow:0 0 0 2.5px var(--wayon-brand-soft)!important;
    }
    body.wayon-workbench #aircon-panel .aircon-card .head>.name{
      font-family:var(--wayon-name-font)!important;
      font-size:21px!important;
      font-weight:700!important;
    }
    body.wayon-workbench #aircon-panel #aircon-copy,
    body.wayon-workbench #aircon-panel #aircon-copy.wayon-icon-control{
      width:36px!important;
      min-width:36px!important;
      height:36px!important;
      min-height:36px!important;
      padding:0!important;
      border-radius:999px!important;
    }
    body.wayon-workbench #aircon-panel #aircon-copy svg{width:15px!important;height:15px!important;stroke-width:1.95!important}
    body.wayon-workbench #aircon-panel #aircon-undo,
    body.wayon-workbench #aircon-panel #aircon-undo.wayon-icon-control,
    body.wayon-workbench #aircon-panel #aircon-reset{
      width:36px!important;
      min-width:36px!important;
      height:36px!important;
      min-height:36px!important;
      padding:0!important;
      border-radius:999px!important;
      background:var(--wayon-btn-surface)!important;
      color:var(--fg)!important;
      border:0!important;
    }
    body.wayon-workbench #aircon-panel #aircon-reset{width:auto!important;padding:0 12px!important;font-size:12.5px!important;font-weight:500!important}
    body.wayon-workbench #aircon-panel #aircon-undo svg{width:15px!important;height:15px!important}
    body.wayon-workbench #study-form.study-form{
      max-width:none!important;
      padding:22px 26px!important;
      background:var(--wayon-panel-bg)!important;
      border:1px solid var(--wayon-panel-border)!important;
      border-radius:var(--wayon-r-panel,24px)!important;
      box-shadow:var(--wayon-panel-shadow)!important;
    }
    body.wayon-workbench #study-form input,
    body.wayon-workbench #study-form textarea{
      border-radius:var(--wayon-r-inner,14px)!important;
      border:1px solid var(--wayon-panel-border)!important;
      background:var(--wayon-pre-bg)!important;
      color:var(--fg)!important;
    }
    body.wayon-workbench #study-form .study-actions button.copy,
    body.wayon-workbench #study-form .study-actions button.small{
      width:auto!important;
      min-width:0!important;
      height:36px!important;
      min-height:36px!important;
      padding:0 16px!important;
      gap:6px!important;
      border-radius:999px!important;
    }
    body.wayon-workbench #study-form .study-actions button svg{width:15px!important;height:15px!important}
    body.wayon-workbench #study-form .study-actions button.copy::after{content:'保存';font-size:13px;font-weight:600}
    body.wayon-workbench #study-form .study-actions button.small{
      background:var(--wayon-btn-surface)!important;
      color:var(--fg)!important;
      border:0!important;
    }
    body.wayon-workbench #study-form .study-actions button.small:hover{background:var(--wayon-btn-hover)!important}
    body.wayon-workbench #study-form .study-actions button.small::after{content:'取消';font-size:13px;font-weight:550}
    /* In-place homework editor inside the card box */
    body.wayon-workbench #list .item .task-editor{
      margin:0!important;
      padding:14px 16px 12px!important;
      border-radius:var(--wayon-r-inner,14px)!important;
      background:var(--wayon-pre-bg)!important;
      border:1px solid var(--wayon-brand-ring)!important;
      box-shadow:0 0 0 2.5px var(--wayon-brand-soft)!important;
      display:flex!important;
      flex-direction:column!important;
      gap:10px!important;
    }
    body.wayon-workbench #list .item .task-editor .editor-area{
      field-sizing:content!important;
      width:100%!important;
      height:auto!important;
      min-block-size:5lh!important;
      max-block-size:24lh!important;
      padding:0!important;
      margin:0!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      color:var(--fg)!important;
      font:14.5px/1.75 var(--apple-sans)!important;
      resize:vertical!important;
      box-shadow:none!important;
    }
    body.wayon-workbench #list .item .task-editor .editor-area:focus{outline:none!important;box-shadow:none!important}
    body.wayon-workbench #list .item .task-editor button.small{
      width:34px!important;
      min-width:34px!important;
      height:34px!important;
      min-height:34px!important;
      padding:0!important;
      border-radius:999px!important;
      border:0!important;
      background:var(--wayon-btn-surface)!important;
      color:var(--fg-secondary)!important;
      box-shadow:none!important;
    }
    body.wayon-workbench #list .item .task-editor button.small:hover{
      background:var(--wayon-btn-hover)!important;
      color:var(--fg)!important;
    }
    body.wayon-workbench #list .item .task-editor button.small svg{width:15px!important;height:15px!important}
    body.wayon-workbench #list .item button.small[data-icon-action="Save"]{
      background:var(--wayon-brand-cta)!important;
      color:var(--wayon-brand-cta-fg)!important;
      border-color:transparent!important;
      border-radius:999px!important;
      width:34px!important;
      min-width:34px!important;
      height:34px!important;
      min-height:34px!important;
      padding:0!important;
      box-shadow:none!important;
    }
    body.wayon-workbench #list .item button.small[data-icon-action="Save"]:hover{background:var(--wayon-brand-cta-hover)!important}
    body.wayon-workbench .note-disclosure[open]>summary.wayon-icon-control{
      background:var(--wayon-brand-soft)!important;
      color:var(--wayon-brand)!important;
    }
    body.wayon-workbench .wayon-icon-control.has-note:after{background:var(--wayon-brand)!important}
    body.wayon-workbench .cloud-panel .cloud-submit-btn,
    body.wayon-workbench .cloud-panel .cloud-btn-primary,
    body.wayon-workbench #wayon-rules-dialog .rules-studio .button.primary{
      background:var(--wayon-brand-cta)!important;
      color:var(--wayon-brand-cta-fg)!important;
      border-color:transparent!important;
      box-shadow:none!important;
    }
    body.wayon-workbench .cloud-panel .cloud-submit-btn:hover,
    body.wayon-workbench .cloud-panel .cloud-btn-primary:hover,
    body.wayon-workbench #wayon-rules-dialog .rules-studio .button.primary:hover{
      background:var(--wayon-brand-cta-hover)!important;
    }
    body.wayon-workbench .cloud-emblem:not([data-state="connected"]){
      background:var(--wayon-brand-soft)!important;
      color:var(--wayon-brand)!important;
      box-shadow:none!important;
    }
    body.wayon-workbench .cloud-panel .cloud-input:focus{
      box-shadow:0 0 0 2.5px var(--wayon-brand-soft),0 0 0 1px var(--wayon-brand-ring)!important;
    }
    body.wayon-workbench .ux-past{
      border:0!important;
      border-radius:var(--wayon-r-panel,24px)!important;
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
    body.wayon-workbench #feedback-panel .fb-lesson,
    body.wayon-workbench #ledger-panel .ldg-card,
    body.wayon-workbench #ledger-panel .ldg-lock{
      border:0!important;
      border-radius:var(--wayon-r-panel,24px)!important;
      background:var(--apple-surface)!important;
      box-shadow:var(--shadow-card)!important;
    }
    body.wayon-workbench #feedback-panel .fb-card.fb-today-bar{
      border-radius:var(--wayon-r-bar,26px)!important;
      border:1px solid var(--wayon-panel-border)!important;
      background:var(--wayon-panel-bg)!important;
      box-shadow:var(--wayon-panel-shadow)!important;
    }
    body.wayon-workbench #ledger-panel .ldg-stat,
    body.wayon-workbench #ledger-panel .ldg-table-wrap,
    body.wayon-workbench .ux-assign-detail{
      border-radius:var(--wayon-r-inner,14px)!important;
    }
    body.wayon-workbench #feedback-panel .fb-btn{border-radius:999px!important}
    body.wayon-workbench #ux-student,
    body.wayon-workbench #workflow-guide,
    body.wayon-workbench .vx-box{
      border:0!important;
      border-radius:var(--wayon-r-panel,24px)!important;
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
      border-radius:var(--wayon-r-panel,24px)!important;
      background:var(--apple-canvas)!important;
      box-shadow:inset 0 1px .5px var(--apple-glass-rim-top),0 32px 84px -16px rgba(0,0,0,.36),0 0 0 .5px var(--apple-glass-hairline)!important;
    }
    body.wayon-workbench #tabs #nav-aircon,
    body.wayon-workbench #subtabs #tab-assigned{display:none!important}

    /* ---- 2026-11-22 Architectural White Panels, Unified Monochrome Ink Palette & Focus Workbench ---- */
    :root{
      --wayon-name-font:ui-serif,"New York","Songti SC","STSong","Noto Serif SC","Source Han Serif SC",Georgia,serif;
      --wayon-r-panel:24px;
      --wayon-r-bar:26px;
      --wayon-r-nav:16px;
      --wayon-r-inner:14px;
      --wayon-icon-check:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%2012.5l4.5%204.5L19%207.5%22%2F%3E%3C%2Fsvg%3E");
      --wayon-icon-play:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22black%22%3E%3Cpath%20d%3D%22M7.5%205.25a1.25%201.25%200%200%201%201.9-1.06l10.25%206.75a1.25%201.25%200%200%201%200%202.12L9.4%2019.81a1.25%201.25%200%200%201-1.9-1.06V5.25z%22%2F%3E%3C%2Fsvg%3E");
      --wayon-icon-x:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M7%207l10%2010M17%207L7%2017%22%2F%3E%3C%2Fsvg%3E");
      --wayon-icon-check-all:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M18%206L7%2017l-5-5%22%2F%3E%3Cpath%20d%3D%22M22%2010l-7.5%207.5L13%2016%22%2F%3E%3C%2Fsvg%3E");
      --wayon-icon-x-all:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.85%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%229%22%2F%3E%3Cpath%20d%3D%22M15%209l-6%206M9%209l6%206%22%2F%3E%3C%2Fsvg%3E");
      --wayon-icon-chev-r:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M9%206l6%206-6%206%22%2F%3E%3C%2Fsvg%3E");
      --wayon-icon-chev-d:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E");
      --wayon-icon-bell-off:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.9%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M8.7%203A6%206%200%200%201%2018%208a21.3%2021.3%200%200%200%20.6%205%22%2F%3E%3Cpath%20d%20%3D%22M17%2017H3s3-2%203-9a4.67%204.67%200%200%201%20.3-1.7%22%2F%3E%3Cpath%20d%3D%22M10.3%2021a1.94%201.94%200%200%200%203.4%200%22%2F%3E%3Cpath%20d%3D%22M2%202l20%2020%22%2F%3E%3C%2Fsvg%3E");
      --wayon-canvas:#F2F3F6;
      --apple-canvas:#F2F3F6;
      --wayon-panel-bg:#FFFFFF;
      --wayon-subtab-active:#FFFFFF;
      --wayon-panel-border:rgba(15,23,42,.07);
      --wayon-panel-shadow:0 1px 2px rgba(15,23,42,.03),0 6px 20px -10px rgba(15,23,42,.06);
      --wayon-divider:#ECEEF2;
      --wayon-btn-surface:#F3F4F6;
      --wayon-btn-hover:#E8EAEE;
      --wayon-btn-ring:rgba(15,23,42,.06);
      --wayon-ring-idle:rgba(24,24,27,.24);
      --wayon-ring-bg:transparent;
      --wayon-brand:#18181B;
      --wayon-brand-cta:#18181B;
      --wayon-brand-cta-fg:#FFFFFF;
      --wayon-brand-cta-hover:#2E2E34;
      --wayon-brand-soft:#F2F3F6;
      --wayon-brand-ring:rgba(24,24,27,.16);
      --wayon-card-head-bg:transparent;
      --wayon-card-head-line:#ECEEF2;
      --wayon-pre-bg:#F8F9FB;
      --wayon-sage:#15803D;
      --wayon-sage-hover-fg:#FFFFFF;
      --wayon-sage-bg:#F8F9FB;
      --wayon-sage-pill:#F0FDF4;
      --wayon-sage-ring:rgba(15,23,42,.09);
      --wayon-card-head-copied:transparent;
      --wayon-card-head-copied-line:#ECEEF2;
      --wayon-urgent:#DC2626;
      --wayon-urgent-soft:#FEF2F2;
      --wayon-card-head-urgent:transparent;
      --wayon-card-head-urgent-line:#ECEEF2;
    }
    @media(max-width:599px){
      :root{
        --wayon-r-panel:20px;
        --wayon-r-bar:20px;
        --wayon-r-nav:14px;
        --wayon-r-inner:12px;
      }
    }
    @media(prefers-color-scheme:dark){
      :root:not([data-theme="light"]){
        --wayon-canvas:#0B0C0E;
        --apple-canvas:#0B0C0E;
        --wayon-panel-bg:#16171A;
        --wayon-subtab-active:#27282D;
        --wayon-panel-border:rgba(255,255,255,.075);
        --wayon-panel-shadow:0 1px 3px rgba(0,0,0,.35),0 10px 28px -12px rgba(0,0,0,.5);
        --wayon-divider:rgba(255,255,255,.08);
        --wayon-btn-surface:rgba(255,255,255,.07);
        --wayon-btn-hover:rgba(255,255,255,.13);
        --wayon-btn-ring:rgba(255,255,255,.09);
        --wayon-ring-idle:rgba(255,255,255,.26);
        --wayon-ring-bg:transparent;
        --wayon-brand:#F4F4F5;
        --wayon-brand-cta:#F4F4F5;
        --wayon-brand-cta-fg:#111113;
        --wayon-brand-cta-hover:#FFFFFF;
        --wayon-brand-soft:rgba(255,255,255,.08);
        --wayon-brand-ring:rgba(255,255,255,.18);
        --wayon-card-head-bg:transparent;
        --wayon-card-head-line:rgba(255,255,255,.08);
        --wayon-pre-bg:rgba(255,255,255,.035);
        --wayon-sage:#4ADE80;
        --wayon-sage-hover-fg:#0B0C0E;
        --wayon-sage-bg:rgba(255,255,255,.04);
        --wayon-sage-pill:rgba(74,222,128,.12);
        --wayon-sage-ring:rgba(255,255,255,.1);
        --wayon-card-head-copied:transparent;
        --wayon-card-head-copied-line:rgba(255,255,255,.08);
        --wayon-urgent:#F87171;
        --wayon-urgent-soft:rgba(248,113,113,.14);
        --wayon-card-head-urgent:transparent;
        --wayon-card-head-urgent-line:rgba(255,255,255,.08);
      }
    }
    :root[data-theme="dark"]{
      --wayon-canvas:#0B0C0E;
      --apple-canvas:#0B0C0E;
      --wayon-panel-bg:#16171A;
      --wayon-subtab-active:#27282D;
      --wayon-panel-border:rgba(255,255,255,.075);
      --wayon-panel-shadow:0 1px 3px rgba(0,0,0,.35),0 10px 28px -12px rgba(0,0,0,.5);
      --wayon-divider:rgba(255,255,255,.08);
      --wayon-btn-surface:rgba(255,255,255,.07);
      --wayon-btn-hover:rgba(255,255,255,.13);
      --wayon-btn-ring:rgba(255,255,255,.09);
      --wayon-ring-idle:rgba(255,255,255,.26);
      --wayon-ring-bg:transparent;
      --wayon-brand:#F4F4F5;
      --wayon-brand-cta:#F4F4F5;
      --wayon-brand-cta-fg:#111113;
      --wayon-brand-cta-hover:#FFFFFF;
      --wayon-brand-soft:rgba(255,255,255,.08);
      --wayon-brand-ring:rgba(255,255,255,.18);
      --wayon-card-head-bg:transparent;
      --wayon-card-head-line:rgba(255,255,255,.08);
      --wayon-pre-bg:rgba(255,255,255,.035);
      --wayon-sage:#4ADE80;
      --wayon-sage-hover-fg:#0B0C0E;
      --wayon-sage-bg:rgba(255,255,255,.04);
      --wayon-sage-pill:rgba(74,222,128,.12);
      --wayon-sage-ring:rgba(255,255,255,.1);
      --wayon-card-head-copied:transparent;
      --wayon-card-head-copied-line:rgba(255,255,255,.08);
      --wayon-urgent:#F87171;
      --wayon-urgent-soft:rgba(248,113,113,.14);
      --wayon-card-head-urgent:transparent;
      --wayon-card-head-urgent-line:rgba(255,255,255,.08);
    }

    /* Instant zero-flash Light <-> Dark theme transitions */
    html[data-ux-theme-switching],
    html[data-ux-theme-switching] *,
    html[data-ux-theme-switching] *::before,
    html[data-ux-theme-switching] *::after{transition:none!important}

    /* Unified cool-gray canvas + crisp pure-white panels across sidebar & top toolbar */
    body.wayon-workbench{background:var(--wayon-canvas)!important}
    body.wayon-workbench .sidebar{
      background:var(--wayon-panel-bg)!important;
      border:1px solid var(--wayon-panel-border)!important;
      box-shadow:var(--wayon-panel-shadow)!important;
    }
    /* Prevent closed #account-settings children (DETAILS.cloud-panel) from protruding past the right viewport edge */
    body.wayon-workbench #account-settings:not([open])>:not(summary){display:none!important}
    /* Unified 9-button navigation geometry across desktop sidebar AND mobile/tablet top bar (0px vertical drift) */
    body.wayon-workbench .sidebar #tabs button,
    body.wayon-workbench .sidebar #tabs button.ux-labelled,
    body.wayon-workbench .sidebar #nav-ledger,
    body.wayon-workbench .sidebar #nav-ledger.ux-labelled,
    body.wayon-workbench .sidebar #wayon-rules-btn,
    body.wayon-workbench .sidebar #wayon-rules-btn.ux-labelled,
    body.wayon-workbench .sidebar #account-settings>summary,
    body.wayon-workbench .sidebar #account-settings>summary.wayon-icon-control{
      display:flex!important;
      flex-direction:column!important;
      align-items:center!important;
      justify-content:center!important;
      gap:3px!important;
      padding:4px 2px!important;
      margin:0!important;
      border:0!important;
      border-radius:var(--wayon-r-nav)!important;
      box-sizing:border-box!important;
      line-height:1!important;
      height:48px!important;
      min-height:48px!important;
      background:transparent!important;
      color:var(--muted)!important;
      box-shadow:none!important;
      cursor:pointer!important;
      text-decoration:none!important;
      transition:background-color .16s var(--apple-ease),color .16s var(--apple-ease),transform .14s var(--apple-ease)!important;
    }
    body.wayon-workbench .sidebar #tabs button:has(svg)::before{display:none!important}
    body.wayon-workbench .sidebar #tabs button>span[aria-hidden]:not(.ux-badge),
    body.wayon-workbench .sidebar #nav-ledger>span[aria-hidden]:not(.ux-badge),
    body.wayon-workbench .sidebar #wayon-rules-btn>span[aria-hidden]:not(.ux-badge),
    body.wayon-workbench .sidebar #account-settings>summary>span[aria-hidden]:not(.ux-badge){
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      width:20px!important;
      height:20px!important;
      flex:none!important;
      line-height:0!important;
      margin:0!important;
      padding:0!important;
    }
    body.wayon-workbench .sidebar #tabs button svg,
    body.wayon-workbench .sidebar #nav-ledger svg,
    body.wayon-workbench .sidebar #wayon-rules-btn svg,
    body.wayon-workbench .sidebar #account-settings>summary svg{
      display:block!important;
      width:20px!important;
      height:20px!important;
      flex:none!important;
      stroke-width:1.78!important;
      margin:0!important;
    }
    body.wayon-workbench .sidebar #tabs button .ux-label,
    body.wayon-workbench .sidebar #nav-ledger .ux-label,
    body.wayon-workbench .sidebar #wayon-rules-btn .ux-label,
    body.wayon-workbench .sidebar #account-settings>summary .ux-label{
      display:block!important;
      font-size:10.5px!important;
      line-height:12px!important;
      height:12px!important;
      margin:0!important;
      padding:0!important;
      opacity:1!important;
      font-weight:500!important;
      letter-spacing:0!important;
      white-space:nowrap!important;
    }
    @media(hover:hover){
      body.wayon-workbench .sidebar #tabs button:hover,
      body.wayon-workbench .sidebar #nav-ledger:hover,
      body.wayon-workbench .sidebar #wayon-rules-btn:hover,
      body.wayon-workbench .sidebar #account-settings>summary:hover{
        background:var(--apple-rail-hover)!important;
        color:var(--fg)!important;
      }
    }
    @media(min-width:1024px){
      body.wayon-workbench .sidebar #tabs button,
      body.wayon-workbench .sidebar #tabs button.ux-labelled,
      body.wayon-workbench .sidebar #nav-ledger,
      body.wayon-workbench .sidebar #nav-ledger.ux-labelled,
      body.wayon-workbench .sidebar #wayon-rules-btn,
      body.wayon-workbench .sidebar #wayon-rules-btn.ux-labelled,
      body.wayon-workbench .sidebar #account-settings>summary,
      body.wayon-workbench .sidebar #account-settings>summary.wayon-icon-control{
        width:60px!important;
        min-width:60px!important;
        height:48px!important;
        min-height:48px!important;
      }
      body.wayon-workbench .sidebar #account-settings:not([open]){
        width:60px!important;
        min-width:60px!important;
        height:48px!important;
      }
      body.wayon-workbench .sidebar-footer{
        padding:8px 0 0!important;
        gap:4px!important;
      }
    }
    @media(max-width:1023px){
      body.wayon-workbench .sidebar{
        display:flex!important;
        flex-direction:row!important;
        align-items:center!important;
        justify-content:space-between!important;
        padding:6px 10px!important;
        gap:6px!important;
        border:0!important;
        border-bottom:.5px solid var(--apple-hairline)!important;
        border-radius:0!important;
      }
      body.wayon-workbench .sidebar .nav-section{
        flex:1 1 auto!important;
        min-width:0!important;
        display:flex!important;
        align-items:center!important;
      }
      body.wayon-workbench .sidebar #tabs{
        display:flex!important;
        flex-direction:row!important;
        align-items:center!important;
        gap:4px!important;
        padding:0!important;
        margin:0!important;
        width:100%!important;
        max-width:100%!important;
        overflow-x:auto!important;
        scrollbar-width:none;
        -webkit-overflow-scrolling:touch;
      }
      body.wayon-workbench .sidebar-footer{
        position:static!important;
        flex:0 0 auto!important;
        display:flex!important;
        flex-direction:row!important;
        align-items:center!important;
        gap:4px!important;
        padding:0!important;
        margin:0!important;
        border:0!important;
      }
      body.wayon-workbench .sidebar #tabs button,
      body.wayon-workbench .sidebar #tabs button.ux-labelled,
      body.wayon-workbench .sidebar #nav-ledger,
      body.wayon-workbench .sidebar #nav-ledger.ux-labelled,
      body.wayon-workbench .sidebar #wayon-rules-btn,
      body.wayon-workbench .sidebar #wayon-rules-btn.ux-labelled,
      body.wayon-workbench .sidebar #account-settings>summary,
      body.wayon-workbench .sidebar #account-settings>summary.wayon-icon-control{
        flex:0 0 auto!important;
        width:48px!important;
        min-width:48px!important;
        height:48px!important;
        min-height:48px!important;
      }
      body.wayon-workbench .sidebar #account-settings:not([open]){
        width:48px!important;
        min-width:48px!important;
        height:48px!important;
        padding:0!important;
        margin:0!important;
        flex:none!important;
      }
      body.wayon-workbench .sidebar #account-settings[open]{
        position:fixed!important;
        right:12px!important;
        top:66px!important;
        width:min(360px,calc(100vw - 24px))!important;
        padding:16px!important;
        border:1px solid var(--wayon-panel-border)!important;
        border-radius:var(--wayon-r-panel)!important;
        background:var(--wayon-panel-bg)!important;
        box-shadow:0 20px 56px -12px rgba(0,0,0,.28)!important;
        z-index:100!important;
      }
      body.wayon-workbench .sidebar #sync{
        width:18px!important;
        min-width:18px!important;
        height:48px!important;
        min-height:48px!important;
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        flex:none!important;
        padding:0!important;
      }
      body.wayon-workbench .sidebar #tabs button .ux-badge,
      body.wayon-workbench .sidebar #tabs #nav-feedback[data-todo]:after{
        top:2px!important;
        right:2px!important;
        box-shadow:0 0 0 1.5px var(--wayon-panel-bg);
      }
      /* Classroom on mobile/tablet: park #workflow-tools neatly beside the top-left Wayon wordmark so the 9-tab nav bar never doubles height or clips */
      body.wayon-workbench[data-mode="classroom"] .sidebar-footer>#workflow-tools{
        position:absolute!important;
        top:-45px!important;
        right:12px!important;
        left:auto!important;
        bottom:auto!important;
        margin:0!important;
        display:inline-flex!important;
        flex-direction:row!important;
        align-items:center!important;
        gap:6px!important;
        z-index:46!important;
      }
      body.wayon-workbench[data-mode="classroom"] .sidebar-footer>#workflow-tools .workflow-icon{
        width:34px!important;
        min-width:34px!important;
        height:34px!important;
        min-height:34px!important;
      }
      body.wayon-workbench[data-mode="classroom"] .sidebar-footer>#workflow-tools #workflow-checks-panel{
        right:0!important;
        left:auto!important;
        top:calc(100% + 8px)!important;
        bottom:auto!important;
      }
    }
    @media(max-width:599px){
      body.wayon-workbench .sidebar{
        padding:5px 6px!important;
        gap:3px!important;
      }
      body.wayon-workbench .sidebar #tabs{
        gap:1px!important;
      }
      body.wayon-workbench .sidebar-footer{
        gap:1px!important;
      }
      body.wayon-workbench .sidebar #tabs button,
      body.wayon-workbench .sidebar #tabs button.ux-labelled,
      body.wayon-workbench .sidebar #nav-ledger,
      body.wayon-workbench .sidebar #nav-ledger.ux-labelled,
      body.wayon-workbench .sidebar #wayon-rules-btn,
      body.wayon-workbench .sidebar #wayon-rules-btn.ux-labelled,
      body.wayon-workbench .sidebar #account-settings>summary,
      body.wayon-workbench .sidebar #account-settings>summary.wayon-icon-control{
        width:44px!important;
        min-width:42px!important;
        height:48px!important;
        min-height:48px!important;
      }
      body.wayon-workbench .sidebar #account-settings:not([open]){
        width:44px!important;
        min-width:42px!important;
        height:48px!important;
      }
      body.wayon-workbench .sidebar #sync{
        width:12px!important;
        min-width:12px!important;
      }
      body.wayon-workbench .sidebar #tabs button .ux-badge,
      body.wayon-workbench .sidebar #tabs #nav-feedback[data-todo]:after{
        top:2px!important;
        right:1px!important;
        min-width:15px!important;
        height:15px!important;
        line-height:15px!important;
        font-size:9.5px!important;
        padding:0 3px!important;
      }
      body.wayon-workbench .main-content{padding:12px 12px 40px!important}
    }
    /* Narrow phones (<=479px, down to 340px): distribute all 9 nav items equally (6 in #tabs + 3 in .sidebar-footer + 10px #sync) so 模考 never clips */
    @media(max-width:479px){
      body.wayon-workbench .sidebar{
        padding:5px 4px!important;
        gap:0!important;
      }
      body.wayon-workbench .sidebar .nav-section{
        flex:6 1 0!important;
        min-width:0!important;
      }
      body.wayon-workbench .sidebar #tabs{
        gap:0!important;
        width:100%!important;
        max-width:100%!important;
      }
      body.wayon-workbench .sidebar-footer{
        flex:3 1 10px!important;
        min-width:0!important;
        gap:0!important;
      }
      body.wayon-workbench .sidebar #tabs button,
      body.wayon-workbench .sidebar #tabs button.ux-labelled,
      body.wayon-workbench .sidebar #nav-ledger,
      body.wayon-workbench .sidebar #nav-ledger.ux-labelled,
      body.wayon-workbench .sidebar #wayon-rules-btn,
      body.wayon-workbench .sidebar #wayon-rules-btn.ux-labelled{
        flex:1 1 0!important;
        width:auto!important;
        min-width:0!important;
        padding:0!important;
      }
      body.wayon-workbench .sidebar #account-settings:not([open]){
        flex:1 1 0!important;
        width:auto!important;
        min-width:0!important;
        height:48px!important;
      }
      body.wayon-workbench .sidebar #account-settings:not([open])>summary,
      body.wayon-workbench .sidebar #account-settings:not([open])>summary.wayon-icon-control{
        width:100%!important;
        min-width:0!important;
        padding:0!important;
      }
      body.wayon-workbench .sidebar #sync{
        flex:0 0 10px!important;
        width:10px!important;
        min-width:10px!important;
        padding:0!important;
      }
    }
    body.wayon-workbench:not([data-feedback-open]):not([data-memo-open]):not([data-mocks-open]):not([data-ledger-open]):not([data-aircon-open]) .sidebar #tabs button.on,
    body.wayon-workbench:not([data-feedback-open]):not([data-memo-open]):not([data-mocks-open]):not([data-ledger-open]):not([data-aircon-open]) .sidebar #tabs button[aria-current="page"],
    body.wayon-workbench[data-feedback-open] .sidebar #tabs #nav-feedback,
    body.wayon-workbench[data-memo-open] .sidebar #tabs #nav-memo,
    body.wayon-workbench[data-mocks-open] .sidebar #tabs #nav-mocks,
    body.wayon-workbench[data-aircon-open] .sidebar #tabs #nav-notice,
    body.wayon-workbench[data-ledger-open]:not([data-ledger-space="private"]) .sidebar #nav-ledger,
    body.wayon-workbench[data-ledger-open]:not([data-ledger-space="private"]) .sidebar #nav-ledger.ux-labelled{
      background:var(--wayon-brand-soft)!important;
      color:var(--wayon-brand)!important;
      border-radius:var(--wayon-r-nav)!important;
      box-shadow:none!important;
    }
    body.wayon-workbench:not([data-feedback-open]):not([data-memo-open]):not([data-mocks-open]):not([data-ledger-open]):not([data-aircon-open]) .sidebar #tabs button.on svg,
    body.wayon-workbench:not([data-feedback-open]):not([data-memo-open]):not([data-mocks-open]):not([data-ledger-open]):not([data-aircon-open]) .sidebar #tabs button.on .ux-label,
    body.wayon-workbench[data-feedback-open] .sidebar #tabs #nav-feedback svg,
    body.wayon-workbench[data-feedback-open] .sidebar #tabs #nav-feedback .ux-label,
    body.wayon-workbench[data-memo-open] .sidebar #tabs #nav-memo svg,
    body.wayon-workbench[data-memo-open] .sidebar #tabs #nav-memo .ux-label,
    body.wayon-workbench[data-mocks-open] .sidebar #tabs #nav-mocks svg,
    body.wayon-workbench[data-mocks-open] .sidebar #tabs #nav-mocks .ux-label,
    body.wayon-workbench[data-aircon-open] .sidebar #tabs #nav-notice svg,
    body.wayon-workbench[data-aircon-open] .sidebar #tabs #nav-notice .ux-label,
    body.wayon-workbench[data-ledger-open]:not([data-ledger-space="private"]) .sidebar #nav-ledger svg,
    body.wayon-workbench[data-ledger-open]:not([data-ledger-space="private"]) .sidebar #nav-ledger .ux-label{
      color:var(--wayon-brand)!important;
      font-weight:650!important;
    }
    /* Keep sidebar footer icons (教务/同步/规则/设置) 100% locked at fixed Y across all tabs:
       when classroom mounts #workflow-tools into .sidebar-footer, float it cleanly in the gap above .sidebar-footer with 0px shift */
    @media(min-width:1024px){
      body.wayon-workbench .sidebar-footer{
        position:relative!important;
      }
      body.wayon-workbench .sidebar-footer>#workflow-tools{
        position:absolute!important;
        left:50%!important;
        bottom:calc(100% + 14px)!important;
        transform:translateX(-50%)!important;
        margin:0!important;
        flex-direction:column!important;
        align-items:center!important;
        gap:6px!important;
      }
    }
    @media(min-width:1024px) and (max-height:640px){
      body.wayon-workbench .sidebar-footer>#workflow-tools{
        bottom:calc(100% + 8px)!important;
        gap:4px!important;
      }
      body.wayon-workbench .sidebar-footer>#workflow-tools .workflow-icon{
        width:32px!important;
        height:32px!important;
      }
    }
    body.wayon-workbench[data-mocks-open] .sidebar #workflow-tools,
    body.wayon-workbench[data-feedback-open] .sidebar #workflow-tools,
    body.wayon-workbench[data-memo-open] .sidebar #workflow-tools,
    body.wayon-workbench[data-ledger-open] .sidebar #workflow-tools,
    body.wayon-workbench[data-aircon-open] .sidebar #workflow-tools{
      display:none!important;
    }
    body.wayon-workbench .workflow-icon:hover:not(:disabled),
    body.wayon-workbench #study-add:hover{
      background:var(--wayon-btn-hover)!important;
      color:var(--fg)!important;
      box-shadow:inset 0 0 0 1px var(--wayon-brand-ring)!important;
    }
    /* Unified Apple Floating Topbar Panel across ALL viewport widths (390px–1440px):
       >= 740px: crisp single row with exact concentric outer radius (18+8=26px);
       <= 739px: structured 2-row panel (Row 1 full-width #subtabs, Row 2 date + '+' + tools) */
    body.wayon-workbench .main-content>.ux-topbar-panel{
      display:flex!important;
      align-items:center!important;
      justify-content:flex-start!important;
      gap:8px!important;
      flex-wrap:nowrap!important;
      flex:0 0 auto!important;
      width:100%!important;
      background:var(--wayon-panel-bg)!important;
      border:1px solid var(--wayon-panel-border)!important;
      border-radius:var(--wayon-r-bar)!important;
      box-shadow:var(--wayon-panel-shadow)!important;
      padding:8px!important;
      margin:0 0 14px!important;
      order:-6!important;
      box-sizing:border-box!important;
    }
    body.wayon-workbench[data-mode="classroom"] .ux-topbar-panel,
    body.wayon-workbench[data-feedback-open] .ux-topbar-panel,
    body.wayon-workbench[data-memo-open] .ux-topbar-panel,
    body.wayon-workbench[data-mocks-open] .ux-topbar-panel,
    body.wayon-workbench[data-ledger-open] .ux-topbar-panel,
    body.wayon-workbench[data-aircon-open] .ux-topbar-panel{
      display:none!important;
    }
    body.wayon-workbench .main-content>.ux-topbar-panel>.workspace-top-bar,
    body.wayon-workbench .main-content>.ux-topbar-panel>.workspace-sub-bar{
      display:contents!important;
    }
    body.wayon-workbench .main-content>.ux-topbar-panel #subtabs{
      order:-6!important;
      flex:0 0 auto!important;
      margin:0!important;
    }
    body.wayon-workbench .main-content>.ux-topbar-panel #subtabs:empty,
    body.wayon-workbench .main-content>.ux-topbar-panel #study-slot:empty,
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel #subtabs,
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel #study-slot{
      display:none!important;
    }
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon{
      order:-6!important;
      flex:0 1 auto!important;
      min-width:0!important;
      margin:0!important;
      padding:0 4px 0 8px!important;
      background:transparent!important;
      border:0!important;
      box-shadow:none!important;
      border-radius:0!important;
      display:flex!important;
      align-items:center!important;
      flex-wrap:nowrap!important;
      gap:10px!important;
    }
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon b{
      font-size:13.5px!important;
      font-weight:650!important;
      color:var(--fg)!important;
      white-space:nowrap!important;
      flex:none!important;
    }
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon span:not(.ux-aircon-sep){
      font-size:13px!important;
      color:var(--muted)!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      min-width:0!important;
      font-variant-numeric:tabular-nums!important;
    }
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon .ux-aircon-items{
      display:flex!important;
      align-items:center!important;
      gap:10px!important;
      min-width:0!important;
      flex:0 1 auto!important;
    }
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon .ux-aircon-item{
      display:inline-flex!important;
      align-items:center!important;
      gap:8px!important;
      min-width:0!important;
      flex:0 1 auto!important;
    }
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon .ux-aircon-item:not([data-copied]) span{
      color:var(--fg-secondary,var(--muted))!important;
    }
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon .ux-aircon-sep{
      width:0!important;
      height:16px!important;
      border-left:1px solid var(--line-strong,rgba(0,0,0,.14))!important;
      flex:none!important;
      pointer-events:none!important;
    }
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon button{
      margin-left:2px!important;
      min-inline-size:34px!important;
      min-block-size:34px!important;
      width:34px!important;
      height:34px!important;
      padding:0!important;
      border-radius:999px!important;
      border:0!important;
      background:var(--wayon-brand-cta)!important;
      color:var(--wayon-brand-cta-fg)!important;
      box-shadow:none!important;
      flex:none!important;
    }
    @media(hover:hover){
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon button:hover{
        background:var(--wayon-brand-cta-hover)!important;
      }
    }
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon[data-copied]:not([data-multi]) button,
    body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon .ux-aircon-item[data-copied] button{
      background:var(--wayon-btn-surface)!important;
      color:var(--done,#248a3d)!important;
    }
    @media(hover:hover){
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon[data-copied]:not([data-multi]) button:hover,
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon .ux-aircon-item[data-copied] button:hover{
        background:var(--wayon-btn-hover)!important;
      }
    }
    body.wayon-workbench .main-content>.ux-topbar-panel #study-slot{
      order:-5!important;
      flex:0 0 auto!important;
      margin:0!important;
    }
    body.wayon-workbench .main-content>.ux-topbar-panel #study-slot .meta{display:none!important}
    body.wayon-workbench .main-content>.ux-topbar-panel #workflow-tools{
      order:-4!important;
      flex:0 0 auto!important;
      margin:0 0 0 auto!important;
      gap:6px!important;
    }
    body.wayon-workbench .main-content>.ux-topbar-panel .date-section{
      order:-3!important;
      flex:0 0 auto!important;
      width:auto!important;
      margin:0!important;
    }
    body.wayon-workbench .schedule-refresh-btn{
      width:36px!important;
      min-width:36px!important;
      height:36px!important;
      min-height:36px!important;
      padding:0!important;
      gap:0!important;
      border:0!important;
      border-radius:999px!important;
      background:var(--apple-surface)!important;
      color:var(--muted)!important;
      box-shadow:inset 0 1px 0 var(--apple-card-rim),0 1px 3px var(--apple-glass-shadow-tight),0 0 0 .5px var(--apple-input-ring)!important;
    }
    body.wayon-workbench .schedule-refresh-btn:hover:not(:disabled){
      background:var(--wayon-btn-hover)!important;
      color:var(--fg)!important;
      box-shadow:inset 0 0 0 1px var(--wayon-brand-ring)!important;
    }
    @media(min-width:740px) and (max-width:899px){
      body.wayon-workbench .main-content>.ux-topbar-panel{
        gap:6px!important;
        padding:8px!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #subtabs button,
      body.wayon-workbench .main-content>.ux-topbar-panel #subtabs button.ux-labelled{
        padding:0 10px!important;
        font-size:12.5px!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #subtabs .ux-badge{
        min-width:16px!important;
        height:16px!important;
        line-height:16px!important;
        padding:0 4px!important;
        font-size:10px!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #workflow-tools{
        gap:5px!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #day-picker{
        padding:0 26px 0 32px!important;
        font-size:13px!important;
        background-position:left 9px center,right 9px center!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #days:has(>.home-btn:not([hidden])) #day-picker{
        padding-left:36px!important;
        background-position:right 9px center!important;
      }
    }
    @media(max-width:1023px){
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel:has(>.ux-aircon[data-multi]){
        flex-wrap:wrap!important;
        gap:8px!important;
        padding:8px!important;
        border-radius:var(--wayon-r-panel)!important;
      }
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon[data-multi]{
        order:-6!important;
        flex:1 0 100%!important;
        width:100%!important;
        padding:2px 4px 8px 8px!important;
        border-bottom:1px solid var(--line)!important;
      }
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel:has(>.ux-aircon[data-multi]) .date-section{
        order:-5!important;
      }
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel:has(>.ux-aircon[data-multi]) #workflow-tools{
        order:-4!important;
        margin:0 0 0 auto!important;
      }
    }
    @media(max-width:739px){
      body.wayon-workbench .main-content>.ux-topbar-panel{
        flex-wrap:wrap!important;
        gap:8px!important;
        padding:8px!important;
        border-radius:var(--wayon-r-panel)!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #subtabs{
        order:-6!important;
        flex:1 0 100%!important;
        width:100%!important;
      }
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon{
        order:-6!important;
        flex:1 0 100%!important;
        width:100%!important;
        padding:2px 2px 2px 6px!important;
      }
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon[data-multi]{
        padding:2px 4px 8px 6px!important;
      }
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon:not([data-multi]) button{
        margin-left:auto!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel .date-section,
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel .date-section{
        order:-5!important;
        flex:0 1 auto!important;
        min-width:0!important;
        max-width:100%!important;
        width:auto!important;
        margin:0!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #days{
        width:auto!important;
        max-width:100%!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #day-picker{
        width:auto!important;
        min-width:0!important;
        max-inline-size:min(220px,100%)!important;
        white-space:nowrap!important;
        padding:0 26px 0 32px!important;
        font-size:13px!important;
        background-position:left 9px center,right 9px center!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #days:has(>.home-btn:not([hidden])) #day-picker{
        padding-left:36px!important;
        background-position:right 9px center!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #study-slot,
      body.wayon-workbench .main-content>.ux-topbar-panel .ux-quiz-add{
        order:-4!important;
        flex:0 0 auto!important;
        margin:0!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #workflow-tools,
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel #workflow-tools{
        order:-3!important;
        flex:0 0 auto!important;
        margin:0 0 0 auto!important;
        gap:6px!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel .workflow-icon,
      body.wayon-workbench .main-content>.ux-topbar-panel .schedule-refresh-btn{
        width:36px!important;
        min-width:36px!important;
        height:36px!important;
        min-height:36px!important;
      }
    }
    @media(max-width:679px){
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon[data-multi]{
        flex-direction:column!important;
        align-items:stretch!important;
        gap:6px!important;
        padding:4px 4px 8px 6px!important;
      }
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon[data-multi] .ux-aircon-items{
        flex-direction:column!important;
        align-items:stretch!important;
        gap:6px!important;
        width:100%!important;
      }
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon[data-multi] .ux-aircon-item{
        display:flex!important;
        width:100%!important;
        justify-content:space-between!important;
        gap:8px!important;
      }
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon[data-multi] .ux-aircon-sep{
        width:100%!important;
        height:0!important;
        border-left:0!important;
        border-top:1px solid var(--line)!important;
      }
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel>.ux-aircon[data-multi] button{
        margin-left:auto!important;
      }
    }
    @media(max-width:479px){
      body.wayon-workbench .main-content>.ux-topbar-panel{
        gap:6px!important;
      }
      body.wayon-workbench .main-content>.ux-topbar-panel #workflow-tools,
      body.wayon-workbench[data-mode="notice"] .main-content>.ux-topbar-panel #workflow-tools{
        gap:5px!important;
      }
    }
    @media(min-width:1024px){
      body.wayon-workbench:not([data-mode="classroom"]):not([data-mocks-open]):not([data-feedback-open]):not([data-memo-open]):not([data-ledger-open]):not([data-aircon-open]) .main-content{
        min-height:calc(100dvh + 160px)!important;
        padding-bottom:172px!important;
      }
      body.wayon-workbench .main-content:has(>#list.ux-focus-layout),
      body.wayon-workbench .main-content:has(>#list .ux-all-done){
        display:flex!important;
        flex-direction:column!important;
        flex-wrap:nowrap!important;
        align-items:stretch!important;
      }
      body.wayon-workbench .main-content:has(>#list.ux-focus-layout)>#list.ux-focus-layout,
      body.wayon-workbench .main-content:has(>#list .ux-all-done)>#list{
        flex:1 1 auto!important;
        min-height:calc(100dvh - 172px)!important;
      }
      body.wayon-workbench[data-mode=quiz] #list:has(.ux-all-done)>.quiz{
        flex:1 1 auto!important;
        min-height:calc(100dvh - 172px)!important;
        align-items:stretch!important;
      }
      body.wayon-workbench[data-mode=notice] #list:has(>.ux-all-done){
        align-items:stretch!important;
      }
      body.wayon-workbench[data-mode=notice] #list:has(>.ux-all-done)>.ux-folded-rail{
        align-self:start!important;
      }
      body.wayon-workbench #list>.ux-all-done,
      body.wayon-workbench[data-mode=quiz] #list .quiz>.ux-all-done{
        min-height:calc(100dvh - 172px)!important;
        align-self:stretch!important;
      }
    }
    body.wayon-workbench #subtabs{
      background:var(--wayon-canvas)!important;
      box-shadow:none!important;
      border:0!important;
    }
    body.wayon-workbench #subtabs button.on{
      background:var(--wayon-subtab-active)!important;
      color:var(--wayon-brand)!important;
      box-shadow:0 1px 3px rgba(15,23,42,.08),0 0 0 .5px var(--wayon-panel-border)!important;
    }
    body.wayon-workbench #feedback-panel .fb-tabs button.on{
      background:var(--wayon-subtab-active)!important;
      color:var(--wayon-brand)!important;
      box-shadow:0 1px 3px rgba(15,23,42,.08),0 0 0 .5px var(--wayon-panel-border)!important;
    }
    body.wayon-workbench #memo-panel .memo-add button,
    body.wayon-workbench #ledger-panel .ldg-btn.primary,
    body.wayon-workbench .ldg-dialog .ldg-btn.primary,
    body.wayon-workbench .fb-btn.pri{
      border-radius:999px!important;
      background:var(--wayon-brand-cta)!important;
      border-color:transparent!important;
      color:var(--wayon-brand-cta-fg)!important;
    }
    body.wayon-workbench #memo-panel .memo-add button:hover:not(:disabled),
    body.wayon-workbench #ledger-panel .ldg-btn.primary:hover:not(:disabled),
    body.wayon-workbench .ldg-dialog .ldg-btn.primary:hover:not(:disabled),
    body.wayon-workbench .fb-btn.pri:hover:not(:disabled){
      background:var(--wayon-brand-cta-hover)!important;
    }
    body.wayon-workbench #ledger-panel .ldg-state p{
      text-wrap:balance;
    }

    /* Cloud sync notice -> sleek dismissible centered page popup modal */
    body.wayon-workbench .ux-sync-backdrop{
      position:fixed;
      inset:0;
      z-index:950;
      background:rgba(15,23,42,.28);
      backdrop-filter:blur(6px);
      -webkit-backdrop-filter:blur(6px);
      animation:ux-fade-in .18s ease both;
    }
    body.wayon-workbench .ux-sync-backdrop[hidden]{display:none!important}
    body.wayon-workbench:has(dialog[open]) .ux-sync-backdrop,
    body.wayon-workbench:has(dialog[open]) .wayon-sync-notice{display:none!important}
    body.wayon-workbench .wayon-sync-notice[data-ux-dismissed="1"]{display:none!important}
    body.wayon-workbench .wayon-sync-notice:not([hidden]):not([data-ux-dismissed="1"]){
      position:fixed!important;
      top:50%!important;
      left:50%!important;
      transform:translate(-50%,-50%)!important;
      z-index:960!important;
      width:min(400px,calc(100vw - 32px))!important;
      height:auto!important;
      min-height:0!important;
      margin:0!important;
      padding:20px 22px 18px!important;
      border:1px solid var(--wayon-panel-border)!important;
      border-radius:var(--wayon-r-panel)!important;
      background:var(--wayon-panel-bg)!important;
      color:var(--fg)!important;
      box-shadow:0 24px 64px -16px rgba(15,23,42,.28),0 4px 16px -4px rgba(15,23,42,.08)!important;
      display:flex!important;
      flex-direction:column!important;
      align-items:stretch!important;
      gap:12px!important;
      animation:ux-modal-pop .24s cubic-bezier(.22,1,.36,1) both!important;
    }
    body.wayon-workbench .wayon-sync-notice .ux-sync-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      flex:0 0 auto;
    }
    body.wayon-workbench .wayon-sync-notice .ux-sync-title-wrap{
      display:flex;
      align-items:center;
      gap:8px;
    }
    body.wayon-workbench .wayon-sync-notice .ux-sync-title{
      font-family:var(--wayon-name-font);
      font-size:16.5px;
      font-weight:700;
      color:var(--fg);
      letter-spacing:-.01em;
    }
    body.wayon-workbench .wayon-sync-notice .ux-sync-close{
      width:28px;
      height:28px;
      min-width:28px;
      min-height:28px;
      padding:0;
      border:0;
      border-radius:999px;
      background:var(--wayon-btn-surface);
      color:var(--muted);
      font-size:16px;
      line-height:1;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      transition:background-color .15s ease,color .15s ease;
    }
    body.wayon-workbench .wayon-sync-notice .ux-sync-close:hover{
      background:var(--wayon-btn-hover);
      color:var(--fg);
    }
    body.wayon-workbench .wayon-sync-notice>span:not(.wayon-sync-actions):not(.wayon-sync-dot){
      flex:0 0 auto!important;
      min-height:0!important;
      font-size:13.5px!important;
      line-height:1.58!important;
      color:var(--fg-secondary)!important;
    }
    body.wayon-workbench .wayon-sync-notice .wayon-sync-actions{
      flex:0 0 auto!important;
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      gap:8px!important;
      padding-top:4px;
      margin-left:0!important;
    }
    body.wayon-workbench .wayon-sync-notice .wayon-sync-cta{
      background:var(--wayon-brand-cta)!important;
      color:var(--wayon-brand-cta-fg)!important;
      border:0!important;
      border-radius:999px!important;
      padding:0 16px!important;
      height:34px!important;
      font-weight:600!important;
      box-shadow:none!important;
    }
    body.wayon-workbench .wayon-sync-notice .wayon-sync-cta:hover{background:var(--wayon-brand-cta-hover)!important}
    body.wayon-workbench .wayon-sync-notice .wayon-sync-retry{
      background:var(--wayon-btn-surface)!important;
      color:var(--fg)!important;
      border:0!important;
      border-radius:999px!important;
      padding:0 14px!important;
      height:34px!important;
      font-weight:550!important;
      box-shadow:none!important;
    }
    body.wayon-workbench .wayon-sync-notice .wayon-sync-retry:hover{background:var(--wayon-btn-hover)!important}
    @keyframes ux-fade-in{from{opacity:0}to{opacity:1}}
    @keyframes ux-modal-pop{
      from{opacity:0;transform:translate(-50%,-48%) scale(.96)}
      to{opacity:1;transform:translate(-50%,-50%) scale(1)}
    }

    /* Portrait multi-column card grid (notice & fallback) + Three-Column Architectural White Panels (plan / done / chasing on desktop >= 900px) */
    :root{view-transition-name:none}
    ::view-transition{pointer-events:none}
    ::view-transition-old(ux-stage-card),
    ::view-transition-new(ux-stage-card){
      animation-duration:.24s;
      animation-timing-function:cubic-bezier(.22,1,.36,1);
    }
    body.wayon-workbench[data-mode=plan] #list,
    body.wayon-workbench[data-mode=done] #list,
    body.wayon-workbench[data-mode=notice] #list{
      display:grid!important;
      grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))!important;
      gap:16px!important;
      align-items:stretch!important;
    }
    body.wayon-workbench[data-mode=chasing] #list{
      display:grid!important;
      grid-template-columns:repeat(auto-fill,minmax(min(100%,310px),1fr))!important;
      gap:16px!important;
      align-items:stretch!important;
    }
    body.wayon-workbench #list>.sub,
    body.wayon-workbench #list>.ux-aircon,
    body.wayon-workbench #list>.ux-past,
    body.wayon-workbench #list>.chasing-stopped,
    body.wayon-workbench #list>.study-form,
    body.wayon-workbench #list>.assigned-status{
      grid-column:1/-1!important;
    }
    body.wayon-workbench[data-mode=notice] #list:has(>.ux-folded-rail){
      grid-template-columns:minmax(0,1fr) 168px!important;
      align-items:start!important;
    }
    body.wayon-workbench #list>.ux-active-grid{
      grid-column:1;
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));
      gap:16px;
      align-items:stretch;
      min-width:0;
    }

    /* Three-Column Architectural Pure-White Panels (desktop >= 1024px): Left Panel | Center Main Panel | Right Panel */
    @media(min-width:1024px){
      body.wayon-workbench[data-mode=plan] #list.ux-focus-layout,
      body.wayon-workbench[data-mode=done] #list.ux-focus-layout,
      body.wayon-workbench[data-mode=chasing] #list.ux-focus-layout{
        display:grid!important;
        grid-template-columns:224px minmax(0,1fr) 184px!important;
        grid-template-rows:minmax(0,1fr)!important;
        grid-auto-rows:auto!important;
        gap:16px!important;
        align-items:stretch!important;
      }
      body.wayon-workbench #list.ux-focus-layout:has(>.ux-past,>.chasing-stopped){
        grid-template-rows:minmax(0,1fr) auto!important;
      }
      body.wayon-workbench #list.ux-focus-layout>.ux-past,
      body.wayon-workbench #list.ux-focus-layout>.chasing-stopped{
        background:var(--wayon-panel-bg)!important;
        border:1px solid var(--wayon-panel-border)!important;
        box-shadow:var(--wayon-panel-shadow)!important;
        border-radius:var(--wayon-r-panel)!important;
      }
      body.wayon-workbench #list.ux-focus-layout>.ux-pending-rail{
        grid-column:1;
        background:var(--wayon-panel-bg);
        border:1px solid var(--wayon-panel-border);
        border-radius:var(--wayon-r-panel);
        box-shadow:var(--wayon-panel-shadow);
        min-height:0;
        max-height:none;
        position:static;
        align-self:stretch;
        display:flex;
        flex-direction:column;
        gap:4px;
        padding:14px 10px 14px;
        min-width:0;
      }
      body.wayon-workbench #list.ux-focus-layout>.ux-focus-stage{
        grid-column:2;
        background:var(--wayon-panel-bg);
        border:1px solid var(--wayon-panel-border);
        border-radius:var(--wayon-r-panel);
        box-shadow:var(--wayon-panel-shadow);
        min-height:0;
        align-self:stretch;
        display:flex;
        flex-direction:column;
        align-items:stretch;
        min-width:0;
        padding:0;
        overflow:hidden;
      }
      body.wayon-workbench #list.ux-focus-layout>.ux-focus-stage>.item:not(.folded){
        width:100%!important;
        max-width:none!important;
        margin:0!important;
        flex:1 1 auto!important;
        background:transparent!important;
        border:0!important;
        border-radius:0!important;
        box-shadow:none!important;
        padding:26px 30px 22px!important;
      }
      body.wayon-workbench #list.ux-focus-layout>.ux-focus-stage>.item:not(.folded) .head{
        margin:0 0 4px!important;
        padding:0 0 16px!important;
        border-radius:0!important;
        background:transparent!important;
        border-bottom:1px solid var(--wayon-divider)!important;
      }
      body.wayon-workbench #list.ux-focus-layout>.ux-focus-stage>.item[data-ux-stage-hidden="1"]{
        display:none!important;
      }
      body.wayon-workbench #list.ux-focus-layout>.ux-folded-rail{
        grid-column:3!important;
        background:var(--wayon-panel-bg);
        border:1px solid var(--wayon-panel-border);
        border-radius:var(--wayon-r-panel);
        box-shadow:var(--wayon-panel-shadow);
        min-height:0;
        max-height:none;
        position:static;
        align-self:stretch;
        display:flex;
        flex-direction:column;
        gap:7px;
        padding:14px 10px 14px;
        min-width:0;
      }
      body.wayon-workbench #list.ux-focus-layout>.ux-focus-stage>.item:not(.folded) .head>.name{
        font-size:24px!important;
      }
      body.wayon-workbench[data-mode=chasing] #list.ux-focus-layout>.ux-focus-stage>.item:not(.folded) .head>.name{
        font-size:22px!important;
      }
    }
    @media(min-width:1024px) and (max-width:1199px){
      body.wayon-workbench[data-mode=plan] #list.ux-focus-layout,
      body.wayon-workbench[data-mode=done] #list.ux-focus-layout,
      body.wayon-workbench[data-mode=chasing] #list.ux-focus-layout{
        grid-template-columns:196px minmax(0,1fr) 168px!important;
        gap:12px!important;
      }
      body.wayon-workbench #list.ux-focus-layout>.ux-focus-stage>.item:not(.folded){
        padding:22px 24px 18px!important;
      }
    }

    /* Panel column headers & calm empty placeholders */
    body.wayon-workbench #list .ux-rail-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      padding:2px 8px 11px;
      margin:0 0 6px;
      border-bottom:1px solid var(--wayon-divider);
      font-size:12px;
      font-weight:600;
      letter-spacing:.02em;
      color:var(--muted);
      user-select:none;
    }
    body.wayon-workbench #list .ux-rail-count{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:22px;
      height:19px;
      padding:0 6px;
      border-radius:999px;
      background:var(--wayon-btn-surface);
      color:var(--fg-secondary);
      font-size:11px;
      font-weight:650;
      font-variant-numeric:tabular-nums;
    }
    body.wayon-workbench #list .ux-folded-rail .ux-rail-count{
      background:var(--wayon-btn-surface);
      color:var(--muted);
    }
    body.wayon-workbench #list .ux-folded-rail .ux-rail-count[data-has-items="1"]{
      background:var(--wayon-sage-pill);
      color:var(--wayon-sage);
    }
    body.wayon-workbench #list .ux-rail-empty{
      margin:auto 6px;
      padding:24px 10px;
      border:0;
      background:transparent;
      color:var(--muted);
      font-size:12.5px;
      line-height:1.5;
      text-align:center;
      user-select:none;
      opacity:.8;
    }
    body.wayon-workbench #list .ux-pending-rail .ux-rail-empty{
      color:var(--wayon-sage);
      font-weight:550;
      opacity:1;
    }
    body.wayon-workbench #list .ux-rail-tip{
      margin-top:auto;
      padding:10px 6px 2px;
      text-align:center;
      font-size:11px;
      color:var(--muted);
      opacity:.72;
      user-select:none;
    }
    body.wayon-workbench .ux-undo-toast{
      position:fixed;
      left:50%;
      bottom:24px;
      transform:translate(-50%,10px);
      z-index:970;
      padding:9px 16px;
      border-radius:999px;
      background:var(--wayon-brand-cta);
      color:var(--wayon-brand-cta-fg);
      font-size:13px;
      font-weight:550;
      letter-spacing:-.01em;
      box-shadow:0 12px 32px -8px rgba(15,23,42,.36);
      opacity:0;
      pointer-events:none;
      transition:opacity .2s ease,transform .24s cubic-bezier(.22,1,.36,1);
    }
    body.wayon-workbench .ux-undo-toast.show{
      opacity:1;
      transform:translate(-50%,0);
    }
    /* Classroom embedded iframe: hide redundant outer fullscreen link bar (moved inline inside rooms header) & match sidebar height */
    body.wayon-workbench[data-mode=classroom] #list:has(>#classroom-frame)>div:has(>a[href*="rooms.html"]){
      display:none!important;
    }
    @media(min-width:900px){
      body.wayon-workbench[data-mode=classroom] #classroom-frame{
        height:calc(100dvh - 86px)!important;
        min-height:620px!important;
      }
    }

    /* Left Panel: Clean Monochrome Pending Student Roster */
    body.wayon-workbench #list .ux-roster-btn{
      position:relative;
      width:100%;
      margin:0;
      padding:9px 10px 9px 13px;
      border:0;
      border-radius:var(--wayon-r-inner);
      background:transparent;
      color:var(--fg);
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      text-align:left;
      cursor:pointer;
      overflow:hidden;
      transition:transform .2s cubic-bezier(.22,1,.36,1),background-color .16s ease!important;
    }
    body.wayon-workbench #list .ux-roster-btn::before{
      content:'';
      position:absolute;
      left:3px;
      top:50%;
      width:3px;
      height:18px;
      border-radius:999px;
      background:var(--wayon-brand);
      transform:translateY(-50%) scaleY(0);
      opacity:0;
      transition:transform .22s cubic-bezier(.22,1,.36,1),opacity .16s ease;
    }
    body.wayon-workbench #list .ux-roster-btn[data-urgent="1"]::before{background:var(--wayon-urgent)}
    @media(hover:hover){
      body.wayon-workbench #list .ux-roster-btn:not(.on):hover{
        background:var(--wayon-brand-soft);
      }
    }
    body.wayon-workbench #list .ux-roster-btn.on{
      background:var(--wayon-brand-soft);
      box-shadow:none;
      transform:none;
    }
    body.wayon-workbench #list .ux-roster-btn.on[data-urgent="1"]{
      background:var(--wayon-urgent-soft);
      box-shadow:none;
    }
    body.wayon-workbench #list .ux-roster-btn.on::before{
      transform:translateY(-50%) scaleY(1);
      opacity:1;
    }
    body.wayon-workbench #list .ux-roster-btn:active{transform:scale(.985)}
    body.wayon-workbench #list .ux-roster-main{
      min-width:0;
      display:flex;
      align-items:center;
      gap:6px;
      flex:1 1 auto;
    }
    body.wayon-workbench #list .ux-roster-dot{
      flex:0 0 auto;
      width:6px;
      height:6px;
      border-radius:50%;
      background:var(--wayon-urgent);
      box-shadow:0 0 0 3px var(--wayon-urgent-soft);
    }
    body.wayon-workbench #list .ux-roster-name{
      font-family:var(--wayon-name-font);
      font-size:15px;
      font-weight:500;
      letter-spacing:-.01em;
      line-height:1.3;
      color:var(--fg-secondary);
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      transition:color .16s ease;
    }
    body.wayon-workbench #list .ux-roster-btn.on .ux-roster-name,
    body.wayon-workbench #list .ux-roster-btn:hover .ux-roster-name{
      color:var(--fg);
      font-weight:700;
    }
    body.wayon-workbench #list .ux-roster-sub{
      flex:0 0 auto;
      font-size:11px;
      font-weight:550;
      font-variant-numeric:tabular-nums;
      color:var(--muted);
      padding:2px 6px;
      border-radius:999px;
      background:var(--wayon-btn-surface);
      white-space:nowrap;
      transition:background-color .16s ease,color .16s ease;
    }
    body.wayon-workbench #list .ux-roster-btn.on .ux-roster-sub:not(.is-ready):not(.is-urgent){
      background:var(--wayon-panel-bg);
      color:var(--fg);
    }
    body.wayon-workbench #list .ux-roster-sub.is-ready{
      background:var(--wayon-sage-pill);
      color:var(--wayon-sage);
    }
    body.wayon-workbench #list .ux-roster-sub.is-urgent{
      background:var(--wayon-urgent-soft);
      color:var(--wayon-urgent);
    }

    /* Center Panel Empty Celebration State */
    body.wayon-workbench #list .ux-stage-empty{
      width:100%;
      max-width:380px;
      margin:auto;
      padding:40px 24px;
      border-radius:18px;
      background:transparent;
      box-shadow:none;
      text-align:center;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:10px;
      animation:ux-stage-rise .32s cubic-bezier(.22,1,.36,1) both;
    }
    body.wayon-workbench #list .ux-stage-empty-icon{
      width:44px;
      height:44px;
      border-radius:50%;
      background:var(--wayon-sage-pill);
      color:var(--wayon-sage);
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }
    body.wayon-workbench #list .ux-stage-empty-icon::before{
      content:'';
      width:20px;
      height:20px;
      background:currentColor;
      mask:var(--wayon-icon-check) center/contain no-repeat;
      -webkit-mask:var(--wayon-icon-check) center/contain no-repeat;
    }
    body.wayon-workbench #list .ux-stage-empty b{
      font-family:var(--wayon-name-font);
      font-size:19px;
      font-weight:700;
      color:var(--fg);
      letter-spacing:-.01em;
    }
    body.wayon-workbench #list .ux-stage-empty span{
      font-size:13px;
      color:var(--muted);
    }
    /* All-done celebration card for Notice & Quiz when all cards are folded to the right rail */
    body.wayon-workbench #list>.ux-all-done,
    body.wayon-workbench[data-mode=quiz] #list .quiz>.ux-all-done{
      grid-column:1;
      min-height:min(420px,calc(100dvh - 220px));
      background:var(--wayon-panel-bg);
      border:1px solid var(--wayon-panel-border);
      border-radius:var(--wayon-r-panel);
      box-shadow:var(--wayon-panel-shadow);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:32px 24px;
      min-width:0;
    }

    /* Right Panel Proxy Card for an Expanded Completed Student */
    body.wayon-workbench #list .ux-folded-rail>.ux-rail-open{
      width:100%;
      min-height:40px;
      margin:0;
      padding:9px 12px;
      border:0;
      border-radius:var(--wayon-r-inner);
      display:flex;
      align-items:center;
      justify-content:center;
      gap:7px;
      background:var(--wayon-sage-bg);
      box-shadow:0 0 0 1px var(--wayon-sage-ring);
      color:var(--fg);
      cursor:pointer;
      overflow:hidden;
      transition:transform .18s cubic-bezier(.22,1,.36,1),background-color .16s ease,box-shadow .18s cubic-bezier(.22,1,.36,1);
    }
    body.wayon-workbench #list .ux-folded-rail>.ux-rail-open::before{
      content:'';
      flex:0 0 auto;
      width:6px;
      height:6px;
      border-radius:50%;
      background:var(--wayon-sage);
    }
    body.wayon-workbench #list .ux-folded-rail>.ux-rail-open.on{
      background:var(--wayon-brand-soft);
      transform:none;
      box-shadow:0 0 0 1.5px var(--wayon-brand);
    }
    @media(hover:hover){
      body.wayon-workbench #list .ux-folded-rail>.ux-rail-open:not(.on):hover{
        background:var(--wayon-brand-soft);
        box-shadow:0 0 0 1px var(--wayon-brand-ring);
      }
    }

    /* Smooth 60fps Compositor Animations (transform + opacity only, GPU-accelerated) */
    @keyframes ux-stage-from-left{
      from{opacity:0;transform:translate3d(-16px,5px,0) scale(.986)}
      to{opacity:1;transform:translate3d(0,0,0) scale(1)}
    }
    @keyframes ux-stage-from-right{
      from{opacity:0;transform:translate3d(16px,5px,0) scale(.986)}
      to{opacity:1;transform:translate3d(0,0,0) scale(1)}
    }
    @keyframes ux-stage-rise{
      from{opacity:0;transform:translate3d(0,14px,0) scale(.984)}
      to{opacity:1;transform:translate3d(0,0,0) scale(1)}
    }
    @keyframes ux-card-fly-out{
      from{opacity:1;transform:translate3d(0,0,0) scale(1)}
      to{opacity:.25;transform:translate3d(28px,-4px,0) scale(.965)}
    }
    @keyframes ux-rail-arrive{
      0%{opacity:0;transform:translate3d(-28px,0,0) scale(.9)}
      65%{opacity:1;transform:translate3d(2px,0,0) scale(1.015)}
      100%{opacity:1;transform:translate3d(0,0,0) scale(1)}
    }
    @keyframes ux-rail-bloom{
      0%{box-shadow:inset 0 1px 0 var(--apple-card-rim),0 0 0 4px var(--wayon-sage-pill),0 0 0 1.5px var(--wayon-sage)}
      100%{box-shadow:inset 0 1px 0 var(--apple-card-rim),0 2px 8px -2px var(--apple-card-shadow-1),0 0 0 1px var(--wayon-sage-ring)}
    }
    body.wayon-workbench #list .item.ux-anim-from-left{animation:ux-stage-from-left .26s cubic-bezier(.22,1,.36,1) both}
    body.wayon-workbench #list .item.ux-anim-from-right{animation:ux-stage-from-right .26s cubic-bezier(.22,1,.36,1) both}
    body.wayon-workbench #list .item.ux-anim-next{animation:ux-stage-rise .3s cubic-bezier(.22,1,.36,1) both}
    body.wayon-workbench #list .item.ux-anim-fly-out{animation:ux-card-fly-out .18s cubic-bezier(.4,0,.2,1) forwards;pointer-events:none}
    body.wayon-workbench #list .ux-folded-rail>.item.folded.ux-anim-rail-in{
      animation:ux-rail-arrive .38s cubic-bezier(.22,1,.36,1) both,ux-rail-bloom .75s ease-out both!important;
    }
    @media(prefers-reduced-motion:reduce){
      ::view-transition-old(ux-stage-card),
      ::view-transition-new(ux-stage-card){animation:none!important}
      body.wayon-workbench #list .item.ux-anim-from-left,
      body.wayon-workbench #list .item.ux-anim-from-right,
      body.wayon-workbench #list .item.ux-anim-next,
      body.wayon-workbench #list .item.ux-anim-fly-out,
      body.wayon-workbench #list .ux-folded-rail>.item.folded.ux-anim-rail-in,
      body.wayon-workbench #list .ux-stage-empty{animation:none!important}
    }

    /* Portrait card shell with container queries (natural content height, zero artificial blank void) */
    body.wayon-workbench[data-mode=plan] #list .item:not(.folded),
    body.wayon-workbench[data-mode=done] #list .item:not(.folded),
    body.wayon-workbench[data-mode=notice] #list .item:not(.folded),
    body.wayon-workbench[data-mode=chasing] #list .item:not(.folded){
      container-type:inline-size;
      display:flex!important;
      flex-direction:column!important;
      gap:12px!important;
      padding:20px 20px 16px!important;
      border-radius:var(--wayon-r-panel)!important;
      min-width:0!important;
    }

    /* Editorial stacked card header with soft tinted edge-to-edge card cap & serif student name */
    body.wayon-workbench[data-mode=plan] #list .item:not(.folded) .head,
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .head,
    body.wayon-workbench[data-mode=notice] #list .item:not(.folded) .head,
    body.wayon-workbench[data-mode=chasing] #list .item:not(.folded) .head{
      display:flex!important;
      flex-wrap:wrap!important;
      align-items:center!important;
      justify-content:flex-start!important;
      gap:5px 8px!important;
      margin:-20px -20px 0!important;
      padding:16px 20px 13px!important;
      border-radius:var(--wayon-r-panel) var(--wayon-r-panel) 0 0!important;
      background:var(--wayon-card-head-bg)!important;
      border-bottom:1px solid var(--wayon-card-head-line)!important;
    }
    body.wayon-workbench[data-mode=plan] #list .item.copied:not(.folded) .head,
    body.wayon-workbench[data-mode=done] #list .item.copied:not(.folded) .head,
    body.wayon-workbench[data-mode=notice] #list .item.copied:not(.folded) .head,
    body.wayon-workbench[data-mode=chasing] #list .item.copied:not(.folded) .head{
      background:var(--wayon-card-head-copied)!important;
      border-bottom-color:var(--wayon-card-head-copied-line)!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .item:not(.folded) .head:has(>.name[style*="bad"]){
      background:var(--wayon-card-head-urgent)!important;
      border-bottom-color:var(--wayon-card-head-urgent-line)!important;
    }
    body.wayon-workbench #list .item:not(.folded) .head>.name{
      flex:1 0 100%!important;
      order:0!important;
      font-family:var(--wayon-name-font)!important;
      font-size:21px!important;
      font-weight:700!important;
      letter-spacing:-.015em!important;
      line-height:1.3!important;
      font-variant-numeric:lining-nums tabular-nums!important;
      color:var(--fg)!important;
      text-align:left!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .item:not(.folded) .head>.name{
      font-size:19.5px!important;
      line-height:1.32!important;
    }
    @container (inline-size < 270px){
      body.wayon-workbench #list .item:not(.folded) .head>.name{font-size:20px!important}
    }
    body.wayon-workbench #list .item:not(.folded) .head>.meta{
      flex:0 1 auto!important;
      order:1!important;
      font-size:12px!important;
      font-weight:500!important;
      color:var(--muted)!important;
      letter-spacing:.005em!important;
      text-align:left!important;
    }
    body.wayon-workbench #list .item:not(.folded) .head>.state{
      order:2!important;
      margin-inline-start:auto!important;
      font-size:11px!important;
      padding:2px 9px!important;
      background:var(--wayon-sage-pill)!important;
      color:var(--wayon-sage)!important;
      font-weight:600!important;
    }
    body.wayon-workbench #list .item:not(.folded) .ux-card-prog{
      flex:1 0 100%;
      order:3;
      height:3px;
      margin-top:4px;
      border-radius:999px;
      background:var(--wayon-card-head-line);
      overflow:hidden;
    }
    body.wayon-workbench #list .item:not(.folded) .ux-card-prog>i{
      display:block;
      height:100%;
      width:0;
      border-radius:999px;
      background:var(--wayon-brand);
      transition:width .24s var(--apple-ease-out),background-color .2s ease;
    }
    body.wayon-workbench #list .item:not(.folded) .ux-card-prog[data-complete="1"]>i{background:var(--wayon-sage)}

    /* Status chips & card body fill */
    body.wayon-workbench[data-mode=plan] #list .item:not(.folded) .ux-assign,
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .ux-assign{margin:-2px 0 0!important}
    body.wayon-workbench[data-mode=plan] #list .item:not(.folded)>pre,
    body.wayon-workbench[data-mode=notice] #list .item:not(.folded)>pre{
      flex:1 1 auto!important;
      margin:0!important;
      padding:14px 15px!important;
      font-size:13.5px!important;
      line-height:1.72!important;
      border-radius:var(--wayon-r-inner)!important;
      background:var(--wayon-pre-bg)!important;
      box-shadow:inset 0 0 0 .5px var(--wayon-card-head-line)!important;
    }
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .tasks{
      flex:1 1 auto!important;
      display:flex!important;
      flex-direction:column!important;
      gap:0!important;
      margin-top:0!important;
    }
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task{
      position:relative;
      padding:8px 2px!important;
      min-height:42px!important;
      border-bottom:1px solid var(--apple-hairline)!important;
      column-gap:8px!important;
    }
    @media(hover:hover) and (pointer:fine){
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task:not(.study-task){
        grid-template-columns:minmax(0,1fr) auto!important;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task:not(.study-task):has(.note-disclosure:not([open])>summary.has-note){
        grid-template-columns:minmax(0,1fr) auto auto!important;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task:not(.study-task)>.mark{
        grid-area:1/-2!important;
        justify-self:end!important;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task:not(.study-task)>.note-disclosure:not([open]):has(>summary.has-note){
        grid-column:2!important;
        grid-row:1!important;
        position:static!important;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task:not(.study-task)>.note-disclosure:not([open]):not(:has(>summary.has-note)){
        position:absolute!important;
        right:64px!important;
        top:50%!important;
        transform:translateY(-50%)!important;
        z-index:2;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task:not(.study-task)>.del-btn{
        position:absolute!important;
        right:34px!important;
        top:50%!important;
        transform:translateY(-50%)!important;
        z-index:2;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task:not(.study-task):hover>.note-disclosure:not([open]):not(:has(>summary.has-note))>summary,
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task:not(.study-task):focus-within>.note-disclosure:not([open]):not(:has(>summary.has-note))>summary,
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task:not(.study-task):hover>.del-btn,
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task:not(.study-task):focus-within>.del-btn{
        background:var(--apple-surface)!important;
        box-shadow:0 1px 6px rgba(0,0,0,.08),0 0 0 .5px var(--apple-hairline)!important;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task.study-task{
        grid-template-columns:minmax(0,1fr) auto!important;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task.study-task:has(.note-disclosure:not([open])>summary.has-note){
        grid-template-columns:minmax(0,1fr) auto auto!important;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task.study-task>.study-marks{
        grid-area:1/-2!important;
        justify-self:end!important;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task.study-task>.note-disclosure:not([open]):not(:has(>summary.has-note)){
        position:absolute!important;
        right:96px!important;
        top:50%!important;
        transform:translateY(-50%)!important;
        z-index:2;
      }
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task.study-task>.del-btn{
        position:absolute!important;
        right:66px!important;
        top:50%!important;
        transform:translateY(-50%)!important;
        z-index:2;
      }
    }
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task .txt{
      font-size:14px!important;
      line-height:1.48!important;
      min-height:26px!important;
      field-sizing:content;
      padding:3px 2px!important;
      transition:color .16s ease;
    }
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .task.ok .txt{
      color:var(--muted)!important;
      text-decoration:line-through;
      text-decoration-color:rgba(110,110,115,.42);
    }
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .tasks>div:last-child,
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .study-op-row{
      margin-top:auto!important;
      padding-top:10px!important;
      gap:6px!important;
    }
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .tasks>div:last-child>.sub{
      font-size:11.5px!important;
      color:var(--muted)!important;
      opacity:.85;
    }
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .add-btn{
      margin-top:0!important;
      width:30px!important;
      min-width:30px!important;
      height:30px!important;
      min-height:30px!important;
      padding:0!important;
      border-radius:999px!important;
      color:var(--fg-secondary)!important;
      opacity:1!important;
      background:var(--wayon-btn-surface)!important;
      transition:background-color .16s ease,color .16s ease!important;
    }
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .add-btn svg{width:14px!important;height:14px!important}
    body.wayon-workbench[data-mode=done] #list .item:not(.folded) .add-btn:hover{
      background:var(--wayon-btn-hover)!important;
      color:var(--fg)!important;
    }

    /* Refined jewel-like circular check controls (26px visual ring, generous touch area via ::after) */
    body.wayon-workbench[data-mode=done] #list .task button.mark,
    body.wayon-workbench[data-mode=done] #list .study-mark{
      position:relative!important;
      width:26px!important;
      height:26px!important;
      min-width:26px!important;
      min-height:26px!important;
      padding:0!important;
      border-radius:50%!important;
      border:1.5px solid var(--wayon-ring-idle)!important;
      background:var(--wayon-ring-bg)!important;
      box-shadow:inset 0 1px 2px rgba(0,0,0,.04)!important;
      transition:background-color .16s var(--apple-ease),border-color .16s var(--apple-ease),box-shadow .16s var(--apple-ease),transform .12s var(--apple-ease)!important;
    }
    body.wayon-workbench[data-mode=done] #list .task button.mark::after,
    body.wayon-workbench[data-mode=done] #list .study-mark::after{
      content:'';
      position:absolute;
      inset:-7px;
      border-radius:50%;
    }
    body.wayon-workbench[data-mode=done] #list .task button.mark:active,
    body.wayon-workbench[data-mode=done] #list .study-mark:active{transform:scale(.88)!important}
    @media(hover:hover){
      body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Unmarked"]:hover{
        border-color:var(--wayon-sage)!important;
        background:var(--wayon-sage-bg)!important;
      }
      body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Unmarked"]:hover::before{
        content:'';
        width:13px;
        height:13px;
        background:var(--wayon-sage);
        opacity:.65;
        mask:var(--wayon-icon-check) center/contain no-repeat;
        -webkit-mask:var(--wayon-icon-check) center/contain no-repeat;
      }
    }
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Done"],
    body.wayon-workbench[data-mode=done] #list .study-mark.on[aria-label$="完成"]:not([aria-label$="未完成"]){
      background:var(--wayon-sage)!important;
      border-color:transparent!important;
      box-shadow:0 2px 8px -1px rgba(46,125,91,.36),inset 0 1px 0 rgba(255,255,255,.24)!important;
    }
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Not Done"],
    body.wayon-workbench[data-mode=done] #list .study-mark.on[aria-label$="未完成"]{
      background:var(--wayon-urgent)!important;
      border-color:transparent!important;
      box-shadow:0 2px 8px -1px rgba(200,67,57,.32),inset 0 1px 0 rgba(255,255,255,.2)!important;
    }
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Done"] .wayon-emoji:before,
    body.wayon-workbench[data-mode=done] #list .study-mark:before{
      content:''!important;
      width:14px;
      height:14px;
      background:currentColor;
      mask:var(--wayon-icon-check) center/contain no-repeat;
      -webkit-mask:var(--wayon-icon-check) center/contain no-repeat;
    }
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Done"] .wayon-emoji:before{background:#fff!important}
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Not Done"] .wayon-emoji:before,
    body.wayon-workbench[data-mode=done] #list .study-mark[aria-label$="未完成"]:before{
      content:''!important;
      width:12px;
      height:12px;
      background:currentColor;
      mask:var(--wayon-icon-x) center/contain no-repeat;
      -webkit-mask:var(--wayon-icon-x) center/contain no-repeat;
    }
    body.wayon-workbench[data-mode=done] #list .task button.mark[data-icon-action="Not Done"] .wayon-emoji:before{background:#fff!important}
    body.wayon-workbench[data-mode=done] #list .study-mark{color:var(--muted)}
    body.wayon-workbench[data-mode=done] #list .study-mark.on{color:#fff}
    body.wayon-workbench[data-mode=done] #list .study-marks{gap:6px!important}
    body.wayon-workbench[data-mode=done] #list .task .note-disclosure>summary.wayon-icon-control,
    body.wayon-workbench[data-mode=done] #list .task .del-btn{
      width:28px!important;
      min-width:28px!important;
      height:28px!important;
      min-height:28px!important;
      border-radius:999px!important;
    }
    body.wayon-workbench[data-mode=done] #list .task .note-disclosure>summary.wayon-icon-control svg{width:15px!important;height:15px!important}
    @media(hover:none){
      body.wayon-workbench[data-mode=done] #list .task .del-btn,
      body.wayon-workbench[data-mode=done] #list .task .note-disclosure:not([open])>summary[data-icon-action="Add Note"]{opacity:.65}
    }

    /* Card footer action dock (.ux-card-foot): refined squircle tools + primary Copy pill */
    body.wayon-workbench #list .ux-card-foot{
      margin-top:auto;
      padding-top:12px;
      border-top:1px solid var(--apple-hairline);
      display:flex;
      align-items:center;
      flex-wrap:wrap;
      gap:6px;
    }
    body.wayon-workbench #list .ux-card-foot .study-actions{
      display:inline-flex!important;
      align-items:center!important;
      gap:6px!important;
      margin:0!important;
      padding:0!important;
    }
    body.wayon-workbench #list .ux-card-foot button.small.wayon-icon-control,
    body.wayon-workbench #list .ux-card-foot button.small{
      width:32px!important;
      min-width:32px!important;
      height:32px!important;
      min-height:32px!important;
      padding:0!important;
      border:0!important;
      border-radius:10px!important;
      background:var(--wayon-btn-surface)!important;
      color:var(--fg-secondary)!important;
      box-shadow:inset 0 0 0 .5px var(--wayon-btn-ring)!important;
      transition:background-color .16s var(--apple-ease),color .16s var(--apple-ease),transform .12s var(--apple-ease),box-shadow .16s var(--apple-ease)!important;
    }
    body.wayon-workbench #list .ux-card-foot button.small svg{width:15.5px!important;height:15.5px!important;stroke-width:1.8!important}
    body.wayon-workbench #list .ux-card-foot button.small:hover{
      background:var(--wayon-btn-hover)!important;
      color:var(--fg)!important;
    }
    body.wayon-workbench #list .ux-card-foot button.small:active,
    body.wayon-workbench #list .ux-card-foot button.copy:active{transform:scale(.94)!important}
    /* True vector CheckCheck & CircleX icons for All Done / All Not Done (calm monochrome at rest, semantic on hover) */
    body.wayon-workbench #list .ux-card-foot button.small.wayon-icon-control[data-icon-action="All Done"],
    body.wayon-workbench #list .ux-card-foot button.small[data-icon-action="All Done"]{
      background:var(--wayon-btn-surface)!important;
      color:var(--fg-secondary)!important;
      box-shadow:inset 0 0 0 .5px var(--wayon-btn-ring)!important;
    }
    body.wayon-workbench #list .ux-card-foot button.small.wayon-icon-control[data-icon-action="All Done"]:hover,
    body.wayon-workbench #list .ux-card-foot button.small[data-icon-action="All Done"]:hover{
      background:var(--wayon-sage-pill)!important;
      color:var(--wayon-sage)!important;
    }
    body.wayon-workbench #list .ux-card-foot [data-icon-action="All Done"] .wayon-emoji,
    body.wayon-workbench #list .ux-card-foot [data-icon-action="All Not Done"] .wayon-emoji{
      font-size:0!important;
      line-height:0!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
    }
    body.wayon-workbench #list .ux-card-foot [data-icon-action="All Done"] .wayon-emoji:before{
      content:''!important;
      margin:0!important;
      letter-spacing:0!important;
      width:17px!important;
      height:17px!important;
      background:currentColor!important;
      mask:var(--wayon-icon-check-all) center/contain no-repeat!important;
      -webkit-mask:var(--wayon-icon-check-all) center/contain no-repeat!important;
    }
    body.wayon-workbench #list .ux-card-foot button.small.wayon-icon-control[data-icon-action="All Not Done"],
    body.wayon-workbench #list .ux-card-foot button.small[data-icon-action="All Not Done"]{
      background:var(--wayon-btn-surface)!important;
      color:var(--fg-secondary)!important;
      box-shadow:inset 0 0 0 .5px var(--wayon-btn-ring)!important;
    }
    body.wayon-workbench #list .ux-card-foot button.small.wayon-icon-control[data-icon-action="All Not Done"]:hover,
    body.wayon-workbench #list .ux-card-foot button.small[data-icon-action="All Not Done"]:hover{
      background:var(--wayon-urgent-soft)!important;
      color:var(--wayon-urgent)!important;
    }
    body.wayon-workbench #list .ux-card-foot [data-icon-action="All Not Done"] .wayon-emoji:before{
      content:''!important;
      margin:0!important;
      letter-spacing:0!important;
      width:16px!important;
      height:16px!important;
      background:currentColor!important;
      mask:var(--wayon-icon-x-all) center/contain no-repeat!important;
      -webkit-mask:var(--wayon-icon-x-all) center/contain no-repeat!important;
    }
    /* Chasing: replace emoji hand with crisp bell-off vector icon, strip full-row red box, refine check circle */
    body.wayon-workbench #list .ux-card-foot [data-icon-action="Stop Reminders"] .wayon-emoji{
      font-size:0!important;
      line-height:0!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
    }
    body.wayon-workbench #list .ux-card-foot [data-icon-action="Stop Reminders"] .wayon-emoji:before{
      content:''!important;
      width:15.5px!important;
      height:15.5px!important;
      background:currentColor!important;
      mask:var(--wayon-icon-bell-off) center/contain no-repeat!important;
      -webkit-mask:var(--wayon-icon-bell-off) center/contain no-repeat!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .item:not(.folded) .tasks{
      flex:1 1 auto!important;
      display:flex!important;
      flex-direction:column!important;
      gap:0!important;
      margin-top:0!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .task.no,
    body.wayon-workbench[data-mode=chasing] #list .task.ok{
      background:transparent!important;
      border:0!important;
      border-bottom:1px solid var(--apple-hairline)!important;
      border-radius:0!important;
      padding:9px 2px!important;
      gap:6px 8px!important;
      min-height:42px;
      align-items:center!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .tasks>.task:last-child{border-bottom-color:transparent!important}
    body.wayon-workbench[data-mode=chasing] #list .task>.txt{
      font-size:13.5px!important;
      line-height:1.48!important;
      color:var(--fg)!important;
      padding:2px 0!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .task.ok>.txt{
      color:var(--muted)!important;
      text-decoration:line-through;
    }
    body.wayon-workbench[data-mode=chasing] #list .task>.mark{
      min-height:24px!important;
      height:24px!important;
      padding:0 8px!important;
      border:0!important;
      border-radius:999px!important;
      background:var(--wayon-urgent-soft)!important;
      color:var(--wayon-urgent)!important;
      font-size:11px!important;
      font-weight:600!important;
      font-variant-numeric:tabular-nums!important;
      letter-spacing:0!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .task.no>button.small{
      position:relative!important;
      width:26px!important;
      min-width:26px!important;
      height:26px!important;
      min-height:26px!important;
      padding:0!important;
      border-radius:50%!important;
      border:1.5px solid var(--wayon-ring-idle)!important;
      background:var(--wayon-ring-bg)!important;
      color:var(--muted)!important;
      font-size:0!important;
      line-height:0!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      box-shadow:inset 0 1px 2px rgba(0,0,0,.04)!important;
      transition:background-color .16s var(--apple-ease),border-color .16s var(--apple-ease),color .16s ease,transform .12s var(--apple-ease)!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .task.no>button.small::after{
      content:'';
      position:absolute;
      inset:-7px;
      border-radius:50%;
    }
    body.wayon-workbench[data-mode=chasing] #list .task.no>button.small::before{
      content:'';
      width:13px;
      height:13px;
      background:currentColor;
      opacity:.5;
      mask:var(--wayon-icon-check) center/contain no-repeat;
      -webkit-mask:var(--wayon-icon-check) center/contain no-repeat;
      transition:opacity .16s ease;
    }
    body.wayon-workbench[data-mode=chasing] #list .task.no>button.small:not(:disabled):hover{
      background:var(--wayon-sage)!important;
      border-color:transparent!important;
      color:#fff!important;
      box-shadow:0 2px 8px -1px rgba(46,125,91,.34)!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .task.no>button.small:not(:disabled):hover::before{opacity:1}
    body.wayon-workbench[data-mode=chasing] #list .task.no>button.small:active{transform:scale(.88)}
    body.wayon-workbench[data-mode=chasing] #list .task.ok>button.small{
      width:28px!important;
      min-width:28px!important;
      height:28px!important;
      min-height:28px!important;
      padding:0!important;
      border-radius:999px!important;
      border:0!important;
      background:var(--wayon-btn-surface)!important;
      color:var(--muted)!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped-items,
    body.wayon-workbench[data-mode=chasing] #list .chasing-completed-items{
      margin-top:4px;
      padding:6px 10px;
      border-radius:12px;
      background:var(--code-bg);
      font-size:12px;
      color:var(--muted);
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped-items>summary,
    body.wayon-workbench[data-mode=chasing] #list .chasing-completed-items>summary{
      cursor:pointer;
      font-weight:500;
      padding:2px 0;
    }
    body.wayon-workbench[data-mode=chasing] #list .ux-past,
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped{
      border:1px solid var(--wayon-panel-border)!important;
      border-radius:var(--wayon-r-panel)!important;
      background:var(--wayon-panel-bg)!important;
      box-shadow:var(--wayon-panel-shadow)!important;
      padding:4px 16px!important;
      margin:0!important;
      color:var(--fg-secondary);
      font-size:13.5px;
    }
    body.wayon-workbench[data-mode=chasing] #list .ux-past[open],
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped[open]{
      padding:4px 16px 16px!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .ux-past>summary,
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>summary{
      cursor:pointer;
      padding:11px 2px;
      margin:0;
      font-size:13.5px;
      font-weight:550;
      color:var(--fg-secondary);
      list-style-position:inside;
      user-select:none;
      transition:color .16s ease;
    }
    body.wayon-workbench[data-mode=chasing] #list .ux-past>summary:hover,
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>summary:hover{
      color:var(--fg);
    }
    body.wayon-workbench[data-mode=chasing] #list .ux-past[open]>summary,
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped[open]>summary{
      border-bottom:1px solid var(--wayon-divider);
      margin-bottom:12px;
    }
    @supports selector(::details-content){
      body.wayon-workbench[data-mode=chasing] #list .ux-past[open]::details-content,
      body.wayon-workbench[data-mode=chasing] #list .chasing-stopped[open]::details-content{
        display:grid;
        grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));
        gap:12px;
        align-items:stretch;
      }
      body.wayon-workbench[data-mode=chasing] #list .ux-past>.item,
      body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item{
        margin-top:0!important;
      }
    }
    /* Cards inside .ux-past & .chasing-stopped drawers: clean vertical portrait cards (never horizontal folded rows) */
    body.wayon-workbench[data-mode=chasing] #list .ux-past>.item,
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded{
      display:flex!important;
      flex-direction:column!important;
      align-items:stretch!important;
      justify-content:flex-start!important;
      gap:10px!important;
      padding:16px 18px 14px!important;
      border-radius:var(--wayon-r-inner)!important;
      background:var(--wayon-canvas)!important;
      border:1px solid var(--wayon-panel-border)!important;
      box-shadow:none!important;
      cursor:default!important;
      transform:none!important;
      min-width:0!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .ux-past>.item .head,
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .head{
      display:flex!important;
      flex-wrap:wrap!important;
      align-items:center!important;
      justify-content:flex-start!important;
      gap:4px 8px!important;
      margin:0!important;
      padding:0 0 10px!important;
      border-radius:0!important;
      background:transparent!important;
      border-bottom:1px solid var(--wayon-divider)!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .ux-past>.item .head>.name,
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .head>.name{
      flex:1 1 auto!important;
      order:0!important;
      font-family:var(--wayon-name-font)!important;
      font-size:17.5px!important;
      font-weight:700!important;
      line-height:1.3!important;
      color:var(--fg)!important;
      white-space:normal!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .head>.meta{
      flex:1 0 100%!important;
      order:2!important;
      font-size:12px!important;
      color:var(--muted)!important;
      line-height:1.4!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .head>button.small{
      order:1!important;
      margin-left:auto!important;
      width:auto!important;
      min-width:0!important;
      height:30px!important;
      min-height:30px!important;
      padding:0 11px!important;
      gap:5px!important;
      border-radius:999px!important;
      border:1px solid var(--wayon-panel-border)!important;
      background:var(--wayon-panel-bg)!important;
      color:var(--fg)!important;
      box-shadow:none!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      flex:0 0 auto!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .head>button.small svg{
      width:12px!important;
      height:12px!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .head>button.small[data-icon-action="Resume Reminders"]::after{
      content:'恢复催缴';
      font-size:12px;
      font-weight:550;
      white-space:nowrap;
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .head>button.small:hover{
      background:var(--wayon-brand-cta)!important;
      border-color:transparent!important;
      color:var(--wayon-brand-cta-fg)!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .tasks{
      display:flex!important;
      flex-direction:column!important;
      gap:0!important;
      width:100%!important;
      margin:0!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .task.no{
      grid-template-columns:minmax(0,1fr) auto!important;
      padding:7px 0!important;
      min-height:34px!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .task.no>button.small:disabled{
      display:none!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .chasing-stopped>.item.folded .task>.mark{
      background:var(--wayon-btn-surface)!important;
      color:var(--muted)!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .ux-folded-rail>.item.folded[data-ux-chasing-name]{
      font-size:0!important;
      line-height:0!important;
    }
    body.wayon-workbench[data-mode=chasing] #list .ux-folded-rail>.item.folded[data-ux-chasing-name]::before{
      content:attr(data-ux-chasing-name);
      font-family:var(--wayon-name-font);
      font-size:15px;
      font-weight:700;
      line-height:1.3;
      letter-spacing:-.01em;
      color:var(--fg);
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      max-width:100%;
    }

    /* Quiz (单词抽背): portrait multi-column card grid + editorial serif names + right vertical folded rail (mobile top strip) */
    body.wayon-workbench[data-mode=quiz] #list .quiz{
      display:grid!important;
      grid-template-columns:repeat(auto-fill,minmax(min(100%,460px),1fr))!important;
      gap:18px!important;
      align-items:stretch!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz:has(>.ux-quiz-rail){
      grid-template-columns:minmax(0,1fr) 148px!important;
      align-items:start!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz>.head{
      grid-column:1/-1!important;
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      gap:10px!important;
      padding:0!important;
      margin:0!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz>.head>h2,
    body.wayon-workbench[data-mode=quiz] #list .quiz>.head>.meta,
    body.wayon-workbench[data-mode=quiz] #list .quiz>.head:not(:has(>.vq-add-student)){
      display:none!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz>.head .vq-add-student{
      height:32px!important;
      min-height:32px!important;
      padding:0 13px!important;
      border:1px solid var(--wayon-panel-border)!important;
      border-radius:999px!important;
      background:var(--wayon-panel-bg)!important;
      color:var(--fg)!important;
      box-shadow:var(--wayon-panel-shadow)!important;
      font-size:12.5px!important;
      font-weight:550!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz>.head .vq-add-student:hover{
      background:var(--wayon-brand-soft)!important;
      border-color:var(--wayon-brand-ring)!important;
      color:var(--fg)!important;
    }
    body.wayon-workbench .ux-topbar-panel .ux-quiz-add{display:none!important}
    /* Unified '+' icon button across ALL widths in 抽背 — 100% pixel-identical to #study-add in 安排 & 完成 */
    body.wayon-workbench[data-mode=quiz] .ux-topbar-panel .ux-quiz-add:not([hidden]){
      order:-5!important;
      flex:0 0 auto!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      width:36px!important;
      min-width:36px!important;
      height:36px!important;
      min-height:36px!important;
      padding:0!important;
      margin:0!important;
      border:0!important;
      border-radius:999px!important;
      background:var(--apple-surface)!important;
      color:var(--fg)!important;
      box-shadow:inset 0 1px 0 var(--apple-card-rim),0 1px 3px var(--apple-glass-shadow-tight),0 0 0 .5px var(--apple-input-ring)!important;
      cursor:pointer!important;
      transition:color .16s var(--apple-ease),background-color .16s var(--apple-ease),box-shadow .16s var(--apple-ease)!important;
    }
    body.wayon-workbench[data-mode=quiz] .ux-topbar-panel .ux-quiz-add:not([hidden]) svg{display:block!important;width:17px!important;height:17px!important;stroke-width:1.9!important;flex:none!important;pointer-events:none!important}
    body.wayon-workbench[data-mode=quiz] .ux-topbar-panel .ux-quiz-add:not([hidden]) svg path{stroke-width:1.9!important}
    body.wayon-workbench[data-mode=quiz] .ux-topbar-panel .ux-quiz-add:not([hidden]):hover{
      background:var(--wayon-btn-hover)!important;
      color:var(--fg)!important;
      box-shadow:inset 0 0 0 1px var(--wayon-brand-ring)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz>.head{display:none!important}
    body.wayon-workbench[data-mode=quiz] #list .quiz>.ux-quiz-grid{
      grid-column:1;
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(min(100%,460px),1fr));
      gap:18px;
      align-items:stretch;
      min-width:0;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed){
      container-type:inline-size;
      content-visibility:auto;
      contain-intrinsic-size:auto 340px auto 220px;
      display:flex!important;
      flex-direction:column!important;
      gap:12px!important;
      padding:20px 20px 16px!important;
      margin:0!important;
      border-radius:var(--wayon-r-panel)!important;
      min-width:0!important;
    }
    @supports not (content-visibility:auto){
      body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed){contain:layout style paint}
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed)>.qhead{
      display:flex!important;
      flex-direction:column!important;
      align-items:stretch!important;
      gap:8px!important;
      margin:-20px -20px 0!important;
      padding:16px 20px 13px 20px!important;
      border-radius:var(--wayon-r-panel) var(--wayon-r-panel) 0 0!important;
      background:var(--wayon-card-head-bg)!important;
      border-bottom:1px solid var(--wayon-card-head-line)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-student-name,
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed)>.qhead{
      font-family:var(--wayon-name-font)!important;
      font-size:21px!important;
      font-weight:700!important;
      letter-spacing:-.015em!important;
      line-height:1.28!important;
      color:var(--fg)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-student-name{
      display:block!important;
      padding-right:42px!important;
      min-width:0!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-meta{
      font-family:var(--apple-sans)!important;
      font-size:12px!important;
      font-weight:500!important;
      display:flex!important;
      flex-direction:column!important;
      align-items:stretch!important;
      justify-content:flex-end!important;
      width:100%!important;
      margin:0!important;
      padding:0!important;
      gap:6px!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-session{
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      flex-wrap:wrap!important;
      width:100%!important;
      gap:6px!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-session>span:first-child{
      flex:1 1 auto!important;
      min-width:0!important;
      margin-right:auto!important;
      color:var(--muted)!important;
      overflow-wrap:anywhere!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-session>.vq-check,
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-session>.vq-remove-extra{
      flex:0 0 auto!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-check{
      height:26px!important;
      min-height:26px!important;
      padding:0 9px!important;
      font-size:11.5px!important;
      border-color:var(--wayon-btn-ring)!important;
      background:var(--wayon-btn-surface)!important;
      color:var(--fg-secondary)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-check.on{
      background:var(--done-bg)!important;
      border-color:var(--done-border)!important;
      color:var(--done)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-fold{
      top:14px!important;
      right:20px!important;
      width:32px!important;
      min-width:32px!important;
      height:32px!important;
      min-height:32px!important;
      padding:0!important;
      border:0!important;
      border-radius:999px!important;
      background:var(--wayon-sage-bg)!important;
      box-shadow:inset 0 0 0 1px var(--wayon-sage-ring)!important;
      color:var(--wayon-sage)!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      transition:background-color .16s var(--apple-ease),color .16s ease,box-shadow .16s var(--apple-ease),transform .12s var(--apple-ease)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-fold svg{display:none!important}
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-fold::before{
      content:'';
      width:15px;
      height:15px;
      display:block;
      background:currentColor;
      mask:var(--wayon-icon-check) center/contain no-repeat;
      -webkit-mask:var(--wayon-icon-check) center/contain no-repeat;
      forced-color-adjust:none;
    }
    @media(hover:hover){
      body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-fold:hover{
        background:var(--wayon-sage)!important;
        color:var(--wayon-sage-hover-fg)!important;
        box-shadow:0 2px 8px -1px rgba(21,128,61,.34)!important;
      }
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-fold:active{transform:scale(.92)!important}
    body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq{
      flex:1 1 auto!important;
      display:flex!important;
      flex-direction:column!important;
      gap:10px!important;
      font-family:var(--apple-sans)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-bar{
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
      flex-wrap:nowrap!important;
      gap:6px!important;
      min-width:0!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-bar .vq-tabs{
      flex:0 0 auto!important;
      display:inline-flex!important;
      align-items:center!important;
      flex-wrap:nowrap!important;
      gap:2px!important;
      border:0!important;
      border-radius:999px!important;
      padding:2.5px!important;
      background:var(--apple-seg-track)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-bar .vq-tabs button{
      border-radius:999px!important;
      min-height:28px!important;
      height:28px!important;
      padding:0 10px!important;
      font-size:12px!important;
      white-space:nowrap!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-bar .vq-actions{
      flex:0 0 auto!important;
      display:inline-flex!important;
      align-items:center!important;
      flex-wrap:nowrap!important;
      gap:5px!important;
      margin-left:auto!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-bar .vq-actions button,
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-result-actions .fb-btn{
      height:28px!important;
      min-height:28px!important;
      border-radius:999px!important;
      padding:0 10px!important;
      font-size:12px!important;
      white-space:nowrap!important;
    }
    @container (inline-size < 395px){
      body.wayon-workbench[data-mode=quiz] #list .quiz .vq-bar{
        flex-wrap:wrap!important;
        gap:8px!important;
      }
      body.wayon-workbench[data-mode=quiz] #list .quiz .vq-bar .vq-actions{
        margin-left:auto!important;
      }
    }
    @supports not (container-type:inline-size){
      @media(max-width:440px){
        body.wayon-workbench[data-mode=quiz] #list .quiz .vq-bar{flex-wrap:wrap!important;gap:8px!important}
      }
    }
    /* Quiz ready row: list title + count + clear + two crisp 34x34px icon-only circle actions (copy & play) on ONE single row */
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done){
      display:flex!important;
      align-items:center!important;
      flex-wrap:nowrap!important;
      gap:8px!important;
      margin-top:2px!important;
      padding:9px 10px 9px 14px!important;
      border-radius:var(--wayon-r-inner)!important;
      background:var(--wayon-pre-bg)!important;
      box-shadow:inset 0 0 0 .5px var(--wayon-panel-border)!important;
      min-width:0!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done):has(.fb-meta){
      flex-wrap:wrap!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done)>.fb-meta{
      flex:1 0 100%!important;
      font-size:11.5px!important;
      margin-top:-2px!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done)>.vq-label{
      flex:0 1 auto!important;
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
      font-weight:600!important;
      font-size:13.5px!important;
      color:var(--fg)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done)>.vq-n{
      flex:0 0 auto!important;
      white-space:nowrap!important;
      font-size:12.5px!important;
      color:var(--muted)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done)>.vq-clear{
      flex:0 0 auto!important;
      white-space:nowrap!important;
      padding:0 4px!important;
      font-size:12px!important;
      min-height:28px!important;
      color:var(--muted)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done)>.vq-clear:hover{
      color:var(--fg)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-copy{
      position:relative!important;
      margin-left:auto!important;
      flex:0 0 auto!important;
      width:34px!important;
      min-width:34px!important;
      height:34px!important;
      min-height:34px!important;
      padding:0!important;
      gap:0!important;
      border:0!important;
      border-radius:999px!important;
      background:var(--wayon-panel-bg)!important;
      color:var(--fg-secondary)!important;
      box-shadow:inset 0 0 0 1px var(--wayon-panel-border)!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      transition:background-color .16s var(--apple-ease),color .16s ease,box-shadow .16s ease,transform .12s var(--apple-ease)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-copy svg{
      width:15px!important;
      height:15px!important;
      stroke-width:1.9!important;
      display:block!important;
      flex:none!important;
      pointer-events:none!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-copy .vq-copy-label{
      position:absolute!important;
      width:1px!important;
      height:1px!important;
      padding:0!important;
      margin:-1px!important;
      overflow:hidden!important;
      clip-path:inset(50%)!important;
      white-space:nowrap!important;
      border:0!important;
    }
    @media(hover:hover){
      body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-copy:hover{
        background:var(--wayon-btn-hover)!important;
        color:var(--fg)!important;
      }
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-copy[data-copied="1"]{
      background:var(--wayon-sage-pill)!important;
      color:var(--wayon-sage)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-copy[data-copied="1"] svg{display:none!important}
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-copy[data-copied="1"]::before{
      content:'';
      width:15px;
      height:15px;
      display:block;
      background:currentColor;
      mask:var(--wayon-icon-check) center/contain no-repeat;
      -webkit-mask:var(--wayon-icon-check) center/contain no-repeat;
      forced-color-adjust:none;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-start{
      position:relative!important;
      margin-left:auto!important;
      flex:0 0 auto!important;
      width:34px!important;
      min-width:34px!important;
      height:34px!important;
      min-height:34px!important;
      padding:0!important;
      border:0!important;
      border-radius:999px!important;
      background:var(--wayon-brand-cta)!important;
      color:transparent!important;
      font-size:0!important;
      line-height:0!important;
      box-shadow:0 2px 8px -2px rgba(15,23,42,.24)!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      transition:background-color .16s var(--apple-ease),box-shadow .16s ease,transform .12s var(--apple-ease)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-copy+.vq-start{
      margin-left:0!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-start::before{
      content:'';
      width:13px;
      height:13px;
      margin-left:1.5px;
      display:block;
      background:var(--wayon-brand-cta-fg);
      mask:var(--wayon-icon-play) center/contain no-repeat;
      -webkit-mask:var(--wayon-icon-play) center/contain no-repeat;
      forced-color-adjust:none;
    }
    @media(hover:hover){
      body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-start:hover{
        background:var(--wayon-brand-cta-hover)!important;
        box-shadow:0 4px 12px -2px rgba(15,23,42,.32)!important;
      }
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-copy:active,
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-ready:not(.vq-done) .vq-start:active{
      transform:scale(.93)!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-done{
      grid-template-columns:minmax(0,1fr)!important;
      gap:10px!important;
      border-radius:var(--wayon-r-inner)!important;
      padding:12px 14px!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .vq-result-actions{
      justify-content:flex-end!important;
      flex-wrap:wrap!important;
      gap:6px!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz>.ux-quiz-rail{
      grid-column:2;
      position:sticky;
      top:76px;
      display:flex;
      flex-direction:column;
      gap:8px;
      min-width:0;
      align-self:start;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .ux-quiz-rail>.qgroup.vq-collapsed{
      width:100%!important;
      min-height:42px!important;
      margin:0!important;
      padding:10px 14px!important;
      border:0!important;
      border-radius:var(--wayon-r-inner)!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      background:var(--wayon-sage-bg)!important;
      box-shadow:inset 0 1px 0 var(--apple-card-rim),0 2px 8px -2px var(--apple-card-shadow-1),0 0 0 1px var(--wayon-sage-ring)!important;
      cursor:pointer!important;
      transition:transform .16s var(--apple-ease),background-color .16s ease,box-shadow .18s var(--apple-ease)!important;
    }
    @media(hover:hover){
      body.wayon-workbench[data-mode=quiz] #list .quiz .ux-quiz-rail>.qgroup.vq-collapsed:hover{
        background:var(--apple-surface)!important;
        transform:translateX(-3px);
        box-shadow:inset 0 1px 0 var(--apple-card-rim),0 8px 18px -6px rgba(46,125,91,.18),0 0 0 1px var(--wayon-sage)!important;
      }
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .ux-quiz-rail>.qgroup.vq-collapsed>.qhead{
      margin:0!important;
      padding:0!important;
      border:0!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      width:100%!important;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .ux-quiz-rail>.qgroup.vq-collapsed .vq-student-name{
      font-family:var(--wayon-name-font)!important;
      font-size:15px!important;
      font-weight:700!important;
      letter-spacing:-.01em!important;
      color:var(--fg)!important;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      max-width:100%;
    }
    body.wayon-workbench[data-mode=quiz] #list .quiz .ux-quiz-rail>.qgroup.vq-collapsed .vq-fold-note,
    body.wayon-workbench[data-mode=quiz] #list .quiz .ux-quiz-rail>.qgroup.vq-collapsed .vq-meta,
    body.wayon-workbench[data-mode=quiz] #list .quiz .ux-quiz-rail>.qgroup.vq-collapsed .vq-fold{
      display:none!important;
    }
    body.wayon-workbench #list .ux-card-foot button.copy,
    body.wayon-workbench #list .ux-card-foot button.copy.wayon-icon-control{
      margin-inline-start:auto!important;
      width:36px!important;
      min-width:36px!important;
      height:36px!important;
      min-height:36px!important;
      padding:0!important;
      border-radius:999px!important;
      background:var(--wayon-brand-cta)!important;
      color:var(--wayon-brand-cta-fg)!important;
      box-shadow:0 2px 8px -2px rgba(15,23,42,.24)!important;
      transition:background-color .16s var(--apple-ease),box-shadow .16s var(--apple-ease),transform .12s var(--apple-ease)!important;
    }
    body.wayon-workbench #list .ux-card-foot button.copy svg{width:15px!important;height:15px!important;stroke-width:1.95!important}
    body.wayon-workbench #list .ux-card-foot button.copy[data-icon-action="Retry Copy"]{
      width:auto!important;
      min-width:58px!important;
      padding:0 12px!important;
      gap:4px!important;
    }
    body.wayon-workbench #list .item.copied .ux-card-foot button.copy{
      background:var(--wayon-btn-surface)!important;
      color:var(--fg)!important;
      box-shadow:inset 0 0 0 1px var(--wayon-btn-ring)!important;
    }
    body.wayon-workbench #list .ux-card-foot button.copy:hover{
      background:var(--wayon-brand-cta-hover)!important;
      box-shadow:0 4px 12px -2px rgba(15,23,42,.32)!important;
    }
    body.wayon-workbench #list .item.copied .ux-card-foot button.copy:hover{
      background:var(--wayon-btn-hover)!important;
      box-shadow:inset 0 0 0 1px var(--wayon-brand-ring)!important;
    }

    /* Right-side vertical folded stack (.ux-folded-rail): monochrome pure-name pills inside crisp white panel */
    body.wayon-workbench #list>.ux-folded-rail{
      grid-column:2;
      position:sticky;
      top:76px;
      display:flex;
      flex-direction:column;
      gap:7px;
      min-width:0;
      align-self:start;
    }
    body.wayon-workbench #list>.ux-folded-rail[data-only-folded="1"]{
      grid-column:2;
      justify-self:stretch;
    }
    body.wayon-workbench #list .ux-folded-rail>.item.folded{
      grid-column:auto!important;
      width:100%!important;
      min-height:40px!important;
      margin:0!important;
      padding:9px 12px!important;
      border:0!important;
      border-radius:var(--wayon-r-inner)!important;
      display:flex!important;
      flex-direction:row!important;
      align-items:center!important;
      justify-content:center!important;
      gap:6px!important;
      background:var(--wayon-sage-bg)!important;
      box-shadow:0 0 0 1px var(--wayon-sage-ring)!important;
      color:var(--fg)!important;
      cursor:pointer!important;
      overflow:hidden;
      transition:transform .16s var(--apple-ease),background-color .16s ease,box-shadow .18s var(--apple-ease)!important;
    }
    body.wayon-workbench #list .ux-folded-rail>.item.folded.study-folded{
      box-shadow:0 0 0 1px var(--wayon-brand-ring)!important;
    }
    @media(hover:hover){
      body.wayon-workbench #list .ux-folded-rail>.item.folded:hover{
        background:var(--wayon-brand-soft)!important;
        transform:none;
        box-shadow:0 0 0 1px var(--wayon-brand-ring)!important;
      }
      body.wayon-workbench #list .ux-folded-rail>.item.folded.study-folded:hover{
        box-shadow:0 0 0 1px var(--wayon-brand)!important;
      }
    }
    body.wayon-workbench #list .ux-folded-rail>.item.folded:active{transform:scale(.98)}
    body.wayon-workbench #list .ux-folded-rail .ux-fp-name{
      font-family:var(--wayon-name-font);
      font-size:14.5px;
      font-weight:600;
      letter-spacing:-.01em;
      color:var(--fg);
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      max-width:100%;
    }
    body.wayon-workbench[data-mode=plan] #list .item.copied:not(.folded),
    body.wayon-workbench[data-mode=done] #list .item.copied:not(.folded),
    body.wayon-workbench[data-mode=notice] #list .item.copied:not(.folded),
    body.wayon-workbench[data-mode=chasing] #list .item.copied:not(.folded){
      box-shadow:var(--wayon-panel-shadow),0 0 0 1px var(--wayon-panel-border)!important;
    }
    body.wayon-workbench #list .ux-past>.item,
    body.wayon-workbench #list .chasing-stopped>.item{margin-top:12px}

    @media(max-width:1023px){
      body.wayon-workbench[data-mode=plan] #list:has(>.ux-folded-rail),
      body.wayon-workbench[data-mode=done] #list:has(>.ux-folded-rail),
      body.wayon-workbench[data-mode=notice] #list:has(>.ux-folded-rail),
      body.wayon-workbench[data-mode=chasing] #list:has(>.ux-folded-rail),
      body.wayon-workbench #list.ux-focus-layout,
      body.wayon-workbench[data-mode=quiz] #list .quiz:has(>.ux-quiz-rail){
        display:flex!important;
        flex-direction:column!important;
        align-items:stretch!important;
      }
      body.wayon-workbench #list>.ux-pending-rail,
      body.wayon-workbench #list .ux-rail-head,
      body.wayon-workbench #list .ux-rail-empty,
      body.wayon-workbench #list .ux-rail-tip,
      body.wayon-workbench #list .ux-rail-open,
      body.wayon-workbench #list .ux-stage-empty,
      body.wayon-workbench #list>.ux-folded-rail[data-empty-folded="1"]{
        display:none!important;
      }
      body.wayon-workbench #list>.ux-aircon,
      body.wayon-workbench #list>.study-form,
      body.wayon-workbench[data-mode=quiz] #list .quiz>.head{order:0}
      body.wayon-workbench #list>.ux-folded-rail,
      body.wayon-workbench[data-mode=quiz] #list .quiz>.ux-quiz-rail{
        order:1;
        position:static!important;
        background:transparent!important;
        border:0!important;
        box-shadow:none!important;
        min-height:0!important;
        max-height:none!important;
        flex-direction:row!important;
        flex-wrap:nowrap!important;
        overflow-x:auto!important;
        scroll-snap-type:x proximity;
        scrollbar-width:none;
        -webkit-overflow-scrolling:touch;
        gap:8px!important;
        padding:2px 1px!important;
      }
      body.wayon-workbench #list>.ux-folded-rail::-webkit-scrollbar,
      body.wayon-workbench[data-mode=quiz] #list .quiz>.ux-quiz-rail::-webkit-scrollbar{display:none}
      body.wayon-workbench #list>.ux-focus-stage{
        order:2;
        background:transparent!important;
        border:0!important;
        box-shadow:none!important;
        min-height:0!important;
        padding:0!important;
        display:flex!important;
        flex-direction:column!important;
        gap:14px!important;
        min-width:0;
      }
      body.wayon-workbench #list>.ux-focus-stage>.item:not(.folded){
        background:var(--wayon-panel-bg)!important;
        border:1px solid var(--wayon-panel-border)!important;
        box-shadow:var(--wayon-panel-shadow)!important;
      }
      body.wayon-workbench #list>.ux-active-grid,
      body.wayon-workbench[data-mode=quiz] #list .quiz>.ux-quiz-grid,
      body.wayon-workbench #list>.ux-all-done,
      body.wayon-workbench[data-mode=quiz] #list .quiz>.ux-all-done{order:2}
      body.wayon-workbench #list>.ux-all-done,
      body.wayon-workbench[data-mode=quiz] #list .quiz>.ux-all-done{
        min-height:220px!important;
        padding:24px 16px!important;
      }
      body.wayon-workbench #list .ux-all-done>.ux-stage-empty{display:flex!important}
      body.wayon-workbench #list>.ux-past,
      body.wayon-workbench #list>.chasing-stopped{order:3}
      body.wayon-workbench #list .ux-folded-rail>.item.folded,
      body.wayon-workbench[data-mode=quiz] #list .quiz .ux-quiz-rail>.qgroup.vq-collapsed{
        flex:0 0 auto!important;
        scroll-snap-align:start;
        width:auto!important;
        min-height:36px!important;
        padding:7px 14px!important;
        border-radius:999px!important;
        background:var(--wayon-panel-bg)!important;
      }
    }

    @media(max-width:599px){
      body.wayon-workbench .main-content .ux-topbar-panel>.workspace-top-bar,
      body.wayon-workbench .main-content .ux-topbar-panel>.workspace-sub-bar{display:contents!important}
      body.wayon-workbench[data-mode=plan] #list,
      body.wayon-workbench[data-mode=done] #list,
      body.wayon-workbench[data-mode=notice] #list,
      body.wayon-workbench[data-mode=chasing] #list,
      body.wayon-workbench[data-mode=quiz] #list .quiz,
      body.wayon-workbench #list>.ux-active-grid,
      body.wayon-workbench[data-mode=quiz] #list .quiz>.ux-quiz-grid{
        grid-template-columns:minmax(0,1fr)!important;
        gap:14px!important;
      }
      body.wayon-workbench[data-mode=plan] #list .item:not(.folded),
      body.wayon-workbench[data-mode=done] #list .item:not(.folded),
      body.wayon-workbench[data-mode=notice] #list .item:not(.folded),
      body.wayon-workbench[data-mode=chasing] #list .item:not(.folded){
        padding:16px 16px 14px!important;
        border-radius:var(--wayon-r-panel)!important;
      }
      body.wayon-workbench[data-mode=plan] #list .item:not(.folded) .head,
      body.wayon-workbench[data-mode=done] #list .item:not(.folded) .head,
      body.wayon-workbench[data-mode=notice] #list .item:not(.folded) .head,
      body.wayon-workbench[data-mode=chasing] #list .item:not(.folded) .head{
        margin:-16px -16px 0!important;
        padding:14px 16px 11px!important;
        border-radius:var(--wayon-r-panel) var(--wayon-r-panel) 0 0!important;
      }
      body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed){
        padding:16px 16px 14px!important;
        border-radius:var(--wayon-r-panel)!important;
      }
      body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed)>.qhead{
        margin:-16px -16px 0!important;
        padding:14px 16px 11px 16px!important;
        border-radius:var(--wayon-r-panel) var(--wayon-r-panel) 0 0!important;
      }
      body.wayon-workbench[data-mode=quiz] #list .quiz .qgroup:not(.vq-collapsed) .vq-fold{
        top:12px!important;
        right:16px!important;
      }
      body.wayon-workbench #list .ux-card-foot button.small.wayon-icon-control,
      body.wayon-workbench #list .ux-card-foot button.small{
        width:38px!important;
        min-width:38px!important;
        height:38px!important;
        min-height:38px!important;
      }
      body.wayon-workbench #list .ux-card-foot button.copy,
      body.wayon-workbench #list .ux-card-foot button.copy.wayon-icon-control{
        width:38px!important;
        min-width:38px!important;
        height:38px!important;
        min-height:38px!important;
        padding:0!important;
      }
      body.wayon-workbench #list .ux-card-foot button.copy[data-icon-action="Retry Copy"]{
        width:auto!important;
        padding:0 15px!important;
      }
    }

    /* Full-page overlay panels (反馈 / 备忘 / 模考 / 教务 / 空调) must always hide #list regardless of underlying data-mode on desktop and mobile */
    body.wayon-workbench[data-feedback-open] .main-content #list,
    body.wayon-workbench[data-mode][data-feedback-open] .main-content #list.ux-focus-layout,
    body.wayon-workbench[data-memo-open] .main-content #list,
    body.wayon-workbench[data-mode][data-memo-open] .main-content #list.ux-focus-layout,
    body.wayon-workbench[data-mocks-open] .main-content #list,
    body.wayon-workbench[data-mode][data-mocks-open] .main-content #list.ux-focus-layout,
    body.wayon-workbench[data-ledger-open] .main-content #list,
    body.wayon-workbench[data-mode][data-ledger-open] .main-content #list.ux-focus-layout,
    body.wayon-workbench[data-aircon-open] .main-content #list,
    body.wayon-workbench[data-mode][data-aircon-open] .main-content #list.ux-focus-layout,
    body.wayon-workbench[data-feedback-open] .main-content .ux-topbar-panel,
    body.wayon-workbench[data-memo-open] .main-content .ux-topbar-panel,
    body.wayon-workbench[data-mocks-open] .main-content .ux-topbar-panel,
    body.wayon-workbench[data-ledger-open] .main-content .ux-topbar-panel,
    body.wayon-workbench[data-aircon-open] .main-content .ux-topbar-panel{
      display:none!important;
    }
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
      if (page.mode === 'quiz' && showsToday()) {
        const groups = $$('#list .quiz .qgroup.vq-card');
        if (groups.length) {
          left.quiz = groups.filter(g => !g.classList.contains('vq-collapsed')).length;
          return;
        }
      }
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
  // 用户 2026-11-21：每个页面的小红点 = 该页列表里还没处理的数量，不再按是否下课过滤。lessonEnded 保留备用。
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
        let folds = {};
        try { folds = JSON.parse(localStorage.getItem('wayon-vq-folds') || '{}') || {}; } catch {}
        const prefix = page.today + '|';
        const foldedSet = new Set(Object.keys(folds).filter(k => folds[k] && k.startsWith(prefix)).map(k => shown(k.slice(prefix.length))));
        const isFolded = r => {
          const raw = String(r?.[0] || '').trim(), who = shown(raw);
          return foldedSet.has(who) || Boolean(folds[prefix + who] || folds[prefix + raw]);
        };
        return quizRows(rows).filter(r => !(qget(qk(r)).pre && qget(qk(r)).post) && !isFolded(r)).length;   // 收纳完成即清空该生小红点
      }
      // 用户 2026-11-21：「完成」= 今天还没复制发送完成情况的学生数，不管下没下课（列表里有几个未发送就显示几）。
      const own = typeof study !== 'undefined' ? study.cards(page.today).filter(c => !study.copied(page.today, c.id, 'done')).length : 0;
      return rows.filter(r => !get(r[0]).c).length + own;
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
  const airconNoticeEntries = () => {
    const target = noticeDay() || page.tomorrow || page.today;
    const tAir = airconFor(page.today), mAir = airconFor(page.tomorrow);
    const tReady = tAir?.request.status === 'ready';
    const mReady = !tAir?.request.days?.includes(page.tomorrow) && mAir?.request.status === 'ready';
    if (!target || target === page.today || target === page.tomorrow) {
      const readyList = [];
      if (tReady) readyList.push(tAir);
      if (mReady) readyList.push(mAir);
      if (readyList.length) return readyList;
    }
    const curAir = airconFor(target);
    return curAir ? [curAir] : (target ? [{day: target, request: {status: 'unknown', days: [target], text: ''}, copied: false}] : []);
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
        || document.body.dataset.feedbackOpen || document.body.dataset.mocksOpen || document.body.dataset.ledgerOpen || $('dialog[open], .vx-overlay') || (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
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
      ? (left.plan || 0) + (left.done || 0) + (left.quiz || 0) + (left.chasing || 0) : undefined;   // 用户 2026-11-21：侧栏「今天」= 安排+完成+抽背+待催四个标签的数字之和
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
      const subLabel = {plan: '安排', done: '完成', quiz: '抽背', chasing: '待催'}[page.mode];
      const sectionName = ds.feedbackOpen ? '反馈' : ds.memoOpen ? '备忘' : ds.mocksOpen ? '模考' : ds.ledgerOpen ? (ds.ledgerSpace === 'private' ? '个人私密' : '教务')
        : ds.airconOpen ? '空调加时' : page.mode === 'notice' ? '通知' : page.mode === 'classroom' ? '教室' : (subLabel || '今天');
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

  // ---- portrait cards: move card controls into a dedicated footer dock + thin progress bar ----
  function decorateCardFooters() {
    const m = page.mode;
    if (!['plan', 'done', 'notice', 'chasing'].includes(m)) return;
    const list = $('#list'); if (!list) return;
    const cards = $$('.item', list);
    for (const card of cards) {
      if (card.classList.contains('folded') || card.classList.contains('study-form') || card.classList.contains('aircon-card')) continue;
      const kids = [...(card.children || [])];
      const head = kids.find(c => c.classList?.contains('head'));
      if (!head) continue;
      const headKids = [...(head.children || [])];
      const actions = headKids.filter(c =>
        c.classList?.contains('study-actions')
        || (c.tagName === 'BUTTON' && (c.classList?.contains('small') || c.classList?.contains('copy')))
      );
      if (actions.length) {
        let foot = kids.find(c => c.classList?.contains('ux-card-foot'));
        if (!foot) { foot = make('div', 'ux-card-foot'); card.append(foot); }
        const secondary = actions.filter(a => !a.classList?.contains('copy'));
        const primary = actions.filter(a => a.classList?.contains('copy'));
        for (const el of secondary) {
          const existingCopy = [...(foot.children || [])].find(c => c.classList?.contains('copy'));
          if (existingCopy && existingCopy.before) existingCopy.before(el); else foot.append(el);
        }
        for (const el of primary) foot.append(el);
      }
      if (m === 'done') {
        const tasksWrap = kids.find(c => c.classList?.contains('tasks'));
        if (tasksWrap) {
          const rows = [...(tasksWrap.children || [])].filter(c => c.classList?.contains('task'));
          const existingProg = [...(head.children || [])].find(c => c.classList?.contains('ux-card-prog'));
          if (rows.length) {
            const okCount = rows.filter(r => r.classList?.contains('ok')).length;
            const pct = Math.round(okCount / rows.length * 100);
            const prog = existingProg || (() => {
              const p = make('div', 'ux-card-prog'); p.setAttribute('aria-hidden', 'true');
              p.append(make('i')); head.append(p); return p;
            })();
            const bar = prog.children?.[0];
            if (bar && bar.style) bar.style.width = pct + '%';
            if (okCount === rows.length) prog.dataset.complete = '1'; else delete prog.dataset.complete;
          } else {
            existingProg?.remove();
          }
        }
      }
    }
  }

  // ---- Three-Column Focus Workbench (plan / done / chasing) & right vertical folded rail ----
  const FOCUS_MODES = new Set(['plan', 'done', 'chasing']);
  const focusSelected = new Map();
  const focusLastAnimated = new Map();
  let focusNavIntent = null;
  let pendingCopyFly = null;
  const focusScope = () => (page.mode || '') + '|' + (page.cur || page.today || '');
  const prefersReducedMotion = () => {
    try { return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  };
  const isDesktopFocus = () => {
    try { return typeof window === 'undefined' || typeof window.innerWidth !== 'number' || window.innerWidth >= 1024; }
    catch { return true; }
  };
  function withViewTransition(prevCard, nextCard, fn) {
    if (typeof document.startViewTransition !== 'function' || prefersReducedMotion() || !isDesktopFocus()) {
      fn();
      return;
    }
    try {
      if (prevCard && prevCard.style) prevCard.style.viewTransitionName = 'ux-stage-card';
      const vt = document.startViewTransition(() => {
        if (prevCard && prevCard.style) prevCard.style.viewTransitionName = '';
        fn();
        if (nextCard && nextCard.style) nextCard.style.viewTransitionName = 'ux-stage-card';
      });
      vt?.finished?.finally?.(() => {
        if (prevCard && prevCard.style) prevCard.style.viewTransitionName = '';
        if (nextCard && nextCard.style) nextCard.style.viewTransitionName = '';
      });
    } catch {
      if (prevCard && prevCard.style) prevCard.style.viewTransitionName = '';
      if (nextCard && nextCard.style) nextCard.style.viewTransitionName = '';
      fn();
    }
  }
  function cleanCardDisplayName(raw) {
    const stripped = String(raw || '')
      .replace(/^\d+\.\s*/, '')
      .replace(/\s*[（(][^）)]*(?:考|冲刺|在即|仅剩)[^）)]*[）)]/g, '')
      .replace(/\s*考期[：:]\s*\d{4}-\d{2}-\d{2}/g, '')
      .replace(/\s*·\s*自习/, '')
      .replace(/\s*✅.*$/, '')
      .replace(/\s*\[(?:已停止|已停止催缴|本人已确认完成)[^\]]*\]/g, '')
      .replace(/\s*▸$/, '')
      .trim();
    return shown(stripped) || stripped;
  }
  function cardBaseIdentity(el) {
    const isStudy = el.classList?.contains('study-card') || el.classList?.contains('study-folded');
    let raw = '';
    if (el.classList?.contains('folded')) {
      raw = el.getAttribute?.('aria-label') || el.dataset?.uxChasingName || el.textContent || '';
    } else {
      const head = [...(el.children || [])].find(c => c.classList?.contains('head'));
      const nameEl = head ? [...(head.children || [])].find(c => c.classList?.contains('name')) : null;
      raw = nameEl?.textContent || '';
    }
    const base = cleanCardDisplayName(raw);
    return (base || 'card') + (isStudy ? '|study' : '');
  }
  function assignCardKeys(cards) {
    const seen = new Map();
    for (const el of cards) {
      const base = cardBaseIdentity(el);
      const count = (seen.get(base) || 0) + 1;
      seen.set(base, count);
      const key = count > 1 ? base + '#' + count : base;
      if (el.dataset) el.dataset.uxKey = key;
    }
  }
  function rosterMetaFor(card, mode) {
    const kids = [...(card.children || [])];
    const head = kids.find(c => c.classList?.contains('head'));
    const headKids = head ? [...(head.children || [])] : [];
    const nameEl = headKids.find(c => c.classList?.contains('name'));
    const metaEl = headKids.find(c => c.classList?.contains('meta'));
    const isStudy = card.classList?.contains('study-card');
    const nameText = nameEl?.textContent || '';
    const metaText = (metaEl?.textContent || '').trim();
    const displayName = cleanCardDisplayName(nameText) || nameText.trim();
    const urgent = mode === 'chasing' && (
      String(nameEl?.style?.color || '').includes('bad')
      || /考试冲刺|考试在即/.test(nameText)
    );
    let badgeText = '', badgeKind = '';
    if (mode === 'done') {
      const tasksWrap = kids.find(c => c.classList?.contains('tasks'));
      const rows = tasksWrap ? [...(tasksWrap.children || [])].filter(c => c.classList?.contains('task')) : [];
      if (rows.length) {
        const okCount = rows.filter(r => r.classList?.contains('ok')).length;
        badgeText = okCount + '/' + rows.length;
        if (okCount === rows.length) badgeKind = 'is-ready';
      } else if (isStudy) {
        badgeText = '自习';
      }
    } else if (mode === 'plan') {
      const tm = metaText.match(/\d{1,2}:\d{2}\s*[-–~～]\s*\d{1,2}:\d{2}/);
      badgeText = tm ? tm[0].replace(/\s+/g, '') : (isStudy ? '自习' : '');
    } else if (mode === 'chasing') {
      const cnt = metaText.match(/欠交\s*(\d+)\s*项/);
      badgeText = cnt ? '欠' + cnt[1] + '项' : '';
      if (urgent) badgeKind = 'is-urgent';
    }
    return {displayName, isStudy, urgent, badgeText, badgeKind};
  }
  function formatFoldedNameOnly(el) {
    if (el.dataset?.uxFoldFmt === '1') return;
    const raw = (el.textContent || '').trim();
    if (!raw) return;
    const timeMatch = raw.match(/已复制\s*([0-9:：]+|[^\s▸]+)\s*▸?$/);
    const timeText = timeMatch ? timeMatch[1].trim() : '';
    const isStudy = el.classList.contains('study-folded') || /·\s*自习/.test(raw);
    const labelPart = raw.replace(/^\d+\.\s*/, '').replace(/\s*·\s*自习/, '').replace(/\s*✅.*$/, '').replace(/\s*\[(?:已停止|已停止催缴)[^\]]*\]/, '').replace(/\s*▸$/, '').trim();
    const displayName = shown(labelPart) || labelPart;
    el.dataset.uxFoldFmt = '1';
    el.setAttribute('aria-label', raw);
    el.title = (isStudy ? '自习 · ' : '') + (timeText ? '已复制 ' + timeText + ' · 单击展开 · 双击撤回' : '已收纳 · 单击展开 · 双击撤回');
    if (page.mode === 'chasing') {
      // Preserve original text node for chasing numbering assertions; render name-only visually via ::before.
      el.dataset.uxChasingName = displayName;
      return;
    }
    el.replaceChildren(make('span', 'ux-fp-name', displayName));
  }
  function clearAnimClasses(el) {
    if (!el?.classList) return;
    el.classList.remove('ux-anim-from-left', 'ux-anim-from-right', 'ux-anim-next', 'ux-anim-fly-out');
  }
  function resizeVisibleTextareas(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    for (const ta of root.querySelectorAll('textarea.txt')) {
      if (!ta.style) continue;
      ta.style.height = 'auto';
      if (ta.scrollHeight > 0) ta.style.height = ta.scrollHeight + 'px';
    }
  }
  function applyStageSelection(list, activeCards, pendingRail, foldedRail, selectedKey, animDir) {
    const scope = focusScope();
    const prevKey = focusLastAnimated.get(scope);
    const changed = Boolean(selectedKey) && selectedKey !== prevKey;
    let visibleCard = null;
    for (const card of activeCards) {
      const isSelected = Boolean(selectedKey) && card.dataset?.uxKey === selectedKey;
      if (isSelected) {
        visibleCard = card;
        if (card.hasAttribute?.('data-ux-stage-hidden')) card.removeAttribute('data-ux-stage-hidden');
        if (changed && animDir) {
          clearAnimClasses(card);
          const cls = animDir === 'right' ? 'ux-anim-from-right' : animDir === 'next' ? 'ux-anim-next' : 'ux-anim-from-left';
          card.classList.add(cls);
        }
      } else {
        card.setAttribute?.('data-ux-stage-hidden', '1');
        clearAnimClasses(card);
      }
    }
    if (visibleCard) resizeVisibleTextareas(visibleCard);
    if (!isDesktopFocus()) resizeVisibleTextareas(list);
    if (selectedKey) focusLastAnimated.set(scope, selectedKey); else focusLastAnimated.delete(scope);
    if (pendingRail) {
      for (const btn of [...(pendingRail.children || [])].filter(c => c.classList?.contains('ux-roster-btn'))) {
        const on = btn.dataset?.uxKey === selectedKey;
        if (on) btn.classList.add('on'); else btn.classList.remove('on');
        btn.setAttribute?.('aria-current', on ? 'true' : 'false');
      }
    }
    if (foldedRail) {
      for (const btn of [...(foldedRail.children || [])].filter(c => c.classList?.contains('ux-rail-open'))) {
        const on = btn.dataset?.uxKey === selectedKey;
        if (on) btn.classList.add('on'); else btn.classList.remove('on');
        btn.setAttribute?.('aria-pressed', on ? 'true' : 'false');
      }
    }
    const stage = [...(list.children || [])].find(c => c.classList?.contains('ux-focus-stage'));
    if (stage) {
      let empty = [...(stage.children || [])].find(c => c.classList?.contains('ux-stage-empty'));
      if (!selectedKey) {
        if (!empty) {
          empty = make('div', 'ux-stage-empty');
          empty.append(make('span', 'ux-stage-empty-icon'), make('b', '', '本页已全部处理完'), make('span', '', '点击右侧姓名可随时展开查看或再复制'));
          stage.append(empty);
        }
      } else if (empty) {
        empty.remove();
      }
    }
  }
  function selectFocusCard(targetKey, dir) {
    const list = $('#list'); if (!list || !list.classList?.contains('ux-focus-layout')) return;
    const scope = focusScope();
    const stage = [...(list.children || [])].find(c => c.classList?.contains('ux-focus-stage'));
    const pendingRail = [...(list.children || [])].find(c => c.classList?.contains('ux-pending-rail'));
    const foldedRail = [...(list.children || [])].find(c => c.classList?.contains('ux-folded-rail'));
    if (!stage) return;
    const activeCards = [...(stage.children || [])].filter(c => c.classList?.contains('item') && !c.classList?.contains('folded'));
    const prevKey = focusSelected.get(scope);
    if (prevKey === targetKey) return;
    const prevCard = activeCards.find(c => c.dataset?.uxKey === prevKey) || null;
    const nextCard = activeCards.find(c => c.dataset?.uxKey === targetKey) || null;
    if (!nextCard) return;
    focusSelected.set(scope, targetKey);
    focusNavIntent = {scope, key: targetKey, dir: dir || 'left', ts: Date.now()};
    withViewTransition(prevCard, nextCard, () => {
      applyStageSelection(list, activeCards, pendingRail, foldedRail, targetKey, dir || 'left');
    });
  }
  function decorateFocusWorkbench(list, m) {
    const direct = [...(list.children || [])];
    let pendingRail = direct.find(c => c.classList?.contains('ux-pending-rail'));
    let stage = direct.find(c => c.classList?.contains('ux-focus-stage'));
    let rail = direct.find(c => c.classList?.contains('ux-folded-rail'));
    let oldGrid = direct.find(c => c.classList?.contains('ux-active-grid'));
    const folded = [
      ...(rail ? [...(rail.children || [])].filter(c => c.classList?.contains('folded')) : []),
      ...direct.filter(c => c.classList?.contains('item') && c.classList?.contains('folded'))
    ];
    const activeCards = [
      ...(stage ? [...(stage.children || [])].filter(c => c.classList?.contains('item') && !c.classList?.contains('folded')) : []),
      ...(oldGrid ? [...(oldGrid.children || [])].filter(c => c.classList?.contains('item') && !c.classList?.contains('folded')) : []),
      ...direct.filter(c => c.classList?.contains('item') && !c.classList?.contains('folded') && !c.classList?.contains('study-form') && !c.classList?.contains('aircon-card'))
    ];
    if (oldGrid) {
      for (const card of activeCards) oldGrid.before(card);
      oldGrid.remove();
    }
    if (!activeCards.length && !folded.length) {
      list.classList.remove('ux-focus-layout');
      pendingRail?.remove();
      stage?.remove();
      rail?.remove();
      return;
    }
    list.classList.add('ux-focus-layout');
    for (const item of folded) formatFoldedNameOnly(item);
    assignCardKeys([...activeCards, ...folded]);
    const pendingCards = activeCards.filter(c => !c.classList?.contains('copied'));
    const expandedCopied = activeCards.filter(c => c.classList?.contains('copied'));
    const shelfAnchor = direct.find(c => c.classList?.contains('ux-past') || c.classList?.contains('chasing-stopped'));

    // Ensure 3-column order: .ux-pending-rail -> .ux-focus-stage -> .ux-folded-rail
    if (!pendingRail) {
      pendingRail = make('aside', 'ux-pending-rail');
      pendingRail.setAttribute('aria-label', '待处理名单');
      if (stage && stage.parentElement === list) stage.before(pendingRail);
      else if (rail && rail.parentElement === list) rail.before(pendingRail);
      else if (shelfAnchor) shelfAnchor.before(pendingRail);
      else list.append(pendingRail);
    }
    if (!stage) {
      stage = make('div', 'ux-focus-stage');
      if (rail && rail.parentElement === list) rail.before(stage);
      else if (shelfAnchor) shelfAnchor.before(stage);
      else list.append(stage);
    }
    for (const card of activeCards) {
      if (card.parentElement !== stage) stage.append(card);
    }
    if (!rail) {
      rail = make('aside', 'ux-folded-rail');
      rail.setAttribute('aria-label', '已收纳');
      if (shelfAnchor) shelfAnchor.before(rail); else list.append(rail);
    }

    // Resolve selection & animation direction (including post-copy auto-advance & right-rail arrival pulse)
    const scope = focusScope();
    let arrivedFoldedKey = '';
    let animDir = '';
    if (pendingCopyFly && pendingCopyFly.scope === scope && Date.now() - pendingCopyFly.ts < 3000) {
      const landedInFolded = folded.some(f => f.dataset?.uxKey === pendingCopyFly.copiedKey);
      const landedInCopied = expandedCopied.some(c => c.dataset?.uxKey === pendingCopyFly.copiedKey);
      if (landedInFolded || landedInCopied) {
        if (landedInFolded) arrivedFoldedKey = pendingCopyFly.copiedKey;
        const nextExists = pendingCopyFly.nextKey && pendingCards.some(c => c.dataset?.uxKey === pendingCopyFly.nextKey);
        const target = nextExists ? pendingCopyFly.nextKey : (pendingCards[0]?.dataset?.uxKey || '');
        if (target) focusSelected.set(scope, target); else focusSelected.delete(scope);
        animDir = 'next';
        pendingCopyFly = null;
      }
    }
    let selectedKey = focusSelected.get(scope) || '';
    if (!selectedKey || !activeCards.some(c => c.dataset?.uxKey === selectedKey)) {
      selectedKey = pendingCards[0]?.dataset?.uxKey || expandedCopied[0]?.dataset?.uxKey || '';
      if (selectedKey) focusSelected.set(scope, selectedKey); else focusSelected.delete(scope);
      if (!animDir && focusLastAnimated.has(scope) && selectedKey) animDir = 'next';
    }
    if (!animDir && focusNavIntent && focusNavIntent.scope === scope && focusNavIntent.key === selectedKey && Date.now() - focusNavIntent.ts < 2000) {
      animDir = focusNavIntent.dir;
      focusNavIntent = null;
    }

    // Build / sync left pending roster (signature-checked so MutationObserver stays silent)
    const leftTitle = m === 'plan' ? '待安排' : m === 'chasing' ? '待催交' : '待核对';
    const rosterData = pendingCards.map(c => ({key: c.dataset?.uxKey || '', ...rosterMetaFor(c, m)}));
    const leftSig = leftTitle + '|' + rosterData.map(r => [r.key, r.displayName, r.urgent ? 1 : 0, r.badgeText, r.badgeKind].join('~')).join(';');
    if (pendingRail.dataset?.sig !== leftSig) {
      pendingRail.dataset.sig = leftSig;
      const head = make('div', 'ux-rail-head');
      head.append(make('span', '', leftTitle), make('span', 'ux-rail-count', String(rosterData.length)));
      const nodes = [head];
      if (!rosterData.length) {
        nodes.push(make('div', 'ux-rail-empty', '全部已处理'));
      } else {
        for (const r of rosterData) {
          const btn = make('button', 'ux-roster-btn');
          btn.type = 'button';
          btn.dataset.uxKey = r.key;
          if (r.urgent) btn.dataset.urgent = '1';
          const main = make('span', 'ux-roster-main');
          if (r.urgent) { const dot = make('span', 'ux-roster-dot'); dot.setAttribute('aria-hidden', 'true'); main.append(dot); }
          main.append(make('span', 'ux-roster-name', r.displayName + (r.isStudy ? ' · 自习' : '')));
          btn.append(main);
          if (r.badgeText) {
            const sub = make('span', 'ux-roster-sub' + (r.badgeKind ? ' ' + r.badgeKind : ''), r.badgeText);
            btn.append(sub);
          }
          btn.onclick = () => selectFocusCard(r.key, 'left');
          nodes.push(btn);
        }
      }
      pendingRail.replaceChildren(...nodes);
    }

    // Build / sync right completed rail (head + active expanded proxies + real folded cards)
    const rightTitle = m === 'chasing' ? '已催交' : '已复制';
    const completedTotal = folded.length + expandedCopied.length;
    let rightHead = [...(rail.children || [])].find(c => c.classList?.contains('ux-rail-head'));
    const rightHeadSig = rightTitle + '|' + completedTotal;
    if (!rightHead || rightHead.dataset?.sig !== rightHeadSig) {
      rightHead?.remove();
      rightHead = make('div', 'ux-rail-head');
      rightHead.dataset.sig = rightHeadSig;
      const cnt = make('span', 'ux-rail-count', String(completedTotal));
      if (completedTotal > 0) cnt.dataset.hasItems = '1';
      rightHead.append(make('span', '', rightTitle), cnt);
      rail.prepend(rightHead);
    }
    const proxySig = expandedCopied.map(c => c.dataset?.uxKey + ':' + cleanCardDisplayName($('.head .name', c)?.textContent || '')).join(';');
    if (rail.dataset?.proxySig !== proxySig) {
      rail.dataset.proxySig = proxySig;
      for (const old of [...(rail.children || [])].filter(c => c.classList?.contains('ux-rail-open'))) old.remove();
      let anchor = rightHead;
      for (const card of expandedCopied) {
        const key = card.dataset?.uxKey || '';
        const name = cleanCardDisplayName($('.head .name', card)?.textContent || '');
        const proxy = make('button', 'ux-rail-open');
        proxy.type = 'button';
        proxy.dataset.uxKey = key;
        proxy.title = '单击查看/收起 · 双击撤回 ' + name;
        proxy.append(make('span', 'ux-fp-name', name));
        proxy.onclick = () => {
          if (focusSelected.get(focusScope()) === key) {
            const collapseBtn = [...(card.querySelectorAll?.('button') || [])].find(b =>
              b.dataset?.iconAction === 'Collapse' || /收起/.test(b.textContent || '') || /收起/.test(b.getAttribute?.('aria-label') || '')
            );
            if (collapseBtn && typeof collapseBtn.click === 'function') collapseBtn.click();
          } else {
            selectFocusCard(key, 'right');
          }
        };
        if (anchor && typeof anchor.after === 'function') { anchor.after(proxy); anchor = proxy; }
        else rail.append(proxy);
      }
    }
    for (const item of folded) {
      if (item.parentElement !== rail) rail.append(item);
      if (arrivedFoldedKey && item.dataset?.uxKey === arrivedFoldedKey) {
        item.classList.remove('ux-anim-rail-in');
        item.classList.add('ux-anim-rail-in');
      }
    }
    let railEmpty = [...(rail.children || [])].find(c => c.classList?.contains('ux-rail-empty'));
    let railTip = [...(rail.children || [])].find(c => c.classList?.contains('ux-rail-tip'));
    railEmpty?.remove();
    if (completedTotal === 0) {
      railTip?.remove();
    } else {
      if (!railTip) {
        railTip = make('div', 'ux-rail-tip', '双击姓名撤回');
        rail.append(railTip);
      } else if (rail.lastElementChild !== railTip) {
        rail.append(railTip);
      }
    }
    rail.dataset.onlyFolded = activeCards.length ? '0' : '1';
    rail.dataset.emptyFolded = folded.length ? '0' : '1';

    applyStageSelection(list, activeCards, pendingRail, rail, selectedKey, animDir);
  }
  function decorateFoldedRail() {
    const m = page.mode;
    const list = $('#list'); if (!list) return;
    if (FOCUS_MODES.has(m)) {
      decorateFocusWorkbench(list, m);
      return;
    }
    list.classList?.remove?.('ux-focus-layout');
    if (m !== 'notice') return;
    const direct = [...(list.children || [])];
    direct.find(c => c.classList?.contains('ux-pending-rail'))?.remove();
    const oldStage = direct.find(c => c.classList?.contains('ux-focus-stage'));
    if (oldStage) {
      for (const c of [...(oldStage.children || [])].filter(x => x.classList?.contains('item'))) {
        c.removeAttribute?.('data-ux-stage-hidden');
        oldStage.before(c);
      }
      oldStage.remove();
    }
    let rail = direct.find(c => c.classList?.contains('ux-folded-rail'));
    let activeGrid = direct.find(c => c.classList?.contains('ux-active-grid'));
    let allDone = direct.find(c => c.classList?.contains('ux-all-done'));
    const folded = [
      ...(rail ? [...(rail.children || [])].filter(c => c.classList?.contains('folded')) : []),
      ...direct.filter(c => c.classList?.contains('item') && c.classList?.contains('folded'))
    ];
    const activeCards = [
      ...(activeGrid ? [...(activeGrid.children || [])].filter(c => c.classList?.contains('item') && !c.classList?.contains('folded')) : []),
      ...direct.filter(c => c.classList?.contains('item') && !c.classList?.contains('folded') && !c.classList?.contains('study-form'))
    ];
    if (!folded.length) {
      allDone?.remove();
      if (activeGrid) {
        for (const card of activeCards) activeGrid.before(card);
        activeGrid.remove();
      }
      rail?.remove();
      return;
    }
    const shelfAnchor = direct.find(c => c.classList?.contains('ux-past') || c.classList?.contains('chasing-stopped'));
    if (activeCards.length) {
      allDone?.remove();
      if (!activeGrid) {
        activeGrid = make('div', 'ux-active-grid');
        if (rail && rail.parentElement === list) rail.before(activeGrid);
        else if (shelfAnchor) shelfAnchor.before(activeGrid);
        else list.append(activeGrid);
      }
      for (const card of activeCards) {
        if (card.parentElement !== activeGrid) activeGrid.append(card);
      }
    } else {
      if (activeGrid) activeGrid.remove();
      if (!allDone) {
        allDone = make('div', 'ux-all-done');
        const empty = make('div', 'ux-stage-empty');
        empty.append(make('div', 'ux-stage-empty-icon'), make('b', '', '课程通知已全部完成'), make('span', '', '点击右侧姓名可展开复核，双击撤回'));
        allDone.append(empty);
        if (rail && rail.parentElement === list) rail.before(allDone);
        else if (shelfAnchor) shelfAnchor.before(allDone);
        else list.append(allDone);
      }
    }
    if (!rail) {
      rail = make('div', 'ux-folded-rail');
      rail.setAttribute('aria-label', '已收纳');
      if (shelfAnchor) shelfAnchor.before(rail); else list.append(rail);
    }
    for (const item of folded) {
      formatFoldedNameOnly(item);
      if (item.parentElement !== rail) rail.append(item);
    }
    let tip = [...(rail.children || [])].find(c => c.classList?.contains('ux-rail-tip'));
    if (!tip) { tip = make('div', 'ux-rail-tip', '双击姓名撤回'); rail.append(tip); }
    else if (rail.lastElementChild !== tip) rail.append(tip);
    rail.dataset.onlyFolded = activeCards.length ? '0' : '1';
  }
  function decorateQuizRail() {
    if (page.mode !== 'quiz') return;
    const quiz = $('#list .quiz'); if (!quiz) return;
    const direct = [...(quiz.children || [])];
    let rail = direct.find(c => c.classList?.contains('ux-quiz-rail'));
    let grid = direct.find(c => c.classList?.contains('ux-quiz-grid'));
    let allDone = direct.find(c => c.classList?.contains('ux-all-done'));
    const allGroups = [
      ...(grid ? [...(grid.children || [])].filter(c => c.classList?.contains('qgroup')) : []),
      ...(rail ? [...(rail.children || [])].filter(c => c.classList?.contains('qgroup')) : []),
      ...direct.filter(c => c.classList?.contains('qgroup'))
    ];
    const folded = allGroups.filter(g => g.classList?.contains('vq-collapsed'));
    const active = allGroups.filter(g => !g.classList?.contains('vq-collapsed'));
    if (!folded.length) {
      allDone?.remove();
      if (grid) {
        for (const g of active) grid.before(g);
        grid.remove();
      }
      rail?.remove();
      return;
    }
    if (active.length) {
      allDone?.remove();
      if (!grid) {
        grid = make('div', 'ux-quiz-grid');
        if (rail && rail.parentElement === quiz) rail.before(grid); else quiz.append(grid);
      }
      for (const g of active) {
        if (g.parentElement !== grid) grid.append(g);
      }
    } else {
      if (grid) grid.remove();
      if (!allDone) {
        allDone = make('div', 'ux-all-done');
        const empty = make('div', 'ux-stage-empty');
        empty.append(make('div', 'ux-stage-empty-icon'), make('b', '', '今日单词抽背已全部完成'), make('span', '', '点击右侧姓名可展开复核，双击撤回'));
        allDone.append(empty);
        if (rail && rail.parentElement === quiz) rail.before(allDone); else quiz.append(allDone);
      }
    }
    if (!rail) {
      rail = make('div', 'ux-quiz-rail');
      rail.setAttribute('aria-label', '已收纳');
      quiz.append(rail);
    }
    for (const g of folded) {
      g.title = '单击展开 · 双击撤回至未完成';
      if (g.parentElement !== rail) rail.append(g);
    }
    let tip = [...(rail.children || [])].find(c => c.classList?.contains('ux-rail-tip'));
    if (!tip) { tip = make('div', 'ux-rail-tip', '双击姓名撤回'); rail.append(tip); }
    else if (rail.lastElementChild !== tip) rail.append(tip);
  }

  // ---- notices carry the air-conditioning request ---------------------------------
  function decorateNotice() {
    const topPanel = $('.ux-topbar-panel');
    const old = (topPanel && [...(topPanel.children || [])].find(c => c.classList?.contains('ux-aircon'))) || $('#list > .ux-aircon');
    if (page.mode !== 'notice') { old?.remove(); return; }
    const list = $('#list'); if (!list) return;
    const entries = airconNoticeEntries();
    if (!entries.length) { old?.remove(); return; }
    const sig = entries.map(a => [a.day, a.request.status, a.request.text || '', a.copied].join('|')).join('||');
    if (old?.dataset.sig === sig && (!topPanel || old.parentElement === topPanel)) return;
    old?.remove();
    const multi = entries.length > 1;
    const row = make('div', 'ux-aircon'); row.dataset.sig = sig;
    if (multi) row.dataset.multi = '';
    if (entries.every(a => a.request.status === 'ready' && a.copied)) row.dataset.copied = '';
    const openAircon = day => {
      if (typeof globalThis.wayonAircon?.open === 'function') globalThis.wayonAircon.open(day);
      else document.getElementById('nav-aircon')?.click();
    };
    const bindKey = fn => e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
    const dayLabel = air => {
      const days = air.request.days?.length ? air.request.days : [air.day];
      if (days.length > 1) return days.map(md).join('/');
      const d = days[0];
      return (d === page.today ? '今天 ' : d === page.tomorrow ? '明天 ' : '') + md(d);
    };
    const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
    const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';
    const CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
    const primaryAir = entries.find(a => a.request.status === 'ready' && !a.copied) || entries[0];
    const openPrimary = () => openAircon(primaryAir.day);
    const titleEl = make('b', '', '空调加时申请');
    titleEl.title = '点击查看并编辑空调加时文本';
    titleEl.setAttribute('role', 'button');
    titleEl.tabIndex = 0;
    titleEl.onclick = openPrimary;
    titleEl.onkeydown = bindKey(openPrimary);
    row.append(titleEl);
    const buildEntry = air => {
      const status = air.request.status;
      const isReady = status === 'ready';
      const when = isReady ? ((air.request.text.match(/开启时间：(.+)/) || [])[1] || '') : '';
      const dLabel = dayLabel(air);
      const summary = isReady
        ? dLabel + (when ? ' · ' + when : '')
        : status === 'none'
        ? md(air.day) + ' 无需加时 · 可选其他日期'
        : md(air.day) + ' 课表待核实 · 可选其他日期';
      const openThis = () => openAircon(air.day);
      const sumEl = make('span', '', summary);
      sumEl.title = '点击查看并编辑 ' + dLabel + ' 空调加时文本';
      sumEl.setAttribute('role', 'button');
      sumEl.tabIndex = 0;
      sumEl.onclick = openThis;
      sumEl.onkeydown = bindKey(openThis);
      const act = make('button', 'ux-aircon-copy'); act.type = 'button';
      const label = isReady ? (air.copied ? '再次复制 ' + dLabel + ' 空调加时申请' : '一键复制 ' + dLabel + ' 空调加时申请') : '查看空调加时';
      act.title = label;
      act.setAttribute('aria-label', label);
      act.innerHTML = isReady ? (air.copied ? CHECK_SVG : COPY_SVG) : CHEVRON_SVG;
      act.onclick = () => {
        if (isReady && typeof globalThis.wayonAircon?.copy === 'function') {
          globalThis.wayonAircon.copy(air.day, () => {
            showUndoToast('已复制 ' + dLabel + ' 空调加时申请');
            delete row.dataset.sig;
            apply();
          }, openThis);
        } else {
          openThis();
        }
      };
      return {sumEl, act};
    };
    if (!multi) {
      const {sumEl, act} = buildEntry(entries[0]);
      row.append(sumEl, act);
    } else {
      const group = make('div', 'ux-aircon-items');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', '今明两日空调加时申请');
      entries.forEach((air, idx) => {
        if (idx > 0) {
          const sep = make('span', 'ux-aircon-sep');
          sep.setAttribute('role', 'separator');
          sep.setAttribute('aria-orientation', 'vertical');
          group.append(sep);
        }
        const item = make('div', 'ux-aircon-item');
        item.dataset.day = air.day;
        if (air.request.status === 'ready' && air.copied) item.dataset.copied = '';
        const {sumEl, act} = buildEntry(air);
        item.append(sumEl, act);
        group.append(item);
      });
      row.append(group);
    }
    if (topPanel) topPanel.prepend(row); else list.prepend(row);
  }

  // ---- reminders: exam already over goes to the bottom, collapsed -------------------
  function decorateChasing() {
    if (page.mode !== 'chasing') return;
    const list = $('#list'); if (!list) return;
    const findLiveChasing = () => {
      const stage = [...(list.children || [])].find(c => c.classList?.contains('ux-focus-stage') || c.classList?.contains('ux-active-grid'));
      return [
        ...(stage ? [...(stage.children || [])].filter(c => c.classList?.contains('item') && !c.classList?.contains('folded')) : []),
        ...$$(':scope > .item:not(.folded)', list)
      ];
    };
    const activeChasing = findLiveChasing();
    const past = activeChasing.filter(card => {
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
    if (box) $('summary', box).textContent = '考期已过 · ' + $$('.item', box).length + ' 人';
    const foldedChasing = (() => {
      const rail = [...(list.children || [])].find(c => c.classList?.contains('ux-folded-rail'));
      return [
        ...(rail ? [...(rail.children || [])].filter(c => c.classList?.contains('folded')) : []),
        ...$$(':scope > .item.folded', list)
      ];
    })();
    for (const folded of foldedChasing) {
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
    const liveChasing = findLiveChasing();
    liveChasing.forEach((card, i) => {
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
        + '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .ux-mark{color:#f5f5f7}}'
        + ':root[data-theme="dark"] .ux-mark{color:#f5f5f7}';
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
  // ---- Double-click right completed rail to undo back to pending across all 5 views ----
  let undoToastTimer = 0, pendingRailClick = null, lastUndoAt = 0;
  function showUndoToast(text) {
    if (!document.body) return;
    let toast = $('.ux-undo-toast');
    if (!toast) { toast = make('div', 'ux-undo-toast'); toast.setAttribute('role', 'status'); document.body.append(toast); }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(undoToastTimer);
    undoToastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }
  function matchDisplayName(raw, target) {
    const a = cleanCardDisplayName(raw), b = cleanCardDisplayName(target);
    return Boolean(a && b) && (a === b || clean(a) === clean(b));
  }
  function undoCompletedEntry(mode, el) {
    if (!el || Date.now() - lastUndoAt < 350) return false;
    lastUndoAt = Date.now();
    const key = el.dataset?.uxKey || '';
    const isStudy = el.classList?.contains('study-folded') || key.endsWith('|study');
    const rawLabel = el.classList?.contains('qgroup')
      ? ($('.vq-student-name', el)?.textContent || $('.qhead', el)?.textContent || '')
      : (el.dataset?.uxChasingName || $('.ux-fp-name', el)?.textContent || el.getAttribute?.('aria-label') || el.textContent || '');
    const displayName = cleanCardDisplayName(rawLabel);
    if (!displayName) return false;
    const scope = focusScope();
    let undone = false;
    try {
      if (mode === 'plan') {
        const day = page.cur || page.today;
        if (isStudy && typeof study !== 'undefined' && typeof study.cards === 'function' && typeof StudyTasks !== 'undefined') {
          const card = study.cards(day).find(c => matchDisplayName(c.studentName, displayName));
          if (card) {
            study.open?.delete?.(day + ':' + card.id + ':plan');
            study.commit(day, f => { delete f[StudyTasks.key('study-copy', card.id, 'plan')]; });
            undone = true;
          }
        } else {
          const rows = planRowsFor(day);
          const p = rows.find(row => matchDisplayName(row[0], displayName));
          if (p && typeof ps !== 'undefined') {
            const meta = p[5], cardKey = (meta && meta.isGroup) ? meta.key : p[0];
            delete ps[cardKey];
            if (meta?.isGroup) for (const mName of meta.members || []) delete ps[mName];
            if (typeof openCards !== 'undefined') openCards.delete('plan:' + day + ':' + cardKey);
            if (typeof psave === 'function') psave();
            undone = true;
          }
        }
      } else if (mode === 'done') {
        const day = page.cur || page.today;
        if (isStudy && typeof study !== 'undefined' && typeof study.cards === 'function' && typeof StudyTasks !== 'undefined') {
          const card = study.cards(day).find(c => matchDisplayName(c.studentName, displayName));
          if (card) {
            study.open?.delete?.(day + ':' + card.id + ':done');
            study.commit(day, f => { delete f[StudyTasks.key('study-copy', card.id, 'done')]; });
            undone = true;
          }
        } else {
          const rows = page.data[day] || [];
          const row = rows.find(r => matchDisplayName(r[0], displayName));
          if (row && typeof get === 'function') {
            get(row[0]).c = '';
            if (typeof openCards !== 'undefined') openCards.delete('done:' + day + ':' + row[0]);
            if (typeof save === 'function') save();
            undone = true;
          }
        }
      } else if (mode === 'chasing') {
        const rows = typeof chasingRows === 'function' ? chasingRows(page.chasing || []) : (page.chasing || []);
        const row = rows.find(r => matchDisplayName(r.name, displayName) || (r.chasing_aliases || []).some(a => matchDisplayName(a, displayName)));
        if (row && typeof ch !== 'undefined') {
          const keys = [row.name, ...(row.chasing_aliases || [])];
          let hadToday = false;
          for (const k of keys) if (Object.hasOwn(ch, k)) { delete ch[k]; hadToday = true; }
          if (typeof openCards !== 'undefined') openCards.delete('chasing:' + page.today + ':' + row.name);
          if (hadToday && typeof chsave === 'function') { chsave(); undone = true; }
        }
      } else if (mode === 'notice') {
        const nDay = noticeDay() || page.tomorrow;
        const rows = (typeof NOTICE !== 'undefined' ? NOTICE[nDay] : page.data._notice?.[nDay]) || [];
        const row = rows.find(r => matchDisplayName(r[0], displayName));
        if (row && typeof nc !== 'undefined' && typeof noticeKey === 'function') {
          delete nc[noticeKey(row)];
          if (typeof openCards !== 'undefined') openCards.delete('notice:' + nDay + ':' + row[0]);
          if (typeof nsave === 'function') nsave();
          undone = true;
        }
      } else if (mode === 'quiz') {
        const day = page.cur || page.today;
        const rows = typeof quizRows === 'function' ? quizRows(page.data[day] || []) : [];
        let touched = false;
        for (const r of rows) {
          if (!matchDisplayName(r[0], displayName)) continue;
          if (typeof qget === 'function' && typeof qk === 'function') {
            const rec = qget(qk(r));
            rec.pre = false; rec.post = false;
            if (rec.vocabEvidence) delete rec.vocabEvidence;
            touched = true;
          }
        }
        if (touched && typeof qsave === 'function') qsave();
        const foldBtn = $('.vq-fold', el);
        if (el.classList?.contains('vq-collapsed') && foldBtn && typeof foldBtn.click === 'function') {
          foldBtn.dataset.uxReplayClick = '1';
          foldBtn.click();
        }
        undone = touched || el.classList?.contains('vq-collapsed');
      }
    } catch (e) { console.warn('ux undo:', e); }
    if (undone) {
      if (FOCUS_MODES.has(mode) && key) {
        focusSelected.set(scope, key);
        focusNavIntent = {scope, key, dir: 'right', ts: Date.now()};
      }
      if (!((mode === 'plan' || mode === 'done') && isStudy)) {
        try { page.render(); } catch {}
      }
      setTimeout(schedule, 0);
      showUndoToast('已撤回「' + displayName + '」到未完成');
    } else if (mode === 'chasing') {
      showUndoToast('「' + displayName + '」为前两日已催记录，可单击展开查看');
    }
    return undone;
  }

  // Capture phase so vocab.js fold.onclick (which calls stopPropagation) still triggers right-rail sync,
  // right-rail items cleanly distinguish single-click (expand) vs double-click (undo to pending),
  // and three-column focus views capture copy-to-right flyout before render().
  const RAIL_HIT_SEL = '#list .ux-folded-rail > .item.folded, #list .ux-folded-rail > .ux-rail-open, #list .ux-quiz-rail > .qgroup.vq-collapsed';
  document.addEventListener('click', event => {
    const railHit = event.target.closest?.(RAIL_HIT_SEL);
    if (railHit) {
      if (railHit.dataset?.uxReplayClick === '1' || event.target.closest?.('[data-ux-replay-click="1"]')) {
        delete railHit.dataset.uxReplayClick;
        if (railHit.classList?.contains('qgroup')) setTimeout(schedule, 0);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const hitId = railHit.dataset?.uxKey || railHit.getAttribute?.('aria-label') || $('.vq-student-name', railHit)?.textContent || railHit.textContent || '';
      if ((pendingRailClick && pendingRailClick.id === hitId && Date.now() - pendingRailClick.ts < 380) || event.detail >= 2) {
        if (pendingRailClick) { clearTimeout(pendingRailClick.timer); pendingRailClick = null; }
        undoCompletedEntry(page.mode, railHit);
        return;
      }
      if (pendingRailClick) { clearTimeout(pendingRailClick.timer); pendingRailClick = null; }
      const snapEl = railHit, snapMode = page.mode;
      pendingRailClick = {
        id: hitId,
        ts: Date.now(),
        timer: setTimeout(() => {
          pendingRailClick = null;
          if (!snapEl.isConnected && snapEl.parentElement == null) return;
          if (snapMode === 'quiz' && snapEl.classList?.contains('qgroup')) {
            const unfoldBtn = $('.vq-fold', snapEl) || $('.qhead', snapEl) || snapEl;
            if (unfoldBtn.dataset) unfoldBtn.dataset.uxReplayClick = '1';
            if (snapEl.dataset) snapEl.dataset.uxReplayClick = '1';
            if (typeof unfoldBtn.click === 'function') unfoldBtn.click();
            setTimeout(schedule, 0);
            return;
          }
          if (FOCUS_MODES.has(snapMode) && snapEl.classList?.contains('folded') && snapEl.dataset?.uxKey) {
            const scope = focusScope();
            focusSelected.set(scope, snapEl.dataset.uxKey);
            focusNavIntent = {scope, key: snapEl.dataset.uxKey, dir: 'right', ts: Date.now()};
          }
          if (snapEl.dataset) snapEl.dataset.uxReplayClick = '1';
          if (typeof snapEl.click === 'function') snapEl.click();
          else snapEl.onclick?.();
        }, 220)
      };
      return;
    }
    if (event.target.closest?.('#list .quiz .vq-fold, #list .quiz .qgroup.vq-collapsed')) { setTimeout(() => { readCount('quiz'); decorateNav(); schedule(); }, 0); }
    if (!FOCUS_MODES.has(page.mode)) return;
    const copyBtn = event.target.closest?.('#list .ux-focus-stage .item:not(.folded) button.copy');
    if (copyBtn) {
      const card = copyBtn.closest?.('.item');
      if (card && !card.classList?.contains('copied') && card.dataset?.uxKey) {
        const list = $('#list');
        const pendingRail = list ? [...(list.children || [])].find(c => c.classList?.contains('ux-pending-rail')) : null;
        const keys = pendingRail ? [...(pendingRail.children || [])].filter(c => c.classList?.contains('ux-roster-btn')).map(b => b.dataset?.uxKey).filter(Boolean) : [];
        const idx = keys.indexOf(card.dataset.uxKey);
        const nextKey = idx >= 0 ? (keys[idx + 1] || keys[idx - 1] || '') : '';
        pendingCopyFly = {scope: focusScope(), copiedKey: card.dataset.uxKey, nextKey, ts: Date.now()};
        if (isDesktopFocus() && !prefersReducedMotion()) {
          clearAnimClasses(card);
          card.classList.add('ux-anim-fly-out');
          setTimeout(() => card.classList?.remove('ux-anim-fly-out'), 600);
        }
      }
    }
  }, true);
  document.addEventListener('dblclick', event => {
    const railHit = event.target.closest?.(RAIL_HIT_SEL);
    if (!railHit) return;
    if (pendingRailClick) { clearTimeout(pendingRailClick.timer); pendingRailClick = null; }
    event.preventDefault();
    event.stopImmediatePropagation();
    undoCompletedEntry(page.mode, railHit);
  }, true);
  // Keyboard Up/Down stepping through pending students + Escape to dismiss sync popup.
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const notice = $('.wayon-sync-notice');
      if (notice && !notice.hidden && notice.dataset?.uxDismissed !== '1') {
        notice.dataset.uxDismissed = '1';
        const bd = $('.ux-sync-backdrop'); if (bd) bd.hidden = true;
        return;
      }
    }
    if ((event.key !== 'ArrowDown' && event.key !== 'ArrowUp') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!FOCUS_MODES.has(page.mode) || !isDesktopFocus()) return;
    const active = document.activeElement;
    if (active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)) return;
    if ($('dialog[open], .vx-overlay') || document.body.dataset.airconOpen || document.body.dataset.memoOpen
        || document.body.dataset.feedbackOpen || document.body.dataset.mocksOpen || document.body.dataset.ledgerOpen) return;
    const list = $('#list'); if (!list?.classList?.contains('ux-focus-layout')) return;
    const pendingRail = [...(list.children || [])].find(c => c.classList?.contains('ux-pending-rail'));
    const btns = pendingRail ? [...(pendingRail.children || [])].filter(c => c.classList?.contains('ux-roster-btn')) : [];
    if (btns.length < 2) return;
    const curKey = focusSelected.get(focusScope());
    const idx = btns.findIndex(b => b.dataset?.uxKey === curKey);
    const nextIdx = event.key === 'ArrowDown'
      ? (idx < 0 ? 0 : Math.min(btns.length - 1, idx + 1))
      : (idx < 0 ? 0 : Math.max(0, idx - 1));
    if (nextIdx !== idx && btns[nextIdx]?.dataset?.uxKey) {
      event.preventDefault();
      selectFocusCard(btns[nextIdx].dataset.uxKey, 'left');
      btns[nextIdx].scrollIntoView?.({block: 'nearest', behavior: 'smooth'});
    }
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
  const taskTag = el => {
    const row = el.closest?.('.task');
    if (!row) return '';
    const txt = $('.txt, textarea, .study-task-text', row);
    const label = String(txt?.value ?? txt?.textContent ?? '').trim().slice(0, 32);
    const siblings = row.parentElement ? [...row.parentElement.children] : [];
    const idx = siblings.indexOf(row);
    return label ? `${idx}:${label}` : String(idx);
  };
  const detailKey = el => [page.mode, page.cur, el.className, cardName(el), taskTag(el),
    ($(':scope > summary', el)?.textContent || '').replace(/[0-9]+/g, '').trim().slice(0, 24)].join('|').replace(/^([^|]*\|[^|]*\|[^|]*\|)[0-9]+\.\s*/, '$1');
  const syncDetailsIntent = el => {
    if (!el || el.tagName !== 'DETAILS' || !el.closest?.('#list')) return;
    lastUser = Date.now();
    const key = detailKey(el);
    // Capture runs before the browser toggles `open`: if currently open, user is collapsing it.
    if (el.open) userOpened.delete(key);
    else userOpened.add(key);
  };
  document.addEventListener('click', event => {
    const sum = event.target?.closest?.('#list details > summary');
    if (sum?.parentElement) syncDetailsIntent(sum.parentElement);
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const sum = event.target?.closest?.('#list details > summary');
    if (sum?.parentElement) syncDetailsIntent(sum.parentElement);
  }, true);
  document.addEventListener('toggle', event => {
    const el = event.target;
    if (!(el instanceof HTMLDetailsElement) || !el.closest('#list') || Date.now() - lastUser > 800) return;   // only the user's own click
    if (el.open) userOpened.add(detailKey(el)); else userOpened.delete(detailKey(el));
  }, true);
  function reopen() {
    if (!userOpened.size) return;
    for (const el of $$('#list details')) if (!el.open && userOpened.has(detailKey(el))) el.open = true;
  }

  function decorateTopBarPanel() {
    const homeBtn = $('#days .home-btn');
    if (homeBtn) {
      const tip = page.mode === 'notice' ? '点击回到明天' : '点击回到今天';
      if (homeBtn.title !== tip) homeBtn.title = tip;
    }
    const topBar = $('.workspace-top-bar');
    let wrap = topBar?.parentElement?.classList?.contains('ux-topbar-panel') ? topBar.parentElement : null;
    if (topBar && !wrap && typeof topBar.before === 'function') {
      const subBar = $('.workspace-sub-bar');
      wrap = make('div', 'ux-topbar-panel');
      topBar.before(wrap);
      wrap.append(topBar);
      if (subBar) wrap.append(subBar);
    }
    if (!wrap) return;
    // Align #study-add's SVG stroke-width attribute with .ux-quiz-add & .fb-manual-add (1.9)
    const studySvg = $('#study-add svg', wrap);
    if (studySvg && studySvg.getAttribute('stroke-width') !== '1.9') {
      studySvg.setAttribute('stroke-width', '1.9');
    }
    // Quiz view: mirror "+ 添加学生" right into the top white toolbar next to #subtabs (same slot as "+")
    const srcQuizAdd = page.mode === 'quiz' ? $('#list #vq-add-student') : null;
    let proxy = $('.ux-quiz-add', wrap);
    if (srcQuizAdd) {
      if (!proxy) {
        proxy = make('button', 'ux-quiz-add');
        proxy.type = 'button';
        proxy.title = '添加抽背学生';
        proxy.setAttribute('aria-label', '添加抽背学生');
        proxy.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14 M5 12h14"/></svg>';
        proxy.onclick = () => { $('#list #vq-add-student')?.click(); };
        wrap.append(proxy);
      }
      if (proxy.hidden) proxy.hidden = false;
    } else if (proxy && !proxy.hidden) {
      proxy.hidden = true;
    }
  }
  // ---- sync notice popup: present unauthenticated cloud notice as a dismissible modal popup ----
  function decorateSyncPopup() {
    const notice = $('.wayon-sync-notice');
    let backdrop = $('.ux-sync-backdrop');
    if (!notice) { backdrop?.remove(); return; }
    const dismiss = () => {
      if (notice.dataset) notice.dataset.uxDismissed = '1';
      if (backdrop) backdrop.hidden = true;
    };
    if (notice.dataset?.uxModal !== '1') {
      if (notice.dataset) notice.dataset.uxModal = '1';
      const head = make('div', 'ux-sync-head');
      const titleWrap = make('div', 'ux-sync-title-wrap');
      const dot = [...(notice.children || [])].find(c => c.classList?.contains('wayon-sync-dot'));
      if (dot) titleWrap.append(dot);
      titleWrap.append(make('span', 'ux-sync-title', '尚未连接云端同步'));
      const closeBtn = make('button', 'ux-sync-close', '×');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', '稍后再说');
      closeBtn.title = '稍后再说';
      closeBtn.onclick = dismiss;
      head.append(titleWrap, closeBtn);
      notice.prepend(head);
      const cta = [...(notice.querySelectorAll?.('button') || [])].find(b => b.classList?.contains('wayon-sync-cta'));
      cta?.addEventListener?.('click', dismiss, true);
    }
    const visible = !notice.hidden && notice.dataset?.uxDismissed !== '1' && !$('dialog[open]');
    if (visible) {
      if (!backdrop) {
        backdrop = make('div', 'ux-sync-backdrop');
        backdrop.onclick = dismiss;
        document.body.append(backdrop);
      }
      if (backdrop.hidden) backdrop.hidden = false;
    } else if (backdrop && !backdrop.hidden) {
      backdrop.hidden = true;
    }
  }

  // ---- keep everything applied as the page re-renders --------------------------------
  let queued = false;
  function apply() {
    queued = false;
    if (probing) return;
    // The cloud copy has just been applied: count every view once on it, then let the numbers show.
    if (!cloudCounted && cloudReady()) { readyAt ||= Date.now(); if (cloudComplete()) { probe(); cloudCounted = probed > 0 && Date.now() - probed < 50; } }
    if (page.mode && !document.body.dataset.airconOpen && !document.body.dataset.memoOpen && !document.body.dataset.feedbackOpen && !document.body.dataset.mocksOpen && !document.body.dataset.ledgerOpen) readCount(page.mode);
    try { decorateNav(); decorateTopBarPanel(); decorateSyncPopup(); decorateCards(); decorateNotice(); decorateChasing(); decorateFoldedRail(); decorateQuizRail(); decorateCardFooters(); reopen(); brandMark(); } catch (e) { console.warn('ux:', e); }
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
  function initThemeSync() {
    const docEl = document.documentElement;
    if (!docEl || typeof MutationObserver !== 'function') return;
    let timer = 0;
    let lastTheme = docEl.getAttribute?.('data-theme') || '';
    new MutationObserver(() => {
      const next = docEl.getAttribute?.('data-theme') || '';
      if (next === lastTheme) return;
      lastTheme = next;
      docEl.setAttribute?.('data-ux-theme-switching', '1');
      try { void docEl.offsetHeight; } catch {}
      clearTimeout(timer);
      timer = setTimeout(() => { docEl.removeAttribute?.('data-ux-theme-switching'); }, 60);
    }).observe(docEl, {attributes: true, attributeFilter: ['data-theme']});
  }
  const schedule = () => { if (!queued && !probing) { queued = true; requestAnimationFrame(apply); } };
  function start() {
    initScrollDock();
    initThemeSync();
    // A count read for a view you are not on goes stale when marks change underneath it — the cloud copy arriving
    // after the first count, or another device. When the list redraws on its own (not right after a tap or a key),
    // count every view again once it has settled.
    let recount = 0;
    ['pointerdown', 'keydown', 'input'].forEach(t => document.addEventListener(t, () => { lastUser = Date.now(); }, true));
    const inList = n => (n.nodeType === 1 ? n : n.parentElement)?.closest?.('#list');
    const inNav = n => (n.nodeType === 1 ? n : n.parentElement)?.closest?.('#tabs, #subtabs, .sidebar-footer');
    new MutationObserver(records => {
      if (records.some(r => r.target === document.body || inNav(r.target))) {
        try {
          if (page.mode && !document.body.dataset.airconOpen && !document.body.dataset.memoOpen && !document.body.dataset.feedbackOpen && !document.body.dataset.mocksOpen && !document.body.dataset.ledgerOpen) readCount(page.mode);
          decorateNav();
        } catch (e) { console.warn('ux nav:', e); }
      }
      schedule();
      if (probing || Date.now() - probed < 1000 || Date.now() - lastUser < 800 || !records.some(r => inList(r.target))) return;
      clearTimeout(recount);
      recount = setTimeout(() => { if (Date.now() - lastUser >= 800) { probe(); apply(); } }, 1200);
    }).observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-mode', 'data-feedback-open', 'data-memo-open', 'data-mocks-open', 'data-ledger-open', 'data-ledger-space', 'data-aircon-open']});
    apply();
    setTimeout(() => { probe(); apply(); }, 1200);
    setTimeout(apply, 6100);   // no cloud copy came: show this device's counts
    // Local marks may have changed elsewhere (another tab, a cloud sync): recount when the page is looked at again.
    const again = () => { if (document.visibilityState === 'visible' && Date.now() - probed > 60000) { probe(); apply(); } };
    document.addEventListener('visibilitychange', again); window.addEventListener('focus', again);
    let resizeRaf = 0;
    window.addEventListener('resize', () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; resizeVisibleTextareas($('#list')); });
    }, {passive: true});
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
