/* Focus clock runtime. Pure: no DOM and no storage.
   Paused minutes never count. A reload continues the same deadline.
   Crossing the deadline completes once, and the logged length cannot
   grow past the interval that was set. */

export function activeMsOf(run, now) {
  const base = Math.max(0, Number(run && run.activeMs) || 0);
  if (!run || !run.running || run.startedAt == null) return base;
  const until = run.endsAt && now > run.endsAt ? run.endsAt : now;
  return base + Math.max(0, until - run.startedAt);
}

/** Whole minutes of real running time, never more than the planned interval. */
export function activeMinutes(run, now, plannedMin) {
  const cap = Math.max(0, Number(plannedMin) || 0) * 60000;
  let ms = activeMsOf(run, now);
  if (cap) ms = Math.min(ms, cap);
  return Math.round(ms / 60000);
}

export function pauseRun(run, now) {
  const source = run || {};
  const end = source.running && source.endsAt ? Math.min(now, source.endsAt) : now;
  const remain = source.running
    ? Math.max(0, (source.endsAt || now) - end)
    : Math.max(0, Number(source.remain) || 0);
  return {
    running: false,
    endsAt: 0,
    remain,
    startedAt: 0,
    activeMs: activeMsOf(source, end),
    sessionId: source.sessionId || '',
    logged: !!source.logged
  };
}

export function startRun(run, now) {
  const source = run || {};
  const remain = Math.max(0, Number(source.remain) || 0);
  return {
    running: true,
    endsAt: now + remain,
    remain,
    startedAt: now,
    activeMs: Math.max(0, Number(source.activeMs) || 0),
    sessionId: source.sessionId || '',
    logged: false
  };
}

/** What a saved clock should do at `now`. */
export function restoreRun(saved, now) {
  const run = saved && typeof saved === 'object' ? saved : {};
  if (!run.sessionId || run.logged) return { action: 'idle' };
  if (run.running && run.endsAt) {
    if (now >= run.endsAt) return { action: 'complete', run: pauseRun(run, run.endsAt) };
    return {
      action: 'continue',
      run: {
        running: true,
        endsAt: run.endsAt,
        remain: run.endsAt - now,
        startedAt: run.startedAt || (run.endsAt - (run.remain || (run.endsAt - now))),
        activeMs: Math.max(0, Number(run.activeMs) || 0),
        sessionId: run.sessionId,
        logged: false
      }
    };
  }
  if ((Number(run.remain) || 0) > 0 || (Number(run.activeMs) || 0) > 0) {
    return { action: 'paused', run: pauseRun(Object.assign({}, run, { running: false }), now) };
  }
  return { action: 'idle' };
}
