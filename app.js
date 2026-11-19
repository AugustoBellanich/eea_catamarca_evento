/* INTA a Puertas Abiertas – 70 años.
   Mapa por niveles de detalle (lejos: INTA · medio: paradas e ingresos · cerca: lotes y frutitas),
   paradas agrupadas cuando se superponen, fichas, agenda, avisos, pasaporte de sellos y modo foto.
   Sin dependencias además de Leaflet. Contenido en datos/ y config.js. */
(function () {
  "use strict";
  const C = window.CONFIG, ICON = window.ICONOS;
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const EDITOR = params.has("editar");
  const DEMO = params.has("demo");
  const K = { borrador: "pa70-geojson-borrador", sellos: "pa70-sellos", leidos: "pa70-avisos-leidos", agenda: "pa70-agenda-cache" };

  let estaciones = [];
  let geo = { type: "FeatureCollection", features: [] };
  let actividades = [], avisos = [];
  let modo = "ilustrado", nivel = "medio";
  let capaFondo = null, capaFrutas = null, capaServicios = null, capaParadas = null;
  let miPosicion = null, marcaYo = null, circuloYo = null, seguimiento = null;
  let sellos = leer(K.sellos, []);
  let leidos = leer(K.leidos, []);
  // Estilo visual: moderno o pixel (se recuerda en el navegador; ?tema=pixel lo fuerza).
  const TEMA = params.get("tema") || leer("pa70-tema", null) || C.tema || "moderno";
  document.body.classList.toggle("tema-pixel", TEMA === "pixel");
  // Capas visibles (se recuerdan en el navegador).
  const capas = Object.assign({ estaciones: true, lotes: true, servicios: true }, leer("pa70-capas", {}));

  function leer(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (_) { return def; } }
  function escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

  // Las hojas se apoyan sobre la barra de pestañas, sin taparla.
  const ajustarAlto = () => document.documentElement.style.setProperty("--alto-acciones", $(".pestanas").offsetHeight + "px");
  ajustarAlto(); addEventListener("resize", ajustarAlto);
  $("#titulo").textContent = C.titulo;
  $("#subtitulo").textContent = C.subtitulo;
  if (C.logo) {
    $("#barra-logo").src = C.logo;
    $("#titulo").textContent = C.tituloCorto || C.titulo;
    $("#subtitulo").textContent = C.subtituloCorto || C.subtitulo;
  } else $("#barra-logo").hidden = true;

  function avisar(texto, ms = 3500) {
    const a = $("#aviso");
    a.textContent = texto; a.hidden = false;
    clearTimeout(avisar.t); avisar.t = setTimeout(() => (a.hidden = true), ms);
  }

  // ---------- Datos del mapa ----------
  const estacion = (id) => estaciones.find((e) => e.id === id);
  const zona = (e) => C.zonas[e.zona] || { nombre: "", color: "#0a5aa8" };
  // Un lote pertenece a una estación por properties.estacion (o, en datos viejos, por tener el id de la estación).
  const estDe = (f) => f.properties.estacion || (estacion(f.properties.id) ? f.properties.id : null);
  const esEstacion = (f) => !!estDe(f);
  const esServicio = (f) => f.properties.tipo === "servicio";
  const esPredio = (f) => f.properties.tipo === "predio" || f.properties.id === "predio";
  const esCamino = (f) => /^camino/.test(f.properties.id);
  const esContexto = (f) => !esEstacion(f) && !esServicio(f) && !esPredio(f) && !esCamino(f);
  const lotesDe = (id) => geo.features.filter((f) => estDe(f) === id);
  const ubicadas = () => estaciones.filter((e) => lotesDe(e.id).length);

  function centro(f) {
    const g = f.geometry;
    if (g.type === "Point") return L.latLng(g.coordinates[1], g.coordinates[0]);
    const pts = g.type === "Polygon" ? g.coordinates[0].slice(0, -1) : g.type === "LineString" ? g.coordinates
      : g.coordinates.flatMap((pol) => pol[0].slice(0, -1));
    let la = 0, lo = 0;
    pts.forEach((p) => { lo += p[0]; la += p[1]; });
    return L.latLng(la / pts.length, lo / pts.length);
  }
  function centroEstacion(id) {
    const cs = lotesDe(id).map(centro);
    if (!cs.length) return null;
    return L.latLng(cs.reduce((a, c) => a + c.lat, 0) / cs.length, cs.reduce((a, c) => a + c.lng, 0) / cs.length);
  }

  // Estaciones sin lote en el KML: se muestran en un lugar provisorio (datos/provisorios.js), marcadas como tales.
  function sumarProvisorias() {
    const prov = (window.PROVISORIOS && window.PROVISORIOS.features) || [];
    prov.forEach((p) => {
      const id = p.properties.estacion;
      if (geo.features.some((f) => estDe(f) === id && !f.properties.provisorio)) return; // ya tiene lugar real
      // si la provisoria usa un lote del KML, ese lote deja de dibujarse como contexto
      const misma = JSON.stringify(p.geometry.coordinates);
      geo.features = geo.features.filter((f) => !(esContexto(f) && JSON.stringify(f.geometry.coordinates) === misma));
      geo.features.push(p);
    });
  }
  const esProvisoria = (id) => lotesDe(id).length > 0 && lotesDe(id).every((f) => f.properties.provisorio);

  // ---------- Mapa ----------
  const mapa = L.map("mapa", { zoomControl: false, attributionControl: true, maxZoom: 20, zoomSnap: 0.5 }).setView(C.centro, C.zoom);
  L.control.zoom({ position: "topleft" }).addTo(mapa);
  const satelital = L.tileLayer(C.teselas.url, { maxZoom: 20, maxNativeZoom: C.teselas.zoomMax, attribution: C.teselas.atribucion });

  // Esri devuelve una imagen gris ("Map data not yet available") donde no tiene foto, en lugar de un error.
  // Se consulta hasta qué zoom hay foto en el centro del predio y de ahí en adelante se amplía esa.
  async function zoomConFoto(p) {
    for (const z of [20, 19, 18]) {
      if (z <= C.teselas.zoomMax) break;
      const n = 2 ** z, rad = p.lat * Math.PI / 180;
      const x = Math.floor((p.lng + 180) / 360 * n);
      const y = Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n);
      const r = await fetch(C.teselas.disponibilidad.replace("{z}", z).replace("{x}", x).replace("{y}", y));
      const j = await r.json();
      if (j && j.data && j.data[0] === 1) return z;
    }
    return C.teselas.zoomMax;
  }
  async function ajustarZoomSatelital(puntos) {
    if (!C.teselas.disponibilidad || !puntos.length) return;
    try {
      const z = Math.min(...(await Promise.all(puntos.map(zoomConFoto))));
      if (z !== satelital.options.maxNativeZoom) { satelital.options.maxNativeZoom = z; satelital.redraw(); }
    } catch (_) { /* sin señal o sin permiso: queda el zoom asegurado */ }
  }

  // Control "Capas": vista (ilustrado o satelital) y qué se muestra sobre el mapa.
  const BotonCapas = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const caja = L.DomUtil.create("div", "capas");
      caja.innerHTML = `<button type="button" class="boton-modo" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>Capas</button>
        <div class="capas-panel" hidden>
          <div class="capas-vista"><button type="button" data-modo="ilustrado">Ilustrado</button><button type="button" data-modo="satelital">Satelital</button></div>
          <div class="capas-titulo">Estilo</div>
          <div class="capas-vista capas-tema"><button type="button" data-tema="moderno">Moderno</button><button type="button" data-tema="pixel">Pixel</button></div>
          <div class="capas-titulo">Mostrar</div>
          <label><input type="checkbox" data-capa="estaciones"> Estaciones</label>
          <label><input type="checkbox" data-capa="lotes"> Lotes y cultivos</label>
          <label><input type="checkbox" data-capa="servicios"> Ingresos y servicios</label>
        </div>`;
      L.DomEvent.disableClickPropagation(caja); L.DomEvent.disableScrollPropagation(caja);
      const boton = caja.querySelector(".boton-modo"), panel = caja.querySelector(".capas-panel");
      boton.onclick = () => { panel.hidden = !panel.hidden; boton.setAttribute("aria-expanded", String(!panel.hidden)); };
      caja.querySelectorAll("[data-modo]").forEach((b) => (b.onclick = () => ponerModo(b.dataset.modo)));
      caja.querySelectorAll("[data-tema]").forEach((b) => {
        b.classList.toggle("activo", b.dataset.tema === TEMA);
        b.onclick = () => { // cambiar de estilo recarga la página (los íconos se preparan al abrir)
          if (b.dataset.tema === TEMA) return;
          escribir("pa70-tema", b.dataset.tema);
          params.delete("tema"); const q = params.toString();
          location.replace(location.pathname + (q ? "?" + q : "") + location.hash);
        };
      });
      caja.querySelectorAll("[data-capa]").forEach((c) => {
        c.checked = capas[c.dataset.capa];
        c.onchange = () => { capas[c.dataset.capa] = c.checked; escribir("pa70-capas", capas); dibujarFondo(); actualizarNivel(true); };
      });
      this.caja = caja; return caja;
    },
  });
  const botonCapas = new BotonCapas().addTo(mapa);
  mapa.on("click", () => { const p = botonCapas.caja.querySelector(".capas-panel"); if (!EDITOR) p.hidden = true; });

  function ponerModo(m) {
    modo = m;
    $("#mapa").classList.toggle("ilustrado", m === "ilustrado");
    if (m === "satelital") satelital.addTo(mapa); else satelital.remove();
    // En satelital no se deja acercar más allá de donde la imagen se ve bien.
    mapa.setMaxZoom(m === "satelital" ? (C.teselas.zoomTope || 19) : 20);
    if (mapa.getZoom() > mapa.getMaxZoom()) mapa.setZoom(mapa.getMaxZoom());
    botonCapas.caja.querySelectorAll("[data-modo]").forEach((b) => b.classList.toggle("activo", b.dataset.modo === m));
    dibujarFondo();
    actualizarNivel(true);
  }

  // Patrones de relleno del modo ilustrado (en el SVG de Leaflet).
  const PATRONES = `
    <pattern id="p-arboles" width="18" height="18" patternUnits="userSpaceOnUse">
      <rect width="18" height="18" fill="#cfe2ae"/><circle cx="9" cy="10" r="6" fill="#3f7d33"/><circle cx="7.5" cy="8" r="2.6" fill="#6aa94f"/></pattern>
    <pattern id="p-hileras" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="#e4dcb9"/><rect x="3" width="4" height="10" fill="#6f9a37"/><circle cx="5" cy="5" r="1.6" fill="#6b2f6e"/></pattern>
    <pattern id="p-surcos" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
      <rect width="9" height="9" fill="#ecd9a2"/><rect y="3" width="9" height="3" fill="#97b34a"/></pattern>
    <pattern id="p-pasto" width="14" height="14" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill="#dbe7b0"/><path d="M3 10l2-4 2 4M9 5l2-4 2 4" stroke="#8fae4a" stroke-width="1.4" fill="none"/></pattern>
    <pattern id="p-agua" width="16" height="10" patternUnits="userSpaceOnUse">
      <rect width="16" height="10" fill="#8fd0f0"/><path d="M0 6q4-4 8 0t8 0" stroke="#e3f5fd" stroke-width="1.6" fill="none"/></pattern>
    <pattern id="p-edificio" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#e9e1d1"/><rect width="2" height="8" fill="#d6cab2"/></pattern>`;
  // Versión pixel: todo en cuadraditos.
  const PATRONES_PIX = `
    <pattern id="p-arboles" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#c9de9c"/><rect x="2" y="2" width="10" height="10" fill="#3d7a2a"/><rect x="4" y="4" width="4" height="4" fill="#6fb04a"/><rect x="6" y="12" width="2" height="2" fill="#7a5230"/></pattern>
    <pattern id="p-hileras" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="#e2d8ae"/><rect x="2" width="6" height="10" fill="#6f9a37"/><rect x="4" y="4" width="2" height="2" fill="#6b2f6e"/></pattern>
    <pattern id="p-surcos" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#e8d398"/><rect y="2" width="8" height="4" fill="#97b34a"/></pattern>
    <pattern id="p-pasto" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="#d6e5a6"/><rect x="2" y="6" width="2" height="4" fill="#8fae4a"/><rect x="8" y="2" width="2" height="4" fill="#8fae4a"/></pattern>
    <pattern id="p-agua" width="12" height="8" patternUnits="userSpaceOnUse">
      <rect width="12" height="8" fill="#5fb8e8"/><rect x="2" y="3" width="6" height="2" fill="#bfe7fb"/></pattern>
    <pattern id="p-edificio" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#e6dccb"/><rect width="4" height="4" fill="#d3c5aa"/><rect x="4" y="4" width="4" height="4" fill="#d3c5aa"/></pattern>`;
  function ponerPatrones() {
    const svg = mapa.getPanes().overlayPane.querySelector("svg");
    if (svg && !svg.querySelector("#p-arboles")) {
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      defs.innerHTML = TEMA === "pixel" ? PATRONES_PIX : PATRONES; svg.insertBefore(defs, svg.firstChild);
    }
  }

  function estilo(f) {
    const ilu = modo === "ilustrado", p = f.properties;
    if (esPredio(f)) return ilu ? { color: "#a8946a", weight: 2, dashArray: "2 6", fillColor: "#e4ebc8", fillOpacity: 1, className: "predio" }
      : { color: "#ffffff", weight: 2, dashArray: "4 6", fill: false, className: "predio" };
    if (esCamino(f)) return ilu ? { color: "#f8f3e6", weight: 12, lineCap: "round", className: "camino" }
      : { color: "#ffffff", weight: 4, opacity: 0.7, className: "camino" };
    if (esContexto(f) || (!capas.estaciones && esEstacion(f))) return ilu ? { color: "#9c8a63", weight: 1.5, fillOpacity: 1, className: "lote lote-ctx p-" + (p.patron || "pasto") }
      : { color: "#ffffff", weight: 1.5, opacity: 0.85, fillColor: "#ffffff", fillOpacity: 0.12, className: "lote lote-ctx" };
    const e = estacion(estDe(f));
    if (p.provisorio) return { color: zona(e).color, weight: 3, dashArray: "6 6", fillColor: zona(e).color, fillOpacity: 0.18, className: "lote lote-est lote-prov" };
    return ilu ? { color: zona(e).color, weight: 3, fillOpacity: 1, className: "lote lote-est p-" + (p.patron || e.patron || "pasto") }
      : { color: zona(e).color, weight: 3, fillColor: zona(e).color, fillOpacity: 0.35, className: "lote lote-est" };
  }

  // Fondo: predio, caminos y lotes. Se dibuja una vez por modo; el nivel de detalle lo resuelve el CSS.
  function dibujarFondo() {
    if (capaFondo) capaFondo.remove();
    capaFondo = L.featureGroup().addTo(mapa);
    const orden = (f) => (esPredio(f) ? 0 : esCamino(f) ? 1 : esContexto(f) ? 2 : 3);
    const vect = geo.features.filter((f) => f.geometry.type !== "Point").sort((a, b) => orden(a) - orden(b));
    if (modo === "ilustrado") {
      L.geoJSON({ type: "FeatureCollection", features: vect.filter(esCamino) },
        { style: { color: "#cdbb8f", weight: 16, lineCap: "round", className: "camino" }, interactive: false }).addTo(capaFondo);
    }
    // Estaciones provisorias de un solo punto: un círculo punteado de 18 m para que se vea el lugar.
    geo.features.filter((f) => capas.estaciones && f.properties.provisorio && f.geometry.type === "Point").forEach((f) => {
      const e = estacion(estDe(f));
      L.circle(centro(f), { radius: 18, color: zona(e).color, weight: 3, dashArray: "6 6", fillColor: zona(e).color, fillOpacity: 0.18,
        className: "lote lote-est lote-prov" }).on("click", () => abrirFicha(e.id)).addTo(capaFondo);
    });
    L.geoJSON({ type: "FeatureCollection", features: vect }, {
      style: estilo,
      onEachFeature: (f, capa) => {
        if (esEstacion(f) && capas.estaciones) capa.on("click", () => abrirFicha(estDe(f)));
        else if (esPredio(f)) capa.on("click", () => { if (nivel === "lejos") verPredio(); });
        if (esPredio(f) && f.properties.nombre && sectores().length > 1)
          capa.bindTooltip(f.properties.nombre, { permanent: true, direction: "center", className: "sector-nombre" });
        if ((esContexto(f) || (!capas.estaciones && esEstacion(f))) && f.properties.nombre && capas.lotes) capa.bindTooltip(f.properties.nombre, { permanent: true, direction: "bottom", offset: [0, 14], className: "ctx-nombre" });
      },
    }).addTo(capaFondo);
    ponerPatrones();
  }

  // El predio puede venir en varios sectores: se encuadran todos; el pin de INTA va en el primero.
  const sectores = () => geo.features.filter(esPredio);
  const predio = () => sectores()[0];
  function verPredio() {
    const ss = sectores();
    if (ss.length) mapa.fitBounds(L.geoJSON({ type: "FeatureCollection", features: ss }).getBounds(), { padding: [12, 12] });
  }

  // ---------- Niveles de detalle ----------
  function calcularNivel() {
    const z = mapa.getZoom();
    return z < C.zoomParadas ? "lejos" : z < C.zoomLotes ? "medio" : "cerca";
  }
  function actualizarNivel(forzar) {
    const n = calcularNivel();
    const cambio = n !== nivel;
    nivel = n;
    ["lejos", "medio", "cerca"].forEach((x) => $("#mapa").classList.toggle("nivel-" + x, x === nivel));
    if (cambio || forzar) { dibujarFrutas(); dibujarServicios(); }
    dibujarParadas(); // las agrupaciones cambian con cada zoom
  }
  mapa.on("zoomend", () => actualizarNivel(false));

  // Frutitas de los lotes: solo de cerca.
  function dibujarFrutas() {
    if (capaFrutas) capaFrutas.remove();
    capaFrutas = L.layerGroup();
    if (nivel !== "cerca" || !capas.lotes) return;
    geo.features.filter((f) => !(f.properties.provisorio && !capas.estaciones))
      .filter((f) => (f.properties.cultivo || f.properties.provisorio) && f.geometry.type !== "LineString").forEach((f) => {
      const cultivo = f.properties.cultivo || (estacion(estDe(f)) || {}).icono;
      const m = L.marker(centro(f), { icon: L.divIcon({ className: "icono-libre", iconSize: [40, 40], iconAnchor: [20, 20],
        html: `<div class="fruta${f.properties.provisorio ? " prov" : ""}">${ICON[cultivo] || ""}</div>` }), interactive: esEstacion(f) && capas.estaciones, keyboard: false });
      if (esEstacion(f) && capas.estaciones) m.on("click", () => abrirFicha(estDe(f)));
      m.addTo(capaFrutas);
    });
    capaFrutas.addTo(mapa);
  }

  // Ingresos y otros servicios: desde el nivel medio.
  function dibujarServicios() {
    if (capaServicios) capaServicios.remove();
    capaServicios = L.layerGroup();
    if (nivel === "lejos" || !capas.servicios) return;
    geo.features.filter((f) => esServicio(f) && f.geometry.type === "Point").forEach((f) => {
      const texto = nivel === "cerca" ? f.properties.nombre : f.properties.servicio === "ingreso" ? "Ingreso" : "";
      L.marker(centro(f), { interactive: false, keyboard: false, icon: L.divIcon({ className: "icono-libre", iconSize: [150, 30], iconAnchor: [75, 15],
        html: `<div class="servicio-caja"><span class="servicio${texto ? "" : " solo-icono"}">${ICON[f.properties.servicio] || ""}${esc(texto)}</span></div>` }) }).addTo(capaServicios);
    });
    capaServicios.addTo(mapa);
  }

  // Paradas: de lejos, solo el pin de INTA; desde el nivel medio, banderines agrupados si se superponen.
  function dibujarParadas() {
    if (capaParadas) capaParadas.remove();
    capaParadas = L.layerGroup().addTo(mapa);
    if (nivel === "lejos") {
      const p = predio();
      const c = p ? centro(p) : L.latLng(C.centro);
      L.marker(c, { icon: L.divIcon({ className: "icono-libre", iconSize: [230, 76], iconAnchor: [115, 76],
        html: C.logoColor ? `<div class="pin-inta pin-logo"><img src="${esc(C.logoColor)}" alt="INTA 70 años"><span>EEA Catamarca</span></div><div class="pin-punta"></div>`
          : `<div class="pin-inta"><span class="pin-70">70</span><span><b>INTA</b><br>EEA Catamarca</span></div><div class="pin-punta"></div>` }) })
        .on("click", verPredio).addTo(capaParadas);
      return;
    }
    if (!capas.estaciones) return;
    // Ubicación de banderines sin superposición (como las etiquetas de un mapa): cada estación tiene un punto en su
    // lugar; su banderín se ubica en el primer hueco libre alrededor y se une al punto con una línea guía.
    const cerca = nivel === "cerca";
    const mini = !cerca && mapa.getZoom() < C.zoomParadas + 1; // vista inicial: solo el número
    const es = ubicadas().slice().sort((a, b) => (parseInt(a.numero, 10) || 99) - (parseInt(b.numero, 10) || 99));
    const anclas = es.map((e) => ({ e, ll: centroEstacion(e.id), pt: mapa.latLngToLayerPoint(centroEstacion(e.id)) }));
    const ocupados = anclas.map((a) => ({ x1: a.pt.x - 8, y1: a.pt.y - 8, x2: a.pt.x + 8, y2: a.pt.y + 8, de: a.e.id }));
    // los carteles de ingresos y servicios también son obstáculos
    if (capas.servicios) geo.features.filter((f) => esServicio(f) && f.geometry.type === "Point").forEach((f) => {
      const pt = mapa.latLngToLayerPoint(centro(f)), mw = cerca ? 70 : f.properties.servicio === "ingreso" ? 42 : 14;
      ocupados.push({ x1: pt.x - mw, y1: pt.y - 14, x2: pt.x + mw, y2: pt.y + 14, de: "serv" });
    });
    const lineas = []; // líneas guía ya trazadas
    const cruza = (p1, p2, p3, p4) => {
      const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      return d(p1, p2, p3) * d(p1, p2, p4) < 0 && d(p3, p4, p1) * d(p3, p4, p2) < 0;
    };
    const atraviesa = (p1, p2, r) => { // la línea pasa por adentro de un rectángulo
      for (let t = 0.15; t < 0.95; t += 0.1) {
        const x = p1.x + (p2.x - p1.x) * t, y = p1.y + (p2.y - p1.y) * t;
        if (x > r.x1 && x < r.x2 && y > r.y1 && y < r.y2) return true;
      }
      return false;
    };
    const fin = (pt, r) => ({ x: Math.max(r.x1, Math.min(pt.x, r.x2)), y: Math.max(r.y1, Math.min(pt.y, r.y2)) });
    const lineaLibre = (pt, r, propio) => {
      const q = fin(pt, r);
      return !lineas.some((l) => cruza(pt, q, l.a, l.b)) && !ocupados.some((o) => o.de !== propio && o.de !== "serv" && o.x2 - o.x1 > 20 && atraviesa(pt, q, o));
    };
    const choca = (r, propio) => ocupados.some((o) => o.de !== propio && r.x1 < o.x2 + 4 && r.x2 > o.x1 - 4 && r.y1 < o.y2 + 4 && r.y2 > o.y1 - 4);
    const solape = (r, propio) => ocupados.reduce((t, o) => o.de === propio ? t
      : t + Math.max(0, Math.min(r.x2, o.x2) - Math.max(r.x1, o.x1)) * Math.max(0, Math.min(r.y2, o.y2) - Math.max(r.y1, o.y1)), 0);
    // direcciones en orden de preferencia: arriba, diagonales de arriba, costados, diagonales de abajo, abajo
    const dirs = [-90, -50, -130, -20, -160, 20, 160, 50, 130, 90].map((g) => [Math.cos(g * Math.PI / 180), Math.sin(g * Math.PI / 180)]);
    const dists = cerca ? [26, 52, 84, 120] : mini ? [10, 26, 44, 66] : [18, 40, 66, 96];
    anclas.forEach((a) => {
      const w = mini ? 32 : anchoBandera(a.e, cerca), h = mini ? 32 : 40;
      let mejor = null, menor = Infinity;
      for (const d of dists) {
        for (const [cx, cy] of dirs) {
          const x = a.pt.x + cx * (d + w / 2 * Math.abs(cx)), y = a.pt.y + cy * (d + h / 2 * Math.abs(cy));
          const r = { x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2, de: a.e.id };
          if (!choca(r, a.e.id) && lineaLibre(a.pt, r, a.e.id)) { mejor = r; break; }
          const sv = solape(r, a.e.id); if (sv < menor) { menor = sv; a.alt = r; }
        }
        if (mejor) break;
      }
      mejor = mejor || a.alt;
      ocupados.push(mejor);
      lineas.push({ a: a.pt, b: fin(a.pt, mejor) });
      L.marker(a.ll, { icon: bandera(a.e, mejor.x1 - a.pt.x, mejor.y1 - a.pt.y, w, mini), zIndexOffset: 500 })
        .on("click", () => abrirFicha(a.e.id)).addTo(capaParadas);
    });
  }

  // Ancho estimado del banderín (número + ícono, y el nombre de cerca).
  function anchoBandera(e, cerca) {
    const base = (e.numero ? 34 : 0) + 34 + 12;
    if (!cerca) return base;
    return Math.min(190, base + Math.round((e.corto || e.nombre).length * 7.4) + 10);
  }

  // Banderín ubicado en (dx, dy) respecto del punto de la estación, con línea guía y punto.
  function bandera(e, dx, dy, w, mini) {
    const h = mini ? 32 : 40, c = zona(e).color;
    const visitada = sellos.includes(e.id);
    const ahora = actividades.some((a) => a.estacion === e.id && estadoActividad(a) === "ahora");
    const clases = ["bandera", mini && "mini", visitada && "visitada", esProvisoria(e.id) && "provisoria", ahora && "en-vivo"].filter(Boolean).join(" ");
    // la línea va del punto al borde más cercano del banderín
    const ex = Math.max(dx, Math.min(0, dx + w)), ey = Math.max(dy, Math.min(0, dy + h));
    return L.divIcon({
      className: "icono-libre ancla", iconSize: [0, 0], iconAnchor: [0, 0],
      html: `<svg class="guia" width="1" height="1" aria-hidden="true"><line x1="0" y1="0" x2="${ex}" y2="${ey}" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
          <line x1="0" y1="0" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
          ${TEMA === "pixel" ? `<rect x="-6" y="-6" width="12" height="12" fill="${c}" stroke="#1b2838" stroke-width="2"/>`
            : `<circle r="6.5" fill="${c}" stroke="#fff" stroke-width="3"/>`}</svg>
        <div class="${clases}" style="--c:${c};left:${dx}px;top:${dy}px;width:${w}px">${ahora ? '<span class="en-vivo-txt">Ahora</span>' : ""}
          <div class="tela">${mini ? `<span class="b-mini">${e.numero ? esc(e.numero) : ICON[e.icono] || ""}</span>`
            : `${e.numero ? `<span class="b-num">${esc(e.numero)}</span>` : ""}<span class="b-ico">${ICON[e.icono] || ""}</span>
          <span class="b-nombre">${esc(e.corto || e.nombre)}</span>`}${visitada ? '<span class="b-tilde">✓</span>' : ""}</div></div>`,
    });
  }

  // ---------- Hojas y pestañas ----------
  function mostrar(sel) {
    document.querySelectorAll(".hoja").forEach((h) => (h.hidden = true));
    if (sel) $(sel).hidden = false;
    const pest = { "#agenda": "agenda", "#pasaporte": "pasaporte", "#foto": "foto" }[sel] || "mapa";
    document.querySelectorAll(".pestanas button").forEach((b) => b.classList.toggle("activa", b.dataset.pestana === pest));
  }
  document.querySelectorAll("[data-cerrar]").forEach((b) =>
    b.addEventListener("click", () => {
      mostrar(null);
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    }));
  document.querySelectorAll(".pestanas button").forEach((b) => b.addEventListener("click", () => {
    const p = b.dataset.pestana;
    if (p === "mapa") mostrar(null);
    if (p === "agenda") { armarAgenda(); mostrar("#agenda"); }
    if (p === "pasaporte") { armarPasaporte(); mostrar("#pasaporte"); }
    if (p === "foto") abrirFoto();
  }));

  // ---------- Fichas ----------
  function abrirFicha(id, centrar = true) {
    const e = estacion(id);
    if (!e) return;
    const z = zona(e);
    const filas = [
      ["Qué se muestra", e.resumen], ["Objetivo del trabajo", e.objetivo], ["Responsables", e.responsables],
      ["Equipo", e.equipo], ["Trabajo conjunto con", e.vinculos], ["Servicios INTEA", e.intea],
    ].filter(([, v]) => v);
    const enlaces = (e.enlaces || []).map((l) =>
      `<a class="enlace" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.texto)}</a>`).join("");
    const acts = actividades.filter((a) => a.estacion === id);
    const sellada = sellos.includes(id);
    $("#ficha-contenido").innerHTML = `
      <article class="ficha">
        <header class="ficha-cabecera" style="--c:${z.color}">
          <div class="ficha-disco">${ICON[e.icono] || ""}</div>
          <div><p class="ficha-zona">${esc(z.nombre)}${e.numero ? ` · Estación ${esc(e.numero)}` : ""}</p>
            <h2>${esc(e.nombre)}</h2>${e.lugar ? `<p class="ficha-lugar">${esc(e.lugar)}</p>` : ""}</div>
        </header>
        ${esProvisoria(id) ? `<p class="ficha-prov">📍 Ubicación provisoria en el mapa. ${esc(lotesDe(id)[0].properties.nota || "")}</p>` : ""}
        ${lotesDe(id).length ? `<button type="button" class="boton-ancho" id="btn-llegar">Cómo llegar</button>` : ""}
        ${e.foto ? `<img class="ficha-foto" src="${esc(e.foto)}" alt="">` : ""}
        ${acts.length ? `<div class="ficha-agenda"><b>Horarios en esta estación</b>${acts.map(filaAgenda).join("")}</div>` : ""}
        <dl>${filas.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        ${enlaces ? `<div class="enlaces">${enlaces}</div>` : ""}
        <p class="ficha-pie">Consultas: <a href="mailto:${esc(C.contacto)}?subject=${encodeURIComponent("Consulta: " + e.nombre)}">${esc(C.contacto)}</a></p>
        <p class="ficha-sello ${sellada ? "ok" : ""}">${sellada ? "✓ Estación sellada en tu pasaporte"
          : "Sellala en tu pasaporte escaneando el QR de la estación o acercándote al lugar."}</p>
      </article>`;
    $("#ficha-contenido").querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => abrirFicha(b.dataset.ir)));
    const bl = $("#btn-llegar"); if (bl) bl.addEventListener("click", () => comoLlegar(id));
    mostrar("#ficha");
    history.replaceState(null, "", location.pathname + location.search + "#" + id);
    const c = centroEstacion(id);
    if (c && centrar) mapa.flyTo(c, Math.max(mapa.getZoom(), C.zoomParadas + 1), { duration: 0.5 });
  }

  function armarLista(soloIds) {
    const ubicada = (id) => lotesDe(id).length > 0;
    $("#lista-estaciones").innerHTML = Object.entries(C.zonas).map(([clave, z]) => {
      const es = estaciones.filter((e) => e.zona === clave && (!soloIds || soloIds.includes(e.id)));
      if (!es.length) return "";
      return `<li class="lista-zona" style="--c:${z.color}">${esc(z.nombre)}</li>` + es.map((e) => `
        <li><button type="button" data-id="${esc(e.id)}">
          <span class="mini-disco" style="--c:${z.color}">${ICON[e.icono] || ""}</span>
          <span class="lista-nombre">${e.numero ? `<b>${esc(e.numero)}.</b> ` : ""}${esc(e.corto || e.nombre)}</span>
          ${sellos.includes(e.id) ? '<span class="lista-tilde">✓</span>' : ubicada(e.id) ? "" : '<span class="sin-ubicar">sin ubicar</span>'}
        </button></li>`).join("");
    }).join("");
    $("#lista-estaciones").querySelectorAll("button[data-id]").forEach((b) =>
      b.addEventListener("click", () => abrirFicha(b.dataset.id)));
  }
  $("#btn-lista").addEventListener("click", () => { armarLista(); mostrar("#lista"); });

  // ---------- Agenda ----------
  const ahoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const aMin = (h) => { const m = /^(\d{1,2})[:.](\d{2})/.exec(h || ""); return m ? +m[1] * 60 + +m[2] : null; };
  const esHoy = () => new Date().toLocaleDateString("sv-SE") === C.fechaISO; // AAAA-MM-DD local
  function estadoActividad(a) {
    if (!esHoy()) return "";
    const n = ahoraMin(), i = aMin(a.inicio), f = aMin(a.fin) ?? (i != null ? i + 30 : null);
    if (i == null) return "";
    if (n >= i && n < f) return "ahora";
    if (n >= f) return "pasada";
    return "futura";
  }
  function filaAgenda(a) {
    const est = a.estacion ? estacion(a.estacion) : null;
    const lugar = est ? `<button type="button" class="ag-lugar" data-ir="${esc(est.id)}" style="--c:${zona(est).color}">${esc(est.numero ? est.numero + ". " : "")}${esc(est.corto || est.nombre)}</button>`
      : a.lugar ? `<span class="ag-lugar-texto">${esc(a.lugar)}</span>` : "";
    return `<div class="ag-fila ${a._estado || ""}">
      <div class="ag-hora">${esc(a.inicio)}${a.fin ? `<small>${esc(a.fin)}</small>` : ""}</div>
      <div class="ag-cuerpo">${a._marca ? `<span class="ag-marca ${a._marca}">${a._marca === "ahora" ? "Ahora" : "Próximo"}</span>` : ""}
        <div class="ag-titulo">${esc(a.titulo)}${a.ejemplo ? ' <span class="ej">ejemplo</span>' : ""}</div>
        ${a.descripcion ? `<div class="ag-desc">${esc(a.descripcion)}</div>` : ""}${lugar}</div></div>`;
  }
  function armarAgenda() {
    const lista = actividades.slice().sort((a, b) => (aMin(a.inicio) ?? 9999) - (aMin(b.inicio) ?? 9999));
    let proximo = false;
    lista.forEach((a) => {
      a._estado = estadoActividad(a);
      a._marca = a._estado === "ahora" ? "ahora" : (a._estado === "futura" && !proximo ? (proximo = true, "proximo") : "");
    });
    $("#agenda-fecha").textContent = C.fecha + (esHoy() ? " · hoy" : "");
    $("#agenda-lista").innerHTML = lista.length ? lista.map(filaAgenda).join("")
      : '<p class="vacio">El cronograma se publica antes de la jornada.</p>';
    $("#agenda-lista").querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => abrirFicha(b.dataset.ir)));
  }

  // ---------- Avisos ----------
  const idAviso = (a) => [a.hora, a.titulo, a.texto].join("|");
  function armarAvisos() {
    const lista = avisos.slice().sort((a, b) => (aMin(b.hora) ?? 0) - (aMin(a.hora) ?? 0));
    $("#avisos-lista").innerHTML = lista.length ? lista.map((a) => `
      <div class="aviso-item ${a.prioridad === "alta" ? "alta" : ""} ${leidos.includes(idAviso(a)) ? "" : "nuevo"}">
        <div class="aviso-hora">${esc(a.hora)}</div>
        <div><b>${esc(a.titulo)}</b>${a.ejemplo ? ' <span class="ej">ejemplo</span>' : ""}<p>${esc(a.texto)}</p></div></div>`).join("")
      : '<p class="vacio">No hay avisos por ahora.</p>';
  }
  function actualizarCampana() {
    const sinLeer = avisos.filter((a) => !leidos.includes(idAviso(a)));
    $("#avisos-cuenta").hidden = !sinLeer.length;
    $("#avisos-cuenta").textContent = sinLeer.length;
    const importante = sinLeer.filter((a) => a.prioridad === "alta").sort((a, b) => (aMin(b.hora) ?? 0) - (aMin(a.hora) ?? 0))[0];
    $("#cartel-aviso").hidden = !importante;
    if (importante) {
      $("#cartel-abrir").textContent = `${importante.titulo}: ${importante.texto}`;
      $("#cartel-aviso").dataset.id = idAviso(importante);
    }
  }
  function marcarLeidos(ids) { leidos = Array.from(new Set(leidos.concat(ids))); escribir(K.leidos, leidos); actualizarCampana(); }
  $("#btn-avisos").addEventListener("click", () => { armarAvisos(); mostrar("#avisos"); marcarLeidos(avisos.map(idAviso)); });
  $("#cartel-abrir").addEventListener("click", () => { armarAvisos(); mostrar("#avisos"); marcarLeidos(avisos.map(idAviso)); });
  $("#cartel-cerrar").addEventListener("click", () => marcarLeidos([$("#cartel-aviso").dataset.id]));

  // CSV de la planilla publicada: primera fila = encabezados.
  function leerCSV(texto) {
    const filas = []; let fila = [], campo = "", comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (comillas) { if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') comillas = false; else campo += c; }
      else if (c === '"') comillas = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && texto[i + 1] === "\n") i++; fila.push(campo); filas.push(fila); fila = []; campo = ""; }
      else campo += c;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    const norm = (s) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const cab = (filas.shift() || []).map(norm);
    return filas.filter((f) => f.some((x) => x.trim())).map((f) => Object.fromEntries(cab.map((k, i) => [k, (f[i] || "").trim()])));
  }
  // "6", "e6" o "girasol-romero" → id de estación
  const idEstacion = (v) => { v = (v || "").trim().toLowerCase(); if (!v) return ""; return estacion(v) ? v : estacion("e" + v) ? "e" + v : ""; };
  async function traerCSV(url) { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) throw new Error(r.status); return leerCSV(await r.text()); }
  async function actualizarRemotos() {
    const cache = leer(K.agenda, null);
    try {
      if (C.agendaCSV) {
        actividades = (await traerCSV(C.agendaCSV)).map((r) => ({ inicio: r.inicio, fin: r.fin, titulo: r.titulo || r.actividad,
          estacion: idEstacion(r.estacion), lugar: r.lugar, descripcion: r.descripcion })).filter((a) => a.titulo);
      }
      if (C.avisosCSV) {
        avisos = (await traerCSV(C.avisosCSV)).map((r) => ({ hora: r.hora, titulo: r.titulo, texto: r.texto || r.mensaje,
          prioridad: (r.prioridad || "").toLowerCase() })).filter((a) => a.titulo || a.texto);
      }
      if (C.agendaCSV || C.avisosCSV) escribir(K.agenda, { actividades, avisos });
    } catch (_) {
      if (cache) { actividades = cache.actividades || actividades; avisos = cache.avisos || avisos; }
    }
    actualizarCampana();
    if (!$("#agenda").hidden) armarAgenda();
  }

  // ---------- Cómo llegar (en línea recta: no hay caminos internos cargados) ----------
  let capaRuta = null;
  function comoLlegar(id) {
    const destino = centroEstacion(id), e = estacion(id);
    const ingreso = geo.features.find((f) => esServicio(f) && /principal/i.test(f.properties.nombre || "")) || geo.features.find(esServicio);
    const origen = miPosicion || (ingreso ? centro(ingreso) : null);
    if (!destino || !origen) { avisar("No hay un punto de partida para trazar el recorrido."); return; }
    if (capaRuta) capaRuta.remove();
    const m = mapa.distance(origen, destino), min = Math.max(1, Math.round(m / 75)); // ~4,5 km/h
    capaRuta = L.layerGroup([
      L.polyline([origen, destino], { color: "#ffffff", weight: 9, opacity: 0.9, lineCap: "round" }),
      L.polyline([origen, destino], { color: zona(e).color, weight: 5, dashArray: "2 12", lineCap: "round", className: "ruta" }),
      L.marker(L.latLngBounds([origen, destino]).getCenter(), { interactive: false, icon: L.divIcon({ className: "icono-libre", iconSize: [190, 34], iconAnchor: [95, 17],
        html: `<span class="ruta-etiqueta" style="--c:${zona(e).color}">🚶 ${Math.round(m / 10) * 10} m · ${min} min</span>` }) }),
    ]).addTo(mapa);
    mostrar(null);
    mapa.flyToBounds(L.latLngBounds([origen, destino]).pad(0.4), { duration: 0.6 });
    avisar(`${miPosicion ? "Desde tu ubicación" : "Desde el ingreso principal"} hasta ${e.corto || e.nombre}, en línea recta.`, 5000);
    $("#btn-quitar-ruta").hidden = false;
  }
  $("#btn-quitar-ruta").addEventListener("click", () => { if (capaRuta) capaRuta.remove(); capaRuta = null; $("#btn-quitar-ruta").hidden = true; });

  // Festejo al sellar (papelitos de colores; se respeta "reducir movimiento").
  function festejar(cantidad = 36) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colores = ["#f2b705", "#0a5aa8", "#2e7d32", "#e65100", "#8e24aa", "#00838f"];
    const capa = document.createElement("div"); capa.className = "papelitos";
    for (let i = 0; i < cantidad; i++) {
      const p = document.createElement("i");
      p.style.cssText = `left:${50 + (Math.random() - .5) * 30}%;background:${colores[i % colores.length]};` +
        `--dx:${(Math.random() - .5) * 360}px;--dy:${-180 - Math.random() * 260}px;--r:${Math.random() * 720}deg;animation-delay:${Math.random() * .15}s`;
      capa.appendChild(p);
    }
    document.body.appendChild(capa); setTimeout(() => capa.remove(), 1800);
  }

  // Bienvenida: la primera vez que se abre el sitio.
  function bienvenida() {
    if (leer("pa70-bienvenida", false) || EDITOR) return;
    $("#bienvenida").hidden = false;
    if (C.logo) $("#bv-logo").src = C.logo; else $("#bv-logo").hidden = true;
    $("#bienvenida-empezar").addEventListener("click", () => {
      $("#bienvenida").classList.add("saliendo");
      setTimeout(() => ($("#bienvenida").hidden = true), 350);
      escribir("pa70-bienvenida", true);
    });
  }

  // ---------- Pasaporte ----------
  function sellar(id, silencioso) {
    if (sellos.includes(id) || !estacion(id)) return;
    sellos.push(id); escribir(K.sellos, sellos);
    dibujarParadas();
    festejar(sellos.length === estaciones.length ? 90 : 36);
    if (!silencioso) avisar(`Sellaste: ${estacion(id).corto || estacion(id).nombre} (${sellos.length} de ${estaciones.length})`);
    if (sellos.length === estaciones.length) avisar("¡Completaste el recorrido! Tu foto 70 años lleva la insignia.", 6000);
  }
  // El pasaporte vive en este navegador (sin cuentas). Para no perderlo al cambiar de navegador (por ejemplo,
  // si se abrió un QR desde Instagram o WhatsApp), se puede llevar con un enlace: #p-<estaciones selladas>.
  const codigoPasaporte = () => "p-" + estaciones.map((e) => (sellos.includes(e.id) ? "1" : "0")).join("");
  function recuperarPasaporte(hash) {
    const m = /^p-([01]+)$/.exec(hash);
    if (!m) return false;
    m[1].split("").forEach((b, i) => { if (b === "1" && estaciones[i] && !sellos.includes(estaciones[i].id)) sellos.push(estaciones[i].id); });
    escribir(K.sellos, sellos);
    history.replaceState(null, "", location.pathname + location.search);
    avisar(`Pasaporte recuperado: ${sellos.length} de ${estaciones.length} estaciones.`);
    return true;
  }
  $("#btn-llevar").addEventListener("click", async () => {
    const url = location.href.split("#")[0] + "#" + codigoPasaporte();
    try { await navigator.clipboard.writeText(url); avisar("Enlace copiado: abrilo en el otro navegador."); }
    catch (_) { $("#llevar-url").hidden = false; $("#llevar-url").textContent = url; }
  });
  function armarPasaporte() {
    const n = sellos.length, t = estaciones.length;
    $("#pasaporte-progreso").textContent = `${n} de ${t} estaciones`;
    $("#pasaporte-barra").style.width = (100 * n / t) + "%";
    $("#pasaporte-sellos").innerHTML = estaciones.map((e) => {
      const ok = sellos.includes(e.id);
      return `<button type="button" class="sello ${ok ? "ok" : ""}" data-id="${esc(e.id)}" style="--c:${zona(e).color}">
        <span class="mini-disco">${ICON[e.icono] || ""}</span><span>${esc(e.corto || e.nombre)}</span></button>`;
    }).join("");
    $("#pasaporte-sellos").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => abrirFicha(b.dataset.id)));
  }

  // ---------- Ubicación ----------
  function cercana(pos) {
    let mejor = null, dist = Infinity;
    geo.features.filter(esEstacion).forEach((f) => { const d = mapa.distance(pos, centro(f)); if (d < dist) { dist = d; mejor = estDe(f); } });
    return { id: mejor, dist };
  }
  function iniciarGPS(centrar) {
    if (!("geolocation" in navigator)) { avisar("Este teléfono no permite ubicación."); return; }
    if (seguimiento !== null) { if (centrar && miPosicion) mapa.flyTo(miPosicion, C.zoomLotes); return; }
    avisar("Buscando tu ubicación…");
    let primera = true;
    seguimiento = navigator.geolocation.watchPosition((p) => {
      const pos = L.latLng(p.coords.latitude, p.coords.longitude);
      const r = p.coords.accuracy;
      // Fuera del predio (por ejemplo, desde la casa antes de la jornada): no se mueve el mapa ni se dibuja el punto.
      const ss = sectores();
      if (ss.length) {
        const caja = L.geoJSON({ type: "FeatureCollection", features: ss }).getBounds();
        if (mapa.distance(pos, caja.getCenter()) > mapa.distance(caja.getNorthWest(), caja.getCenter()) + 1000) {
          if (primera) { avisar("Estás fuera del predio: tu ubicación aparece en el mapa al llegar.", 5000); primera = false; }
          return;
        }
      }
      miPosicion = pos;
      if (!marcaYo) {
        circuloYo = L.circle(miPosicion, { radius: r, color: "#2563eb", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(mapa);
        marcaYo = L.marker(miPosicion, { interactive: false, zIndexOffset: 1000, icon: L.divIcon({ className: "icono-libre", iconSize: [110, 50], iconAnchor: [55, 12],
          html: '<div class="yo"><span class="yo-punto"></span><span class="yo-texto">Estás aquí</span></div>' }) }).addTo(mapa);
      } else { marcaYo.setLatLng(miPosicion); circuloYo.setLatLng(miPosicion).setRadius(r); }
      if (primera && centrar) { mapa.flyTo(miPosicion, C.zoomLotes); primera = false; }
      const c = cercana(miPosicion);
      if (c.id && r <= 40 && c.dist <= C.radioSello) sellar(c.id); // sello automático, solo con buena precisión
    }, (err) => {
      seguimiento = null;
      avisar(err.code === 1 ? "Sin permiso de ubicación. El mapa y las fichas funcionan igual." : "No se pudo obtener la ubicación.");
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  $("#btn-ubicacion").addEventListener("click", () => iniciarGPS(true));
  $("#btn-cercana").addEventListener("click", () => {
    if (!miPosicion) { iniciarGPS(false); avisar("Activá la ubicación y volvé a tocar «Ir a la más cercana»."); return; }
    const c = cercana(miPosicion);
    if (!c.id) { avisar("Todavía no hay estaciones ubicadas en el mapa."); return; }
    abrirFicha(c.id);
    avisar(`A unos ${Math.round(c.dist / 10) * 10} m`);
  });

  // ---------- Modo foto ----------
  const lienzo = $("#foto-lienzo");
  const textoFoto = `70 años de INTA en la EEA Catamarca ${C.hashtag} ${C.instagram}`;
  $("#foto-texto").textContent = textoFoto;
  const cuenta = (C.instagram || "").replace(/^@/, ""), etiqueta = (C.hashtag || "").replace(/^#/, "");
  $("#ig-hashtag").href = "https://www.instagram.com/explore/tags/" + encodeURIComponent(etiqueta) + "/";
  $("#ig-hashtag").textContent = "Ver las fotos de " + C.hashtag;
  $("#ig-cuenta").href = "https://www.instagram.com/" + encodeURIComponent(cuenta) + "/";
  $("#ig-cuenta").textContent = "Seguir a " + C.instagram;
  function abrirFoto() {
    if (C.concurso.activo) {
      $("#concurso").hidden = false;
      $("#concurso").innerHTML = `<strong>Concurso de fotos</strong><p>${esc(C.concurso.texto)}</p>` +
        (C.concurso.bases ? `<a href="${esc(C.concurso.bases)}" target="_blank" rel="noopener">Bases y condiciones</a>` : "");
    }
    mostrar("#foto");
  }
  $("#foto-entrada").addEventListener("change", (ev) => {
    const archivo = ev.target.files && ev.target.files[0];
    if (!archivo) return;
    const img = new Image();
    img.onload = () => { componer(img); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(archivo);
  });
  // Marco de la foto: banda blanca con el logo oficial del aniversario (sin modificar) y los datos de la jornada.
  const logoMarco = new Image();
  if (C.logoColor) logoMarco.src = C.logoColor;
  function componer(img) {
    const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * k), h = Math.round(img.height * k);
    const banda = Math.round(Math.max(w, h) * 0.13);
    lienzo.width = w; lienzo.height = h + banda;
    const c = lienzo.getContext("2d");
    c.drawImage(img, 0, 0, w, h);
    c.fillStyle = "#ffffff"; c.fillRect(0, h, w, banda);
    c.fillStyle = "#008bd2"; c.fillRect(0, h, w, Math.max(4, banda * 0.06)); // filete azul INTA
    const m = banda * 0.18;
    if (logoMarco.complete && logoMarco.naturalWidth) {
      const lh = banda * 0.6, lw = lh * logoMarco.naturalWidth / logoMarco.naturalHeight;
      c.drawImage(logoMarco, m, h + (banda - lh) / 2 + banda * 0.03, lw, lh);
    } else {
      c.fillStyle = "#008bd2"; c.font = `800 ${Math.round(banda * 0.36)}px Nunito, system-ui, sans-serif`;
      c.textBaseline = "middle"; c.fillText("INTA 70 años", m, h + banda / 2);
    }
    c.textBaseline = "middle"; c.textAlign = "right";
    c.fillStyle = "#3c3c3b"; c.font = `800 ${Math.round(banda * 0.2)}px Nunito, system-ui, sans-serif`;
    c.fillText("Puertas Abiertas", w - m, h + banda * 0.42);
    c.fillStyle = "#6b6b6a"; c.font = `600 ${Math.round(banda * 0.15)}px Nunito, system-ui, sans-serif`;
    c.fillText(`EEA Catamarca · ${C.fecha}`, w - m, h + banda * 0.68);
    c.textAlign = "start";
    if (estaciones.length && sellos.length === estaciones.length) { // insignia del recorrido completo, sobre la foto
      const r = banda * 0.42, cx = w - r - m, cy = h - r - m;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = "#f2b705"; c.fill();
      c.lineWidth = r * 0.08; c.strokeStyle = "#ffffff"; c.stroke();
      c.fillStyle = "#3c3c3b"; c.textAlign = "center"; c.font = `900 ${Math.round(r * 0.3)}px Nunito, system-ui, sans-serif`;
      c.fillText("RECORRIDO", cx, cy - r * 0.18); c.fillText("COMPLETO", cx, cy + r * 0.22); c.textAlign = "start";
    }
    lienzo.hidden = false; $("#foto-acciones").hidden = false;
  }
  function aBlob() { return new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.9)); }
  async function copiarTexto() { try { await navigator.clipboard.writeText(textoFoto); } catch (_) { /* sin permiso */ } }
  $("#foto-compartir").addEventListener("click", async () => {
    const blob = await aBlob();
    const archivo = new File([blob], "inta-70-anios.jpg", { type: "image/jpeg" });
    await copiarTexto();
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], text: textoFoto }); }
      catch (e) { if (e.name !== "AbortError") avisar("No se pudo compartir; probá con Descargar."); }
    } else { descargar(blob); avisar("Tu navegador no comparte archivos: se descargó la foto."); }
  });
  $("#foto-descargar").addEventListener("click", async () => descargar(await aBlob()));
  function descargar(blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "inta-70-anios.jpg"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---------- Editor (?editar) ----------
  function iniciarEditor() {
    $("#editor").hidden = false;
    const opciones = [["predio", "— Límite del predio (polígono)"], ["camino", "— Camino nuevo (línea)"]]
      .concat(estaciones.map((e) => [e.id, `${e.numero || "•"} · ${e.corto || e.nombre}`]));
    $("#ed-estacion").innerHTML = opciones.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
    let m = null, vertices = [], trazo = null;
    const estado = (t) => ($("#ed-estado").textContent = t);
    const redibujar = () => { escribir(K.borrador, geo); dibujarFondo(); actualizarNivel(true); };
    const props = () => {
      const v = $("#ed-estacion").value;
      if (v === "predio") return { id: "predio", tipo: "predio" };
      if (v === "camino") { let i = 1; while (geo.features.some((f) => f.properties.id === "camino-" + i)) i++; return { id: "camino-" + i }; }
      const e = estacion(v);
      return { id: "ed-" + Date.now(), tipo: "lote", estacion: v, cultivo: e.icono, patron: e.patron, nombre: e.corto || e.nombre };
    };
    const activar = (x) => {
      m = x; vertices = []; if (trazo) { trazo.remove(); trazo = null; }
      document.querySelectorAll(".ed-botones button").forEach((b) => b.classList.remove("activo"));
      if (x) $("#ed-" + x).classList.add("activo");
      estado(x === "punto" ? "Tocá el mapa donde va la estación." : x === "poligono" ? "Tocá los vértices; después «Terminar»."
        : x === "linea" ? "Tocá los puntos del camino; después «Terminar»." : "Elegí qué dibujar y un modo.");
    };
    const agregar = (feature) => {
      if (esPredio(feature)) geo.features = geo.features.filter((f) => !esPredio(f));
      geo.features.push(feature); redibujar();
    };
    const coord = (p) => [+p.lng.toFixed(7), +p.lat.toFixed(7)];
    $("#ed-punto").onclick = () => activar("punto");
    $("#ed-poligono").onclick = () => activar("poligono");
    $("#ed-linea").onclick = () => activar("linea");
    $("#ed-deshacer").onclick = () => { vertices.pop(); if (trazo) trazo.setLatLngs(vertices); };
    $("#ed-cerrar").onclick = () => {
      if (m === "poligono" && vertices.length >= 3) {
        const anillo = vertices.map(coord); anillo.push(anillo[0]);
        agregar({ type: "Feature", properties: props(), geometry: { type: "Polygon", coordinates: [anillo] } });
      } else if (m === "linea" && vertices.length >= 2) {
        agregar({ type: "Feature", properties: props(), geometry: { type: "LineString", coordinates: vertices.map(coord) } });
      } else { estado("Faltan puntos."); return; }
      activar(null); estado("Guardado en este navegador.");
    };
    $("#ed-borrar").onclick = () => {
      const id = $("#ed-estacion").value;
      geo.features = geo.features.filter((f) => id === "camino" ? !esCamino(f) : id === "predio" ? !esPredio(f) : estDe(f) !== id);
      redibujar(); estado(id === "camino" ? "Caminos quitados." : "Quitado del mapa.");
    };
    $("#ed-centro").onclick = () => {
      const c = mapa.getCenter();
      const txt = `centro: [${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}], zoom: ${mapa.getZoom()},`;
      if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
      estado("Copiado para config.js → " + txt);
    };
    $("#ed-exportar").onclick = () => {
      const texto = "// Exportado desde el modo editor.\nwindow.MAPA = " + JSON.stringify(geo) + ";\n";
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([texto], { type: "text/javascript" }));
      a.download = "mapa.js"; a.click();
      estado("Descargado. Reemplazar datos/mapa.js con este archivo.");
    };
    mapa.on("click", (ev) => {
      if (m === "punto") {
        const v = $("#ed-estacion").value;
        if (v === "predio" || v === "camino") { estado("El predio y los caminos no van como punto."); return; }
        agregar({ type: "Feature", properties: props(), geometry: { type: "Point", coordinates: coord(ev.latlng) } });
        activar(null); estado("Punto guardado en este navegador.");
      } else if (m === "poligono" || m === "linea") {
        vertices.push(ev.latlng);
        if (!trazo) trazo = L.polyline(vertices, { color: "#d97706", weight: 3, dashArray: "6 4" }).addTo(mapa);
        else trazo.setLatLngs(vertices);
      }
    });
    ponerModo("satelital"); // para dibujar conviene ver la imagen
  }

  // Íconos en pixel: cada dibujo se rasteriza a 20×20 sin suavizado y se muestra ampliado (píxeles de verdad).
  async function pixelarIconos(lado = 20) {
    const claves = Object.keys(ICON).filter((k) => k !== "sello");
    await Promise.all(claves.map((k) => new Promise((ok) => {
      const svg = ICON[k].replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" `);
      const img = new Image();
      img.onload = () => {
        try {
          const cv = document.createElement("canvas"); cv.width = cv.height = lado;
          const c = cv.getContext("2d"); c.imageSmoothingEnabled = true; c.drawImage(img, 0, 0, lado, lado);
          const d = c.getImageData(0, 0, lado, lado), px = d.data;
          for (let i = 0; i < px.length; i += 4) { // sin semitransparencias: borde duro
            if (px[i + 3] < 110) { px[i + 3] = 0; continue; }
            px[i + 3] = 255;
          }
          c.putImageData(d, 0, 0);
          ICON[k] = `<img class="pix" src="${cv.toDataURL()}" alt="">`;
        } catch (_) { /* si el navegador no deja leer el dibujo, queda el vectorial */ }
        ok();
      };
      img.onerror = () => ok();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    })));
  }

  // ---------- Arranque ----------
  async function cargar() {
    // Los datos van como .js (window.*) para que el sitio ande también abierto con doble clic.
    estaciones = window.ESTACIONES.estaciones;
    geo = DEMO ? await fetch("datos/demo.geojson").then((r) => r.json()) : (window.MAPA || geo);
    if (EDITOR) { const g = leer(K.borrador, null); if (g && g.features) geo = g; }
    sumarProvisorias();
    const ag = window.AGENDA || {};
    actividades = (ag.actividades || []).map((a) => ({ ...a, estacion: idEstacion(a.estacion) }));
    avisos = ag.avisos || [];
    if (DEMO) $("#subtitulo").textContent = "DEMOSTRACIÓN · lotes inventados";
    if (TEMA === "pixel") await pixelarIconos();
    bienvenida();
    ponerModo("ilustrado");
    if (predio()) {
      verPredio();
      const b = L.geoJSON({ type: "FeatureCollection", features: sectores() }).getBounds();
      mapa.setMaxBounds(b.pad(0.8)); mapa.options.maxBoundsViscosity = 0.8;
      mapa.setMinZoom(Math.max(13, mapa.getZoom() - 2));
      ajustarZoomSatelital(sectores().map(centro));
    } else if (geo.features.length) mapa.fitBounds(L.geoJSON(geo).getBounds(), { padding: [20, 20] });
    actualizarNivel(true);
    if (EDITOR) iniciarEditor();
    await actualizarRemotos();
    if (C.agendaCSV || C.avisosCSV) setInterval(actualizarRemotos, 60000);
    setInterval(() => { if (!$("#agenda").hidden) armarAgenda(); }, 60000); // "Ahora" y "Próximo" avanzan solos
    const id = decodeURIComponent(location.hash.slice(1));
    if (recuperarPasaporte(id)) { armarPasaporte(); mostrar("#pasaporte"); }
    else if (id && estacion(id)) { sellar(id, true); abrirFicha(id); } // llegó por el QR de la estación
    // QR escaneado con el sitio ya abierto: algunos navegadores reutilizan la pestaña y solo cambian el #.
    addEventListener("hashchange", () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (recuperarPasaporte(h)) { armarPasaporte(); mostrar("#pasaporte"); }
      else if (h && estacion(h)) { sellar(h); abrirFicha(h); }
    });
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); // que el navegador no lo borre
  }
  cargar().catch((e) => { console.error(e); avisar("No se pudieron cargar los datos del mapa.", 8000); });

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
