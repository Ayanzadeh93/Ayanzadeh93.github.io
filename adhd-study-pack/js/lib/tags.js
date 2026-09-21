/**
 * Category tags for the ADHD Study Pack.
 * Tags are not priority: the Eisenhower quadrant stays on `quad`.
 * A list can apply both at once (they merge as an AND), and two tags
 * can be folded into one without touching quadrants.
 */

export const TAG_COLORS = ['#0F766E', '#1E3A5F', '#9A5F00', '#5B4FD1', '#0A7F5F', '#CC4520', '#475569', '#4F6F52'];

export const STARTER_TAGS = [
  { id: 'reading', name: 'Reading' },
  { id: 'writing', name: 'Writing' },
  { id: 'admin', name: 'Admin' },
  { id: 'lab', name: 'Lab' },
  { id: 'review', name: 'Review' },
  { id: 'errand', name: 'Errand' }
];

export function slugTag(name) {
  return String(name || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

export function nameFromSlug(id) {
  const s = String(id || '').replace(/-/g, ' ').trim();
  return s ? s.replace(/\b\w/g, c => c.toUpperCase()) : '';
}

export function defaultCatalog() {
  return STARTER_TAGS.map((t, i) => ({ id: t.id, name: t.name, color: TAG_COLORS[i % TAG_COLORS.length] }));
}

/** Missing catalog → starters. An explicit empty array stays empty. */
export function normaliseCatalog(raw) {
  if (!Array.isArray(raw)) return defaultCatalog();
  const list = [];
  const seen = new Set();
  raw.forEach((t, i) => {
    const id = slugTag(t && (t.id || t.name));
    if (!id || seen.has(id)) return;
    seen.add(id);
    const name = String((t && t.name) || nameFromSlug(id)).trim().slice(0, 32) || nameFromSlug(id);
    const color = (t && /^#[0-9a-fA-F]{6}$/.test(t.color)) ? t.color : TAG_COLORS[list.length % TAG_COLORS.length];
    list.push({ id, name, color });
    void i;
  });
  return list.slice(0, 40);
}

export function parseTagInput(text) {
  const out = [];
  String(text || '').split(/[,;#]+/).forEach(part => {
    const id = slugTag(part);
    if (id && !out.includes(id)) out.push(id);
  });
  return out.slice(0, 8);
}

export function normaliseItemTags(tags, catalogIds) {
  const allow = catalogIds instanceof Set ? catalogIds : new Set(catalogIds || []);
  const out = [];
  (Array.isArray(tags) ? tags : []).forEach(t => {
    const id = slugTag(t);
    if (id && allow.has(id) && !out.includes(id)) out.push(id);
  });
  return out.slice(0, 8);
}

/** Keep items that match the chosen tag AND the chosen priority. Blank means “any”. */
export function matchesTagAndPriority(item, lens) {
  const tag = lens && lens.tag;
  const quad = lens && lens.quad;
  const tags = (item && item.tags) || [];
  if (tag && !tags.includes(tag)) return false;
  if (!quad) return true;
  const q = item && ['q1', 'q2', 'q3', 'q4'].includes(item.quad) ? item.quad : null;
  if (quad === 'none') return !q;
  return q === quad;
}

/** Fold `from` into `into` on every item. Quadrants are left alone. */
export function mergeTagIds(items, from, into) {
  const src = slugTag(from), dst = slugTag(into);
  if (!src || !dst || src === dst) return Array.isArray(items) ? items.slice() : [];
  return (Array.isArray(items) ? items : []).map(item => {
    const tags = Array.isArray(item && item.tags) ? item.tags.slice() : [];
    if (!tags.includes(src)) return item;
    const next = tags.filter(t => t !== src);
    if (!next.includes(dst)) next.push(dst);
    return Object.assign({}, item, { tags: next });
  });
}
