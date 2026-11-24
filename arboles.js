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
    pecan_joven: { fila: 8, planta: 6,  copa: 1.0, tipo: "plantin_arbol" },
    almendra: { fila: 6,   planta: 5,   copa: 2.4, tipo: "almendro" },
    higo:     { fila: 6,   planta: 5,   copa: 2.6, tipo: "higuera" },
    frutal:   { fila: 6,   planta: 5,   copa: 2.3, tipo: "mixto" },
    tuna:     { fila: 3.5, planta: 2.2, copa: 1.1, tipo: "tuna" },
    vid:      { fila: 2.6, planta: 1.3, copa: 0.75, tipo: "vid", hilera: true },
    algodon:  { fila: 1.4, planta: 0.9, copa: 0.45, tipo: "cultivo", hilera: true },
    girasol:  { fila: 1.6, planta: 1.0, copa: 0.55, tipo: "girasol", hilera: true },
    vivero:   { fila: 1.8, planta: 1.1, copa: 0.5, tipo: "plantin", hilera: true },
    pastura:  { fila: 3.6, planta: 3.6, copa: 0.8, tipo: "pradera", azar: true },
    ganado:   { fila: 6,   planta: 6,   copa: 0.6, tipo: "corral", corral: true },
    comino:   { fila: 1.2, planta: 0.7, copa: 0.3, tipo: "cultivo", hilera: true },
    arado:    { fila: 1.4, planta: 1.0, copa: 0.25, tipo: "arado", hilera: true, surcos: true }, // solo surcos, sin plantas
  };
  // Monte nativo y desmonte: sin marco de plantación; árboles nativos, matas y claros sueltos (ver Capa.initialize).
  const SILVESTRE = {
    monte:    { claros: [26, .45, 5, 9],  arboles: [11, .62], matas: [5, .4] },   // [paso m, probabilidad, radio mín., variación]
    desmonte: { claros: [16, .9, 8, 12],  arboles: [28, .22], matas: [9, .14] },
  };
  // Color de suelo de cada lote (debajo de las plantas).
  const SUELO = {
    olivo: "#DCDDBC", naranja: "#E7D9B0", lima: "#E7D9B0", nogal: "#D5DBB5", pecan: "#D5DBB5", pecan_joven: "#E3D6AE", almendra: "#E3DBB2",
    higo: "#DADDB8", frutal: "#E1DBB4", tuna: "#E4DAB2", vid: "#E6D8AE", algodon: "#E8DAAC", girasol: "#E6D8AA",
    vivero: "#E5D8AE", pastura: "#C8D49B", ganado: "#E2CFA2",
    arado: "#DCC69C", comino: "#E4D8AC", monte: "#D3D6A8", desmonte: "#E6D3A6",
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
  function plantar(f, libre) {
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
        const ok = dentro(px, py, loc) && distBorde(px, py, loc) > margen && (!libre || libre(aLatLng(px, py)));
        if (ok) {
          if (m.azar && azar(px * 3, py * 7) < .35) continue; // pasturas: matas salteadas
          plantas.push({ ll: aLatLng(px, py), r: m.copa * (.82 + azar(px, py * 2) * .36), s: azar(py, px * 3) });
          if (m.hilera) tramo = tramo ? [tramo[0], [px, py]] : [[px, py], [px, py]];
        } else if (tramo) { hileras.push(tramo.map(([a, b]) => aLatLng(a, b))); tramo = null; }
      }
      if (tramo) hileras.push(tramo.map(([a, b]) => aLatLng(a, b)));
    }
    if (m.corral) { // corral: sin plantas; cabras (sobre todo) y algunas ovejas sueltas adentro
      const animales = [];
      for (let i = 0; i < 400 && animales.length < 14; i++) {
        const x = Math.min(...xs) + azar(i, 3.1) * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + azar(7.3, i) * (Math.max(...ys) - Math.min(...ys));
        if (!dentro(x, y, loc) || distBorde(x, y, loc) < 2.5 || animales.some((a) => Math.hypot(a.x - x, a.y - y) < 2.2)) continue;
        animales.push({ x, y, ll: aLatLng(x, y), clase: animales.length % 4 === 3 ? "oveja" : "cabra", rumbo: azar(x, y) * 6.28, s: azar(y, x) });
      }
      return { tipo: "corral", plantas: [], hileras: [], animales, anillo: ll.map(([lng, lat]) => [lat, lng]), copa: 0, lat: lat0, ang };
    }
    if (m.surcos) plantas.length = 0; // lote arado: quedan las franjas de los surcos
    return { tipo: m.tipo, plantas, hileras, copa: m.copa, lat: lat0, ang, fila: m.fila, aLatLng, anillo: ll.map(([lng, lat]) => [lat, lng]) };
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
    // árboles del monte y del borde: formas y verdes distintos (copa ancha y despareja, compacta, o alargada y grisácea)
    nativo(c, x, y, r, s) {
      sombra(c, x, y, r);
      if (s < .4) { for (let i = 0; i < 5; i++) { const a = s * 20 + i * 1.26, d = r * (.35 + azar(s, i) * .25); circ(c, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (.42 + azar(i, s) * .2), "#77874C"); }
        circ(c, x, y, r * .5, "#84935A"); circ(c, x - r * .3, y - r * .3, r * .2, "#A2AF74"); }
      else if (s < .72) { lobulos(c, x, y, r, 3, .58, .35, "#66794A", s * 9); circ(c, x - r * .25, y - r * .25, r * .3, "#82965F"); }
      else { c.save(); c.translate(x, y); c.rotate(s * 6); c.scale(1, .62); lobulos(c, 0, 0, r, 4, .5, .5, "#8A977A", s * 3); circ(c, 0, 0, r * .45, "#9DA98C"); c.restore(); }
    },
    // plantín de pecán recién implantado: tazón de riego, tutor y unas pocas hojas tiernas
    plantin_arbol(c, x, y, r, s) {
      c.fillStyle = "rgba(150,120,80,.35)"; c.beginPath(); c.ellipse(x, y, r * 1.6, r * 1.35, 0, 0, 6.2832); c.fill();
      c.strokeStyle = "rgba(120,95,60,.45)"; c.lineWidth = Math.max(.6, r * .12); c.stroke();
      c.fillStyle = "rgba(78,84,46,.25)"; c.beginPath(); c.ellipse(x + r * .35, y + r * .4, r * .7, r * .55, 0, 0, 6.2832); c.fill();
      for (let i = 0; i < 5; i++) { const a = s * 6 + i * 1.257;
        c.fillStyle = i % 2 ? "#8DB25F" : "#A3C470"; c.beginPath();
        c.ellipse(x + Math.cos(a) * r * .45, y + Math.sin(a) * r * .45, r * .42, r * .2, a, 0, 6.2832); c.fill(); }
      circ(c, x, y, Math.max(.8, r * .16), "#8C6B46"); // tutor
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
  // Trazo de pasto en "v", como en los planos ilustrados.
  function pastito(c, x, y, r, alfa = .55) {
    c.strokeStyle = `rgba(104,128,72,${alfa})`; c.lineWidth = Math.max(1, r * .2); c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(x - r * .75, y - r * .55); c.quadraticCurveTo(x - r * .25, y - r * .1, x - r * .1, y + r * .35);
    c.quadraticCurveTo(x + r * .1, y - r * .3, x + r * .7, y - r * .75); c.moveTo(x - r * .05, y + r * .3); c.lineTo(x + r * .02, y - r * .5); c.stroke();
  }
  DIBUJO.pradera = (c, x, y, r) => pastito(c, x, y, Math.max(3, r * 1.4));
  // Setos: varias copas juntas que forman una sola masa, como una nube (primero todas las sombras, después las copas).
  function seto(c, copas) {
    copas.forEach(({ x, y, r }) => { c.fillStyle = "rgba(70,82,42,.30)"; c.beginPath(); c.ellipse(x + r * .35, y + r * .45, r * 1.02, r * .9, 0, 0, 6.2832); c.fill(); });
    copas.forEach(({ x, y, r }) => circ(c, x, y, r, "#6D884C"));
    copas.forEach(({ x, y, r }) => circ(c, x - r * .22, y - r * .25, r * .62, "#7E9A59"));
    copas.forEach(({ x, y, r }) => circ(c, x - r * .38, y - r * .42, r * .26, "#9DB674"));
  }
  // Color de la franja de cada hilera (debajo de las plantas).
  const FRANJA = { vid: "#B5BF86", cultivo: "#C9C695", girasol: "#C6C291", plantin: "#C2BE8C", arado: "rgba(150,116,74,.5)" };

  // Quita los vértices casi alineados (menos de ~5°), así un edificio dibujado con un punto de más sigue teniendo 4
  // esquinas y lleva su techo a dos aguas.
  function sinAlineados(pts) {
    let q = pts.slice(), cambio = true;
    while (cambio && q.length > 3) {
      cambio = false;
      for (let i = 0; i < q.length; i++) {
        const a = q[(i + q.length - 1) % q.length], b = q[i], c = q[(i + 1) % q.length];
        const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
        const seno = Math.abs(ux * vy - uy * vx) / ((Math.hypot(ux, uy) * Math.hypot(vx, vy)) || 1);
        if (seno < .09 && ux * vx + uy * vy > 0) { q.splice(i, 1); cambio = true; break; }
      }
    }
    return q;
  }
  // Edificios con volumen: paredes hacia abajo a la derecha y techo claro.
  // techo: "vidrio" (invernadero), "tejas" (a dos aguas, terracota), "chapa" (galpón: dos aguas bajas, metálico y ondulado);
  // "losa" o sin dato, techo plano claro.
  function edificio(c, pts, alto, techo) {
    const vidrio = techo === "vidrio";
    if (vidrio) alto *= .75;
    const top = pts.map(([x, y]) => [x, y - alto]);
    const poli = (q, col, borde) => { c.fillStyle = col; c.beginPath(); q.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
      if (borde) { c.strokeStyle = borde; c.stroke(); } };
    c.fillStyle = vidrio ? "rgba(78,84,46,.16)" : "rgba(78,84,46,.28)";
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x + alto * .8, y + alto * .5) : c.moveTo(x + alto * .8, y + alto * .5))); c.fill();
    for (let i = 0; i < pts.length; i++) { // paredes
      const a = pts[i], b = pts[(i + 1) % pts.length];
      poli([a, b, [b[0], b[1] - alto], [a[0], a[1] - alto]], vidrio ? "rgba(196,222,222,.75)" : techo === "tejas" ? "#D8C8A8" : techo === "chapa" ? "#B4B2A6" : "#B9A98A");
    }
    c.lineWidth = 1;
    if (pts.length !== 4 || !techo || techo === "losa") { poli(top, techo === "chapa" ? "#C4CACD" : "#E4D8C0", techo === "chapa" ? "#8E979C" : "#A99878"); return; }
    // lado largo del techo: las cumbreras y las naves van a lo largo
    const largo = (i) => Math.hypot(top[(i + 1) % 4][0] - top[i][0], top[(i + 1) % 4][1] - top[i][1]);
    const s0 = largo(0) >= largo(1) ? 0 : 1;
    const [a, b, d, e] = [top[s0], top[(s0 + 1) % 4], top[(s0 + 2) % 4], top[(s0 + 3) % 4]]; // a-b y d-e largos
    const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    if (vidrio) { // invernadero: naves de vidrio en arco, con estructura blanca
      poli(top, "rgba(214,236,236,.92)", "#FFFFFF");
      const naves = Math.max(2, Math.min(6, Math.round(largo((s0 + 1) % 4) / 14)));
      for (let k = 0; k < naves; k++) {
        const p0 = mix(a, e, k / naves), p1 = mix(b, d, k / naves), q0 = mix(a, e, (k + 1) / naves), q1 = mix(b, d, (k + 1) / naves);
        const m0 = mix(p0, q0, .5), m1 = mix(p1, q1, .5);
        c.fillStyle = "rgba(255,255,255,.55)"; c.beginPath(); c.moveTo(...mix(p0, m0, .35)); c.lineTo(...mix(p1, m1, .35)); c.lineTo(...mix(p1, m1, .6)); c.lineTo(...mix(p0, m0, .6)); c.closePath(); c.fill();
        c.strokeStyle = "rgba(150,180,180,.8)"; c.beginPath(); c.moveTo(...m0); c.lineTo(...m1); c.stroke(); // cumbrera de la nave
        if (k) { c.strokeStyle = "#FFFFFF"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.stroke(); c.lineWidth = 1; }
      }
      const arcos = Math.max(3, Math.round(largo(s0) / 6)); // arcos de la estructura
      c.strokeStyle = "rgba(255,255,255,.75)";
      for (let k = 1; k < arcos; k++) { c.beginPath(); c.moveTo(...mix(a, b, k / arcos)); c.lineTo(...mix(e, d, k / arcos)); c.stroke(); }
      return;
    }
    if (techo === "chapa") { // galpón: dos aguas con poca pendiente, chapa gris con ondas que bajan de la cumbrera al alero
      const sube = alto * .3, r1 = mix(b, d, .5), r2 = mix(e, a, .5);
      const c1 = [r1[0], r1[1] - sube], c2 = [r2[0], r2[1] - sube];
      poli([b, c1, d], "#B9BDB8"); poli([e, c2, a], "#B9BDB8");
      const f1 = [a, b, c1, c2], f2 = [d, e, c2, c1];
      const yMedio = (q) => q.reduce((t, p) => t + p[1], 0) / q.length;
      const [arriba, abajo] = yMedio(f1) < yMedio(f2) ? [f1, f2] : [f2, f1];
      poli(arriba, "#D3D8DB", "#8E979C"); poli(abajo, "#B3BBC0", "#848D92");
      [arriba, abajo].forEach(([p, q, r, s2]) => { // ondas: perpendiculares a la cumbrera
        const ondas = Math.max(6, Math.min(90, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2.2)));
        c.strokeStyle = "rgba(90,100,105,.35)"; c.lineWidth = .7;
        for (let k = 1; k < ondas; k++) { c.beginPath(); c.moveTo(...mix(p, q, k / ondas)); c.lineTo(...mix(s2, r, k / ondas)); c.stroke(); }
      });
      c.strokeStyle = "#7E878C"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(...c1); c.lineTo(...c2); c.stroke(); c.lineWidth = 1; // cumbrera
      return;
    }
    // tejas a dos aguas: cumbrera elevada en el medio, dos faldones y hastiales
    const sube = alto * .7, r1 = mix(b, d, .5), r2 = mix(e, a, .5);
    const c1 = [r1[0], r1[1] - sube], c2 = [r2[0], r2[1] - sube];
    poli([b, c1, d], "#CDBB98"); poli([e, c2, a], "#CDBB98"); // hastiales
    const faldon1 = [a, b, c1, c2], faldon2 = [d, e, c2, c1];
    const yMedio = (q) => q.reduce((t, p) => t + p[1], 0) / q.length;
    const [arriba, abajo] = yMedio(faldon1) < yMedio(faldon2) ? [faldon1, faldon2] : [faldon2, faldon1];
    poli(arriba, "#C8724A", "#9E4E2C"); poli(abajo, "#AE5835", "#8E4426");
    [arriba, abajo].forEach(([p, q, r, s2]) => { // hileras de tejas, paralelas a la cumbrera, y juntas cortas
      c.strokeStyle = "rgba(110,45,20,.45)"; c.lineWidth = .8;
      const filas = Math.max(3, Math.round(Math.hypot(r[0] - q[0], r[1] - q[1]) / 3));
      for (let k = 1; k < filas; k++) { c.beginPath(); c.moveTo(...mix(p, s2, k / filas)); c.lineTo(...mix(q, r, k / filas)); c.stroke(); }
      const cols = Math.max(4, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 3));
      c.strokeStyle = "rgba(110,45,20,.25)";
      for (let j2 = 1; j2 < cols; j2++) { const e0 = mix(p, q, j2 / cols), e1 = mix(s2, r, j2 / cols); c.beginPath(); c.moveTo(...e0); c.lineTo(...mix(e0, e1, .5)); c.stroke(); }
    });
    c.strokeStyle = "#7E3A1F"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(...c1); c.lineTo(...c2); c.stroke(); // cumbrera
  }

  // Función "este punto está libre": dentro de algún anillo permitido (opcional), fuera de los lotes y a más de d metros
  // de rutas, calles y caminos.
  function hacerLibre(anillosLotes, lineas, lat0) {
    const k = mLng(lat0);
    const segs = lineas.flatMap((l) => l.geometry.coordinates.slice(1).map((b, i) => [l.geometry.coordinates[i], b]));
    const lejos = (lng, lat, d) => segs.every(([a, b]) => {
      const ax = a[0] * k, ay = a[1] * M_LAT, dx = b[0] * k - ax, dy = b[1] * M_LAT - ay, px = lng * k, py = lat * M_LAT;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-9)));
      return Math.hypot(px - ax - t * dx, py - ay - t * dy) > d;
    });
    return (lng, lat, d) => !anillosLotes.some((a) => dentro(lng, lat, a)) && lejos(lng, lat, d);
  }

  // Vehículos vistos desde arriba, mirando hacia +x. Medidas en metros (largo, ancho); se dibujan con un mínimo legible.
  function vehiculo(c, x, y, ang, esc, clase) {
    const e = Math.max(esc, 6.5); // al menos 6,5 px por metro para que se reconozca
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(e, e);
    c.fillStyle = "rgba(60,60,30,.28)"; c.fillRect(-1.6, -0.9, 4, 2.2); // sombra
    const cuerpo = clase === "podadora" ? "#D9962B" : "#B9473A";
    c.fillStyle = "#3D3D38"; c.fillRect(-1.9, -1.25, 1.3, .45); c.fillRect(-1.9, .8, 1.3, .45); // ruedas traseras
    c.fillRect(.9, -1.0, .8, .3); c.fillRect(.9, .7, .8, .3);                                   // ruedas delanteras
    c.fillStyle = cuerpo; c.fillRect(-1.5, -.8, 3.4, 1.6);                                       // chasis
    c.fillStyle = "#EFE8D6"; c.fillRect(-1.4, -.65, 1.2, 1.3);                                   // techo de la cabina
    c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(.3, -.5, 1.4, .25);                         // brillo del capó
    if (clase === "podadora") { // barra de corte lateral con discos
      c.fillStyle = "#8A8F91"; c.fillRect(-.6, -3.6, .35, 2.9);
      c.fillStyle = "#B7BCBE"; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-.42, -3.4 + i * .75, .38, 0, 6.2832); c.fill(); }
    }
    c.restore();
  }
  // Cabras y ovejas vistas desde arriba.
  function animal(c, x, y, ang, esc, clase, s) {
    const e = Math.max(esc, 7);
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(e, e);
    c.fillStyle = "rgba(60,60,30,.25)"; c.beginPath(); c.ellipse(.15, .2, .62, .36, 0, 0, 6.2832); c.fill();
    if (clase === "oveja") {
      c.fillStyle = "#F5F1E6"; c.beginPath(); c.ellipse(0, 0, .6, .38, 0, 0, 6.2832); c.fill();
      c.fillStyle = "#EAE3D2"; c.beginPath(); c.arc(-.2, -.08, .2, 0, 6.2832); c.arc(.15, .1, .2, 0, 6.2832); c.fill();
      c.fillStyle = "#4A4440"; c.beginPath(); c.ellipse(.68, 0, .18, .13, 0, 0, 6.2832); c.fill();
    } else {
      const pelo = ["#7A5638", "#3E3631", "#EDE6D8", "#A9784C"][Math.floor(s * 4)];
      c.fillStyle = pelo; c.beginPath(); c.ellipse(0, 0, .55, .26, 0, 0, 6.2832); c.fill();
      c.beginPath(); c.ellipse(.62, 0, .17, .12, 0, 0, 6.2832); c.fill();
      c.strokeStyle = "#5B5045"; c.lineWidth = .06; c.beginPath(); c.moveTo(.6, -.08); c.lineTo(.48, -.2); c.moveTo(.6, .08); c.lineTo(.48, .2); c.stroke();
    }
    c.restore();
  }

  // Detalles del pasto en el terreno abierto del predio (fuera de lotes y de caminos): manchones apenas más verdes,
  // matitas, arbustos chicos y florcitas. Pocos y dispersos, para levantar el dibujo sin llenarlo de textura.
  function detallesPasto(predios, lotes, lineas) {
    const out = { manchas: [], cosas: [] };
    const anillosLotes = lotes.filter((f) => f.geometry.type === "Polygon").map((f) => f.geometry.coordinates[0]);
    predios.forEach((pr) => {
      const anillo = pr.geometry.coordinates[0];
      const lats = anillo.map((c) => c[1]), lngs = anillo.map((c) => c[0]);
      const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2, k = mLng(lat0);
      const segs = lineas.flatMap((l) => l.geometry.coordinates.slice(1).map((b, i) => [l.geometry.coordinates[i], b]));
      const lejosDeCaminos = (lng, lat, d) => segs.every(([a, b]) => {
        const ax = a[0] * k, ay = a[1] * M_LAT, dx = b[0] * k - ax, dy = b[1] * M_LAT - ay, px = lng * k, py = lat * M_LAT;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-9)));
        return Math.hypot(px - ax - t * dx, py - ay - t * dy) > d;
      });
      const libre = (lng, lat, d) => dentro(lng, lat, anillo) && !anillosLotes.some((a) => dentro(lng, lat, a)) && lejosDeCaminos(lng, lat, d);
      const paso = (m) => [m / k, m / M_LAT];
      const [p60x, p60y] = paso(55), [p10x, p10y] = paso(10);
      for (let lng = Math.min(...lngs); lng < Math.max(...lngs); lng += p60x)
        for (let lat = Math.min(...lats); lat < Math.max(...lats); lat += p60y) {
          const x = lng + (azar(lng, lat) - .5) * p60x, y = lat + (azar(lat, lng) - .5) * p60y;
          if (azar(x * 9, y * 5) < .55 && libre(x, y, 10)) out.manchas.push({ ll: [y, x], r: 10 + azar(y, x * 7) * 16, a: azar(x, y * 3) * 3.14 });
        }
      for (let lng = Math.min(...lngs); lng < Math.max(...lngs); lng += p10x)
        for (let lat = Math.min(...lats); lat < Math.max(...lats); lat += p10y) {
          const x = lng + (azar(lng * 3, lat) - .5) * p10x * .9, y = lat + (azar(lat * 3, lng) - .5) * p10y * .9, h = azar(x * 11, y * 13);
          if (h < .3 || !libre(x, y, 4)) continue;
          out.cosas.push({ ll: [y, x], tipo: h < .7 ? "matita" : h < .77 ? "arbusto" : h < .85 ? "flores" : "nada", s: azar(y * 5, x * 5) });
        }
    });
    return out;
  }

  // Sellos: cada planta se dibuja una sola vez por tipo, tamaño (de a 1/4 px) y variante (8), y después se estampa.
  // Con miles de plantas por cuadro, estampar es mucho más rápido que trazar sus círculos uno por uno.
  const sellos = new Map();
  function estampar(c, tipo, dib, x, y, r, s, dpr) {
    const rq = Math.round(r * 4) / 4, sq = (Math.floor(s * 8) + .5) / 8, clave = tipo + "|" + rq + "|" + sq;
    let img = sellos.get(clave);
    if (!img) {
      const m = Math.ceil(rq * 2 + 6); // lugar para la sombra, los lóbulos y el pasto
      img = document.createElement("canvas"); img.width = img.height = 2 * m * dpr; img.m = m;
      const g = img.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); dib(g, m, m, rq, sq);
      if (sellos.size > 4000) sellos.clear();
      sellos.set(clave, img);
    }
    c.drawImage(img, x - img.m, y - img.m, 2 * img.m, 2 * img.m);
  }

  // Margen del lienzo fuera de la pantalla, por lado (0,5 = media pantalla). Igual al de los lienzos SVG de app.js.
  const MARGEN = .5;
  const Capa = L.Layer.extend({
    initialize(features, opciones) {
      this.opciones = opciones || {};
      const lineas = this.opciones.lineas || [], predios = this.opciones.predios || [];
      this.lotes = features.map((f) => ({ f, pl: plantar(f) })).filter((x) => x.pl);
      this.edificios = features.filter((f) => f.properties.patron === "edificio" && f.geometry.type === "Polygon");
      this.pasto = detallesPasto(predios.filter((pr) => !pr.properties.cultivo), features, lineas);
      const anillos = features.filter((f) => f.geometry.type === "Polygon").map((f) => f.geometry.coordinates[0]);
      const lat0 = predios.length ? predios[0].geometry.coordinates[0][0][1] : -28.47, k = mLng(lat0);
      const libre = hacerLibre(anillos, lineas, lat0);
      const enPredio = (lng, lat) => predios.some((pr) => dentro(lng, lat, pr.geometry.coordinates[0]));
      const mover = ([lat, lng], este, norte) => [lat + norte / M_LAT, lng + este / k];
      this.maquinas = [];
      // Podadoras: en el lote donde está el marcador de la estación de poda mecánica (config.js, podaMecanica), entre hileras.
      const poda = this.opciones.poda; // L.LatLng del marcador o null
      this.lotes.filter(({ f, pl }) => poda && f.geometry.type === "Polygon" && dentro(poda.lng, poda.lat, f.geometry.coordinates[0]) && pl.plantas.length && pl.fila).forEach(({ f, pl }) => {
        const anillo = f.geometry.coordinates[0];
        const cLat = pl.plantas.reduce((t, q) => t + q.ll[0], 0) / pl.plantas.length, cLng = pl.plantas.reduce((t, q) => t + q.ll[1], 0) / pl.plantas.length;
        const base = pl.plantas.reduce((m, q) => (Math.hypot(q.ll[0] - cLat, q.ll[1] - cLng) < Math.hypot(m.ll[0] - cLat, m.ll[1] - cLng) ? q : m));
        const perp = [-Math.sin(pl.ang), Math.cos(pl.ang)], largo = [Math.cos(pl.ang), Math.sin(pl.ang)];
        [[.5, -8], [-1.5, 10], [2.5, 4]].forEach(([filas, avance]) => {
          if (this.maquinas.filter((m) => m.clase === "podadora").length >= 2) return;
          const ll = mover(base.ll, perp[0] * pl.fila * filas + largo[0] * avance, perp[1] * pl.fila * filas + largo[1] * avance);
          if (dentro(ll[1], ll[0], anillo)) this.maquinas.push({ ll, ang: pl.ang, clase: "podadora" });
        });
      });
      // Árboles sueltos (no una cortina): en el monte abierto de los sectores con paisaje "monte" y a lo largo del borde
      // de los tres sectores, con huecos, tamaños y formas distintas, lejos de lotes, caminos e ingresos.
      this.sueltos = []; this.tierra = []; this.matas = []; this.setos = [];
      const ingresos = this.opciones.ingresos || [];
      const lejosIngreso = (lng, lat) => ingresos.every((g) => Math.hypot((g[0] - lng) * k, (g[1] - lat) * M_LAT) > 28);
      const sumar = (lng, lat, sem) => { if (enPredio(lng, lat) && libre(lng, lat, 6) && lejosIngreso(lng, lat))
        this.sueltos.push({ ll: [lat, lng], r: 1.6 + azar(sem, lat * 7) * 2.6, s: azar(lng * 5, sem) }); };
      predios.forEach((pr, n) => {
        const anillo = pr.geometry.coordinates[0];
        // borde: cada ~7 m, con huecos, metido 2 a 7 m hacia adentro y a veces de a dos
        for (let i = 0; i < anillo.length - 1; i++) {
          const ax = anillo[i][0] * k, ay = anillo[i][1] * M_LAT, bx = anillo[i + 1][0] * k, by = anillo[i + 1][1] * M_LAT, L2 = Math.hypot(bx - ax, by - ay);
          const ux = (bx - ax) / L2, uy = (by - ay) / L2;
          for (let d = 2; d < L2; d += 6 + azar(i, d) * 4) {
            if (azar(d, i + n * 13) < .38) continue;
            for (const adentro of [3 + azar(d, n) * 4, -3 - azar(n, d) * 4]) { // probar a un lado y al otro (el anillo puede ir en cualquier sentido)
              const x = ax + ux * d - uy * adentro, y = ay + uy * d + ux * adentro;
              if (!dentro(x / k, y / M_LAT, anillo)) continue;
              sumar(x / k, y / M_LAT, d + i);
              if (azar(x, y) < .3) { // a veces un seto: varias copas juntas a lo largo del borde
                const n2 = 3 + Math.floor(azar(y, x * 2) * 4), copas = [];
                for (let j = 0; j < n2; j++) { const lng = (x + ux * j * 2.6 + (azar(j, x) - .5) * 1.6) / k, lat = (y + uy * j * 2.6 + (azar(x, j) - .5) * 1.6) / M_LAT;
                  if (enPredio(lng, lat) && libre(lng, lat, 6) && lejosIngreso(lng, lat)) copas.push({ ll: [lat, lng], r: 1.8 + azar(j, y) * 1.2 }); }
                if (copas.length > 1) this.setos.push(copas);
              }
              break;
            }
          }
        }
        if (pr.properties.paisaje !== "monte") return;
        // monte abierto: manchones de suelo desnudo, matas bajas y árboles dispersos
        const lats = anillo.map((q) => q[1]), lngs = anillo.map((q) => q[0]);
        const recorrer = (m, fn) => { for (let x = Math.min(...lngs) * k; x < Math.max(...lngs) * k; x += m) for (let y = Math.min(...lats) * M_LAT; y < Math.max(...lats) * M_LAT; y += m) fn(x, y); };
        recorrer(30, (x, y) => { const px = x + (azar(x, y) - .5) * 26, py = y + (azar(y, x) - .5) * 26;
          if (azar(px, py) < .6 && dentro(px / k, py / M_LAT, anillo) && libre(px / k, py / M_LAT, 6))
            this.tierra.push({ ll: [py / M_LAT, px / k], r: 7 + azar(py, px) * 12, a: azar(px * 2, py) * 3.1, s: azar(py * 3, px) }); });
        recorrer(24, (x, y) => { const px = x + (azar(x * 2, y) - .5) * 22, py = y + (azar(y * 2, x) - .5) * 22;
          if (azar(px * 3, py) < .42) sumar(px / k, py / M_LAT, px); });
        recorrer(9, (x, y) => { const px = x + (azar(x * 5, y) - .5) * 8, py = y + (azar(y * 5, x) - .5) * 8;
          if (azar(px, py * 3) < .22 && dentro(px / k, py / M_LAT, anillo) && libre(px / k, py / M_LAT, 4))
            this.matas.push({ ll: [py / M_LAT, px / k], r: .7 + azar(py, px * 9) * .7, s: azar(px * 7, py) }); });
      });
      // Lotes de monte nativo y desmonte: claros de tierra, árboles nativos y matas dentro del lote (densidad en SILVESTRE).
      features.filter((f) => SILVESTRE[f.properties.cultivo] && f.geometry.type === "Polygon").forEach((f, n) => {
        const q = SILVESTRE[f.properties.cultivo], anillo = f.geometry.coordinates[0];
        const lats = anillo.map((v) => v[1]), lngs = anillo.map((v) => v[0]);
        const recorrer = (m, fn) => { for (let x = Math.min(...lngs) * k; x < Math.max(...lngs) * k; x += m) for (let y = Math.min(...lats) * M_LAT; y < Math.max(...lats) * M_LAT; y += m) fn(x, y); };
        const adentro = (px, py) => dentro(px / k, py / M_LAT, anillo);
        recorrer(q.claros[0], (x, y) => { const px = x + (azar(x, y + n) - .5) * q.claros[0] * .8, py = y + (azar(y, x + n) - .5) * q.claros[0] * .8;
          if (azar(px, py) < q.claros[1] && adentro(px, py))
            this.tierra.push({ ll: [py / M_LAT, px / k], r: q.claros[2] + azar(py, px) * q.claros[3], a: azar(px * 2, py) * 3.1, s: azar(py * 3, px) }); });
        recorrer(q.arboles[0], (x, y) => { const px = x + (azar(x * 2, y) - .5) * q.arboles[0] * .9, py = y + (azar(y * 2, x) - .5) * q.arboles[0] * .9;
          if (azar(px * 3, py) < q.arboles[1] && adentro(px, py)) this.sueltos.push({ ll: [py / M_LAT, px / k], r: 1.6 + azar(n, py * 7) * 2.8, s: azar(px * 5, py) }); });
        recorrer(q.matas[0], (x, y) => { const px = x + (azar(x * 5, y) - .5) * q.matas[0] * .9, py = y + (azar(y * 5, x) - .5) * q.matas[0] * .9;
          if (azar(px, py * 3) < q.matas[1] && adentro(px, py)) this.matas.push({ ll: [py / M_LAT, px / k], r: .7 + azar(py, px * 9) * .9, s: azar(px * 7, py) }); });
      });
    },
    onAdd(map) {
      this.map = map;
      const pane = map.getPane("arboleda") || map.createPane("arboleda");
      pane.style.zIndex = 410; pane.style.pointerEvents = "none";
      // Lienzo más grande que la pantalla (MARGEN por lado), así al arrastrar con el dedo no aparecen huecos;
      // al acercar o alejar se estira con el mapa en lugar de ocultarse (como los lienzos de Leaflet).
      this.canvas = L.DomUtil.create("canvas", "arboleda leaflet-zoom-animated", pane);
      // las máquinas van en un lienzo aparte, que se redibuja solo para moverlas
      this.lienzoMaq = L.DomUtil.create("canvas", "arboleda leaflet-zoom-hide", pane);
      map.on("moveend zoomend resize", this.dibujar, this);
      map.on("zoomanim", this.estirar, this);
      map.on("zoom", this.estirarAlPellizcar, this);
      this.dibujar();
      const quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      const paso = (t) => { if (!this.map) return; if (!document.hidden) this.dibujarMaquinas(quieto ? 0 : t); this.cuadro = requestAnimationFrame(paso); };
      if (this.maquinas.length) this.cuadro = requestAnimationFrame(paso);
    },
    onRemove(map) {
      map.off("moveend zoomend resize", this.dibujar, this); map.off("zoomanim", this.estirar, this); map.off("zoom", this.estirarAlPellizcar, this);
      cancelAnimationFrame(this.cuadro); this.map = null;
      L.DomUtil.remove(this.canvas); L.DomUtil.remove(this.lienzoMaq);
    },
    // Podadoras que avanzan y retroceden despacio por la hilera (unos 6 m para cada lado, ciclo de ~14 s).
    dibujarMaquinas(t) {
      const map = this.map, size = map.getSize(), dpr = window.devicePixelRatio || 1, cv = this.lienzoMaq;
      if (cv.width !== size.x * dpr || cv.height !== size.y * dpr) { cv.width = size.x * dpr; cv.height = size.y * dpr; cv.style.width = size.x + "px"; cv.style.height = size.y + "px"; }
      L.DomUtil.setPosition(cv, map.containerPointToLayerPoint([0, 0]));
      const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, size.x, size.y);
      const z = map.getZoom();
      if (z < 16.5 || (this.opciones.visible && !this.opciones.visible())) return;
      const esc = 2 ** (z + 8) / (40075016.686 * Math.cos(-28.47 * Math.PI / 180));
      this.maquinas.forEach((m, i) => {
        const fase = t / 14000 * 6.2832 + i * 2.4, d = Math.sin(fase) * 6, k = 111320 * Math.cos(m.ll[0] * Math.PI / 180);
        const ll = [m.ll[0] + Math.sin(m.ang) * d / 110540, m.ll[1] + Math.cos(m.ang) * d / k];
        const p = map.latLngToContainerPoint(ll); // avanza y retrocede sin darse vuelta, para que no salte
        vehiculo(c, p.x, p.y, -m.ang, esc, m.clase);
      });
    },
    // Mientras dura la animación de zoom, el lienzo se escala desde el centro nuevo (mismo cálculo que L.Renderer).
    estirar(e) { this.transformar(e.center, e.zoom); },
    estirarAlPellizcar() { if (!this.map._animatingZoom) this.transformar(this.map.getCenter(), this.map.getZoom()); },
    transformar(centro, zoom) {
      const map = this.map; if (!map || this.zoomDibujo === undefined) return;
      const escala = map.getZoomScale(zoom, this.zoomDibujo);
      const mitad = map.getSize().multiplyBy(.5 + MARGEN);
      const arriba = mitad.multiplyBy(-escala).add(map.project(this.centroDibujo, zoom)).subtract(map._getNewPixelOrigin(centro, zoom));
      L.DomUtil.setTransform(this.canvas, arriba, escala);
    },
    dibujar() {
      const map = this.map, vista = map.getSize(), cv = this.canvas;
      // con margen el lienzo es ~4 veces la pantalla: se limita la resolución para no pasar el tope de memoria de los teléfonos
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const borde = vista.multiplyBy(MARGEN).round(), size = vista.add(borde.multiplyBy(2));
      cv.width = size.x * dpr; cv.height = size.y * dpr; cv.style.width = size.x + "px"; cv.style.height = size.y + "px";
      const origen = map.containerPointToLayerPoint(borde.multiplyBy(-1)); L.DomUtil.setPosition(cv, origen);
      this.centroDibujo = map.getCenter(); this.zoomDibujo = map.getZoom();
      const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, size.x, size.y);
      if (this.opciones.visible && !this.opciones.visible()) return;
      const z = map.getZoom(), lim = map.getBounds().pad(MARGEN + .1);
      const pt = (ll) => map.latLngToContainerPoint(ll).add(borde);
      // pasto: manchones siempre (muy tenues); matitas, arbustos y flores solo de cerca
      const mppP = 40075016.686 * Math.cos(-28.47 * Math.PI / 180) / 2 ** (z + 8), escP = 1 / mppP;
      this.tierra.forEach((m) => { // manchones de suelo desnudo del monte, de borde irregular
        if (!lim.contains(m.ll)) return;
        const p = pt(m.ll), r = m.r * escP; c.fillStyle = "rgba(196,168,118,.30)";
        for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(p.x + Math.cos(m.s * 6 + i * 2) * r * .4, p.y + Math.sin(m.s * 6 + i * 2) * r * .3, r * (.6 + i * .15), r * .45, m.a + i * .5, 0, 6.2832); c.fill(); }
      });
      this.pasto.manchas.forEach((m) => {
        if (!lim.contains(m.ll)) return;
        const p = pt(m.ll), r = m.r * escP;
        c.fillStyle = "rgba(150,175,100,.07)"; // capas superpuestas: el manchón se funde con el terreno, sin borde marcado
        [1, .85, .7, .55, .4].forEach((f) => { c.beginPath(); c.ellipse(p.x, p.y, r * 1.5 * f, r * .95 * f, m.a, 0, 6.2832); c.fill();
          c.beginPath(); c.ellipse(p.x + r * .5, p.y - r * .3, r * .9 * f, r * .6 * f, m.a + .8, 0, 6.2832); c.fill(); });
      });
      if (z >= 17) this.pasto.cosas.forEach((t) => {
        if (!lim.contains(t.ll)) return;
        const p = pt(t.ll);
        if (t.tipo === "matita") {
          if (z < 18 && t.s > .5) return; // de media distancia, menos matitas
          pastito(c, p.x, p.y, Math.max(3, .9 * escP), .45);
        } else if (t.tipo === "arbusto") {
          const r = Math.max(2.6, 1.2 * escP);
          c.fillStyle = "rgba(78,84,46,.25)"; c.beginPath(); c.ellipse(p.x + r * .35, p.y + r * .45, r, r * .85, 0, 0, 6.2832); c.fill();
          circ(c, p.x, p.y, r, "#93AA6C"); circ(c, p.x - r * .3, p.y - r * .3, r * .45, "#AFC387");
        } else if (t.tipo === "flores") {
          const r = Math.max(1, .22 * escP), cols = ["#F6F1DC", "#E9C85B", "#F6F1DC"];
          for (let i = 0; i < 3; i++) { const a = t.s * 6 + i * 2.1; circ(c, p.x + Math.cos(a) * r * 2.2, p.y + Math.sin(a) * r * 2.2, r, cols[i]); }
        }
      });
      this.lotes.forEach(({ pl }) => {
        const mpp = 40075016.686 * Math.cos(pl.lat * Math.PI / 180) / 2 ** (z + 8); // metros por píxel
        const esc = 1 / mpp, dib = DIBUJO[pl.tipo];
        if (pl.hileras.length) {
          c.strokeStyle = FRANJA[pl.tipo] || "#C6C291"; c.lineCap = "round"; c.lineWidth = Math.max(1, pl.copa * 2.3 * esc);
          pl.hileras.forEach(([a, b]) => { const p = pt(a), q = pt(b); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); });
          if (pl.copa * esc < 1) return; // de lejos alcanza con las franjas
        }
        if (pl.tipo === "pradera") { // borde sombreado hacia adentro, como un potrero dibujado
          const q = pl.anillo.map((ll) => pt(ll)); c.save(); c.beginPath(); q.forEach((v, i) => (i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y))); c.closePath(); c.clip();
          c.strokeStyle = "rgba(95,120,60,.06)"; [10, 7, 5, 3.5, 2].forEach((w) => { c.lineWidth = Math.max(w, w * esc); c.stroke(); }); c.restore();
          if (z < 17) return;
        }
        pl.plantas.forEach((t) => {
          if (!lim.contains(t.ll)) return;
          const p = pt(t.ll), r = t.r * esc;
          if (pl.tipo === "pradera") return estampar(c, pl.tipo, dib, p.x, p.y, r, t.s, dpr);
          if (r < 1.6) { circ(c, p.x, p.y, Math.max(.9, r), pl.tipo === "olivo" ? "#8A9B74" : pl.tipo === "citrico" ? "#5C874A" : "#7D9A58"); return; }
          estampar(c, pl.tipo, dib, p.x, p.y, r, t.s, dpr);
        });
      });
      // árboles sueltos (borde de los sectores y monte abierto) y matas bajas
      if (z >= 17) this.matas.forEach((t) => { if (!lim.contains(t.ll)) return; const p = pt(t.ll), r = Math.max(1.6, t.r * escP);
        c.fillStyle = "rgba(78,84,46,.22)"; c.beginPath(); c.ellipse(p.x + r * .3, p.y + r * .4, r, r * .8, 0, 0, 6.2832); c.fill();
        lobulos(c, p.x, p.y, r, 3, .6, .35, t.s < .5 ? "#8E9A62" : "#9AA56E", t.s * 6); });
      this.setos.forEach((copas) => { if (!lim.contains(copas[0].ll)) return;
        seto(c, copas.map((q) => { const p = pt(q.ll); return { x: p.x, y: p.y, r: Math.max(1.2, q.r * escP) }; })); });
      this.sueltos.forEach((t) => { if (!lim.contains(t.ll)) return; const p = pt(t.ll), r = t.r * escP;
        if (r < 1.6) circ(c, p.x, p.y, Math.max(.9, r), "#6F8048"); else DIBUJO.nativo(c, p.x, p.y, r, t.s); });
      // corrales: cerco de madera y animales
      this.lotes.forEach(({ pl }) => {
        if (pl.tipo !== "corral") return;
        const pts = pl.anillo.map((ll) => pt(ll));
        c.lineJoin = "round"; c.strokeStyle = "#8C6B46"; c.lineWidth = Math.max(1.6, .3 * escP); c.setLineDash([]);
        c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.stroke();
        c.strokeStyle = "#C9A878"; c.lineWidth = Math.max(.8, .12 * escP); c.setLineDash([Math.max(3, 1.6 * escP), Math.max(2, 1 * escP)]); c.stroke(); c.setLineDash([]);
        if (z >= 16.5) pl.animales.forEach((a) => { const p = pt(a.ll); animal(c, p.x, p.y, -a.rumbo, escP, a.clase, a.s); });
      });
      const altoEd = Math.max(2, Math.min(9, 2 ** (z - 16) * 2.2));
      this.edificios.forEach((f) => edificio(c, sinAlineados(f.geometry.coordinates[0].slice(0, -1).map(([lng, lat]) => { const p = pt([lat, lng]); return [p.x, p.y]; })), altoEd, f.properties.techo));
    },
  });

  window.Arboleda = { capa: (features, opciones) => new Capa(features, opciones),
    suelo: (p) => (p.paisaje === "monte" ? "#E2D6B2" : SUELO[claveCultivo(p)] || null) };
})();
