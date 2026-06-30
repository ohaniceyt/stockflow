/**
 * StockFlow vNext Service Worker
 *
 * Simple cache-first strategy for static assets and shell files.
 * This is a baseline implementation; Workbox can be adopted later for
 * more advanced precaching and background sync.
 */

const CACHE_NAME = 'stockflow-v1'
const SHELL_ASSETS = ['/', '/index.html', '/app.html', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch(() => {
        // Some shell files may not exist in every environment; ignore failures.
      })
    })
  )
  // Activate immediately.
  void (self as unknown as ServiceWorkerGlobalScope).skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => (self as unknown as ServiceWorkerGlobalScope).clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  // Do not cache non-GET requests, API calls, or Supabase/auth requests.
  if (request.method !== 'GET') return
  if (request.url.includes('/supabase/') || request.url.includes('/auth/')) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached
      }

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          const responseClone = response.clone()
          void caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })

          return response
        })
        .catch(() => {
          // Return a minimal offline fallback for navigation requests.
          if (request.mode === 'navigate') {
            return caches.match('/index.html').then((fallback) => {
              return fallback ?? new Response('StockFlow is offline.', { status: 503 })
            })
          }
          return new Response('Offline', { status: 503 })
        })
    })
  )
})
