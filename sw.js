/* Service worker de Fin de Poste : rend le jeu installable et jouable hors ligne.
   La page passe d'abord par le réseau (pour avoir la dernière version), les images viennent du cache. */
const CACHE = "fin-de-poste-v2";
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(["/", "/manifest.webmanifest", "/icone-192.png", "/icone-512.png"]))); self.skipWaiting() });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())) });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  if (r.mode === "navigate" || r.destination === "document") {
    e.respondWith(fetch(r).then(rep => { const c = rep.clone(); caches.open(CACHE).then(k => k.put("/", c)); return rep }).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(rep => { if (rep.ok) { const c = rep.clone(); caches.open(CACHE).then(k => k.put(r, c)) } return rep })));
});
