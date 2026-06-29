const CACHE_NAME = 'waktusolat-v2'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        Promise.allSettled(
          event.data.urls.map((url) =>
            fetch(url).then((r) => {
              if (r.ok) cache.put(url, r)
            }),
          ),
        ),
      ),
    )
  }
})

const PRECACHE_PREFIXES = ['/_nuxt/', '/icon-', '/apple-touch-icon', '/favicon']
const PRECACHE_PATHS = ['/', '/manifest.json']

function isPrecacheUrl(url) {
  if (PRECACHE_PATHS.some((p) => url.pathname === p)) return true
  return PRECACHE_PREFIXES.some((p) => url.pathname.startsWith(p))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API routes: network first, then cache.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request)),
    )
    return
  }

  // Versioned assets (hashed filenames under /_nuxt/): cache first.
  if (url.pathname.startsWith('/_nuxt/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
      }),
    )
    return
  }

  // Navigation & other pages: network first so users always get fresh HTML.
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache pre-cached paths only (not every random navigation URL).
        if (response.ok && isPrecacheUrl(url)) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        }
        return response
      })
      .catch(() => caches.match(request)),
  )
})
