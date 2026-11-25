// POST /api/eventos: recibe una tanda de eventos anónimos de uso del mapa (metricas.js) y los guarda en D1.
// No se guarda la IP ni nada que identifique a la persona: un número al azar por teléfono, la hora y el evento.
// (utilidades repetidas en cada archivo: en Pages Functions cada archivo de functions/ es una ruta)
const json = (datos, estado = 200) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// Solo se aceptan pedidos del propio sitio (o sin Origin, como sendBeacon en algunos navegadores).
function mismoSitio(request) {
  const origen = request.headers.get("Origin");
  return !origen || origen === new URL(request.url).origin;
}

// Lee el cuerpo JSON con un tope de tamaño; null si no es válido.
async function cuerpo(request, tope = 20000) {
  const txt = await request.text();
  if (txt.length > tope) return null;
  try { return JSON.parse(txt); } catch (_) { return null; }
}

const texto = (v, max) => (typeof v === "string" ? v.slice(0, max) : null);
const idValido = (v) => typeof v === "string" && /^[A-Za-z0-9-]{8,40}$/.test(v);

// Eventos que se aceptan (lo demás se descarta).
const EVENTOS = new Set(["visita", "bienvenida", "ficha", "qr", "sello", "recorrido_completo", "como_llegar", "cercana", "lista",
  "agenda", "avisos", "pasaporte", "llevar_pasaporte", "foto_abrir", "foto_armada", "foto_compartir", "foto_descargar",
  "instagram", "modo", "capa", "ubicacion", "encuesta_abrir", "encuesta_enviada", "enlace"]);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "base no configurada" }, 503);
  if (!mismoSitio(request)) return json({ error: "origen" }, 403);
  const datos = await cuerpo(request);
  if (!datos || !idValido(datos.d) || !Array.isArray(datos.ev)) return json({ error: "formato" }, 400);
  const recibido = new Date().toISOString();
  const filas = datos.ev.slice(0, 50).filter((v) => v && EVENTOS.has(v.e)).map((v) =>
    env.DB.prepare("INSERT INTO eventos (recibido, dispositivo, sesion, hora, evento, detalle) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(recibido, datos.d, texto(v.s, 12), texto(v.t, 30), v.e, texto(v.x, 80)));
  if (filas.length) await env.DB.batch(filas);
  return json({ ok: filas.length });
}
