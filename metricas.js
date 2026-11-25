/* Métricas de uso, anónimas. Cuenta qué se usa del mapa (fichas abiertas, sellos, "Cómo llegar", foto…) para que la
   EEA sepa cómo se recorrió la jornada. No guarda nombre, correo, teléfono ni ubicación: solo un número al azar por
   teléfono (para contar visitantes distintos), la hora y el evento. El servidor tampoco guarda la IP.

   Los eventos se juntan en el teléfono y se mandan de a tandas (cada 20 s y al salir de la página); sin señal quedan
   guardados y se mandan después. Si el navegador pide no ser rastreado (Do Not Track / GPC), no se manda nada.
   Destino: functions/api/eventos.js (Cloudflare Pages Functions + D1). */
(function () {
  "use strict";
  const C = window.CONFIG || {};
  const URL_EVENTOS = (C.metricas && C.metricas.eventos) || "api/eventos";
  const COLA = "pa70-metricas-cola", ID = "pa70-metricas-id", MAX = 300;
  const apagado = (C.metricas && C.metricas.activo === false) || navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true
    || /[?&]editar\b/.test(location.search) || location.protocol === "file:";

  const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (_) { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } };
  const azar = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  let disp = leer(ID, null);
  if (!disp) { disp = azar(); escribir(ID, disp); }
  const sesion = azar().slice(0, 8);
  let cola = leer(COLA, []), enviando = false;

  function evento(nombre, detalle) {
    if (apagado) return;
    cola.push({ e: String(nombre).slice(0, 40), x: detalle == null ? null : String(detalle).slice(0, 80), t: new Date().toISOString(), s: sesion });
    if (cola.length > MAX) cola = cola.slice(-MAX);
    escribir(COLA, cola);
  }
  function enviar(alSalir) {
    if (apagado || enviando || !cola.length || !navigator.onLine) return;
    const tanda = cola.slice(0, 50), cuerpo = JSON.stringify({ d: disp, ev: tanda });
    const quitar = () => { cola = cola.slice(tanda.length); escribir(COLA, cola); };
    if (alSalir && navigator.sendBeacon) { // al cerrar la pestaña no hay tiempo de esperar respuesta
      if (navigator.sendBeacon(URL_EVENTOS, new Blob([cuerpo], { type: "application/json" }))) quitar();
      return;
    }
    enviando = true;
    fetch(URL_EVENTOS, { method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpo, keepalive: true })
      .then((r) => { if (r.ok) quitar(); }) // si el servidor no está listo (503), la tanda queda para después
      .catch(() => {}).finally(() => { enviando = false; });
  }
  setInterval(() => enviar(false), 20000);
  addEventListener("online", () => enviar(false));
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") enviar(true); });

  // Contexto de la visita (sin datos personales): si viene por un QR, si está instalada como app, idioma y tamaño de pantalla.
  const standalone = matchMedia && matchMedia("(display-mode: standalone)").matches;
  evento("visita", [location.hash ? "qr" : "directo", standalone ? "app" : "web", (navigator.language || "").slice(0, 5),
    screen.width < 600 ? "telefono" : screen.width < 1100 ? "tableta" : "computadora"].join("|"));

  window.Metricas = { evento, enviar, activo: !apagado, dispositivo: () => disp };
})();
