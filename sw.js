const CACHE_NAME = 'zhuyin-drill-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/ZhuyinDrill_v5.jsx',
  '/manifest.json',
  // Hier alle Audios (Beispielhaft, erweitere die Liste für alle 37)
  '/audio/bo.mp3', '/audio/po.mp3', '/audio/mo.mp3', '/audio/fo.mp3',
  '/audio/de.mp3', '/audio/te.mp3', '/audio/ne.mp3', '/audio/le.mp3',
  '/audio/ge.mp3', '/audio/ke.mp3', '/audio/he.mp3', '/audio/ji.mp3',
  '/audio/qi.mp3', '/audio/xi.mp3', '/audio/zhi.mp3', '/audio/chi.mp3',
  '/audio/shi.mp3', '/audio/ri.mp3', '/audio/zi.mp3', '/audio/ci.mp3',
  '/audio/si.mp3', '/audio/yi.mp3', '/audio/wu.mp3', '/audio/yu.mp3',
  '/audio/a.mp3', '/audio/o.mp3', '/audio/e.mp3', '/audio/ie.mp3',
  '/audio/ai.mp3', '/audio/ei.mp3', '/audio/ao.mp3', '/audio/ou.mp3',
  '/audio/an.mp3', '/audio/en.mp3', '/audio/ang.mp3', '/audio/eng.mp3',
  '/audio/er.mp3'
];

// Installation: Dateien in den Cache laden
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Aktivierung: Alte Caches löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => k !== CACHE_NAME && caches.delete(k))
    ))
  );
});

// Strategie: Erst im Cache suchen, dann Netzwerk
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});