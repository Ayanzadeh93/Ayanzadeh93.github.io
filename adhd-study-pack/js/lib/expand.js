/* Optional expansion (roadmap F51–F60). Pure: no DOM, no network, no coach.
   A pasted file never becomes an assistant action. A secret is never a field
   this module returns for export. */

export const CANONICAL_URL = 'https://www.ayanzadeh.com/adhd-study-pack/';
export const SHORT_URL = 'https://study.ayanzadeh.com/';
export const PASSKEYS_OFFERED = false;
export const LMS_STALE_MS = 7 * 86400000;
export const TRUST_DAYS = 14;
export const TRUST_FIELDS = ['name', 'weekMinutes', 'sessions', 'milestones'];

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12
};

export function domainNote() {
  return {
    canonical: CANONICAL_URL,
    short: SHORT_URL,
    shortReady: false,
    line: 'The address to open and share is ' + CANONICAL_URL + '. A shorter name is not in use. It stays that way until that name, HTTPS, and the sign-in authorized domains all work. Until then this address remains the one that loads the app. Links such as #plan and ?view=focus open the same screens here.'
  };
}

export function recoveryCopy() {
  return 'Passkeys are not offered. If you lose this device, open the email link and type the same email, or continue with Google. The same email reaches the same account. There is no separate password list for a passkey.';
}

export function emailForLink(value) {
  const email = String(value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, email: '', error: 'Enter the email for the link. Passkeys are not offered.' };
  }
  return { ok: true, email, error: '' };
}

function isoDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return '';
  return dt.toISOString().slice(0, 10);
}

function findDate(line, year) {
  const iso = line.match(/\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?\b/);
  if (iso) {
    const date = isoDate(+iso[1], +iso[2], +iso[3]);
    if (date) return { iso: date, time: iso[4] ? iso[4] + ':' + iso[5] : '', raw: iso[0], uncertain: false, reason: '' };
  }
  const named = line.match(new RegExp('\\b(\\d{1,2})\\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+(\\d{4})\\b', 'i'))
    || line.match(new RegExp('\\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+(\\d{1,2})(?:,)?\\s+(\\d{4})\\b', 'i'));
  if (named) {
    const monthFirst = MONTHS[named[1].toLowerCase()] != null && !/^\d/.test(named[1]);
    const month = MONTHS[(monthFirst ? named[1] : named[2]).toLowerCase()];
    const day = +(monthFirst ? named[2] : named[1]);
    const y = +(monthFirst ? named[3] : named[3]);
    const date = isoDate(y, month, day);
    if (date) return { iso: date, time: '', raw: named[0], uncertain: false, reason: '' };
  }
  const namedYearless = line.match(new RegExp('\\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+(\\d{1,2})\\b', 'i'));
  if (namedYearless && !/\d{4}/.test(line)) {
    const date = isoDate(year, MONTHS[namedYearless[1].toLowerCase()], +namedYearless[2]);
    if (date) return { iso: date, time: '', raw: namedYearless[0], uncertain: true, reason: 'The year was not in the line. It is shown as ' + year + ' until you change it.' };
  }
  const numeric = line.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})\b/);
  if (numeric) {
    const a = +numeric[1], b = +numeric[2], y = +numeric[3];
    const mdy = isoDate(y, a, b);
    const dmy = isoDate(y, b, a);
    if (mdy && dmy && mdy !== dmy) {
      return { iso: mdy, time: '', raw: numeric[0], uncertain: true, reason: 'This date can be read two ways. Correct it before you confirm.' };
    }
    const date = mdy || dmy;
    if (date) return { iso: date, time: '', raw: numeric[0], uncertain: false, reason: '' };
  }
  return null;
}

function cleanTitle(line, raw) {
  const title = line.replace(raw, ' ').replace(/\s+/g, ' ').replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, '').slice(0, 140);
  return title || 'Imported date';
}

