/* Browser side of the assistant link. Pure: no fetch, no DOM.
   The page stamps each item so an unchanged task does not overwrite
   a newer edit the assistant made. */

const MUTABLE = ['tasks', 'events', 'notes', 'habits', 'subjects', 'links'];
const ALL = MUTABLE.concat(['moods', 'sessions']);

export function itemSignature(item) {
  const copy = Object.assign({}, item);
  delete copy.updated;
  return JSON.stringify(copy);
}

function settingsSlice(S) {
  const s = (S && S.settings) || {};
  return {
    focus: s.focus, short: s.short, dayStart: s.dayStart, dayEnd: s.dayEnd,
    toolRepeat: s.toolRepeat, toolDue: s.toolDue, toolSomeday: s.toolSomeday
  };
}

/** A snapshot safe to send. Only the lists and the day window — never tokens. */
export function stampSnapshot(S, cache, now = Date.now()) {
  const sigs = cache && cache.sigs || {};
  const snap = { schema: 4, settings: settingsSlice(S) };
  const put = (key, list, cap) => {
    const rows = Array.isArray(list) ? list.filter(x => x && x.id) : [];
    const sliced = cap ? rows.slice(-cap) : rows.slice();
    snap[key] = sliced.map(item => {
      const copy = Object.assign({}, item);
      const sig = itemSignature(copy);
      const prev = sigs[String(item.id)];
      copy.updated = prev && prev.sig === sig ? Number(prev.updated || 0) : now;
      return copy;
    });
  };
  MUTABLE.forEach(k => put(k, S && S[k]));
  put('moods', S && S.moods, 90);
  put('sessions', S && S.sessions, 60);
  return snap;
}

export function rememberWorkspace(ws) {
  const sigs = {};
  ALL.forEach(k => (ws && ws[k] || []).forEach(item => {
    if (!item || !item.id) return;
    sigs[String(item.id)] = {
      sig: itemSignature(item),
      updated: Number(item.updated || item.created || item.at || 0)
    };
  }));
  const seen = [];
  MUTABLE.forEach(k => (ws && ws[k] || []).forEach(item => { if (item && item.id) seen.push(String(item.id)); }));
  return { sigs, seen };
}
