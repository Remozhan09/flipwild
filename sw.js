// FLIPWILD — офлайн-кэш. Игра открывается мгновенно и без интернета;
// страницу игры сперва спрашиваем у сайта (3 сек), без сети — берём из кэша; остальное — из кэша с фоновым обновлением.
// Новая версия ставится сразу; игра сверяет version.json и перезагружается на титуле или в хабе (во время забега — ждёт).
const CACHE = 'flipwild-202611241208', ASSETS = 'flipwild-assets';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
// при обновлении: старые кэши удаляем, все открытые окна забираем под себя и просим перезапуститься.
// Новая страница отвечает «ack» и перезагрузится сама в безопасный момент (титул/хаб); старая (без ответа) — перезагружаем сразу.
const ACK = new Set();
self.addEventListener('message', e => { if (e.data && e.data.t === 'flipwild-ack' && e.source) ACK.add(e.source.id); });
self.addEventListener('activate', e => { e.waitUntil((async () => {
  const ks = await caches.keys(), old = ks.filter(k => k.startsWith('flipwild-') && k !== CACHE && k !== ASSETS);
  await Promise.all(old.map(k => caches.delete(k))); await self.clients.claim();
  if (!old.length) return;
  const cs = await self.clients.matchAll({ type: 'window' }); cs.forEach(c => { try { c.postMessage({ t: 'flipwild-upd' }); } catch (er) { } });
  await new Promise(r => setTimeout(r, 2500));
  await Promise.all(cs.filter(c => !ACK.has(c.id)).map(c => c.navigate(c.url).catch(() => { })));
})()); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !font) return;
  if (/version\.json$/.test(url.pathname)) { e.respondWith(fetch(req, { cache: 'no-store' })); return; }
  // картинки и музыка с меткой версии (?v=…) не меняются — берём из долгого кэша, он переживает обновления игры
  if (url.origin === location.origin && /\/(img|music)\//.test(url.pathname) && url.search) {
    e.respondWith(caches.open(ASSETS).then(async c => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r && r.ok) c.put(req, r.clone()); return r; }));
    return;
  }
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