/** Parse syllabus text into rows. Nothing here calls an assistant. */
export function parseSyllabus(text, opts) {
  const options = opts || {};
  const tz = String(options.tz || 'UTC');
  const year = options.year || new Date(options.now || Date.now()).getUTCFullYear();
  const rows = [];
  String(text || '').split(/\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const found = findDate(line, year);
    if (found) {
      rows.push({
        id: 's' + index, kind: 'deadline', title: cleanTitle(line, found.raw),
        date: found.iso, time: found.time, tz, source: line,
        uncertain: found.uncertain, reason: found.reason, confirmed: false
      });
      return;
    }
    if (/\b(required|requirement|must submit|points|worth)\b/i.test(line)) {
      rows.push({ id: 's' + index, kind: 'requirement', title: line.slice(0, 140), date: '', time: '', tz, source: line, uncertain: false, reason: '', confirmed: false });
      return;
    }
    if (/^week\b|^\s*topic:|\bchapter\b/i.test(line)) {
      rows.push({ id: 's' + index, kind: 'topic', title: line.slice(0, 140), date: '', time: '', tz, source: line, uncertain: false, reason: '', confirmed: false });
    }
  });
  return { tz, rows, assistant: null };
}

export function canConfirm(row) {
  if (!row) return false;
  if (row.kind === 'deadline') return /^\d{4}-\d{2}-\d{2}$/.test(row.date || '');
  return !!String(row.title || '').trim();
}

export function applyRowEdit(row, edit) {
  const next = Object.assign({}, row);
  const patch = edit || {};
  if (patch.title != null) next.title = String(patch.title).slice(0, 140);
  if (patch.date != null) next.date = String(patch.date);
  if (patch.time != null) next.time = String(patch.time).slice(0, 5);
  if (patch.tz != null) next.tz = String(patch.tz);
  if (patch.confirmed != null) next.confirmed = !!patch.confirmed;
  if (next.kind === 'deadline' && patch.date && /^\d{4}-\d{2}-\d{2}$/.test(next.date)) {
    next.uncertain = false;
    next.reason = '';
  }
  if (next.confirmed && !canConfirm(next)) next.confirmed = false;
  return next;
}

export function importConfirmed(rows) {
  const chosen = (rows || []).filter(row => row && row.confirmed && canConfirm(row));
  return { assistant: null, rows: chosen };
}

export function assignmentFromRow(row, id) {
  const topic = row.kind === 'topic'
    ? [{ id: id + '-t', title: row.title, confidence: null, evidence: 0 }]
    : [];
  return {
    id,
    title: row.title,
    kind: 'reading',
    subjectId: null,
    due: row.kind === 'deadline' ? row.date : null,
    dueTz: row.tz || '',
    fromTemplate: 'Syllabus',
    requirements: row.kind === 'requirement' ? row.source : '',
    milestones: [],
    resources: [],
    topics: topic,
    sourceLine: row.source,
    origin: 'syllabus'
  };
}

function lmsRow(item) {
  if (!item || typeof item !== 'object') return null;
  const sourceId = String(item.id || item.assignment_id || item.sourceId || '').trim();
  const title = String(item.title || item.name || '').trim();
  if (!sourceId || !title) return null;
  const dueRaw = item.due || item.due_at || item.due_date || '';
  const due = String(dueRaw).slice(0, 10);
  return {
    sourceId: sourceId.slice(0, 80),
    title: title.slice(0, 140),
    due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : '',
    dueTz: '',
    course: String(item.course || item.course_name || item.courseName || '').slice(0, 80),
    updatedAt: String(item.updated || item.updated_at || item.updatedAt || '').slice(0, 40)
  };
}

function parseCsv(text) {
  const lines = text.split(/\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const head = lines[0].split(',').map(cell => cell.trim().toLowerCase());
  const at = name => head.indexOf(name);
  const cell = (line, name) => {
    const index = at(name);
    if (index < 0) return '';
    return (line.split(',')[index] || '').trim();
  };
  return lines.slice(1).map(line => lmsRow({
    id: cell(line, 'id') || cell(line, 'sourceid'),
    title: cell(line, 'title') || cell(line, 'name'),
    due: cell(line, 'due') || cell(line, 'due_at'),
    course: cell(line, 'course'),
    updated: cell(line, 'updated') || cell(line, 'updated_at')
  })).filter(Boolean);
}

/** Read-only LMS snapshot. A URL is refused so a secret feed is not stored. */
export function parseLms(text, opts) {
  const options = opts || {};
  const raw = String(text || '').trim();
  const tz = String(options.tz || 'UTC');
  if (!raw) return { ok: false, error: 'Nothing was pasted. Local copies were not changed.', rows: [] };
  if (/^https?:\/\//i.test(raw)) {
    return { ok: false, error: 'This is a web address, not a file. Paste the export. Nothing was changed, and the address was not saved.', rows: [] };
  }
  let rows = [];
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : (data.assignments || data.items || []);
      rows = list.map(lmsRow).filter(Boolean);
    } catch (e) {
      return { ok: false, error: 'That file could not be read. Local copies were not changed.', rows: [] };
    }
  } else {
    rows = parseCsv(raw);
  }
  if (!rows.length) return { ok: false, error: 'No assignments were found. Local copies were not changed.', rows: [] };
  return {
    ok: true,
    error: '',
    provider: options.provider === 'moodle-snapshot' ? 'moodle-snapshot' : 'canvas-snapshot',
    rows: rows.map(row => Object.assign({}, row, { dueTz: tz }))
  };
}

