-- Base D1 de métricas anónimas del mapa (Cloudflare). Se ejecuta una vez en la consola de la base.
-- Sin datos personales: "dispositivo" es un número al azar generado en el teléfono; no se guarda la IP.
CREATE TABLE IF NOT EXISTS eventos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recibido    TEXT NOT NULL,          -- hora del servidor (UTC)
  dispositivo TEXT NOT NULL,          -- número al azar por teléfono
  sesion      TEXT,                   -- número al azar por apertura del sitio
  hora        TEXT,                   -- hora del teléfono (UTC)
  evento      TEXT NOT NULL,          -- ficha, sello, como_llegar, foto_compartir… (functions/api/eventos.js)
  detalle     TEXT                    -- estación, modo (qr/gps), capa…
);
CREATE INDEX IF NOT EXISTS eventos_evento ON eventos (evento);
CREATE INDEX IF NOT EXISTS eventos_dispositivo ON eventos (dispositivo);

CREATE TABLE IF NOT EXISTS encuestas (
  dispositivo TEXT PRIMARY KEY,       -- una respuesta por teléfono (la última vale)
  recibido    TEXT NOT NULL,
  respuestas  TEXT NOT NULL           -- JSON: {"procedencia": "valle_viejo", "interes": ["frutales", "charlas"], …}
);

-- Consultas útiles (pegar en la consola de D1):
-- Visitantes distintos:          SELECT COUNT(DISTINCT dispositivo) FROM eventos;
-- Fichas más vistas:             SELECT detalle, COUNT(DISTINCT dispositivo) p FROM eventos WHERE evento='ficha' GROUP BY detalle ORDER BY p DESC;
-- Sellos por QR o GPS:           SELECT detalle, COUNT(*) FROM eventos WHERE evento='sello' GROUP BY detalle;
-- Visitantes por hora (Arg.):    SELECT strftime('%H', hora, '-3 hours') h, COUNT(DISTINCT dispositivo) FROM eventos GROUP BY h;
-- Respuestas por procedencia:    SELECT json_extract(respuestas,'$.procedencia') v, COUNT(*) FROM encuestas GROUP BY v;
