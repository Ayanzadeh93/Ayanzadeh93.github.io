const CACHE_PREFIX = 'adhd-study-pack-shell-';
const CACHE_NAME = CACHE_PREFIX + '4.46.2';
const SCOPE_URL = new URL(self.registration.scope);

function sameApp(url) {
  return url.origin === SCOPE_URL.origin && url.pathname.startsWith(SCOPE_URL.pathname);
}

function cacheableAsset(url) {
  return /\.(?:html?|m?js|css|webmanifest|svg|png|jpe?g|webp|gif|woff2?|ttf|otf)$/i.test(url.pathname);
}

function addReference(out, raw, base) {
  if (!raw || /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i.test(raw)) return;
  try {
    const url = new URL(raw, base);
    if (sameApp(url) && cacheableAsset(url) && (url.protocol === 'http:' || url.protocol === 'https:')) out.add(url.href);
  } catch (e) {}
}

async function fetchText(url) {
  try {
    const response = await fetch(url, { cache:'no-cache' });
    return response.ok ? await response.text() : '';
  } catch (e) { return ''; }
}

async function shellUrls() {
  const indexUrl = new URL('index.html', SCOPE_URL).href;
  const urls = new Set([indexUrl]);
  const visited = new Set();
  const queue = [indexUrl];
  while (queue.length && visited.size < 300) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const source = await fetchText(current);
    if (!source) continue;
    const references = [];
    if (/\.html?(?:$|[?#])/i.test(current) || current === indexUrl) {
      source.replace(/\b(?:href|src|poster)\s*=\s*(["'])(.*?)\1/gi, (_, quote, value) => {
        references.push(value);
        return _;
      });
    } else if (/\.m?js(?:$|[?#])/i.test(current)) {
      const pattern = /(?:import|export)\s+(?:[^'"`]*?\s+from\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
      let match;
      while ((match = pattern.exec(source))) references.push(match[1] || match[2]);
    } else if (/\.css(?:$|[?#])/i.test(current)) {
      source.replace(/url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/gi, (_, first, second) => {
        references.push(first || second);
        return _;
      });
    } else if (/\.webmanifest(?:$|[?#])/i.test(current)) {
      try {
        const manifest = JSON.parse(source);
        (manifest.icons || []).forEach(icon => references.push(icon.src));
      } catch (e) {}
    }
    for (const ref of references) {
      const next = new URL(ref, current);
      if (!sameApp(next)) continue;
      const href = next.href;
      if (!urls.has(href)) {
        urls.add(href);
        if (/\.(?:html?|m?js|css|webmanifest)$/i.test(next.pathname)) queue.push(href);
      }
    }
  }
  return { indexUrl, urls:[...urls] };
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await shellUrls();
    const cache = await caches.open(CACHE_NAME);
    let savedIndex = false;
    for (const href of shell.urls) {
      try {
        const response = await fetch(href, { cache:'no-cache' });
        if (!response.ok || response.type === 'opaque') continue;
        await cache.put(href, response.clone());
        if (href === shell.indexUrl) savedIndex = true;
      } catch (e) {}
    }
    if (!savedIndex) throw new Error('The app shell could not be cached.');
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!sameApp(url) || (request.mode !== 'navigate' && !cacheableAsset(url))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) {
          if (url.pathname === SCOPE_URL.pathname || url.pathname === new URL('index.html', SCOPE_URL).pathname) {
            await cache.put(new URL('index.html', SCOPE_URL).href, response.clone());
          } else if (cacheableAsset(url)) {
            await cache.put(request, response.clone());
          }
        }
        return response;
      } catch (e) {
        return (await cache.match(request))
          || (await cache.match(new URL('index.html', SCOPE_URL).href))
          || new Response('The app has not been opened online yet.', { status:503, headers:{ 'Content-Type':'text/plain; charset=utf-8' } });
      }
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') await cache.put(request, response.clone());
      return response;
    } catch (e) {
      return new Response('', { status:504, statusText:'Offline and not cached' });
    }
  })());
});
