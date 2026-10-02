import {
  iconGlyph,
  loadProjects,
  projectHref,
  sortProjects
} from './lib/project-data.js';

const grid = document.querySelector('#project-grid');
const searchInput = document.querySelector('#project-search');
const categorySelect = document.querySelector('#project-category');
const statusSelect = document.querySelector('#project-status-filter');
const status = document.querySelector('#project-status');
const featuredRail = document.querySelector('#featured-rail');

let projects = [];

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKD');
}

function matches(project, query, category, statusFilter) {
  if (category && project.category !== category) return false;
  if (statusFilter && project.status !== statusFilter) return false;
  if (!query) return true;
  const haystack = [
    project.title,
    project.subtitle,
    project.category,
    project.status,
    project.summary,
    project.outcome,
    project.role,
    ...(project.methods || []),
    ...(project.tags || [])
  ].map(normalize).join(' ');
  return query.trim().split(/\s+/).every(term => haystack.includes(normalize(term)));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fillSelect(select, values, allLabel) {
  if (!select) return;
  select.replaceChildren();
  const all = document.createElement('option');
  all.value = '';
  all.textContent = allLabel;
  select.append(all);
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function projectCard(project, { compact = false } = {}) {
  const article = element('article', compact ? 'data-card data-card--featured' : 'data-card');
  if (project.featured) article.classList.add('is-featured');
  article.dataset.category = project.category || '';
  article.dataset.status = project.status || '';

  const top = element('div', 'data-card-top');
  const icon = element('span', `data-icon data-icon--${project.icon || 'default'}`, iconGlyph(project.icon));
  icon.setAttribute('aria-hidden', 'true');
  top.append(icon, element('span', 'data-pill', project.category));
  top.append(element('span', `data-status data-status--${normalize(project.status).replace(/\s+/g, '-')}`, project.status));

  const title = element('h2', null, project.title);
  const subtitle = element('p', 'data-card-subtitle', project.subtitle);
  const summary = element('p', 'data-card-summary', project.summary);

  const meta = element('p', 'data-card-meta');
  const bits = [];
  if (project.role) bits.push(project.role);
  if (project.outcome) bits.push(project.outcome);
  meta.textContent = bits.join(' · ');

  const tags = element('ul', 'data-tags');
  (project.tags || []).slice(0, 4).forEach(tag => tags.append(element('li', null, tag)));

  const footer = element('div', 'data-card-footer');
  if (project.year) footer.append(element('span', 'data-year', String(project.year)));
  const link = element('a', 'data-link', 'Open project');
  link.href = projectHref(project);
  link.setAttribute('aria-label', `Open ${project.title}`);
  footer.append(link);

  article.append(top, title, subtitle);
  if (meta.textContent) article.append(meta);
  article.append(summary, tags, footer);
  return article;
}

function renderFeatured() {
  if (!featuredRail) return;
  const featured = projects.filter(project => project.featured);
  if (!featured.length) {
    featuredRail.hidden = true;
    return;
  }
  featuredRail.hidden = false;
  const list = featuredRail.querySelector('#featured-list');
  list.replaceChildren(...featured.map(project => projectCard(project, { compact: true })));
}

function render() {
  const query = searchInput.value;
  const category = categorySelect.value;
  const statusFilter = statusSelect ? statusSelect.value : '';
  const visible = sortProjects(
    projects.filter(project => matches(project, query, category, statusFilter))
  );
  grid.replaceChildren(...visible.map(project => projectCard(project)));
  status.textContent = `${visible.length} of ${projects.length} projects shown`;
}

async function init() {
  try {
    projects = sortProjects(await loadProjects());
    const categories = [...new Set(projects.map(project => project.category).filter(Boolean))].sort();
    const statuses = [...new Set(projects.map(project => project.status).filter(Boolean))].sort();
    fillSelect(categorySelect, categories, 'All categories');
    fillSelect(statusSelect, statuses, 'All statuses');

    searchInput.addEventListener('input', render);
    categorySelect.addEventListener('change', render);
    if (statusSelect) statusSelect.addEventListener('change', render);

    renderFeatured();
    render();
  } catch (error) {
    console.error(error);
    status.textContent = 'Project data could not be loaded.';
    grid.append(element('p', 'data-error', 'Project data is temporarily unavailable. Use the links on the main portfolio page instead.'));
  }
}

init();
