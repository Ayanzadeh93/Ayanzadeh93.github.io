/**
 * If StudyCoachExtra matches a prompt, answer it before the model loader runs.
 * Capture-phase submit so the base form handler never starts a download.
 */
function paint(role, text) {
  document.querySelectorAll('[data-coach-log]').forEach((log) => {
    const el = document.createElement('article');
    el.className = 'coach-msg ' + role;
    el.innerHTML = '<div class="who"></div><div class="bubble"></div>';
    el.querySelector('.who').textContent = role === 'user' ? 'You' : 'Coach';
    el.querySelector('.bubble').textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  });
}
function onSubmit(e) {
  const form = e.target;
  if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-coach-form')) return;
  const input = form.querySelector('[data-coach-input]');
  const text = String((input && input.value) || '').trim();
  if (!text || !window.StudyCoachExtra || typeof window.StudyCoachExtra.tryLocal !== 'function') return;
  const extra = window.StudyCoachExtra.tryLocal(text);
  if (!extra) return;
  e.preventDefault();
  e.stopPropagation();
  if (input) input.value = '';
  paint('user', text);
  paint('assistant', extra);
}
document.addEventListener('submit', onSubmit, true);
