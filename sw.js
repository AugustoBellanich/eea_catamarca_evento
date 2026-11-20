// Guarda el sitio, los datos y las teselas vistas para usarlo con poca señal.
const VERSION = "pa70-v25";
const BASE = ["./", "index.html", "estilos.css", "app.js", "arboles.js", "config.js", "manifest.webmanifest",
  "iconos.js", "lib/leaflet.js", "lib/leaflet.css", "img/icono.svg", "img/logo-inta70-blanco-izquierda.png", "img/logo-inta70-color-izquierda.png", "datos/estaciones.js", "datos/mapa.js", "datos/agenda.js", "datos/provisorios.js", "lib/fuentes/nunito-latin-400-normal.woff2", "lib/fuentes/nunito-latin-700-normal.woff2", "lib/fuentes/nunito-latin-800-normal.woff2", "lib/fuentes/nunito-latin-900-normal.woff2", "lib/fuentes/pixelify-sans-latin-400-normal.woff2", "lib/fuentes/pixelify-sans-latin-700-normal.woff2"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== "pa70-teselas").map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Teselas del mapa: primero la copia guardada.
  if (/\/tile\/|\/teselas\//.test(url.pathname)) {
    e.respondWith(caches.open("pa70-teselas").then(async (c) => {
      const g = await c.match(e.request);
      if (g) return g;
      const r = await fetch(e.request);
      if (r.ok || r.type === "opaque") c.put(e.request, r.clone());
      return r;
    }));
    return;
  }
  // Datos y páginas del sitio: primero la red (para tomar cambios de último momento), si falla la copia.
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then((r) => {
      const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
