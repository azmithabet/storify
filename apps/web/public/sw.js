const CACHE = 'storify-shell-v1'
const PRECACHE = ['/', '/index.html']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  // Only cache GET requests; let API/auth pass through
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return
  e.respondWith(
    caches.match(e.request).then((cached) => cached ?? fetch(e.request).then((res) => {
      if (res.ok && res.type === 'basic') {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, clone))
      }
      return res
    }).catch(() => cached ?? new Response('Offline', { status: 503 })))
  )
})
