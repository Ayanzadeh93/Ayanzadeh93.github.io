/** Resolve a breathing phase from elapsed time, including background-tab gaps. */
export function breathingFrame(steps, elapsedMs) {
  if (!Array.isArray(steps) || !steps.length || steps.some(step =>
    !Array.isArray(step) || !Number.isFinite(step[1]) || step[1] <= 0)) {
    throw new TypeError('Breathing steps need positive durations.');
  }
  const durations = steps.map(step => step[1] * 1000);
  const cycleMs = durations.reduce((total, duration) => total + duration, 0);
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const cycles = Math.floor(elapsed / cycleMs);
  let within = elapsed % cycleMs;
  let index = 0;
  while (index < durations.length - 1 && within >= durations[index]) {
    within -= durations[index++];
  }
  return { index, cycles, label: String(steps[index][0]),
    durationMs: durations[index], remainingMs: durations[index] - within,
    elapsedMs: elapsed };
}
