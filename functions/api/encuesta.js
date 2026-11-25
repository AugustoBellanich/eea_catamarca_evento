// POST /api/encuesta: guarda las respuestas de la encuesta voluntaria y anónima (opciones múltiples, config.js).
// Solo se aceptan claves y valores cortos; una respuesta por teléfono (la última reemplaza a la anterior).
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

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "base no configurada" }, 503);
  if (!mismoSitio(request)) return json({ error: "origen" }, 403);
  const datos = await cuerpo(request, 4000);
  if (!datos || !idValido(datos.d) || typeof datos.r !== "object" || !datos.r) return json({ error: "formato" }, 400);
  const resp = {};
  for (const [k, v] of Object.entries(datos.r).slice(0, 20)) {
    if (!/^[a-z_]{1,24}$/.test(k)) continue;
    const vals = (Array.isArray(v) ? v : [v]).slice(0, 8).map((x) => texto(x, 40)).filter((x) => x && /^[a-z0-9_]+$/.test(x));
    if (vals.length) resp[k] = Array.isArray(v) ? vals : vals[0];
  }
  await env.DB.prepare("INSERT INTO encuestas (dispositivo, recibido, respuestas) VALUES (?, ?, ?) " +
    "ON CONFLICT (dispositivo) DO UPDATE SET recibido = excluded.recibido, respuestas = excluded.respuestas")
    .bind(datos.d, new Date().toISOString(), JSON.stringify(resp)).run();
  return json({ ok: true });
}
