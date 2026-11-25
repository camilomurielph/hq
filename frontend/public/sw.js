// Lightweight network-first Service Worker for PWA installability
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Never intercept API calls
  if (url.pathname.startsWith('/api/')) return
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
