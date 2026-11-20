/* Arboleda ilustrada (estilo parque): cada lote se llena con su cultivo visto desde arriba, en hileras orientadas
   según el lado más largo del polígono del KML y con un marco de plantación típico de cada especie. Los edificios se
   dibujan con un poco de volumen. Todo es dibujo: no cambia los datos del KML.
   Uso: const capa = Arboleda.capa(features, opciones).addTo(mapa); */
(function () {
  "use strict";

  // Marco de plantación aproximado (m): entre hileras, entre plantas, radio de copa. Ilustrativo, no un dato del ensayo.
  const MARCO = {
    olivo:    { fila: 7,   planta: 5,   copa: 2.6, tipo: "olivo" },
    naranja:  { fila: 6,   planta: 4,   copa: 2.1, tipo: "citrico" },
    lima:     { fila: 6,   planta: 4,   copa: 2.0, tipo: "citrico" },
    nogal:    { fila: 10,  planta: 9,   copa: 4.4, tipo: "nogal" },
    pecan:    { fila: 10,  planta: 9,   copa: 4.4, tipo: "nogal" },
    almendra: { fila: 6,   planta: 5,   copa: 2.4, tipo: "almendro" },
    higo:     { fila: 6,   planta: 5,   copa: 2.6, tipo: "higuera" },
    frutal:   { fila: 6,   planta: 5,   copa: 2.3, tipo: "mixto" },
    tuna:     { fila: 3.5, planta: 2.2, copa: 1.1, tipo: "tuna" },
    vid:      { fila: 2.6, planta: 1.3, copa: 0.75, tipo: "vid", hilera: true },
    algodon:  { fila: 1.4, planta: 0.9, copa: 0.45, tipo: "cultivo", hilera: true },
    girasol:  { fila: 1.6, planta: 1.0, copa: 0.55, tipo: "girasol", hilera: true },
    vivero:   { fila: 1.8, planta: 1.1, copa: 0.5, tipo: "plantin", hilera: true },
    pastura:  { fila: 3.2, planta: 3.2, copa: 0.7, tipo: "mata", azar: true },
    ganado:   { fila: 6,   planta: 6,   copa: 0.6, tipo: "mata", azar: true },
  };
  // Color de suelo de cada lote (debajo de las plantas).
  const SUELO = {
    olivo: "#DCDDBC", naranja: "#E7D9B0", lima: "#E7D9B0", nogal: "#D5DBB5", pecan: "#D5DBB5", almendra: "#E3DBB2",
    higo: "#DADDB8", frutal: "#E1DBB4", tuna: "#E4DAB2", vid: "#E6D8AE", algodon: "#E8DAAC", girasol: "#E6D8AA",
    vivero: "#E5D8AE", pastura: "#DCE0B4", ganado: "#E3D5AC",
  };
  const claveCultivo = (p) => (p.cultivo === "naranja" && p.patron === "surcos" ? "vivero" : p.cultivo);

  // Número pseudoaleatorio estable por posición (así el dibujo no cambia entre recargas).
  const azar = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

  const M_LAT = 110540, mLng = (lat) => 111320 * Math.cos(lat * Math.PI / 180);

  function dentro(x, y, anillo) {
    let ok = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ok = !ok;
    }
    return ok;
  }
  function distBorde(x, y, anillo) {
    let d = Infinity;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [ax, ay] = anillo[j], [bx, by] = anillo[i], dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9)));
      d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return d;
  }

  // Plantas de un lote: grilla alineada con el lado más largo, recortada al polígono y a un margen del borde.
  function plantar(f) {
    const p = f.properties, m = MARCO[claveCultivo(p)];
    if (!m || f.geometry.type !== "Polygon") return null;
    const ll = f.geometry.coordinates[0].slice(0, -1);
    const lat0 = ll.reduce((t, c) => t + c[1], 0) / ll.length, lng0 = ll.reduce((t, c) => t + c[0], 0) / ll.length, k = mLng(lat0);
    const met = ll.map(([lng, lat]) => [(lng - lng0) * k, (lat - lat0) * M_LAT]);
    let ang = 0, largo = 0;
    met.forEach((a, i) => { const b = met[(i + 1) % met.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > largo) { largo = l; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); } });
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const loc = met.map(([x, y]) => [x * cos + y * sin, -x * sin + y * cos]); // eje x = a lo largo de las hileras
    const xs = loc.map((q) => q[0]), ys = loc.map((q) => q[1]);
    const margen = Math.max(m.copa * 1.1, 0.8);
    const aLatLng = (x, y) => { const gx = x * cos - y * sin, gy = x * sin + y * cos; return [lat0 + gy / M_LAT, lng0 + gx / k]; };
    const plantas = [], hileras = [];
    for (let y = Math.min(...ys) + m.fila / 2; y < Math.max(...ys); y += m.fila) {
      let tramo = null;
      for (let x = Math.min(...xs) + m.planta / 2; x < Math.max(...xs); x += m.planta) {
        const jx = m.azar ? (azar(x, y) - .5) * m.planta * .9 : (azar(x, y) - .5) * m.planta * .08;
        const jy = m.azar ? (azar(y, x) - .5) * m.fila * .9 : (azar(y, x) - .5) * m.fila * .06;
        const px = x + jx, py = y + jy;
        const ok = dentro(px, py, loc) && distBorde(px, py, loc) > margen;
        if (ok) {
          if (m.azar && azar(px * 3, py * 7) < .35) continue; // pasturas: matas salteadas
          plantas.push({ ll: aLatLng(px, py), r: m.copa * (.82 + azar(px, py * 2) * .36), s: azar(py, px * 3) });
          if (m.hilera) tramo = tramo ? [tramo[0], [px, py]] : [[px, py], [px, py]];
        } else if (tramo) { hileras.push(tramo.map(([a, b]) => aLatLng(a, b))); tramo = null; }
      }
      if (tramo) hileras.push(tramo.map(([a, b]) => aLatLng(a, b)));
    }
    return { tipo: m.tipo, plantas, hileras, copa: m.copa, lat: lat0 };
  }

  // ---------- Dibujos vistos desde arriba ----------
  const circ = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };
  const sombra = (c, x, y, r) => { c.fillStyle = "rgba(78,84,46,.30)"; c.beginPath(); c.ellipse(x + r * .38, y + r * .48, r * 1.02, r * .92, 0, 0, 6.2832); c.fill(); };
  function lobulos(c, x, y, r, n, rl, dist, col, giro) {
    for (let i = 0; i < n; i++) { const a = giro + i * 6.2832 / n; circ(c, x + Math.cos(a) * r * dist, y + Math.sin(a) * r * dist, r * rl, col); }
  }
  const DIBUJO = {
    // olivo: copa gris verdosa, rala, de hojitas plateadas
    olivo(c, x, y, r, s) {
      sombra(c, x, y, r);
      lobulos(c, x, y, r, 6, .45, .52, "#8A9B74", s * 6);
      circ(c, x, y, r * .55, "#97A782");
      if (r > 3) { lobulos(c, x - r * .1, y - r * .15, r, 4, .14, .45, "#C2CBA8", s * 9); }
    },
    // cítrico: copa densa, verde oscuro, con frutitos naranja
    citrico(c, x, y, r, s) {
      sombra(c, x, y, r);
      circ(c, x, y, r, "#5C874A");
      circ(c, x - r * .28, y - r * .3, r * .55, "#77A35C");
      if (r > 2.5) { for (let i = 0; i < 3; i++) { const a = s * 9 + i * 2.1; circ(c, x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, Math.max(1, r * .14), "#E9A23B"); } }
    },
    // nogal y pecán: copas grandes y lobuladas
    nogal(c, x, y, r, s) {
      sombra(c, x, y, r);
      lobulos(c, x, y, r, 7, .5, .5, "#6E8E4D", s * 6);
      circ(c, x, y, r * .62, "#7C9C58");
      if (r > 3) { circ(c, x - r * .3, y - r * .32, r * .3, "#9AB571"); circ(c, x + r * .25, y - r * .1, r * .18, "#9AB571"); }
    },
    almendro(c, x, y, r, s) {
      sombra(c, x, y, r);
      lobulos(c, x, y, r, 5, .5, .45, "#8EA962", s * 6);
      circ(c, x, y, r * .55, "#9DB76F");
      if (r > 3) circ(c, x - r * .3, y - r * .3, r * .25, "#B8CC8D");
    },
    // higuera: hojas grandes, copa ancha en 4 lóbulos
    higuera(c, x, y, r, s) {
      sombra(c, x, y, r);
      lobulos(c, x, y, r, 4, .58, .42, "#6C984C", s * 6 + .4);
      circ(c, x - r * .25, y - r * .25, r * .32, "#8CB765");
    },
    mixto(c, x, y, r, s) { (s < .33 ? DIBUJO.citrico : s < .66 ? DIBUJO.almendro : DIBUJO.higuera)(c, x, y, r, s * 3 % 1); },
    // tuna: paletas ovaladas
    tuna(c, x, y, r, s) {
      c.fillStyle = "#93AB76"; c.strokeStyle = "#76905D"; c.lineWidth = Math.max(.6, r * .12);
      for (let i = 0; i < 3; i++) {
        const a = s * 6 + i * 2.1; c.beginPath();
        c.ellipse(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .55, r * .35, a, 0, 6.2832); c.fill(); c.stroke();
      }
    },
    vid(c, x, y, r) { circ(c, x, y, r, "#8AA45B"); if (r > 1.5) circ(c, x - r * .3, y - r * .3, r * .45, "#A6BE76"); },
    cultivo(c, x, y, r) { circ(c, x, y, r, "#9DB26E"); },
    girasol(c, x, y, r) { circ(c, x, y, r, "#94AC63"); if (r > 1.6) circ(c, x, y, r * .45, "#E2B93B"); },
    plantin(c, x, y, r) { circ(c, x, y, r, "#6E9852"); },
    mata(c, x, y, r) { c.strokeStyle = "#8EA466"; c.lineWidth = Math.max(.8, r * .35); c.lineCap = "round"; c.beginPath();
      c.moveTo(x - r, y + r * .6); c.lineTo(x - r * .3, y - r); c.moveTo(x, y + r * .6); c.lineTo(x + r * .1, y - r * 1.1);
      c.moveTo(x + r, y + r * .6); c.lineTo(x + r * .4, y - r * .9); c.stroke(); },
  };
  // Color de la franja de cada hilera (debajo de las plantas).
  const FRANJA = { vid: "#B5BF86", cultivo: "#C9C695", girasol: "#C6C291", plantin: "#C2BE8C" };

  // Edificios con volumen: paredes hacia abajo a la derecha y techo claro.
  function edificio(c, pts, alto) {
    const top = pts.map(([x, y]) => [x, y - alto]);
    c.fillStyle = "rgba(78,84,46,.28)"; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x + alto * .8, y + alto * .5) : c.moveTo(x + alto * .8, y + alto * .5))); c.fill();
    c.fillStyle = "#B9A98A";
    for (let i = 0; i < pts.length; i++) { // cada pared
      const a = pts[i], b = pts[(i + 1) % pts.length];
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0], b[1] - alto); c.lineTo(a[0], a[1] - alto); c.fill();
    }
    c.fillStyle = "#E4D8C0"; c.strokeStyle = "#A99878"; c.lineWidth = 1;
    c.beginPath(); top.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.stroke();
  }

  const Capa = L.Layer.extend({
    initialize(features, opciones) {
      this.opciones = opciones || {};
      this.lotes = features.map((f) => ({ f, pl: plantar(f) })).filter((x) => x.pl);
      this.edificios = features.filter((f) => f.properties.patron === "edificio" && f.geometry.type === "Polygon");
    },
    onAdd(map) {
      this.map = map;
      const pane = map.getPane("arboleda") || map.createPane("arboleda");
      pane.style.zIndex = 410; pane.style.pointerEvents = "none";
      this.canvas = L.DomUtil.create("canvas", "arboleda leaflet-zoom-hide", pane);
      map.on("moveend zoomend resize", this.dibujar, this);
      this.dibujar();
    },
    onRemove(map) { map.off("moveend zoomend resize", this.dibujar, this); L.DomUtil.remove(this.canvas); },
    dibujar() {
      const map = this.map, size = map.getSize(), dpr = window.devicePixelRatio || 1, cv = this.canvas;
      cv.width = size.x * dpr; cv.height = size.y * dpr; cv.style.width = size.x + "px"; cv.style.height = size.y + "px";
      const origen = map.containerPointToLayerPoint([0, 0]); L.DomUtil.setPosition(cv, origen);
      const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, size.x, size.y);
      if (this.opciones.visible && !this.opciones.visible()) return;
      const z = map.getZoom(), lim = map.getBounds().pad(.1);
      const pt = (ll) => map.latLngToContainerPoint(ll);
      this.lotes.forEach(({ pl }) => {
        const mpp = 40075016.686 * Math.cos(pl.lat * Math.PI / 180) / 2 ** (z + 8); // metros por píxel
        const esc = 1 / mpp, dib = DIBUJO[pl.tipo];
        if (pl.hileras.length) {
          c.strokeStyle = FRANJA[pl.tipo] || "#C6C291"; c.lineCap = "round"; c.lineWidth = Math.max(1, pl.copa * 2.3 * esc);
          pl.hileras.forEach(([a, b]) => { const p = pt(a), q = pt(b); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); });
          if (pl.copa * esc < 1) return; // de lejos alcanza con las franjas
        }
        pl.plantas.forEach((t) => {
          if (!lim.contains(t.ll)) return;
          const p = pt(t.ll), r = t.r * esc;
          if (r < 1.6) { circ(c, p.x, p.y, Math.max(.9, r), pl.tipo === "olivo" ? "#8A9B74" : pl.tipo === "citrico" ? "#5C874A" : "#7D9A58"); return; }
          dib(c, p.x, p.y, r, t.s);
        });
      });
      const altoEd = Math.max(2, Math.min(9, 2 ** (z - 16) * 2.2));
      this.edificios.forEach((f) => edificio(c, f.geometry.coordinates[0].slice(0, -1).map(([lng, lat]) => { const p = pt([lat, lng]); return [p.x, p.y]; }), altoEd));
    },
  });

  window.Arboleda = { capa: (features, opciones) => new Capa(features, opciones), suelo: (p) => SUELO[claveCultivo(p)] || null };
})();
