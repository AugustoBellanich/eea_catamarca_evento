// GET /api/resumen?clave=…: totales para la EEA (visitantes, eventos por tipo, fichas, sellos, horas y encuesta).
// Protegido con la variable de entorno CLAVE_METRICAS (se carga en Cloudflare, nunca en el repo).
// (utilidades repetidas en cada archivo: en Pages Functions cada archivo de functions/ es una ruta)
const json = (datos, estado = 200) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestGet({ request, env }) {
  if (!env.DB || !env.CLAVE_METRICAS) return json({ error: "no configurado" }, 503);
  if (new URL(request.url).searchParams.get("clave") !== env.CLAVE_METRICAS) return json({ error: "clave" }, 401);
  const q = (sql) => env.DB.prepare(sql).all().then((r) => r.results);
  const [visitantes, eventos, fichas, sellos, horas, completos, encuestas] = await Promise.all([
    q("SELECT COUNT(DISTINCT dispositivo) AS visitantes, COUNT(DISTINCT sesion) AS sesiones FROM eventos"),
    q("SELECT evento, COUNT(*) AS veces, COUNT(DISTINCT dispositivo) AS personas FROM eventos GROUP BY evento ORDER BY veces DESC"),
    q("SELECT detalle AS estacion, COUNT(DISTINCT dispositivo) AS personas FROM eventos WHERE evento = 'ficha' GROUP BY detalle ORDER BY personas DESC"),
    q("SELECT detalle AS estacion_y_modo, COUNT(DISTINCT dispositivo) AS personas FROM eventos WHERE evento = 'sello' GROUP BY detalle ORDER BY personas DESC"),
    q("SELECT strftime('%H', hora, '-3 hours') AS hora_local, COUNT(DISTINCT dispositivo) AS personas FROM eventos GROUP BY hora_local ORDER BY hora_local"),
    q("SELECT COUNT(DISTINCT dispositivo) AS personas FROM eventos WHERE evento = 'recorrido_completo'"),
    q("SELECT respuestas FROM encuestas"),
  ]);
  // encuesta: conteo por pregunta y opción
  const encuesta = {};
  encuestas.forEach(({ respuestas }) => {
    let r; try { r = JSON.parse(respuestas); } catch (_) { return; }
    Object.entries(r).forEach(([k, v]) => (Array.isArray(v) ? v : [v]).forEach((x) => {
      encuesta[k] = encuesta[k] || {}; encuesta[k][x] = (encuesta[k][x] || 0) + 1; }));
  });
  return json({ ...visitantes[0], recorrido_completo: completos[0].personas, encuestas: encuestas.length, eventos, fichas, sellos, horas, encuesta });
}
