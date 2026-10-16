/* Verit service worker: app shell works offline, hosted sites and API calls always go to the network */
const V = 'verit-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/dragon.svg', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/s/') || u.pathname === '/verit.config.json') return;
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then(x => { const c = x.clone(); caches.open(V).then(ca => ca.put('/index.html', c)); return x; })
        .catch(() => caches.match('/index.html').then(x => x || caches.match('/')))
    );
    return;
  }
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(x => { if (x.ok) { const c = x.clone(); caches.open(V).then(ca => ca.put(r, c)); } return x; }).catch(() => hit);
    return hit || net;
  }));
});
