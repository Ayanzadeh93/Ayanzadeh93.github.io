const PROJECT_DATA_URL = new URL('../../data/projects.json', import.meta.url);

export async function loadProjects() {
  const response = await fetch(PROJECT_DATA_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Project data returned ${response.status}`);
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.projects)) throw new Error('Invalid project data');
  return payload.projects;
}

export function getProjectById(projects, id) {
  if (!id) return null;
  return projects.find(project => project.id === id) || null;
}

/** Prefer the static SEO writeup when present; fall back to the dynamic detail route. */
export function projectHref(projectOrId) {
  if (projectOrId && typeof projectOrId === 'object') {
    if (projectOrId.legacyPage) return projectOrId.legacyPage;
    return `project.html?id=${encodeURIComponent(projectOrId.id)}`;
  }
  return `project.html?id=${encodeURIComponent(projectOrId || '')}`;
}

export function sortProjects(projects) {
  return [...projects].sort((a, b) => {
    if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
    const yearA = a.year || 0;
    const yearB = b.year || 0;
    if (yearA !== yearB) return yearB - yearA;
    return String(a.title).localeCompare(String(b.title));
  });
}

export function iconGlyph(icon) {
  const map = {
    route: '↗',
    fire: '◇',
    terminal: '</>',
    focus: '◎',
    brain: '⊕',
    eye: '◉',
    compress: '⇔',
    graph: '⬡',
    pipeline: '⇉'
  };
  return map[icon] || '●';
}
