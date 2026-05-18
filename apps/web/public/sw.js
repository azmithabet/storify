// Bump CACHE on every shell change. The activate handler nukes any cache
// whose name doesn't match — so v3 wipes the older entries.
const CACHE = 'storify-shell-v3'
const SHELL_URL = '/'

self.addEventListener('install', (e) => {
  // No precache — let the fetch handler populate naturally with fresh content.
  // Precaching "/" with the previous SW is what trapped returning users on the
  // old routing version; avoid repeating the bug.
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

// Network-first for HTML (so deploys take effect immediately),
// cache-first for everything else (hashed assets are immutable).
function isHtml(request) {
  if (request.mode === 'navigate') return true
  const accept = request.headers.get('accept') || ''
  return accept.includes('text/html')
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || req.url.includes('/api/')) return

  if (isHtml(req)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(req, clone))
          }
          return res
        })
        .catch(async () => {
          // For SPA navigations, any cached HTML response works as a fallback:
          // the client-side router will resolve the real URL once the bundle
          // boots. Prefer an exact cache hit, then the "/" shell, then a final
          // sweep across the cache. Synthetic 503 is the last resort.
          const cache = await caches.open(CACHE)
          const exact = await cache.match(req)
          if (exact) return exact
          const shell = await cache.match(SHELL_URL)
          if (shell) return shell
          const all = await cache.keys()
          for (const key of all) {
            if (isHtml(key)) {
              const hit = await cache.match(key)
              if (hit) return hit
            }
          }
          return new Response('Offline', { status: 503 })
        }),
    )
    return
  }

  e.respondWith(
    caches.match(req).then((cached) =>
      cached ??
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(req, clone))
          }
          return res
        })
        .catch(() => cached ?? new Response('Offline', { status: 503 })),
    ),
  )
})
