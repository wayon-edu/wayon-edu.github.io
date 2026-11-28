/* Owner-only targeted make-up preview and deploy modal triggered via authenticated Supabase RPCs. */
(() => {
  if (globalThis.wayonTargetedDeployMounted || typeof document === 'undefined' || !document.body?.classList?.contains('wayon-workbench')) return;
  globalThis.wayonTargetedDeployMounted = true;

  const STYLE_ID = 'wayon-targeted-deploy-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .wayon-workbench #targeted-deploy-open[hidden]{display:none!important}
      .wayon-workbench .targeted-deploy-trigger{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:36px;height:36px;padding:0 11px;border:1px solid var(--line-strong,rgba(30,30,40,.18));border-radius:10px;background:var(--card,#fff);color:var(--fg-secondary,#515156);font:550 12.5px/1 var(--sans,inherit);white-space:nowrap;cursor:pointer;transition:border-color .15s ease,color .15s ease,background .15s ease}
      .wayon-workbench .targeted-deploy-trigger:hover:not(:disabled){color:var(--accent,#0071e3);border-color:var(--accent,#0071e3);background:var(--accent-subtle,#eaf3ff)}
      .wayon-workbench .targeted-deploy-trigger svg{width:15px;height:15px;flex:none;pointer-events:none}
      body.wayon-workbench[data-mode="classroom"] #targeted-deploy-open,
      body.wayon-workbench[data-aircon-open] #targeted-deploy-open,
      body.wayon-workbench[data-memo-open] #targeted-deploy-open,
      body.wayon-workbench[data-feedback-open] #targeted-deploy-open,
      body.wayon-workbench[data-mocks-open] #targeted-deploy-open,
      body.wayon-workbench[data-ledger-open] #targeted-deploy-open{display:none!important}
      dialog#wayon-targeted-dialog:not([open]){display:none}
      dialog#wayon-targeted-dialog[open]{display:flex;flex-direction:column;gap:14px;box-sizing:border-box;width:min(560px,calc(100vw - 28px));max-height:86vh;margin:auto;padding:22px;border:1px solid var(--line-strong,rgba(30,30,40,.18));border-radius:18px;background:var(--card,#fff);color:var(--fg,#1d1d1f);box-shadow:0 24px 80px rgba(0,0,0,.28);font:inherit;overflow:auto}
      dialog#wayon-targeted-dialog:modal{overscroll-behavior:contain}
      dialog#wayon-targeted-dialog::backdrop{background:rgba(0,0,0,.45);backdrop-filter:blur(6px);overflow:hidden;overscroll-behavior:contain}
      dialog#wayon-targeted-dialog .td-header{display:flex;align-items:center;justify-content:space-between;gap:12px}
      dialog#wayon-targeted-dialog h1{margin:0;font-size:20px;line-height:1.3;letter-spacing:-.02em;font-weight:650}
      dialog#wayon-targeted-dialog .td-close{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:10px;background:var(--code-bg,#f5f5f7);color:var(--muted,#6e6e73);font-size:20px;cursor:pointer}
      dialog#wayon-targeted-dialog .td-lead{margin:0;font-size:13px;line-height:1.6;color:var(--muted,#6e6e73)}
      dialog#wayon-targeted-dialog form{display:flex;flex-direction:column;gap:14px}
      dialog#wayon-targeted-dialog fieldset{margin:0;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--bg,#f5f5f7)}
      dialog#wayon-targeted-dialog legend{padding:0 6px;font-size:12px;font-weight:600;color:var(--fg-secondary,#515156)}
      dialog#wayon-targeted-dialog .td-checks{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:8px;max-height:200px;overflow:auto;padding-top:4px}
      dialog#wayon-targeted-dialog .td-choice{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--card,#fff)}
      dialog#wayon-targeted-dialog .td-choice input[type="checkbox"]{width:20px;height:20px;min-width:20px;min-height:20px;margin:0;accent-color:var(--accent,#0071e3);cursor:pointer}
      dialog#wayon-targeted-dialog .td-choice label{flex:1;min-width:0;font-size:14px;line-height:1.35;cursor:pointer;overflow-wrap:anywhere}
      dialog#wayon-targeted-dialog .td-field{display:flex;flex-direction:column;gap:6px}
      dialog#wayon-targeted-dialog .td-field label{font-size:12.5px;font-weight:600;color:var(--fg-secondary,#515156)}
      dialog#wayon-targeted-dialog .td-hint{font-size:12px;color:var(--muted,#6e6e73);margin:0}
      dialog#wayon-targeted-dialog input[type="text"]{font:inherit;font-size:max(1rem,1em);min-height:48px;padding:10px 12px;border:1px solid var(--line-strong,#767676);border-radius:10px;background:var(--card,#fff);color:var(--fg,#1d1d1f);width:100%;box-sizing:border-box}
      dialog#wayon-targeted-dialog input[aria-invalid="true"]{border-color:var(--bad,#d93025)}
      dialog#wayon-targeted-dialog .td-error{min-height:20px;margin:0;font-size:12.5px;color:var(--bad,#d93025)}
      dialog#wayon-targeted-dialog .td-error.is-empty{visibility:hidden}
      dialog#wayon-targeted-dialog .td-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
      dialog#wayon-targeted-dialog .td-btn{min-height:48px;padding:0 16px;border-radius:10px;border:1px solid var(--line-strong);background:var(--card,#fff);color:var(--fg,#1d1d1f);font:550 14px/1.2 var(--sans,inherit);cursor:pointer}
      dialog#wayon-targeted-dialog .td-btn.primary{background:var(--accent,#0071e3);border-color:var(--accent,#0071e3);color:#fff}
      dialog#wayon-targeted-dialog .td-btn.danger{background:var(--bad,#d93025);border-color:var(--bad,#d93025);color:#fff}
      dialog#wayon-targeted-dialog .td-confirm{min-height:92px;padding:12px 14px;border:1px solid var(--warning-fg,#9a6700);border-radius:12px;background:var(--warning-bg,#fff8e8);color:var(--fg,#1d1d1f);display:flex;flex-direction:column;gap:10px}
      dialog#wayon-targeted-dialog .td-confirm[hidden]{display:flex;visibility:hidden;pointer-events:none;border-color:transparent;background:transparent}
      dialog#wayon-targeted-dialog .td-confirm-text{margin:0;font-size:13px;line-height:1.5;font-weight:500}
      dialog#wayon-targeted-dialog .td-confirm-row{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
      dialog#wayon-targeted-dialog .td-status{margin:0;font-size:13px;line-height:1.55;color:var(--fg-secondary,#515156)}
      dialog#wayon-targeted-dialog progress{width:100%;height:8px}
      dialog#wayon-targeted-dialog pre#wayon-targeted-result{margin:0;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--code-bg,#f5f5f7);color:var(--fg,#1d1d1f);font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto}
      @media(pointer:coarse){dialog#wayon-targeted-dialog input[type="text"],dialog#wayon-targeted-dialog .td-btn{min-height:52px}}
      @media(max-width:599px){.wayon-workbench .targeted-deploy-trigger{height:44px;padding:0 12px}}
    `;
    (document.head || document.documentElement).append(style);
  }

  const targetIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.id = 'targeted-deploy-open';
  openBtn.className = 'targeted-deploy-trigger';
  openBtn.hidden = true;
  openBtn.title = '管理员专属：指定学员只读预演 (~30秒) 或正式补布置';
  openBtn.setAttribute('aria-label', '打开指定学员定向补布置');
  openBtn.innerHTML = targetIcon + '<span>定向补发</span>';

  const dialog = document.createElement('dialog');
  dialog.id = 'wayon-targeted-dialog';
  dialog.setAttribute('closedby', 'any');
  dialog.setAttribute('aria-labelledby', 'wayon-targeted-title');

  const header = document.createElement('div');
  header.className = 'td-header';
  const title = document.createElement('h1');
  title.id = 'wayon-targeted-title';
  title.textContent = '定向补布置（仅处理所选学员）';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'td-close';
  closeBtn.setAttribute('aria-label', '关闭定向补布置');
  closeBtn.textContent = '×';
  closeBtn.onclick = () => dialog.close();
  header.append(title, closeBtn);

  const lead = document.createElement('p');
  lead.className = 'td-lead';
  lead.textContent = '仅对勾选或输入的学员执行计划校验与补布置，不触碰其余学员，不重发早报；建议先「只读预演」。';

  const form = document.createElement('form');
  form.id = 'wayon-targeted-form';
  form.setAttribute('novalidate', '');
  form.onsubmit = event => event.preventDefault();

  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = '选择今日在计划内的学员';
  const checksBox = document.createElement('div');
  checksBox.className = 'td-checks';
  checksBox.id = 'wayon-targeted-choices';
  fieldset.append(legend, checksBox);

  const field = document.createElement('div');
  field.className = 'td-field';
  const extraLabel = document.createElement('label');
  extraLabel.setAttribute('for', 'wayon-targeted-extra');
  extraLabel.textContent = '或手动输入学员姓名（逗号分隔，须与工作台姓名一致）';
  const extraHint = document.createElement('p');
  extraHint.id = 'wayon-targeted-extra-hint';
  extraHint.className = 'td-hint';
  extraHint.textContent = '例：Leo, Iven（不能填 all）';
  const extraInput = document.createElement('input');
  extraInput.type = 'text';
  extraInput.id = 'wayon-targeted-extra';
  extraInput.name = 'extra_students';
  extraInput.setAttribute('autocomplete', 'off');
  extraInput.setAttribute('autocorrect', 'off');
  extraInput.setAttribute('autocapitalize', 'none');
  extraInput.setAttribute('spellcheck', 'false');
  extraInput.setAttribute('enterkeyhint', 'done');
  extraInput.setAttribute('aria-describedby', 'wayon-targeted-extra-hint wayon-targeted-error');
  field.append(extraLabel, extraHint, extraInput);

  const errMsg = document.createElement('p');
  errMsg.id = 'wayon-targeted-error';
  errMsg.className = 'td-error is-empty';
  errMsg.setAttribute('role', 'status');
  errMsg.setAttribute('aria-live', 'polite');

  const actions = document.createElement('div');
  actions.className = 'td-actions';
  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.id = 'wayon-targeted-preview';
  previewBtn.className = 'td-btn primary';
  previewBtn.textContent = '🔍 只读预演 (~30秒)';
  const deployBtn = document.createElement('button');
  deployBtn.type = 'button';
  deployBtn.id = 'wayon-targeted-deploy';
  deployBtn.className = 'td-btn';
  deployBtn.textContent = '🚀 正式补布置';
  actions.append(previewBtn, deployBtn);

  const confirmBox = document.createElement('div');
  confirmBox.id = 'wayon-targeted-confirm';
  confirmBox.className = 'td-confirm';
  confirmBox.hidden = true;
  const confirmText = document.createElement('p');
  confirmText.id = 'wayon-targeted-confirm-text';
  confirmText.className = 'td-confirm-text';
  const confirmRow = document.createElement('div');
  confirmRow.className = 'td-confirm-row';
  const confirmGo = document.createElement('button');
  confirmGo.type = 'button';
  confirmGo.id = 'wayon-targeted-confirm-go';
  confirmGo.className = 'td-btn danger';
  confirmGo.textContent = '确认正式下发';
  const confirmCancel = document.createElement('button');
  confirmCancel.type = 'button';
  confirmCancel.id = 'wayon-targeted-confirm-cancel';
  confirmCancel.className = 'td-btn';
  confirmCancel.textContent = '取消';
  confirmRow.append(confirmGo, confirmCancel);
  confirmBox.append(confirmText, confirmRow);

  form.append(fieldset, field, errMsg, actions, confirmBox);

  const progress = document.createElement('progress');
  progress.id = 'wayon-targeted-progress';
  progress.hidden = true;
  const statusEl = document.createElement('p');
  statusEl.id = 'wayon-targeted-status';
  statusEl.className = 'td-status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  const resultPre = document.createElement('pre');
  resultPre.id = 'wayon-targeted-result';
  resultPre.hidden = true;

  dialog.append(header, lead, form, progress, statusEl, resultPre);
  document.body.append(dialog);

  // Fallback light-dismiss only for browsers lacking <dialog closedby>.
  if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
    const outside = event => {
      const r = dialog.getBoundingClientRect();
      return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
    };
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', event => { pressedOutside = outside(event); });
    dialog.addEventListener('pointerup', event => { if (pressedOutside && outside(event)) dialog.close(); });
  }
  dialog.addEventListener('close', () => {
    dialog.returnValue = '';
    confirmBox.hidden = true;
  });

  const cleanStudentLabel = raw => {
    const shown = globalThis.wayonDisplayName?.(raw);
    const val = typeof shown === 'string' && shown.trim() ? shown.trim() : String(raw || '').replace(/[【】「」\[\]]/g, '').trim();
    return val;
  };

  const todayStr = () => {
    try { return new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Shanghai'}); }
    catch { return ''; }
  };

  const collectRoster = () => {
    const names = [];
    const seen = new Set();
    const pushName = raw => {
      const n = cleanStudentLabel(raw);
      if (!n || /[&＆/／、]/.test(n) || seen.has(n)) return;
      seen.add(n);
      names.push(n);
    };
    const data = typeof DATA !== 'undefined' ? DATA : globalThis.DATA;
    const day = (typeof today === 'string' && today) || (typeof globalThis.today === 'string' && globalThis.today) || todayStr();
    const planRows = data?._plan?.[day] || data?.[day] || [];
    for (const row of Array.isArray(planRows) ? planRows : []) {
      if (Array.isArray(row) && typeof row[0] === 'string') {
        for (const part of row[0].split(/[&＆/／、]/)) pushName(part);
      }
    }
    const assigned = data?._assigned?.[day]?.students || [];
    for (const st of Array.isArray(assigned) ? assigned : []) {
      if (st && typeof st.name === 'string') pushName(st.name);
    }
    return names;
  };

  const populateChoices = () => {
    const prev = new Set(
      [...checksBox.querySelectorAll('input[type="checkbox"]:checked')].map(el => el.value)
    );
    checksBox.replaceChildren();
    const roster = collectRoster();
    if (!roster.length) {
      const empty = document.createElement('p');
      empty.className = 'td-hint';
      empty.textContent = '今日计划列表暂无单人选项，请在下方手动输入学员姓名。';
      checksBox.append(empty);
      return;
    }
    roster.forEach((name, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'td-choice';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'wayon-td-stu-' + idx;
      cb.name = 'student_choice';
      cb.value = name;
      cb.checked = prev.has(name);
      cb.addEventListener('change', clearValidation);
      const lbl = document.createElement('label');
      lbl.setAttribute('for', cb.id);
      lbl.textContent = name;
      wrap.append(cb, lbl);
      checksBox.append(wrap);
    });
  };

  function clearValidation() {
    extraInput.removeAttribute('aria-invalid');
    errMsg.textContent = '';
    errMsg.classList.add('is-empty');
  }

  function showValidation(msg, focusTarget) {
    extraInput.setAttribute('aria-invalid', 'true');
    errMsg.textContent = msg;
    errMsg.classList.remove('is-empty');
    if (focusTarget?.focus) focusTarget.focus();
  }

  extraInput.addEventListener('input', () => {
    clearValidation();
    confirmBox.hidden = true;
  });

  const selectedStudents = () => {
    const chosen = [...checksBox.querySelectorAll('input[type="checkbox"]:checked')].map(el => el.value);
    const manual = String(extraInput.value || '')
      .split(/[,，;；\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
    return [...new Set([...chosen, ...manual])];
  };

  const client = () => globalThis.wayonSupabaseClient?.client || null;
  let running = false;
  let activeRequestId = null;

  const setRunning = busy => {
    running = busy;
    previewBtn.disabled = busy;
    deployBtn.disabled = busy;
    confirmGo.disabled = busy;
    progress.hidden = !busy;
  };

  const renderRequestState = req => {
    if (!req) return;
    const modeLabel = req.dry_run ? '只读预演' : '正式补布置';
    const stateMap = {
      requested: `已发送${modeLabel}请求，等待 GitHub Actions 启动（目标：${req.students}）…`,
      running: `GitHub Actions 正在执行${modeLabel}（目标：${req.students}）…`,
      succeeded: `✅ ${modeLabel}完成（目标：${req.students}）`,
      failed: `⚠️ ${modeLabel}未全部通过（目标：${req.students}）`,
      dispatch_failed: `❌ 未能启动 GitHub Actions（${req.error_code || 'DISPATCH_DENIED'}）`,
    };
    statusEl.textContent = stateMap[req.state] || `状态：${req.state}`;
    if (typeof req.summary_md === 'string' && req.summary_md.trim()) {
      resultPre.textContent = req.summary_md.trim();
      resultPre.hidden = false;
    } else {
      resultPre.hidden = true;
      resultPre.textContent = '';
    }
  };

  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function pollRequest(requestId, wasRealDeploy) {
    const c = client();
    if (!c) return;
    const deadline = Date.now() + 8 * 60 * 1000;
    while (Date.now() < deadline) {
      const {data, error} = await c.rpc('wayon_targeted_deploy_status', {p_request: requestId});
      if (error) throw error;
      const req = data?.request;
      if (req) {
        renderRequestState(req);
        if (['succeeded', 'failed', 'dispatch_failed'].includes(req.state)) {
          if (req.state === 'succeeded' && wasRealDeploy) {
            try { globalThis.wayonRefreshAPI?.reloadPublished?.(); } catch {}
            window.dispatchEvent(new Event('wayon-refresh-published'));
          }
          return;
        }
      }
      await pause(document.visibilityState === 'hidden' ? 8000 : 3500);
    }
    statusEl.textContent = '后台仍在运行中；可稍后在 GitHub Actions 或重新打开此窗口查看结果。';
  }

  async function submitTargeted(dryRun) {
    if (running) return;
    const names = selectedStudents();
    if (!names.length) {
      const firstCb = checksBox.querySelector('input[type="checkbox"]');
      showValidation('请至少勾选或输入 1 位学员姓名。', firstCb || extraInput);
      return;
    }
    if (names.some(n => n.toLowerCase() === 'all')) {
      showValidation('此处仅用于指定学员补发，不能填 all。', extraInput);
      return;
    }
    const c = client();
    if (!c) {
      showValidation('云端连接尚未就绪，请先登录管理员账号。', closeBtn);
      return;
    }
    confirmBox.hidden = true;
    clearValidation();
    setRunning(true);
    resultPre.hidden = true;
    resultPre.textContent = '';
    statusEl.textContent = dryRun ? '正在提交只读预演请求…' : '正在提交正式补布置请求…';
    const reqId = (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || undefined;
    try {
      const {data, error} = await c.rpc('wayon_request_targeted_deploy', {
        p_students: names.join(', '),
        p_dry_run: Boolean(dryRun),
        p_request: reqId || null,
      });
      if (error) {
        statusEl.textContent = '提交失败：' + (error.message || '请确认已执行最新数据库迁移与管理员权限');
        return;
      }
      if (data?.busy) {
        activeRequestId = data.request_id || null;
        statusEl.textContent = `已有定向任务正在运行（${data.students || ''}），正在同步其进度…`;
        if (activeRequestId) await pollRequest(activeRequestId, !data.dry_run);
        return;
      }
      if (data?.cooldown) {
        statusEl.textContent = '刚刚完成一次请求，请间隔 15 秒后再试。';
        return;
      }
      activeRequestId = data?.request_id || reqId || null;
      if (!activeRequestId) {
        statusEl.textContent = '未取得请求编号，请查看 GitHub Actions。';
        return;
      }
      renderRequestState({state: data?.state || 'requested', students: names.join(', '), dry_run: Boolean(dryRun)});
      await pollRequest(activeRequestId, !dryRun);
    } catch (err) {
      statusEl.textContent = '状态查询中断：' + (err?.message || '请稍后重试');
    } finally {
      setRunning(false);
    }
  }

  previewBtn.onclick = () => {
    confirmBox.hidden = true;
    void submitTargeted(true);
  };
  deployBtn.onclick = () => {
    const names = selectedStudents();
    if (!names.length) {
      const firstCb = checksBox.querySelector('input[type="checkbox"]');
      showValidation('请至少勾选或输入 1 位学员姓名。', firstCb || extraInput);
      return;
    }
    if (names.some(n => n.toLowerCase() === 'all')) {
      showValidation('此处仅用于指定学员补发，不能填 all。', extraInput);
      return;
    }
    clearValidation();
    confirmText.textContent = `确认仅对「${names.join('、')}」执行正式补布置？仍受门禁与防重校验，不触碰其余学员。`;
    confirmBox.hidden = false;
    confirmCancel.focus();
  };
  confirmCancel.onclick = () => {
    confirmBox.hidden = true;
    deployBtn.focus();
  };
  confirmGo.onclick = () => void submitTargeted(false);

  openBtn.onclick = async () => {
    populateChoices();
    clearValidation();
    confirmBox.hidden = true;
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    const firstCb = checksBox.querySelector('input[type="checkbox"]');
    if (firstCb?.focus) firstCb.focus();
    else extraInput.focus();
    try {
      const c = client();
      if (c && !running) {
        const {data} = await c.rpc('wayon_targeted_deploy_status', {p_request: activeRequestId});
        if (data?.request) renderRequestState(data.request);
      }
    } catch {}
  };

  let ownerCheckSeq = 0;
  async function syncOwnerVisibility() {
    const seq = ++ownerCheckSeq;
    const c = client();
    if (!c || globalThis.wayonRefreshAPI?.enabled !== true) {
      openBtn.hidden = true;
      return;
    }
    try {
      const {data: sess} = await c.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid || seq !== ownerCheckSeq) { openBtn.hidden = true; return; }
      const {data: owners, error: ownErr} = await c.from('wayon_owner').select('user_id');
      if (seq !== ownerCheckSeq) return;
      if (ownErr || !Array.isArray(owners) || owners.length !== 1 || owners[0].user_id !== uid) {
        openBtn.hidden = true;
        return;
      }
      const {data: st, error: stErr} = await c.rpc('wayon_targeted_deploy_status', {p_request: null});
      if (seq !== ownerCheckSeq) return;
      if (stErr || st?.enabled !== true) {
        openBtn.hidden = true;
        return;
      }
      openBtn.hidden = false;
    } catch {
      if (seq === ownerCheckSeq) openBtn.hidden = true;
    }
  }

  const mountButton = () => {
    const tools = document.getElementById('workflow-tools');
    if (tools && openBtn.parentNode !== tools) {
      tools.prepend(openBtn);
    }
  };
  new MutationObserver(mountButton).observe(document.body, {childList: true, subtree: true});
  mountButton();
  window.addEventListener('wayon-refresh-ready', () => { void syncOwnerVisibility(); });
  void syncOwnerVisibility();
})();
