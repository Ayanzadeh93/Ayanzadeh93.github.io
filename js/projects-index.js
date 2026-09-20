import { loadProjects, projectHref } from './lib/project-data.js';

const grid = document.querySelector('#project-grid');
const searchInput = document.querySelector('#project-search');
const categorySelect = document.querySelector('#project-category');
const status = document.querySelector('#project-status');

let projects = [];

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKD');
}

function matches(project, query, category) {
  if (category && project.category !== category) return false;
  if (!query) return true;
  const haystack = [
    project.title,
    project.subtitle,
    project.category,
    project.summary,
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

function projectCard(project) {
  const article = element('article', 'data-card');
  const top = element('div', 'data-card-top');
  top.append(
    element('span', 'data-pill', project.category),
    element('span', 'data-status', project.status)
  );

  const title = element('h2', null, project.title);
  const subtitle = element('p', 'data-card-subtitle', project.subtitle);
  const summary = element('p', 'data-card-summary', project.summary);

  const tags = element('ul', 'data-tags');
  (project.tags || []).slice(0, 4).forEach(tag => tags.append(element('li', null, tag)));

  const footer = element('div', 'data-card-footer');
  if (project.year) footer.append(element('span', 'data-year', String(project.year)));
  const link = element('a', 'data-link', 'View project');
  link.href = projectHref(project.id);
  link.setAttribute('aria-label', `View ${project.title}`);
  footer.append(link);

  article.append(top, title, subtitle, summary, tags, footer);
  return article;
}

function render() {
  const query = searchInput.value;
  const category = categorySelect.value;
  const visible = projects.filter(project => matches(project, query, category));
  grid.replaceChildren(...visible.map(projectCard));
  status.textContent = `${visible.length} of ${projects.length} projects shown`;
}

async function init() {
  try {
    projects = await loadProjects();
    const categories = [...new Set(projects.map(project => project.category).filter(Boolean))].sort();
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categorySelect.append(option);
    });

    searchInput.addEventListener('input', render);
    categorySelect.addEventListener('change', render);
    render();
  } catch (error) {
    console.error(error);
    status.textContent = 'Project data could not be loaded.';
    grid.append(element('p', 'data-error', 'Project data is temporarily unavailable. Use the links on the main portfolio page instead.'));
  }
}

init();
