/* Todoist bridge — pure helpers for pulling a task list in and pushing one back.
 *
 * There is no server here. The Study Pack is static files on GitHub Pages, so
 * this works the same way the Google Calendar bridge on the Plan screen does:
 * the person pastes their own API token, the browser talks to the provider
 * directly, and the token never leaves the device. That rules out a real MCP
 * server — MCP needs a host process to run in — but it gives the same outcome
 * for a to-do list, with nothing new to host or trust.
 *
 * Everything here is DOM-free and network-free except `request`, which takes
 * its fetch implementation as an argument, so the mapping rules are testable.
 */

export const TODOIST_API = 'https://api.todoist.com/rest/v2';

/** Todoist priority is 4 (p1, highest) down to 1. It is stored as `priority`, not as a matrix quadrant. */

/** Shape check only, so an obvious typo fails here instead of over the wire. */
export function isValidToken(token) {
  return /^[A-Za-z0-9]{20,}$/.test(String(token || '').trim());
}

/** One Todoist task -> one Study Pack task. Unknown fields get pack defaults. */
export function toPackTask(row, { id = () => String(Math.random()).slice(2) } = {}) {
  const title = String((row && row.content) || '').trim();
  if (!title) return null;
  return {
    id: id(),
    title: title.slice(0, 300),
    est: 2,
    energy: 'med',
    subjectId: null,
    quad: null,                 // the matrix stays a local choice; Todoist p1–p4 is `priority`
    priority: (p => (p >= 1 && p <= 4 ? p : null))(Number(row.priority)),
    due: dueOf(row),
    done: row.is_completed === true,
    done_pomos: 0,
    created: Date.parse((row.created_at) || '') || Date.now(),
    todoistId: String(row.id || '')
  };
}

function dueOf(row) {
  const d = row && row.due;
  const raw = d && (d.date || (typeof d === 'string' ? d : ''));
  const m = String(raw || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** One Study Pack task -> the body Todoist expects when creating or updating a task.
    Priority is Todoist's own p1–p4 (API 4 = p1), never the Eisenhower quadrant. */
export function toTodoistBody(task) {
  const body = { content: String((task && task.title) || '').slice(0, 300) };
  const p = Number(task && task.priority);
  if (p >= 1 && p <= 4) body.priority = p;
  if (task && /^\d{4}-\d{2}-\d{2}$/.test(task.due || '')) body.due_date = task.due;
  return body;
}

/**
 * Fold a successful `/tasks` response into local tasks.
 * Matching ids update title, due, and priority. The matrix, steps, and estimate stay local.
 * A linked open task missing from a non-empty response was completed in Todoist.
 * An empty response never closes anything — a failed or filtered read must not wipe the list.
 */
export function mergeRemote(local, rows) {
  const list = Array.isArray(local) ? local : [];
  const remote = Array.isArray(rows) ? rows : [];
  const byId = new Map(list.filter(t => t && t.todoistId).map(t => [String(t.todoistId), t]));
  const seen = new Set();
  const created = [];
  remote.forEach(row => {
    if (!row || row.id == null) return;
    const id = String(row.id);
    seen.add(id);
    const hit = byId.get(id);
    if (hit) {
      const title = String(row.content || '').trim().slice(0, 300);
      if (title) hit.title = title;
      const p = Number(row.priority);
      if (p >= 1 && p <= 4) hit.priority = p;
      const due = dueOf(row);
      if (due) hit.due = due;
      if (row.is_completed === true) hit.done = true;
    } else {
      const t = toPackTask(row);
      if (t) created.push(t);
    }
  });
  const closed = [];
  if (remote.length) {
    list.forEach(t => {
      if (t && t.todoistId && !t.done && !seen.has(String(t.todoistId))) {
        t.done = true;
        closed.push(t);
      }
    });
  }
  return { created, closed };
}

/** Tasks in `rows` that the workspace does not already have. */
export function newRows(rows, existing) {
  const haveIds = new Set((existing || []).map(t => t.todoistId).filter(Boolean));
  const haveTitles = new Set((existing || []).map(t => String(t.title || '').trim().toLowerCase()));
  return (rows || []).filter(r => {
    const id = String((r && r.id) || '');
    const title = String((r && r.content) || '').trim().toLowerCase();
    if (!title) return false;
    if (id && haveIds.has(id)) return false;
    return !haveTitles.has(title);
  });
}

/** Tasks the workspace has that Todoist does not, newest last. */
export function unpushed(tasks) {
  return (tasks || []).filter(t => !t.todoistId && !t.done && String(t.title || '').trim());
}

/**
 * One Todoist call. `fetchImpl` is injected so tests never touch the network.
 * Errors carry a message a person can act on rather than a status code.
 */
export async function request(path, { token, method = 'GET', body, fetchImpl } = {}) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) throw new Error('No fetch available in this environment');
  if (!String(token || '').trim()) throw new Error('Add your Todoist API token first');
  const res = await f(TODOIST_API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + String(token).trim(),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (res.status === 401 || res.status === 403) throw new Error('Todoist rejected that token. Check it in Todoist → Settings → Integrations.');
  if (res.status === 429) throw new Error('Todoist is rate-limiting this device. Wait a minute and try again.');
  if (!res.ok) throw new Error('Todoist returned ' + res.status + '.');
  if (res.status === 204) return null;
  return res.json();
}

export function fetchTasks(opts) { return request('/tasks', opts); }
export function createTask(task, opts) { return request('/tasks', { ...opts, method: 'POST', body: toTodoistBody(task) }); }
export function updateTask(task, opts) {
  return request('/tasks/' + encodeURIComponent(task && task.todoistId || ''), { ...opts, method: 'POST', body: toTodoistBody(task) });
}
export function closeTask(id, opts) {
  return request('/tasks/' + encodeURIComponent(id) + '/close', { ...opts, method: 'POST' });
}
