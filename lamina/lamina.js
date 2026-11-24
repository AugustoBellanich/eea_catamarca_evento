/* Lámina para redes: mapa de la EEA Catamarca ilustrado "a mano" (papel, acuarela, tinta y letra manuscrita).
   Usa los datos del sitio (datos/mapa.js, datos/estaciones.js, config.js); no inventa lugares. Las plantas son
   simbólicas (más espaciadas que en la realidad para que se lean); los polígonos, caminos y estaciones son los del KML.
   Formatos: ?formato=feed (1080×1350) o ?formato=historia (1080×1920). Se exporta a PNG con lamina/exportar.py. */
(async function () {
  "use strict";
  const C = window.CONFIG, GEO = window.MAPA.features, EST = window.ESTACIONES.estaciones;
  const FORMATOS = {
    feed:     { W: 1080, H: 1350, cab: 236, pie: 56, leyenda: 360 },
    historia: { W: 1080, H: 1920, cab: 360, pie: 90, leyenda: 300 },
  };
  const F = FORMATOS[new URLSearchParams(location.search).get("formato")] || FORMATOS.feed;
  const { W, H } = F;
  const cv = document.getElementById("lamina"), dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  const c = cv.getContext("2d"); c.scale(dpr, dpr);
  const rc = rough.canvas(cv);
  await document.fonts.load("40px 'Caveat Brush'"); await document.fonts.load("700 30px Caveat"); await document.fonts.load("30px Caveat");

  // ---------- Azar estable (la lámina sale igual cada vez) ----------
  let semilla = 7;
  const azar = () => { semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0; let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const entre = (a, b) => a + azar() * (b - a);
  const sem = () => Math.floor(azar() * 2 ** 31) + 1;

  // ---------- Paleta (papel, tinta, acuarelas) ----------
  const TINTA = "#4a3b2c", TINTA_SUAVE = "rgba(74,59,44,.55)", PAPEL = "#f3ead4";
  const MARCA = "#008bd2", ROJO = "#e30613", GRIS = "#3c3c3b";
  const LAVADO = { // color de acuarela de cada cultivo
    olivo: "#d3dcb2", naranja: "#c6deA5", lima: "#c6dea5", nogal: "#bfd8a0", pecan: "#bfd8a0", pecan_joven: "#e8e0b0",
    almendra: "#d8e3ab", higo: "#c3dda4", frutal: "#d0dfa8", tuna: "#dce2ae", vid: "#dcdca2", algodon: "#efe6be",
    girasol: "#f2e09c", comino: "#e8e3b6", vivero: "#cfe0a6", pastura: "#d3e3ae", ganado: "#ecdab4", estanque: "#a9d6df",
    arado: "#e2c79c", monte: "#cfd8a8", desmonte: "#efe0bc", sanidad: "#d8eaea",
  };
  const COPA = { // [color de copa, color de luz] de cada árbol
    olivo: ["#9bab7f", "#c7d1a8"], naranja: ["#5f9b4c", "#93c27a"], lima: ["#6aa553", "#9dcd82"], nogal: ["#6f9c50", "#a2c67e"],
    pecan: ["#6f9c50", "#a2c67e"], almendra: ["#98b867", "#c2d892"], higo: ["#77a855", "#a8cf80"], frutal: ["#7eaa58", "#b0d088"],
    nativo: ["#7f9054", "#aab97a"], tuna: ["#9fbd80", "#c4d8a6"],
  };

  // ---------- Proyección ----------
  const sectores = GEO.filter((f) => f.properties.tipo === "predio");
  // Encuadre: el Sector 1 (donde se concentra la jornada) más el lote de algodón (estación 12) y todas las estaciones.
  // Lo que queda fuera de ese recuadro se corta con el marco.
  const foco = [...sectores.filter((f) => f.properties.nombre === "Sector 1"), ...GEO.filter((f) => f.properties.cultivo === "algodon"),
    ...GEO.filter((f) => f.properties.tipo === "estacion")];
  const todos = foco.flatMap((f) => f.geometry.type === "Point" ? [f.geometry.coordinates] : f.geometry.coordinates[0]);
  const lat0 = todos.reduce((t, p) => t + p[1], 0) / todos.length, k = 111320 * Math.cos(lat0 * Math.PI / 180), M = 110540;
  const lngs = todos.map((p) => p[0]), lats = todos.map((p) => p[1]);
  const xm = (lng) => (lng - Math.min(...lngs)) * k, ym = (lat) => (Math.max(...lats) - lat) * M;
  const anchoM = xm(Math.max(...lngs)), altoM = ym(Math.min(...lats));
  // caja del mapa: columna izquierda; a la derecha va la leyenda
  const caja = { x: 34, y: F.cab + 8, w: W - F.leyenda - 34 - 18, h: H - F.cab - F.pie - 16 };
  const esc = Math.min(caja.w / (anchoM * 1.08), caja.h / (altoM * 1.05)); // px por metro
  const libreAbajo = caja.h - Math.min(caja.h, altoM * esc * 1.07);
  { const h = caja.h - libreAbajo; if (F.H < 1500) caja.y += libreAbajo / 2; caja.h = h; } // el marco abraza al mapa (en la historia, arriba)
  const ox = caja.x + (caja.w - anchoM * esc) / 2, oy = caja.y + (caja.h - altoM * esc) / 2;
  const P = ([lng, lat]) => [ox + xm(lng) * esc, oy + ym(lat) * esc];
  const T = Math.max(1, Math.sqrt(esc / .67)); // con más acercamiento, árboles y surcos un poco más grandes
  const anillo = (f) => f.geometry.coordinates[0].slice(0, -1).map(P);

  // ---------- Geometría ----------
  const dentro = ([x, y], pts) => { let ok = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ok = !ok; } return ok; };
  const distSeg = ([px, py], [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  const distBorde = (p, pts) => Math.min(...pts.map((a, i) => distSeg(p, a, pts[(i + 1) % pts.length])));
  const area = (pts) => Math.abs(pts.reduce((t, p, i) => { const q = pts[(i + 1) % pts.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
  const centroide = (pts) => [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
  const ejeLargo = (pts) => { let ang = 0, l = 0; pts.forEach((a, i) => { const b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d > l) { l = d; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); } }); return ang; };
  const caminoDe = (pts, cerrado = true) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (cerrado) c.closePath(); };
  // borde temblado: subdivide cada lado y mueve los puntos un poco (trazo de pincel)
  function temblar(pts, amp, paso = 7, cerrado = true) {
    const out = [], n = cerrado ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.round(d / paso));
      for (let j = 0; j < m; j++) { const t = j / m; out.push([a[0] + (b[0] - a[0]) * t + entre(-amp, amp), a[1] + (b[1] - a[1]) * t + entre(-amp, amp)]); }
    }
    if (!cerrado) out.push(pts[pts.length - 1]);
    return out;
  }

  // ---------- Técnicas ----------
  // acuarela: capas transparentes con borde irregular y un poco más de pigmento en el borde
  function acuarela(pts, color, alfa = .5, capas = 3, amp = 2.2) {
    c.save(); c.globalCompositeOperation = "multiply";
    for (let i = 0; i < capas; i++) {
      const q = temblar(pts, amp); caminoDe(q); c.fillStyle = color; c.globalAlpha = alfa / capas * 1.6; c.fill();
      c.globalAlpha = alfa * .35; c.lineWidth = 1.6; c.strokeStyle = color; c.stroke();
    }
    c.restore();
  }
  const tinta = (pts, o = {}) => rc.polygon(pts, { stroke: TINTA, strokeWidth: .9, roughness: .9, bowing: .6, seed: sem(), ...o });
  function lineaMano(pts, color, ancho, alfa = 1, amp = .5) {
    c.save(); c.globalAlpha = alfa; c.strokeStyle = color; c.lineWidth = ancho; c.lineCap = "round"; c.lineJoin = "round";
    caminoDe(temblar(pts, amp, 6, false), false); c.stroke(); c.restore();
  }
  function arbol(x, y, r, [copa, luz], o = {}) {
    c.save(); c.globalCompositeOperation = "multiply";
    c.fillStyle = "rgba(90,80,50,.22)"; c.beginPath(); c.ellipse(x + r * .45, y + r * .55, r * 1.05, r * .85, 0, 0, 6.283); c.fill(); // sombra
    c.restore();
    c.fillStyle = copa; c.beginPath();
    const n = 7, giro = entre(0, 6.283);
    for (let i = 0; i <= n; i++) { const a = giro + i / n * 6.283, rr = r * entre(.86, 1.08); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.fill();
    c.fillStyle = luz; c.beginPath(); c.arc(x - r * .3, y - r * .32, r * .42, 0, 6.283); c.fill();
    rc.circle(x, y, r * 2.05, { stroke: TINTA, strokeWidth: .55, roughness: 1.3, seed: sem() });
    if (o.frutos) for (let i = 0; i < 2; i++) { const a = entre(0, 6.283); c.fillStyle = o.frutos; c.beginPath(); c.arc(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .5, Math.max(.9, r * .18), 0, 6.283); c.fill(); }
  }
  function mata(x, y, r) { c.fillStyle = "rgba(120,132,80,.75)"; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
    c.strokeStyle = TINTA_SUAVE; c.lineWidth = .5; c.beginPath(); c.arc(x, y, r, entre(0, 3), entre(4, 6.2)); c.stroke(); }
  function pastito(x, y, s = 3) { c.strokeStyle = "rgba(96,110,60,.7)"; c.lineWidth = .8; c.beginPath();
    c.moveTo(x - s, y - s * .8); c.lineTo(x, y); c.lineTo(x + s * .9, y - s); c.stroke(); }
  // grilla de plantas a lo largo del lado más largo del lote, recortada con un margen del borde
  function grilla(pts, paso, fila, margen, fn) {
    const ang = ejeLargo(pts), [cx, cy] = centroide(pts), cos = Math.cos(ang), sin = Math.sin(ang);
    const R = Math.max(...pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
    for (let v = -R; v <= R; v += fila) for (let u = -R; u <= R; u += paso) {
      const x = cx + u * cos - v * sin + entre(-.6, .6), y = cy + u * sin + v * cos + entre(-.6, .6);
      if (dentro([x, y], pts) && distBorde([x, y], pts) > margen) fn(x, y);
    }
  }
  // franjas paralelas (surcos, hileras) recortadas al lote
  function franjas(pts, sep, color, ancho, alfa = 1, puntos = null) {
    const ang = ejeLargo(pts), [cx, cy] = centroide(pts), cos = Math.cos(ang), sin = Math.sin(ang);
    const R = Math.max(...pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
    c.save(); caminoDe(pts); c.clip();
    for (let v = -R + sep / 2; v <= R; v += sep) {
      const a = [cx - R * cos - v * sin, cy - R * sin + v * cos], b = [cx + R * cos - v * sin, cy + R * sin + v * cos];
      lineaMano([a, b], color, ancho, alfa, .35);
      if (puntos) for (let u = -R; u <= R; u += puntos.paso) { const x = cx + u * cos - v * sin, y = cy + u * sin + v * cos;
        if (azar() < puntos.prob) { c.fillStyle = puntos.color; c.beginPath(); c.arc(x, y, puntos.r, 0, 6.283); c.fill(); } }
    }
    c.restore();
  }

  // ---------- Papel ----------
  c.fillStyle = PAPEL; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { // manchas suaves del papel
    const x = entre(0, W), y = entre(0, H), r = entre(120, 380), g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, azar() < .5 ? "rgba(214,196,160,.16)" : "rgba(255,252,240,.2)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 60000; i++) { c.fillStyle = azar() < .5 ? "rgba(120,96,60,.06)" : "rgba(255,255,255,.08)"; c.fillRect(entre(0, W), entre(0, H), 1, 1); } // grano
  for (let i = 0; i < 160; i++) { const x = entre(0, W), y = entre(0, H), l = entre(4, 16), a = entre(0, 3.14); // fibras
    c.strokeStyle = "rgba(150,125,90,.08)"; c.lineWidth = .6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  const vin = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
  vin.addColorStop(0, "rgba(0,0,0,0)"); vin.addColorStop(1, "rgba(110,80,40,.22)"); c.fillStyle = vin; c.fillRect(0, 0, W, H);

  // ---------- Mapa ----------
  c.save(); c.beginPath(); c.rect(caja.x, caja.y, caja.w, caja.h); c.clip();
  const lineas = (pref) => GEO.filter((f) => f.geometry.type === "LineString" && String(f.properties.id).startsWith(pref));
  // campo de afuera: apenas unas parcelas sugeridas con trazo de lápiz alrededor del predio (sin nombres ni datos)
  // sombra suave del predio sobre el papel, para que se despegue
  c.save(); c.shadowColor = "rgba(90,70,40,.35)"; c.shadowBlur = 22; c.shadowOffsetX = 4; c.shadowOffsetY = 7;
  sectores.forEach((f) => { caminoDe(anillo(f)); c.fillStyle = "#ebe6c8"; c.fill(); }); c.restore();

  // sectores del predio: tierra clara con lavado y doble línea de tinta
  sectores.forEach((f) => { const pts = anillo(f); acuarela(pts, f.properties.paisaje === "monte" ? "#ede0bd" : "#e9e7c6", .5, 3, 2.5); });
  // monte abierto del sector 3: árboles nativos, matas y pasto sueltos (fuera de los lotes)
  const lotes = GEO.filter((f) => f.properties.tipo === "lote" && f.geometry.type === "Polygon");
  const ptsLotes = lotes.map(anillo);
  const enLote = (p) => ptsLotes.some((q) => dentro(p, q));
  sectores.filter((f) => f.properties.paisaje === "monte").forEach((f) => {
    const pts = anillo(f);
    for (let i = 0; i < 2600; i++) { const [cx, cy] = centroide(pts), R = 260;
      const p = [cx + entre(-R, R), cy + entre(-R, R)];
      if (!dentro(p, pts) || enLote(p) || distBorde(p, pts) < 4) continue;
      const t = azar(); if (t < .05) arbol(p[0], p[1], entre(2.6, 4.2), COPA.nativo); else if (t < .14) mata(p[0], p[1], entre(1, 1.8)); else if (t < .2) pastito(p[0], p[1], 2.2);
    }
  });

  // lotes: acuarela del cultivo y su contenido
  lotes.forEach((f, idx) => {
    const p = f.properties, pts = anillo(f), cult = p.cultivo || "", ed = p.patron === "edificio";
    if (ed) return; // los edificios van después, encima de todo
    acuarela(pts, LAVADO[cult] || "#e4e0bc", .5, 3, 1.6);
    const arboles = { olivo: [10, 10, 3.1], naranja: [9.5, 9.5, 3.2], lima: [9.5, 9.5, 3.1], nogal: [13, 13, 4.5], pecan: [13, 13, 4.5],
      almendra: [10, 10, 3.3], higo: [10, 10, 3.4], frutal: [10, 10, 3.4] }[cult]?.map((v) => v * T);
    if (arboles) {
      const copa = COPA[cult], frutos = cult === "naranja" ? "#e8962e" : cult === "lima" ? "#c6d34a" : null;
      grilla(pts, arboles[0], arboles[1], arboles[2] * .9, (x, y) => arbol(x, y, arboles[2] * entre(.85, 1.1), cult === "frutal" ? [COPA.naranja, COPA.almendra, COPA.higo][Math.floor(azar() * 3)] : copa, { frutos }));
    } else if (cult === "pecan_joven") grilla(pts, 7, 8, 2, (x, y) => { c.strokeStyle = "rgba(120,95,60,.6)"; c.lineWidth = .7; c.beginPath(); c.arc(x, y, 2.2, 0, 6.283); c.stroke(); arbol(x, y, 1.3, COPA.pecan); });
    else if (cult === "tuna") grilla(pts, 5, 6, 2, (x, y) => { c.fillStyle = "#8fae72"; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(x + entre(-1.5, 1.5), y + entre(-1.5, 1.5), 1.8, 1.1, entre(0, 3), 0, 6.283); c.fill(); } });
    else if (cult === "vid") franjas(pts, 3.4, "#7f8f4c", 1.3, .9, { paso: 3, prob: .5, r: .9, color: "#6d3f6b" });
    else if (cult === "algodon") franjas(pts, 3, "#9aa864", 1.1, .8, { paso: 2.6, prob: .35, r: .8, color: "#fbfaf2" });
    else if (cult === "girasol") franjas(pts, 3.2, "#8a9c52", 1.1, .8, { paso: 3, prob: .6, r: 1.1, color: "#e8b923" });
    else if (cult === "comino") franjas(pts, 2.6, "#97a668", .9, .8, { paso: 3, prob: .3, r: .8, color: "#f6f3e6" });
    else if (cult === "arado") franjas(pts, 3, "#a8885c", .8, .45);
    else if (cult === "pastura") grilla(pts, 4.5, 4.5, 1.5, (x, y) => pastito(x + entre(-1.5, 1.5), y + entre(-1.5, 1.5), 2));
    else if (cult === "monte") grilla(pts, 6, 6, 1.5, (x, y) => { const t = azar(); if (t < .4) arbol(x + entre(-2, 2), y + entre(-2, 2), entre(2.2, 3.8), COPA.nativo); else if (t < .62) mata(x, y, entre(.9, 1.6)); });
    else if (cult === "desmonte") { grilla(pts, 3, 3, 1, (x, y) => { if (azar() < .35) { c.fillStyle = "rgba(150,120,80,.28)"; c.fillRect(x + entre(-1, 1), y + entre(-1, 1), 1, 1); } });
      grilla(pts, 22, 22, 4, (x, y) => { if (azar() < .35) arbol(x + entre(-6, 6), y + entre(-6, 6), entre(2.2, 3.4), COPA.nativo); }); }
    else if (cult === "ganado") { grilla(pts, 4, 4, 2, (x, y) => { if (azar() < .3) { c.fillStyle = azar() < .7 ? "#7a5a3c" : "#f4efe2"; c.beginPath(); c.ellipse(x, y, 1.6, 1, entre(0, 3), 0, 6.283); c.fill(); } }); }
    else if (cult === "estanque") { c.save(); caminoDe(pts); c.clip(); for (let y = Math.min(...pts.map((q) => q[1])); y < Math.max(...pts.map((q) => q[1])); y += 4) {
      const x0 = Math.min(...pts.map((q) => q[0])); c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = .8; c.beginPath();
      for (let x = x0; x < x0 + 60; x += 4) c.quadraticCurveTo(x + 1, y - 1.2, x + 2, y), c.quadraticCurveTo(x + 3, y + 1.2, x + 4, y); c.stroke(); } c.restore(); }
    tinta(pts, { strokeWidth: .7, stroke: TINTA_SUAVE, roughness: .7 });
  });
  // contorno de los sectores (doble línea de tinta, como un plano dibujado)
  sectores.forEach((f) => { const pts = anillo(f); tinta(pts, { strokeWidth: 1.5, roughness: 1 }); tinta(pts, { strokeWidth: .6, roughness: 1.4 }); });

  // caminos internos: senda de tierra punteada
  lineas("camino").forEach((f) => { const pts = f.geometry.coordinates.map(P);
    lineaMano(pts, "#e7d6ac", 4.2, .95, .4); lineaMano(pts, "#9b8060", .8, .7, .5);
    c.save(); c.setLineDash([2, 5]); lineaMano(pts, "#7b6448", .8, .7, .2); c.restore(); });
  lineas("paseo").forEach((f) => lineaMano(f.geometry.coordinates.map(P), "#fbf8ef", 3, .95));
  // calles y rutas: doble línea de tinta con relleno gris lavado
  lineas("calle").forEach((f) => { const pts = f.geometry.coordinates.map(P), asf = f.properties.superficie === "asfalto";
    lineaMano(pts, TINTA, asf ? 6.4 : 5, .85, .5); lineaMano(pts, asf ? "#c9c6bb" : "#e6d4ac", asf ? 4.4 : 3.2, 1, .3); });
  lineas("ruta").forEach((f) => { const pts = f.geometry.coordinates.map(P);
    lineaMano(pts, TINTA, 9, .9, .5); lineaMano(pts, "#b8b4a8", 6.8, 1, .3);
    c.save(); c.setLineDash([7, 7]); lineaMano(pts, "#f8f4e6", 1, .9, .1); c.restore(); });
  // canales de riego (si hay)
  GEO.filter((f) => f.properties.tipo === "canal" && f.geometry.type === "LineString").forEach((f) => { const pts = f.geometry.coordinates.map(P);
    lineaMano(pts, "#6aa7bd", 2.6, .9); lineaMano(pts, "#bfe0e6", 1.2, 1); });

  // edificios: techo con trama a mano y sombra corta
  const TECHO = { tejas: ["#c8724a", "zigzag"], chapa: ["#aeb6bb", "hachure"], vidrio: ["#cfe5e6", "cross-hatch"], losa: ["#e6dcc4", "hachure"] };
  lotes.filter((f) => f.properties.patron === "edificio").forEach((f) => {
    const pts = anillo(f), [col, trama] = TECHO[f.properties.techo] || TECHO.losa;
    c.save(); c.globalCompositeOperation = "multiply"; caminoDe(pts.map(([x, y]) => [x + 2.2, y + 2.6])); c.fillStyle = "rgba(90,75,50,.35)"; c.fill(); c.restore();
    caminoDe(pts); c.fillStyle = col; c.globalAlpha = .9; c.fill(); c.globalAlpha = 1;
    rc.polygon(pts, { stroke: TINTA, strokeWidth: .9, roughness: .8, fill: "rgba(60,45,30,.45)", fillStyle: trama, hachureGap: 2.2, fillWeight: .5, seed: sem() });
  });
  // pozos de agua y estación meteorológica: dibujito chico
  GEO.filter((f) => f.properties.tipo === "servicio" && f.properties.servicio === "pozo").forEach((f) => { const [x, y] = P(f.geometry.coordinates);
    rc.circle(x, y, 7, { stroke: TINTA, strokeWidth: .8, fill: "#8fc6d8", fillStyle: "solid", seed: sem() }); });

  // nombres de cultivos en letra manuscrita sobre los lotes grandes (sin pisarse)
  const NOMBRE = { olivo: "olivos", naranja: "cítricos", lima: "limas", nogal: "nogales", pecan: "pecanes", pecan_joven: "pecanes jóvenes",
    almendra: "almendros", higo: "higueras", frutal: "frutales", vid: "vid", algodon: "algodón", girasol: "girasol", comino: "comino",
    pastura: "pasturas", monte: "monte", desmonte: "desmonte", arado: "", tuna: "tuna", ganado: "corrales", estanque: "estanque" };
  const ocupado = [];
  const libreRect = (r) => !ocupado.some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y);
  // primero se reservan los lugares de las estaciones (después se dibujan)
  const estacionesUb = EST.map((e) => ({ e, f: GEO.find((g) => g.properties.tipo === "estacion" && g.properties.estacion === e.id) })).filter((x) => x.f);
  const badges = estacionesUb.map(({ e, f }) => { const [x, y] = P(f.geometry.coordinates); return { e, x0: x, y0: y, x, y, prov: !!f.properties.provisorio }; });
  for (let it = 0; it < 80; it++) for (let i = 0; i < badges.length; i++) for (let j = i + 1; j < badges.length; j++) { // separar las que se tocan
    const a = badges[i], b = badges[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .1;
    if (d < 34) { const m = (34 - d) / 2, ux = dx / d || 1, uy = dy / d; a.x -= ux * m; a.y -= uy * m; b.x += ux * m; b.y += uy * m; }
  }
  badges.forEach((b) => ocupado.push({ x: b.x - 17, y: b.y - 17, w: 34, h: 34 }));
  c.font = "700 20px Caveat"; c.textAlign = "center"; c.textBaseline = "middle"; const rotulados = new Set();
  lotes.filter((f) => f.properties.patron !== "edificio" && NOMBRE[f.properties.cultivo]).map((f) => ({ f, pts: anillo(f) }))
    .sort((a, b) => area(b.pts) - area(a.pts)).forEach(({ f, pts }) => {
      const txt = NOMBRE[f.properties.cultivo], w = c.measureText(txt).width + 8, [cx, cy] = centroide(pts);
      if (rotulados.has(txt) || area(pts) < w * 22 || !dentro([cx, cy], pts)) return; rotulados.add(txt);
      const r = { x: cx - w / 2, y: cy - 11, w, h: 22 }; if (!libreRect(r)) return; ocupado.push(r);
      c.save(); c.translate(cx, cy); c.rotate(entre(-.06, .06));
      c.lineWidth = 3.5; c.strokeStyle = "rgba(243,234,212,.85)"; c.strokeText(txt, 0, 0); c.fillStyle = "#4d4030"; c.fillText(txt, 0, 0); c.restore();
    });
  // nombres de rutas a lo largo de la línea
  c.font = "700 21px Caveat";
  lineas("ruta").forEach((f) => { const pts = f.geometry.coordinates.map(P); let mejor = null;
    for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]], l = Math.hypot(b[0] - a[0], b[1] - a[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (m[0] > caja.x + 30 && m[0] < caja.x + caja.w - 30 && m[1] > caja.y + 20 && m[1] < caja.y + caja.h - 20 && (!mejor || l > mejor.l)) mejor = { a, b, l, m }; }
    if (!mejor) return; let ang = Math.atan2(mejor.b[1] - mejor.a[1], mejor.b[0] - mejor.a[0]); if (ang > 1.57) ang -= Math.PI; if (ang < -1.57) ang += Math.PI;
    const txt = f.properties.nombre.replace("N° ", ""); c.save(); c.translate(mejor.m[0], mejor.m[1]); c.rotate(ang);
    c.lineWidth = 4; c.strokeStyle = "rgba(243,234,212,.95)"; c.strokeText(txt, 0, -11); c.fillStyle = GRIS; c.fillText(txt, 0, -11); c.restore(); });

  // estaciones: sello redondo del color de su zona, con línea guía si se corrió de su lugar
  const zona = (e) => (C.zonas[e.zona] || { color: MARCA }).color;
  badges.forEach((b) => { if (Math.hypot(b.x - b.x0, b.y - b.y0) > 3) { lineaMano([[b.x0, b.y0], [b.x, b.y]], TINTA, 1.1, .85, .2);
    c.fillStyle = TINTA; c.beginPath(); c.arc(b.x0, b.y0, 2.2, 0, 6.283); c.fill(); } });
  badges.forEach((b) => {
    const col = zona(b.e);
    c.save(); c.globalAlpha = .3; c.fillStyle = "#3a2a1a"; c.beginPath(); c.arc(b.x + 1.8, b.y + 2.4, 15, 0, 6.283); c.fill(); c.restore();
    rc.circle(b.x, b.y, 30, { fill: col, fillStyle: "solid", stroke: "#fffaf0", strokeWidth: 2.6, roughness: .8, seed: sem() });
    rc.circle(b.x, b.y, 31.5, { stroke: TINTA, strokeWidth: .8, roughness: 1.1, seed: sem(), strokeLineDash: b.prov ? [3, 3] : undefined });
    c.font = "26px 'Caveat Brush'"; c.fillStyle = "#fffaf0"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(b.e.numero || "·", b.x, b.y + 1.5);
  });

  // rosa de los vientos y escala, en las esquinas más libres del mapa (lejos del predio y de las rutas)
  const ocupacion = (x, y, w, h) => { let n = 0; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    const p = [x - w / 2 + w * i / 11, y - h / 2 + h * j / 11];
    if (sectores.some((f) => dentro(p, anillo(f)))) n += 3;
    if (GEO.some((f) => f.geometry.type === "LineString" && /^(ruta|calle)/.test(f.properties.id) && f.geometry.coordinates.map(P).some((a, k, arr) => k && distSeg(p, arr[k - 1], a) < 8))) n += 2; }
    return n; };
  const usadas = [];
  function esquina(orden, w, h) {
    const m = 18, cs = [[caja.x + caja.w - w / 2 - m, caja.y + h / 2 + m + 14], [caja.x + w / 2 + m, caja.y + h / 2 + m + 14],
      [caja.x + caja.w - w / 2 - m, caja.y + caja.h - h / 2 - m], [caja.x + w / 2 + m, caja.y + caja.h - h / 2 - m]].filter((_, i) => !usadas.includes(i));
    const todas = [[caja.x + caja.w - w / 2 - m, caja.y + h / 2 + m + 14], [caja.x + w / 2 + m, caja.y + h / 2 + m + 14],
      [caja.x + caja.w - w / 2 - m, caja.y + caja.h - h / 2 - m], [caja.x + w / 2 + m, caja.y + caja.h - h / 2 - m]];
    let mejor = 0, menor = Infinity; todas.forEach((q, i) => { if (usadas.includes(i)) return; const o = ocupacion(q[0], q[1], w, h) + i * .5; if (o < menor) { menor = o; mejor = i; } });
    usadas.push(mejor); return todas[mejor];
  }
  (function rosa(x, y, r) {
    rc.circle(x, y, r * 2, { stroke: TINTA, strokeWidth: .8, roughness: 1.2, seed: sem() });
    rc.polygon([[x, y - r * 1.25], [x + r * .28, y], [x, y + r * .9], [x - r * .28, y]], { stroke: TINTA, strokeWidth: .9, fill: "#c9b48a", fillStyle: "solid", roughness: .8, seed: sem() });
    rc.polygon([[x, y - r * 1.25], [x + r * .28, y], [x, y]], { stroke: TINTA, strokeWidth: .9, fill: ROJO, fillStyle: "solid", roughness: .7, seed: sem() });
    rc.polygon([[x - r * .9, y], [x, y - r * .2], [x + r * .9, y], [x, y + r * .2]], { stroke: TINTA, strokeWidth: .7, fill: "#e8dcc0", fillStyle: "solid", roughness: .8, seed: sem() });
    c.font = "26px 'Caveat Brush'"; c.fillStyle = TINTA; c.textAlign = "center"; c.fillText("N", x, y - r * 1.25 - 14);
  })(...esquina(0, 70, 80), 26);
  function escala(x, y) {
    const m = 100, l = m * esc;
    for (let i = 0; i < 4; i++) rc.rectangle(x + i * l / 4, y, l / 4, 6, { stroke: TINTA, strokeWidth: .8, roughness: .7, fill: i % 2 ? PAPEL : TINTA, fillStyle: "solid", seed: sem() });
    c.font = "19px Caveat"; c.fillStyle = TINTA; c.textAlign = "center"; c.fillText("0", x, y - 9); c.fillText(m + " m", x + l, y - 9);
  }
  c.restore(); // fin del recorte del mapa
  // marco del mapa: doble línea temblada
  rc.rectangle(caja.x, caja.y, caja.w, caja.h, { stroke: TINTA, strokeWidth: 1.4, roughness: 1, seed: sem() });
  rc.rectangle(caja.x - 5, caja.y - 5, caja.w + 10, caja.h + 10, { stroke: TINTA_SUAVE, strokeWidth: .7, roughness: 1.4, seed: sem() });

  // ---------- Encabezado ----------
  const logo = new Image(); logo.src = "../" + C.logoColor; await logo.decode();
  const lw = 360, lh = lw * logo.height / logo.width, lx = 34, ly = 28;
  // etiqueta blanca (el logo color va sobre blanco, tal cual el archivo oficial)
  rc.rectangle(lx - 12, ly - 10, lw + 24, lh + 20, { fill: "#ffffff", fillStyle: "solid", stroke: TINTA_SUAVE, strokeWidth: .8, roughness: 1, seed: sem() });
  c.drawImage(logo, lx, ly, lw, lh);
  c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.font = (F.H > 1500 ? 96 : 82) + "px 'Caveat Brush'"; c.fillStyle = MARCA; c.fillText("Puertas Abiertas", 34, ly + lh + (F.H > 1500 ? 108 : 86));
  c.font = "700 " + (F.H > 1500 ? 40 : 34) + "px Caveat"; c.fillStyle = GRIS;
  c.fillText("EEA Catamarca · Sumalao", 38, ly + lh + (F.H > 1500 ? 156 : 126));
  // fecha en un sello rojo a la derecha
  (function sello() {
    const x = W - 150, y = F.H > 1500 ? 150 : 112, r = F.H > 1500 ? 96 : 84;
    rc.circle(x, y, r * 2, { stroke: ROJO, strokeWidth: 2.4, roughness: 1.3, seed: sem() });
    rc.circle(x, y, r * 1.78, { stroke: ROJO, strokeWidth: 1, roughness: 1.6, seed: sem() });
    c.save(); c.translate(x, y); c.rotate(-.12); c.fillStyle = ROJO; c.textAlign = "center";
    c.font = (r * .78 | 0) + "px 'Caveat Brush'"; c.fillText("3 dic", 0, r * .08);
    c.font = "700 " + (r * .36 | 0) + "px Caveat"; c.fillText("2026", 0, r * .48); c.fillText("70 años", 0, -r * .5); c.restore();
  })();

  // ---------- Leyenda ----------
  const lx0 = W - F.leyenda + 6, ly0 = caja.y + 6;
  c.textAlign = "left"; c.textBaseline = "middle";
  c.font = "46px 'Caveat Brush'"; c.fillStyle = GRIS; c.fillText("Estaciones", lx0, ly0 + 22);
  lineaMano([[lx0, ly0 + 48], [lx0 + 210, ly0 + 46]], ROJO, 2, .9, .8);
  const filas = EST.slice().sort((a, b) => (+a.numero || 99) - (+b.numero || 99));
  const paso = Math.min(F.H > 1500 ? 74 : 56, (caja.h - 230) / filas.length);
  filas.forEach((e, i) => {
    const y = ly0 + 90 + i * paso, col = zona(e);
    rc.circle(lx0 + 18, y, 30, { fill: col, fillStyle: "solid", stroke: "#fffaf0", strokeWidth: 2.2, roughness: .8, seed: sem() });
    c.font = "24px 'Caveat Brush'"; c.fillStyle = "#fffaf0"; c.textAlign = "center"; c.fillText(e.numero || "·", lx0 + 18, y + 1.5);
    c.textAlign = "left"; c.font = "700 " + (F.H > 1500 ? 30 : 27) + "px Caveat"; c.fillStyle = "#3d3226"; c.fillText(e.corto || e.nombre, lx0 + 44, y + 1);
  });
  // zonas
  const yz = ly0 + 90 + filas.length * paso + 12;
  const colZ = F.leyenda >= 340 ? 2 : 1; // en la columna angosta, una zona por renglón
  Object.values(C.zonas).forEach((z, i) => { const x = lx0 + (i % colZ) * 168, y = yz + Math.floor(i / colZ) * 30;
    c.fillStyle = z.color; c.beginPath(); c.arc(x + 8, y, 7, 0, 6.283); c.fill();
    c.font = "21px Caveat"; c.fillStyle = "#4d4030"; c.fillText(z.nombre, x + 22, y + 1); });

  escala(lx0 + 4, yz + Math.ceil(Object.keys(C.zonas).length / colZ) * 30 + 34);
  // historia: invitación en el espacio de abajo
  if (F.H > 1500 && libreAbajo > 120) {
    const y = caja.y + caja.h + (H - F.pie - caja.y - caja.h) / 2;
    c.textAlign = "center"; c.textBaseline = "middle"; c.font = "60px 'Caveat Brush'"; c.fillStyle = GRIS;
    c.fillText("Recorré las " + EST.length + " estaciones", W / 2, y - 26);
    c.font = "700 38px Caveat"; c.fillStyle = MARCA; c.fillText("y completá tu pasaporte de sellos", W / 2, y + 30);
    lineaMano([[W / 2 - 230, y + 62], [W / 2 + 230, y + 58]], ROJO, 2, .9, .8);
  }
  // ---------- Pie ----------
  c.textBaseline = "alphabetic"; c.textAlign = "left"; c.font = "700 30px Caveat"; c.fillStyle = MARCA;
  c.fillText(C.instagram, 36, H - F.pie / 2 + 4);
  c.textAlign = "right"; c.font = "20px Caveat"; c.fillStyle = "#6b5a45";
  c.fillText("Ilustración: Laboratorio AGTECH · INTA EEA Catamarca", W - 34, H - F.pie / 2 + 2);

  window.__listo = true;
})();
