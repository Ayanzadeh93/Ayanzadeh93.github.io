/* "Plan an assignment" card in the Coach tab, powered by the AI planner. */
(function () {
  var KEY = 'focusdial.v3.aiPlan';
  var box = document.getElementById('coachPlan');
  if (!box || !window.StudyPlanApi) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  box.innerHTML =
    '<p class="coach-aside-label">AI plan</p><h3>Plan an assignment</h3>' +
    '<form class="cp-form"><label>What is it?<textarea name="assignment" rows="3" required placeholder="e.g. 1500-word history essay on the French Revolution"></textarea></label>' +
    '<label>Due<input type="datetime-local" name="deadline" required></label>' +
    '<label>When can you study?<input name="availability" required placeholder="weeknights 7–9pm, Sat morning"></label>' +
    '<button class="btn primary sm" type="submit">Make my plan</button><p class="cp-status" role="status" aria-live="polite"></p></form>' +
    '<div class="cp-out"></div>';
  var form = box.querySelector('form'), status = box.querySelector('.cp-status'), out = box.querySelector('.cp-out');
  function render(saved) {
    if (!saved) { out.innerHTML = ''; return; }
    var p = saved.plan;
    out.innerHTML = '<h4>' + esc(p.title) + '</h4><p class="sub">' + esc(p.summary) + '</p><ol class="cp-tasks">' +
      p.tasks.map(function (t) { return '<li><span class="cp-pri ' + esc(t.priority) + '">' + esc(t.priority) + '</span> ' + esc(t.title) + ' <small>~' + t.minutes + 'm</small><br><small>First: ' + esc(t.steps[0] || '') + '</small></li>'; }).join('') +
      '</ol><p class="sub">' + p.sessions.length + ' short focus sessions planned.</p>' +
      '<div class="cp-actions"><button type="button" class="btn sm primary" data-add>Add tasks to my list</button><a class="btn sm ghost" href="study-tools.html#plan">Full plan &amp; PDF</a><button type="button" class="btn sm ghost" data-clear>Clear</button></div>';
    out.querySelector('[data-add]').onclick = function (e) {
      var fd = window.FocusDial; if (!fd || !fd.addTask) return;
      p.tasks.slice().reverse().forEach(function (t) {
        fd.addTask({ title: t.title, est: Math.max(1, Math.round(t.minutes / 25)), quad: t.priority === 'high' ? 'q1' : t.priority === 'medium' ? 'q2' : 'q4' });
      });
      e.target.disabled = true; e.target.textContent = 'Added ' + p.tasks.length + ' tasks';
    };
    out.querySelector('[data-clear]').onclick = function () { localStorage.removeItem(KEY); render(null); };
  }
  form.onsubmit = async function (e) {
    e.preventDefault();
    var f = new FormData(form), btn = form.querySelector('button'), d = new Date(f.get('deadline'));
    btn.disabled = true; status.className = 'cp-status'; status.textContent = 'Thinking through your plan… (about 20 seconds)';
    try {
      var plan = await window.StudyPlanApi.request({ assignment: f.get('assignment'), deadline: d.toString(), availability: f.get('availability'), today: new Date().toString() });
      var saved = { plan: plan, deadlineLabel: d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), at: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(saved)); render(saved); status.textContent = 'Plan ready.';
    } catch (err) { status.className = 'cp-status err'; status.textContent = err.message; }
    finally { btn.disabled = false; }
  };
  try { render(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) {}
})();
