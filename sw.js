// Service worker: makes the app installable, work offline, and update itself.
importScripts("version.js");

const CACHE = "bolobolo-" + APP_VERSION + "-" + BUILD;
const FONT_CACHE = "bolobolo-fonts";

const FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "blocklist.js",
  "version.js",
  "manifest.json",
  "party.mp3",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/mascot.png",
  "icons/mascot-scene.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k != CACHE && k != FONT_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  let request = event.request;
  if (request.method != "GET") return;
  let url = new URL(request.url);

  // App files: try the internet first (always newest), use saved copy when offline.
  if (url.origin == location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.status == 200) {
            let copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
    );
    return;
  }

  // Google Fonts: use saved copy, refresh in background.
  if (url.hostname == "fonts.googleapis.com" || url.hostname == "fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((saved) => {
          let fresh = fetch(request).then((response) => {
            cache.put(request, response.clone());
            return response;
          }).catch(() => saved);
          return saved || fresh;
        })
      )
    );
  }

  // Everything else (Wikipedia) goes straight to the internet.
});
