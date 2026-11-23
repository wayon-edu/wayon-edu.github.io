// Presentation only. Existing room/seat handlers and cloud identities stay intact.
(() => {
  if (typeof document === 'undefined' || document.getElementById('wayon-room-layout')) return;
  const style = document.createElement('style');
  style.id = 'wayon-room-layout';
  style.textContent = `
  /* Parent workbench integration: full-width flush classroom frame, no sidebar height override. */
  .wayon-workbench:has(#classroom-frame) #list{columns:1;max-width:none!important}
  .wayon-workbench:has(#classroom-frame) .main-content{max-width:none!important;padding-bottom:18px!important}
  body.wayon-workbench .app-layout #classroom-frame{display:block;width:100%!important;max-width:none!important;height:var(--room-frame-height,calc(100dvh - 116px))!important;min-height:0!important;border:0!important;border-radius:22px!important;background:transparent!important;box-shadow:none!important}
  @media(max-width:1023px){.wayon-workbench:has(#classroom-frame) #list>div:has(>a[target="_blank"]){min-height:44px!important}.wayon-workbench .sidebar #workflow-tools{position:absolute;left:14px;top:calc(100% + 8px);flex-direction:row!important;gap:4px!important;margin:0!important;z-index:4}}

  /* Apple Cupertino · Liquid Glass tokens scoped strictly to the rooms page (never pollutes parent :root). */
  html.wayon-room-root,body.wayon-room{
    --rm-sans:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","Hiragino Sans GB","Helvetica Neue",sans-serif;
    --rm-canvas-light:#F5F5F7;--rm-canvas-dark:#000000;
    --rm-surface-light:#FFFFFF;--rm-surface-dark:#1C1C1E;
    --rm-elevated-light:#FFFFFF;--rm-elevated-dark:#242426;
    --rm-fg-light:#1D1D1F;--rm-fg-dark:#F5F5F7;
    --rm-fg2-light:#6E6E73;--rm-fg2-dark:#98989D;
    --rm-fg3-light:#86868B;--rm-fg3-dark:#6E6E73;
    --rm-accent-light:#0071E3;--rm-accent-dark:#2997FF;
    --rm-accent-hover-light:#0077ED;--rm-accent-hover-dark:#4CA8FF;
    --rm-accent-sub-light:rgba(0,113,227,.08);--rm-accent-sub-dark:rgba(41,151,255,.15);
    --rm-hairline-light:rgba(29,29,31,.09);--rm-hairline-dark:rgba(255,255,255,.12);
    --rm-hairline-soft-light:rgba(29,29,31,.05);--rm-hairline-soft-dark:rgba(255,255,255,.065);
    --rm-card-rim-light:rgba(255,255,255,.96);--rm-card-rim-dark:rgba(255,255,255,.12);
    --rm-ring-light:rgba(0,0,0,.045);--rm-ring-dark:rgba(255,255,255,.09);
    --rm-shadow1-light:rgba(0,0,0,.05);--rm-shadow1-dark:rgba(0,0,0,.52);
    --rm-shadow2-light:rgba(0,0,0,.025);--rm-shadow2-dark:rgba(0,0,0,.36);
    --rm-shadow-hover-light:rgba(0,0,0,.11);--rm-shadow-hover-dark:rgba(0,0,0,.72);
    --rm-seg-track-light:rgba(118,118,128,.12);--rm-seg-track-dark:rgba(118,118,128,.28);
    --rm-seg-inset-light:rgba(0,0,0,.065);--rm-seg-inset-dark:rgba(0,0,0,.48);
    --rm-seg-lip-light:rgba(255,255,255,.78);--rm-seg-lip-dark:rgba(255,255,255,.08);
    --rm-thumb-top-light:#FFFFFF;--rm-thumb-top-dark:rgba(99,99,102,.92);
    --rm-thumb-bot-light:#FAFAFC;--rm-thumb-bot-dark:rgba(72,72,74,.84);
    --rm-thumb-rim-light:#FFFFFF;--rm-thumb-rim-dark:rgba(255,255,255,.22);
    --rm-thumb-shadow-light:rgba(0,0,0,.10);--rm-thumb-shadow-dark:rgba(0,0,0,.46);
    --rm-glass-top-light:rgba(255,255,255,.92);--rm-glass-top-dark:rgba(42,42,46,.90);
    --rm-glass-bot-light:rgba(248,249,252,.86);--rm-glass-bot-dark:rgba(28,28,30,.88);
    --rm-ok-bg-light:rgba(52,199,89,.13);--rm-ok-bg-dark:rgba(48,209,88,.18);
    --rm-ok-fg-light:#1B7F37;--rm-ok-fg-dark:#32D74B;
    --rm-ok-border-light:rgba(27,127,55,.24);--rm-ok-border-dark:rgba(50,215,75,.30);
    --rm-pre-bg-light:rgba(0,113,227,.065);--rm-pre-bg-dark:rgba(41,151,255,.12);
    --rm-pre-border-light:rgba(0,113,227,.52);--rm-pre-border-dark:rgba(41,151,255,.58);
    --rm-danger-bg-light:rgba(255,59,48,.12);--rm-danger-bg-dark:rgba(255,69,58,.22);
    --rm-danger-fg-light:#D70015;--rm-danger-fg-dark:#FF6961;
    --rm-now-light:#FF3B30;--rm-now-dark:#FF453A;
    --rm-edit-light:#B85D00;--rm-edit-dark:#FF9F0A;
    --rm-hall-band-light:rgba(118,118,128,.04);--rm-hall-band-dark:rgba(255,255,255,.03);
    --rm-off-stripe-light:rgba(118,118,128,.055);--rm-off-stripe-dark:rgba(255,255,255,.045);
    --rm-sb-thumb-light:rgba(29,29,31,.24);--rm-sb-thumb-dark:rgba(245,245,247,.28);
    /* Harmonious Apple Calendar semantic pastels (WCAG AA/AAA text contrast in both modes) */
    --rm-t1-bg-light:rgba(0,113,227,.105);--rm-t1-bg-dark:rgba(41,151,255,.18);
    --rm-t1-bar-light:#0071E3;--rm-t1-bar-dark:#2997FF;
    --rm-t1-fg-light:#004A9E;--rm-t1-fg-dark:#8AC8FF;
    --rm-t2-bg-light:rgba(88,86,214,.11);--rm-t2-bg-dark:rgba(94,92,230,.22);
    --rm-t2-bar-light:#5856D6;--rm-t2-bar-dark:#7D7AFF;
    --rm-t2-fg-light:#3C3AA6;--rm-t2-fg-dark:#BEBDFE;
    --rm-t3-bg-light:rgba(48,176,199,.125);--rm-t3-bg-dark:rgba(64,200,224,.19);
    --rm-t3-bar-light:#1EA4BC;--rm-t3-bar-dark:#40C8E0;
    --rm-t3-fg-light:#0B6475;--rm-t3-fg-dark:#8BE4F4;
    --rm-t4-bg-light:rgba(255,149,0,.12);--rm-t4-bg-dark:rgba(255,159,10,.19);
    --rm-t4-bar-light:#E08600;--rm-t4-bar-dark:#FF9F0A;
    --rm-t4-fg-light:#8C4F00;--rm-t4-fg-dark:#FFCA6B;
    --rm-t5-bg-light:rgba(118,118,128,.105);--rm-t5-bg-dark:rgba(142,142,147,.19);
    --rm-t5-bar-light:#8E8E93;--rm-t5-bar-dark:#98989D;
    --rm-t5-fg-light:#48484A;--rm-t5-fg-dark:#D1D1D6;

    /* Base light resolved tokens (fallback for browsers without light-dark()) */
    --rm-canvas:var(--rm-canvas-light);--rm-surface:var(--rm-surface-light);--rm-elevated:var(--rm-elevated-light);
    --rm-fg:var(--rm-fg-light);--rm-fg2:var(--rm-fg2-light);--rm-fg3:var(--rm-fg3-light);
    --rm-accent:var(--rm-accent-light);--rm-accent-hover:var(--rm-accent-hover-light);--rm-accent-sub:var(--rm-accent-sub-light);
    --rm-hairline:var(--rm-hairline-light);--rm-hairline-soft:var(--rm-hairline-soft-light);
    --rm-card-rim:var(--rm-card-rim-light);--rm-ring:var(--rm-ring-light);
    --rm-shadow1:var(--rm-shadow1-light);--rm-shadow2:var(--rm-shadow2-light);--rm-shadow-hover:var(--rm-shadow-hover-light);
    --rm-seg-track:var(--rm-seg-track-light);--rm-seg-inset:var(--rm-seg-inset-light);--rm-seg-lip:var(--rm-seg-lip-light);
    --rm-thumb-top:var(--rm-thumb-top-light);--rm-thumb-bot:var(--rm-thumb-bot-light);--rm-thumb-rim:var(--rm-thumb-rim-light);--rm-thumb-shadow:var(--rm-thumb-shadow-light);
    --rm-glass-top:var(--rm-glass-top-light);--rm-glass-bot:var(--rm-glass-bot-light);
    --rm-ok-bg:var(--rm-ok-bg-light);--rm-ok-fg:var(--rm-ok-fg-light);--rm-ok-border:var(--rm-ok-border-light);
    --rm-pre-bg:var(--rm-pre-bg-light);--rm-pre-border:var(--rm-pre-border-light);
    --rm-danger-bg:var(--rm-danger-bg-light);--rm-danger-fg:var(--rm-danger-fg-light);
    --rm-now:var(--rm-now-light);--rm-edit:var(--rm-edit-light);
    --rm-hall-band:var(--rm-hall-band-light);--rm-off-stripe:var(--rm-off-stripe-light);--rm-sb-thumb:var(--rm-sb-thumb-light);
    --t1:var(--rm-t1-bg-light);--t1b:var(--rm-t1-bar-light);--t1fg:var(--rm-t1-fg-light);
    --t2:var(--rm-t2-bg-light);--t2b:var(--rm-t2-bar-light);--t2fg:var(--rm-t2-fg-light);
    --t3:var(--rm-t3-bg-light);--t3b:var(--rm-t3-bar-light);--t3fg:var(--rm-t3-fg-light);
    --t4:var(--rm-t4-bg-light);--t4b:var(--rm-t4-bar-light);--t4fg:var(--rm-t4-fg-light);
    --t5:var(--rm-t5-bg-light);--t5b:var(--rm-t5-bar-light);--t5fg:var(--rm-t5-fg-light);

    /* Bridge legacy ROOM_PAGE_TEMPLATE variables to the Apple palette */
    --bg:var(--rm-canvas);--card:var(--rm-surface);--fg:var(--rm-fg);--fg-secondary:var(--rm-fg2);--muted:var(--rm-fg2);
    --line:var(--rm-hairline);--line-strong:var(--rm-hairline);--accent:var(--rm-accent);--accent-subtle:var(--rm-accent-sub);
    --code-bg:var(--rm-canvas);--bad:var(--rm-now);--bad-dark:var(--rm-danger-fg);--bad-bg:var(--rm-danger-bg);
    --done-dark:var(--rm-ok-fg);--done-bg:var(--rm-ok-bg);--edit:var(--rm-edit);--hall:var(--rm-ok-bg);--hallb:var(--rm-ok-border);
  }
  html.wayon-room-root{
    color-scheme:light dark;
    accent-color:var(--rm-accent);
    scrollbar-color:var(--rm-sb-thumb) transparent;
  }
  html.wayon-room-root[data-theme="dark"],
  html.wayon-room-root:has(> head > meta[name="color-scheme"][content="dark"]){color-scheme:dark}
  html.wayon-room-root[data-theme="light"],
  html.wayon-room-root:has(> head > meta[name="color-scheme"][content="light"]){color-scheme:light}

  @media (prefers-color-scheme: dark){
    html.wayon-room-root:not([data-theme="light"]):not(:has(> head > meta[name="color-scheme"][content="light"])),
    html.wayon-room-root:not([data-theme="light"]):not(:has(> head > meta[name="color-scheme"][content="light"])) body.wayon-room{
      --rm-canvas:var(--rm-canvas-dark);--rm-surface:var(--rm-surface-dark);--rm-elevated:var(--rm-elevated-dark);
      --rm-fg:var(--rm-fg-dark);--rm-fg2:var(--rm-fg2-dark);--rm-fg3:var(--rm-fg3-dark);
      --rm-accent:var(--rm-accent-dark);--rm-accent-hover:var(--rm-accent-hover-dark);--rm-accent-sub:var(--rm-accent-sub-dark);
      --rm-hairline:var(--rm-hairline-dark);--rm-hairline-soft:var(--rm-hairline-soft-dark);
      --rm-card-rim:var(--rm-card-rim-dark);--rm-ring:var(--rm-ring-dark);
      --rm-shadow1:var(--rm-shadow1-dark);--rm-shadow2:var(--rm-shadow2-dark);--rm-shadow-hover:var(--rm-shadow-hover-dark);
      --rm-seg-track:var(--rm-seg-track-dark);--rm-seg-inset:var(--rm-seg-inset-dark);--rm-seg-lip:var(--rm-seg-lip-dark);
      --rm-thumb-top:var(--rm-thumb-top-dark);--rm-thumb-bot:var(--rm-thumb-bot-dark);--rm-thumb-rim:var(--rm-thumb-rim-dark);--rm-thumb-shadow:var(--rm-thumb-shadow-dark);
      --rm-glass-top:var(--rm-glass-top-dark);--rm-glass-bot:var(--rm-glass-bot-dark);
      --rm-ok-bg:var(--rm-ok-bg-dark);--rm-ok-fg:var(--rm-ok-fg-dark);--rm-ok-border:var(--rm-ok-border-dark);
      --rm-pre-bg:var(--rm-pre-bg-dark);--rm-pre-border:var(--rm-pre-border-dark);
      --rm-danger-bg:var(--rm-danger-bg-dark);--rm-danger-fg:var(--rm-danger-fg-dark);
      --rm-now:var(--rm-now-dark);--rm-edit:var(--rm-edit-dark);
      --rm-hall-band:var(--rm-hall-band-dark);--rm-off-stripe:var(--rm-off-stripe-dark);--rm-sb-thumb:var(--rm-sb-thumb-dark);
      --t1:var(--rm-t1-bg-dark);--t1b:var(--rm-t1-bar-dark);--t1fg:var(--rm-t1-fg-dark);
      --t2:var(--rm-t2-bg-dark);--t2b:var(--rm-t2-bar-dark);--t2fg:var(--rm-t2-fg-dark);
      --t3:var(--rm-t3-bg-dark);--t3b:var(--rm-t3-bar-dark);--t3fg:var(--rm-t3-fg-dark);
      --t4:var(--rm-t4-bg-dark);--t4b:var(--rm-t4-bar-dark);--t4fg:var(--rm-t4-fg-dark);
      --t5:var(--rm-t5-bg-dark);--t5b:var(--rm-t5-bar-dark);--t5fg:var(--rm-t5-fg-dark);
    }
  }
  html.wayon-room-root[data-theme="dark"],
  html.wayon-room-root[data-theme="dark"] body.wayon-room,
  html.wayon-room-root:has(> head > meta[name="color-scheme"][content="dark"]),
  html.wayon-room-root:has(> head > meta[name="color-scheme"][content="dark"]) body.wayon-room{
    --rm-canvas:var(--rm-canvas-dark);--rm-surface:var(--rm-surface-dark);--rm-elevated:var(--rm-elevated-dark);
    --rm-fg:var(--rm-fg-dark);--rm-fg2:var(--rm-fg2-dark);--rm-fg3:var(--rm-fg3-dark);
    --rm-accent:var(--rm-accent-dark);--rm-accent-hover:var(--rm-accent-hover-dark);--rm-accent-sub:var(--rm-accent-sub-dark);
    --rm-hairline:var(--rm-hairline-dark);--rm-hairline-soft:var(--rm-hairline-soft-dark);
    --rm-card-rim:var(--rm-card-rim-dark);--rm-ring:var(--rm-ring-dark);
    --rm-shadow1:var(--rm-shadow1-dark);--rm-shadow2:var(--rm-shadow2-dark);--rm-shadow-hover:var(--rm-shadow-hover-dark);
    --rm-seg-track:var(--rm-seg-track-dark);--rm-seg-inset:var(--rm-seg-inset-dark);--rm-seg-lip:var(--rm-seg-lip-dark);
    --rm-thumb-top:var(--rm-thumb-top-dark);--rm-thumb-bot:var(--rm-thumb-bot-dark);--rm-thumb-rim:var(--rm-thumb-rim-dark);--rm-thumb-shadow:var(--rm-thumb-shadow-dark);
    --rm-glass-top:var(--rm-glass-top-dark);--rm-glass-bot:var(--rm-glass-bot-dark);
    --rm-ok-bg:var(--rm-ok-bg-dark);--rm-ok-fg:var(--rm-ok-fg-dark);--rm-ok-border:var(--rm-ok-border-dark);
    --rm-pre-bg:var(--rm-pre-bg-dark);--rm-pre-border:var(--rm-pre-border-dark);
    --rm-danger-bg:var(--rm-danger-bg-dark);--rm-danger-fg:var(--rm-danger-fg-dark);
    --rm-now:var(--rm-now-dark);--rm-edit:var(--rm-edit-dark);
    --rm-hall-band:var(--rm-hall-band-dark);--rm-off-stripe:var(--rm-off-stripe-dark);--rm-sb-thumb:var(--rm-sb-thumb-dark);
    --t1:var(--rm-t1-bg-dark);--t1b:var(--rm-t1-bar-dark);--t1fg:var(--rm-t1-fg-dark);
    --t2:var(--rm-t2-bg-dark);--t2b:var(--rm-t2-bar-dark);--t2fg:var(--rm-t2-fg-dark);
    --t3:var(--rm-t3-bg-dark);--t3b:var(--rm-t3-bar-dark);--t3fg:var(--rm-t3-fg-dark);
    --t4:var(--rm-t4-bg-dark);--t4b:var(--rm-t4-bar-dark);--t4fg:var(--rm-t4-fg-dark);
    --t5:var(--rm-t5-bg-dark);--t5b:var(--rm-t5-bar-dark);--t5fg:var(--rm-t5-fg-dark);
  }
  @supports (color: light-dark(white, black)){
    html.wayon-room-root,html.wayon-room-root body.wayon-room{
      --rm-canvas:light-dark(var(--rm-canvas-light),var(--rm-canvas-dark));
      --rm-surface:light-dark(var(--rm-surface-light),var(--rm-surface-dark));
      --rm-elevated:light-dark(var(--rm-elevated-light),var(--rm-elevated-dark));
      --rm-fg:light-dark(var(--rm-fg-light),var(--rm-fg-dark));
      --rm-fg2:light-dark(var(--rm-fg2-light),var(--rm-fg2-dark));
      --rm-fg3:light-dark(var(--rm-fg3-light),var(--rm-fg3-dark));
      --rm-accent:light-dark(var(--rm-accent-light),var(--rm-accent-dark));
      --rm-accent-hover:light-dark(var(--rm-accent-hover-light),var(--rm-accent-hover-dark));
      --rm-accent-sub:light-dark(var(--rm-accent-sub-light),var(--rm-accent-sub-dark));
      --rm-hairline:light-dark(var(--rm-hairline-light),var(--rm-hairline-dark));
      --rm-hairline-soft:light-dark(var(--rm-hairline-soft-light),var(--rm-hairline-soft-dark));
      --rm-card-rim:light-dark(var(--rm-card-rim-light),var(--rm-card-rim-dark));
      --rm-ring:light-dark(var(--rm-ring-light),var(--rm-ring-dark));
      --rm-shadow1:light-dark(var(--rm-shadow1-light),var(--rm-shadow1-dark));
      --rm-shadow2:light-dark(var(--rm-shadow2-light),var(--rm-shadow2-dark));
      --rm-shadow-hover:light-dark(var(--rm-shadow-hover-light),var(--rm-shadow-hover-dark));
      --rm-seg-track:light-dark(var(--rm-seg-track-light),var(--rm-seg-track-dark));
      --rm-seg-inset:light-dark(var(--rm-seg-inset-light),var(--rm-seg-inset-dark));
      --rm-seg-lip:light-dark(var(--rm-seg-lip-light),var(--rm-seg-lip-dark));
      --rm-thumb-top:light-dark(var(--rm-thumb-top-light),var(--rm-thumb-top-dark));
      --rm-thumb-bot:light-dark(var(--rm-thumb-bot-light),var(--rm-thumb-bot-dark));
      --rm-thumb-rim:light-dark(var(--rm-thumb-rim-light),var(--rm-thumb-rim-dark));
      --rm-thumb-shadow:light-dark(var(--rm-thumb-shadow-light),var(--rm-thumb-shadow-dark));
      --rm-glass-top:light-dark(var(--rm-glass-top-light),var(--rm-glass-top-dark));
      --rm-glass-bot:light-dark(var(--rm-glass-bot-light),var(--rm-glass-bot-dark));
      --rm-ok-bg:light-dark(var(--rm-ok-bg-light),var(--rm-ok-bg-dark));
      --rm-ok-fg:light-dark(var(--rm-ok-fg-light),var(--rm-ok-fg-dark));
      --rm-ok-border:light-dark(var(--rm-ok-border-light),var(--rm-ok-border-dark));
      --rm-pre-bg:light-dark(var(--rm-pre-bg-light),var(--rm-pre-bg-dark));
      --rm-pre-border:light-dark(var(--rm-pre-border-light),var(--rm-pre-border-dark));
      --rm-danger-bg:light-dark(var(--rm-danger-bg-light),var(--rm-danger-bg-dark));
      --rm-danger-fg:light-dark(var(--rm-danger-fg-light),var(--rm-danger-fg-dark));
      --rm-now:light-dark(var(--rm-now-light),var(--rm-now-dark));
      --rm-edit:light-dark(var(--rm-edit-light),var(--rm-edit-dark));
      --rm-hall-band:light-dark(var(--rm-hall-band-light),var(--rm-hall-band-dark));
      --rm-off-stripe:light-dark(var(--rm-off-stripe-light),var(--rm-off-stripe-dark));
      --rm-sb-thumb:light-dark(var(--rm-sb-thumb-light),var(--rm-sb-thumb-dark));
      --t1:light-dark(var(--rm-t1-bg-light),var(--rm-t1-bg-dark));
      --t1b:light-dark(var(--rm-t1-bar-light),var(--rm-t1-bar-dark));
      --t1fg:light-dark(var(--rm-t1-fg-light),var(--rm-t1-fg-dark));
      --t2:light-dark(var(--rm-t2-bg-light),var(--rm-t2-bg-dark));
      --t2b:light-dark(var(--rm-t2-bar-light),var(--rm-t2-bar-dark));
      --t2fg:light-dark(var(--rm-t2-fg-light),var(--rm-t2-fg-dark));
      --t3:light-dark(var(--rm-t3-bg-light),var(--rm-t3-bg-dark));
      --t3b:light-dark(var(--rm-t3-bar-light),var(--rm-t3-bar-dark));
      --t3fg:light-dark(var(--rm-t3-fg-light),var(--rm-t3-fg-dark));
      --t4:light-dark(var(--rm-t4-bg-light),var(--rm-t4-bg-dark));
      --t4b:light-dark(var(--rm-t4-bar-light),var(--rm-t4-bar-dark));
      --t4fg:light-dark(var(--rm-t4-fg-light),var(--rm-t4-fg-dark));
      --t5:light-dark(var(--rm-t5-bg-light),var(--rm-t5-bg-dark));
      --t5b:light-dark(var(--rm-t5-bar-light),var(--rm-t5-bar-dark));
      --t5fg:light-dark(var(--rm-t5-fg-light),var(--rm-t5-fg-dark));
    }
  }

  /* Base canvas & standalone vs embedded framing */
  body.wayon-room{background:var(--rm-canvas)!important;color:var(--rm-fg)!important;font-family:var(--rm-sans)!important;padding:12px 18px 14px!important;gap:8px!important;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
  html.wayon-room-root.is-embedded,body.wayon-room.is-embedded{background:transparent!important}
  body.wayon-room.is-embedded{padding:2px 2px 6px!important;gap:8px!important}
  .wayon-room .room-scroll-hint{display:none;font-size:12px;color:var(--rm-fg2);flex:none;margin:-2px 0 2px}
  .wayon-room.room-overflow .room-scroll-hint{display:block}
  .wayon-room .foot{font-size:11.5px;line-height:1.45;color:var(--rm-fg2);padding:2px 4px 0;flex:none}
  .wayon-room .foot:empty{display:none}
  .wayon-room .sheet{max-height:calc(100dvh - 16px);overflow-y:auto}
  `;
  document.head.append(style);

  const timelineStyle = document.createElement('style');
  timelineStyle.id = 'wayon-room-timeline';
  timelineStyle.textContent = `
  /* Ultra-slim single-row Apple Calendar micro-header (zero redundant heading or conflict-free badge). */
  .wayon-room .top{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;min-height:36px;padding:0 2px!important;border-bottom:0!important;flex:none}
  /* Keep semantic title for screen readers while freeing 100% of its vertical visual height */
  .wayon-room .top>b{position:absolute!important;clip-path:inset(50%)!important;overflow:hidden!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;border:0!important;white-space:nowrap!important}
  /* Status pill: silent when conflict-free; crisp Apple Red pill ONLY on real conflict / overflow / missing data */
  .wayon-room .top #cf,
  .wayon-room .top #booking-warning{order:1;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 11px;border-radius:999px;font-size:12px!important;font-weight:600;line-height:1;letter-spacing:-.01em;white-space:nowrap}
  .wayon-room .top #cf.no,
  .wayon-room .top #cf.miss,
  .wayon-room .top #booking-warning{background:var(--rm-danger-bg);color:var(--rm-danger-fg)}
  .wayon-room .top #cf.ok,
  .wayon-room .top #cf:empty,
  .wayon-room .top #cf[hidden]{display:none!important}
  /* Compact inline legend inside the same single top bar */
  .wayon-room .top .legend{order:2;display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px 13px!important;font-size:12px!important;line-height:1.35;color:var(--rm-fg2);padding:0;margin:0;min-height:0;flex:1 1 auto;min-width:0}
  .wayon-room .legend span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
  .wayon-room .legend i{width:8px!important;height:8px!important;border-radius:999px!important;flex:none}
  .wayon-room .legend .lg-hall-note{margin-left:0;color:var(--rm-fg2);opacity:.92}
  .wayon-room .legend .lg-hall-swatch{width:10px!important;height:10px!important;border-radius:3px!important;border:1.5px dashed var(--rm-accent);background:transparent!important;box-sizing:border-box}
  .wayon-room .top .tl-fullscreen{order:3;margin-left:auto;display:grid;place-items:center;width:32px;height:32px;padding:0;border-radius:999px;background:var(--rm-seg-track);border:0;color:var(--rm-fg2);text-decoration:none;flex:none;transition:background-color .18s ease,color .18s ease}
  .wayon-room .top .tl-fullscreen svg{width:15px;height:15px;pointer-events:none}
  .wayon-room .top .tl-fullscreen:hover{background:var(--rm-accent-sub);color:var(--rm-accent)}
  .wayon-room .top .tl-summary{order:3;margin-left:auto;font-size:12px;font-weight:450;color:var(--rm-fg2);font-variant-numeric:tabular-nums;letter-spacing:-.005em;white-space:nowrap}
  .wayon-room .top .tl-fullscreen+.tl-summary{margin-left:0}
  .wayon-room .top .tl-summary:empty{display:none}

  /* Apple Cupertino physical-spring sliding segmented date control */
  .wayon-room .top .days{order:4;position:relative;margin-left:auto!important;display:inline-flex;align-items:center;gap:0!important;padding:3px;border-radius:999px;background:var(--rm-seg-track);border:0!important;box-shadow:inset 0 .5px 1.5px var(--rm-seg-inset),inset 0 -.5px 0 var(--rm-seg-lip);user-select:none;flex:none}
  .wayon-room .top .tl-summary+.days{margin-left:0!important}
  .wayon-room .top .days .tl-seg-thumb{position:absolute;top:3px;left:0;height:calc(100% - 6px);width:var(--seg-w,0px);border-radius:999px;background:linear-gradient(180deg,var(--rm-thumb-top) 0%,var(--rm-thumb-bot) 100%);box-shadow:inset 0 1px .5px var(--rm-thumb-rim),0 2px 8px -1px var(--rm-thumb-shadow),0 .5px 1.5px var(--rm-shadow2);transform:translate3d(var(--seg-x,3px),0,0);pointer-events:none;z-index:0;opacity:0;will-change:transform,width}
  .wayon-room .top .days.is-thumb-ready .tl-seg-thumb{opacity:1}
  @media (prefers-reduced-motion: no-preference){
    .wayon-room .top .days.is-animated .tl-seg-thumb{
      transition:transform .34s cubic-bezier(.32,.72,0,1),width .3s cubic-bezier(.22,1,.36,1);
      transition:transform .44s linear(0,.014 .8%,.056 1.7%,.214 3.6%,.659 8.1%,.848 10.6%,.974 13.1%,1.044 15.6%,1.074 18.2%,1.078 20.9%,1.066 24%,1.024 31.8%,1.003 38.4%,.995 45.2%,.996 53.5%,1.001 66.5%,1),width .32s cubic-bezier(.22,1,.36,1);
    }
  }
  .wayon-room .top .days button{position:relative;z-index:1;height:28px!important;min-height:28px!important;padding:0 13px!important;border:0!important;border-radius:999px!important;background:transparent!important;color:var(--rm-fg2)!important;box-shadow:none!important;font-size:12.5px!important;font-weight:500!important;letter-spacing:-.01em;font-variant-numeric:tabular-nums;transition:color .18s ease}
  .wayon-room .top .days button:hover{color:var(--rm-fg)!important;background:transparent!important}
  .wayon-room .top .days button.on{color:var(--rm-fg)!important;font-weight:600!important;background:transparent!important;box-shadow:none!important}
  .wayon-room .top .days:not(.is-thumb-ready) button.on{background:var(--rm-surface)!important;box-shadow:0 1px 4px var(--rm-thumb-shadow)!important}
  .wayon-room .top .days button:focus-visible{outline:2px solid var(--rm-accent);outline-offset:2px}

  /* Compact Liquid Glass info disclosure button */
  .wayon-room .top .room-info{position:relative;order:5;margin-left:0;flex:none;font-size:12px}
  .wayon-room .top .room-info>summary{display:grid;place-items:center;list-style:none;width:32px;height:32px;border:0;border-radius:999px;background:var(--rm-seg-track);color:var(--rm-fg2);cursor:pointer;font-size:14px;transition:background-color .18s ease,color .18s ease}
  .wayon-room .top .room-info>summary::-webkit-details-marker{display:none}
  .wayon-room .top .room-info>summary:hover,.wayon-room .top .room-info[open]>summary{color:var(--rm-accent);background:var(--rm-accent-sub)}
  .wayon-room .top .room-info>summary:focus-visible{outline:2px solid var(--rm-accent);outline-offset:2px}
  .room-info-panel{display:none;position:absolute;right:0;top:calc(100% + 8px);z-index:30;width:min(340px,calc(100vw - 32px));padding:14px 16px;border:0;border-radius:16px;background:linear-gradient(168deg,var(--rm-glass-top) 0%,var(--rm-glass-bot) 100%);backdrop-filter:blur(28px) saturate(200%);-webkit-backdrop-filter:blur(28px) saturate(200%);box-shadow:inset 0 1px .5px var(--rm-card-rim),0 18px 42px -12px var(--rm-shadow-hover),0 0 0 .5px var(--rm-hairline);font-size:12px;line-height:1.68;color:var(--rm-fg2);overflow-wrap:anywhere}
  .room-info[open]>.room-info-panel,.room-info:hover>.room-info-panel,.room-info:focus-within>.room-info-panel{display:block}
  .room-info-panel p{margin:0 0 8px}.room-info-panel [role=status]{padding:8px 0 0!important;background:transparent!important;border:0!important;border-top:.5px solid var(--rm-hairline)!important;color:var(--rm-fg2)!important;font-size:11px!important}
  .room-info-panel #sync{white-space:normal;display:block;margin-top:6px;color:var(--rm-fg3)}

  /* Apple Calendar rounded elevated board */
  .wayon-room .room-scroll{flex:1;min-height:0;min-width:0;width:100%;overflow:auto;overscroll-behavior:contain;border-radius:20px!important;background:var(--rm-surface);box-shadow:inset 0 1px 0 var(--rm-card-rim),0 6px 28px -6px var(--rm-shadow1),0 1px 2px var(--rm-shadow2),0 0 0 .5px var(--rm-ring);scrollbar-width:thin;scrollbar-color:var(--rm-sb-thumb) transparent}
  @supports not (scrollbar-color: auto){
    .wayon-room .room-scroll{scrollbar-width:auto}
    .wayon-room .room-scroll::-webkit-scrollbar{width:8px;height:8px}
    .wayon-room .room-scroll::-webkit-scrollbar-thumb{background:var(--rm-sb-thumb);border-radius:999px}
    .wayon-room .room-scroll::-webkit-scrollbar-track{background:transparent}
  }
  .wayon-room .room-scroll>.grid.tl{min-width:860px!important;height:auto!important;min-height:0!important;row-gap:0!important;column-gap:0!important;align-items:stretch;background:var(--rm-surface)}

  /* Sticky column headers */
  .wayon-room .grid.tl>.h{position:sticky;top:0;z-index:6;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:6px;padding:0 12px!important;background:var(--rm-surface);border-bottom:.5px solid var(--rm-hairline);border-left:.5px solid var(--rm-hairline-soft);font-size:12.5px!important;font-weight:600;letter-spacing:-.01em;color:var(--rm-fg);white-space:nowrap;overflow:visible}
  .wayon-room .grid.tl>.h small{display:inline;font-size:11px!important;font-weight:500;color:var(--rm-fg3);font-variant-numeric:tabular-nums}
  .wayon-room .grid.tl>.h.man::after{content:"✎";color:var(--rm-edit);font-size:11px;margin-left:auto}
  .wayon-room .grid.tl>.h.tl-corner{left:0;z-index:7;justify-content:center!important;border-left:0;border-right:.5px solid var(--rm-hairline-soft);color:var(--rm-fg3);font-size:11.5px!important;font-weight:500;padding:0!important}

  /* Time axis gutter & crisp hairlines */
  .wayon-room .tl-time{position:sticky;left:0;z-index:3;background:var(--rm-surface);border-right:.5px solid var(--rm-hairline-soft);font-size:11px;font-weight:500;line-height:1;color:var(--rm-fg3);text-align:right;padding-right:10px;font-variant-numeric:tabular-nums;transform:translateY(-5px);white-space:nowrap}
  .wayon-room .tl-time.first{transform:translateY(3px)}
  .wayon-room .tl-time.hour{color:var(--rm-fg2);font-weight:550;font-size:11.5px}
  .wayon-room .tl-slot{border-top:.5px solid var(--rm-hairline-soft);border-left:.5px solid var(--rm-hairline-soft);cursor:copy;min-width:0;transition:background-color .14s ease}
  .wayon-room .tl-slot.half{border-top-style:dashed}
  .wayon-room .tl-slot.off{background:repeating-linear-gradient(135deg,transparent 0 7px,var(--rm-off-stripe) 7px 8px)}
  .wayon-room .tl-slot:hover{background:var(--rm-accent-sub)}

  /* Apple Calendar pastel lesson cards with rounded left accent bar */
  .wayon-room .k.tl-lesson{position:relative;z-index:2;justify-self:start;display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:min-content;align-items:start;align-content:start;column-gap:6px;row-gap:2px;margin:2px 5px;padding:7px 10px 7px 13px;border:0!important;border-radius:11px;overflow:hidden;box-shadow:none;box-sizing:border-box;transition:filter .18s ease,box-shadow .2s ease}
  .wayon-room .k.tl-lesson::before{content:"";position:absolute;left:4px;top:6px;bottom:6px;width:3px;border-radius:99px;background:var(--ev-bar,var(--rm-accent))}
  @media (prefers-reduced-motion: no-preference){
    .wayon-room .k.tl-lesson{transition:transform .22s cubic-bezier(.28,.11,.32,1),box-shadow .22s cubic-bezier(.28,.11,.32,1)}
    .wayon-room .k.tl-lesson:hover{transform:scale(1.012);box-shadow:0 6px 16px -4px var(--rm-shadow-hover);z-index:4}
  }
  .wayon-room .k.tl-lesson .w{grid-column:1;grid-row:1;font-size:13px;line-height:1.32;font-weight:600;letter-spacing:-.015em;white-space:normal;overflow-wrap:anywhere;word-break:break-word}
  .wayon-room .k.tl-lesson .tt{grid-column:1;grid-row:2;order:0;font-size:11px;line-height:1.3;font-weight:500;opacity:.78;white-space:nowrap;font-variant-numeric:tabular-nums}
  .wayon-room .k.tl-lesson .s{grid-column:1;grid-row:3;font-size:11.5px;line-height:1.35;opacity:.86;white-space:normal;overflow-wrap:anywhere}
  .wayon-room .k.tl-lesson .room-subject,.wayon-room .k.tl-lesson .room-teacher{display:inline;font-size:inherit;opacity:1}
  .wayon-room .k.tl-lesson .room-teacher::before{content:" · "}
  .wayon-room .k.tl-lesson.short{grid-template-columns:minmax(0,1fr) auto;padding:3px 9px 3px 12px;align-content:center;align-items:center}
  .wayon-room .k.tl-lesson.short .s{display:none}
  .wayon-room .k.tl-lesson.short .w{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wayon-room .k.tl-lesson.short .tt{grid-column:2;grid-row:1}
  .wayon-room .k.tl-lesson.man{box-shadow:inset 0 0 0 1.25px color-mix(in oklab,var(--rm-edit) 65%,transparent)}
  .wayon-room .k.tl-lesson.man::after{content:"✎";position:absolute;bottom:3px;right:7px;font-size:10px;color:var(--rm-edit);opacity:.9}
  .wayon-room .k.tl-lesson.bad{outline:2px solid var(--rm-now);outline-offset:-2px;box-shadow:0 0 0 2px var(--rm-danger-bg)}
  .wayon-room .k.tl-lesson:focus-visible{outline:2px solid var(--rm-accent);outline-offset:1px}
  .wayon-room .tl-preview{z-index:5;margin:2px 5px;border:1.5px dashed var(--rm-accent);border-radius:11px;background:var(--rm-accent-sub);color:var(--rm-accent);font-size:12px;font-weight:600;padding:5px 10px;pointer-events:none;font-variant-numeric:tabular-nums}

  /* Crisp Apple Red current time line + left time pill badge */
  .wayon-room .tl-now{z-index:5;height:1.5px;background:var(--rm-now);align-self:start;pointer-events:none;position:relative}
  .wayon-room .tl-now::before{content:"";position:absolute;left:-4px;top:-3.25px;width:8px;height:8px;border-radius:999px;background:var(--rm-now);box-shadow:0 0 0 3px var(--rm-danger-bg)}
  .wayon-room .tl-now-badge{position:absolute;left:-54px;top:-9px;padding:2px 6px;border-radius:999px;background:var(--rm-now);color:#FFFFFF;font-size:10px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums;white-space:nowrap;box-shadow:0 2px 6px var(--rm-danger-bg)}

  /* Hall whole-day board: soft neutral wash + Apple Green confirmed / dashed Apple Blue pre-booked bars */
  .wayon-room .tl-hallband{border-top:.5px solid var(--rm-hairline-soft);border-left:.5px solid var(--rm-hairline-soft);background:var(--rm-hall-band);cursor:copy;position:relative;transition:background-color .16s ease}
  .wayon-room .tl-hallband:hover{background:var(--rm-accent-sub)}
  .wayon-room .tl-hallband.over{background:var(--rm-danger-bg);box-shadow:inset 0 0 0 1.5px var(--rm-now)}
  .wayon-room .tl-hallband.man::after{content:"✎";position:absolute;right:7px;bottom:4px;font-size:10px;color:var(--rm-edit)}
  .wayon-room .tl-hallcount{position:absolute;right:8px;top:4px;font-size:10.5px;font-weight:500;color:var(--rm-fg3);font-variant-numeric:tabular-nums;pointer-events:none}
  .wayon-room .tl-hallband.over .tl-hallcount{color:var(--rm-danger-fg);font-weight:700}
  .wayon-room .tl-hallbar{z-index:2;justify-self:start;display:flex;flex-direction:column;gap:2px;margin:20px 0 4px;padding:6px 8px;border-radius:10px;background:var(--rm-ok-bg);border:1px solid var(--rm-ok-border);color:var(--rm-ok-fg);font-size:12px;font-weight:600;line-height:1.25;letter-spacing:-.01em;overflow:hidden;cursor:pointer;min-width:0;box-sizing:border-box;transition:background-color .18s ease,border-color .18s ease,color .18s ease,filter .18s ease}
  .wayon-room .tl-hallbar:hover{filter:brightness(.97)}
  .wayon-room .tl-hallbar.pre{background:var(--rm-pre-bg);border:1.5px dashed var(--rm-pre-border);color:var(--rm-accent)}
  .wayon-room .tl-hallbar.vertical{align-items:center;padding:6px 0}
  .wayon-room .tl-hallbar.vertical .tl-hallname{writing-mode:vertical-rl;text-orientation:mixed;letter-spacing:.06em;white-space:nowrap}
  .wayon-room .tl-hallname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .wayon-room .tl-hallmeta{font-size:10.5px;font-weight:500;opacity:.82}
  .wayon-room .tl-hallbar:focus-visible{outline:2px solid var(--rm-accent);outline-offset:1px}
  @media (prefers-reduced-motion: no-preference){
    .wayon-room .tl-hallbar:active{transform:scale(.98)}
  }

  /* Liquid Glass floating edit sheets (#tlsh, #tlhall, #sh) */
  .wayon-room .sheet{inset:auto 16px 16px 16px;margin:0 auto;max-width:680px;border:0;border-radius:22px;padding:18px 20px max(18px,env(safe-area-inset-bottom));background:linear-gradient(168deg,var(--rm-glass-top) 0%,var(--rm-glass-bot) 100%);backdrop-filter:blur(32px) saturate(200%);-webkit-backdrop-filter:blur(32px) saturate(200%);color:var(--rm-fg);box-shadow:inset 0 1px .5px var(--rm-card-rim),0 24px 60px -12px rgba(0,0,0,.32),0 0 0 .5px var(--rm-hairline);z-index:25}
  .wayon-room .sheet .t{font-size:16px;font-weight:650;letter-spacing:-.02em;color:var(--rm-fg)}
  .wayon-room .sheet .hint{font-size:12px;color:var(--rm-fg2);line-height:1.5}
  .wayon-room .sheet .row{gap:8px;margin-top:4px}
  .wayon-room .sheet button{min-height:36px;padding:0 16px;border:0;border-radius:999px;background:var(--rm-seg-track);color:var(--rm-fg);font-size:13px;font-weight:550;transition:background-color .16s ease,color .16s ease}
  .wayon-room .sheet button:hover{filter:brightness(.95)}
  .wayon-room .sheet .pri{background:var(--rm-accent);color:#FFFFFF;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 4px 12px -3px color-mix(in oklab,var(--rm-accent) 42%,transparent)}
  .wayon-room .sheet .pri:hover{background:var(--rm-accent-hover);filter:none}
  .wayon-room #tlhall .tl-fields{display:grid;grid-template-columns:1fr;gap:10px}
  .wayon-room #tlhall label,.wayon-room #tlsh label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:500;color:var(--rm-fg2)}
  .wayon-room #tlhall input:not([type=checkbox]),.wayon-room #tlsh input,.wayon-room #tlsh select{font:inherit;font-size:15px;min-height:40px;padding:6px 12px;border:0;border-radius:11px;background:var(--rm-surface);color:var(--rm-fg);box-shadow:0 0 0 .5px var(--rm-hairline),inset 0 1px 0 var(--rm-card-rim);min-width:0}
  .wayon-room #tlhall input:not([type=checkbox]):focus,.wayon-room #tlsh input:focus,.wayon-room #tlsh select:focus{outline:2px solid var(--rm-accent);outline-offset:0}
  .wayon-room #tlhall .tl-hallsegs{display:flex;flex-wrap:wrap;gap:8px}
  .wayon-room #tlhall .tl-hallseg{flex-direction:row;align-items:center;gap:6px;min-height:38px;padding:0 13px;border:1px solid var(--rm-hairline);border-radius:999px;background:var(--rm-surface);font-size:13px;color:var(--rm-fg);cursor:pointer}
  .wayon-room #tlhall .tl-hallseg:has(input:checked){border-color:var(--rm-accent);background:var(--rm-accent-sub);color:var(--rm-accent);font-weight:600}
  .wayon-room #tlhall .tl-hallseg input{width:16px;height:16px;margin:0;accent-color:var(--rm-accent)}
  .wayon-room #tlhall .tl-err,.wayon-room #tlsh .tl-err{color:var(--rm-danger-fg);font-size:12.5px;font-weight:500;min-height:1em}
  .wayon-room #tlsh .tl-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}

  /* Forced Colors Mode accessibility fallbacks */
  @media (forced-colors: active){
    .wayon-room .room-scroll,.wayon-room .k.tl-lesson,.wayon-room .tl-hallbar,.wayon-room .sheet{border:1px solid CanvasText!important;box-shadow:none!important}
    .wayon-room .top .days button.on{outline:2px solid Highlight!important}
    .wayon-room .k.tl-lesson.bad{outline:2px solid LinkText!important}
    .wayon-room .tl-now{background:Highlight!important}
  }

  /* Responsive refinement */
  @media(max-width:1120px){.wayon-room .top .tl-summary{display:none}}
  @media(max-width:700px){
    body.wayon-room{padding:8px 10px 10px!important}
    .wayon-room .top{gap:6px 8px}
    .wayon-room .top .days{order:4;flex-basis:100%;margin-left:0!important}
    .wayon-room .top .days button{flex:1;height:36px!important;min-height:36px!important}
    .wayon-room .top .room-info{margin-left:auto}
    .wayon-room .top .room-info>summary{width:38px;height:38px}
    .wayon-room .room-scroll{border-radius:16px!important}
    .wayon-room .tl-time{font-size:10px;padding-right:6px}
    .wayon-room .k.tl-lesson{padding:5px 7px 5px 11px;margin:1px 3px}
    .wayon-room .k.tl-lesson .w{font-size:12.5px}
    .wayon-room .k.tl-lesson .s,.wayon-room .k.tl-lesson .tt{font-size:10.5px}
    .wayon-room .sheet{inset:auto 0 0 0;border-radius:20px 20px 0 0;max-width:none}
    .wayon-room .sheet button{min-height:44px}
    .wayon-room #tlhall input:not([type=checkbox]),.wayon-room #tlsh input,.wayon-room #tlsh select{font-size:16px}
  }
  `;
  document.head.append(timelineStyle);

  // Explicit theme detection & cross-iframe sync (Safari resolves prefers-color-scheme to OS inside iframes).
  const readDocumentTheme = doc => {
    const t = doc?.documentElement?.dataset?.theme;
    if (t === 'dark' || t === 'light') return t;
    const meta = doc?.querySelector?.('meta[name="color-scheme"]')?.getAttribute?.('content');
    if (meta === 'dark' || meta === 'light') return meta;
    return '';
  };

  // Calendar view: rooms on a real time axis instead of four fixed two-hour cells.
  // Storage is unchanged: a lesson still lives in every A–D cell it overlaps, with its exact time in x[3].
  function installTimeline(grid, top) {
    if (typeof render !== 'function' || typeof items !== 'function' || typeof setCell !== 'function') return;
    const STEP = 5, SNAP = 10, MIN_ROW = 6, MAX_ROW = 12;   // grid rows are 5 minutes; dragging snaps to 10
    const toM = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim()); return m ? +m[1] * 60 + +m[2] : NaN; };
    const toT = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const plain = value => String(value || '').replace(/[【】「」]/g, '').trim();
    const HALL_COURSE_SUFFIX = /(?:[-－—\s])*(?:(?:(?:雅思|托福|SAT|GRE|IELTS|TOEFL|英语|能力提升|校内|同步|阅读|听力|口语|写作|语法|数学)\s*)?(?:1\s*v\s*1|一对一|1对1)(?:课程|班)?|高中同步课程|初中同步课程|小学同步课程|英语能力提升课程|(?:雅思|托福|SAT)(?:基础|强化|冲刺)?(?:课程|班)|[-－—]\s*(?:雅思|托福|SAT|GRE|IELTS|TOEFL))$/i;
    const hallName = value => {
      const raw = String(value || '').trim().replace(/(?:\s*[（(]自习[)）])+$/g, '').trim();
      if (!raw) return '';
      const headed = /^(?:【([^】]+)】|「([^」]+)」|\[([^\]]+)\])\s*(.*)$/.exec(raw);
      if (headed && (!headed[4] || HALL_COURSE_SUFFIX.test(headed[4]))) return plain(headed[1] || headed[2] || headed[3]);
      const p = plain(raw);
      if (/[&＆/／、]|\s+and\s+|班|小组|多人|三人/i.test(p) && !/(?:1\s*v\s*1|一对一|1对1)(?:课程|班)?$/i.test(p)) return p;
      return p.replace(HALL_COURSE_SUFFIX, '').trim() || p;
    };
    // The page data matches D up to 21:30 while showing 15:40–17:40 (same rule as the generator).
    const segStop = si => S[si][0] === 'D' ? '21:30' : S[si][2];
    const spanOf = (x, si) => { const m = /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/.exec(String(x[3] || '').trim()); return m ? [m[1], m[2]] : [S[si][1], S[si][2]]; };
    const idOf = (x, si) => { const [a, b] = spanOf(x, si); return JSON.stringify([x[0] || '', x[1] || '', x[2] || '', a, b]); };
    const rooms = R.map((_, i) => i).filter(i => i !== HALL);
    const lessonsOf = (ri, source) => {
      const out = [];
      S.forEach((_, si) => (source(ri, si) || []).forEach(x => {
        if (!x) return;
        const id = idOf(x, si);
        let lesson = out.find(l => l.id === id);
        if (!lesson) { const [a, b] = spanOf(x, si); lesson = {id, x, a, b, ri, segs: []}; out.push(lesson); }
        if (!lesson.segs.includes(si)) lesson.segs.push(si);
      }));
      return out.sort((p, q) => p.a.localeCompare(q.a) || p.b.localeCompare(q.b));
    };
    function removeLesson(lesson) {
      lesson.segs.forEach(si => setCell(lesson.ri, si, items(lesson.ri, si).filter(x => !(x && idOf(x, si) === lesson.id))));
    }
    function addLesson(ri, who, subject, teacher, a, b) {
      let targets = S.map((_, si) => si).filter(si => a < segStop(si) && b > S[si][1]);
      if (!targets.length) {   // e.g. a lunch-time lesson: keep it in the nearest cell, shown at its real time
        const mid = (toM(a) + toM(b)) / 2, dist = si => Math.min(Math.abs(mid - toM(S[si][1])), Math.abs(mid - toM(S[si][2])));
        targets = [S.map((_, si) => si).sort((p, q) => dist(p) - dist(q))[0]];
      }
      targets.forEach(si => {
        const time = a === S[si][1] && b === S[si][2] ? '' : a + '-' + b;
        setCell(ri, si, items(ri, si).concat([[who, subject, teacher, time]]));
      });
    }
    let view = null, tdrag = null, pendingRender = false, renderedDay = null, sheetLesson = null;
    const scroller = grid.closest('.room-scroll');
    function rowHeight(rows) {
      const head = 38, room = scroller ? scroller.clientHeight - head - 8 : 0;
      return Math.max(MIN_ROW, Math.min(MAX_ROW, Math.floor(room / rows) || MIN_ROW));
    }
    const lineOf = m => Math.round((m - view.lo) / STEP) + 2;
    const place = (node, row1, row2, col) => { node.style.gridRow = row1 + ' / ' + row2; node.style.gridColumn = String(col); return node; };

    // Quiet right-aligned summary (only shown in the single-row micro-bar; stays silent about conflict-free status).
    const inFrame = (() => { try { return typeof window !== 'undefined' && window.self !== window.top; } catch { return true; } })();
    if (top && inFrame && !top.querySelector('.tl-fullscreen')) {
      const full = el('a', 'tl-fullscreen');
      full.href = (typeof window !== 'undefined' && window.location?.href) || './rooms.html';
      full.target = '_blank';
      full.rel = 'noopener noreferrer';
      full.title = '全屏新窗口打开';
      full.setAttribute('aria-label', '全屏新窗口打开');
      full.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
      top.append(full);
    }
    const summaryEl = el('span', 'tl-summary', '');
    if (top) top.append(summaryEl);

    // Persistent Apple spring segmented date control state
    let lastDayKeys = '', daysThumb = null, daysButtons = [], daysBound = false;
    function syncDaysThumb(dl, animate) {
      if (!dl || !daysThumb) return;
      const active = daysButtons.find(b => b.classList.contains('on'));
      if (!active || typeof active.offsetLeft !== 'number' || typeof active.offsetWidth !== 'number' || active.offsetWidth <= 0) {
        dl.classList.remove('is-thumb-ready');
        return;
      }
      if (!animate) dl.classList.remove('is-animated');
      daysThumb.style.setProperty('--seg-x', active.offsetLeft + 'px');
      daysThumb.style.setProperty('--seg-w', active.offsetWidth + 'px');
      dl.classList.add('is-thumb-ready');
      if (!animate && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => dl.classList.add('is-animated'));
      }
    }

    // Hall: one whole-day board. Each person is a bar running through the periods they sit in the hall.
    // Storage is unchanged: one seat entry per A–D period, as before.
    function hallPeople() {
      const people = new Map();
      S.forEach((_, si) => items(HALL, si).forEach(x => {
        if (!x) return;
        const raw = String(x[0] || '').trim(); if (!raw) return;
        const name = hallName(raw); if (!name) return;
        if (!people.has(name)) people.set(name, {name, rawNames: new Set(), segs: new Map()});
        const p = people.get(name);
        p.rawNames.add(raw);
        const existing = p.segs.get(si);
        if (!existing || (existing[1] === '课后' && x[1] !== '课后')) p.segs.set(si, x);
      }));
      return [...people.values()].sort((p, q) => Math.min(...p.segs.keys()) - Math.min(...q.segs.keys()) || p.name.localeCompare(q.name, 'zh'));
    }
    function matchesHallPerson(x, target) {
      if (!x) return false;
      const raw = String(x[0] || '').trim();
      if (!raw) return false;
      if (typeof target === 'object' && target) return target.rawNames?.has(raw) || hallName(raw) === target.name;
      return raw === target || hallName(raw) === hallName(target);
    }
    function setHallPerson(target, name, wanted, confirmSegs) {
      const oldName = typeof target === 'object' && target ? target.name : hallName(target);
      const cleanNew = hallName(name) || name;
      const renamed = cleanNew !== oldName;
      S.forEach((_, si) => {
        const arr = items(HALL, si).slice();
        const idxs = [];
        arr.forEach((x, idx) => { if (matchesHallPerson(x, target)) idxs.push(idx); });
        if (wanted.has(si)) {
          if (confirmSegs instanceof Set && !confirmSegs.has(si) && !renamed && idxs.length === 1) return;
          const at = idxs[0] ?? -1, prev = at >= 0 ? arr[at] : null;
          const shouldConfirm = confirmSegs === true || (confirmSegs instanceof Set && confirmSegs.has(si));
          const status = prev ? (shouldConfirm && prev[1] === '课后' ? '确定' : prev[1]) : '自习';
          const storedName = !renamed && prev ? prev[0] : name;
          const entry = [storedName, status || '自习', prev ? prev[2] || '' : '', prev ? prev[3] || '' : ''];
          if (at >= 0) {
            arr[at] = entry;
            for (let k = 1; k < idxs.length; k++) arr[idxs[k]] = null;
          } else {
            const free = arr.findIndex(x => !x);
            if (free < 0) arr.push(entry); else arr[free] = entry;
          }
        } else {
          if (!idxs.length) return;
          idxs.forEach(idx => { arr[idx] = null; });
        }
        setCell(HALL, si, arr);
      });
    }
    function hallBoard(col) {
      let maxHall = 0;
      S.forEach((s, si) => {   // period bands: counts, capacity, click to add someone
        const n = seated(items(HALL, si)); if (n > maxHall) maxHall = n;
        const band = el('div', 'tl-hallband' + (n > SEATS ? ' over' : '') + (has(key(HALL, si)) ? ' man' : ''));
        band.append(el('span', 'tl-hallcount', s[0] + ' · ' + n + '/' + SEATS));
        band.title = '大厅 ' + s[0] + ' 段 ' + s[1] + '–' + s[2] + '：已坐 ' + n + ' / ' + SEATS + '（点空白处添加自习）';
        band.onclick = () => openHall(null, si);
        place(band, lineOf(toM(s[1])), lineOf(Math.min(toM(s[2]), view.hi)), col); grid.append(band);
      });
      const people = hallPeople(), lanes = Math.max(1, people.length);
      const width = view.cols[HALL] ? view.cols[HALL].getBoundingClientRect().width : 200;
      const vertical = width / lanes < 64;
      people.forEach((person, lane) => {
        const segs = [...person.segs.keys()].sort((a, b) => a - b), runs = [];
        segs.forEach(si => {
          const last = runs[runs.length - 1];
          const isPre = person.segs.get(si)[1] === '课后';
          if (last && last[last.length - 1] === si - 1 && (person.segs.get(last[0])[1] === '课后') === isPre) last.push(si);
          else runs.push([si]);
        });
        runs.forEach(run => {
          const pre = run.every(si => person.segs.get(si)[1] === '课后');
          const from = S[run[0]][1], to = S[run[run.length - 1]][2];
          const bar = el('div', 'tl-hallbar' + (pre ? ' pre' : '') + (vertical ? ' vertical' : ''));
          bar.append(el('span', 'tl-hallname', person.name));
          if (!vertical) bar.append(el('span', 'tl-hallmeta', (pre ? '点选确认 · ' : '') + run.map(si => S[si][0]).join(' ')));
          bar.style.width = 'calc(' + (100 / lanes) + '% - 6px)';
          bar.style.marginLeft = 'calc(' + (100 * lane / lanes) + '% + 3px)';
          bar.tabIndex = 0; bar.setAttribute('role', 'button');
          const label = person.name + ' 大厅 ' + run.map(si => S[si][0]).join('、') + ' 段 ' + from + '–' + to + (pre ? '，预占（上完课自动放入，点一下确认）' : '');
          bar.title = label; bar.setAttribute('aria-label', label);
          const act = () => {
            if (pre) { const before = JSON.stringify(ed); setHallPerson(person, person.name, new Set(person.segs.keys()), new Set(run)); commit(before); }
            else openHall(person);
          };
          bar.onclick = e => { e.stopPropagation(); act(); };
          bar.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } };
          place(bar, lineOf(toM(from)), lineOf(Math.min(toM(to), view.hi)), col); grid.append(bar);
        });
      });
      return maxHall;
    }
    function lessonNode(lesson, col, lane, lanes, man, bad) {
      const x = lesson.x, minutes = toM(lesson.b) - toM(lesson.a);
      // Borrowed rooms ("（课表外）") read like lessons — student, then subject·teacher — and are always grey.
      // A booking label "易赛 老师👉学生" splits into teacher and student; the stored entry is unchanged.
      const borrowed = /（课表外）$/.test(String(x[1] || ''));
      let who = plain(x[0]), subject = x[1] || '', teacher = x[2] || '';
      if (borrowed) {
        subject = subject.replace(/（课表外）$/, '').trim();
        const arrow = who.indexOf('👉');
        if (arrow >= 0) { teacher = who.slice(0, arrow).trim() || teacher; who = who.slice(arrow + 2).trim() || who; }
      }
      const tone = borrowed ? '5' : tcol[x[2]] || '5';
      const node = el('div', 'k tl-lesson' + (borrowed ? ' borrowed' : '') + (minutes < 45 ? ' short' : '') + (man ? ' man' : '') + (bad ? ' bad' : ''));
      node.style.background = 'var(--t' + tone + ')';
      node.style.color = 'var(--t' + tone + 'fg)';
      node.style.borderLeftColor = 'var(--t' + tone + 'b)';
      node.style.setProperty('--ev-bar', 'var(--t' + tone + 'b)');
      node.append(el('div', 'w', who));
      node.append(el('div', 'tt', lesson.a + '–' + lesson.b));
      const sub = [subject, teacher].filter(Boolean).join('·');
      if (sub) node.append(el('div', 's', sub));
      node.tabIndex = 0; node.setAttribute('role', 'button');
      node.setAttribute('aria-label', R[lesson.ri] + ' ' + lesson.a + '到' + lesson.b + ' ' + who + (sub ? ' ' + sub : '') + (borrowed ? '，借用教室' : '') + (bad ? '，时间冲突' : ''));
      node.title = who + ' ' + lesson.a + '–' + lesson.b + (sub ? '\n' + sub : '') + (borrowed ? '\n借用教室（课表外）' : '') + (bad ? '\n⚠️ 与同教室另一节课时间重叠' : '');
      node.style.width = 'calc(' + (100 / lanes) + '% - ' + (lanes > 1 ? 8 : 10) + 'px)';
      node.style.marginLeft = 'calc(' + (100 * lane / lanes) + '% + 5px)';
      place(node, lineOf(toM(lesson.a)), lineOf(toM(lesson.b)), col);
      node.addEventListener('pointerdown', e => lessonDown(e, node, lesson));
      node.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLesson(lesson); } };
      return node;
    }
    function timelineRender() {
      if (tdrag?.active && curD === renderedDay) { pendingRender = true; return; }
      if (tdrag) { if (tdrag.raf) cancelAnimationFrame(tdrag.raf); if (tdrag.active) tdrag = null; }
      pendingRender = false; renderedDay = curD;
      if (typeof curD === 'string' && typeof mdD === 'function') document.title = 'Wayon 教室使用 ' + mdD(curD);
      grid.textContent = ''; grid.classList.add('tl');
      const current = rooms.map(ri => lessonsOf(ri, items));
      let lo = toM(S[0][1]), hi = toM(S[S.length - 1][2]);
      current.flat().forEach(l => { lo = Math.min(lo, toM(l.a)); hi = Math.max(hi, toM(l.b)); });
      lo = Math.floor(lo / 30) * 30; hi = Math.ceil(hi / 30) * 30;
      const rows = (hi - lo) / STEP, rowH = rowHeight(rows), hallCol = R.length + 1;
      view = {lo, hi, rowH, cols: {}};
      grid.style.setProperty('grid-template-columns', '60px repeat(' + rooms.length + ',minmax(108px,1fr)) minmax(190px,1.15fr)', 'important');
      grid.style.setProperty('grid-template-rows', '38px repeat(' + rows + ',' + rowH + 'px)', 'important');
      const corner = el('div', 'h tl-corner', '时间'); place(corner, 1, 2, 1); grid.append(corner);
      R.forEach((name, ri) => {
        const head = el('div', 'h', name.replace('教室', '').replace('（自习）', ''));
        if (ri === HALL) head.append(el('small', '', SEATS + ' 座'));
        if (ri === HALL) head.title = '大厅按 A–D 段排座：虚线 = 课后预占（点一下确认），实色 = 已确认';
        else if (S.some((_, si) => has(key(ri, si)))) { head.classList.add('man'); head.title = '这间教室今天手动改过'; }
        place(head, 1, 2, ri + 2); grid.append(head);
        view.cols[ri] = head;
      });
      const gaps = [];
      for (let i = 0; i + 1 < S.length; i++) gaps.push([toM(S[i][2]), toM(S[i + 1][1])]);
      const off = m => gaps.some(([a, b]) => m >= a && m < b);
      for (let m = lo; m < hi; m += 30) {
        const label = el('div', 'tl-time' + (m % 60 ? '' : ' hour') + (m === lo ? ' first' : ''), toT(m));
        place(label, lineOf(m), lineOf(m) + 2, 1); grid.append(label);
        rooms.forEach(ri => {
          for (let part = 0; part < 30; part += 10) {
            const t = m + part, slot = el('div', 'tl-slot' + (part ? ' sub' : m % 60 ? ' half' : '') + (off(t) ? ' off' : ''));
            if (part) slot.style.borderTopColor = 'transparent';
            slot.setAttribute('aria-hidden', 'true');
            slot.onclick = () => { if (!tdrag) openLesson(null, ri, toT(t)); };
            place(slot, lineOf(t), lineOf(t + 10), ri + 2); grid.append(slot);
          }
        });
      }
      let bad = 0, maxHall = 0;
      rooms.forEach((ri, i) => {
        const list = current[i], originals = new Set(lessonsOf(ri, orig).map(l => l.id));
        // Overlapping lessons in one room sit side by side and are flagged as a conflict.
        const lane = [], clusters = [];
        list.forEach(l => {
          let c = clusters[clusters.length - 1];
          if (!c || l.a >= c.end) { c = {end: l.b, ends: []}; clusters.push(c); }
          if (l.b > c.end) c.end = l.b;
          let j = c.ends.findIndex(e => e <= l.a); if (j < 0) j = c.ends.length;
          c.ends[j] = l.b; lane.push([c, j]);
        });
        list.forEach((l, k) => {
          const [c, j] = lane[k], conflict = c.ends.length > 1;
          if (conflict) bad++;
          grid.append(lessonNode(l, ri + 2, j, c.ends.length, !originals.has(l.id), conflict));
        });
      });
      maxHall = hallBoard(hallCol);
      if (curD === today) {
        const now = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Shanghai'})), m = now.getHours() * 60 + now.getMinutes();
        if (m >= lo && m < hi) {
          const line = el('div', 'tl-now'); line.style.marginTop = ((m - lo) % STEP) / STEP * rowH + 'px';
          line.append(el('span', 'tl-now-badge', toT(m)));
          line.setAttribute('aria-hidden', 'true'); place(line, lineOf(m - (m - lo) % STEP), lineOf(m - (m - lo) % STEP) + 1, '2 / ' + (hallCol + 1)); grid.append(line);
        }
      }
      const legend = $('lg'), anyBorrowed = !!grid.querySelector('.tl-lesson.borrowed');
      if (legend) {
        if (anyBorrowed && !legend.querySelector('.lg-borrowed')) {
          const item = el('span', 'lg-borrowed'), dot = el('i'); dot.style.background = 'var(--t5b)';
          item.append(dot, document.createTextNode('借用教室')); legend.prepend(item);
        } else if (!anyBorrowed) legend.querySelector('.lg-borrowed')?.remove();
      }
      const pairs = Math.ceil(bad / 2);
      const cf = $('cf');
      if (cf) {
        if (DATA.missing) {
          cf.className = 'miss';
          cf.hidden = false;
          cf.textContent = DATA.booking_preview ? '课表待更新 · 已显示借用预留' : '这天还没生成';
        } else if (bad > 0 || maxHall > SEATS) {
          cf.className = 'no';
          cf.hidden = false;
          const alerts = [];
          if (bad > 0) alerts.push('⚠️ ' + pairs + ' 处教室时间重叠');
          if (maxHall > SEATS) alerts.push('⚠️ 大厅超员 ' + maxHall + '/' + SEATS);
          cf.textContent = alerts.join(' · ');
        } else {
          // Zero conflicts: stay silently hidden instead of taking space with a green status badge.
          cf.className = 'ok';
          cf.textContent = '';
          cf.hidden = true;
        }
      }
      const totalLessons = current.reduce((acc, list) => acc + list.length, 0);
      summaryEl.textContent = DATA.missing ? '' : (totalLessons + ' 节排课 · 大厅 ' + maxHall + '/' + SEATS + ' 座');

      const dl = $('days');
      if (dl) {
        const dayKeys = [...new Set([today, tomorrow, ...Object.keys(ALL).filter(d => d >= today)])].sort().slice(0, 7);
        const keysStr = dayKeys.join(',');
        if (keysStr !== lastDayKeys) {
          lastDayKeys = keysStr;
          dl.textContent = '';
          dl.setAttribute('role', 'group');
          dl.setAttribute('aria-label', '选择课表日期');
          daysThumb = el('span', 'tl-seg-thumb');
          daysThumb.setAttribute('aria-hidden', 'true');
          dl.append(daysThumb);
          daysButtons = dayKeys.map(d => {
            const on = d === curD;
            const b = el('button', on ? 'on' : '', relD(d) + mdD(d));
            b.type = 'button';
            b.dataset.day = d;
            b.setAttribute('aria-pressed', String(on));
            b.onclick = () => { if (d !== curD) useDay(d); };
            dl.append(b);
            return b;
          });
          if (!daysBound && typeof dl.addEventListener === 'function') {
            daysBound = true;
            dl.addEventListener('keydown', e => {
              const i = daysButtons.indexOf(e.target);
              if (i < 0) return;
              let next = -1;
              if (e.key === 'ArrowRight') next = (i + 1) % daysButtons.length;
              else if (e.key === 'ArrowLeft') next = (i - 1 + daysButtons.length) % daysButtons.length;
              else if (e.key === 'Home') next = 0;
              else if (e.key === 'End') next = daysButtons.length - 1;
              if (next >= 0 && daysButtons[next]) {
                e.preventDefault();
                daysButtons[next].focus();
                const targetDay = daysButtons[next].dataset.day;
                if (targetDay && targetDay !== curD) useDay(targetDay);
              }
            });
            if (typeof ResizeObserver === 'function') new ResizeObserver(() => syncDaysThumb(dl, false)).observe(dl);
          }
          syncDaysThumb(dl, false);
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => syncDaysThumb(dl, false));
        } else {
          daysButtons.forEach((b, idx) => {
            const d = dayKeys[idx], on = d === curD;
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', String(on));
            b.textContent = relD(d) + mdD(d);
          });
          syncDaysThumb(dl, true);
        }
      }
    }
    // Drag a lesson to another room or time; the preview snaps to 10 minutes and keeps the length.
    function lessonDown(e, node, lesson) {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      const r = node.getBoundingClientRect();
      tdrag = {active: true, pointerId: e.pointerId, node, lesson, x0: e.clientX, y0: e.clientY, grab: e.clientY - r.top, moved: false, preview: null, target: null, raf: 0, px: 0, py: 0};
      try { node.setPointerCapture(e.pointerId); } catch (_) {}
      node.onpointermove = lessonMove; node.onpointerup = lessonUp; node.onpointercancel = () => finishDrag(false);
    }
    function dropAt(px, py) {
      const length = toM(tdrag.lesson.b) - toM(tdrag.lesson.a);
      const ri = rooms.find(r => { const box = view.cols[r].getBoundingClientRect(); return px >= box.left - 4 && px <= box.right + 4; });
      if (ri === undefined) return null;
      const topY = view.cols[ri].getBoundingClientRect().bottom;
      let start = view.lo + Math.round((py - tdrag.grab - topY) / (view.rowH * SNAP / STEP)) * SNAP;
      start = Math.max(view.lo, Math.min(view.hi - length, start));
      return {ri, a: toT(start), b: toT(start + length)};
    }
    function paintDrag() {
      if (!tdrag?.active) return;
      tdrag.raf = 0;
      const target = dropAt(tdrag.px, tdrag.py);
      tdrag.target = target;
      if (!target) { if (tdrag.preview) tdrag.preview.hidden = true; return; }
      if (!tdrag.preview) { tdrag.preview = el('div', 'tl-preview'); grid.append(tdrag.preview); }
      tdrag.preview.hidden = false;
      tdrag.preview.textContent = R[target.ri].replace('教室', '') + ' ' + target.a + '–' + target.b;
      place(tdrag.preview, lineOf(toM(target.a)), lineOf(toM(target.b)), target.ri + 2);
    }
    function lessonMove(e) {
      if (!tdrag?.active) return;
      tdrag.px = e.clientX; tdrag.py = e.clientY;
      if (!tdrag.moved) { if (Math.hypot(e.clientX - tdrag.x0, e.clientY - tdrag.y0) < 5) return; tdrag.moved = true; tdrag.node.classList.add('dragging'); }
      if (!tdrag.raf) tdrag.raf = requestAnimationFrame(paintDrag);
    }
    function finishDrag(apply, quiet) {
      const d = tdrag; if (!d || !d.active) return;
      d.active = false;
      if (d.raf) cancelAnimationFrame(d.raf);
      d.node.onpointermove = d.node.onpointerup = d.node.onpointercancel = null;
      setTimeout(() => { if (tdrag === d) tdrag = null; }, 0);
      const t = d.target, l = d.lesson;
      if (apply && t && (t.ri !== l.ri || t.a !== l.a)) {
        const before = JSON.stringify(ed);
        removeLesson(l); addLesson(t.ri, l.x[0] || '', l.x[1] || '', l.x[2] || '', t.a, t.b);
        commit(before);
      } else if (!quiet || pendingRender) render();
    }
    function lessonUp(e) {
      if (!tdrag?.active) return;
      if (!tdrag.moved) { const lesson = tdrag.lesson; finishDrag(false, true); openLesson(lesson); return; }
      tdrag.px = e.clientX; tdrag.py = e.clientY; paintDrag(); finishDrag(true);
    }
    window.addEventListener('blur', () => { if (tdrag?.active) finishDrag(false); });
    document.addEventListener('pointercancel', e => { if (tdrag?.active && (tdrag.pointerId === undefined || e.pointerId === tdrag.pointerId)) finishDrag(false); }, true);
    document.addEventListener('pointerup', e => { if (tdrag?.active && (tdrag.pointerId === undefined || e.pointerId === tdrag.pointerId) && !tdrag.node.isConnected) finishDrag(false); }, true);
    // Lesson editor: who / subject / teacher / room / start / end. Only this page's table changes.
    const sheet = el('div', 'sheet'); sheet.id = 'tlsh'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'false');
    const title = el('div', 't'), fields = el('div', 'tl-fields'), err = el('div', 'tl-err');
    const field = (label, input) => { const box = el('label', '', label); box.append(input); fields.append(box); return input; };
    const inWho = field('学生 / 班级', el('input')), inSub = field('科目', el('input')), inTeacher = field('老师', el('input'));
    const inRoom = field('教室', el('select')), inA = field('开始', el('input')), inB = field('结束', el('input'));
    inA.type = inB.type = 'time'; inA.step = inB.step = 600;
    const teacherList = el('datalist'); teacherList.id = 'tl-teachers'; inTeacher.setAttribute('list', teacherList.id);
    rooms.forEach(ri => { const o = el('option', '', R[ri]); o.value = String(ri); inRoom.append(o); });
    const row = el('div', 'row'), bSave = el('button', 'pri', '保存'), bDel = el('button', '', '删除这节'), bReset = el('button', '', '恢复这间教室原样'), bCancel = el('button', '', '取消');
    [bSave, bDel, bReset, bCancel].forEach(b => { b.type = 'button'; row.append(b); });
    const hint = el('div', 'hint', '只改这张表，不会改小SaaS 课表、不写备忘录。时间按 10 分钟对齐；同一教室时间重叠会标红。');
    sheet.append(title, fields, err, row, hint, teacherList); document.body.append(sheet);
    function openLesson(lesson, ri, start) {
      sheetLesson = lesson;
      teacherList.textContent = ''; (DATA.teachers || []).forEach(t => { const o = el('option'); o.value = t; teacherList.append(o); });
      const r = lesson ? lesson.ri : ri, a = lesson ? lesson.a : start;
      const b = lesson ? lesson.b : toT(Math.min(toM(start) + 60, view.hi + 120));
      title.textContent = lesson ? '修改课程' : '添加课程 · ' + R[r] + ' ' + a;
      inWho.value = lesson ? lesson.x[0] || '' : '';
      inSub.value = lesson ? lesson.x[1] || '' : ''; inTeacher.value = lesson ? lesson.x[2] || '' : '';
      inRoom.value = String(r); inA.value = a; inB.value = b; err.textContent = '';
      bDel.hidden = !lesson; bReset.hidden = !S.some((_, si) => has(key(r, si)));
      sheet.classList.add('on'); (lesson ? inA : inWho).focus();
    }
    const closeLesson = () => { sheet.classList.remove('on'); sheetLesson = null; };
    bCancel.onclick = closeLesson;
    bSave.onclick = () => {
      const who = inWho.value.trim(), a = inA.value, b = inB.value, ri = +inRoom.value;
      if (!who) { err.textContent = '请填写学生或班级'; inWho.focus(); return; }
      if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b) || a >= b) { err.textContent = '结束时间要晚于开始时间'; inB.focus(); return; }
      const before = JSON.stringify(ed);
      if (sheetLesson) removeLesson(sheetLesson);
      addLesson(ri, who, inSub.value.trim(), inTeacher.value.trim(), a, b);
      closeLesson(); commit(before);
    };
    bDel.onclick = () => { if (!sheetLesson) return; const before = JSON.stringify(ed); removeLesson(sheetLesson); closeLesson(); commit(before); };
    bReset.onclick = () => { const ri = sheetLesson ? sheetLesson.ri : +inRoom.value, before = JSON.stringify(ed); S.forEach((_, si) => setCell(ri, si, null)); closeLesson(); commit(before); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('on')) closeLesson(); });
    // Hall editor: a name and the periods that person sits in the hall.
    const hallSheet = el('div', 'sheet'); hallSheet.id = 'tlhall'; hallSheet.setAttribute('role', 'dialog');
    const hTitle = el('div', 't'), hFields = el('div', 'tl-fields'), hErr = el('div', 'tl-err'), hSegs = el('div', 'tl-hallsegs');
    const hName = el('input'); { const box = el('label', '', '姓名'); box.append(hName); hFields.append(box); }
    const hChecks = S.map((s, si) => { const box = el('label', 'tl-hallseg'), c = el('input'); c.type = 'checkbox'; c.value = String(si); box.append(c, document.createTextNode(s[0] + ' 段 ' + s[1] + '–' + s[2])); hSegs.append(box); return c; });
    const hRow = el('div', 'row'), hSave = el('button', 'pri', '保存'), hDel = el('button', '', '从大厅移除'), hCancel = el('button', '', '取消');
    [hSave, hDel, hCancel].forEach(b => { b.type = 'button'; hRow.append(b); });
    hallSheet.append(hTitle, hFields, hSegs, hErr, hRow, el('div', 'hint', '勾选这个人在大厅的时段；每段最多 ' + SEATS + ' 座，超出会标红。只改这张表。'));
    document.body.append(hallSheet);
    let hallPerson = null;
    function openHall(person, si) {
      hallPerson = person;
      hTitle.textContent = person ? '大厅 · ' + plain(person.name) : '添加到大厅';
      hName.value = person ? person.name : '';
      hChecks.forEach((c, i) => { c.checked = person ? person.segs.has(i) : i === si; });
      hDel.hidden = !person; hErr.textContent = '';
      hallSheet.classList.add('on'); hName.focus();
    }
    const closeHall = () => { hallSheet.classList.remove('on'); hallPerson = null; };
    hCancel.onclick = closeHall;
    hSave.onclick = () => {
      const name = hName.value.trim(), wanted = new Set(hChecks.filter(c => c.checked).map(c => +c.value));
      if (!name) { hErr.textContent = '请填写姓名'; hName.focus(); return; }
      if (!wanted.size) { hErr.textContent = '至少勾选一个时段；不在大厅请点「从大厅移除」'; return; }
      const before = JSON.stringify(ed);
      if (hallPerson && hallName(name) !== hallPerson.name) {
        setHallPerson(hallPerson, hallPerson.name, new Set(), false);
        setHallPerson(name, name, wanted, true);
      } else {
        setHallPerson(hallPerson || name, name, wanted, true);
      }
      closeHall(); commit(before);
    };
    hDel.onclick = () => { if (!hallPerson) return; const before = JSON.stringify(ed); setHallPerson(hallPerson, hallPerson.name, new Set(), false); closeHall(); commit(before); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && hallSheet.classList.contains('on')) closeHall(); });
    render = timelineRender;   // the page's own commit/useDay/cloud apply call render()
    if (typeof useDay === 'function') {
      const origUseDay = useDay;
      useDay = d => { origUseDay(d); if (typeof curD === 'string' && typeof mdD === 'function') document.title = 'Wayon 教室使用 ' + mdD(curD); };
    }
    if (scroller && typeof ResizeObserver === 'function') {
      let last = 0;
      new ResizeObserver(() => { if (!view || tdrag) return; const next = rowHeight((view.hi - view.lo) / STEP); if (next !== view.rowH && next !== last) { last = next; render(); } }).observe(scroller);
    }
    setInterval(() => { if (!tdrag && !sheet.classList.contains('on') && !hallSheet.classList.contains('on') && curD === today) render(); }, 300000);
    render();
  }

  const setup = () => {
    if (document.body.classList.contains('wayon-workbench')) {
      let scheduled = false;
      const syncFrameTheme = () => {
        const frame = document.getElementById('classroom-frame');
        if (!frame?.contentWindow || typeof location === 'undefined') return;
        try { frame.contentWindow.postMessage({type: 'wayon-theme', theme: readDocumentTheme(document)}, location.origin); } catch (_) {}
      };
      const fit = () => {
        scheduled = false;
        const frame = document.getElementById('classroom-frame'); if (!frame) return;
        if (!frame.dataset.wayonThemeBound) {
          frame.dataset.wayonThemeBound = '1';
          frame.addEventListener('load', syncFrameTheme);
        }
        syncFrameTheme();
        const top = frame.getBoundingClientRect().top + (Number(window.scrollY) || 0);
        const minimum = window.innerWidth <= 700 ? 620 : 360;
        const mc = frame.closest?.('.main-content');
        const bottom = (mc && typeof getComputedStyle === 'function' ? parseFloat(getComputedStyle(mc).paddingBottom) : 18) || 18;
        const height = Math.max(minimum, Math.floor(window.innerHeight - top - Math.max(18, bottom)));
        const value = height + 'px';
        if (frame.style.getPropertyValue('--room-frame-height') !== value) frame.style.setProperty('--room-frame-height', value);
      };
      const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(fit); } };
      if (typeof MutationObserver === 'function') {
        new MutationObserver(schedule).observe(document.body, {childList: true, subtree: true});
        if (document.documentElement) new MutationObserver(syncFrameTheme).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
        if (document.head) new MutationObserver(syncFrameTheme).observe(document.head, {childList: true, subtree: true, attributes: true, attributeFilter: ['content']});
      }
      if (typeof ResizeObserver === 'function') new ResizeObserver(schedule).observe(document.querySelector('.app-layout') || document.body);
      window.addEventListener('resize', schedule); schedule(); return;
    }
    if (!document.body.classList.contains('wayon-room')) return;

    // Mark root for scoped Cupertino light/dark color-scheme and apply explicit theme handoff.
    document.documentElement?.classList?.add('wayon-room-root');
    const isEmbedded = (() => { try { return typeof window !== 'undefined' && window.self !== window.top; } catch (_) { return false; } })();
    if (isEmbedded) { document.documentElement?.classList?.add('is-embedded'); document.body.classList.add('is-embedded'); }
    let schemeMeta = document.querySelector?.('meta[name="color-scheme"]') || null;
    if (!schemeMeta && document.head) {
      schemeMeta = document.createElement('meta');
      schemeMeta.setAttribute('name', 'color-scheme');
      schemeMeta.setAttribute('content', 'light dark');
      document.head.append(schemeMeta);
    }
    const applyTheme = theme => {
      const next = theme === 'dark' || theme === 'light' ? theme : '';
      if (document.documentElement?.dataset) {
        if (next) document.documentElement.dataset.theme = next;
        else delete document.documentElement.dataset.theme;
      }
      if (schemeMeta) schemeMeta.setAttribute('content', next || 'light dark');
    };
    try {
      const urlTheme = typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search).get('theme') : '';
      if (urlTheme === 'dark' || urlTheme === 'light') applyTheme(urlTheme);
      else if (isEmbedded && window.parent && window.parent !== window) applyTheme(readDocumentTheme(window.parent.document));
    } catch (_) {}
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('message', e => {
        if (typeof location !== 'undefined' && e.origin === location.origin && e.data?.type === 'wayon-theme') applyTheme(e.data.theme);
      });
    }

    const top = document.querySelector('.top'), grid = document.getElementById('g');
    if (!top || !grid) return;
    const legendEl = document.getElementById('lg');
    if (legendEl && legendEl.parentNode !== top) top.append(legendEl);

    const info = document.createElement('details'); info.className = 'room-info';
    const summary = document.createElement('summary'); summary.textContent = 'ⓘ'; summary.setAttribute('aria-label', '课表状态与操作说明');
    const panel = document.createElement('div'); panel.className = 'room-info-panel';
    const help = document.createElement('p'); help.textContent = '课程按真实时间排列：点空白时间可添加课程，点课程可改时间或教室，按住课程块可拖到别的教室或时间（10 分钟对齐）。大厅虚线姓名为课后预占，点一下确认；点大厅空白处可添加自习。';
    panel.append(help);
    const status = document.querySelector('body>[role="status"]'); if (status) panel.append(status);
    const sync = document.getElementById('sync'); if (sync) panel.append(sync);
    info.append(summary, panel); top.append(info);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && info.open) info.open = false; });

    const plain = value => String(value || '').replace(/[【】「」]/g, '').trim();
    const decorate = () => {
      // Names only: brackets around a student name are presentation, never stored data.
      grid.querySelectorAll('.k .w').forEach(node => { const next = plain(node.textContent); if (next !== node.textContent) node.textContent = next; });
      // A lesson that continues from the previous slot is shown as a continuation, not a blank cell.
      grid.querySelectorAll('.c.used:not(.seat)').forEach(cell => {
        if (cell.querySelector('.k,.room-cont')) return;
        let list = [];
        try { if (typeof items === 'function') list = items(Number(cell.dataset.ri), Number(cell.dataset.si)) || []; } catch (_) { list = []; }
        const lessons = list.filter(Boolean);
        const box = document.createElement('div'); box.className = 'room-cont';
        if (!lessons.length) { box.textContent = '占用中'; cell.append(box); return; }
        for (const x of lessons) {
          const line = document.createElement('div');
          const who = document.createElement('b'); who.textContent = plain(x[0]) || '课程';
          const end = String(x[3] || '').split('-')[1];
          line.append(who, document.createTextNode(' 接上节' + (end ? ' · 至 ' + end.trim() : '')));
          box.append(line);
        }
        cell.setAttribute('aria-label', '上一时段课程延续：' + lessons.map(x => plain(x[0])).join('、'));
        cell.append(box);
      });
      grid.querySelectorAll('.k:not(.chip) .s').forEach(node => {
        if (node.dataset.roomLayout) return;
        node.dataset.roomLayout = '1'; const text = node.textContent, i = text.lastIndexOf('·'); if (i < 0) return;
        const subject = document.createElement('span'), teacher = document.createElement('span');
        subject.className = 'room-subject'; teacher.className = 'room-teacher';
        subject.textContent = text.slice(0, i); teacher.textContent = text.slice(i + 1);
        node.replaceChildren(subject, teacher);
      });
      grid.querySelectorAll('.hallbox').forEach(box => {
        const free = box.querySelector('.seat.free');
        if (free && !free.classList.contains('room-seat-add')) {
          free.classList.add('room-seat-add'); free.textContent = '＋ 加座';
          free.title = free.getAttribute('aria-label') + '：添加自习';
        }
      });
      // Hall notes collapse into one quiet item at the end of the legend.
      const legend = document.getElementById('lg');
      if (legend && legend.querySelector('.lg-pre,.lg-ok')) {
        const notes = [...legend.children].filter(span => span.querySelector('.lg-pre,.lg-ok'));
        const note = document.createElement('span'); note.className = 'lg-hall-note';
        const swatch = document.createElement('i'); swatch.className = 'lg-hall-swatch'; swatch.setAttribute('aria-hidden', 'true');
        note.append(swatch, document.createTextNode('大厅预占（点选确认）'));
        note.title = notes.map(span => span.textContent).join('；');
        notes.forEach(span => span.remove()); legend.append(note);
      }
      const foot = document.getElementById('f'); if (foot && foot.textContent.includes('按住课程块')) foot.textContent = foot.textContent.split('按住课程块')[0].trim();
    };
    installTimeline(grid, top);
    decorate(); new MutationObserver(decorate).observe(grid, {childList: true});
    // Narrow screens: say that the room table scrolls sideways, and hide the hint at the end.
    const scroller = grid.closest('.room-scroll');
    if (scroller) {
      const hint = document.createElement('div'); hint.className = 'room-scroll-hint'; hint.setAttribute('aria-hidden', 'true'); hint.textContent = '← 左右滑动查看全部教室 →';
      scroller.before(hint);
      const update = () => { const more = scroller.scrollWidth - scroller.clientWidth > 4; document.body.classList.toggle('room-overflow', more); hint.style.visibility = more && scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4 ? 'visible' : 'hidden'; };
      scroller.addEventListener('scroll', update, {passive: true}); window.addEventListener('resize', update);
      if (typeof ResizeObserver === 'function') new ResizeObserver(update).observe(scroller);
      update();
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once: true}); else setup();
})();
