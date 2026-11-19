// Component-scoped Apple Cupertino · Liquid Glass presentation for the task rules editor.
// Desktop first (1280–1440): roster on the left, the chosen learner's rules on the right.
export const STYLE = String.raw`
.rules-studio,
.wayon-rules-dialog {
  color-scheme: light dark;
  --rs-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", sans-serif;

  /* Raw Light & True-Black Dark Tokens */
  --rs-bg-light: #F5F5F7;
  --rs-bg-dark: #000000;
  --rs-surface-light: #FFFFFF;
  --rs-surface-dark: #1C1C1E;
  --rs-well-light: #F5F5F7;
  --rs-well-dark: #2C2C2E;
  --rs-hover-light: rgba(29, 29, 31, 0.045);
  --rs-hover-dark: rgba(255, 255, 255, 0.08);
  --rs-ink-light: #1D1D1F;
  --rs-ink-dark: #F5F5F7;
  --rs-secondary-light: #6E6E73;
  --rs-secondary-dark: #AEAEB2;
  --rs-muted-light: #86868B;
  --rs-muted-dark: #8E8E93;
  --rs-line-light: rgba(29, 29, 31, 0.085);
  --rs-line-dark: rgba(255, 255, 255, 0.11);
  --rs-line-strong-light: rgba(29, 29, 31, 0.16);
  --rs-line-strong-dark: rgba(255, 255, 255, 0.20);
  --rs-card-rim-light: rgba(255, 255, 255, 0.96);
  --rs-card-rim-dark: rgba(255, 255, 255, 0.12);
  --rs-card-ring-light: rgba(0, 0, 0, 0.04);
  --rs-card-ring-dark: rgba(255, 255, 255, 0.08);
  --rs-shadow1-light: rgba(0, 0, 0, 0.048);
  --rs-shadow1-dark: rgba(0, 0, 0, 0.54);
  --rs-shadow2-light: rgba(0, 0, 0, 0.025);
  --rs-shadow2-dark: rgba(0, 0, 0, 0.36);

  --rs-blue-light: #0071E3;
  --rs-blue-dark: #2997FF;
  --rs-blue-hover-light: #0077ED;
  --rs-blue-hover-dark: #4CA8FF;
  --rs-blue-soft-light: rgba(0, 113, 227, 0.10);
  --rs-blue-soft-dark: rgba(41, 151, 255, 0.18);
  --rs-blue-ink-light: #004A9E;
  --rs-blue-ink-dark: #8AC8FF;

  --rs-green-light: #1B7F37;
  --rs-green-dark: #32D74B;
  --rs-green-soft-light: rgba(52, 199, 89, 0.13);
  --rs-green-soft-dark: rgba(48, 209, 88, 0.18);
  --rs-switch-on-light: #34C759;
  --rs-switch-on-dark: #30D158;
  --rs-switch-off-light: rgba(120, 120, 128, 0.28);
  --rs-switch-off-dark: rgba(120, 120, 128, 0.42);
  --rs-switch-mixed-light: #E08600;
  --rs-switch-mixed-dark: #FF9F0A;

  --rs-orange-light: #B85D00;
  --rs-orange-dark: #FF9F0A;
  --rs-orange-soft-light: rgba(255, 149, 0, 0.13);
  --rs-orange-soft-dark: rgba(255, 159, 10, 0.18);

  --rs-red-light: #D70015;
  --rs-red-dark: #FF6961;
  --rs-red-soft-light: rgba(255, 59, 48, 0.12);
  --rs-red-soft-dark: rgba(255, 69, 58, 0.20);

  --rs-seg-track-light: rgba(118, 118, 128, 0.12);
  --rs-seg-track-dark: rgba(118, 118, 128, 0.28);
  --rs-seg-inset-light: rgba(0, 0, 0, 0.065);
  --rs-seg-inset-dark: rgba(0, 0, 0, 0.48);
  --rs-seg-lip-light: rgba(255, 255, 255, 0.78);
  --rs-seg-lip-dark: rgba(255, 255, 255, 0.08);
  --rs-seg-thumb-light: #FFFFFF;
  --rs-seg-thumb-dark: rgba(99, 99, 102, 0.90);
  --rs-seg-shadow-light: rgba(0, 0, 0, 0.095);
  --rs-seg-shadow-dark: rgba(0, 0, 0, 0.46);

  --rs-glass-top-light: rgba(255, 255, 255, 0.92);
  --rs-glass-top-dark: rgba(42, 42, 46, 0.90);
  --rs-glass-bot-light: rgba(248, 249, 252, 0.86);
  --rs-glass-bot-dark: rgba(28, 28, 30, 0.88);
  --rs-island-bg-light: rgba(22, 22, 24, 0.92);
  --rs-island-bg-dark: rgba(44, 44, 48, 0.94);
  --rs-sb-thumb-light: rgba(29, 29, 31, 0.22);
  --rs-sb-thumb-dark: rgba(245, 245, 247, 0.26);

  /* Light defaults (fallback for browsers without light-dark()) */
  --bg: var(--rs-bg-light);
  --surface: var(--rs-surface-light);
  --well: var(--rs-well-light);
  --hover: var(--rs-hover-light);
  --ink: var(--rs-ink-light);
  --secondary: var(--rs-secondary-light);
  --muted: var(--rs-muted-light);
  --line: var(--rs-line-light);
  --line-strong: var(--rs-line-strong-light);
  --card-rim: var(--rs-card-rim-light);
  --card-ring: var(--rs-card-ring-light);
  --shadow1: var(--rs-shadow1-light);
  --shadow2: var(--rs-shadow2-light);
  --blue: var(--rs-blue-light);
  --blue-hover: var(--rs-blue-hover-light);
  --blue-soft: var(--rs-blue-soft-light);
  --blue-ink: var(--rs-blue-ink-light);
  --green: var(--rs-green-light);
  --green-soft: var(--rs-green-soft-light);
  --switch-on: var(--rs-switch-on-light);
  --switch-off: var(--rs-switch-off-light);
  --switch-mixed: var(--rs-switch-mixed-light);
  --orange: var(--rs-orange-light);
  --orange-soft: var(--rs-orange-soft-light);
  --red: var(--rs-red-light);
  --red-soft: var(--rs-red-soft-light);
  --seg-track: var(--rs-seg-track-light);
  --seg-inset: var(--rs-seg-inset-light);
  --seg-lip: var(--rs-seg-lip-light);
  --seg-thumb: var(--rs-seg-thumb-light);
  --seg-shadow: var(--rs-seg-shadow-light);
  --glass-top: var(--rs-glass-top-light);
  --glass-bot: var(--rs-glass-bot-light);
  --island-bg: var(--rs-island-bg-light);
  --sb-thumb: var(--rs-sb-thumb-light);

  accent-color: var(--blue);
  scrollbar-color: var(--sb-thumb) transparent;
}

:root[data-theme="dark"] .rules-studio,
:root[data-theme="dark"] .wayon-rules-dialog,
:root:has(> head > meta[name="color-scheme"][content="dark"]) .rules-studio,
:root:has(> head > meta[name="color-scheme"][content="dark"]) .wayon-rules-dialog {
  color-scheme: dark;
}
:root[data-theme="light"] .rules-studio,
:root[data-theme="light"] .wayon-rules-dialog,
:root:has(> head > meta[name="color-scheme"][content="light"]) .rules-studio,
:root:has(> head > meta[name="color-scheme"][content="light"]) .wayon-rules-dialog {
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not(:has(> head > meta[name="color-scheme"][content="light"])) .rules-studio,
  :root:not([data-theme="light"]):not(:has(> head > meta[name="color-scheme"][content="light"])) .wayon-rules-dialog {
    --bg: var(--rs-bg-dark);
    --surface: var(--rs-surface-dark);
    --well: var(--rs-well-dark);
    --hover: var(--rs-hover-dark);
    --ink: var(--rs-ink-dark);
    --secondary: var(--rs-secondary-dark);
    --muted: var(--rs-muted-dark);
    --line: var(--rs-line-dark);
    --line-strong: var(--rs-line-strong-dark);
    --card-rim: var(--rs-card-rim-dark);
    --card-ring: var(--rs-card-ring-dark);
    --shadow1: var(--rs-shadow1-dark);
    --shadow2: var(--rs-shadow2-dark);
    --blue: var(--rs-blue-dark);
    --blue-hover: var(--rs-blue-hover-dark);
    --blue-soft: var(--rs-blue-soft-dark);
    --blue-ink: var(--rs-blue-ink-dark);
    --green: var(--rs-green-dark);
    --green-soft: var(--rs-green-soft-dark);
    --switch-on: var(--rs-switch-on-dark);
    --switch-off: var(--rs-switch-off-dark);
    --switch-mixed: var(--rs-switch-mixed-dark);
    --orange: var(--rs-orange-dark);
    --orange-soft: var(--rs-orange-soft-dark);
    --red: var(--rs-red-dark);
    --red-soft: var(--rs-red-soft-dark);
    --seg-track: var(--rs-seg-track-dark);
    --seg-inset: var(--rs-seg-inset-dark);
    --seg-lip: var(--rs-seg-lip-dark);
    --seg-thumb: var(--rs-seg-thumb-dark);
    --seg-shadow: var(--rs-seg-shadow-dark);
    --glass-top: var(--rs-glass-top-dark);
    --glass-bot: var(--rs-glass-bot-dark);
    --island-bg: var(--rs-island-bg-dark);
    --sb-thumb: var(--rs-sb-thumb-dark);
  }
}

:root[data-theme="dark"] .rules-studio,
:root[data-theme="dark"] .wayon-rules-dialog,
:root:has(> head > meta[name="color-scheme"][content="dark"]) .rules-studio,
:root:has(> head > meta[name="color-scheme"][content="dark"]) .wayon-rules-dialog {
  --bg: var(--rs-bg-dark);
  --surface: var(--rs-surface-dark);
  --well: var(--rs-well-dark);
  --hover: var(--rs-hover-dark);
  --ink: var(--rs-ink-dark);
  --secondary: var(--rs-secondary-dark);
  --muted: var(--rs-muted-dark);
  --line: var(--rs-line-dark);
  --line-strong: var(--rs-line-strong-dark);
  --card-rim: var(--rs-card-rim-dark);
  --card-ring: var(--rs-card-ring-dark);
  --shadow1: var(--rs-shadow1-dark);
  --shadow2: var(--rs-shadow2-dark);
  --blue: var(--rs-blue-dark);
  --blue-hover: var(--rs-blue-hover-dark);
  --blue-soft: var(--rs-blue-soft-dark);
  --blue-ink: var(--rs-blue-ink-dark);
  --green: var(--rs-green-dark);
  --green-soft: var(--rs-green-soft-dark);
  --switch-on: var(--rs-switch-on-dark);
  --switch-off: var(--rs-switch-off-dark);
  --switch-mixed: var(--rs-switch-mixed-dark);
  --orange: var(--rs-orange-dark);
  --orange-soft: var(--rs-orange-soft-dark);
  --red: var(--rs-red-dark);
  --red-soft: var(--rs-red-soft-dark);
  --seg-track: var(--rs-seg-track-dark);
  --seg-inset: var(--rs-seg-inset-dark);
  --seg-lip: var(--rs-seg-lip-dark);
  --seg-thumb: var(--rs-seg-thumb-dark);
  --seg-shadow: var(--rs-seg-shadow-dark);
  --glass-top: var(--rs-glass-top-dark);
  --glass-bot: var(--rs-glass-bot-dark);
  --island-bg: var(--rs-island-bg-dark);
  --sb-thumb: var(--rs-sb-thumb-dark);
}

@supports (color: light-dark(white, black)) {
  .rules-studio,
  .wayon-rules-dialog {
    --bg: light-dark(var(--rs-bg-light), var(--rs-bg-dark));
    --surface: light-dark(var(--rs-surface-light), var(--rs-surface-dark));
    --well: light-dark(var(--rs-well-light), var(--rs-well-dark));
    --hover: light-dark(var(--rs-hover-light), var(--rs-hover-dark));
    --ink: light-dark(var(--rs-ink-light), var(--rs-ink-dark));
    --secondary: light-dark(var(--rs-secondary-light), var(--rs-secondary-dark));
    --muted: light-dark(var(--rs-muted-light), var(--rs-muted-dark));
    --line: light-dark(var(--rs-line-light), var(--rs-line-dark));
    --line-strong: light-dark(var(--rs-line-strong-light), var(--rs-line-strong-dark));
    --card-rim: light-dark(var(--rs-card-rim-light), var(--rs-card-rim-dark));
    --card-ring: light-dark(var(--rs-card-ring-light), var(--rs-card-ring-dark));
    --shadow1: light-dark(var(--rs-shadow1-light), var(--rs-shadow1-dark));
    --shadow2: light-dark(var(--rs-shadow2-light), var(--rs-shadow2-dark));
    --blue: light-dark(var(--rs-blue-light), var(--rs-blue-dark));
    --blue-hover: light-dark(var(--rs-blue-hover-light), var(--rs-blue-hover-dark));
    --blue-soft: light-dark(var(--rs-blue-soft-light), var(--rs-blue-soft-dark));
    --blue-ink: light-dark(var(--rs-blue-ink-light), var(--rs-blue-ink-dark));
    --green: light-dark(var(--rs-green-light), var(--rs-green-dark));
    --green-soft: light-dark(var(--rs-green-soft-light), var(--rs-green-soft-dark));
    --switch-on: light-dark(var(--rs-switch-on-light), var(--rs-switch-on-dark));
    --switch-off: light-dark(var(--rs-switch-off-light), var(--rs-switch-off-dark));
    --switch-mixed: light-dark(var(--rs-switch-mixed-light), var(--rs-switch-mixed-dark));
    --orange: light-dark(var(--rs-orange-light), var(--rs-orange-dark));
    --orange-soft: light-dark(var(--rs-orange-soft-light), var(--rs-orange-soft-dark));
    --red: light-dark(var(--rs-red-light), var(--rs-red-dark));
    --red-soft: light-dark(var(--rs-red-soft-light), var(--rs-red-soft-dark));
    --seg-track: light-dark(var(--rs-seg-track-light), var(--rs-seg-track-dark));
    --seg-inset: light-dark(var(--rs-seg-inset-light), var(--rs-seg-inset-dark));
    --seg-lip: light-dark(var(--rs-seg-lip-light), var(--rs-seg-lip-dark));
    --seg-thumb: light-dark(var(--rs-seg-thumb-light), var(--rs-seg-thumb-dark));
    --seg-shadow: light-dark(var(--rs-seg-shadow-light), var(--rs-seg-shadow-dark));
    --glass-top: light-dark(var(--rs-glass-top-light), var(--rs-glass-top-dark));
    --glass-bot: light-dark(var(--rs-glass-bot-light), var(--rs-glass-bot-dark));
    --island-bg: light-dark(var(--rs-island-bg-light), var(--rs-island-bg-dark));
    --sb-thumb: light-dark(var(--rs-sb-thumb-light), var(--rs-sb-thumb-dark));
  }
}

.rules-studio {
  font-family: var(--rs-sans);
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
.rules-studio, .rules-studio * { box-sizing: border-box; }
.rules-studio button, .rules-studio input, .rules-studio textarea, .rules-studio select { font: inherit; max-width: 100%; }
.rules-studio button { cursor: pointer; color: inherit; -webkit-tap-highlight-color: transparent; }
.rules-studio button:disabled { cursor: default; opacity: .42; }
.rules-studio :focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.rules-studio [hidden] { display: none !important; }
.rules-studio svg { display: block; flex: none; }
.rules-studio .sr-only { position: absolute; clip-path: inset(50%); width: 1px; height: 1px; overflow: hidden; white-space: nowrap; }

/* ---- Frame */
.rules-studio.app {
  width: 100%; height: calc(100dvh - 118px); min-height: 0; margin: 0; padding: 18px 24px 0;
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--bg); color: var(--ink); font-size: 14px; line-height: 1.5; text-align: left; isolation: isolate;
}
.wayon-rules-dialog .rules-studio.app { height: 100%; max-height: 100%; }
.rules-studio .topbar { flex: none; display: flex; align-items: center; gap: 14px; min-height: 40px; padding-bottom: 14px; }
.rules-studio .brand { font-size: 20px; font-weight: 700; letter-spacing: -.045em; line-height: 1; color: var(--ink); }
.rules-studio .page-title { margin: 0; padding-left: 14px; border-left: 1px solid var(--line-strong); font-size: 17px; font-weight: 600; letter-spacing: -.025em; color: var(--ink); }
.rules-studio .header-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.rules-studio .content { min-width: 0; }
.rules-studio > .content { flex: 1; min-height: 0; overflow: auto; }
.rules-studio .studio-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 256px minmax(0, 1fr); gap: 20px; }

/* ---- Roster */
.rules-studio .roster-pane { min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.rules-studio .search input {
  width: 100%; min-height: 38px; padding: 8px 14px; border: 0; border-radius: 999px;
  background: var(--surface); color: var(--ink);
  box-shadow: inset 0 1px 0 var(--card-rim), 0 1px 3px var(--shadow2), 0 0 0 .5px var(--line-strong);
  transition: box-shadow .18s ease, background-color .18s ease;
}
.rules-studio .search input:focus {
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--blue) 45%, transparent), 0 2px 10px var(--shadow1);
  outline: none;
}
.rules-studio .search input::placeholder { color: var(--muted); }
.rules-studio .filter-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rules-studio .chip {
  border: 0; background: var(--seg-track); color: var(--secondary);
  border-radius: 999px; padding: 5px 12px; min-height: 30px; font-size: 12px; font-weight: 500;
  white-space: nowrap; transition: background-color .16s ease, color .16s ease;
}
.rules-studio .chip:hover { color: var(--ink); background: var(--hover); }
.rules-studio .chip.active { background: var(--ink); color: var(--bg); font-weight: 600; }
.rules-studio .roster-count { font-size: 11.5px; color: var(--muted); padding: 0 4px; font-variant-numeric: tabular-nums; }
.rules-studio .roster-list {
  list-style: none; margin: 0; padding: 6px; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  background: var(--surface); border: 0; border-radius: 20px;
  box-shadow: inset 0 1px 0 var(--card-rim), 0 4px 20px -4px var(--shadow1), 0 1px 2px var(--shadow2), 0 0 0 .5px var(--card-ring);
  scrollbar-width: thin; scrollbar-color: var(--sb-thumb) transparent;
}
.rules-studio .roster-list .empty-state { padding: 24px 10px; }
.rules-studio .roster-item {
  width: 100%; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 7px 11px;
  border: 0; border-radius: 12px; background: transparent; text-align: left; color: var(--ink);
  transition: background-color .15s ease, color .15s ease;
}
.rules-studio .roster-item:hover { background: var(--hover); }
.rules-studio .roster-item.active { background: var(--blue-soft); color: var(--blue-ink); }
.rules-studio .roster-name { flex: 1; min-width: 0; font-size: 14px; font-weight: 550; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rules-studio .roster-meta { display: inline-flex; align-items: center; gap: 6px; flex: none; }
.rules-studio .roster-status { font-size: 11px; color: var(--muted); white-space: nowrap; }
.rules-studio .system-pill {
  display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 8px;
  background: var(--seg-track); color: var(--secondary); font-size: 10.5px; font-weight: 600;
  letter-spacing: .01em; white-space: nowrap; flex: none;
}
.rules-studio .roster-item.active .system-pill { background: color-mix(in oklab, var(--blue) 18%, transparent); color: var(--blue); }

/* ---- Detail */
.rules-studio .detail-pane {
  min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
  padding: 0 4px 24px 0; scrollbar-gutter: stable;
  scrollbar-width: thin; scrollbar-color: var(--sb-thumb) transparent;
}
.rules-studio .detail-head { display: flex; align-items: center; gap: 12px; margin: 2px 0 14px; min-height: 36px; }
.rules-studio .detail-title { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 650; letter-spacing: -.03em; line-height: 1.28; color: var(--ink); overflow-wrap: anywhere; }
.rules-studio .back-btn { display: none; border: 0; background: transparent; color: var(--blue); padding: 6px 0; min-height: 40px; font-size: 14px; font-weight: 500; white-space: nowrap; }
.rules-studio .rule-block {
  background: var(--surface); border: 0; border-radius: 20px; padding: 18px 20px 14px; margin-bottom: 16px;
  box-shadow: inset 0 1px 0 var(--card-rim), 0 4px 20px -4px var(--shadow1), 0 1px 2px var(--shadow2), 0 0 0 .5px var(--card-ring);
}
.rules-studio .block-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 8px; }
.rules-studio .block-head h3 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: -.02em; color: var(--ink); }
.rules-studio .block-sub { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
.rules-studio .task-group { padding-top: 8px; }
.rules-studio .group-caption { margin: 4px 0 4px; font-size: 11.5px; font-weight: 600; color: var(--muted); letter-spacing: .01em; }
.rules-studio .freq-group { margin-top: 10px; padding-top: 10px; border-top: .5px dashed var(--line-strong); }
.rules-studio .freq-group:first-of-type { border-top: 0; padding-top: 0; }
.rules-studio .freq-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.rules-studio .freq-summary { font-size: 12.5px; color: var(--secondary); font-weight: 550; }
.rules-studio .freq-summary .off { color: var(--orange); }
.rules-studio .freq-summary .on { color: var(--green); }
.rules-studio .link-btn { border: 0; background: transparent; color: var(--blue); font-size: 12.5px; font-weight: 500; padding: 4px 0; min-height: 28px; }
.rules-studio .link-btn:hover { color: var(--blue-hover); text-decoration: underline; text-underline-offset: 3px; }
.rules-studio .row-settings { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 12px; margin: 10px 0 8px; padding: 14px; border-radius: 14px; background: var(--well); }
.rules-studio .row-settings .wide { grid-column: 1 / -1; }

.rules-studio .task-row { display: flex; align-items: flex-start; gap: 12px; padding: 7px 0; border-bottom: .5px solid var(--line); }
.rules-studio .task-row:last-child { border-bottom: 0; }
.rules-studio .task-main { flex: 1; min-width: 0; }
.rules-studio .task-input {
  display: block; width: 100%; min-height: 34px; margin: 0; padding: 6px 10px; resize: none; overflow: hidden;
  border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--ink);
  font-size: 14px; line-height: 1.5; font-weight: 500; field-sizing: content;
  transition: background-color .15s ease, border-color .15s ease, box-shadow .15s ease;
}
.rules-studio .task-input:hover { background: var(--hover); }
.rules-studio .task-input:focus {
  background: var(--surface); border-color: var(--blue);
  box-shadow: 0 0 0 3px var(--blue-soft); outline: none;
}
.rules-studio .task-input::placeholder { color: var(--muted); font-weight: 400; }
.rules-studio .task-row.is-new .task-input { background: var(--well); border-color: color-mix(in oklab, var(--blue) 40%, transparent); }
.rules-studio .task-row.has-error .task-input { border-color: color-mix(in oklab, var(--red) 55%, transparent); background: var(--red-soft); }
.rules-studio .task-hint { padding: 2px 10px 3px; font-size: 12px; color: var(--muted); line-height: 1.5; }
.rules-studio .task-hint.warn { color: var(--red); font-weight: 500; }
.rules-studio .task-actions { display: flex; align-items: center; gap: 6px; flex: none; padding-top: 3px; }
.rules-studio .task-kind { font-size: 11px; font-weight: 550; color: var(--secondary); background: var(--seg-track); border-radius: 999px; padding: 3px 8px; }
.rules-studio .handler-select {
  min-height: 30px; max-width: 156px; padding: 3px 22px 3px 10px; border: 0; border-radius: 999px;
  background: var(--well); color: var(--secondary); font-size: 12px; font-weight: 600;
  box-shadow: 0 0 0 .5px var(--line-strong);
}
.rules-studio .handler-select.state-auto { color: var(--green); background: var(--green-soft); box-shadow: none; }
.rules-studio .handler-select.state-manual { color: var(--secondary); background: var(--seg-track); box-shadow: none; }
.rules-studio .handler-select.state-unknown, .rules-studio .handler-select.state-invalid { color: var(--red); background: var(--red-soft); box-shadow: none; }
.rules-studio .handler-fixed { font-size: 12px; font-weight: 600; color: var(--secondary); background: var(--seg-track); border-radius: 999px; padding: 5px 10px; white-space: nowrap; }
.rules-studio .icon-btn {
  border: 0; color: var(--secondary); border-radius: 999px; width: 32px; height: 32px; padding: 7px;
  display: inline-flex; align-items: center; justify-content: center; background: transparent;
  transition: background-color .16s ease, color .16s ease;
}
.rules-studio .icon-btn:hover { background: var(--hover); color: var(--blue); }
.rules-studio .icon-btn svg { width: 16px; height: 16px; }
.rules-studio .delete-btn:hover { color: var(--red); background: var(--red-soft); }
.rules-studio .empty-line { margin: 4px 0; padding: 6px 10px; font-size: 13px; color: var(--muted); }
.rules-studio .block-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 18px; padding: 8px 0 2px; }
.rules-studio .add-btn, .rules-studio .add-inline {
  border: 0; background: transparent; color: var(--blue); padding: 6px 2px; min-height: 32px;
  font-size: 13px; font-weight: 500; transition: color .15s ease;
}
.rules-studio .add-inline { font-size: 12px; padding: 4px 10px; min-height: 28px; }
.rules-studio .add-btn:hover, .rules-studio .add-inline:hover { color: var(--blue-hover); text-decoration: underline; text-underline-offset: 3px; }
.rules-studio .subject-picker { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rules-studio .subject-picker input {
  width: 156px; min-height: 32px; padding: 5px 11px; border: 0; border-radius: 999px;
  background: var(--well); color: var(--ink); box-shadow: 0 0 0 .5px var(--line-strong);
}
.rules-studio .special-note {
  display: flex; align-items: center; gap: 8px; margin: 6px 0; padding: 11px 14px;
  border: 0; border-radius: 13px; background: var(--orange-soft); color: var(--orange);
  font-size: 12.5px; line-height: 1.65;
}
.rules-studio .special-note > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }

/* ---- Published plan preview */
.rules-studio .plan-block .block-head .link-btn { flex: none; }
.rules-studio .plan-days { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 6px 0 4px; }
.rules-studio .plan-day { background: var(--well); border-radius: 14px; padding: 12px 14px; min-width: 0; }
.rules-studio .plan-day h4 { margin: 0 0 6px; font-size: 13px; font-weight: 650; color: var(--ink); }
.rules-studio .plan-visit + .plan-visit { margin-top: 8px; }
.rules-studio .plan-when { font-size: 12px; font-weight: 600; color: var(--secondary); font-variant-numeric: tabular-nums; }
.rules-studio .plan-source { font-weight: 400; color: var(--muted); }
.rules-studio .plan-visit ul { margin: 4px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.65; color: var(--ink); }
.rules-studio .plan-visit li { overflow-wrap: anywhere; white-space: pre-line; }
.rules-studio .plan-visit li .assign-state { margin-left: 8px; }
.rules-studio .plan-visit .muted { color: var(--muted); list-style: none; margin-left: -18px; }
.rules-studio .assign-state { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 2px 8px; white-space: nowrap; color: var(--secondary); background: var(--seg-track); }
.rules-studio .assign-state.state-sent { color: var(--green); background: var(--green-soft); }
.rules-studio .assign-state.state-waiting { color: var(--orange); background: var(--orange-soft); }
.rules-studio .assign-state.state-decision, .rules-studio .assign-state.state-check { color: var(--red); background: var(--red-soft); }
.rules-studio .plan-note { margin: 4px 0 8px; padding: 9px 12px; border-radius: 11px; background: var(--orange-soft); color: var(--orange); font-size: 12px; font-weight: 500; }
.rules-studio .plan-day .empty-line { padding: 2px 0; margin: 0; }

/* ---- Apple Segmented Control */
.rules-studio .view-seg {
  display: inline-flex; align-items: center; padding: 3px; gap: 2px; margin-left: 6px;
  background: var(--seg-track); border-radius: 999px;
  box-shadow: inset 0 .5px 1.5px var(--seg-inset), inset 0 -.5px 0 var(--seg-lip);
}
.rules-studio .view-seg button {
  border: 0; background: transparent; color: var(--secondary); font-size: 13px; font-weight: 500;
  letter-spacing: -.01em; padding: 5px 14px; min-height: 30px; border-radius: 999px; white-space: nowrap;
  transition: color .18s ease, background-color .18s ease, box-shadow .18s ease;
}
.rules-studio .view-seg button:hover { color: var(--ink); }
.rules-studio .view-seg button.active {
  background: var(--seg-thumb); color: var(--ink); font-weight: 600;
  box-shadow: inset 0 1px .5px var(--card-rim), 0 2px 6px -1px var(--seg-shadow);
}
.rules-studio .ov-card .rule-block { margin-bottom: 12px; }
.rules-studio .ov-card.is-current .rule-block {
  box-shadow: inset 0 1px 0 var(--card-rim), 0 0 0 2px var(--blue), 0 8px 24px -6px var(--shadow1);
}
.rules-studio .ov-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
.rules-studio .ov-open { border: 0; background: transparent; padding: 0; font-size: 16px; font-weight: 650; color: var(--ink); text-align: left; overflow-wrap: anywhere; transition: color .16s ease; }
.rules-studio .ov-open:hover { color: var(--blue); }
.rules-studio .ov-hidden { margin: 4px 2px 12px; font-size: 12px; color: var(--muted); }

/* ---- Apple iOS/macOS Capsule Switch */
.rules-studio .status-switch {
  display: inline-flex; align-items: center; gap: 9px; border: 0; background: transparent;
  padding: 4px 0; min-height: 34px; color: var(--green); font-size: 12.5px; font-weight: 600;
  white-space: nowrap; flex: none;
}
.rules-studio .switch-track {
  display: inline-flex; align-items: center; width: 42px; height: 24px; padding: 2px;
  background: var(--switch-on); border-radius: 999px; flex: none;
  box-shadow: inset 0 .5px 1.5px rgba(0, 0, 0, .14);
  transition: background-color .2s ease;
}
.rules-studio .switch-knob {
  display: block; width: 20px; height: 20px; border-radius: 50%; background: #FFFFFF;
  transform: translate3d(18px, 0, 0);
  box-shadow: 0 2px 5px rgba(0, 0, 0, .20), 0 .5px 1px rgba(0, 0, 0, .12);
}
@media (prefers-reduced-motion: no-preference) {
  .rules-studio .switch-knob {
    transition: transform .26s cubic-bezier(.32, .72, 0, 1);
    transition: transform .36s linear(0, .024 1%, .095 2.1%, .342 4.5%, .812 9.4%, .986 12.6%, 1.058 15.8%, 1.072 18.9%, 1.057 22.7%, 1.019 30.8%, 1.001 38.6%, .997 47.4%, 1.001 63.2%, 1);
  }
}
.rules-studio .status-switch.is-off { color: var(--muted); }
.rules-studio .status-switch.is-off .switch-track { background: var(--switch-off); }
.rules-studio .status-switch.is-off .switch-knob { transform: translate3d(0, 0, 0); }
.rules-studio .status-switch.is-mixed { color: var(--orange); }
.rules-studio .is-mixed .switch-track { background: var(--switch-mixed); }

/* ---- Shared controls */
.rules-studio .empty-state { padding: 44px 20px; text-align: center; color: var(--muted); font-size: 13.5px; }
.rules-studio .button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px;
  border: 0; border-radius: 999px; background: var(--surface); padding: 7px 16px;
  color: var(--ink); font-size: 13px; font-weight: 550; letter-spacing: -.01em; white-space: nowrap;
  box-shadow: inset 0 1px 0 var(--card-rim), 0 1px 3px var(--shadow2), 0 0 0 .5px var(--line-strong);
  transition: background-color .18s ease, color .18s ease, box-shadow .18s ease;
}
.rules-studio .button.small { min-height: 30px; padding: 4px 12px; font-size: 12px; }
.rules-studio .button:hover { background: var(--hover); }
.rules-studio .button.primary {
  background: var(--blue); color: #FFFFFF;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .24), 0 4px 12px -3px color-mix(in oklab, var(--blue) 42%, transparent);
}
.rules-studio .button.primary:hover { background: var(--blue-hover); }
.rules-studio .button.ghost { background: transparent; box-shadow: none; color: var(--secondary); }
.rules-studio .button.ghost:hover { background: var(--hover); color: var(--ink); }
.rules-studio .button.danger { color: var(--red); background: var(--red-soft); box-shadow: none; }
.rules-studio .button.danger:hover { filter: brightness(.95); }
@media (prefers-reduced-motion: no-preference) {
  .rules-studio .button:active:not(:disabled) { transform: scale(.97); }
}
.rules-studio .small-note { color: var(--muted); font-size: 11.5px; line-height: 1.6; margin: 0; }
.rules-studio .field { display: flex; flex-direction: column; min-width: 0; gap: 6px; color: var(--secondary); font-size: 12px; font-weight: 500; }
.rules-studio .field.full { grid-column: 1 / -1; }
.rules-studio .field input, .rules-studio .field select, .rules-studio .field textarea {
  width: 100%; min-width: 0; min-height: 38px; padding: 7px 11px; border: 0; border-radius: 11px;
  background: var(--surface); color: var(--ink); font-size: 13.5px;
  box-shadow: inset 0 1px 0 var(--card-rim), 0 0 0 .5px var(--line-strong);
  transition: box-shadow .18s ease;
}
.rules-studio .field textarea { min-height: 60px; line-height: 1.6; resize: vertical; }
.rules-studio .field input:focus, .rules-studio .field select:focus, .rules-studio .field textarea:focus {
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--blue) 48%, transparent); outline: none;
}
.rules-studio .weekday-picker { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; max-width: 420px; }
.rules-studio .weekday-picker button {
  min-height: 32px; border: 0; background: var(--surface); color: var(--secondary);
  border-radius: 999px; padding: 4px 0; font-size: 12px; font-weight: 500;
  box-shadow: 0 0 0 .5px var(--line-strong); transition: background-color .16s ease, color .16s ease;
}
.rules-studio .weekday-picker button.active {
  color: #FFFFFF; background: var(--blue); box-shadow: none; font-weight: 600;
}

/* ---- Footer & Dynamic Island Toast */
.rules-studio .footer {
  flex: none; display: flex; align-items: center; justify-content: space-between; gap: 16px;
  min-height: 64px; padding: 12px 0; margin-top: 4px; border-top: .5px solid var(--line); background: var(--bg);
}
.rules-studio .save-state { font-size: 12.5px; color: var(--muted); line-height: 1.55; min-width: 0; }
.rules-studio .save-state.dirty { color: var(--orange); font-weight: 600; }
.rules-studio .save-state.error { color: var(--red); font-weight: 550; }
.rules-studio .footer-actions { display: flex; align-items: center; gap: 8px; flex: none; }
.rules-studio .toast {
  position: fixed; z-index: 100; bottom: 88px; left: 50%; transform: translateX(-50%);
  max-width: calc(100% - 32px); padding: 10px 20px; color: #FFFFFF; border-radius: 999px;
  background: var(--island-bg); backdrop-filter: blur(24px) saturate(190%); -webkit-backdrop-filter: blur(24px) saturate(190%);
  box-shadow: inset 0 1px .5px rgba(255, 255, 255, .18), 0 16px 36px -10px rgba(0, 0, 0, .34);
  font-size: 13px; font-weight: 500; letter-spacing: -.01em;
}
.rules-studio .login-form {
  width: min(390px, 100%); margin: 36px auto; padding: 28px 26px; border-radius: 22px;
  background: var(--surface); display: flex; flex-direction: column; gap: 16px;
  box-shadow: inset 0 1px 0 var(--card-rim), 0 8px 28px -6px var(--shadow1), 0 0 0 .5px var(--card-ring);
}
.rules-studio .login-form h2 { font-size: 19px; font-weight: 650; letter-spacing: -.025em; margin: 0; color: var(--ink); }

/* ---- Drawer (diff, special arrangements, save errors) */
.rules-studio dialog.drawer-backdrop {
  position: fixed; inset: 0; width: 100vw; height: 100dvh; max-width: none; max-height: none;
  border: 0; padding: 0; margin: 0; background: transparent; overflow: hidden;
}
.rules-studio dialog.drawer-backdrop:not([open]) { display: none !important; }
.rules-studio dialog.drawer-backdrop[open] { display: flex; align-items: stretch; justify-content: flex-end; }
.rules-studio dialog.drawer-backdrop:modal { overscroll-behavior: contain; }
.rules-studio dialog.drawer-backdrop::backdrop {
  background: rgba(0, 0, 0, .36); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  overflow: hidden; overscroll-behavior: contain;
}
.rules-studio .drawer {
  width: min(520px, 100%); height: 100dvh; margin: 0;
  background: linear-gradient(168deg, var(--glass-top) 0%, var(--glass-bot) 100%);
  backdrop-filter: blur(36px) saturate(210%); -webkit-backdrop-filter: blur(36px) saturate(210%);
  color: var(--ink); display: flex; flex-direction: column; overflow: hidden;
  box-shadow: inset 1px 0 0 var(--card-rim), -16px 0 48px rgba(0, 0, 0, .20);
  text-align: left;
}
.rules-studio .drawer-head { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 24px 16px; border-bottom: .5px solid var(--line); }
.rules-studio .drawer-head h2 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: -.02em; color: var(--ink); }
.rules-studio .drawer-body { flex: 1; min-height: 0; overflow: auto; overflow-x: hidden; overscroll-behavior: contain; padding: 20px 24px; }
.rules-studio .drawer-foot { flex: none; display: flex; align-items: center; justify-content: flex-end; gap: 9px; padding: 16px 24px max(16px, env(safe-area-inset-bottom)); border-top: .5px solid var(--line); }
.rules-studio .drawer-foot .delete-task-button { margin-right: auto; }
.rules-studio .field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 14px; }
.rules-studio .editor-error { padding: 10px 14px; background: var(--red-soft); color: var(--red); border-radius: 11px; font-size: 13px; font-weight: 500; }
.rules-studio .diff-list { display: flex; flex-direction: column; gap: 12px; }
.rules-studio .diff-item {
  border: 0; border-radius: 16px; padding: 14px 16px; background: var(--surface);
  box-shadow: inset 0 1px 0 var(--card-rim), 0 2px 10px -2px var(--shadow1), 0 0 0 .5px var(--card-ring);
  font-size: 13px; line-height: 1.7; overflow-wrap: anywhere;
}
.rules-studio .diff-item h4 { margin: 0 0 4px; font-weight: 650; color: var(--ink); }
.rules-studio .diff-item ul { margin: 0; padding-left: 18px; }
.rules-studio .error-copy p { margin: 0 0 10px; color: var(--red); }

/* Host modal dialog shell: seamless Apple Liquid Glass framing in both light and dark modes. */
.wayon-rules-dialog:not([open]) { display: none !important; }
.wayon-rules-dialog[open] {
  position: fixed !important; inset: 0 !important; margin: auto !important; padding: 0 !important;
  display: flex !important; flex-direction: column !important;
  width: min(1440px, calc(100vw - 32px)) !important; max-width: calc(100vw - 32px) !important;
  height: 94dvh !important; max-height: 94dvh !important; overflow: hidden !important;
  border: 0 !important; border-radius: 26px !important;
  background: var(--bg) !important; color: var(--ink) !important;
  box-shadow: inset 0 1px .5px var(--card-rim), 0 32px 84px -16px rgba(0, 0, 0, .40), 0 0 0 .5px var(--line-strong) !important;
}
.wayon-rules-dialog:modal { overscroll-behavior: contain; }
.wayon-rules-dialog::backdrop {
  background: rgba(0, 0, 0, .38); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  overflow: hidden; overscroll-behavior: contain;
}

@supports not (scrollbar-color: auto) {
  .rules-studio .roster-list, .rules-studio .detail-pane { scrollbar-width: auto; }
  .rules-studio .roster-list::-webkit-scrollbar, .rules-studio .detail-pane::-webkit-scrollbar { width: 8px; height: 8px; }
  .rules-studio .roster-list::-webkit-scrollbar-thumb, .rules-studio .detail-pane::-webkit-scrollbar-thumb { background: var(--sb-thumb); border-radius: 999px; }
  .rules-studio .roster-list::-webkit-scrollbar-track, .rules-studio .detail-pane::-webkit-scrollbar-track { background: transparent; }
}

@media (forced-colors: active) {
  .rules-studio .rule-block,
  .rules-studio .roster-list,
  .rules-studio .diff-item,
  .wayon-rules-dialog[open] { border: 1px solid CanvasText !important; box-shadow: none !important; }
  .rules-studio .view-seg button.active,
  .rules-studio .chip.active,
  .rules-studio .roster-item.active { outline: 2px solid Highlight; }
}

@media (max-width: 1100px) {
  .rules-studio .row-settings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* Phone: usable, not dense. Roster first; a learner opens full width with a back button. */
@media (max-width: 760px) {
  .wayon-rules-dialog[open] { width: 100vw !important; max-width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important; border: 0 !important; border-radius: 0 !important; }
  .rules-studio.app { padding: 14px 16px 0; height: calc(100dvh - 84px); }
  .wayon-rules-dialog .rules-studio.app { height: 100%; }
  .rules-studio .topbar { gap: 10px; padding-bottom: 10px; flex-wrap: wrap; }
  .rules-studio .page-title { font-size: 16px; padding-left: 10px; }
  .rules-studio .view-seg { order: 3; margin-left: 0; width: 100%; }
  .rules-studio .view-seg button { flex: 1; min-height: 36px; padding: 5px 4px; }
  .rules-studio .studio-body { grid-template-columns: minmax(0, 1fr); }
  .rules-studio .studio-body.show-detail .roster-pane { display: none; }
  .rules-studio .studio-body:not(.show-detail) .detail-pane { display: none; }
  .rules-studio .back-btn { display: inline-flex; }
  .rules-studio .detail-head { flex-wrap: wrap; gap: 2px 10px; }
  .rules-studio .detail-title { font-size: 20px; }
  .rules-studio .search input { font-size: 16px; min-height: 44px; }
  .rules-studio .roster-item { min-height: 48px; }
  .rules-studio .rule-block { padding: 14px 14px 10px; border-radius: 18px; }
  .rules-studio .task-row { flex-direction: column; gap: 2px; }
  .rules-studio .task-input { font-size: 16px; }
  .rules-studio .task-actions { align-self: flex-end; padding-top: 0; }
  .rules-studio .icon-btn { width: 40px; height: 40px; padding: 10px; }
  .rules-studio .handler-select { min-height: 36px; }
  .rules-studio .row-settings { grid-template-columns: minmax(0, 1fr); }
  .rules-studio .plan-days { grid-template-columns: minmax(0, 1fr); }
  .rules-studio .footer { flex-wrap: wrap; gap: 8px; padding: 10px 0 max(10px, env(safe-area-inset-bottom)); }
  .rules-studio .footer-actions { width: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .rules-studio .footer-actions .button { padding: 8px 4px; }
  .rules-studio .field-grid { grid-template-columns: minmax(0, 1fr); }
  .rules-studio .drawer-head { padding-top: max(18px, env(safe-area-inset-top)); }
}
@media print {
  .rules-studio.app { height: auto; overflow: visible; padding: 0; background: white; color: black; }
  .rules-studio .footer, .rules-studio .roster-pane { display: none; }
}
`;
