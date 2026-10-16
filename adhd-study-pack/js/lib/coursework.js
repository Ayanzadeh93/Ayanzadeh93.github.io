/* Coursework planning. Pure: no DOM and no storage.
   A deadline is never a side effect of placing, moving, or shortening work.
   Free time is the only time a plan may use. Confidence is not mastery. */

export const MIN_BLOCK = 10;
export const MIN_SAMPLE = 3;
export const REVIEW_MINUTES = 25;

export const ASSIGNMENT_TEMPLATES = {
  reading: {
    label: 'Reading',
    milestones: [
      { title: 'Open the reading', estMin: 10 },
      { title: 'Read one section', estMin: 25 },
      { title: 'Write one sentence of what it said', estMin: 15 },
      { title: 'Note the next page', estMin: 10 }
    ],
    resources: [{ kind: 'link', title: 'Reading', url: '', note: '' }]
  },
  essay: {
    label: 'Essay',
    milestones: [
      { title: 'Write the claim in one sentence', estMin: 15 },
      { title: 'Add one piece of evidence', estMin: 25 },
      { title: 'Draft the next paragraph', estMin: 25 },
      { title: 'Read it once before you send it', estMin: 15 }
    ],
    resources: [{ kind: 'brief', title: 'Assignment brief', url: '', note: '' }]
  },
  lab: {
    label: 'Lab',
    milestones: [
      { title: 'Read the procedure', estMin: 15 },
      { title: 'Set up only what this step needs', estMin: 15 },
      { title: 'Run the step and write the number down', estMin: 25 },
      { title: 'Note what you would do differently', estMin: 15 }
    ],
    resources: [{ kind: 'link', title: 'Lab procedure', url: '', note: '' }]
  },
  coding: {
    label: 'Coding',
    milestones: [
      { title: 'Read the spec', estMin: 15 },
      { title: 'Make one small failing case', estMin: 20 },
      { title: 'Change the code', estMin: 25 },
      { title: 'Run it and write what changed', estMin: 15 }
    ],
    resources: [{ kind: 'link', title: 'Spec', url: '', note: '' }]
  },
  presentation: {
    label: 'Presentation',
    milestones: [
      { title: 'Say the point in one sentence', estMin: 10 },
      { title: 'Outline three beats', estMin: 15 },
      { title: 'Make the slides', estMin: 25 },
      { title: 'Rehearse once out loud', estMin: 20 }
    ],
    resources: [{ kind: 'note', title: 'Audience', url: '', note: 'Who is this for, and what should they leave knowing?' }]
  },
  exam: {
    label: 'Exam',
    milestones: [
      { title: 'List the topics that can be asked', estMin: 15 },
      { title: 'Practice one weak topic', estMin: 25 },
      { title: 'Review what you missed', estMin: 20 }
    ],
    resources: [{ kind: 'reference', title: 'What the exam covers', url: '', note: '' }],
    topics: ['First topic', 'Second topic', 'Third topic']
  }
};

const OFFICE_NOTE = 'Question I will ask:\nWhat I already tried:\n';
const SUPPORT_NOTE = 'I am stuck on:\nThe deadline is:\nWhat I need:\n';

export function draftAssignment(input, idFn) {
  const next = () => String(idFn());
  const kind = ASSIGNMENT_TEMPLATES[input && input.kind] ? input.kind : 'reading';
  const spec = ASSIGNMENT_TEMPLATES[kind];
  const subjectId = input && input.subjectId || null;
  const extras = new Set(input && input.extras || []);
  const resources = spec.resources.map((item) => ({
    id: next(),
    subjectId,
    title: item.title,
    url: item.url || '',
    note: item.note || '',
    kind: item.kind
  }));
  if (extras.has('office')) {
    resources.push({ id: next(), subjectId, title: 'Office hours', url: '', note: OFFICE_NOTE, kind: 'note' });
  }
  if (extras.has('support')) {
    resources.push({ id: next(), subjectId, title: 'Ask for support', url: '', note: SUPPORT_NOTE, kind: 'note' });
  }
  return {
    title: String(input && input.title || spec.label).trim() || spec.label,
    kind,
    subjectId,
    due: input && input.due || null,
    dueTz: input && input.dueTz || '',
    fromTemplate: spec.label,
    requirements: '',
    milestones: spec.milestones.map((item) => ({ id: next(), title: item.title, estMin: item.estMin, done: false })),
    resources,
    topics: (spec.topics || []).map((title) => ({ id: next(), title, confidence: null, evidence: 0 }))
  };
}

