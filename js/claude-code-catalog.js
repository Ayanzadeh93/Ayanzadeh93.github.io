const DATA_URL = '../data/claude-code/catalog.json';

const results = document.querySelector('#catalog-results');
const search = document.querySelector('#catalog-search');
const sectionSelect = document.querySelector('#catalog-section');
const status = document.querySelector('#catalog-status');

let entries = [];
let sections = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function searchable(entry) {
  return [
    entry.name,
    entry.type,
    entry.description,
    ...(entry.aliases || []),
    ...(entry.tags || []),
    ...(entry.examples || []).flatMap(example => [example.command, example.label])
  ].join(' ').toLowerCase();
}

function card(entry) {
  const article = el('article', 'data-card');
  const top = el('div', 'data-card-top');
  top.append(
    el('span', 'data-pill', sections.get(entry.section)?.label || entry.section),
    el('span', 'data-status', entry.type || 'Entry')
  );

  const title = el('h2', null, entry.name);
  const description = el('p', 'data-card-summary', entry.description);
  const tags = el('ul', 'data-tags');
  (entry.tags || []).slice(0, 5).forEach(tag => tags.append(el('li', null, tag)));

  article.append(top, title, description);

  (entry.examples || []).slice(0, 2).forEach(example => {
    const block = el('pre', 'catalog-code');
    const code = el('code', null, example.command);
    block.append(code);
    article.append(block);
  });

  if (entry.note) article.append(el('p', 'catalog-note', entry.note));
  if (tags.childElementCount) article.append(tags);
  return article;
}

function render() {
  const query = search.value.trim().toLowerCase();
  const section = sectionSelect.value;
  const visible = entries.filter(entry => {
    if (section && entry.section !== section) return false;
    if (!query) return true;
    return query.split(/\s+/).every(term => searchable(entry).includes(term));
  });

  results.replaceChildren(...visible.map(card));
  status.textContent = `${visible.length} of ${entries.length} catalog entries shown`;
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
    const payload = await response.json();
    entries = Array.isArray(payload.entries) ? payload.entries : [];
    sections = new Map((payload.sections || []).map(section => [section.id, section]));

    (payload.sections || []).forEach(section => {
      const option = document.createElement('option');
      option.value = section.id;
      option.textContent = section.label;
      sectionSelect.append(option);
    });

    search.addEventListener('input', render);
    sectionSelect.addEventListener('change', render);
    render();
  } catch (error) {
    console.error(error);
    status.textContent = 'Catalog data could not be loaded.';
    results.append(el('p', 'data-error', 'The catalog is temporarily unavailable.'));
  }
}

init();
