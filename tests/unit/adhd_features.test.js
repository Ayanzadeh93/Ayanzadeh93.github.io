import test, { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Unref background timers so Node test runner terminates naturally
const origSetInterval = globalThis.setInterval;
globalThis.setInterval = function(...args) {
  const timer = origSetInterval.apply(this, args);
  if (timer && timer.unref) timer.unref();
  return timer;
};

import {
  setupBrowserEnv,
  teardownBrowserEnv
} from '../fixtures/browser-mock.js';

describe('ADHD Student Features & Executive Dysfunction Deep Tests', () => {
  let env;
  let mod;
  const FD = () => env.window.FocusDial || globalThis.window.FocusDial;

  before(async () => {
    env = setupBrowserEnv();
    const html = fs.readFileSync('./apps/adhd-study-pack.html', 'utf8');
    env.document.body.innerHTML = html;

    mod = await import('../../js/adhd-study-pack.js');
  });

  after(async () => {
    await new Promise(r => setTimeout(r, 200));
    teardownBrowserEnv();
  });

  beforeEach(() => {
    if (FD() && FD().setState) {
      FD().setState({
        exams: [],
        events: [],
        tasks: [],
        notes: [],
        flashcards: []
      });
    }
  });

  // =========================================================================
  // SUITE 1: EXAM & DEADLINE CHUNKING TRACKER
  // =========================================================================
  describe('Suite 1: Exam & Deadline Chunking Engine', () => {
    it('1.1: renders upcoming exams sorted by date and calculates daily study chunks', () => {
      const now = Date.now();
      const fiveDaysOut = new Date(now + 5 * 86400000).toISOString();
      const tenDaysOut = new Date(now + 10 * 86400000).toISOString();

      FD().setState({
        exams: [
          { id: 'ex_far', title: 'Biology Final', course: 'Bio 101', dueDate: tenDaysOut, targetHours: 20, completed: false },
          { id: 'ex_near', title: 'Calculus Midterm', course: 'Math 202', dueDate: fiveDaysOut, targetHours: 10, completed: false }
        ]
      });

      mod.renderExamTracker();

      const container = env.document.getElementById('examTracker');
      assert.ok(container, 'examTracker container should exist in DOM');

      const examItems = env.document.querySelectorAll('.exam-item');
      assert.equal(examItems.length, 2, 'should render 2 exam items');
      // Calculus should be first because it is due sooner
      assert.equal(examItems[0].dataset.examId, 'ex_near');
      assert.equal(examItems[1].dataset.examId, 'ex_far');

      // 10h / 5d = 2h/day (120 min)
      assert.ok(examItems[0].innerHTML.includes('2h/day'));
    });

    it('1.2: enforces minimum 15-minute daily study chunk for distant deadlines', () => {
      const distantDate = new Date(Date.now() + 30 * 86400000).toISOString();
      FD().setState({
        exams: [
          { id: 'ex_dist', title: 'Ethics Paper', course: 'Phil 101', dueDate: distantDate, targetHours: 1, completed: false }
        ]
      });

      mod.renderExamTracker();
      const item = env.document.querySelector('.exam-item[data-exam-id="ex_dist"]');
      assert.ok(item);
      assert.ok(item.innerHTML.includes('15m/day'), 'Should enforce 15m minimum daily study chunk');
    });

    it('1.3: assigns correct urgency badges for overdue, crunch, and completed states', () => {
      const now = Date.now();
      const overdueDate = new Date(now - 1 * 86400000).toISOString();
      const todayDate = new Date(now).toISOString();
      const farDate = new Date(now + 14 * 86400000).toISOString();

      FD().setState({
        exams: [
          { id: 'ex_over', title: 'Overdue Project', dueDate: overdueDate, targetHours: 5, completed: false },
          { id: 'ex_today', title: 'Today Quiz', dueDate: todayDate, targetHours: 2, completed: false },
          { id: 'ex_done', title: 'Conquered Exam', dueDate: farDate, targetHours: 8, completed: true }
        ]
      });

      mod.renderExamTracker();

      const overItem = env.document.querySelector('.exam-item[data-exam-id="ex_over"]');
      const todayItem = env.document.querySelector('.exam-item[data-exam-id="ex_today"]');
      const doneItem = env.document.querySelector('.exam-item[data-exam-id="ex_done"]');

      assert.ok(overItem.querySelector('.urgency-badge').textContent.includes('Passed'));
      assert.ok(todayItem.querySelector('.urgency-badge').textContent.includes('Today!'));
      assert.ok(doneItem.querySelector('.urgency-badge').textContent.includes('Completed 🎉'));
      assert.ok(doneItem.classList.contains('done-exam'));
    });

    it('1.4: 1-click schedules a daily study block into planner events', () => {
      const dueDate = new Date(Date.now() + 3 * 86400000).toISOString();
      FD().setState({
        exams: [
          { id: 'ex_sched', title: 'Organic Chemistry', dueDate, targetHours: 6, completed: false }
        ],
        events: []
      });

      mod.renderExamTracker();
      const schedBtn = env.document.querySelector('.schedule-exam-btn[data-exam-id="ex_sched"]');
      assert.ok(schedBtn, 'Schedule button should be rendered');

      schedBtn.click();

      const state = FD().getState();
      assert.equal(state.events.length, 1, 'Should add 1 event to S.events');
      assert.equal(state.events[0].title, 'Study: Organic Chemistry');
      assert.equal(state.events[0].kind, 'study');
    });

    it('1.5: toggles completion state and deletes exams cleanly', () => {
      const dueDate = new Date(Date.now() + 4 * 86400000).toISOString();
      FD().setState({
        exams: [
          { id: 'ex_del', title: 'History Essay', dueDate, targetHours: 4, completed: false }
        ]
      });

      mod.renderExamTracker();

      // Toggle completed
      const doneBtn = env.document.querySelector('.exam-done-btn[data-exam-id="ex_del"]');
      assert.ok(doneBtn);
      doneBtn.click();

      let state = FD().getState();
      assert.equal(state.exams[0].completed, true, 'Exam should be marked completed');

      // Reopen
      const reopenBtn = env.document.querySelector('.exam-done-btn[data-exam-id="ex_del"]');
      reopenBtn.click();
      state = FD().getState();
      assert.equal(state.exams[0].completed, false, 'Exam should be reopened');

      // Delete
      const delBtn = env.document.querySelector('.exam-del-btn[data-exam-id="ex_del"]');
      assert.ok(delBtn);
      delBtn.click();

      state = FD().getState();
      assert.equal(state.exams.length, 0, 'Exam should be deleted');
    });
  });

  // =========================================================================
  // SUITE 2: 2-MINUTE MICRO-START INITIATION BARRIER BUSTER
  // =========================================================================
  describe('Suite 2: 2-Minute Micro-Start Barrier Buster', () => {
    it('2.1: configures focus timer specifically for 2-minute micro launch', () => {
      mod.startMicroTimer();

      const state = FD().getState();
      assert.equal(state.timer.phase, 'focus');
      assert.equal(env.document.getElementById('clock').textContent, '02:00');
    });
  });

  // =========================================================================
  // SUITE 3: SUBTASK DECOMPOSER & "NEXT PHYSICAL ACTION"
  // =========================================================================
  describe('Suite 3: Subtask Decomposer & Next Physical Action', () => {
    it('3.1: opens subtask decomposer and adds micro-action steps', () => {
      FD().setState({
        tasks: [
          {
            id: 't_decomp',
            title: 'Write Term Paper',
            est: 3,
            energy: 'med',
            done: false,
            steps: []
          }
        ]
      });

      mod.taskSubtasksModal('t_decomp');

      const scrim = env.document.getElementById('scrim');
      assert.ok(scrim.classList.contains('on'), 'Modal scrim should be on');

      const addInput = env.document.getElementById('mAddStepInput');
      const addBtn = env.document.getElementById('mAddStepBtn');
      assert.ok(addInput && addBtn, 'Input and button should be rendered');

      addInput.value = 'Open Google Docs and create blank page';
      addBtn.click();

      const state = FD().getState();
      const task = state.tasks.find(x => x.id === 't_decomp');
      assert.equal(task.steps.length, 1);
      assert.equal(task.steps[0].label, 'Open Google Docs and create blank page');
      assert.equal(task.steps[0].done, false);
    });

    it('3.2: toggles subtask step completion and calculates progress', () => {
      FD().setState({
        tasks: [
          {
            id: 't_steps',
            title: 'Research Project',
            steps: [
              { label: 'Step 1: Download papers', done: false },
              { label: 'Step 2: Read abstract', done: false }
            ]
          }
        ]
      });

      mod.taskSubtasksModal('t_steps');

      const checkboxes = env.document.querySelectorAll('.m-step-ck');
      assert.equal(checkboxes.length, 2);

      checkboxes[0].checked = true;
      checkboxes[0].onchange();

      const state = FD().getState();
      const task = state.tasks.find(x => x.id === 't_steps');
      assert.equal(task.steps[0].done, true);
      assert.equal(task.steps[1].done, false);

      const modalBody = env.document.getElementById('modalBody');
      assert.ok(modalBody.innerHTML.includes('Step 2: Read abstract'));
    });

    it('3.3: applies 1-click ADHD Decomposer templates without duplicates', () => {
      FD().setState({
        tasks: [
          { id: 't_tpl', title: 'Literature Essay', steps: [] }
        ]
      });

      mod.taskSubtasksModal('t_tpl');

      const essayTplBtn = env.document.querySelector('.m-template-btn[data-template="essay"]');
      assert.ok(essayTplBtn, 'Essay template button should exist');
      essayTplBtn.click();

      let state = FD().getState();
      let task = state.tasks.find(x => x.id === 't_tpl');
      assert.ok(task.steps.length >= 4, 'Should inject essay template steps');

      const countBefore = task.steps.length;
      essayTplBtn.click();
      state = FD().getState();
      task = state.tasks.find(x => x.id === 't_tpl');
      assert.equal(task.steps.length, countBefore, 'Should not add duplicate steps');
    });

    it('3.4: deletes a micro-step from a task', () => {
      FD().setState({
        tasks: [
          {
            id: 't_del_step',
            title: 'Problem Set',
            steps: [
              { label: 'Problem 1', done: false },
              { label: 'Problem 2', done: false }
            ]
          }
        ]
      });

      mod.taskSubtasksModal('t_del_step');

      const delBtns = env.document.querySelectorAll('.m-step-del');
      assert.equal(delBtns.length, 2);

      delBtns[0].click();

      const state = FD().getState();
      const task = state.tasks.find(x => x.id === 't_del_step');
      assert.equal(task.steps.length, 1);
      assert.equal(task.steps[0].label, 'Problem 2');
    });
  });

  // =========================================================================
  // SUITE 4: STICKY NOTE TO ACTIONABLE TASK CONVERSION
  // =========================================================================
  describe('Suite 4: Sticky Note to Task Conversion & Multi-line Parsing', () => {
    it('4.1: parses multi-line sticky notes into task title and micro-steps', () => {
      FD().setState({
        notes: [
          {
            id: 'n_multi',
            text: 'Finish Biology Lab Report\nFind sample test tubes\nPlot absorbance curve in Excel\nWrite conclusion paragraph',
            tag: 'parked'
          }
        ],
        tasks: []
      });

      FD().view('notes');

      const toTaskBtn = env.document.querySelector('.sticky[data-note="n_multi"] [data-totask]');
      assert.ok(toTaskBtn, 'Convert to task button should exist on note card');

      toTaskBtn.click();

      const state = FD().getState();
      assert.equal(state.tasks.length, 1, 'Should create 1 task');
      assert.equal(state.tasks[0].title, 'Finish Biology Lab Report');
      assert.equal(state.tasks[0].steps.length, 3, 'Should extract 3 subtask steps');
      assert.equal(state.tasks[0].steps[0].label, 'Find sample test tubes');
      assert.equal(state.tasks[0].steps[1].label, 'Plot absorbance curve in Excel');
      assert.equal(state.tasks[0].steps[2].label, 'Write conclusion paragraph');

      assert.equal(state.notes.length, 0, 'Original note should be removed');
    });

    it('4.2: converts single-line note to simple task without steps', () => {
      FD().setState({
        notes: [
          { id: 'n_single', text: 'Email Academic Advisor', tag: 'note' }
        ],
        tasks: []
      });

      FD().view('notes');

      const toTaskBtn = env.document.querySelector('.sticky[data-note="n_single"] [data-totask]');
      assert.ok(toTaskBtn);
      toTaskBtn.click();

      const state = FD().getState();
      assert.equal(state.tasks.length, 1);
      assert.equal(state.tasks[0].title, 'Email Academic Advisor');
      assert.equal(state.tasks[0].steps.length, 0);
    });
  });

  // =========================================================================
  // SUITE 5: ACTIVE RECALL & SPACED MICRO-QUIZZER
  // =========================================================================
  describe('Suite 5: Active Recall & Spaced Micro-Quizzer', () => {
    it('5.1: pre-seeds flashcards deck and flips to reveal answer', () => {
      FD().setState({ flashcards: [] });

      mod.flashcardModal();

      const state = FD().getState();
      assert.ok(state.flashcards.length >= 5, 'Should pre-seed ADHD science study cards');

      const stage = env.document.getElementById('cardStage');
      assert.ok(stage, 'Flashcard stage should be rendered');

      // Flip card to reveal answer
      stage.click();

      const answerEl = env.document.querySelector('.flashcard-a');
      assert.ok(answerEl, 'Answer should now be visible');

      const rateBar = env.document.querySelector('.flashcard-rating-bar');
      assert.ok(rateBar, 'Rating bar should be visible');
    });

    it('5.2: applies Leitner ratings (Again, Hard, Good) correctly', () => {
      FD().setState({
        flashcards: [
          { id: 'fc_test1', question: 'Q1', answer: 'A1', interval: 1, reps: 0, due: Date.now() },
          { id: 'fc_test2', question: 'Q2', answer: 'A2', interval: 1, reps: 0, due: Date.now() }
        ]
      });

      mod.flashcardModal();

      // Show answer
      const stage = env.document.getElementById('cardStage');
      stage.click();

      // Rate "hard"
      const hardBtn = env.document.querySelector('[data-rate="hard"]');
      assert.ok(hardBtn);
      hardBtn.click();

      const state = FD().getState();
      const card1 = state.flashcards.find(c => c.id === 'fc_test1');
      assert.equal(card1.reps, 1);
      assert.equal(card1.interval, 1.5, 'Hard rating multiplies interval by 1.5');
    });

    it('5.3: allows adding custom flashcards', () => {
      FD().setState({
        flashcards: [
          { id: 'fc_exist', question: 'Q', answer: 'A', interval: 1 }
        ]
      });

      mod.flashcardModal();

      const addBtn = env.document.getElementById('addNewCardBtn');
      assert.ok(addBtn);
      addBtn.click();

      const qInput = env.document.getElementById('fc_q');
      const aInput = env.document.getElementById('fc_a');
      const subInput = env.document.getElementById('fc_sub');

      assert.ok(qInput && aInput);
      qInput.value = 'What is the function of the hippocampus?';
      aInput.value = 'Memory consolidation and spatial navigation.';
      subInput.value = 'Neuroscience';

      const saveBtn = env.document.querySelector('#modalFoot .btn.primary');
      assert.ok(saveBtn);
      saveBtn.click();

      const state = FD().getState();
      const newCard = state.flashcards.find(c => c.question.includes('hippocampus'));
      assert.ok(newCard, 'Custom card should be saved into state');
      assert.equal(newCard.subject, 'Neuroscience');
    });
  });

  // =========================================================================
  // SUITE 6: BIONIC FOCUS READER & READING RULER
  // =========================================================================
  describe('Suite 6: Bionic Focus Reader & Reading Ruler', () => {
    it('6.1: bolds word fixation points in bionic reading mode', () => {
      mod.bionicReaderModal('Attention deficit hyperactivity disorder');

      const outBody = env.document.getElementById('bionicTextBody');
      assert.ok(outBody, 'Bionic text container should exist');

      const boldTags = outBody.querySelectorAll('b');
      assert.equal(boldTags.length, 4, 'Each word should contain a bold fixation prefix');
      assert.equal(boldTags[0].textContent, 'Atten');
      assert.equal(boldTags[1].textContent, 'defi');
      assert.equal(boldTags[2].textContent, 'hypera');
      assert.equal(boldTags[3].textContent, 'diso');
    });

    it('6.2: toggles reading ruler and adjusts font scale', () => {
      mod.bionicReaderModal('Sample study text for reading ruler testing.');

      const toggleBtn = env.document.getElementById('bionicToggleRuler');
      const ruler = env.document.getElementById('readingRuler');
      const area = env.document.getElementById('bionicOutput');

      assert.ok(toggleBtn && ruler && area);
      assert.equal(ruler.style.display, 'block');

      // Toggle ruler off
      toggleBtn.click();
      assert.equal(ruler.style.display, 'none');

      // Toggle ruler back on
      toggleBtn.click();
      assert.equal(ruler.style.display, 'block');

      // Font size larger
      const largerBtn = env.document.getElementById('bionicTextLarger');
      largerBtn.click();
      assert.ok(area.style.fontSize.includes('1.1'));

      // Font size smaller
      const smallerBtn = env.document.getElementById('bionicTextSmaller');
      smallerBtn.click();
      assert.ok(area.style.fontSize.includes('1'));
    });
  });

  // =========================================================================
  // SUITE 7: COMMAND PALETTE & EXPORTS INTEGRATION
  // =========================================================================
  describe('Suite 7: Command Palette & Exports Integration', () => {
    it('7.1: exports all new modal functions on module and window.FocusDial', () => {
      assert.equal(typeof mod.taskSubtasksModal, 'function');
      assert.equal(typeof mod.smartDecomposerModal, 'function');
      assert.equal(typeof mod.flashcardModal, 'function');
      assert.equal(typeof mod.bionicReaderModal, 'function');
      assert.equal(typeof mod.renderExamTracker, 'function');
      assert.equal(typeof mod.examModal, 'function');

      assert.equal(typeof FD().taskSubtasksModal, 'function');
      assert.equal(typeof FD().smartDecomposerModal, 'function');
      assert.equal(typeof FD().flashcardModal, 'function');
      assert.equal(typeof FD().bionicReaderModal, 'function');
    });

    it('7.2: registers study and task decomposer commands in quick palette', () => {
      const cmdBtn = env.document.getElementById('cmdBtn');
      assert.ok(cmdBtn, 'Command palette button should exist');
      cmdBtn.click();

      const cmdInput = env.document.getElementById('cmdInput');
      assert.ok(cmdInput);

      // Filter by flashcards
      cmdInput.value = 'flashcards';
      cmdInput.oninput({ target: { value: 'flashcards' } });

      const cmdList = env.document.getElementById('cmdList');
      assert.ok(cmdList.innerHTML.includes('Active recall flashcards'));

      // Filter by bionic
      cmdInput.value = 'bionic';
      cmdInput.oninput({ target: { value: 'bionic' } });
      assert.ok(cmdList.innerHTML.includes('Bionic focus reader'));

      // Filter by decomposer
      cmdInput.value = 'decompose';
      cmdInput.oninput({ target: { value: 'decompose' } });
      assert.ok(cmdList.innerHTML.includes('Decompose task (ADHD smart decomposer)'));
    });
  });
});
