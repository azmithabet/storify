// Bump CACHE on every shell change. The activate handler nukes any cache
// whose name doesn't match — so v2 wipes the v1 entries that captured the
// old "/" HTML (when "/" was AuthGuard → Dashboard → redirect to /login).
const CACHE = 'storify-shell-v2'

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
        .catch(() => caches.match(req).then((cached) => cached ?? new Response('Offline', { status: 503 }))),
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
