/* Practice, writing, reading place, weekly review, and score privacy.
   Pure helpers. Minutes never become mastery. A generated note is never a key. */

export function blankProblem(id) {
  return { id, prompt: '', solution: '', source: '', generated: false, attempt: '', revealed: false };
}

export function canReveal(problem) {
  return String(problem && problem.attempt || '').trim().length > 0;
}

export function revealSolution(problem) {
  if (!canReveal(problem)) return { ok: false, reason: 'Write an attempt first.' };
  return { ok: true, problem: Object.assign({}, problem, { revealed: true }) };
}

export function solutionCaption(problem) {
  if (!problem || !problem.revealed) return '';
  if (problem.generated) return 'Generated note. Not a verified answer key.';
  const source = String(problem.source || '').trim();
  return source ? 'Source: ' + source : 'Your solution. Nothing else has checked it.';
}

export function blankDraft(id) {
  return { id, title: '', outline: '', body: '', criteria: [{ id: id + '-c', text: '', evidence: '' }] };
}

export function criterionState(item) {
  return String(item && item.evidence || '').trim() ? 'linked' : 'missing';
}

export function exportDraft(draft) {
  const d = draft || {};
  const lines = [
    d.title || 'Untitled draft',
    '',
    'Outline',
    d.outline || '(none)',
    '',
    'Draft',
    d.body || '(none)',
    '',
    'Rubric'
  ];
  (d.criteria || []).forEach((item, i) => {
    const state = criterionState(item);
    lines.push((i + 1) + '. ' + (item.text || 'Criterion') + ' — ' + (state === 'linked' ? item.evidence : 'Missing step'));
  });
  lines.push('', 'Private. This file is only a copy of what is on this device.');
  return lines.join('\n');
}

export function chunksOf(text, size) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const n = Math.max(8, Math.min(80, Number(size) || 40));
  if (!words.length) return [''];
  const out = [];
  for (let i = 0; i < words.length; i += n) out.push(words.slice(i, i + n).join(' '));
  return out;
}

export function placeInPassage(index, count) {
  const total = Math.max(1, Number(count) || 1);
  const at = Math.max(0, Math.min(total - 1, Number(index) || 0));
  return { index: at, line: 'Stopped at passage ' + (at + 1) + ' of ' + total + '.' };
}

export function weekReview({ done, open, deadlines, skipped, proposal }) {
  const next = String(proposal || '');
  if (skipped) {
    return {
      skipped: true,
      line: 'This week was skipped. That is not a failure. The plan below is still editable.',
      proposal: next
    };
  }
  return {
    skipped: false,
    line: 'Finished ' + (Number(done) || 0) + '. Still open: ' + (Number(open) || 0) + '. Deadlines in the next 7 days: ' + (Number(deadlines) || 0) + '.',
    proposal: next
  };
}

export function missedWeekLine() {
  return 'No review was saved. That is not a failure.';
}

export function learningProgress({ minutes, problems, drafts }) {
  const tried = (problems || []).filter(item => String(item && item.attempt || '').trim());
  const reviewed = tried.filter(item => item.revealed).length;
  const linked = (drafts || []).reduce((sum, draft) => {
    return sum + (draft.criteria || []).filter(item => criterionState(item) === 'linked').length;
  }, 0);
  const claims = [];
  if (reviewed) claims.push(reviewed + (reviewed === 1 ? ' reviewed attempt' : ' reviewed attempts'));
  if (linked) claims.push(linked + (linked === 1 ? ' linked criterion' : ' linked criteria'));
  return {
    mastery: reviewed + linked,
    minutes: Math.max(0, Number(minutes) || 0),
    tried: tried.length,
    claims
  };
}

/* Scores and the leaderboard stay on unless the person turns one off.
   The public card is a third, separate choice and is not decided here. */
export function scoreChrome({ scores, board } = {}) {
  return {
    scores: scores !== false,
    board: board !== false
  };
}
