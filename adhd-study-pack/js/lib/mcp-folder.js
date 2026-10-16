/* Merge the page and the assistant folder. No DOM and no files.
   The page decides when to write and when to paint. */

import { normaliseWorkspace, mergePush } from './mcp-store.js';
import { stampSnapshot, rememberWorkspace } from './mcp-link.js';

const LISTS = ['tasks', 'events', 'notes', 'habits', 'subjects', 'links', 'moods', 'sessions'];

function strip(item) {
  const copy = Object.assign({}, item);
  delete copy.updated;
  return copy;
}

function pageMissing(page, ws) {
  return LISTS.some(key => {
    const have = new Map((page && page[key] || []).filter(x => x && x.id).map(x => [String(x.id), JSON.stringify(strip(x))]));
    return (ws[key] || []).some(item => {
      if (!item || !item.id) return false;
      const prev = have.get(String(item.id));
      return !prev || prev !== JSON.stringify(strip(item));
    });
  });
}

export function syncFolderText(text, page, cache, now = Date.now()) {
  let parsed = null;
  if (text && String(text).trim()) {
    try { parsed = JSON.parse(text); }
    catch (e) { return { error: true }; }
  }
  const disk = normaliseWorkspace(parsed);
  const snap = stampSnapshot(page || {}, cache || {}, now);
  const seen = (cache && cache.seen) || [];
  const merged = mergePush(disk, { snapshot: snap, seen });
  return {
    ws: merged.ws,
    cache: rememberWorkspace(merged.ws),
    json: JSON.stringify(merged.ws),
    apply: pageMissing(page || {}, merged.ws),
    write: merged.changed
  };
}