export function mergeLms(existing, rows) {
  const list = (existing || []).slice();
  let added = 0;
  let updated = 0;
  (rows || []).forEach(row => {
    const at = list.findIndex(item => item && item.origin === 'lms' && item.sourceId === row.sourceId);
    const prior = at >= 0 ? list[at] : null;
    const item = {
      id: prior ? prior.id : 'lms-' + row.sourceId,
      title: row.title,
      due: row.due || null,
      dueTz: row.dueTz || '',
      sourceId: row.sourceId,
      origin: 'lms',
      course: row.course || '',
      sourceUpdated: row.updatedAt || '',
      kind: prior ? prior.kind : 'reading',
      fromTemplate: 'LMS',
      requirements: prior ? prior.requirements || '' : '',
      milestones: prior ? prior.milestones || [] : [],
      resources: prior ? prior.resources || [] : [],
      topics: prior ? prior.topics || [] : [],
      subjectId: prior ? prior.subjectId || null : null
    };
    if (prior) { list[at] = item; updated += 1; }
    else { list.unshift(item); added += 1; }
  });
  return { assignments: list, added, updated };
}

export function lmsStatus(conn, now) {
  const state = conn || {};
  if (!state.on) return { state: 'disconnected', line: 'Not connected. Assignments already imported stay on this device.' };
  if (state.lastError) return { state: 'failed', line: 'The last sync failed. Local copies are still here. ' + state.lastError };
  if (!state.lastSync || (now - state.lastSync) > LMS_STALE_MS) return { state: 'stale', line: 'This import is more than 7 days old. It is not a live connection.' };
  return { state: 'current', line: 'Read-only snapshot. This app does not change Canvas or Moodle.' };
}

export function disconnectLms(conn) {
  const state = conn || {};
  return { on: false, mode: 'read', provider: state.provider || '', lastSync: state.lastSync || 0, lastError: '', count: state.count || 0 };
}

export function parseMicrosoftIcs(text) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, error: 'Nothing was pasted. Existing blocks were not changed.', events: [] };
  if (/^https?:\/\//i.test(raw)) {
    return { ok: false, error: 'A web address is not saved and is not fetched. Paste the calendar file.', events: [] };
  }
  const unfolded = raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const events = [];
  unfolded.split('BEGIN:VEVENT').slice(1).forEach(block => {
    const body = block.split('END:VEVENT')[0];
    const get = re => { const m = body.match(re); return m ? m[1].trim() : ''; };
    const uid = get(/UID:([^\n\r]+)/) || get(/SUMMARY:([^\n\r]+)/);
    const summary = (get(/SUMMARY:([^\n\r]+)/) || 'Calendar block').replace(/\\n/gi, ' ').replace(/\\,/g, ',');
    const start = icsDate(get(/DTSTART[^:\n]*:([^\n\r]+)/));
    const end = icsDate(get(/DTEND[^:\n]*:([^\n\r]+)/));
    if (!uid || !start) return;
    events.push({
      sourceId: uid.slice(0, 180),
      title: summary.slice(0, 140),
      start: start.toISOString(),
      end: (end || new Date(+start + 3600000)).toISOString()
    });
  });
  if (!events.length) return { ok: false, error: 'No events were found. Existing blocks were not changed.', events: [] };
  return { ok: true, error: '', events };
}

function icsDate(value) {
  const m = String(value || '').match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], h = m[4] != null ? +m[4] : 9, mi = m[5] != null ? +m[5] : 0, s = m[6] != null ? +m[6] : 0;
  if (m[7] === 'Z') return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return new Date(y, mo - 1, d, h, mi, s);
}

