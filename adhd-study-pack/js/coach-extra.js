/**
 * Extra workspace actions for the study coach.
 * Loaded after webllm-coach.js. Handles prompts the base router does not.
 */
(function () {
  const SOUND = { rain: 'rain', ocean: 'ocean', brown: 'brown', pink: 'pink', fire: 'fire', fireplace: 'fire', cafe: 'cafe', tick: 'tick', clock: 'tick', binaural: 'bin', bin: 'bin' };
  const fd = () => window.FocusDial || null;
  const state = () => { try { return fd() && fd().getState ? fd().getState() || {} : {}; } catch (e) { return {}; } };
  const go = (v) => { const a = fd(); if (a && a.view) a.view(v); };
  const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const strip = (s) => String(s || '').replace(/^[\s"'\u201c\u201d]+|[\s"'\u201c\u201d?!.]+$/g, '').trim();
  const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const find = (list, needle) => {
    const q = String(needle || '').trim().toLowerCase();
    if (!q) return null;
    return list.find((x) => x.id === needle) || list.find((x) => String(x.title || x.text || '').toLowerCase() === q) || list.find((x) => String(x.title || x.text || '').toLowerCase().includes(q)) || null;
  };
  const habitDone = (h) => {
    const k = dayKey();
    if (!h) return false;
    if (h.type === 'counter') return Number(h.history && h.history[k] || 0) >= (h.dailyGoal || 1);
    return !!(h.history && h.history[k]);
  };
  const nextMove = (S) => {
    const open = (S.tasks || []).filter((t) => !t.done);
    const q1 = open.filter((t) => t.quad === 'q1');
    const left = (S.habits || []).filter((h) => h.type !== 'bad' && !habitDone(h));
    const active = (S.tasks || []).find((t) => t.id === (S.timer || {}).taskId);
    if (q1[0]) return 'Do first: "' + q1[0].title + '". Say start focus.';
    if (active && !active.done) return 'You already picked "' + active.title + '". Say start focus.';
    if (open[0]) return 'Next open task: "' + open[0].title + '". Two minutes is enough.';
    if (left[0]) return 'No open tasks. Check habit "' + left[0].title + '".';
    return 'Inbox is clear. Add one task or open calm.';
  };

  function tryLocal(text) {
    const raw = String(text || '').trim();
    const q = raw.toLowerCase();
    const app = fd();
    const S = state();
    const tasks = S.tasks || [];
    const open = tasks.filter((t) => !t.done);
    const events = S.events || [];
    const habits = S.habits || [];
    const moods = S.moods || [];
    if (/^(brief me|status|summary|catch me up|how am i doing)\b/.test(q)) {
      return 'Open ' + open.length + ', done ' + tasks.filter((t) => t.done).length + '. Blocks ' + events.length + '. Habits left today ' + habits.filter((h) => h.type !== 'bad' && !habitDone(h)).length + '. Minutes ' + ((document.getElementById('todayMin') || {}).textContent || '0') + '. ' + nextMove(S);
    }
    if (/^(what should i do|what next|what\'s next|whats next|next move|what do i work on)\b/.test(q)) {
      go(open.length ? 'tasks' : 'focus');
      return nextMove(S);
    }
    if (/\b(overwhelmed|too much|cannot start|can\'t start|cant start|frozen|stuck|staring)\b/.test(q)) {
      return 'Pick two minutes on "' + (open[0] ? open[0].title : 'one tiny step') + '". Say start focus when you sit down.';
    }
    const intent = q.match(/^(?:set )?(?:my )?intent(?: to| as)?\s*[:\-]?\s*(.+)$/i);
    if (intent && app) {
      const v = strip(intent[1]);
      if (app.setIntent) app.setIntent(v);
      else if (app.setState) app.setState({ timer: Object.assign({}, S.timer || {}, { intent: v }) });
      const el = document.getElementById('intentInput');
      if (el) el.value = v;
      go('focus');
      return 'Intent set: "' + v.slice(0, 80) + '".';
    }
    const addHabit = q.match(/^(?:add|create|new)\s+(?:a\s+)?habit(?:\s+(?:called|named|for|to))?\s*[:\-]?\s*(.+)$/i);
    if (addHabit && app) {
      const title = strip(addHabit[1]).slice(0, 80);
      if (app.addHabit) app.addHabit({ title: title, type: 'good' });
      else if (app.setState) app.setState({ habits: [{ id: uid(), type: 'good', title: title, enabled: true, history: {} }].concat(habits) });
      go('habits');
      return 'Added habit "' + title + '".';
    }
    const addBlock = q.match(/^(?:add|create|new|schedule)\s+(?:a\s+)?(?:plan |calendar )?(?:block|event)(?:\s+(?:called|named|for))?\s*[:\-]?\s*(.+)$/i);
    if (addBlock && app && app.addEvent) {
      const title = strip(addBlock[1]).slice(0, 80);
      app.addEvent({ title: title });
      go('plan');
      return 'Added a one-hour plan block "' + title + '".';
    }
    const doneHit = q.match(/^(?:mark )?(?:task )?["']?(.+?)["']? (?:as )?(?:done|finished|complete)$/i) || q.match(/^(?:complete|finish|done with|check off task)\s+["']?(.+?)["']?$/i);
    if (doneHit && app) {
      const needle = strip(doneHit[1]);
      const hit = find(tasks, needle);
      if (!hit || !app.setState) return hit ? 'Could not update that task.' : 'No task matches "' + needle + '".';
      app.setState({ tasks: tasks.map((t) => t.id === hit.id ? Object.assign({}, t, { done: !t.done }) : t) });
      go('tasks');
      return (hit.done ? 'Reopened: "' : 'Marked done: "') + hit.title + '".';
    }
    const checkHabit = q.match(/^(?:check(?: off)?|log|tick|did) (?:the )?habit ["']?(.+?)["']?$/i);
    if (checkHabit && app) {
      const needle = strip(checkHabit[1]);
      const hit = find(habits, needle);
      if (!hit || !app.setState) return hit ? 'Could not update that habit.' : 'No habit matches "' + needle + '".';
      const k = dayKey();
      app.setState({ habits: habits.map((h) => {
        if (h.id !== hit.id) return h;
        const history = Object.assign({}, h.history || {});
        if (history[k]) delete history[k]; else history[k] = true;
        return Object.assign({}, h, { history: history });
      }) });
      go('habits');
      return 'Updated habit "' + hit.title + '".';
    }
    const mood = q.match(/^(?:log|record|save) (?:a )?mood(?: as| of|:)?\s*(.+)$/i) || q.match(/^i(?:'m| am) feeling (rough|low|flat|meh|steady|fine|good|bright|great|calm|fried|tired)\b/i);
    if (mood && app) {
      const word = strip(mood[1]).toLowerCase().split(/\s+/)[0];
      const map = { rough: 1, low: 2, flat: 3, meh: 4, tired: 4, steady: 5, fine: 6, good: 7, bright: 8, great: 9, calm: 6, fried: 2 };
      const n = map[word] || 5;
      if (app.setState) app.setState({ moods: moods.concat([{ id: uid(), mood: n, energy: n, stress: 5, at: Date.now(), note: word }]) });
      go('mood');
      return 'Logged mood as ' + word + '. Opened Mood.';
    }
    const play = q.match(/^(?:play|start|turn on) (?:the )?(rain|ocean|brown|pink|fire|fireplace|cafe|tick|clock|binaural|bin)(?: noise)?$/i);
    if (play && app) {
      const id = SOUND[play[1].toLowerCase()];
      if (app.applyPreset) { const p = {}; p[id] = 60; app.applyPreset(p); }
      go('sound');
      return 'Playing ' + play[1] + '.';
    }
    if (/^(stop sound|stop sounds|mute|silence|turn off (the )?sound)/.test(q) && app) {
      if (app.applyPreset) app.applyPreset({ rain: 0, ocean: 0, brown: 0, pink: 0, fire: 0, cafe: 0, tick: 0, bin: 0 });
      return 'Sound layers off.';
    }
    if (/\b(q1|do first)\b/.test(q) && /\b(list|show|what|tasks)\b/.test(q)) {
      const list = open.filter((t) => t.quad === 'q1');
      go('matrix');
      return list.length ? 'Do-first: ' + list.slice(0, 6).map((t) => '"' + t.title + '"').join('; ') + '.' : 'Nothing in Q1.';
    }
    if (/^(list|show) (my |all )?moods\b/.test(q)) {
      go('mood');
      return moods.length ? 'Mood check-ins: ' + moods.length + '.' : 'No moods yet. Say I am feeling steady.';
    }
    if (/^what('?s| is) on (my )?(plan|calendar|schedule)\b/.test(q)) {
      go('plan');
      return events.length ? 'Plan blocks (' + events.length + '): ' + events.slice(0, 6).map((e) => '"' + e.title + '"').join('; ') + '.' : 'No plan blocks yet.';
    }
    return '';
  }

  window.StudyCoachExtra = { tryLocal: tryLocal };
})();
