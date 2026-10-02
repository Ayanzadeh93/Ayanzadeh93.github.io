import {
  getProjectById,
  iconGlyph,
  loadProjects,
  projectHref
} from './lib/project-data.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function addLink(container, link) {
  const kind = link.kind || 'page';
  const anchor = element('a', `data-link detail-link detail-link--${kind}`, link.label);
  anchor.href = link.href;
  if (/^https?:\/\//.test(link.href)) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  container.append(anchor);
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const content = document.querySelector('#project-content');
  const error = document.querySelector('#project-error');

  try {
    const projects = await loadProjects();
    const project = getProjectById(projects, id);
    if (!project) throw new Error('Project not found');

    // Static writeups are the canonical project pages; send readers there when present.
    if (project.legacyPage && !params.has('preview')) {
      window.location.replace(project.legacyPage);
      return;
    }

    document.title = `${project.title} | Aydin Ayanzadeh`;
    document.querySelector('meta[name="description"]').setAttribute('content', project.summary);
    document.querySelector('#project-title').textContent = project.title;
    document.querySelector('#project-subtitle').textContent = project.subtitle || '';
    document.querySelector('#project-summary').textContent = project.summary || '';

    const badges = document.querySelector('#project-badges');
    const icon = element('span', `data-icon data-icon--${project.icon || 'default'}`, iconGlyph(project.icon));
    icon.setAttribute('aria-hidden', 'true');
    badges.append(icon);
    badges.append(element('span', 'data-pill', project.category));
    badges.append(element('span', 'data-status', project.status));
    if (project.year) badges.append(element('span', 'data-status', String(project.year)));

    const meta = document.querySelector('#project-meta');
    if (meta) {
      const bits = [];
      if (project.role) bits.push(project.role);
      if (project.outcome) bits.push(project.outcome);
      meta.textContent = bits.join(' · ');
      meta.hidden = !bits.length;
    }

    const links = document.querySelector('#project-links');
    (project.links || []).forEach(link => addLink(links, link));

    const highlights = document.querySelector('#project-highlights');
    (project.highlights || []).forEach(item => highlights.append(element('li', null, item)));

    const methods = document.querySelector('#project-methods');
    (project.methods || []).forEach(item => methods.append(element('li', null, item)));

    const related = document.querySelector('#related-projects');
    (project.related || [])
      .map(relatedId => getProjectById(projects, relatedId))
      .filter(Boolean)
      .forEach(item => {
        const card = element('article', 'related-card');
        const eyebrow = element('div', 'data-card-top');
        eyebrow.append(element('span', 'data-pill', item.category));
        eyebrow.append(element('span', 'data-status', item.status));
        card.append(eyebrow);
        card.append(element('h3', null, item.title));
        if (item.outcome) card.append(element('p', 'data-card-meta', item.outcome));
        card.append(element('p', null, item.summary));
        const link = element('a', 'data-link', 'Open project');
        link.href = projectHref(item);
        card.append(link);
        related.append(card);
      });

    content.hidden = false;
    document.querySelector('#project-detail').focus({ preventScroll: true });
  } catch (err) {
    console.error(err);
    document.querySelector('.data-hero').hidden = true;
    content.hidden = true;
    error.hidden = false;
  }
}

init();