export function mergeMicrosoft(existing, incoming) {
  const list = (existing || []).slice();
  let added = 0;
  let updated = 0;
  (incoming || []).forEach(row => {
    const at = list.findIndex(item => item && item.origin === 'microsoft' && item.sourceId === row.sourceId);
    const prior = at >= 0 ? list[at] : null;
    const item = {
      id: prior ? prior.id : 'ms-' + row.sourceId.replace(/[^\w.-]+/g, '').slice(0, 40),
      title: row.title,
      kind: prior ? prior.kind : 'class',
      subjectId: prior ? prior.subjectId || null : null,
      origin: 'microsoft',
      sourceId: row.sourceId,
      start: row.start,
      end: row.end
    };
    if (prior) { list[at] = item; updated += 1; }
    else { list.push(item); added += 1; }
  });
  return { events: list, added, updated };
}

export const CONNECTOR_BOUNDARIES = [
  { id: 'google', name: 'Google Calendar', mode: 'read-write', line: 'Reads events, and can add a block you choose. Disconnect stops that. The token is not in an export.' },
  { id: 'todoist', name: 'Todoist', mode: 'read-write', line: 'Reads tasks, and can add or complete a linked task. Disconnect stops that. The token is not in an export.' },
  { id: 'ics', name: 'Calendar file', mode: 'read', line: 'A pasted .ics file is read once. This app does not write back to that calendar.' },
  { id: 'microsoft', name: 'Microsoft calendar', mode: 'read', line: 'A pasted Outlook file is read once. This app does not change Outlook. A web address is not saved.' }
];

export function connectorSecretExported(snapshot) {
  const text = JSON.stringify(snapshot || {});
  return /microsoft-ics|todoist|access_token|refresh_token/i.test(text);
}

export function stampSession(input) {
  const prev = input && input.previous || {};
  const sessionId = (input && input.sessionId) || prev.sessionId || '';
  const same = !!(prev.sessionId && prev.sessionId === sessionId);
  return {
    sessionId,
    deviceId: input && input.deviceId || '',
    phase: input && input.phase || 'focus',
    plannedMs: input && input.plannedMs || 0,
    activeMs: input && input.activeMs || 0,
    remainMs: input && input.remainMs || 0,
    running: !!(input && input.running),
    status: (input && input.status) || ((input && input.running) ? 'running' : 'paused'),
    taskId: input && input.taskId || null,
    intent: String(input && input.intent || '').slice(0, 140),
    updatedAt: input && input.now || 0,
    journalId: same ? ((input && input.journalId) || prev.journalId || '') : ((input && input.journalId) || '')
  };
}

export function resolveHandoff(local, remote, deviceId, ctx) {
  const L = local || null;
  const R = remote || null;
  const context = ctx || {};
  if (!R && !L) return { handoff: null, conflict: false, line: '', offerTakeover: false, keepLocal: false };
  if (!R) return { handoff: L, conflict: false, line: '', offerTakeover: false, keepLocal: false };
  if (!L) {
    const offer = R.deviceId && R.deviceId !== deviceId && !R.journalId && (R.status === 'running' || R.status === 'paused');
    return { handoff: R, conflict: false, line: offer ? 'This session is open on another device. Take it over to continue it here.' : '', offerTakeover: !!offer, keepLocal: false };
  }
  if (L.sessionId && L.sessionId === R.sessionId && (L.journalId || R.journalId)) {
    const both = !!(L.journalId && R.journalId && L.journalId !== R.journalId);
    const first = both && (L.updatedAt || 0) <= (R.updatedAt || 0) ? L : (L.journalId ? L : R);
    return {
      handoff: Object.assign({}, first, { journalId: first.journalId, status: 'done', running: false }),
      conflict: both,
      line: both
        ? 'Two devices finished this session. Only the first saved completion is kept.'
        : 'This session was already saved. It will not be counted twice.',
      offerTakeover: false,
      keepLocal: false
    };
  }
  if (context.localRunning && L.deviceId === deviceId) {
    const other = R.deviceId && R.deviceId !== deviceId && R.sessionId === L.sessionId && (R.updatedAt || 0) > (L.updatedAt || 0) && R.status !== 'done';
    return {
      handoff: L,
      conflict: !!other,
      line: other ? 'Another device also has this session. Only one completion will be saved.' : '',
      offerTakeover: false,
      keepLocal: true
    };
  }
  if (R.deviceId && R.deviceId !== deviceId && !R.journalId && (R.status === 'running' || R.status === 'paused') && (R.updatedAt || 0) >= (L.updatedAt || 0)) {
    return {
      handoff: R,
      conflict: false,
      line: 'This session is open on another device. Take it over to continue it here. Nothing moves until you do.',
      offerTakeover: true,
      keepLocal: false
    };
  }
  return { handoff: (L.updatedAt || 0) > (R.updatedAt || 0) ? L : R, conflict: false, line: '', offerTakeover: false, keepLocal: false };
}

