/* Quick mood tracker on the Wellbeing (calm) screen. Local only. */
(function () {
  var KEY = 'asp.quickMood.v1';
  var FACES = [
    { v: 1, e: '😣', l: 'Rough' }, { v: 2, e: '😕', l: 'Low' }, { v: 3, e: '😐', l: 'Okay' },
    { v: 4, e: '🙂', l: 'Good' }, { v: 5, e: '😄', l: 'Great' }
  ];
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function day(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function render() {
    var faces = document.getElementById('gmFaces'), week = document.getElementById('gmWeek'), last = document.getElementById('gmLast');
    if (!faces) return;
    var log = load(), today = day(Date.now());
    var todayEntry = log.filter(function (x) { return day(x.t) === today; }).pop();
    faces.innerHTML = FACES.map(function (f) {
      var on = todayEntry && todayEntry.v === f.v;
      return '<button type="button" class="gm-face' + (on ? ' on' : '') + '" data-v="' + f.v + '" aria-pressed="' + !!on + '"><span class="gm-e">' + f.e + '</span><span class="gm-l">' + f.l + '</span></button>';
    }).join('');
    var cells = [];
    for (var i = 6; i >= 0; i--) {
      var t = Date.now() - i * 864e5, k = day(t);
      var es = log.filter(function (x) { return day(x.t) === k; });
      var avg = es.length ? es.reduce(function (a, x) { return a + x.v; }, 0) / es.length : 0;
      var lbl = new Date(t).toLocaleDateString(undefined, { weekday: 'short' });
      cells.push('<div class="gm-day"><span class="gm-bar" style="--h:' + (avg ? avg * 20 : 6) + '%" data-empty="' + !avg + '"></span><small>' + lbl + '</small></div>');
    }
    week.innerHTML = cells.join('');
    if (todayEntry) last.textContent = 'Logged ' + FACES[todayEntry.v - 1].l.toLowerCase() + ' at ' + new Date(todayEntry.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    faces.querySelectorAll('.gm-face').forEach(function (b) {
      b.onclick = function () {
        var l = load(); l.push({ t: Date.now(), v: +b.dataset.v });
        localStorage.setItem(KEY, JSON.stringify(l.slice(-400))); render();
      };
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
