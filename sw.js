// FLIPWILD — офлайн-кэш. Игра открывается мгновенно и без интернета;
// страницу игры сперва спрашиваем у сайта (3 сек), без сети — берём из кэша; остальное — из кэша с фоновым обновлением.
// Новая версия ставится сразу и перезагружает игру, если она на титуле или в хабе.
const CACHE = 'flipwild-202611150927';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('flipwild-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !font) return;
  const page = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  if (page && url.origin === location.origin) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const net = fetch(req, { cache: 'no-cache' }).then(r => { if (r && r.ok) c.put('./index.html', r.clone()); return r; });
      const late = new Promise(res => setTimeout(res, 3000));
      try { const r = await Promise.race([net, late.then(() => null)]); if (r) return r; } catch (er) { }
      return (await c.match('./index.html')) || net;
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req, { cache: 'no-cache' }).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