export function takeover(remote, deviceId, now) {
  if (!remote || !remote.sessionId || remote.journalId) return { ok: false, line: 'There is no open session to take.' };
  return {
    ok: true,
    line: 'This device now holds the same session. Start when you are ready. It will be saved once.',
    handoff: Object.assign({}, remote, { deviceId, updatedAt: now, status: 'paused', running: false }),
    timer: {
      sessionId: remote.sessionId,
      remainMs: remote.remainMs || 0,
      phase: remote.phase || 'focus',
      taskId: remote.taskId || null,
      intent: remote.intent || ''
    }
  };
}

export function handoffView(handoff, deviceId) {
  if (!handoff || !handoff.sessionId || handoff.journalId) return { show: false, line: '' };
  if (!handoff.deviceId || handoff.deviceId === deviceId) return { show: false, line: '' };
  if (handoff.status !== 'running' && handoff.status !== 'paused') return { show: false, line: '' };
  return { show: true, line: 'This session is open on another device. Take it over to continue it here. Nothing moves until you do.' };
}

export function sharedPayload(assignments, notes, ids) {
  const want = new Set(ids || []);
  const tasks = (assignments || []).filter(item => item && want.has(item.id)).map(item => ({
    id: String(item.id),
    title: String(item.title || '').slice(0, 140),
    due: item.due || '',
    dueTz: item.dueTz || ''
  }));
  const picked = (notes || []).filter(item => item && want.has(item.id)).map(item => ({
    id: String(item.id),
    text: String(item.text || item.body || '').slice(0, 500)
  }));
  return { tasks, notes: picked };
}

export function memberMay(role, action) {
  if (action === 'delete-account' || action === 'read-mood' || action === 'read-journal' || action === 'read-email') return false;
  if (action === 'edit') return role === 'editor' || role === 'owner';
  if (action === 'revoke' || action === 'set-role') return role === 'owner';
  if (action === 'read') return role === 'viewer' || role === 'editor' || role === 'owner';
  return false;
}

export function revokeMember(desk, actorId, uid) {
  if (!desk || desk.owner !== actorId) return { ok: false, desk, line: 'Only the owner can revoke an invite.' };
  const revoked = Array.from(new Set([].concat(desk.revoked || [], [uid])));
  const members = Object.assign({}, desk.members || {});
  delete members[uid];
  return { ok: true, desk: Object.assign({}, desk, { revoked, members }), line: 'Access is removed. Their account, mood, and notes on their own device stay theirs.' };
}

export function canReadDesk(desk, uid) {
  if (!desk || !uid) return false;
  if ((desk.revoked || []).indexOf(uid) >= 0) return false;
  if (desk.owner === uid) return true;
  return !!(desk.members && desk.members[uid]);
}

export function trustPreview(source, picked, now) {
  const allow = {};
  TRUST_FIELDS.forEach(key => { if (picked && picked[key]) allow[key] = true; });
  const out = { expires: (now || 0) + TRUST_DAYS * 86400000, revoked: false };
  if (allow.name) out.name = String((source && source.name) || 'Student').slice(0, 40);
  if (allow.weekMinutes) out.weekMinutes = Math.max(0, Math.round((source && source.weekMinutes) || 0));
  if (allow.sessions) out.sessions = Math.max(0, Math.round((source && source.sessions) || 0));
  if (allow.milestones) out.milestones = ((source && source.milestones) || []).map(item => String(item).slice(0, 80)).filter(Boolean).slice(0, 8);
  return out;
}

export function trustReadable(doc, now) {
  if (!doc || doc.revoked) return false;
  return typeof doc.expires === 'number' && doc.expires > (now || 0);
}

