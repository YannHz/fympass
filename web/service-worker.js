const VERSION = "__VERSION__";
const ARCHIVOS = __ARCHIVOS__;
const nombreCache = `fym-publico-${VERSION}`;
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(nombreCache).then((cache) =>
      cache.addAll(ARCHIVOS).then(() => {
        // activa la version nueva sin esperar a que se cierren las pestanas
        return self.skipWaiting();
      }),
    ),
  );
});
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter(
              (nombre) =>
                nombre.startsWith("fym-publico-") && nombre !== nombreCache,
            )
            .map((nombre) => caches.delete(nombre)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  const direccion = new URL(peticion.url);
  // no almacena sesiones, fotos, carnes ni respuestas de la api
  if (
    peticion.method !== "GET" ||
    direccion.origin !== self.location.origin ||
    direccion.pathname === "/api" ||
    direccion.pathname.startsWith("/api/")
  )
    return;
  if (peticion.mode === "navigate") {
    evento.respondWith(
      fetch(peticion).catch(() =>
        caches
          .open(nombreCache)
          .then((cache) => cache.match("/sin-conexion.html")),
      ),
    );
    return;
  }
  if (!ARCHIVOS.includes(direccion.pathname) || direccion.search) return;
  evento.respondWith(
    caches
      .open(nombreCache)
      .then(async (cache) => (await cache.match(peticion)) || fetch(peticion)),
  );
});
