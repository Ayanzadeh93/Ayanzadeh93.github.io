/* Study desk on Plan, plus learning progress and score switches.
   The rules live in js/lib/study-desk.js. */
import {
  blankProblem, canReveal, revealSolution, solutionCaption,
  blankDraft, criterionState, exportDraft, chunksOf, placeInPassage,
  weekReview, missedWeekLine, learningProgress, scoreChrome
} from './lib/study-desk.js?v=4.45.0';
import { blankFlashcard, importDeck as parseDeck, dueCards, rateFlashcard }
  from './lib/flashcards.js?v=4.45.0';

export function mountStudyDesk(api) {
  let on = false;
  let tab = 'practice';
  let bound = false;
  const revealedCards = new Set();
  const S = () => api.getS();
  const esc = api.esc;

  function lists() {
    const state = S();
    if (!Array.isArray(state.problems)) state.problems = [];
    if (!Array.isArray(state.drafts)) state.drafts = [];
    if (!Array.isArray(state.reviews)) state.reviews = [];
    if (!Array.isArray(state.flashcards)) state.flashcards = [];
    if (!state.reading || typeof state.reading !== 'object') state.reading = { text: '', index: 0, size: 40 };
    if (!state.settings) state.settings = {};
    return state;
  }

  function commit() {
    api.save();
    render(true);
    if (api.renderPassport) api.renderPassport();
    if (api.renderStats) api.renderStats();
  }

  function chrome() {
    const state = lists();
    return scoreChrome({ scores: state.settings.scores, board: state.settings.board });
  }

  function applyChrome() {
    const view = chrome();
    const root = document.documentElement;
    root.dataset.scores = view.scores ? 'on' : 'off';
    root.dataset.board = view.board ? 'on' : 'off';
    const chip = api.$('#streakChip');
    if (chip) chip.hidden = !view.scores;
    try { window.dispatchEvent(new CustomEvent('focusdial-scores')); } catch (e) {}
    return view;
  }

  function weekKey(date) {
    const d = api.startOfDay(date || new Date());
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return api.dayKey(d);
  }

  function reviewFacts() {
    const state = lists();
    const start = api.startOfDay(new Date());
    const end = start.getTime() + 7 * api.DAY;
    const done = (state.tasks || []).filter(task => task.done).length;
    const open = (state.tasks || []).filter(task => !task.done && !task.someday).length;
    const deadlines = (state.assignments || []).filter(item => {
      if (!item.due) return false;
      const due = api.keyToDate(item.due).getTime();
      return due >= start.getTime() && due < end;
    }).length;
    const key = weekKey(new Date());
    const saved = (state.reviews || []).find(item => item.week === key) || null;
    return { done, open, deadlines, saved, key };
  }

  function learn() {
    const state = lists();
    const minutes = (state.sessions || []).reduce((sum, row) => sum + (Number(row.minutes) || 0), 0);
    return learningProgress({ minutes, problems: state.problems, drafts: state.drafts });
  }

  function practiceHtml(state) {
    const cards = state.problems.map(item => {
      const caption = solutionCaption(item);
      return `<article class="cw-card" data-problem="${esc(item.id)}">
        <label>Problem<textarea data-field="prompt" rows="2">${esc(item.prompt)}</textarea></label>
        <label>Your attempt<textarea data-field="attempt" rows="2">${esc(item.attempt)}</textarea></label>
        ${item.revealed ? '' : `<details><summary>Hold the solution here</summary><label>Solution<textarea data-field="solution" rows="2">${esc(item.solution)}</textarea></label></details>`}
        <label>Source<input data-field="source" value="${esc(item.source)}"></label>
        <label class="cw-check"><input type="checkbox" data-field="generated" ${item.generated ? 'checked' : ''}> This note came from a model</label>
        <div class="cw-row">
          <button type="button" class="btn" data-act="reveal" ${canReveal(item) ? '' : 'disabled'}>Show the solution</button>
          <button type="button" class="btn" data-act="drop">Remove</button>
        </div>
        ${item.revealed ? `<p class="cw-note">${esc(caption)}</p><p class="cw-solution">${esc(item.solution || 'No solution was written.')}</p>` : '<p class="cw-note">The solution stays hidden until the attempt box has words.</p>'}
      </article>`;
    }).join('');
    return `<div class="cw-row"><button type="button" class="btn primary" data-act="add-problem">New problem</button></div>${cards || '<p class="cw-note">Add a problem you already have. Write an attempt before the solution is shown.</p>'}`;
  }

  function writingHtml(state) {
    return state.drafts.map(draft => {
      const rows = (draft.criteria || []).map(item => {
        const stateName = criterionState(item);
        return `<li data-criterion="${esc(item.id)}">
          <input data-field="text" value="${esc(item.text)}" aria-label="Criterion" placeholder="Criterion">
          <input data-field="evidence" value="${esc(item.evidence)}" aria-label="Evidence in the draft" placeholder="Where this shows up in the draft">
          <span class="${stateName === 'missing' ? 'cw-miss' : ''}">${stateName === 'missing' ? 'Missing step' : 'Linked'}</span>
          <button type="button" class="btn sm" data-act="drop-criterion">Remove</button>
        </li>`;
      }).join('');
      return `<article class="cw-card" data-draft="${esc(draft.id)}">
        <label>Title<input data-field="title" value="${esc(draft.title)}"></label>
        <label>Outline<textarea data-field="outline" rows="3">${esc(draft.outline)}</textarea></label>
        <label>Draft<textarea data-field="body" rows="5">${esc(draft.body)}</textarea></label>
        <h3>Rubric</h3>
        <ul>${rows}</ul>
        <div class="cw-row">
          <button type="button" class="btn" data-act="add-criterion">Add a criterion</button>
          <button type="button" class="btn" data-act="export">Save a private copy</button>
          <button type="button" class="btn" data-act="drop-draft">Remove</button>
        </div>
      </article>`;
    }).join('') || '';
  }

  function readHtml(state) {
    const reading = state.reading;
    const chunks = chunksOf(reading.text, reading.size);
    const place = placeInPassage(reading.index, chunks.length);
    if (reading.index !== place.index) reading.index = place.index;
    return `<p class="cw-note">A voice is only a way to hear the words. It is not a treatment, and the font is not one either.</p>
      <label>Passage<textarea id="readText" rows="6">${esc(reading.text)}</textarea></label>
      <label>Words at a time<input id="readSize" type="number" min="8" max="80" value="${Number(reading.size) || 40}"></label>
      <p id="readPlace">${esc(place.line)}</p>
      <p class="cw-solution" id="readChunk">${esc(chunks[place.index] || '')}</p>
      <div class="cw-row">
        <button type="button" class="btn" data-act="read-prev">Previous</button>
        <button type="button" class="btn primary" data-act="read-play">Read this passage</button>
        <button type="button" class="btn" data-act="read-stop">Stop</button>
        <button type="button" class="btn" data-act="read-next">Next</button>
        <button type="button" class="btn" data-act="recall-passage">Practice recall from this passage</button>
      </div>`;
  }

  function cardsHtml(state) {
    const due = new Set(dueCards(state.flashcards, Date.now()).map(card => card.id));
    const cards = state.flashcards.slice().sort((a, b) => {
      const aDue = Number(a.dueAt || 0) <= Date.now() ? 0 : Number(a.dueAt || 0);
      const bDue = Number(b.dueAt || 0) <= Date.now() ? 0 : Number(b.dueAt || 0);
      return aDue - bDue;
    }).map(card => {
      const revealed = revealedCards.has(card.id);
      const ready = due.has(card.id);
      const next = card.dueAt > Date.now()
        ? 'Next review ' + new Date(card.dueAt).toLocaleDateString(undefined, { month:'short', day:'numeric' })
        : 'Due now';
      return `<article class="cw-card" data-flashcard="${esc(card.id)}">
        <p class="cw-note"><strong>${esc(card.deck || 'My cards')}</strong> · ${esc(next)}</p>
        <h3>Front</h3><p class="cw-solution" dir="auto">${esc(card.front || 'Add a prompt in Edit card.')}</p>
        ${revealed ? `<h3>Back</h3><p class="cw-solution" dir="auto">${esc(card.back || 'No answer saved yet.')}</p>` : ''}
        <div class="cw-row">
          <button type="button" class="btn" data-act="flip-card">${revealed ? 'Hide the back' : 'Show the back'}</button>
          ${revealed && ready ? `<button type="button" class="btn" data-act="rate-card" data-rating="again">Again · 10 min</button>
            <button type="button" class="btn" data-act="rate-card" data-rating="good">Good</button>
            <button type="button" class="btn" data-act="rate-card" data-rating="easy">Easy</button>` : ''}
        </div>
        <details><summary>Edit card</summary>
          <label>Deck<input data-field="deck" value="${esc(card.deck || 'My cards')}" maxlength="80"></label>
          <label>Front<textarea data-field="front" rows="2" maxlength="4000">${esc(card.front || '')}</textarea></label>
          <label>Back<textarea data-field="back" rows="2" maxlength="4000">${esc(card.back || '')}</textarea></label>
          <button type="button" class="btn sm" data-act="drop-card">Delete card</button>
        </details>
      </article>`;
    }).join('');
    const count = dueCards(state.flashcards, Date.now()).length;
    return `<p class="cw-note">${count ? `${count} card${count === 1 ? '' : 's'} due now.` : 'Nothing is due right now. You can still edit or review a card.'} Good and Easy move a card farther away; Again brings it back soon.</p>
      <div class="cw-row"><button type="button" class="btn primary" data-act="add-card">New card</button></div>
      <details class="cw-card"><summary>Import a deck</summary>
        <p class="cw-note">Paste CSV columns named front, back, and optional deck; or JSON cards with front/back.</p>
        <label>Deck file<input id="deckFile" type="file" accept=".csv,.txt,.json,text/csv,application/json"></label>
        <label>Or paste a deck<textarea id="deckImport" rows="5" dir="auto" placeholder="front,back,deck&#10;Mitochondrion,Produces most cellular ATP,Biology"></textarea></label>
        <button type="button" class="btn" data-act="import-deck">Import cards</button>
      </details>
      ${cards || '<p class="cw-note">Make a card or import a deck to start a review queue.</p>'}`;
  }

  function weekHtml() {
    const facts = reviewFacts();
    const saved = facts.saved;
    const card = weekReview({
      done: facts.done, open: facts.open, deadlines: facts.deadlines,
      skipped: !!(saved && saved.skipped), proposal: saved ? saved.proposal : ''
    });
    return `<p>${saved ? esc(card.line) : esc(missedWeekLine())}</p>
      <p class="cw-note">Finished tasks: ${facts.done}. Open tasks: ${facts.open}. Deadlines in the next 7 days: ${facts.deadlines}.</p>
      <label>Next week, one editable plan<textarea id="weekPlan" rows="3">${esc(card.proposal)}</textarea></label>
      <div class="cw-row">
        <button type="button" class="btn primary" data-act="week-save">Save the plan</button>
        <button type="button" class="btn" data-act="week-skip">Skip this week</button>
      </div>`;
  }

  function panelHtml() {
    const state = lists();
    const body = tab === 'writing'
      ? `<div class="cw-row"><button type="button" class="btn primary" data-act="add-draft">New draft</button></div>${writingHtml(state)}`
      : tab === 'read' ? readHtml(state)
      : tab === 'week' ? weekHtml()
      : tab === 'cards' ? cardsHtml(state)
      : practiceHtml(state);
    const tabBtn = (id, label) => `<button type="button" class="btn ${tab === id ? 'primary' : ''}" data-tab="${id}" aria-pressed="${tab === id}">${label}</button>`;
    return `<div class="cw-row">${tabBtn('practice', 'Practice')}${tabBtn('cards', 'Cards')}${tabBtn('writing', 'Writing')}${tabBtn('read', 'Read')}${tabBtn('week', 'Week')}</div>${body}`;
  }

  function learnHtml() {
    const progress = learn();
    const claims = progress.claims.length ? progress.claims.map(line => `<li>${esc(line)}</li>`).join('') : '<li>No reviewed attempt or linked criterion yet.</li>';
    return `<div class="panel-head"><h3>What you learned</h3></div>
      <p class="cw-note">${progress.mastery} from attempts and drafts. ${progress.minutes} focus minutes are time only, and they do not add mastery.</p>
      <ul>${claims}</ul>`;
  }

  function scoreHtml() {
    const view = chrome();
    return `<div class="panel-head"><h3>Scores</h3></div>
      <p class="cw-note">Scores and ranks stay on until you turn one off. The public card is a separate choice on You, and these switches do not change it.</p>
      <label class="cw-check"><input type="checkbox" data-score="scores" ${view.scores ? 'checked' : ''}> Show XP, streaks, and badges</label>
      <label class="cw-check"><input type="checkbox" data-score="board" ${view.board ? 'checked' : ''}> Show the leaderboard</label>`;
  }

  function render(force) {
    applyChrome();
    const btn = api.$('#studyBtn');
    if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const panel = api.$('#studyDesk');
    const learnBox = api.$('#learnCard');
    const scoreBox = api.$('#scoreControls');
    if (learnBox) learnBox.innerHTML = learnHtml();
    if (scoreBox && (force || !scoreBox.contains(document.activeElement))) scoreBox.innerHTML = scoreHtml();
    if (!panel) return;
    panel.hidden = !on;
    if (!on) return;
    if (!force && panel.contains(document.activeElement)) return;
    panel.innerHTML = panelHtml();
  }

  function readFields(card, problem) {
    const value = name => {
      const node = card.querySelector(`[data-field="${name}"]`);
      if (!node) return problem[name];
      if (node.type === 'checkbox') return node.checked;
      return node.value;
    };
    problem.prompt = value('prompt');
    problem.attempt = value('attempt');
    problem.solution = value('solution');
    problem.source = value('source');
    problem.generated = !!value('generated');
  }

  function saveReadingFromPanel() {
    const state = lists();
    const text = api.$('#readText');
    const size = api.$('#readSize');
    if (text) state.reading.text = text.value;
    if (size) state.reading.size = Math.max(8, Math.min(80, Number(size.value) || 40));
  }

  function saveOpenCards() {
    const panel = api.$('#studyDesk');
    const state = lists();
    if (!panel) return;
    panel.querySelectorAll('[data-problem]').forEach(card => {
      const problem = state.problems.find(item => item.id === card.dataset.problem);
      if (problem) readFields(card, problem);
    });
    panel.querySelectorAll('[data-flashcard]').forEach(card => {
      const item = state.flashcards.find(entry => entry.id === card.dataset.flashcard);
      if (!item) return;
      ['deck', 'front', 'back'].forEach(key => {
        const field = card.querySelector(`[data-field="${key}"]`);
        if (field) item[key] = field.value.slice(0, key === 'deck' ? 80 : 4000);
      });
    });
    panel.querySelectorAll('[data-draft]').forEach(card => {
      const draft = state.drafts.find(item => item.id === card.dataset.draft);
      if (!draft) return;
      const title = card.querySelector('[data-field="title"]');
      const outline = card.querySelector('[data-field="outline"]');
      const body = card.querySelector('[data-field="body"]');
      if (title) draft.title = title.value;
      if (outline) draft.outline = outline.value;
      if (body) draft.body = body.value;
      card.querySelectorAll('[data-criterion]').forEach(row => {
        const item = (draft.criteria || []).find(entry => entry.id === row.dataset.criterion);
        if (!item) return;
        const text = row.querySelector('[data-field="text"]');
        const evidence = row.querySelector('[data-field="evidence"]');
        if (text) item.text = text.value;
        if (evidence) item.evidence = evidence.value;
      });
    });
    if (tab === 'read') saveReadingFromPanel();
  }

  function bind() {
    if (bound) return;
    bound = true;
    const panel = api.$('#studyDesk');
    if (panel) panel.addEventListener('input', event => {
      const card = event.target.closest('[data-flashcard]');
      const field = event.target.closest('[data-field]');
      if (!card || !field) return;
      const item = lists().flashcards.find(entry => entry.id === card.dataset.flashcard);
      if (!item) return;
      const key = field.dataset.field;
      item[key] = field.value.slice(0, key === 'deck' ? 80 : 4000);
      api.save();
    });
    if (panel) panel.addEventListener('click', async event => {
      const tabBtn = event.target.closest('[data-tab]');
      if (tabBtn && panel.contains(tabBtn)) {
        saveOpenCards();
        tab = tabBtn.dataset.tab;
        api.save();
        panel.innerHTML = panelHtml();
        return;
      }
      const act = event.target.closest('[data-act]');
      if (!act || !panel.contains(act)) return;
      const state = lists();
      const name = act.dataset.act;
      if (name === 'add-problem') {
        state.problems.unshift(blankProblem(api.uid()));
        commit();
        return;
      }
      if (name === 'add-draft') {
        state.drafts.unshift(blankDraft(api.uid()));
        commit();
        return;
      }
      if (name === 'add-card') {
        state.flashcards.unshift(blankFlashcard(api.uid()));
        tab = 'cards';
        commit();
        return;
      }
      if (name === 'import-deck') {
        let text = (api.$('#deckImport') || {}).value || '';
        const file = (api.$('#deckFile') || {}).files;
        if (!text.trim() && file && file[0]) {
          try { text = await file[0].text(); }
          catch (e) { api.toast('That file could not be read. Nothing was imported.'); return; }
        }
        const result = parseDeck(text, { id: () => api.uid(), now: Date.now() });
        if (!result.ok) { api.toast(result.error); return; }
        state.flashcards = result.cards.concat(state.flashcards);
        tab = 'cards';
        api.toast(`Imported ${result.cards.length} card${result.cards.length === 1 ? '' : 's'}.`);
        commit();
        return;
      }
      const flashcardEl = act.closest('[data-flashcard]');
      if (flashcardEl) {
        const item = state.flashcards.find(entry => entry.id === flashcardEl.dataset.flashcard);
        if (!item) return;
        const fields = key => flashcardEl.querySelector(`[data-field="${key}"]`);
        ['deck', 'front', 'back'].forEach(key => {
          const field = fields(key);
          if (field) item[key] = field.value.slice(0, key === 'deck' ? 80 : 4000);
        });
        if (name === 'flip-card') {
          if (revealedCards.has(item.id)) revealedCards.delete(item.id);
          else revealedCards.add(item.id);
          api.save();
          render(true);
          return;
        }
        if (name === 'drop-card') {
          state.flashcards = state.flashcards.filter(card => card.id !== item.id);
          revealedCards.delete(item.id);
          commit();
          return;
        }
        if (name === 'rate-card') {
          if (Number(item.dueAt || 0) > Date.now()) { api.toast('This card is not due yet.'); return; }
          const result = rateFlashcard(item, act.dataset.rating, Date.now());
          if (!result.ok) return;
          Object.assign(item, result.card);
          revealedCards.delete(item.id);
          api.toast(item.dueAt - Date.now() < 60000 ? 'Back in ten minutes.' : 'Next review scheduled.');
          commit();
          return;
        }
      }
      const problemCard = act.closest('[data-problem]');
      if (problemCard) {
        const problem = state.problems.find(item => item.id === problemCard.dataset.problem);
        if (!problem) return;
        readFields(problemCard, problem);
        if (name === 'reveal') {
          const result = revealSolution(problem);
          if (!result.ok) { api.toast(result.reason); return; }
          Object.assign(problem, result.problem);
        }
        if (name === 'drop') state.problems = state.problems.filter(item => item !== problem);
        commit();
        return;
      }
      const draftCard = act.closest('[data-draft]');
      if (draftCard) {
        const draft = state.drafts.find(item => item.id === draftCard.dataset.draft);
        if (!draft) return;
        const title = draftCard.querySelector('[data-field="title"]');
        const outline = draftCard.querySelector('[data-field="outline"]');
        const body = draftCard.querySelector('[data-field="body"]');
        if (title) draft.title = title.value;
        if (outline) draft.outline = outline.value;
        if (body) draft.body = body.value;
        draftCard.querySelectorAll('[data-criterion]').forEach(row => {
          const item = (draft.criteria || []).find(entry => entry.id === row.dataset.criterion);
          if (!item) return;
          const text = row.querySelector('[data-field="text"]');
          const evidence = row.querySelector('[data-field="evidence"]');
          if (text) item.text = text.value;
          if (evidence) item.evidence = evidence.value;
        });
        if (name === 'add-criterion') draft.criteria.push({ id: api.uid(), text: '', evidence: '' });
        if (name === 'drop-criterion') {
          const row = act.closest('[data-criterion]');
          draft.criteria = draft.criteria.filter(item => item.id !== row.dataset.criterion);
          if (!draft.criteria.length) draft.criteria.push({ id: api.uid(), text: '', evidence: '' });
        }
        if (name === 'drop-draft') state.drafts = state.drafts.filter(item => item !== draft);
        if (name === 'export') {
          const file = exportDraft(draft);
          const blob = new Blob([file], { type: 'text/plain' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'draft.txt';
          link.click();
          setTimeout(() => URL.revokeObjectURL(link.href), 1000);
          api.toast('Private copy saved. It stays on this device.');
        }
        commit();
        return;
      }
      if (name === 'read-prev' || name === 'read-next' || name === 'read-play' || name === 'read-stop') {
        saveReadingFromPanel();
        const chunks = chunksOf(state.reading.text, state.reading.size);
        if (name === 'read-prev') state.reading.index -= 1;
        if (name === 'read-next') state.reading.index += 1;
        state.reading.index = placeInPassage(state.reading.index, chunks.length).index;
        if (name === 'read-stop' || name === 'read-prev' || name === 'read-next') {
          try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
        }
        if (name === 'read-play') {
          try {
            const synth = window.speechSynthesis;
            if (!synth) { api.toast('This browser has no voice. The passage is still on screen.'); }
            else {
              synth.cancel();
              const utterance = new SpeechSynthesisUtterance(chunks[state.reading.index] || '');
              synth.speak(utterance);
            }
          } catch (e) { api.toast('This browser has no voice. The passage is still on screen.'); }
        }
        api.save();
        panel.innerHTML = panelHtml();
        return;
      }
      if (name === 'recall-passage') {
        saveReadingFromPanel();
        const chunks = chunksOf(state.reading.text, state.reading.size);
        const index = placeInPassage(state.reading.index, chunks.length).index;
        const problem = blankProblem(api.uid());
        problem.prompt = chunks[index] || '';
        state.problems.unshift(problem);
        tab = 'practice';
        commit();
        return;
      }
      if (name === 'week-save' || name === 'week-skip') {
        const facts = reviewFacts();
        const proposal = (api.$('#weekPlan') || {}).value || '';
        const next = { week: facts.key, skipped: name === 'week-skip', proposal, at: Date.now() };
        state.reviews = state.reviews.filter(item => item.week !== facts.key);
        state.reviews.unshift(next);
        commit();
      }
    });
    const scoreBox = api.$('#scoreControls');
    if (scoreBox) scoreBox.addEventListener('change', event => {
      const input = event.target.closest('[data-score]');
      if (!input) return;
      const state = lists();
      state.settings[input.dataset.score] = input.checked;
      api.save();
      applyChrome();
      if (api.renderPassport) api.renderPassport();
    });
    const button = api.$('#studyBtn');
    if (button) button.onclick = () => {
      on = !on;
      render();
    };
  }

  bind();
  return { render, applyChrome };
}