export function suggestFrom(records, now) {
  const settings = (records && records.settings) || {};
  const finished = ((records && records.sessions) || []).filter(item => item && !item.partial && (item.minutes || 0) >= 1);
  const recent = finished.filter(item => (now || 0) - new Date(item.start || item.at || 0).getTime() < 21 * 86400000).slice(-12);
  const cards = { change: false, reason: 'Cards stay as you set them.' };
  if (recent.length < 3) {
    return { ok: false, cards, reason: 'Not enough finished sessions yet. Three finished blocks are needed before a suggestion. Nothing was changed.' };
  }
  const mins = recent.map(item => item.minutes).sort((a, b) => a - b);
  const mid = mins[Math.floor((mins.length - 1) / 2)];
  const rounded = Math.max(10, Math.min(50, Math.round(mid / 5) * 5));
  const openReviews = (records && records.openReviews) || 0;
  const review = openReviews > 5 ? { load: 3, from: settings.reviewLoad == null ? null : settings.reviewLoad } : null;
  return {
    ok: true,
    now: now || 0,
    cards,
    timer: {
      minutes: rounded,
      from: settings.focus,
      reason: 'Your last ' + recent.length + ' finished sessions lasted about ' + rounded + ' minutes. The timer changes only if you accept.'
    },
    review: review ? Object.assign({ reason: 'You have ' + openReviews + ' open items. A smaller set is 3. Nothing changes unless you accept.' }, review) : null
  };
}

export function decideSuggestion(settings, suggestion, choice) {
  const base = Object.assign({}, settings || {});
  if (choice !== 'accept' || !suggestion || !suggestion.ok) return { settings: base, trial: null, changed: false };
  const next = Object.assign({}, base, { focus: suggestion.timer.minutes });
  const trial = { previous: base.focus, minutes: suggestion.timer.minutes, at: suggestion.now || 0, undone: false, previousReview: base.reviewLoad == null ? null : base.reviewLoad };
  if (suggestion.review) {
    next.reviewLoad = suggestion.review.load;
    trial.reviewLoad = suggestion.review.load;
  }
  return { settings: next, trial, changed: true };
}

export function undoSuggestion(settings, trial) {
  if (!trial || trial.undone) return { settings: Object.assign({}, settings || {}), trial: trial || null, changed: false };
  const next = Object.assign({}, settings || {}, { focus: trial.previous });
  if (trial.previousReview == null) delete next.reviewLoad;
  else next.reviewLoad = trial.previousReview;
  return { settings: next, trial: Object.assign({}, trial, { undone: true }), changed: true };
}

export function resetSuggestion(settings, trial) {
  const focus = trial && typeof trial.previous === 'number' ? trial.previous : (settings && settings.focus) || 25;
  const next = Object.assign({}, settings || {}, { focus });
  if (!trial || trial.previousReview == null) delete next.reviewLoad;
  else next.reviewLoad = trial.previousReview;
  return { settings: next, trial: null, changed: true };
}

export function trialOutcome(sessions, trial, now) {
  if (!trial || !trial.at) return { before: 0, after: 0, line: 'No change has been tried.' };
  const week = 7 * 86400000;
  const count = (from, to) => (sessions || []).filter(item => {
    if (!item || item.partial) return false;
    const at = new Date(item.start || item.at || 0).getTime();
    return at >= from && at < to && (item.minutes || 0) >= 1;
  }).length;
  const before = count(trial.at - week, trial.at);
  const after = count(trial.at, Math.min(now || trial.at, trial.at + week));
  return { before, after, line: before + ' finished sessions in the week before, ' + after + ' in the week after. This is a count of sessions, not a label.' };
}

export const LOCALES = [
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'fa', label: 'فارسی', dir: 'rtl' },
  { id: 'tr', label: 'Türkçe', dir: 'ltr' },
  { id: 'es', label: 'Español', dir: 'ltr' }
];

export const FA_FONTS = [
  { id: 'vazirmatn', label: 'وزیرمتن', family: 'Vazirmatn' },
  { id: 'estedad', label: 'استعداد', family: 'Estedad' },
  { id: 'sahel', label: 'ساحل', family: 'Sahel' },
  { id: 'shabnam', label: 'شبنم', family: 'Shabnam' }
];

