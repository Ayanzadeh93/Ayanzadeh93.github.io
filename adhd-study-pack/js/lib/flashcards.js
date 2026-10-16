const DAY = 86400000;
const TEN_MINUTES = 10 * 60000;
const MAX_CARDS = 500;
const MAX_SIDE = 4000;

export function blankFlashcard(id, deck = 'My cards') {
  return {
    id: String(id || ''), deck: String(deck || 'My cards').slice(0, 80),
    front: '', back: '', dueAt: 0, intervalDays: 0, repetitions: 0,
    lastRated: null
  };
}

function rowsFromCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(value => String(value).trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some(value => String(value).trim())) rows.push(row);
  return rows;
}

function safeCard(raw, id, deck, now) {
  if (!raw || typeof raw !== 'object') return null;
  const front = String(raw.front ?? raw.question ?? raw.term ?? '').trim().slice(0, MAX_SIDE);
  const back = String(raw.back ?? raw.answer ?? raw.definition ?? '').trim().slice(0, MAX_SIDE);
  if (!front || !back) return null;
  return {
    id: String(raw.id || id),
    deck: String(raw.deck || deck || 'Imported deck').trim().slice(0, 80) || 'Imported deck',
    front, back,
    dueAt: Number.isFinite(+raw.dueAt) ? Math.max(0, +raw.dueAt) : now,
    intervalDays: Math.max(0, Number(raw.intervalDays) || 0),
    repetitions: Math.max(0, Math.floor(Number(raw.repetitions) || 0)),
    lastRated: Number.isFinite(+raw.lastRated) ? +raw.lastRated : null
  };
}

/** Accept a JSON array/object or two-column CSV. Import never schedules a card in the future. */
export function importDeck(text, { id = (index) => `import-${index + 1}`, deck = 'Imported deck', now = Date.now() } = {}) {
  const source = String(text || '').trim();
  if (!source) return { ok: false, cards: [], error: 'Paste a JSON deck or a CSV with front and back columns.' };
  let rows;
  if (/^[\[{]/.test(source)) {
    try {
      const parsed = JSON.parse(source);
      rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.cards) ? parsed.cards : Array.isArray(parsed.items) ? parsed.items : [parsed]);
    } catch (e) {
      return { ok: false, cards: [], error: 'That JSON could not be read. No cards were added.' };
    }
  } else {
    const csv = rowsFromCsv(source);
    if (!csv.length) return { ok: false, cards: [], error: 'No card rows were found.' };
    const header = csv[0].map(cell => String(cell).trim().toLowerCase());
    const frontAt = Math.max(header.indexOf('front'), header.indexOf('question'), header.indexOf('term'));
    const backAt = Math.max(header.indexOf('back'), header.indexOf('answer'), header.indexOf('definition'));
    const deckAt = header.indexOf('deck');
    if (frontAt >= 0 && backAt >= 0) {
      rows = csv.slice(1).map(row => ({ front: row[frontAt], back: row[backAt], deck: deckAt >= 0 ? row[deckAt] : deck }));
    } else {
      rows = csv.map(row => ({ front: row[0], back: row[1], deck }));
    }
  }
  if (!Array.isArray(rows) || rows.length > MAX_CARDS) {
    return { ok: false, cards: [], error: `A deck can contain up to ${MAX_CARDS} cards at a time.` };
  }
  const cards = rows.map((row, index) => safeCard(row, id(index), deck, now)).filter(Boolean);
  if (!cards.length) return { ok: false, cards: [], error: 'No complete front and back pairs were found. No cards were added.' };
  return { ok: true, cards, error: '' };
}

export function dueCards(cards, now = Date.now(), limit = Infinity) {
  return (cards || []).filter(card => card && Number(card.dueAt || 0) <= now)
    .slice().sort((a, b) => Number(a.dueAt || 0) - Number(b.dueAt || 0)
      || String(a.deck || '').localeCompare(String(b.deck || ''))
      || String(a.front || '').localeCompare(String(b.front || '')))
    .slice(0, Math.max(0, Number(limit) || 0));
}

/** Again returns soon; Good and Easy lengthen intervals only after recall. */
export function rateFlashcard(card, rating, now = Date.now()) {
  if (!card || !['again', 'good', 'easy'].includes(rating)) return { ok: false, card };
  const repetitions = Math.max(0, Math.floor(Number(card.repetitions) || 0));
  const prior = Math.max(0, Number(card.intervalDays) || 0);
  const intervalDays = rating === 'again'
    ? 0
    : rating === 'easy'
      ? (prior ? Math.max(1, Math.round(prior * 3.5)) : 4)
      : (prior ? Math.max(1, Math.round(prior * 2.3)) : (repetitions ? 3 : 1));
  const dueAt = rating === 'again' ? now + TEN_MINUTES : now + intervalDays * DAY;
  return {
    ok: true,
    card: Object.assign({}, card, {
      repetitions: rating === 'again' ? 0 : repetitions + 1,
      intervalDays, dueAt, lastRated: now
    })
  };
}

export const FLASHCARD_LIMIT = MAX_CARDS;
