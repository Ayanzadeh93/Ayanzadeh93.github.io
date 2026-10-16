/* Coursework on the Plan screen. The rules live in js/lib/coursework.js. */
import {
  ASSIGNMENT_TEMPLATES, REVIEW_MINUTES, draftAssignment, dropDraftItem, deadlineLine,
  proposePlan, eventsFromProposal, previewReplan, calibrate, scaleEstimates,
  resourceStatus, topicState, learnedLabel, groupShelf
} from './lib/coursework.js?v=4.45.0';

const KINDS = Object.keys(ASSIGNMENT_TEMPLATES);

export function mountCoursework(api) {
  let on = false;
  let force = false;
  let bound = false;

  const S = () => api.getS();
  const esc = api.esc;

  function commit() {
    force = true;
    api.save();
    if (api.renderTasks) api.renderTasks();
    if (api.renderFocus) api.renderFocus();
    render();
  }

  function syncTask(assignment) {
    const state = S();
    const focus = Math.max(15, +(state.settings && state.settings.focus) || 25);
    const total = (assignment.milestones || []).reduce((sum, step) => sum + (step.done ? 0 : (+step.estMin || 0)), 0);
    let task = (state.tasks || []).find((item) => item.id === assignment.taskId);
    if (!task) {
      task = {
        id: api.uid(), title: assignment.title, est: 1, energy: 'med', subjectId: assignment.subjectId || null,
        quad: null, priority: null, due: assignment.due || null, plan: null, someday: false, repeat: null,
        done: false, done_pomos: 0, created: Date.now(), steps: [], assignmentId: assignment.id
      };
      state.tasks.unshift(task);
      assignment.taskId = task.id;
    }
    task.title = assignment.title;
    task.due = assignment.due || null;
    task.subjectId = assignment.subjectId || null;
    task.assignmentId = assignment.id;
    task.est = Math.max(1, Math.round(total / focus) || 1);
    task.steps = (assignment.milestones || []).map((step) => ({ id: step.id, title: step.title, done: !!step.done }));
    return task;
  }

  function daysAhead(count) {
    const start = api.startOfDay(new Date());
    return Array.from({ length: count }, (_, i) => api.dayKey(new Date(+start + i * api.DAY)));
  }

  function busyFor(days) {
    const busy = [];
    const items = api.calendarItems();
    days.forEach((day) => {
      items.forEach((event) => {
        if (!event || !event.start || isNaN(+new Date(event.start))) return;
        if (event.allDay) {
          if (api.coversAllDay(event, day)) busy.push({ day, allDay: true, title: event.title || 'All day' });
          return;
        }
        if (event.free) return;
        const start = new Date(event.start);
        if (api.dayKey(start) !== day) return;
        const end = new Date(event.end || event.start);
        if (!(end > start)) return;
        const startMin = start.getHours() * 60 + start.getMinutes();
        const endMin = api.dayKey(end) === day ? end.getHours() * 60 + end.getMinutes() : 24 * 60;
        if (endMin <= startMin) return;
        busy.push({ day, allDay: false, title: event.title || 'Busy', startMin, endMin });
      });
    });
    return busy;
  }

  function unsupportedItems() {
    const out = [];
    api.calendarItems().forEach((event) => {
      if (!event) return;
      const title = event.title || 'Calendar item';
      if (event.recurrence && !event.start) out.push({ title, reason: 'Repeats, but this copy has no dates.' });
      else if (!event.start || isNaN(+new Date(event.start))) out.push({ title, reason: 'No start time.' });
      else if (!event.allDay && event.end && !(new Date(event.end) > new Date(event.start))) out.push({ title, reason: 'End is not after the start.' });
    });
    return out;
  }

  function planOptions(work) {
    const state = S();
    const now = new Date();
    const hours = state.settings && state.settings.dayCapHours != null ? +state.settings.dayCapHours : 3;
    const { a, b } = api.winHours();
    return proposePlan({
      work,
      busy: busyFor(daysAhead(21)),
      unsupported: unsupportedItems(),
      days: daysAhead(21),
      window: { startMin: a * 60, endMin: b * 60 },
      blockMin: Math.max(10, +state.settings.focus || 25),
      bufferMin: state.settings && state.settings.bufferMin != null ? +state.settings.bufferMin : 10,
      dayCapMin: Math.max(0, hours) * 60,
      today: api.dayKey(now),
      nowMin: now.getHours() * 60 + now.getMinutes()
    });
  }

  function placeEvents(proposed) {
    const state = S();
    const before = (state.assignments || []).map((item) => item.due || null);
    eventsFromProposal(proposed).forEach((item) => {
      const assignment = (state.assignments || []).find((row) => row.id === item.assignmentId);
      const start = api.keyToDate(item.day);
      start.setHours(0, item.startMin, 0, 0);
      const end = api.keyToDate(item.day);
      end.setHours(0, item.endMin, 0, 0);
      state.events.push({
        id: api.uid(), title: item.title, kind: 'study',
        subjectId: assignment && assignment.subjectId || null,
        taskId: assignment && assignment.taskId || null,
        assignmentId: item.assignmentId, milestoneId: item.milestoneId, topicId: item.topicId || null,
        start: start.toISOString(), end: end.toISOString()
      });
      if (assignment && assignment.taskId) {
        const task = (state.tasks || []).find((row) => row.id === assignment.taskId);
        if (task && item.day && (!task.plan || item.day < task.plan)) task.plan = item.day;
      }
    });
    const after = (state.assignments || []).map((item) => item.due || null);
    if (before.join('|') !== after.join('|')) throw new Error('A plan changed a deadline.');
  }

  function openFit(work, note) {
    const plan = planOptions(work);
    const blocks = plan.proposed.map((item) => `<li><strong>${esc(item.title)}</strong><br>${esc(item.day)} · ${esc(item.why)}</li>`).join('');
    const over = plan.overflow.map((item) => `<li>${esc(item.title)} · ${item.minutes} min. ${esc(item.reason)}</li>`).join('');
    const bad = plan.unsupported.map((item) => `<li>${esc(item.title)} · ${esc(item.reason)}</li>`).join('');
    const review = (plan.proposed || []).some((item) => item.topicId);
    api.openModal('Fit into free hours', `
      <p style="margin:0">Accepting this does not change a deadline. All-day items block that day. Time that does not fit stays off the calendar.</p>
      ${note ? `<p class="hint">${esc(note)}</p>` : ''}
      ${review ? '<p class="hint">A review on the calendar does not mark a topic learned.</p>' : ''}
      ${bad ? `<p class="hint">Not treated as free time</p><ul>${bad}</ul>` : ''}
      ${blocks ? `<p class="hint">Proposed</p><ul>${blocks}</ul>` : '<p>Nothing fit into the free hours.</p>'}
      ${over ? `<p class="hint">Still unscheduled</p><ul>${over}</ul>` : ''}`,
    [
      { label: 'Not now' },
      plan.proposed.length ? { label: 'Put these on the week', primary: true, onClick: () => {
        placeEvents(plan.proposed);
        api.toast('On the week. Deadlines stay put.');
        api.save();
        if (api.renderTasks) api.renderTasks();
        if (api.renderCalendar) api.renderCalendar();
      } } : null
    ].filter(Boolean));
  }

  function assignmentWork() {
    const items = [];
    (S().assignments || []).forEach((assignment) => {
      if (assignment.done) return;
      (assignment.milestones || []).forEach((step) => {
        if (step.done || !(step.estMin >= 10)) return;
        items.push({
          id: step.id, assignmentId: assignment.id, title: assignment.title + ' — ' + step.title,
          due: assignment.due || null, estMin: Math.round(step.estMin), done: false
        });
      });
    });
    return items;
  }

  function openReplan() {
    const blocks = (S().events || []).filter((event) => event.assignmentId || event.milestoneId || event.topicId).map((event) => {
      const state = S();
      const assignment = (state.assignments || []).find((item) => item.id === event.assignmentId);
      const step = assignment && (assignment.milestones || []).find((item) => item.id === event.milestoneId);
      const topic = (state.topics || []).find((item) => item.id === event.topicId);
      const start = new Date(event.start), end = new Date(event.end);
      return {
        id: event.id,
        done: !!(step && step.done) || !!(topic && topic.evidence >= 1),
        startMs: +start, endMs: +end, day: api.dayKey(start),
        due: assignment ? assignment.due || null : null,
        minutes: Math.max(10, Math.round((+end - +start) / 60000) || 25),
        title: event.title, assignmentId: event.assignmentId || null,
        milestoneId: event.milestoneId || null, topicId: event.topicId || null
      };
    });
    const now = Date.now();
    const today = api.dayKey(new Date());
    const missed = previewReplan(blocks, now, 'move', today);
    if (!missed.missed.length && !previewReplan(blocks, now, 'reduce', today).dropIds.length) {
      api.toast('No missed coursework block.');
      return;
    }
    const applyDrop = (ids) => {
      const state = S();
      const drop = new Set(ids);
      const touched = blocks.filter((item) => drop.has(item.id)).map((item) => item.assignmentId);
      state.events = (state.events || []).filter((event) => !drop.has(event.id));
      const taskIds = new Set((state.assignments || []).filter((item) => touched.includes(item.id)).map((item) => item.taskId));
      state.meta.commitments = (state.meta.commitments || []).filter((id) => !taskIds.has(id));
    };
    api.openModal('A block was missed', `
      <p style="margin:0">${missed.missed.length} unfinished block${missed.missed.length === 1 ? '' : 's'} already ended. Finished work stays. None of these choices change a deadline.</p>
      <ul>${missed.missed.slice(0, 6).map((item) => `<li>${esc(item.title)} · deadline ${esc(item.due || 'not set')}</li>`).join('')}</ul>`,
    [
      { label: 'Not now' },
      { label: 'Take today off the plan', onClick: () => {
        const preview = previewReplan(blocks, now, 'reduce', today);
        applyDrop(preview.dropIds);
        api.toast('Today’s unfinished blocks are off the plan. Deadlines stay.');
        api.save();
        if (api.renderCalendar) api.renderCalendar();
      } },
      { label: 'Shorten what’s left', onClick: () => {
        const preview = previewReplan(blocks, now, 'shorten', today);
        preview.next.forEach((item) => {
          const assignment = (S().assignments || []).find((row) => row.id === item.assignmentId);
          const step = assignment && (assignment.milestones || []).find((row) => row.id === item.milestoneId);
          if (step && !step.done) step.estMin = item.minutes;
          if (assignment) syncTask(assignment);
        });
        api.toast('The next try is shorter. The deadline is unchanged.');
        api.save();
        if (api.renderCalendar) api.renderCalendar();
      } },
      { label: 'Move what’s left', primary: true, onClick: () => {
        const preview = previewReplan(blocks, now, 'move', today);
        const state = S();
        const drop = new Set(preview.dropIds);
        state.events = (state.events || []).filter((event) => !drop.has(event.id));
        const work = preview.next.map((item) => ({
          id: item.milestoneId || item.topicId || item.id,
          topicId: item.topicId || null,
          assignmentId: item.assignmentId,
          title: item.title,
          due: item.due,
          estMin: item.minutes,
          done: false
        }));
        api.save();
        openFit(work, 'The missed blocks were taken off the week. This is only a new place for them.');
        return false;
      } }
    ]);
  }

  function readDraft(body) {
    const title = (api.$('#cwTitle', body).value || '').trim();
    const due = api.$('#cwDue', body).value || '';
    if (!title) { api.toast('Name the assignment.'); return null; }
    if (!due) { api.toast('Add a deadline. The plan will not invent one.'); return null; }
    const kind = api.$('#cwKind', body).value;
    const subjectId = api.$('#cwCourse', body).value || null;
    const extras = [];
    if (api.$('#cwOffice', body).checked) extras.push('office');
    if (api.$('#cwSupport', body).checked) extras.push('support');
    return draftAssignment({
      kind, title, due, subjectId, dueTz: api.timeZone(), extras
    }, api.uid);
  }

  function saveDraft(draft) {
    const state = S();
    const id = api.uid();
    const assignment = {
      id, title: draft.title, kind: draft.kind, subjectId: draft.subjectId || null,
      due: draft.due, dueTz: draft.dueTz || api.timeZone(), fromTemplate: draft.fromTemplate,
      requirements: draft.requirements || '', milestones: draft.milestones, taskId: null, done: false, created: Date.now()
    };
    state.assignments = state.assignments || [];
    state.resources = state.resources || [];
    state.topics = state.topics || [];
    state.assignments.unshift(assignment);
    draft.resources.forEach((item) => {
      state.resources.push(Object.assign({}, item, { assignmentId: id, subjectId: assignment.subjectId }));
    });
    draft.topics.forEach((item) => state.topics.push(Object.assign({ assignmentId: id }, item)));
    syncTask(assignment);
    api.toast('Draft saved. Nothing was put on the calendar. Deadline is ' + assignment.due + '.');
    commit();
    if (api.renderCalendar) api.renderCalendar();
  }

  function reviewDraft(draft) {
    const steps = draft.milestones.map((step) => `<li>${esc(step.title)} · ${step.estMin} min <button type="button" class="btn sm" data-drop="${esc(step.id)}">Remove step</button></li>`).join('');
    const resources = draft.resources.map((item) => `<li>${esc(item.title)} · ${esc(item.kind)} <button type="button" class="btn sm" data-drop="${esc(item.id)}">Remove</button></li>`).join('');
    const topics = (draft.topics || []).map((item) => `<li>${esc(item.title)} <button type="button" class="btn sm" data-drop="${esc(item.id)}">Remove topic</button></li>`).join('');
    api.openModal('Review the draft', `
      <p style="margin:0">${esc(deadlineLine(draft))}. Nothing here is a calendar block. You can remove any step and keep the rest.</p>
      <p class="hint">Steps</p><ul>${steps || '<li>No steps. You can still save the deadline.</li>'}</ul>
      <p class="hint">Shelf</p><ul>${resources || '<li>No links yet.</li>'}</ul>
      ${draft.kind === 'exam' ? `<p class="hint">Topics. Confidence is not on this draft.</p><ul>${topics}</ul>` : ''}`,
    [
      { label: 'Cancel' },
      { label: 'Save the draft', primary: true, onClick: () => saveDraft(draft) }
    ], (body) => {
      api.$$('[data-drop]', body).forEach((button) => button.onclick = () => {
        reviewDraft(dropDraftItem(draft, button.dataset.drop));
      });
    });
  }

  function openDraft(seed) {
    const state = S();
    const current = seed || { kind: 'reading', title: '', due: '', subjectId: '', office: false, support: false };
    api.openModal('New assignment', `
      <p style="margin:0">Pick a template, then a deadline. The steps stay a draft until you fit them into free hours.</p>
      <div class="field"><label for="cwTitle">Name</label><input id="cwTitle" type="text" maxlength="160" value="${esc(current.title || '')}"></div>
      <div class="field"><label for="cwKind">Template</label><select id="cwKind">${KINDS.map((kind) => `<option value="${kind}" ${current.kind === kind ? 'selected' : ''}>${esc(ASSIGNMENT_TEMPLATES[kind].label)}</option>`).join('')}</select></div>
      <div class="field"><label for="cwCourse">Course</label><select id="cwCourse"><option value="">No course</option>${(state.subjects || []).map((item) => `<option value="${esc(item.id)}" ${current.subjectId === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="cwDue">Deadline</label><input id="cwDue" type="date" value="${esc(current.due || '')}"></div>
      <label><input id="cwOffice" type="checkbox" ${current.office ? 'checked' : ''}> Add an office-hours note</label>
      <label><input id="cwSupport" type="checkbox" ${current.support ? 'checked' : ''}> Add a support note</label>`,
    [
      { label: 'Cancel' },
      { label: 'Review the draft', primary: true, onClick: () => {
        const body = api.$('#modalBody');
        const draft = readDraft(body);
        if (!draft) return false;
        reviewDraft(draft);
        return false;
      } }
    ]);
  }

  function html() {
    const state = S();
    const hours = state.settings && state.settings.dayCapHours != null ? state.settings.dayCapHours : 3;
    const buffer = state.settings && state.settings.bufferMin != null ? state.settings.bufferMin : 10;
    const assignments = state.assignments || [];
    const rows = assignments.filter((item) => !item.done).map((item) => ({
      id: item.id,
      label: item.title,
      estimateMin: (item.milestones || []).filter((step) => !step.done).reduce((sum, step) => sum + (+step.estMin || 0), 0),
      sessions: (state.sessions || []).filter((session) => session.taskId && session.taskId === item.taskId)
    }));
    const stats = calibrate(rows);
    const shown = stats.filter((stat) => stat.n > 0);
    const estimates = shown.map((stat) => {
      const range = stat.suggestion ? `${stat.actual} active min across ${stat.n} sessions, range ${stat.low}–${stat.high}. ` : `${stat.n} session${stat.n === 1 ? '' : 's'}. `;
      return `<div class="cw-card"><strong>${esc(stat.label)}</strong><p class="hint">Estimate ${stat.estimate} min. ${range}${esc(stat.reason)}</p>
        ${stat.suggestion ? `<div class="cw-row"><button type="button" class="btn sm" data-cw="use" data-id="${esc(stat.id)}">Use ${stat.suggestion.estimateMin} min</button><button type="button" class="btn sm" data-cw="skip" data-id="${esc(stat.id)}">Not now</button></div>` : ''}</div>`;
    }).join('');
    const cards = assignments.map((item) => {
      const steps = (item.milestones || []).map((step) => `<li><label><input type="checkbox" data-cw="step" data-id="${esc(item.id)}" data-step="${esc(step.id)}" ${step.done ? 'checked' : ''}> ${esc(step.title)}</label>
        <input type="number" min="10" max="240" data-cw="est" data-id="${esc(item.id)}" data-step="${esc(step.id)}" value="${+step.estMin || 10}" aria-label="Minutes for ${esc(step.title)}">
        <button type="button" class="btn sm" data-cw="del-step" data-id="${esc(item.id)}" data-step="${esc(step.id)}">Remove step</button></li>`).join('');
      const topics = (state.topics || []).filter((topic) => topic.assignmentId === item.id).map((topic) => `<li><input type="text" data-cw="topic" data-id="${esc(topic.id)}" value="${esc(topic.title)}" aria-label="Topic name" maxlength="80">
        <label>Confidence <select data-cw="conf" data-id="${esc(topic.id)}"><option value="">—</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(topic.confidence) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <span>${esc(learnedLabel(topic))}</span>
        <button type="button" class="btn sm" data-cw="recall" data-id="${esc(topic.id)}">I recalled this</button></li>`).join('');
      return `<article class="cw-card" data-assignment="${esc(item.id)}"><h3>${esc(item.title)}</h3><p class="hint">${esc(deadlineLine(item))}</p>
        <div class="cw-row"><label>Deadline <input type="date" data-cw="due" data-id="${esc(item.id)}" value="${esc(item.due || '')}"></label>
          <button type="button" class="btn sm" data-cw="focus" data-id="${esc(item.id)}">Focus</button>
          <button type="button" class="btn sm" data-cw="del-as" data-id="${esc(item.id)}">Remove assignment</button></div>
        <label for="req-${esc(item.id)}">Requirements</label>
        <textarea id="req-${esc(item.id)}" data-cw="req" data-id="${esc(item.id)}" rows="2" maxlength="2000">${esc(item.requirements || '')}</textarea>
        <p class="hint">Steps. Removing one keeps the rest. They are not on the calendar yet.</p><ul>${steps}</ul>
        <form data-cw="add-step" data-id="${esc(item.id)}" class="cw-row"><input type="text" name="step" maxlength="160" aria-label="Add a step" placeholder="Add a step"><button class="btn sm" type="submit">Add step</button></form>
        ${item.kind === 'exam' || topics ? `<p class="hint">Exam map. A high confidence score does not mark a topic learned.</p><ul>${topics}</ul>
          <div class="cw-row"><button type="button" class="btn sm" data-cw="add-topic" data-id="${esc(item.id)}">Add a topic</button>
          <button type="button" class="btn sm" data-cw="reviews" data-id="${esc(item.id)}">Plan reviews in free time</button></div>` : ''}
      </article>`;
    }).join('');
    const shelf = groupShelf(state.resources || [], state.subjects || []).map((group) => {
      const items = group.items.map((item) => {
        const status = resourceStatus(item);
        const open = status.ok && /^https?:\/\//i.test(item.url || '')
          ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open</a>`
          : `<span class="cw-miss">${esc(status.reason || 'Missing')}</span>`;
        return `<li data-resource="${esc(item.id)}"><strong>${esc(item.title || 'Untitled')}</strong> · ${esc(item.kind || 'link')} ${open}
          ${item.kind === 'note' || item.kind === 'reference' ? `<span>${esc(item.note || '')}</span>` : `<input type="url" data-cw="url" data-id="${esc(item.id)}" value="${esc(item.url || '')}" placeholder="https://" aria-label="Link for ${esc(item.title || 'resource')}">`}
          <button type="button" class="btn sm" data-cw="remove-res" data-id="${esc(item.id)}">Remove</button></li>`;
      }).join('');
      return `<div class="cw-card"><h3>${esc(group.name)}</h3>${items ? `<ul>${items}</ul>` : '<p class="hint">Nothing on this shelf.</p>'}</div>`;
    }).join('');
    return `<div class="cw-row">
        <label>Hours I can use in a day <input id="cwHours" type="number" min="0.5" max="12" step="0.5" value="${esc(hours)}"></label>
        <label>Buffer between blocks <input id="cwBuffer" type="number" min="0" max="90" step="5" value="${esc(buffer)}"> min</label>
      </div>
      <p class="hint">The buffer is for breaks. Study minutes below leave pauses out. A fit will not book over an all-day item, and it will not change a deadline.</p>
      <div class="cw-row">
        <button type="button" class="btn" data-cw="add">New assignment</button>
        <button type="button" class="btn" data-cw="fit">Fit into free hours</button>
        <button type="button" class="btn" data-cw="replan">A block was missed</button>
      </div>
      ${estimates ? `<h3>Estimates</h3>${estimates}` : (assignments.length ? '<p class="hint">Estimates show up after a few timed sessions. Pauses are not counted, and a short sample is not turned into a number.</p>' : '')}
      <h3>Assignments</h3>
      ${cards || '<p class="hint">No assignment yet. A template makes steps you can edit. It does not fill the week.</p>'}
      <h3>Course shelf</h3>
      ${shelf || '<p class="hint">Add a course, then a link or a note. Files are not uploaded.</p>'}
      <form data-cw="add-res" class="cw-card cw-row">
        <label>Course <select name="course"><option value="">No course</option>${(state.subjects || []).map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select></label>
        <label>Kind <select name="kind"><option value="link">Link</option><option value="note">Note</option><option value="brief">Brief</option><option value="reference">Topic reference</option></select></label>
        <label>Title <input name="title" type="text" maxlength="120"></label>
        <label>Link or note <input name="body" type="text" maxlength="500"></label>
        <button class="btn" type="submit">Add to the shelf</button>
      </form>`;
  }

  function onClick(event) {
    const button = event.target.closest('[data-cw]');
    if (!button || button.tagName === 'FORM') return;
    const state = S();
    const id = button.dataset.id;
    const action = button.dataset.cw;
    const assignment = (state.assignments || []).find((item) => item.id === id);
    if (action === 'add') openDraft();
    else if (action === 'fit') {
      const work = assignmentWork();
      if (!work.length) { api.toast('Add an assignment with a step first.'); return; }
      openFit(work);
    } else if (action === 'replan') openReplan();
    else if (action === 'use' && assignment) {
      const stat = calibrate([{
        id: assignment.id, label: assignment.title,
        estimateMin: (assignment.milestones || []).filter((step) => !step.done).reduce((sum, step) => sum + (+step.estMin || 0), 0),
        sessions: (state.sessions || []).filter((session) => session.taskId === assignment.taskId)
      }])[0];
      if (!stat || !stat.suggestion) return;
      const due = assignment.due;
      assignment.milestones = scaleEstimates(assignment.milestones, stat.suggestion.estimateMin);
      assignment.due = due;
      syncTask(assignment);
      api.toast('Estimate updated. The deadline is unchanged.');
      commit();
    } else if (action === 'skip') api.toast('Estimate left as it is.');
    else if (action === 'focus' && assignment) {
      const task = syncTask(assignment);
      api.save();
      api.focusTask(task.id);
    } else if (action === 'del-as' && assignment) {
      state.assignments = state.assignments.filter((item) => item.id !== id);
      state.topics = (state.topics || []).filter((item) => item.assignmentId !== id);
      state.resources = (state.resources || []).filter((item) => item.assignmentId !== id);
      api.toast('The assignment is gone. The task, and blocks already on the week, stay.');
      commit();
    } else if (action === 'del-step' && assignment) {
      assignment.milestones = (assignment.milestones || []).filter((step) => step.id !== button.dataset.step);
      syncTask(assignment);
      commit();
    } else if (action === 'recall') {
      const topic = (state.topics || []).find((item) => item.id === id);
      if (!topic) return;
      const confidence = topic.confidence;
      topic.evidence = Math.max(0, Math.round(+topic.evidence || 0) + 1);
      topic.confidence = confidence;
      api.toast(learnedLabel(topic));
      commit();
    } else if (action === 'add-topic' && assignment) {
      state.topics = state.topics || [];
      state.topics.push({ id: api.uid(), assignmentId: assignment.id, title: 'New topic', confidence: null, evidence: 0 });
      commit();
    } else if (action === 'reviews' && assignment) {
      const work = (state.topics || []).filter((topic) => topic.assignmentId === assignment.id && !topicState(topic).learned).map((topic) => ({
        id: topic.id, topicId: topic.id, assignmentId: assignment.id, title: 'Review: ' + topic.title,
        due: assignment.due || null, estMin: REVIEW_MINUTES, done: false
      }));
      if (!work.length) { api.toast('Every topic already has a recall, or there are no topics.'); return; }
      openFit(work, 'Only topics without a recall are here. Confidence did not remove any.');
    } else if (action === 'remove-res') {
      const resource = (state.resources || []).find((item) => item.id === id);
      if (resource) resource.removed = true;
      commit();
    }
  }

  function onChange(event) {
    const el = event.target;
    const state = S();
    if (el.id === 'cwHours') {
      state.settings.dayCapHours = Math.min(12, Math.max(0.5, +el.value || 3));
      api.save();
      return;
    }
    if (el.id === 'cwBuffer') {
      state.settings.bufferMin = Math.min(90, Math.max(0, +el.value || 0));
      api.save();
      return;
    }
    const id = el.dataset.id;
    const action = el.dataset.cw;
    const assignment = (state.assignments || []).find((item) => item.id === id);
    if (action === 'due' && assignment) {
      assignment.due = el.value || null;
      const task = (state.tasks || []).find((item) => item.id === assignment.taskId);
      if (task) task.due = assignment.due;
      api.toast(assignment.due ? 'Deadline is ' + assignment.due + '. Blocks already on the week were not moved.' : 'Deadline cleared.');
      commit();
    } else if (action === 'req' && assignment) {
      assignment.requirements = el.value.slice(0, 2000);
      api.save();
    } else if (action === 'est' && assignment) {
      const step = (assignment.milestones || []).find((item) => item.id === el.dataset.step);
      if (step) step.estMin = Math.min(240, Math.max(10, +el.value || 10));
      syncTask(assignment);
      api.save();
    } else if (action === 'step' && assignment) {
      const step = (assignment.milestones || []).find((item) => item.id === el.dataset.step);
      if (step) step.done = el.checked;
      syncTask(assignment);
      commit();
    } else if (action === 'topic') {
      const topic = (state.topics || []).find((item) => item.id === id);
      if (topic) topic.title = el.value.slice(0, 80) || 'Topic';
      api.save();
    } else if (action === 'conf') {
      const topic = (state.topics || []).find((item) => item.id === id);
      if (!topic) return;
      topic.confidence = el.value ? +el.value : null;
      api.toast(learnedLabel(topic));
      commit();
    } else if (action === 'url') {
      const resource = (state.resources || []).find((item) => item.id === id);
      if (resource) {
        resource.url = el.value.trim().slice(0, 500);
        if (/^https?:\/\//i.test(resource.url)) resource.removed = false;
      }
      api.save();
    }
  }

  function onSubmit(event) {
    const form = event.target.closest('form');
    if (!form || !form.dataset.cw) return;
    event.preventDefault();
    const state = S();
    if (form.dataset.cw === 'add-step') {
      const assignment = (state.assignments || []).find((item) => item.id === form.dataset.id);
      const input = api.$('input', form);
      const title = (input && input.value || '').trim();
      if (!assignment || !title) return;
      assignment.milestones = assignment.milestones || [];
      assignment.milestones.push({ id: api.uid(), title: title.slice(0, 160), estMin: 25, done: false });
      syncTask(assignment);
      commit();
    } else if (form.dataset.cw === 'add-res') {
      const data = new FormData(form);
      const title = String(data.get('title') || '').trim();
      const kind = String(data.get('kind') || 'link');
      const body = String(data.get('body') || '').trim();
      if (!title) { api.toast('Name the resource.'); return; }
      state.resources = state.resources || [];
      const resource = {
        id: api.uid(), subjectId: String(data.get('course') || '') || null, assignmentId: null,
        title: title.slice(0, 120), kind, url: '', note: ''
      };
      if (kind === 'note' || kind === 'reference') resource.note = body.slice(0, 500);
      else resource.url = body.slice(0, 500);
      state.resources.push(resource);
      api.toast(resourceStatus(resource).ok ? 'On the shelf.' : 'Saved. ' + resourceStatus(resource).reason + '.');
      commit();
    }
  }

  function render() {
    const panel = api.$('#courseworkPanel');
    const cal = api.$('#calScroll');
    const btn = api.$('#courseworkBtn');
    if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    // The week stays visible. Coursework sits under it and never replaces it.
    if (cal) cal.hidden = false;
    if (!panel) return;
    panel.hidden = !on;
    if (!on) return;
    const live = typeof document !== 'undefined' ? document.activeElement : null;
    const typing = !force && live && panel.contains(live) && /^(INPUT|TEXTAREA|SELECT)$/.test(live.tagName || '');
    force = false;
    if (typing) return;
    panel.innerHTML = html();
    if (!bound) {
      panel.addEventListener('click', onClick);
      panel.addEventListener('change', onChange);
      panel.addEventListener('submit', onSubmit);
      bound = true;
    }
  }

  const btn = api.$('#courseworkBtn');
  if (btn) btn.onclick = () => {
    on = !on;
    force = true;
    if (api.renderCalendar) api.renderCalendar();
    else render();
  };
  return {
    render,
    close() {
      if (!on) return;
      on = false;
      force = true;
      if (api.renderCalendar) api.renderCalendar();
      else render();
    }
  };
}
