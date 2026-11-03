/* Service worker de Fin de Poste : rend le jeu installable et jouable hors ligne.
   La page passe d'abord par le réseau (pour avoir la dernière version), les images viennent du cache. */
const CACHE = "fin-de-poste-v3";
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(["/", "/manifest.webmanifest", "/icone-192.png", "/icone-512.png"]))); self.skipWaiting() });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())) });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url); if (r.method !== "GET" || u.origin !== location.origin) return;
  // compteur de joueurs (03/11) : toujours en direct, jamais en cache
  if (u.pathname.startsWith("/api/")) return;
  if (r.mode === "navigate" || r.destination === "document") {
    // seule la page du jeu est gardée pour le hors-ligne (pas la page des stats)
    const jeu = u.pathname === "/" || u.pathname === "/index.html";
    e.respondWith(fetch(r).then(rep => { if (jeu && rep.ok) { const c = rep.clone(); caches.open(CACHE).then(k => k.put("/", c)) } return rep }).catch(() => caches.match(jeu ? "/" : r)));
    return;
  }
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(rep => { if (rep.ok) { const c = rep.clone(); caches.open(CACHE).then(k => k.put(r, c)) } return rep })));
});
