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

export function projectHref(id) {
  return `project.html?id=${encodeURIComponent(id)}`;
}
