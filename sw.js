const CACHE_NAME = 'chess-pgn-trainer-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/pagestyle.css',
  '/assets/w3.js',
  '/assets/jquery.wheelcolorpicker.js',
  '/assets/wheelcolorpicker.css',
  '/assets/game-modes.js',
  '/assets/chess-pgn-trainer.js',
  '/assets/piece-list.js',
  '/img/github-mark.svg',
  '/img/github-mark-white.svg',
  // Add all PGN files
  '/PGN/1.pgn',
  '/PGN/2.pgn',
  '/PGN/3.pgn',
  '/PGN/4.pgn',
  '/PGN/5.pgn',
  '/PGN/KQvK.pgn',
  '/PGN/MorphyWhite15.pgn',
  '/PGN/Polgar_200 Mate Combinations.pgn',
  '/PGN/pgn1.pgn',
  // External libraries (CORS might prevent caching, but we try)
  'https://ajax.googleapis.com/ajax/libs/jquery/3.7.0/jquery.min.js',
  'https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css',
  'https://code.jquery.com/ui/1.13.2/jquery-ui.js',
  'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css',
  'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.2/chess.js',
  'https://cdn.jsdelivr.net/npm/@mliebelt/pgn-parser'
];

// Install event: cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event: serve from cache first, then network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // No cache hit - fetch from network
        return fetch(event.request);
      })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