const STR = {
  en: {
    'rail.focus': 'Focus', 'rail.plan': 'Plan', 'rail.notes': 'Notes', 'rail.wellbeing': 'Wellbeing',
    'rail.coach': 'Coach', 'rail.together': 'Together', 'rail.progress': 'Progress', 'rail.help': 'Help', 'rail.about': 'About', 'rail.you': 'You',
    'plan.coursework': 'Coursework', 'plan.study': 'Study', 'plan.bring': 'Bring in',
    'focus.stuck': "Can't start", 'focus.together': 'Study together',
    'gate.link': 'Email me a sign-in link',
    'gate.passkey': 'Passkeys are not offered. A lost device signs in again with this email or with Google.',
    'bring.lead': 'Bring a syllabus or an assignment file in only after you confirm each line. Nothing here starts the assistant.',
    'syl.tz': 'Timezone for these dates',
    'syl.empty': 'No dates or requirements were found.',
    'syl.import': 'Import the checked lines',
    'lms.lead': 'Paste a Canvas or Moodle export. This is read-only. There is no live connection, and a web address is not saved.',
    'desk.private': 'Only the assignments and notes you tick are copied. Mood, email, and your account are not.',
    'handoff.take': 'Take over this session',
    'you.lang': 'Language',
    'you.font': 'Persian type',
    'you.fallback': 'Some lines are still in English. Dates and the page direction follow this language. Text you imported stays as it was written.',
    'you.accept': 'Use this',
    'you.decline': 'Not now',
    'you.undo': 'Undo',
    'trust.lead': 'Choose the fields a trusted person may see. Email, notes, mood, and sign-in are never included.',
    'domain.access': 'The timer, planner, and these forms work from the keyboard. Motion can be reduced. Targets stay large. This is a study tool, not medical advice.'
  },
  fa: {
    'rail.focus': 'تمرکز', 'rail.plan': 'برنامه', 'rail.notes': 'یادداشت‌ها', 'rail.wellbeing': 'آرامش',
    'rail.coach': 'راهنما', 'rail.together': 'با هم', 'rail.progress': 'پیشرفت', 'rail.help': 'کمک', 'rail.about': 'درباره', 'rail.you': 'من',
    'plan.coursework': 'تکلیف‌ها', 'plan.study': 'مطالعه', 'plan.bring': 'آوردن',
    'focus.stuck': 'نمی‌توانم شروع کنم', 'focus.together': 'با هم درس بخوانیم',
    'gate.link': 'پیوند ورود را برایم بفرست',
    'gate.passkey': 'کلید عبور ارائه نمی‌شود. دستگاه گم‌شده با همین ایمیل یا با گوگل دوباره وارد می‌شود.',
    'bring.lead': 'برنامه درسی یا فایل تکلیف فقط پس از تأیید هر خط وارد می‌شود. اینجا دستیار را روشن نمی‌کند.',
    'syl.tz': 'منطقه زمانی این تاریخ‌ها',
    'syl.empty': 'تاریخ یا الزامی پیدا نشد.',
    'syl.import': 'خط‌های تیک‌خورده را وارد کن',
    'lms.lead': 'خروجی Canvas یا Moodle را بچسبان. فقط خواندنی است. اتصال زنده نیست و نشانی وب ذخیره نمی‌شود.',
    'desk.private': 'فقط تکلیف و یادداشتی که تیک می‌زنی کپی می‌شود. حال، ایمیل، و حساب تو نه.',
    'handoff.take': 'این نشست را همین‌جا ادامه بده',
    'you.lang': 'زبان',
    'you.font': 'قلم',
    'you.fallback': 'بعضی خط‌ها هنوز انگلیسی‌اند. تاریخ و جهت صفحه از این زبان پیروی می‌کنند. متنی که نوشته‌ای همان می‌ماند.',
    'you.accept': 'بپذیر',
    'you.decline': 'حالا نه',
    'you.undo': 'برگردان',
    'trust.lead': 'فیلدهایی را انتخاب کن که یک نفر مورد اعتماد ببیند. ایمیل، یادداشت، حال، و ورود هرگز نمی‌آیند.',
    'domain.access': 'زمان‌سنج، برنامه، و این فرم‌ها با صفحه‌کلید کار می‌کنند. حرکت را می‌توان کم کرد. هدف‌ها درشت می‌مانند. این ابزار درس است، نه توصیه پزشکی.'
  },
  es: {
    'rail.focus': 'Enfoque', 'rail.plan': 'Plan', 'rail.notes': 'Notas', 'rail.wellbeing': 'Bienestar',
    'rail.coach': 'Guía', 'rail.together': 'Juntos', 'rail.progress': 'Progreso', 'rail.help': 'Ayuda', 'rail.about': 'Acerca', 'rail.you': 'Tú',
    'plan.coursework': 'Curso', 'plan.study': 'Estudio', 'plan.bring': 'Traer',
    'focus.stuck': 'No puedo empezar', 'focus.together': 'Estudiar juntos',
    'gate.link': 'Enviarme un enlace',
    'gate.passkey': 'No hay llaves de acceso. Un dispositivo perdido entra otra vez con este correo o con Google.',
    'bring.lead': 'Un programa o un archivo entra solo después de que confirmes cada línea. Esto no llama al asistente.',
    'syl.tz': 'Zona horaria de estas fechas',
    'syl.empty': 'No hay fechas ni requisitos.',
    'syl.import': 'Importar las líneas marcadas',
    'lms.lead': 'Pega un archivo de Canvas o Moodle. Es de solo lectura. No hay conexión en vivo y no se guarda una dirección web.',
    'desk.private': 'Solo se copian las tareas y notas que marques. El ánimo, el correo y tu cuenta no.',
    'handoff.take': 'Continuar esta sesión aquí',
    'you.lang': 'Idioma',
    'you.fallback': 'Algunas líneas siguen en inglés. Las fechas y la dirección de la página siguen este idioma. El texto importado se queda como estaba.',
    'you.accept': 'Usar esto',
    'you.decline': 'Ahora no',
    'you.undo': 'Deshacer',
    'trust.lead': 'Elige qué puede ver una persona de confianza. El correo, las notas, el ánimo y el acceso no se incluyen.',
    'domain.access': 'El reloj, el plan y estos formularios funcionan con el teclado. El movimiento se puede reducir. Los objetivos siguen siendo grandes. Es una herramienta de estudio, no un consejo médico.'
  }
};

