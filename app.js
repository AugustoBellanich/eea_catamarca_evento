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
  // Estilo "parque" (el moderno): lienzo claro y apagado, lotes sin borde con textura botánica, y alto contraste
  // reservado a las paradas (gotas blancas con número).
  const PARQUE = true;
  // Capas visibles (se recuerdan en el navegador).
  // "cultivos": símbolo de cada cultivo sobre su lote (apagado de entrada; las plantas se ven siempre).
  const capas = Object.assign({ estaciones: true, servicios: true }, leer("pa70-capas", {}), { lotes: true });
  if (capas.cultivos === undefined) capas.cultivos = false;

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
  // Las estaciones son marcadores del KML (tipo "estacion", con properties.estacion); los lotes son solo cultivo.
  // Datos viejos: un lote con properties.estacion (o con el id de la estación) también cuenta.
  const estDe = (f) => f.properties.estacion || (estacion(f.properties.id) ? f.properties.id : null);
  const esEstacion = (f) => !!estDe(f);
  const esServicio = (f) => f.properties.tipo === "servicio";
  const esPredio = (f) => f.properties.tipo === "predio" || f.properties.id === "predio";
  const esCamino = (f) => /^(camino|ruta|paseo|calle)/.test(f.properties.id);
  const tipoLinea = (f) => { const t = (f.properties.id.match(/^(camino|ruta|paseo|calle)/) || [])[1];
    return t === "calle" ? "calle-" + (f.properties.superficie || "tierra") : t; };
  const esCanal = (f) => f.properties.tipo === "canal" && f.geometry.type === "LineString";
  const esContexto = (f) => !esEstacion(f) && !esServicio(f) && !esPredio(f) && !esCamino(f) && !esCanal(f);
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
  // Punto de anclaje de una estación: dentro de su lote principal (el de mayor superficie). Si el centro del lote cae
  // afuera (lotes con forma irregular), se toma el punto interior más cercano a ese centro.
  const dentroDe = (lng, lat, anillo) => {
    let ok = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
      if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) ok = !ok;
    }
    return ok;
  };
  const superficie = (anillo) => Math.abs(anillo.reduce((a, p, i) => { const q = anillo[(i + 1) % anillo.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
  const anillos = (f) => f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.map((p) => p[0]) : [];
  function centroEstacion(id) {
    const lotes = lotesDe(id);
    if (!lotes.length) return null;
    const puntos = lotes.filter((f) => f.geometry.type === "Point");
    const polis = lotes.flatMap(anillos);
    if (!polis.length) return centro(puntos[0]);
    const a = polis.reduce((m, r) => (superficie(r) > superficie(m) ? r : m));
    const pts = a.slice(0, -1);
    const c = [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
    if (dentroDe(c[0], c[1], a)) return L.latLng(c[1], c[0]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    let mejor = null, d = Infinity;
    for (let i = 1; i < 20; i++) for (let j = 1; j < 20; j++) {
      const x = Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * i / 20, y = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * j / 20;
      const dd = (x - c[0]) ** 2 + (y - c[1]) ** 2;
      if (dd < d && dentroDe(x, y, a)) { d = dd; mejor = [x, y]; }
    }
    return mejor ? L.latLng(mejor[1], mejor[0]) : L.latLng(c[1], c[0]);
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
  // MARGEN: lotes, caminos y árboles se dibujan media pantalla más allá de cada borde, así al arrastrar con el dedo
  // no aparecen huecos ni cortes rectos (Leaflet trae 0,1). Igual al de arboles.js.
  const MARGEN = .5;
  const mapa = L.map("mapa", { zoomControl: false, attributionControl: true, maxZoom: 20, zoomSnap: 0.5,
    renderer: L.svg({ padding: MARGEN }) }).setView(C.centro, C.zoom);
  L.control.zoom({ position: "topleft" }).addTo(mapa);
  // En el celular Leaflet espera a que se suelte el dedo para pedir fotos nuevas; así las pide mientras se arrastra
  // y guarda más alrededor de la vista.
  const satelital = L.tileLayer(C.teselas.url, { maxZoom: 20, maxNativeZoom: C.teselas.zoomMax, attribution: C.teselas.atribucion,
    updateWhenIdle: false, keepBuffer: 4 });

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
          <div class="capas-titulo">Mostrar</div>
          <label><input type="checkbox" data-capa="estaciones"> Estaciones</label>
          <label><input type="checkbox" data-capa="cultivos"> Símbolos de cultivos</label>
          <label><input type="checkbox" data-capa="servicios"> Ingresos y servicios</label>
        </div>`;
      L.DomEvent.disableClickPropagation(caja); L.DomEvent.disableScrollPropagation(caja);
      const boton = caja.querySelector(".boton-modo"), panel = caja.querySelector(".capas-panel");
      boton.onclick = () => { panel.hidden = !panel.hidden; boton.setAttribute("aria-expanded", String(!panel.hidden)); };
      caja.querySelectorAll("[data-modo]").forEach((b) => (b.onclick = () => ponerModo(b.dataset.modo)));
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
  // Versión parque: paleta oliva de mapa ilustrado. Árboles con copa, sombra y brillo, ubicados de forma irregular
  // en una baldosa grande para que no se vea una grilla.
  const arbol = (x, y, r) => `<circle cx="${x + r * .3}" cy="${y + r * .35}" r="${r}" fill="#6F8150" fill-opacity=".45"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#9DB173"/><circle cx="${x - r * .3}" cy="${y - r * .3}" r="${r * .45}" fill="#BCCB92"/>`;
  const mata = (x, y) => `<circle cx="${x + .6}" cy="${y + .8}" r="2.4" fill="#6F8150" fill-opacity=".4"/><circle cx="${x}" cy="${y}" r="2.4" fill="#93A86A"/>`;
  const PATRONES_PARQUE = `
    <pattern id="p-arboles" width="46" height="42" patternUnits="userSpaceOnUse"><rect width="46" height="42" fill="#D3D9AC"/>
      ${arbol(8, 8, 5.2)}${arbol(27, 6, 4.4)}${arbol(40, 17, 5)}${arbol(17, 22, 4.8)}${arbol(33, 33, 5.3)}${arbol(7, 35, 4.2)}${arbol(22, 38, 3.6)}</pattern>
    <pattern id="p-hileras" width="16" height="11" patternUnits="userSpaceOnUse"><rect width="16" height="11" fill="#DADDB2"/>
      <rect x="0" y="4.4" width="16" height="2" fill="#B6BE88"/>${mata(4, 5.4)}${mata(12, 5.4)}</pattern>
    <pattern id="p-surcos" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(90)"><rect width="9" height="9" fill="#DEDFB6"/>
      <rect y="3.5" width="9" height="2" fill="#C2C792"/></pattern>
    <pattern id="p-pasto" width="18" height="16" patternUnits="userSpaceOnUse"><rect width="18" height="16" fill="#DDE1B5"/>
      <path d="M3 11l1.6-3.2 1.6 3.2M11 5l1.6-3.2 1.6 3.2M13 14l1.4-2.8 1.4 2.8" stroke="#93A86A" stroke-width="1.2" fill="none" stroke-linecap="round"/></pattern>
    <pattern id="p-liso" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#DCDDB8"/></pattern>
    <pattern id="p-agua" width="22" height="12" patternUnits="userSpaceOnUse">
      <rect width="22" height="12" fill="#AFCFCB"/><path d="M2 7q4.5-3.5 9 0t9 0" stroke="#E4F1EE" stroke-opacity=".8" stroke-width="1.3" fill="none" stroke-linecap="round"/></pattern>`;
  function ponerPatrones() {
    const svg = mapa.getPanes().overlayPane.querySelector("svg");
    if (svg && !svg.querySelector("#p-arboles")) {
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      defs.innerHTML = PARQUE ? PATRONES_PARQUE : PATRONES; svg.insertBefore(defs, svg.firstChild);
    }
  }

  function estilo(f) {
    const ilu = modo === "ilustrado", p = f.properties;
    if (PARQUE && ilu) return estiloParque(f);
    if (!ilu) return estiloSatelital(f);
    if (esPredio(f)) return ilu ? { color: "#a8946a", weight: 2, dashArray: "2 6", fillColor: "#e4ebc8", fillOpacity: 1, className: "predio" }
      : { color: "#ffffff", weight: 2, dashArray: "4 6", fill: false, className: "predio" };
    if (esCamino(f)) return ilu ? { color: "#f8f3e6", weight: 12, lineCap: "round", className: "camino" }
      : { color: "#ffffff", weight: 4, opacity: 0.7, className: "camino" };
    if (esContexto(f) || (!capas.estaciones && esEstacion(f))) return ilu ? { color: "#9c8a63", weight: 1.5, fillOpacity: 1, className: "lote lote-ctx p-" + (p.patron && p.patron !== "liso" ? p.patron : "pasto") }
      : { color: "#ffffff", weight: 1.5, opacity: 0.85, fillColor: "#ffffff", fillOpacity: 0.12, className: "lote lote-ctx" };
    const e = estacion(estDe(f));
    if (p.provisorio) return { color: zona(e).color, weight: 3, dashArray: "6 6", fillColor: zona(e).color, fillOpacity: 0.18, className: "lote lote-est lote-prov" };
    return ilu ? { color: zona(e).color, weight: 3, fillOpacity: 1, className: "lote lote-est p-" + (p.patron || e.patron || "pasto") }
      : { color: zona(e).color, weight: 3, fillColor: zona(e).color, fillOpacity: 0.35, className: "lote lote-est" };
  }

  // Parque: el predio es tierra clara (lo que queda entre lotes se lee como camino); los lotes no llevan borde.
  function estiloParque(f) {
    const p = f.properties;
    if (esPredio(f)) return { color: "#C9C79E", weight: 2, fillColor: (window.Arboleda && Arboleda.suelo(p)) || "#E6E4C2", fillOpacity: 1, lineJoin: "round", className: "predio" };
    const est = esEstacion(f) && capas.estaciones;
    // provisorio: sin contorno (la gota ya lo marca con "?"); el lote se puede tocar igual
    if (p.provisorio) return { stroke: false, fillColor: (window.Arboleda && Arboleda.suelo(p)) || "#1E3A2F", fillOpacity: window.Arboleda && Arboleda.suelo(p) ? 1 : 0,
      className: "lote lote-pq" + (est ? " es-est" : "") };
    const patron = p.patron || (estacion(estDe(f)) || {}).patron || "pasto";
    const extra = est ? " es-est" : "";
    // edificios: los dibuja la arboleda con volumen; el polígono queda invisible pero se puede tocar
    if (patron === "edificio") return { stroke: false, fillColor: "#fff", fillOpacity: 0, className: "lote lote-pq" + extra };
    const suelo = window.Arboleda && Arboleda.suelo(p);
    if (suelo) return { color: "#BDB98C", weight: 1, opacity: .7, fillColor: suelo, fillOpacity: 1, className: "lote lote-pq" + extra };
    return { color: "#BDB98C", weight: 1, opacity: .7, fillOpacity: 1, className: "lote lote-pq p-" + (patron === "agua" ? "agua" : "liso") + extra };
  }
  // Las líneas engordan al acercarse (hasta 2,6 veces), como en un plano dibujado a escala.
  let lineasPq = [];
  const anchoZoom = () => Math.max(1, Math.min(2.6, 2 ** ((mapa.getZoom() - 16.5) * .5)));
  mapa.on("zoomend", () => lineasPq.forEach(({ c, w }) => c.setStyle({ weight: w * anchoZoom() })));
  // Satelital: la foto manda. Solo contornos blancos finos (sin colores de zona ni vías dibujadas) para ubicar cada
  // lote en la imagen real; las paradas se tocan igual.
  function estiloSatelital(f) {
    const p = f.properties, est = esEstacion(f) && capas.estaciones;
    if (esPredio(f)) return { color: "#ffffff", weight: 1.5, opacity: .75, dashArray: "6 6", fill: false, className: "predio" };
    if (p.provisorio) return { color: "#ffffff", weight: 1.2, opacity: .8, dashArray: "3 4", fillColor: "#ffffff", fillOpacity: .06, className: "lote" + (est ? " es-est" : "") };
    return est ? { color: "#ffffff", weight: 1.6, opacity: .95, fillColor: "#ffffff", fillOpacity: .1, className: "lote es-est" }
      : { color: "#ffffff", weight: 1, opacity: .55, fillColor: "#ffffff", fillOpacity: 0, className: "lote" };
  }
  // Rutas, caminos y paseos dibujados en el KML (nombres "Ruta…", "Camino…", "Paseo…").
  function dibujarLineasParque(lineas) {
    lineasPq = [];
    // las vías van en una capa propia, encima de la arboleda y del pasto
    if (!mapa.getPane("vias")) { const pv = mapa.createPane("vias"); pv.style.zIndex = 420; pv.style.pointerEvents = "none"; }
    const lienzo = dibujarLineasParque.lienzo || (dibujarLineasParque.lienzo = L.svg({ pane: "vias", padding: MARGEN }));
    const capa = (fs, st) => { const c = L.geoJSON({ type: "FeatureCollection", features: fs }, { style: { ...st, weight: st.weight * anchoZoom() }, interactive: false, renderer: lienzo }).addTo(capaFondo);
      lineasPq.push({ c, w: st.weight }); };
    const de = (t) => lineas.filter((f) => tipoLinea(f) === t);
    const r = { lineCap: "round", lineJoin: "round", className: "camino" };
    // Jerarquía de abajo hacia arriba: caminos internos, paseos, calles de tierra, calles de asfalto y rutas. Cada tipo
    // dibuja su borde y su relleno juntos, así el de más arriba tapa al de abajo en los cruces.
    const tierra = de("calle-tierra"), asfalto = de("calle-asfalto"), rutas = de("ruta"), caminos = de("camino"), paseos = de("paseo");
    // caminos de tierra: finos, de borde difuso y con huellas tenues, para que se apoyen en el dibujo
    capa(caminos, { ...r, color: "#C9B184", weight: 6, opacity: .28 });
    capa(caminos, { ...r, color: "#E6D3A8", weight: 3.6, opacity: .95 });
    capa(caminos, { ...r, color: "#CDB78E", weight: .8, opacity: .55, dashArray: "1 6" });
    capa(paseos, { ...r, color: "#FAF8F5", weight: 4.5, opacity: .95, className: "camino paseo" });
    capa(tierra, { ...r, color: "#C9B184", weight: 7, opacity: .3 });
    capa(tierra, { ...r, color: "#E6D4AC", weight: 4.4, opacity: .95 });
    capa(asfalto, { ...r, color: "#FFFFFF", weight: 9 });
    capa(asfalto, { ...r, color: "#A3A8AA", weight: 6 });
    capa(rutas, { ...r, color: "#FFFFFF", weight: 14 });
    capa(rutas, { ...r, color: "#8C9295", weight: 10 });
    capa(rutas, { ...r, color: "#F4F1E6", weight: 1.2, opacity: .7, dashArray: "8 10" });
  }
  // Canales y acequias de riego (KML: líneas "Canal…" o "Acequia…"): encima de las plantas y debajo de caminos y rutas.
  // Se tocan para ver el nombre; una línea invisible más ancha hace fácil tocarlos con el dedo.
  let canalesPq = [];
  mapa.on("zoomend", () => canalesPq.forEach(({ c, w }) => c.setStyle({ weight: w * anchoZoom() })));
  function dibujarCanales(lineas, sat) {
    canalesPq = [];
    if (!lineas.length) return;
    if (!mapa.getPane("canales")) mapa.createPane("canales").style.zIndex = 415;
    const lienzo = dibujarCanales.lienzo || (dibujarCanales.lienzo = L.svg({ pane: "canales", padding: MARGEN }));
    const fc = { type: "FeatureCollection", features: lineas };
    const trazo = (st) => { const c = L.geoJSON(fc, { style: { lineCap: "round", lineJoin: "round", className: "canal", ...st, weight: st.weight * anchoZoom() },
      interactive: false, renderer: lienzo }).addTo(capaFondo); canalesPq.push({ c, w: st.weight }); };
    if (sat) trazo({ color: "#8fd8ff", weight: 2, opacity: .9 });
    else { trazo({ color: "#7FAFBF", weight: 4.6, opacity: .75 }); trazo({ color: "#BFE0E6", weight: 2.2, opacity: 1 }); }
    L.geoJSON(fc, { style: { weight: 18, opacity: 0, className: "canal" }, renderer: lienzo,
      onEachFeature: (f, capa) => capa.on("click", (ev) => { L.DomEvent.stop(ev); cartelito("💧 " + f.properties.nombre); }) }).addTo(capaFondo);
  }
  const EMOJI = { arboles: "🌳", hileras: "🍇", surcos: "🌱", pasto: "🌾", agua: "💧", edificio: "🏠" };
  // Cartelito discreto abajo al tocar un lote que no es parada; se va solo.
  function cartelito(texto) {
    let t = $("#cartelito");
    if (!t) { t = document.createElement("div"); t.id = "cartelito"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = texto; t.classList.add("visible");
    clearTimeout(cartelito.t); cartelito.t = setTimeout(() => t.classList.remove("visible"), 2600);
  }

  // ---------- Dibujo suave (parque) ----------
  // Solo cambia cómo se dibuja; los datos del KML quedan como están (el GPS, los sellos y los anclajes usan los originales).
  // 1) Las puntas de rutas, calles y caminos que quedan a menos de 20 m de otra línea se enganchan a ella.
  // 2) Esquinas redondeadas (Chaikin, 2 pasadas) en lotes, predio y líneas.
  const M_LAT = 110540, mLng = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
  function proyectar(p, a, b) { // punto de [a,b] más cercano a p, y su distancia en metros
    const k = mLng(p[1]);
    const ax = a[0] * k, ay = a[1] * M_LAT, dx = b[0] * k - ax, dy = b[1] * M_LAT - ay, px = p[0] * k, py = p[1] * M_LAT;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-9)));
    const x = ax + t * dx, y = ay + t * dy;
    return { q: [x / k, y / M_LAT], d: Math.hypot(px - x, py - y) };
  }
  function chaikin(pts, cerrado, vueltas = 2, q = .25) {
    for (let v = 0; v < vueltas; v++) {
      const n = pts.length, out = cerrado ? [] : [pts[0]];
      const tope = cerrado ? n : n - 1;
      for (let i = 0; i < tope; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        out.push([a[0] * (1 - q) + b[0] * q, a[1] * (1 - q) + b[1] * q], [a[0] * q + b[0] * (1 - q), a[1] * q + b[1] * (1 - q)]);
      }
      if (!cerrado) { out.splice(1, 1); out.splice(out.length - 1, 1); out.push(pts[n - 1]); }
      pts = out;
    }
    return pts;
  }
  let suaves = null;
  function suave(f) {
    if (!suaves) {
      suaves = new Map();
      const lineas = geo.features.filter((g) => esCamino(g) && g.geometry.type === "LineString");
      const enganchadas = new Map(lineas.map((g) => [g, g.geometry.coordinates.map((p) => p.slice())]));
      lineas.forEach((g) => {
        const c = enganchadas.get(g);
        [0, c.length - 1].forEach((i) => {
          let mejor = null;
          lineas.forEach((h) => {
            if (h === g) return;
            const hc = h.geometry.coordinates;
            for (let k = 0; k < hc.length - 1; k++) { const r = proyectar(c[i], hc[k], hc[k + 1]); if (!mejor || r.d < mejor.d) mejor = r; }
          });
          if (mejor && mejor.d < 20) c[i] = mejor.q;
        });
      });
      geo.features.forEach((g) => {
        const t = g.geometry.type;
        let geom = g.geometry;
        if (t === "LineString") geom = { type: t, coordinates: chaikin(enganchadas.get(g) || g.geometry.coordinates, false, 3) };
        else if (t === "Polygon" && esPredio(g)) // solo el contorno del predio se suaviza; los lotes quedan como en el KML
          geom = { type: t, coordinates: g.geometry.coordinates.map((anillo) => { const a = chaikin(anillo.slice(0, -1), true, 2, .15); return a.concat([a[0]]); }) };
        suaves.set(g, { type: "Feature", properties: g.properties, geometry: geom });
      });
    }
    return suaves.get(f) || f;
  }

  // Fondo: predio, caminos y lotes. Se dibuja una vez por modo; el nivel de detalle lo resuelve el CSS.
  function dibujarFondo() {
    suaves = null; // el editor puede haber cambiado la geometría
    if (capaFondo) capaFondo.remove();
    capaFondo = L.featureGroup().addTo(mapa);
    const orden = (f) => (esPredio(f) ? 0 : esCamino(f) ? 1 : esContexto(f) ? 2 : 3);
    const vect = geo.features.filter((f) => f.geometry.type !== "Point" && !esCanal(f)).sort((a, b) => orden(a) - orden(b));
    if (modo === "ilustrado" && !PARQUE) {
      L.geoJSON({ type: "FeatureCollection", features: vect.filter(esCamino) },
        { style: { color: "#cdbb8f", weight: 16, lineCap: "round", className: "camino" }, interactive: false }).addTo(capaFondo);
    }
    // Estaciones provisorias de un solo punto: un círculo punteado de 18 m para que se vea el lugar.
    geo.features.filter((f) => capas.estaciones && f.properties.provisorio && f.geometry.type === "Point").forEach((f) => {
      const e = estacion(estDe(f));
      L.circle(centro(f), { radius: 18, color: zona(e).color, weight: 3, dashArray: "6 6", fillColor: zona(e).color, fillOpacity: 0.18,
        className: "lote lote-est lote-prov" }).on("click", () => abrirFicha(e.id)).addTo(capaFondo);
    });
    const parque = PARQUE && modo === "ilustrado", sat = modo === "satelital";
    const dibujo = parque ? vect.map(suave) : vect; // en parque: esquinas redondeadas y caminos empalmados
    L.geoJSON({ type: "FeatureCollection", features: parque || sat ? dibujo.filter((f) => !esCamino(f)) : dibujo }, {
      style: estilo,
      noClip: true, // sin recortar los polígonos al borde del lienzo: el recorte dejaba un borde recto (con sombra) al arrastrar
      onEachFeature: (f, capa) => {
        if (sat) { // nombre chico de cada lote (de cerca) para reconocerlo en la foto
          if (esEstacion(f) && capas.estaciones) capa.on("click", () => abrirFicha(estDe(f)));
          else if (esPredio(f)) capa.on("click", () => { if (nivel === "lejos") verPredio(); });
          else if (f.properties.nombre) capa.on("click", (ev) => { L.DomEvent.stop(ev); cartelito(f.properties.nombre); });
          if (!esPredio(f) && f.properties.nombre && f.geometry.type !== "Point")
            capa.bindTooltip(f.properties.nombre, { permanent: true, direction: "center", className: "sat-nombre" });
          return;
        }
        if (parque) { // sin carteles fijos: el nombre del lote aparece al tocarlo
          if (esEstacion(f) && capas.estaciones) capa.on("click", () => abrirFicha(estDe(f)));
          else if (esPredio(f)) capa.on("click", () => { if (nivel === "lejos") verPredio(); });
          else if (f.properties.nombre) capa.on("click", (ev) => { L.DomEvent.stop(ev); cartelito(`${EMOJI[f.properties.patron] || "🌿"} ${f.properties.nombre}`); });
          return;
        }
        if (esEstacion(f) && capas.estaciones) capa.on("click", () => abrirFicha(estDe(f)));
        else if (esPredio(f)) capa.on("click", () => { if (nivel === "lejos") verPredio(); });
        if (esPredio(f) && f.properties.nombre && sectores().length > 1)
          capa.bindTooltip(f.properties.nombre, { permanent: true, direction: "center", className: "sector-nombre" });
        if ((esContexto(f) || (!capas.estaciones && esEstacion(f))) && f.properties.nombre && capas.lotes) capa.bindTooltip(f.properties.nombre, { permanent: true, direction: "bottom", offset: [0, 14], className: "ctx-nombre" });
      },
    }).addTo(capaFondo);
    if (parque) dibujarLineasParque(dibujo.filter(esCamino)); // encima del predio y de los bordes de los lotes
    dibujarCanales(geo.features.filter(esCanal), sat);
    // plantas de cada lote y edificios con volumen (lienzo aparte, debajo de las paradas)
    // (un lote provisorio entra si dice su cultivo: por ejemplo, el de olivos que se tomó para la estación de poda)
    if (parque && window.Arboleda) Arboleda.capa(geo.features.filter((f) => !esCamino(f) && !esPredio(f) && !(f.properties.provisorio && !f.properties.cultivo)),
      { visible: () => calcularNivel() !== "lejos", predios: geo.features.filter(esPredio), poda: centroEstacion(C.podaMecanica),
        ingresos: geo.features.filter((f) => esServicio(f) && f.properties.servicio === "ingreso").map((f) => f.geometry.coordinates),
        lineas: geo.features.filter((f) => esCamino(f) && f.geometry.type === "LineString") }).addTo(capaFondo);
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
    if (cambio || forzar) dibujarServicios();
    dibujarFrutas(); // los símbolos de cultivos se reacomodan con cada zoom
    dibujarParadas(); // las agrupaciones cambian con cada zoom
    // la animación de entrada de paradas y símbolos va solo la primera vez: en cada zoom se rearman todas y parpadeaban
    if (!actualizarNivel.hecho) { actualizarNivel.hecho = true; setTimeout(() => $("#mapa").classList.add("sin-aparecer"), 600); }
  }
  mapa.on("zoomend", () => actualizarNivel(false));

  // Frutitas de los lotes: solo de cerca.
  function dibujarFrutas() {
    if (capaFrutas) capaFrutas.remove();
    capaFrutas = L.layerGroup();
    if (PARQUE) return dibujarSimbolos();
    if (nivel !== "cerca" || !capas.lotes || (PARQUE && modo === "ilustrado")) return; // en parque el lote ya es la textura
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

  // Símbolos de cultivos (Capas → "Símbolos de cultivos"): un disco blanco con el dibujo del cultivo sobre cada lote
  // que no es parada (las paradas ya tienen su gota). Si dos se tocan en pantalla, queda uno solo.
  // Ícono de cada cultivo (los que no tienen dibujo propio usan el de su especie).
  const ICONO_CULTIVO = { pecan_joven: "pecan" };
  const iconoCultivo = (c) => ICON[c] || ICON[ICONO_CULTIVO[c]] || null;
  function dibujarSimbolos() {
    if (nivel === "lejos" || !capas.cultivos) return;
    const puestos = capas.estaciones ? ubicadas().map((e) => mapa.latLngToLayerPoint(centroEstacion(e.id)).subtract([0, 28])) : [];
    const libre = (p) => puestos.every((q) => q.distanceTo(p) >= 38);
    // Lotes cultivados (no edificios): el símbolo va en el centro del lote o, si ahí hay una gota u otro símbolo,
    // en el punto libre del lote más cercano al centro. Si el lote se ve muy chico para que entre, no lleva símbolo.
    geo.features.filter((f) => f.geometry.type === "Polygon" && !esPredio(f) && !esCamino(f) && f.properties.patron !== "edificio")
      .filter((f) => iconoCultivo(f.properties.cultivo)).forEach((f) => {
        const anillo = f.geometry.coordinates[0], c = centro(f);
        let ll = c, p = mapa.latLngToLayerPoint(c);
        if (!dentroDe(c.lng, c.lat, anillo) || !libre(p)) {
          const xs = anillo.map((v) => v[0]), ys = anillo.map((v) => v[1]), cand = [];
          for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) {
            const x = Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * i / 10, y = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * j / 10;
            if (dentroDe(x, y, anillo)) cand.push(L.latLng(y, x));
          }
          const ok = cand.map((q) => ({ q, pt: mapa.latLngToLayerPoint(q) })).filter((o) => libre(o.pt))
            .sort((a, b) => a.pt.distanceTo(p) - b.pt.distanceTo(p))[0];
          if (!ok) return;
          ll = ok.q; p = ok.pt;
        }
        puestos.push(p);
        L.marker(ll, { keyboard: false, title: f.properties.nombre, icon: L.divIcon({ className: "icono-libre", iconSize: [32, 32], iconAnchor: [16, 16],
          html: `<div class="simbolo-cultivo">${iconoCultivo(f.properties.cultivo)}</div>` }) })
          .on("click", () => cartelito(f.properties.nombre)).addTo(capaFrutas);
      });
    capaFrutas.addTo(mapa);
  }

  // Ingresos y otros servicios: desde el nivel medio.
  function dibujarServicios() {
    if (capaServicios) capaServicios.remove();
    capaServicios = L.layerGroup();
    if (nivel === "lejos" || !capas.servicios) return;
    if (PARQUE) { // símbolos chicos y de bajo contraste, sin texto
      geo.features.filter((f) => esServicio(f) && f.geometry.type === "Point").forEach((f) => {
        L.marker(centro(f), { keyboard: false, icon: L.divIcon({ className: "icono-libre", iconSize: [26, 26], iconAnchor: [13, 13],
          html: `<div class="serv-pq" title="${esc(f.properties.nombre)}">${ICON[f.properties.servicio] || ""}</div>` }) })
          .on("click", () => cartelito(f.properties.nombre)).addTo(capaServicios);
      });
      capaServicios.addTo(mapa);
      return;
    }
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
    if (PARQUE) return dibujarGotas();
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
    const fin = (pt, r) => { // centro del lado del banderín que mira al punto
      const cx = (r.x1 + r.x2) / 2, cy = (r.y1 + r.y2) / 2;
      if (pt.y >= r.y2) return { x: Math.max(r.x1 + 10, Math.min(pt.x, r.x2 - 10)), y: r.y2 };
      if (pt.y <= r.y1) return { x: Math.max(r.x1 + 10, Math.min(pt.x, r.x2 - 10)), y: r.y1 };
      return { x: pt.x < cx ? r.x1 : r.x2, y: cy };
    };
    const lineaLibre = (pt, r, propio) => {
      const q = fin(pt, r);
      return !lineas.some((l) => cruza(pt, q, l.a, l.b)) && !ocupados.some((o) => o.de !== propio && o.de !== "serv" && o.x2 - o.x1 > 20 && atraviesa(pt, q, o));
    };
    const choca = (r, propio) => ocupados.some((o) => o.de !== propio && r.x1 < o.x2 + 4 && r.x2 > o.x1 - 4 && r.y1 < o.y2 + 4 && r.y2 > o.y1 - 4);
    const solape = (r, propio) => ocupados.reduce((t, o) => o.de === propio ? t
      : t + Math.max(0, Math.min(r.x2, o.x2) - Math.max(r.x1, o.x1)) * Math.max(0, Math.min(r.y2, o.y2) - Math.max(r.y1, o.y1)), 0);
    // direcciones en orden de preferencia: arriba, diagonales de arriba, costados, diagonales de abajo, abajo
    // arriba primero (como un mástil), después las diagonales y los costados; distancias cortas primero
    const dirs = [-90, -70, -110, -45, -135, -20, -160, 0, 180, 30, 150, 60, 120, 90].map((g) => [Math.cos(g * Math.PI / 180), Math.sin(g * Math.PI / 180)]);
    const dists = cerca ? [18, 30, 44, 60, 80, 104, 130] : mini ? [8, 16, 26, 38, 52, 68] : [12, 22, 34, 48, 64, 84, 106];
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
      const q = fin(a.pt, mejor);
      L.marker(a.ll, { icon: bandera(a.e, mejor.x1 - a.pt.x, mejor.y1 - a.pt.y, w, mini, q.x - a.pt.x, q.y - a.pt.y), zIndexOffset: 500 })
        .on("click", () => abrirFicha(a.e.id)).addTo(capaParadas);
    });
  }

  // Parque: gota blanca con el número por estación. Las que se tocan en pantalla se juntan en un círculo con la
  // cantidad (como los mapas de parques); tocarlo acerca hasta separarlas.
  function dibujarGotas() {
    const es = ubicadas().slice().sort((a, b) => (parseInt(a.numero, 10) || 99) - (parseInt(b.numero, 10) || 99));
    const juntar = mapa.getZoom() < mapa.getMaxZoom() - 0.25;
    // Se compara dónde se ve cada gota (su cabeza queda ~28 px arriba del punto) y se juntan grupos hasta que
    // ninguno quede a menos de 50 px de otro.
    const grupos = es.map((e) => { const ll = centroEstacion(e.id); return { es: [e], lls: [ll], pt: mapa.latLngToLayerPoint(ll).subtract([0, 28]) }; });
    for (let unido = juntar; unido;) {
      unido = false;
      for (let i = 0; i < grupos.length && !unido; i++) for (let j = i + 1; j < grupos.length && !unido; j++) {
        const a = grupos[i], b = grupos[j];
        if (a.pt.distanceTo(b.pt) >= 50) continue;
        grupos[i] = { es: a.es.concat(b.es), lls: a.lls.concat(b.lls),
          pt: a.pt.multiplyBy(a.es.length).add(b.pt.multiplyBy(b.es.length)).divideBy(a.es.length + b.es.length) };
        grupos.splice(j, 1); unido = true;
      }
    }
    grupos.forEach((g) => {
      if (g.es.length === 1) {
        L.marker(g.lls[0], { icon: gota(g.es[0]), zIndexOffset: 500, title: g.es[0].corto || g.es[0].nombre })
          .on("click", () => abrirFicha(g.es[0].id)).addTo(capaParadas);
        return;
      }
      const hechas = g.es.every((e) => sellos.includes(e.id));
      L.marker(mapa.layerPointToLatLng(g.pt), { zIndexOffset: 600, title: g.es.map((e) => e.numero || e.corto).join(", "),
        icon: L.divIcon({ className: "icono-libre", iconSize: [44, 44], iconAnchor: [22, 22],
          html: `<div class="racimo-pq${hechas ? " hecho" : ""}">${g.es.length}</div>` }) })
        .on("click", () => mapa.flyToBounds(L.latLngBounds(g.lls), { padding: [90, 90], maxZoom: mapa.getMaxZoom(), duration: .6 }))
        .addTo(capaParadas);
    });
  }
  function gota(e) {
    const visitada = sellos.includes(e.id);
    const ahora = actividades.some((a) => a.estacion === e.id && estadoActividad(a) === "ahora");
    const clases = ["gota", visitada && "sellada", esProvisoria(e.id) && "provisoria", ahora && "en-vivo"].filter(Boolean).join(" ");
    const centro = e.numero ? `<span class="g-num">${esc(e.numero)}</span>` : `<span class="g-ico">${ICON[e.icono] || ""}</span>`;
    return L.divIcon({ className: "icono-libre", iconSize: [40, 50], iconAnchor: [20, 48],
      html: `<div class="${clases}"><svg viewBox="0 0 40 50" aria-hidden="true"><path d="M20 47l-6-12.1a17 17 0 1 1 12 0z"/></svg>
        ${centro}${visitada ? '<span class="g-tilde">✓</span>' : ""}${ahora ? '<span class="g-vivo"></span>' : ""}</div>` });
  }

  // Ancho estimado del banderín (número + ícono, y el nombre de cerca).
  function anchoBandera(e, cerca) {
    const base = (e.numero ? 34 : 0) + 34 + 12;
    if (!cerca) return base;
    return Math.min(190, base + Math.round((e.corto || e.nombre).length * 7.4) + 10);
  }

  // Banderín ubicado en (dx, dy) respecto del punto de la estación, con línea guía y punto.
  function bandera(e, dx, dy, w, mini, lx, ly) {
    const h = mini ? 32 : 40, c = zona(e).color;
    const visitada = sellos.includes(e.id);
    const ahora = actividades.some((a) => a.estacion === e.id && estadoActividad(a) === "ahora");
    const clases = ["bandera", mini && "mini", visitada && "visitada", esProvisoria(e.id) && "provisoria", ahora && "en-vivo"].filter(Boolean).join(" ");
    // la línea va del punto al borde más cercano del banderín
    const ex = lx, ey = ly;
    return L.divIcon({
      className: "icono-libre ancla", iconSize: [0, 0], iconAnchor: [0, 0],
      html: `<svg class="guia" width="1" height="1" aria-hidden="true"><line x1="0" y1="0" x2="${ex}" y2="${ey}" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/>
          <line x1="0" y1="0" x2="${ex}" y2="${ey}" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
          <circle r="5.5" fill="${c}" stroke="#fff" stroke-width="2.5"/></svg>
        <div class="${clases}" style="--c:${c};left:${dx}px;top:${dy}px;width:${w}px">${ahora ? '<span class="en-vivo-txt">Ahora</span>' : ""}
          <div class="tela">${mini ? `<span class="b-mini">${e.numero ? esc(e.numero) : ICON[e.icono] || ""}</span>`
            : `${e.numero ? `<span class="b-num">${esc(e.numero)}</span>` : ""}<span class="b-ico">${ICON[e.icono] || ""}</span>
          <span class="b-nombre">${esc(e.corto || e.nombre)}</span>`}${visitada ? '<span class="b-tilde">✓</span>' : ""}</div></div>`,
    });
  }

  // ---------- Hojas y pestañas ----------
  function mostrar(sel) {
    const ct = $("#cartelito"); if (ct) ct.classList.remove("visible");
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

  // ---------- Cómo llegar ----------
  // Por la red de caminos del KML (caminos internos, calles y rutas): se camina por los caminos internos y se usan las
  // calles y rutas solo para cruzar (cuestan más). Cada vez que el recorrido toca o cruza una calle o ruta, se marca
  // un aviso de precaución. Sin red de caminos, va en línea recta.
  let capaRuta = null, red = null;
  const COSTO = { camino: 1, paseo: 1, "calle-tierra": 2.5, "calle-asfalto": 4, ruta: 6 };
  const peligrosa = (t) => t === "ruta" || /^calle/.test(t);
  function armarRed() {
    const lineas = geo.features.filter((f) => esCamino(f) && f.geometry.type === "LineString");
    if (!lineas.length) return null;
    const lat0 = C.centro[0], kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
    const xy = ([lng, lat]) => [lng * kx, lat * ky], ll = ([x, y]) => [y / ky, x / kx];
    const nodos = [], aristas = [], segPeligro = [];
    const puntas = [];
    lineas.forEach((f) => {
      const t = tipoLinea(f), coords = suave(f).geometry.coordinates.map(xy);
      let previo = null; puntas.push(nodos.length);
      for (let i = 0; i < coords.length - 1; i++) {
        const [a, b] = [coords[i], coords[i + 1]], L2 = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L2 / 5));
        if (peligrosa(t)) segPeligro.push({ a, b, nombre: f.properties.nombre || (t === "ruta" ? "la ruta" : "la calle") });
        for (let k = i ? 1 : 0; k <= n; k++) {
          const id = nodos.length; nodos.push({ p: [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n], t, nombre: f.properties.nombre, linea: f.properties.id, ady: [] });
          if (previo !== null) aristas.push([previo, id]);
          previo = id;
        }
      }
      puntas.push(previo);
    });
    // puntas sueltas (al suavizar, un camino que terminaba sobre otro puede quedar a unos metros): se unen al nodo más
    // cercano de otra línea si está a menos de 20 m
    puntas.forEach((i) => {
      let mejor = -1, md = 20;
      nodos.forEach((n, j) => { if (n.linea === nodos[i].linea) return;
        const d = Math.hypot(n.p[0] - nodos[i].p[0], n.p[1] - nodos[i].p[1]); if (d < md && d >= 0.01) { md = d; mejor = j; } });
      if (mejor >= 0) aristas.push([i, mejor]);
    });
    // empalmes entre líneas distintas: nodos a menos de 9 m
    for (let i = 0; i < nodos.length; i++) for (let j = i + 1; j < nodos.length; j++) {
      const a = nodos[i], b = nodos[j];
      if (Math.abs(a.p[0] - b.p[0]) < 9 && Math.abs(a.p[1] - b.p[1]) < 9 && Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]) < 9 && a.linea !== b.linea) aristas.push([i, j]);
    }
    // sectores con un solo acceso habilitado (config.js, accesos): no se entra ni se sale salvo cerca de ese ingreso
    const cerrados = Object.entries(C.accesos || {}).map(([sector, ingreso]) => {
      const pr = geo.features.find((f) => esPredio(f) && f.properties.nombre === sector);
      const ing = geo.features.find((f) => esServicio(f) && f.properties.nombre === ingreso);
      return pr && ing ? { anillo: pr.geometry.coordinates[0].map(xy), puerta: xy(ing.geometry.coordinates) } : null;
    }).filter(Boolean);
    const adentro = (p, z) => { let ok = false; const a = z.anillo;
      for (let i = 0, j = a.length - 1; i < a.length; j = i++) if ((a[i][1] > p[1]) !== (a[j][1] > p[1]) && p[0] < (a[j][0] - a[i][0]) * (p[1] - a[i][1]) / (a[j][1] - a[i][1]) + a[i][0]) ok = !ok;
      return ok; };
    const habilitada = (p, q) => cerrados.every((z) => adentro(p, z) === adentro(q, z)
      || Math.hypot((p[0] + q[0]) / 2 - z.puerta[0], (p[1] + q[1]) / 2 - z.puerta[1]) < 30);
    const sinCerrar = aristas.filter(([i, j]) => habilitada(nodos[i].p, nodos[j].p));
    aristas.length = 0; aristas.push(...sinCerrar);
    aristas.forEach(([i, j]) => {
      const d = Math.hypot(nodos[i].p[0] - nodos[j].p[0], nodos[i].p[1] - nodos[j].p[1]);
      const c = d * Math.max(COSTO[nodos[i].t] || 1, COSTO[nodos[j].t] || 1);
      nodos[i].ady.push([j, c]); nodos[j].ady.push([i, c]);
    });
    // cruces: de un camino interno a otro enfrentado del otro lado de una calle o ruta, derecho (menos de 45 m)
    const distSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1e-9)));
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
    const orilla = nodos.map((nd, i) => i).filter((i) => !peligrosa(nodos[i].t) && segPeligro.some((s) => distSeg(nodos[i].p, s.a, s.b) < 28));
    orilla.forEach((i, x) => orilla.slice(x + 1).forEach((j) => {
      const a = nodos[i], b = nodos[j], d = Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]);
      if (d < 9 || d > 45 || !segPeligro.some((s) => cruce(a.p, b.p, s.a, s.b)) || !habilitada(a.p, b.p)) return;
      const c = d * 1.5 + 25; a.ady.push([j, c]); b.ady.push([i, c]);
    }));
    return { nodos, segPeligro, xy, ll };
  }
  function caminoMasCorto(r, desde, hasta) {
    const n = r.nodos.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), hecho = new Uint8Array(n);
    dist[desde] = 0;
    for (;;) { // Dijkstra simple: la red tiene pocos cientos de nodos
      let u = -1, m = Infinity;
      for (let i = 0; i < n; i++) if (!hecho[i] && dist[i] < m) { m = dist[i]; u = i; }
      if (u < 0 || u === hasta) break;
      hecho[u] = 1;
      r.nodos[u].ady.forEach(([v, c]) => { if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; } });
    }
    if (!isFinite(dist[hasta])) return null;
    const camino = []; for (let v = hasta; v >= 0; v = prev[v]) camino.unshift(v);
    return camino;
  }
  function cruce(p1, p2, a, b) { // punto donde [p1,p2] corta a [a,b], o null
    const d = (p2[0] - p1[0]) * (b[1] - a[1]) - (p2[1] - p1[1]) * (b[0] - a[0]);
    if (!d) return null;
    const t = ((a[0] - p1[0]) * (b[1] - a[1]) - (a[1] - p1[1]) * (b[0] - a[0])) / d, u = ((a[0] - p1[0]) * (p2[1] - p1[1]) - (a[1] - p1[1]) * (p2[0] - p1[0])) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])] : null;
  }
  function comoLlegar(id) {
    const destino = centroEstacion(id), e = estacion(id);
    const ingreso = geo.features.find((f) => esServicio(f) && /principal/i.test(f.properties.nombre || "")) || geo.features.find(esServicio);
    const origen = miPosicion || (ingreso ? centro(ingreso) : null);
    if (!destino || !origen) { avisar("No hay un punto de partida para trazar el recorrido."); return; }
    if (capaRuta) capaRuta.remove();
    red = red || armarRed();
    let puntos = [origen, destino], avisos = [];
    if (red) {
      const o = red.xy([origen.lng, origen.lat]), dd = red.xy([destino.lng, destino.lat]);
      const cercano = (p) => red.nodos.reduce((m, nd, i) => { const d = Math.hypot(nd.p[0] - p[0], nd.p[1] - p[1]) * (peligrosa(nd.t) ? 3 : 1); return d < m.d ? { i, d } : m; }, { i: -1, d: Infinity }).i;
      const camino = caminoMasCorto(red, cercano(o), cercano(dd));
      if (camino) {
        const xs = [o, ...camino.map((i) => red.nodos[i].p), dd];
        // avisos: un tramo es peligroso si corta una calle o ruta o va por ella; cada tramo seguido lleva un solo aviso,
        // puesto donde empieza
        const tipos = [null, ...camino.map((i) => red.nodos[i]), null];
        const marcas = []; let enTramo = null;
        for (let i = 0; i < xs.length - 1; i++) {
          let nombre = null, q = null;
          red.segPeligro.forEach((s) => { const c = !nombre && cruce(xs[i], xs[i + 1], s.a, s.b); if (c) { nombre = s.nombre; q = c; } });
          const nd = [tipos[i], tipos[i + 1]].find((x) => x && peligrosa(x.t));
          if (!nombre && nd) { nombre = nd.nombre; q = nd.p; }
          if (nombre && nombre !== enTramo && !marcas.some((m) => m.nombre === nombre && Math.hypot(m.p[0] - q[0], m.p[1] - q[1]) < 40)) marcas.push({ p: q, nombre });
          enTramo = nombre;
        }
        puntos = xs.map(red.ll).map((q) => L.latLng(q));
        avisos = marcas.map((m) => ({ ll: L.latLng(red.ll(m.p)), nombre: (m.nombre || "la calle").replace(/^RP N° /, "RP ") }));
      }
    }
    const m = puntos.reduce((t, p, i) => (i ? t + mapa.distance(puntos[i - 1], p) : 0), 0);
    const medio = puntos[Math.floor(puntos.length / 2)];
    if (!mapa.getPane("recorrido")) mapa.createPane("recorrido").style.zIndex = 430; // encima de árboles y vías
    const sobre = { pane: "recorrido", renderer: comoLlegar.lienzo || (comoLlegar.lienzo = L.svg({ pane: "recorrido", padding: MARGEN })) };
    capaRuta = L.layerGroup([
      L.polyline(puntos, { ...sobre, color: "#ffffff", weight: 9, opacity: 0.9, lineCap: "round", lineJoin: "round", interactive: false }),
      L.polyline(puntos, { ...sobre, color: zona(e).color, weight: 5, dashArray: "2 12", lineCap: "round", lineJoin: "round", className: "ruta", interactive: false }),
      L.marker(medio, { interactive: false, icon: L.divIcon({ className: "icono-libre", iconSize: [190, 34], iconAnchor: [95, 40],
        html: `<span class="ruta-etiqueta" style="--c:${zona(e).color}">🚶 ${Math.round(m / 10) * 10} m</span>` }) }),
      ...avisos.map((a) => L.marker(a.ll, { zIndexOffset: 800, title: "Precaución: " + a.nombre, icon: L.divIcon({ className: "icono-libre", iconSize: [34, 34], iconAnchor: [17, 17],
        html: `<div class="precaucion" aria-label="Precaución al cruzar ${esc(a.nombre)}">!</div>` }) })
        .on("click", () => avisar(`⚠ Precaución: ${a.nombre}. Mirá a ambos lados y caminá por la banquina; pueden pasar vehículos y máquinas.`, 5000))),
    ]).addTo(mapa);
    mostrar(null);
    mapa.flyToBounds(L.latLngBounds(puntos).pad(0.3), { duration: 0.6 });
    const desde = miPosicion ? "Desde tu ubicación" : "Desde el ingreso principal";
    const nombres = Array.from(new Set(avisos.map((a) => a.nombre)));
    avisar(nombres.length ? `${desde} por los caminos internos. ⚠ Precaución: el recorrido cruza o va junto a ${nombres.join(" y ")}; mirá a ambos lados.`
      : `${desde} hasta ${e.corto || e.nombre}${puntos.length > 2 ? ", por los caminos internos" : ", en línea recta"}.`, 7000);
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