/** Drop one milestone, resource, or topic. The rest of the draft stays. No dates are added. */
export function dropDraftItem(draft, id) {
  const source = draft || {};
  return {
    title: source.title,
    kind: source.kind,
    subjectId: source.subjectId || null,
    due: source.due || null,
    dueTz: source.dueTz || '',
    fromTemplate: source.fromTemplate || '',
    requirements: source.requirements || '',
    milestones: (source.milestones || []).filter((item) => item.id !== id),
    resources: (source.resources || []).filter((item) => item.id !== id),
    topics: (source.topics || []).filter((item) => item.id !== id)
  };
}

export function deadlineLine(assignment) {
  const due = assignment && assignment.due ? assignment.due : 'not set';
  const tz = assignment && assignment.dueTz ? assignment.dueTz : 'timezone not recorded';
  const from = assignment && assignment.fromTemplate
    ? 'steps from the ' + String(assignment.fromTemplate).toLowerCase() + ' template'
    : 'steps you wrote';
  return 'Deadline ' + due + ' · ' + tz + ' · date set by you · ' + from;
}

function clock(mins) {
  const day = 24 * 60;
  const m = ((Math.round(mins) % day) + day) % day;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

function gapsForDay(day, window, busy, buffer, earliest) {
  const pad = Math.max(0, Math.round(buffer) || 0);
  const startMin = Math.max(0, Math.round(window && window.startMin) || 0);
  const endMin = Math.max(startMin, Math.round(window && window.endMin) || 0);
  const mine = (busy || []).filter((item) => item && item.day === day);
  if (mine.some((item) => item.allDay)) return { gaps: [], blocked: 'all-day' };
  let cursor = Math.max(startMin, earliest == null ? startMin : Math.round(earliest));
  const timed = mine
    .filter((item) => !item.allDay && item.endMin > item.startMin)
    .map((item) => ({ s: item.startMin - pad, e: item.endMin + pad, title: item.title || '' }))
    .sort((a, b) => a.s - b.s);
  const gaps = [];
  let after = '';
  timed.concat([{ s: endMin, e: endMin, title: '' }]).forEach((iv) => {
    const gapEnd = Math.min(endMin, iv.s);
    if (gapEnd - cursor >= MIN_BLOCK) gaps.push({ start: cursor, end: gapEnd, after });
    if (iv.e > cursor) {
      cursor = Math.max(cursor, iv.e);
      if (iv.title) after = iv.title;
    }
  });
  return { gaps, blocked: null };
}

/**
 * Place unfinished minutes into free gaps. Days blocked by an all-day item get nothing.
 * Work past the deadline, or past the free minutes, is overflow — not a made-up hour.
 * `due` on a returned block is a label for the screen. It is not a write to the deadline.
 */
export function proposePlan(opts) {
  const options = opts || {};
  const blockMin = Math.max(MIN_BLOCK, Math.round(options.blockMin) || 25);
  const cap = options.dayCapMin == null || options.dayCapMin === ''
    ? Infinity
    : Math.max(0, Math.round(options.dayCapMin));
  const work = (options.work || [])
    .filter((item) => item && !item.done && item.estMin >= MIN_BLOCK)
    .map((item, index) => Object.assign({}, item, { left: Math.round(item.estMin), _i: index }));
  work.sort((a, b) => String(a.due || '9999-99-99').localeCompare(String(b.due || '9999-99-99')) || a._i - b._i);
  const proposed = [];
  const used = {};
  const days = options.days || [];
  work.forEach((item) => {
    const blockedDays = [];
    let candidates = 0;
    days.forEach((day) => {
      if (item.left < MIN_BLOCK) return;
      if (item.due && day > item.due) return;
      candidates += 1;
      const earliest = day === options.today ? options.nowMin : null;
      const found = gapsForDay(day, options.window || { startMin: 8 * 60, endMin: 21 * 60 }, options.busy, options.bufferMin, earliest);
      if (found.blocked) { blockedDays.push(day); return; }
      let room = cap - (used[day] || 0);
      found.gaps.forEach((gap) => {
        let cursor = gap.start;
        while (item.left >= MIN_BLOCK && room >= MIN_BLOCK && cursor + MIN_BLOCK <= gap.end) {
          const take = Math.min(item.left, blockMin, room, gap.end - cursor);
          if (take < MIN_BLOCK) break;
          const due = item.due || 'unset';
          proposed.push({
            assignmentId: item.assignmentId || null,
            milestoneId: item.topicId ? null : item.id,
            topicId: item.topicId || null,
            title: item.title,
            day,
            startMin: cursor,
            endMin: cursor + take,
            due: item.due || null,
            why: (gap.after ? 'After ' + gap.after + '. ' : 'Nothing else is booked then. ')
              + clock(cursor) + '–' + clock(cursor + take) + '. Deadline stays ' + due + '.'
          });
          item.left -= take;
          room -= take;
          used[day] = (used[day] || 0) + take;
          cursor += take + Math.max(0, Math.round(options.bufferMin) || 0);
        }
      });
    });
    item._blocked = blockedDays;
    item._candidates = candidates;
  });
  const overflow = work.filter((item) => item.left >= MIN_BLOCK).map((item) => ({
    id: item.id,
    assignmentId: item.assignmentId || null,
    title: item.title,
    due: item.due || null,
    minutes: item.left,
    reason: item._candidates && item._blocked.length === item._candidates
      ? 'All-day items block ' + item._blocked.join(', ') + '. This stays unscheduled.'
      : 'Not enough free hours before the deadline. No time was added.'
  }));
  return {
    proposed,
    overflow,
    unsupported: (options.unsupported || []).slice(),
    deadlines: work.map((item) => ({ id: item.assignmentId || item.id, due: item.due || null }))
  };
}

export function eventsFromProposal(proposed) {
  return (proposed || []).map((item) => {
    const event = {
      title: item.title,
      kind: 'study',
      assignmentId: item.assignmentId || null,
      milestoneId: item.milestoneId || null,
      day: item.day,
      startMin: item.startMin,
      endMin: item.endMin
    };
    if (item.topicId) event.topicId = item.topicId;
    return event;
  });
}

export function withAcceptedPlan(assignments, proposed) {
  return {
    assignments: (assignments || []).map((item) => Object.assign({}, item)),
    events: eventsFromProposal(proposed)
  };
}

export function planTouchesDeadlines(events) {
  return (events || []).some((event) => Object.prototype.hasOwnProperty.call(event, 'due'));
}

export function blockOverlapsBusy(block, busy, buffer) {
  const pad = Math.max(0, buffer || 0);
  return (busy || []).some((item) => {
    if (!item || item.day !== block.day) return false;
    if (item.allDay) return true;
    return block.startMin < item.endMin + pad && block.endMin > item.startMin - pad;
  });
}

/** Missed unfinished blocks can move, shrink, or leave today. Completed blocks stay. */
export function previewReplan(blocks, nowMs, mode, today) {
  const list = (blocks || []).map((item) => Object.assign({}, item));
  const unchanged = list.filter((item) => item.done);
  const missed = list.filter((item) => !item.done && Number(item.endMs) <= Number(nowMs));
  const ahead = list.filter((item) => !item.done && Number(item.endMs) > Number(nowMs));
  const deadlines = list.map((item) => ({ id: item.assignmentId || item.id, due: item.due == null ? null : item.due }));
  if (mode === 'move') {
    return {
      mode,
      unchanged,
      ahead,
      missed,
      next: missed.map((item) => Object.assign({}, item, { place: 'later' })),
      dropIds: missed.map((item) => item.id),
      deadlines
    };
  }
  if (mode === 'shorten') {
    return {
      mode,
      unchanged,
      ahead,
      missed,
      next: missed.map((item) => Object.assign({}, item, {
        minutes: Math.max(MIN_BLOCK, Math.round((Number(item.minutes) || 0) / 2)),
        place: 'shorter'
      })),
      dropIds: [],
      deadlines
    };
  }
  const drop = missed.concat(ahead).filter((item) => item.day === today);
  return {
    mode: 'reduce',
    unchanged,
    ahead: ahead.filter((item) => item.day !== today),
    missed,
    next: [],
    dropIds: drop.map((item) => item.id),
    deadlines
  };
}

/** Active minutes only. A pause is not study time, and a short sample is not a precise number. */
export function activeMinutesOf(session) {
  if (!session) return 0;
  if (session.activeMin != null && session.activeMin !== '') return Math.max(0, Math.round(Number(session.activeMin) || 0));
  const minutes = Math.max(0, Math.round(Number(session.minutes) || 0));
  const paused = Math.max(0, Math.round(Number(session.pausedMin) || 0));
  return Math.max(0, minutes - paused);
}

export function calibrate(rows, opts) {
  const minSample = Math.max(1, (opts && opts.minSample) || MIN_SAMPLE);
  return (rows || []).map((row) => {
    const actuals = (row.sessions || []).map(activeMinutesOf).filter((minutes) => minutes > 0);
    const n = actuals.length;
    const estimate = Math.max(0, Math.round(Number(row.estimateMin) || 0));
    const base = { id: row.id, label: row.label || '', estimate, n, actual: null, low: null, high: null, suggestion: null };
    if (n < minSample) {
      return Object.assign(base, { reason: 'Not enough sessions to suggest a number.' });
    }
    const mean = actuals.reduce((sum, minutes) => sum + minutes, 0) / n;
    const sorted = actuals.slice().sort((a, b) => a - b);
    let low = sorted[Math.floor((n - 1) * 0.25)];
    let high = sorted[Math.ceil((n - 1) * 0.75)];
    if (high - low < 10) {
      low = Math.max(MIN_BLOCK, Math.round(mean * 0.75));
      high = Math.max(low + 10, Math.round(mean * 1.25));
    }
    return Object.assign(base, {
      actual: Math.round(mean),
      low: Math.round(low),
      high: Math.round(high),
      suggestion: { estimateMin: Math.round(mean) },
      reason: 'Active minutes only. Pauses are not included. Breaks belong in the buffer, not in this number.'
    });
  });
}

export function scaleEstimates(milestones, nextTotal) {
  const list = (milestones || []).map((item) => Object.assign({}, item));
  const open = list.filter((item) => !item.done && item.estMin > 0);
  const current = open.reduce((sum, item) => sum + item.estMin, 0);
  const target = Math.max(0, Math.round(Number(nextTotal) || 0));
  if (!current || !target) return list;
  const factor = target / current;
  return list.map((item) => item.done ? item : Object.assign({}, item, { estMin: Math.max(MIN_BLOCK, Math.round(item.estMin * factor)) }));
}

export function resourceStatus(resource) {
  if (!resource) return { ok: false, reason: 'Missing' };
  if (resource.removed) return { ok: false, reason: 'Removed' };
  const kind = resource.kind || 'link';
  if (kind === 'note' || kind === 'reference') {
    if (String(resource.note || '').trim() || String(resource.title || '').trim()) return { ok: true, reason: '' };
    return { ok: false, reason: 'Empty note' };
  }
  const url = String(resource.url || '').trim();
  if (!url) return { ok: false, reason: 'No link' };
  if (!/^https?:\/\//i.test(url)) return { ok: false, reason: 'Not a web link' };
  return { ok: true, reason: '' };
}

export function primaryResource(resources) {
  const list = (resources || []).filter((item) => item && (item.kind === 'link' || item.kind === 'brief'));
  if (!list.length) return null;
  const ok = list.find((item) => resourceStatus(item).ok);
  const pick = ok || list[0];
  const status = resourceStatus(pick);
  return { resource: pick, ok: status.ok, reason: status.reason || '' };
}

export function groupShelf(resources, subjects) {
  const known = new Set((subjects || []).map((item) => item.id));
  const groups = (subjects || []).map((item) => ({
    id: item.id,
    name: item.name,
    items: (resources || []).filter((resource) => resource.subjectId === item.id)
  }));
  const loose = (resources || []).filter((resource) => !resource.subjectId || !known.has(resource.subjectId));
  if (loose.length) groups.push({ id: '', name: 'No course', items: loose });
  return groups;
}

export function topicState(topic) {
  const evidence = Math.max(0, Math.round(Number(topic && topic.evidence) || 0));
  const confidence = topic && topic.confidence != null && topic.confidence !== '' ? Number(topic.confidence) : null;
  return { learned: evidence >= 1, evidence, confidence };
}

export function learnedLabel(topic) {
  const state = topicState(topic);
  if (state.learned) return 'Recalled once. Confidence is separate and is not what marked this.';
  if (state.confidence != null) return 'Not learned. Confidence is ' + state.confidence + ' and does not count.';
  return 'Not learned. A recall is what counts, not a feeling of readiness.';
}

/** Unlearned topics only. A high confidence score never removes one from the list. */
export function examMap(topics, freeMin) {
  const rows = (topics || []).map((topic) => Object.assign({}, topic, topicState(topic)));
  const open = rows
    .filter((topic) => !topic.learned)
    .sort((a, b) => a.evidence - b.evidence || String(a.title).localeCompare(String(b.title)));
  let left = Math.max(0, Math.round(Number(freeMin) || 0));
  const proposed = [];
  const waiting = [];
  open.forEach((topic) => {
    if (left >= REVIEW_MINUTES) {
      proposed.push({ topicId: topic.id, title: topic.title, minutes: REVIEW_MINUTES });
      left -= REVIEW_MINUTES;
    } else {
      waiting.push({ topicId: topic.id, title: topic.title, minutes: REVIEW_MINUTES });
    }
  });
  const budget = Math.max(0, Math.round(Number(freeMin) || 0));
  return { topics: rows, proposed, waiting, freeMin: budget, used: budget - left };
}