STR.tr = {
  'rail.focus': 'Odak', 'rail.plan': 'Plan', 'rail.notes': 'Notlar', 'rail.wellbeing': 'Sakinlik',
  'rail.coach': 'Rehber', 'rail.together': 'Birlikte', 'rail.progress': 'İlerleme', 'rail.help': 'Yardım', 'rail.about': 'Hakkında', 'rail.you': 'Ben',
  'plan.coursework': 'Ödevler', 'plan.study': 'Çalışma', 'plan.bring': 'Getir',
  'focus.stuck': 'Başlayamıyorum', 'focus.together': 'Birlikte çalışalım',
  'gate.link': 'Giriş bağlantısını gönder',
  'gate.passkey': 'Geçiş anahtarı yok. Kayıp bir cihaz bu e-posta veya Google ile yeniden girer.',
  'bring.lead': 'Bir ders planı veya ödev, ancak her satırı onayladıktan sonra girer. Bu, yardımcıya haber vermez.',
  'syl.tz': 'Bu tarihlerin saat dilimi',
  'syl.empty': 'Tarih veya zorunluluk bulunamadı.',
  'syl.import': 'İşaretli satırları al',
  'lms.lead': 'Bir Canvas veya Moodle dışa aktarımını yapıştır. Salt okunur. Canlı bağlantı yok ve bir web adresi kaydedilmez.',
  'desk.private': 'Yalnızca işaretlediğin ödev ve not kopyalanır. Ruh hali, e-posta ve hesap değil.',
  'handoff.take': 'Bu oturumu burada sürdür',
  'you.lang': 'Dil',
  'you.font': 'Yazı',
  'you.fallback': 'Bazı satırlar hâlâ İngilizce. Tarihler ve sayfa yönü bu dili izler. Kendi yazdığın metin olduğu gibi kalır.',
  'you.accept': 'Bunu kullan',
  'you.decline': 'Şimdi değil',
  'you.undo': 'Geri al',
  'trust.lead': 'Güvendiğin birinin görebileceği alanları seç. E-posta, notlar, ruh hali ve giriş asla dahil edilmez.',
  'domain.access': 'Zamanlayıcı, plan ve bu formlar klavyeyle çalışır. Hareket azaltılabilir. Hedefler büyük kalır. Bu bir çalışma aracıdır, tıbbi tavsiye değildir.'
};

export function localeOf(lang) {
  return LOCALES.find(item => item.id === lang) || LOCALES[0];
}

export function translate(lang, key) {
  const table = STR[lang] || STR.en;
  if (table[key]) return { text: table[key], fallback: false };
  if (STR.en[key]) return { text: STR.en[key], fallback: lang !== 'en' };
  return { text: key, fallback: true };
}

export function coverage(lang) {
  if (!lang || lang === 'en') return { full: true, note: '' };
  return { full: false, note: translate(lang, 'you.fallback').text };
}

export function formatWhen(date, lang, timeZone) {
  const locale = lang === 'fa' ? 'fa-IR' : lang === 'tr' ? 'tr-TR' : lang === 'es' ? 'es' : 'en';
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  if (timeZone) options.timeZone = timeZone;
  try { return new Intl.DateTimeFormat(locale, options).format(date); }
  catch (e) { return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(date); }
}

/** Imported academic text is not translated and keeps its own direction. */
export function presentImported(text) {
  return { text: String(text == null ? '' : text), dir: 'auto', translated: false };
}
