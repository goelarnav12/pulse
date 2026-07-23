// Network-first, cache-as-fallback — same reasoning as Poker_ledger's sw.js:
// nothing here is content-hashed, and a status page must never show stale
// results when the network is available. The cache only serves the last-known
// state when offline. All paths are relative because GitHub Pages serves this
// from /pulse/, not a domain root.
const CACHE = "pulse-v1";
const SHELL = ["./", "./index.html", "./status.json", "./history.json", "./icon.svg", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || Response.error())
      )
  );
});
