/* Optional tools for roadmap F51–F60. The rules live in js/lib/expand.js. */
import {
  parseSyllabus, applyRowEdit, canConfirm, importConfirmed, assignmentFromRow,
  parseLms, mergeLms, lmsStatus, disconnectLms,
  parseMicrosoftIcs, mergeMicrosoft, CONNECTOR_BOUNDARIES,
  takeover, handoffView, sharedPayload, revokeMember,
  trustPreview, trustReadable, suggestFrom, decideSuggestion, undoSuggestion,
  resetSuggestion, trialOutcome, translate, coverage, localeOf, domainNote,
  recoveryCopy, PASSKEYS_OFFERED
} from './lib/expand.js?v=4.45.0';

export function mountExpand(api) {
  let bring = false;
  let tab = 'syllabus';
  let rows = [];
  let tz = '';
  let bound = false;
  let trustOpened = false;
  let trustText = '';
  let booted = false;
  let activeDesk = null;
  const esc = api.esc;
  const S = () => api.getS();

  function lang() {
    const settings = S().settings || {};
    return settings.lang || 'en';
  }
  function tr(key) { return translate(lang(), key).text; }
  function zone() {
    if (tz) return tz;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch (e) { tz = 'UTC'; }
    return tz;
  }
  function ensure() {
    const state = S();
    if (!state.settings) state.settings = {};
    if (!state.settings.lang) state.settings.lang = 'en';
    if (!state.connectors || typeof state.connectors !== 'object') state.connectors = {};
    if (!state.connectors.lms) state.connectors.lms = { on: false, mode: 'read', provider: '', lastSync: 0, lastError: '', count: 0 };
    if (!state.connectors.microsoft) state.connectors.microsoft = { on: false, mode: 'read', lastSync: 0, lastError: '', count: 0 };
    if (!Array.isArray(state.deskLinks)) state.deskLinks = [];
    if (!Array.isArray(state.assignments)) state.assignments = [];
    if (!Array.isArray(state.notes)) state.notes = [];
    if (!Array.isArray(state.events)) state.events = [];
    return state;
  }
  function focused(id) {
    const node = api.$(id);
    return !!(node && node.contains(document.activeElement));
  }
  function applyLanguage() {
    const loc = localeOf(lang());
    document.documentElement.lang = loc.id;
    document.documentElement.dir = loc.dir;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = translate(lang(), el.getAttribute('data-i18n')).text;
    });
  }
  function cloudOrTell() {
    const cloud = api.cloud && api.cloud();
    if (cloud) return cloud;
    api.toast('This needs a sign-in. Nothing was shared.');
    return null;
  }
  function rulesToast(err) {
    const code = String((err && (err.code || err.message)) || '');
    api.toast(/permission|insufficient/i.test(code)
      ? 'The desk or summary refused that. It may be revoked, or firebase/firestore.rules are not published yet.'
      : 'That did not save. Nothing else was changed.');
  }

  function readRows() {
    const panel = api.$('#bringPanel');
    if (!panel) return;
    const tzInput = api.$('#sylTz');
    if (tzInput && tzInput.value) tz = tzInput.value.trim() || tz;
    panel.querySelectorAll('[data-row]').forEach(node => {
      const row = rows.find(item => item.id === node.getAttribute('data-row'));
      if (!row) return;
      const date = node.querySelector('[data-date]');
      const title = node.querySelector('[data-title]');
      const checked = node.querySelector('[data-check]');
      Object.assign(row, applyRowEdit(row, {
        date: date ? date.value : row.date,
        title: title ? title.value : row.title,
        confirmed: checked ? checked.checked : false,
        tz: zone()
      }));
    });
  }

  function syllabusHtml() {
    const list = rows.map(row => {
      const check = row.confirmed && canConfirm(row);
      return `<div class="cw-check" data-row="${esc(row.id)}">
        <label class="cw-check"><input type="checkbox" data-check ${check ? 'checked' : ''}> Include</label>
        <span>
          <input type="text" data-title value="${esc(row.title)}" aria-label="Title">
          ${row.kind === 'deadline' ? `<input type="date" data-date value="${esc(row.date)}" aria-label="Date">` : ''}
          <small class="cw-note">${esc(row.reason || row.kind)} · ${esc(row.tz)}</small>
          <small class="cw-note" dir="auto">${esc(row.source)}</small>
        </span>
      </div>`;
    }).join('');
    return `<p class="cw-note">${esc(tr('bring.lead'))}</p>
      <label class="field"><span>${esc(tr('syl.tz'))}</span><input id="sylTz" type="text" value="${esc(zone())}" autocomplete="off"></label>
      <label class="field"><span>Syllabus text</span><textarea id="sylText" rows="6" dir="auto" placeholder="Paste the syllabus. Dates stay here until you check them."></textarea></label>
      <button type="button" class="btn" id="sylParse">Find dates</button>
      ${rows.length ? `<div class="stack">${list}</div><button type="button" class="btn primary" id="sylImport">${esc(tr('syl.import'))}</button>` : `<p class="cw-note" id="sylEmpty" hidden></p>`}`;
  }

  function lmsHtml() {
    const state = ensure();
    const status = lmsStatus(state.connectors.lms, Date.now());
    return `<p class="cw-note">${esc(tr('lms.lead'))}</p>
      <p class="cw-note" role="status">${esc(status.line)}</p>
      <label class="field"><span>File</span><select id="lmsProvider"><option value="canvas-snapshot">Canvas file</option><option value="moodle-snapshot">Moodle file</option></select></label>
      <label class="field"><span>Export</span><textarea id="lmsText" rows="6" dir="auto" placeholder="CSV with id, title, due — or a JSON list"></textarea></label>
      <div class="stack" style="flex-direction:row;flex-wrap:wrap;gap:8px">
        <button type="button" class="btn primary" id="lmsGo">Import</button>
        <button type="button" class="btn" id="lmsOff">Disconnect</button>
      </div>`;
  }

  function deskHtml() {
    const state = ensure();
    if (activeDesk) {
      const data = activeDesk.data || {};
      const editable = activeDesk.owner || activeDesk.role === 'editor';
      const tasks = safeDeskRows(data.tasksJson).map(item => `<label class="field"><span>${esc(item.title || 'Assignment')}${item.due ? ` · ${esc(item.due)}` : ''}</span>${editable
        ? `<textarea rows="2" data-shared-task="${esc(item.id)}" maxlength="500">${esc(item.title || '')}</textarea>`
        : `<p class="cw-note">${esc(item.title || '')}</p>`}</label>`).join('');
      const notes = safeDeskRows(data.notesJson).map(item => `<label class="field"><span>Shared note</span>${editable
        ? `<textarea rows="3" data-shared-note="${esc(item.id)}" maxlength="500">${esc(item.text || '')}</textarea>`
        : `<p class="cw-note">${esc(item.text || '')}</p>`}</label>`).join('');
      const uid = (api.cloud() || {}).uid;
      const members = (activeDesk.members || []).filter(item => item.id !== uid).map(item =>
        `<li>${esc(item.name || 'Student')} · ${esc(item.role || 'viewer')} ${activeDesk.owner
          ? `<button type="button" class="btn sm" data-role-user="${esc(item.id)}" data-role-value="${item.role === 'editor' ? 'viewer' : 'editor'}">Make ${item.role === 'editor' ? 'viewer' : 'editor'}</button> <button type="button" class="btn sm" data-member-revoke="${esc(item.id)}">Remove</button>` : ''}</li>`).join('');
      return `<p class="cw-note">${esc(data.title || activeDesk.code)} · ${activeDesk.owner ? 'Owner' : esc(activeDesk.role || 'viewer')}. Shared assignments and notes only.</p>
        <button type="button" class="btn sm" id="deskBack">Back to shared desks</button>
        ${tasks || '<p class="cw-note">No assignments were shared.</p>'}${notes || '<p class="cw-note">No notes were shared.</p>'}
        ${editable ? '<button type="button" class="btn primary" id="deskSave">Save shared desk</button>' : '<p class="cw-note">View only. Ask the owner to allow edits.</p>'}
        ${activeDesk.owner ? `<h3>People with access</h3><ul class="stack">${members || '<li>No members yet.</li>'}</ul>` : ''}`;
    }
    const tasks = state.assignments.slice(0, 12).map(item =>
      `<label class="cw-check"><input type="checkbox" data-share="${esc(item.id)}">${esc(item.title || 'Assignment')}</label>`).join('');
    const notes = state.notes.slice(0, 8).map(item =>
      `<label class="cw-check"><input type="checkbox" data-share="${esc(item.id)}">${esc((item.text || '').slice(0, 80) || 'Note')}</label>`).join('');
    const links = state.deskLinks.map(item =>
      `<li>${esc(item.title || item.code)} · ${esc(item.role || 'member')} · <button type="button" class="btn sm" data-open-desk="${esc(item.code)}">Open</button></li>`).join('');
    return `<p class="cw-note">${esc(tr('desk.private'))}</p>
      <div class="stack">${tasks || '<p class="cw-note">No assignments yet.</p>'}${notes}</div>
      <button type="button" class="btn primary" id="deskMake">Share the ticked lines</button>
      <label class="field"><span>Join with a code</span><input id="deskCode" type="text" autocomplete="off" spellcheck="false"></label>
      <button type="button" class="btn" id="deskJoin">Join</button>
      ${links ? `<ul class="stack">${links}</ul>` : ''}`;
  }

  function safeDeskRows(value) {
    try {
      const rows = JSON.parse(String(value || '[]'));
      return Array.isArray(rows) ? rows.filter(item => item && typeof item === 'object').slice(0, 40) : [];
    } catch (e) { return []; }
  }

  function renderBring(force) {
    const panel = api.$('#bringPanel');
    const button = api.$('#bringBtn');
    if (button) button.setAttribute('aria-pressed', bring ? 'true' : 'false');
    if (!panel) return;
    panel.hidden = !bring;
    if (!bring) return;
    if (!force && focused('#bringPanel')) return;
    readRows();
    const body = tab === 'lms' ? lmsHtml() : tab === 'desk' ? deskHtml() : syllabusHtml();
    panel.innerHTML = `<div class="stack" style="flex-direction:row;flex-wrap:wrap;gap:8px">
        <button type="button" class="btn ${tab === 'syllabus' ? 'primary' : ''}" data-bring="syllabus">Syllabus</button>
        <button type="button" class="btn ${tab === 'lms' ? 'primary' : ''}" data-bring="lms">Assignments</button>
        <button type="button" class="btn ${tab === 'desk' ? 'primary' : ''}" data-bring="desk">Shared desk</button>
      </div>${body}`;
  }

  function renderHandoff() {
    const card = api.$('#handoffCard');
    if (!card) return;
    const view = handoffView(ensure().handoff, api.deviceId());
    card.hidden = !view.show;
    if (!view.show) { card.innerHTML = ''; return; }
    if (card.querySelector('#handoffTake')) return;
    card.innerHTML = `<p class="cw-note">${esc(view.line)}</p><button type="button" class="btn" id="handoffTake">${esc(tr('handoff.take'))}</button>`;
    api.$('#handoffTake').onclick = () => {
      const taken = takeover(ensure().handoff, api.deviceId(), Date.now());
      if (!taken.ok) { api.toast(taken.line); return; }
      ensure().handoff = taken.handoff;
      if (api.applyHandoffTimer) api.applyHandoffTimer(taken.timer);
      api.save();
      api.toast(taken.line);
      card.innerHTML = '';
      card.hidden = true;
    };
  }

  function renderYou(force) {
    const card = api.$('#expandYou');
    if (!card) return;
    if (!force && focused('#expandYou')) return;
    const state = ensure();
    const idea = suggestFrom({
      sessions: state.sessions || [],
      settings: state.settings,
      openReviews: (state.assignments || []).filter(item => item && !item.done).length
    }, Date.now());
    const outcome = trialOutcome(state.sessions || [], state.trial, Date.now());
    const note = coverage(lang()).note;
    const options = ['en', 'fa', 'es'].map(id => {
      const loc = localeOf(id);
      return `<option value="${id}" ${lang() === id ? 'selected' : ''}>${esc(loc.label)}</option>`;
    }).join('');
    const reason = idea.ok
      ? idea.timer.reason + (idea.review ? ' ' + idea.review.reason : '') + ' ' + idea.cards.reason
      : idea.reason;
    card.innerHTML = `<h3>${esc(tr('you.lang'))}</h3>
      <label class="field"><span class="sr-only">${esc(tr('you.lang'))}</span><select id="langPick">${options}</select></label>
      ${note ? `<p class="cw-note">${esc(note)}</p>` : ''}
      <h3>A suggestion from your own sessions</h3>
      <p class="cw-note">${esc(reason)}</p>
      <div class="stack" style="flex-direction:row;flex-wrap:wrap;gap:8px">
        <button type="button" class="btn primary" id="tryAccept" ${idea.ok ? '' : 'disabled'}>${esc(tr('you.accept'))}</button>
        <button type="button" class="btn" id="tryDecline">${esc(tr('you.decline'))}</button>
        <button type="button" class="btn" id="tryUndo" ${state.trial && !state.trial.undone ? '' : 'disabled'}>${esc(tr('you.undo'))}</button>
        <button type="button" class="btn" id="tryReset">Reset</button>
      </div>
      <p class="cw-note">${esc(outcome.line)}</p>
      <h3>Trusted summary</h3>
      <p class="cw-note">${esc(tr('trust.lead'))}</p>
      <label class="cw-check"><input type="checkbox" data-trust="name" checked> Name</label>
      <label class="cw-check"><input type="checkbox" data-trust="weekMinutes" checked> Minutes this week</label>
      <label class="cw-check"><input type="checkbox" data-trust="sessions" checked> Finished sessions</label>
      <label class="cw-check"><input type="checkbox" data-trust="milestones"> Milestones I type below</label>
      <label class="field"><span>Milestones, one per line</span><textarea id="trustMiles" rows="3" dir="auto"></textarea></label>
      <p class="cw-note" id="trustPreview"></p>
      <div class="stack" style="flex-direction:row;flex-wrap:wrap;gap:8px">
        <button type="button" class="btn" id="trustPreviewBtn">Preview</button>
        <button type="button" class="btn primary" id="trustShare">Share this summary</button>
        <button type="button" class="btn" id="trustRevoke" ${state.trustShare && state.trustShare.id ? '' : 'disabled'}>Revoke</button>
      </div>
      <div id="trustRead">${esc(trustText)}</div>
      <p class="cw-note">${esc(recoveryCopy())} ${PASSKEYS_OFFERED ? '' : ''}</p>`;
    api.$('#langPick').onchange = () => {
      ensure().settings.lang = api.$('#langPick').value;
      api.save();
      render(true);
    };
    api.$('#tryAccept').onclick = () => {
      if (!idea.ok) return;
      const next = decideSuggestion(state.settings, idea, 'accept');
      state.settings = Object.assign(state.settings, next.settings);
      state.trial = next.trial;
      api.save();
      api.toast('The timer uses that length now. Undo puts the old one back.');
      render(true);
    };
    api.$('#tryDecline').onclick = () => api.toast('Left as it is.');
    api.$('#tryUndo').onclick = () => {
      const next = undoSuggestion(state.settings, state.trial);
      state.settings = Object.assign(state.settings, next.settings);
      if (next.settings.reviewLoad == null) delete state.settings.reviewLoad;
      state.trial = next.trial;
      api.save();
      render(true);
    };
    api.$('#tryReset').onclick = () => {
      const next = resetSuggestion(state.settings, state.trial);
      state.settings.focus = next.settings.focus;
      state.trial = null;
      api.save();
      render(true);
    };
    api.$('#trustPreviewBtn').onclick = () => showTrustPreview();
    api.$('#trustShare').onclick = () => shareTrust();
    api.$('#trustRevoke').onclick = () => revokeTrust();
  }

  function trustPicked() {
    const picked = {};
    document.querySelectorAll('#expandYou [data-trust]').forEach(input => { picked[input.getAttribute('data-trust')] = input.checked; });
    return picked;
  }
  function trustSource() {
    const state = ensure();
    const miles = ((api.$('#trustMiles') || {}).value || '').split('\n').map(line => line.trim()).filter(Boolean);
    const week = api.weekMinutes ? api.weekMinutes() : 0;
    const sessions = api.sessionCount ? api.sessionCount() : (state.sessions || []).length;
    const user = api.auth ? api.auth() : null;
    return {
      name: (state.passport && state.passport.displayName) || (user && user.name) || 'Student',
      weekMinutes: week,
      sessions,
      milestones: miles,
      email: user && user.email,
      mood: 'hidden'
    };
  }
  function showTrustPreview() {
    const preview = trustPreview(trustSource(), trustPicked(), Date.now());
    const node = api.$('#trustPreview');
    if (!node) return preview;
    const bits = [];
    if (preview.name) bits.push(preview.name);
    if (preview.weekMinutes != null) bits.push(preview.weekMinutes + ' min');
    if (preview.sessions != null) bits.push(preview.sessions + ' sessions');
    if (preview.milestones) bits.push(preview.milestones.join(', '));
    node.textContent = 'Preview: ' + (bits.join(' · ') || 'Nothing selected.') + ' Email, notes, and mood are not in this.';
    return preview;
  }
  async function shareTrust() {
    const cloud = cloudOrTell();
    if (!cloud) return;
    const preview = showTrustPreview();
    const fields = Object.keys(preview).filter(key => key !== 'expires' && key !== 'revoked');
    if (!fields.length) { api.toast('Pick at least one field.'); return; }
    const id = api.uid();
    try {
      await cloud.fs.setDoc(cloud.fs.doc(cloud.db, 'trust', id), Object.assign({ owner: cloud.uid }, preview));
      ensure().trustShare = { id, expires: preview.expires };
      api.save();
      const link = location.origin + location.pathname + '#trust=' + id;
      api.toast('Summary link copied. It expires, and revoke removes it.');
      try { await navigator.clipboard.writeText(link); } catch (e) {}
      render(true);
    } catch (e) { rulesToast(e); }
  }
  async function revokeTrust() {
    const cloud = cloudOrTell();
    const share = ensure().trustShare;
    if (!cloud || !share || !share.id) return;
    try {
      await cloud.fs.deleteDoc(cloud.fs.doc(cloud.db, 'trust', share.id));
      ensure().trustShare = null;
      api.save();
      api.toast('That summary is revoked.');
      render(true);
    } catch (e) { rulesToast(e); }
  }
  async function openTrust() {
    const match = String(location.hash || '').match(/trust=([A-Za-z0-9_-]+)/);
    if (!match) return;
    if (!trustOpened) {
      trustOpened = true;
      const cloud = api.cloud && api.cloud();
      if (!cloud) trustText = 'Sign in to open a summary that was shared with you.';
      else {
        try {
          const snap = await cloud.fs.getDoc(cloud.fs.doc(cloud.db, 'trust', match[1]));
          if (!snap.exists() || !trustReadable(snap.data(), Date.now())) {
            trustText = 'This summary is not available. It may have expired or been revoked.';
          } else {
            const data = snap.data();
            trustText = [data.name, data.weekMinutes != null ? data.weekMinutes + ' min' : '', data.sessions != null ? data.sessions + ' sessions' : '', (data.milestones || []).join(', ')].filter(Boolean).join(' · ');
          }
        } catch (e) {
          trustText = 'This summary is not available. It may have expired or been revoked.';
        }
      }
    }
    const node = api.$('#trustRead');
    if (node) node.textContent = trustText;
  }

  function renderConnect(force) {
    const card = api.$('#connectCard');
    if (!card) return;
    if (!force && focused('#connectCard')) return;
    const state = ensure();
    const ms = state.connectors.microsoft;
    const status = ms.lastError
      ? ms.lastError
      : (ms.on ? 'Last file is on this device. Read-only. Disconnect keeps those blocks.' : 'Not connected.');
    const lines = CONNECTOR_BOUNDARIES.map(item => `<p class="cw-note"><strong>${esc(item.name)}</strong> · ${esc(item.mode)}. ${esc(item.line)}</p>`).join('');
    card.innerHTML = `<h3>Connections</h3>${lines}
      <p class="cw-note" role="status">${esc(status)}</p>
      <label class="field"><span>Outlook calendar file</span><textarea id="msText" rows="5" dir="auto" placeholder="BEGIN:VCALENDAR"></textarea></label>
      <div class="stack" style="flex-direction:row;flex-wrap:wrap;gap:8px">
        <button type="button" class="btn primary" id="msGo">Import the file</button>
        <button type="button" class="btn" id="msOff">Disconnect</button>
      </div>`;
    api.$('#msGo').onclick = () => importMicrosoft();
    api.$('#msOff').onclick = () => {
      state.connectors.microsoft = { on: false, mode: 'read', lastSync: state.connectors.microsoft.lastSync || 0, lastError: '', count: state.connectors.microsoft.count || 0 };
      api.save();
      api.toast('Microsoft import is off. Blocks already here stay.');
      render(true);
    };
  }

  function importMicrosoft() {
    const parsed = parseMicrosoftIcs((api.$('#msText') || {}).value || '');
    const state = ensure();
    if (!parsed.ok) {
      state.connectors.microsoft.lastError = parsed.error;
      state.connectors.microsoft.on = true;
      api.save();
      api.toast(parsed.error);
      render(true);
      return;
    }
    const merged = mergeMicrosoft(state.events, parsed.events);
    state.events = merged.events;
    state.connectors.microsoft = { on: true, mode: 'read', lastSync: Date.now(), lastError: '', count: merged.events.filter(item => item.origin === 'microsoft').length };
    api.save();
    if (api.renderCalendar) api.renderCalendar();
    api.toast(merged.added + ' added, ' + merged.updated + ' updated. Outlook was not changed.');
    render(true);
  }

  function renderDiscover() {
    const card = api.$('#discoverCard');
    if (!card) return;
    const note = domainNote();
    const address = note.canonical.replace(/^https?:\/\//, '').replace(/\/$/, '');
    card.classList.add('ab-address-card');
    card.innerHTML = `<div class="ab-address-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/><path d="M16.5 3.8 19 2M18.5 6.7 21 5.8"/></svg></div>
      <div class="ab-address-main">
        <div class="ab-address-head"><div><p class="ab-address-kicker">Your Study Pack link</p><h3>Where this lives</h3></div><span class="ab-address-ready">Working address</span></div>
        <p class="ab-address-copy">Save this address to come back to your workspace. ${note.shortReady ? 'A shorter link is also ready.' : 'The shorter address is not active yet.'}</p>
        <a class="ab-address-link" href="${esc(note.canonical)}">${esc(address)} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg></a>
        <p class="ab-address-access">${esc(tr('domain.access'))}</p>
        <nav class="ab-address-routes" aria-label="Quick links"><span>Jump straight to</span><a href="#focus">Focus</a><a href="#plan">Plan</a><a href="?view=notes">Notes</a></nav>
      </div>`;
  }

  function importSyllabus() {
    readRows();
    const brought = importConfirmed(rows);
    if (!brought.rows.length) { api.toast(tr('syl.empty')); return; }
    const state = ensure();
    brought.rows.forEach(row => state.assignments.unshift(assignmentFromRow(row, api.uid())));
    api.save();
    if (api.renderCalendar) api.renderCalendar();
    api.toast('Imported ' + brought.rows.length + '. Nothing was sent to the assistant.');
    rows = [];
    render(true);
  }

  function importLms() {
    const provider = (api.$('#lmsProvider') || {}).value || 'canvas-snapshot';
    const parsed = parseLms((api.$('#lmsText') || {}).value || '', { tz: zone(), provider });
    const state = ensure();
    if (!parsed.ok) {
      state.connectors.lms = Object.assign({}, state.connectors.lms, { on: true, mode: 'read', lastError: parsed.error, provider });
      api.save();
      api.toast(parsed.error);
      render(true);
      return;
    }
    const merged = mergeLms(state.assignments, parsed.rows);
    state.assignments = merged.assignments;
    state.connectors.lms = { on: true, mode: 'read', provider: parsed.provider, lastSync: Date.now(), lastError: '', count: parsed.rows.length };
    api.save();
    api.toast(merged.added + ' added, ' + merged.updated + ' updated. The source was not changed.');
    render(true);
  }

  async function makeDesk() {
    const cloud = cloudOrTell();
    if (!cloud) return;
    const ids = Array.from(document.querySelectorAll('#bringPanel [data-share]:checked')).map(node => node.getAttribute('data-share'));
    const state = ensure();
    const payload = sharedPayload(state.assignments, state.notes, ids);
    if (!payload.tasks.length && !payload.notes.length) { api.toast('Tick at least one assignment or note.'); return; }
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = 'desk-';
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    const body = {
      owner: cloud.uid,
      title: payload.tasks[0] ? payload.tasks[0].title.slice(0, 80) : 'Shared desk',
      updated: Date.now(),
      revoked: [],
      tasksJson: JSON.stringify(payload.tasks),
      notesJson: JSON.stringify(payload.notes)
    };
    try {
      await cloud.fs.setDoc(cloud.fs.doc(cloud.db, 'desks', code), body);
      await cloud.fs.setDoc(cloud.fs.doc(cloud.db, 'desks', code, 'members', cloud.uid), {
        name: String(cloud.name || 'Owner').slice(0, 40) || 'Owner', role: 'viewer', at: Date.now()
      });
      try {
        await cloud.fs.updateDoc(cloud.fs.doc(cloud.db, 'desks', code, 'members', cloud.uid), { role: 'editor' });
      } catch (e) { /* owner can still edit the desk document */ }
      state.deskLinks.unshift({ code, title: body.title, role: 'owner' });
      api.save();
      api.toast('Desk ' + code + ' is shared. Send the code. Mood and email were not included.');
      render(true);
    } catch (e) { rulesToast(e); }
  }

  async function joinDesk() {
    const cloud = cloudOrTell();
    if (!cloud) return;
    const code = String((api.$('#deskCode') || {}).value || '').trim().toLowerCase();
    if (!/^desk-[a-z2-9]{6}$/.test(code)) { api.toast('That code does not look right.'); return; }
    try {
      const member = cloud.fs.doc(cloud.db, 'desks', code, 'members', cloud.uid);
      const have = await cloud.fs.getDoc(member);
      if (!have.exists()) {
        await cloud.fs.setDoc(member, { name: String(cloud.name || 'Student').slice(0, 40) || 'Student', role: 'viewer', at: Date.now() });
      }
      const snap = await cloud.fs.getDoc(cloud.fs.doc(cloud.db, 'desks', code));
      if (!snap.exists()) { api.toast('That desk is not available.'); return; }
      const data = snap.data();
      if ((data.revoked || []).indexOf(cloud.uid) >= 0) { api.toast('This invite was revoked.'); return; }
      const state = ensure();
      if (!state.deskLinks.some(item => item.code === code)) state.deskLinks.unshift({ code, title: data.title || code, role: 'viewer' });
      api.save();
      await openDesk(code);
      api.toast('Joined ' + code + ' as a viewer. The owner can allow edits.');
    } catch (e) { rulesToast(e); }
  }

  async function openDesk(code) {
    const cloud = cloudOrTell();
    if (!cloud) return;
    try {
      const ref = cloud.fs.doc(cloud.db, 'desks', code);
      const snap = await cloud.fs.getDoc(ref);
      if (!snap.exists()) { api.toast('That desk is not available.'); return; }
      const data = snap.data();
      if ((data.revoked || []).includes(cloud.uid)) { api.toast('This invite was revoked.'); return; }
      const owner = data.owner === cloud.uid;
      const memberRef = cloud.fs.doc(cloud.db, 'desks', code, 'members', cloud.uid);
      const memberSnap = await cloud.fs.getDoc(memberRef);
      const member = memberSnap.exists() ? memberSnap.data() : {};
      if (!owner && !memberSnap.exists()) { api.toast('Join with the invite code before opening this desk.'); return; }
      let members = [];
      if (owner) {
        const all = await cloud.fs.getDocs(cloud.fs.collection(cloud.db, 'desks', code, 'members'));
        members = all.docs.map(item => Object.assign({ id:item.id }, item.data()));
      }
      activeDesk = { code, data, owner, role:owner ? 'owner' : member.role, members };
      render(true);
    } catch (e) { rulesToast(e); }
  }

  async function saveSharedDesk() {
    const cloud = cloudOrTell();
    if (!cloud || !activeDesk || (!activeDesk.owner && activeDesk.role !== 'editor')) return;
    const panel = api.$('#bringPanel');
    const tasks = safeDeskRows(activeDesk.data.tasksJson);
    const notes = safeDeskRows(activeDesk.data.notesJson);
    if (panel) {
      panel.querySelectorAll('[data-shared-task]').forEach(field => {
        const item = tasks.find(row => String(row.id) === field.dataset.sharedTask);
        if (item) item.title = field.value.slice(0, 500);
      });
      panel.querySelectorAll('[data-shared-note]').forEach(field => {
        const item = notes.find(row => String(row.id) === field.dataset.sharedNote);
        if (item) item.text = field.value.slice(0, 500);
      });
    }
    try {
      const data = Object.assign({}, activeDesk.data, {
        tasksJson:JSON.stringify(tasks), notesJson:JSON.stringify(notes), updated:Date.now()
      });
      await cloud.fs.updateDoc(cloud.fs.doc(cloud.db, 'desks', activeDesk.code), {
        tasksJson:data.tasksJson, notesJson:data.notesJson, updated:data.updated
      });
      activeDesk.data = data;
      api.toast('Shared desk saved.');
      render(true);
    } catch (e) { rulesToast(e); }
  }

  async function setDeskRole(uid, role) {
    const cloud = cloudOrTell();
    if (!cloud || !activeDesk || !activeDesk.owner || !['viewer', 'editor'].includes(role)) return;
    try {
      await cloud.fs.updateDoc(cloud.fs.doc(cloud.db, 'desks', activeDesk.code, 'members', uid), { role });
      await openDesk(activeDesk.code);
      api.toast(role === 'editor' ? 'This person can edit the shared desk.' : 'This person is view only.');
    } catch (e) { rulesToast(e); }
  }

  async function revokeDesk(code, selectedUid = '') {
    const cloud = cloudOrTell();
    if (!cloud) return;
    try {
      const ref = cloud.fs.doc(cloud.db, 'desks', code);
      const snap = await cloud.fs.getDoc(ref);
      if (!snap.exists()) { api.toast('That desk is already gone.'); return; }
      const data = snap.data();
      if (data.owner !== cloud.uid) { api.toast('Only the owner can revoke an invite.'); return; }
      const members = await cloud.fs.getDocs(cloud.fs.collection(cloud.db, 'desks', code, 'members'));
      const victim = members.docs.find(doc => doc.id !== data.owner && (!selectedUid || doc.id === selectedUid));
      const uid = victim ? victim.id : '';
      if (!uid) { api.toast('There is no other person to revoke.'); return; }
      const next = revokeMember({ owner: data.owner, revoked: data.revoked || [], members: {} }, cloud.uid, uid);
      await cloud.fs.setDoc(ref, Object.assign({}, data, { revoked: next.desk.revoked, updated: Date.now() }));
      await cloud.fs.deleteDoc(cloud.fs.doc(cloud.db, 'desks', code, 'members', uid));
      if (activeDesk && activeDesk.code === code) await openDesk(code);
      api.toast(next.line);
    } catch (e) { rulesToast(e); }
  }

  function render(force) {
    applyLanguage();
    renderHandoff();
    renderBring(force);
    renderYou(force);
    renderConnect(force);
    renderDiscover();
    if (!booted) {
      booted = true;
      const hash = String(location.hash || '');
      setTimeout(() => {
        if ((hash === '#bring' || hash === '#import') && api.go) api.go('plan');
        else if (/trust=/.test(hash) && api.go) api.go('profile');
        openTrust();
      }, 0);
    } else openTrust();
  }

  function bind() {
    if (bound) return;
    bound = true;
    const button = api.$('#bringBtn');
    if (button) button.onclick = () => { bring = !bring; render(true); };
    document.addEventListener('click', event => {
      const tabBtn = event.target.closest('#bringPanel [data-bring]');
      if (tabBtn) { readRows(); tab = tabBtn.getAttribute('data-bring'); render(true); return; }
      if (event.target.closest('#sylParse')) {
        const text = (api.$('#sylText') || {}).value || '';
        const tzInput = api.$('#sylTz');
        if (tzInput && tzInput.value.trim()) tz = tzInput.value.trim();
        const parsed = parseSyllabus(text, { tz: zone(), now: Date.now() });
        rows = parsed.rows;
        if (!rows.length) api.toast(tr('syl.empty'));
        render(true);
        return;
      }
      if (event.target.closest('#sylImport')) { importSyllabus(); return; }
      if (event.target.closest('#lmsGo')) { importLms(); return; }
      if (event.target.closest('#lmsOff')) {
        const state = ensure();
        state.connectors.lms = disconnectLms(state.connectors.lms);
        api.save();
        api.toast('Disconnected. Imported assignments stay on this device.');
        render(true);
        return;
      }
      if (event.target.closest('#deskMake')) { makeDesk(); return; }
      if (event.target.closest('#deskJoin')) { joinDesk(); return; }
      if (event.target.closest('#deskBack')) { activeDesk = null; render(true); return; }
      if (event.target.closest('#deskSave')) { saveSharedDesk(); return; }
      const open = event.target.closest('#bringPanel [data-open-desk]');
      if (open) { openDesk(open.getAttribute('data-open-desk')); return; }
      const role = event.target.closest('#bringPanel [data-role-user]');
      if (role) { setDeskRole(role.getAttribute('data-role-user'), role.getAttribute('data-role-value')); return; }
      const remove = event.target.closest('#bringPanel [data-member-revoke]');
      if (remove && activeDesk) { revokeDesk(activeDesk.code, remove.getAttribute('data-member-revoke')); return; }
      const revoke = event.target.closest('#bringPanel [data-revoke]');
      if (revoke) revokeDesk(revoke.getAttribute('data-revoke'));
    });
    const hash = String(location.hash || '').replace(/^#/, '');
    if (hash === 'bring' || hash === '#import' || hash === 'import') bring = true;
  }

  bind();
  return { render };
}
