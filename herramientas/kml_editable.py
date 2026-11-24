"""Arma un KML para seguir editando el mapa en Google Earth, ordenado en carpetas y con colores.

Uso: python herramientas/kml_editable.py fuentes/predio-2026-11-20.kml   (o .kmz)
Sale: fuentes/predio-editable.kml

Parte del KML que usa el sitio y aplica lo mismo que el conversor (nombres reconocidos, correcciones de
ubicación, estación de cada lote). Cada elemento conserva su nombre original, que es lo que lee el
conversor, y lleva en la descripción qué entendió el sitio. Se edita en Google Earth, se exporta la carpeta
completa como KML o KMZ y se vuelve a pasar por kml_a_geojson.py.

La carpeta "Referencia" (ubicaciones provisorias) es solo guía: el conversor la saltea.
"""
import json, re, sys, os
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(__file__))
from kml_a_geojson import convertir  # noqa: E402

AQUI = os.path.join(os.path.dirname(__file__), "..")

# Colores de config.js (zonas) y del mapa ilustrado. KML usa aabbggrr.
ZONAS = {"frutales": "#2e7d32", "laboratorios": "#00838f", "cultivos": "#e65100", "ganaderia": "#6d4c41", "encuentro": "#8e24aa"}
def kml(hexa, alfa="ff"):
    h = hexa.lstrip("#")
    return alfa + h[4:6] + h[2:4] + h[0:2]

ESTILOS = {
    # id: (color de línea, ancho, color de relleno o None)
    "predio":   ("#ffffff", 2.5, None),
    "lote":     ("#d9e4b8", 1.5, ("#d9e4b8", "55")),
    "edificio": ("#d9ceb9", 1.5, ("#d9ceb9", "99")),
    "agua":     ("#4fb3d9", 1.5, ("#4fb3d9", "88")),
    "revisar":  ("#ff00ff", 2.5, ("#ff00ff", "33")),
    "ruta":     ("#8c9295", 6, None),
    "calle-asfalto": ("#a3a8aa", 4, None),
    "calle-tierra":  ("#e6d4ac", 3, None),
    "camino":   ("#e6d3a8", 3, None),
    "paseo":    ("#faf8f5", 3, None),
    "canal":    ("#2f9fd8", 3, None),
}
for z, col in ZONAS.items():
    ESTILOS["est-" + z] = (col, 3, (col, "66"))

ICONOS = {
    "ingreso": "http://maps.google.com/mapfiles/kml/shapes/arrow.png",
    "servicio": "http://maps.google.com/mapfiles/kml/shapes/info-i.png",
    "provisoria": "http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png",
    "ejemplo": "http://maps.google.com/mapfiles/kml/shapes/water.png",
}

AYUDA = """Mapa del evento de la EEA Catamarca, para seguir dibujando en Google Earth.

El sitio reconoce cada elemento por su NOMBRE (no por la carpeta ni por el color). Las carpetas y los colores
son para ordenarse; al volver a exportar se pueden mover cosas de carpeta sin problema.

Nombres que se reconocen solos:
- Líneas (ruta): "Canal …" o "Acequia …" (canales de riego), "Camino …" (camino de tierra interno),
  "Paseo …" o "Sendero …" (peatonal), "Calle asfalto …", "Calle tierra …", "Ruta …", "RP …", "RN …".
- Lotes y edificios: los nombres de la tabla NOMBRES de herramientas/kml_a_geojson.py (por ejemplo "Olivos",
  "Cítricos", "Higueras", "Edificio: SUM"). Un nombre nuevo entra como lote sin cultivo y queda marcado para revisar
  (carpeta "Sin reconocer", en magenta): hay que sumarlo a la tabla.
- Canal dibujado como polígono: se toma como superficie de agua.

Cuando termines: clic derecho en la carpeta principal → Guardar lugar como → KML o KMZ, guardarlo en fuentes/
y correr: python herramientas/kml_a_geojson.py fuentes/archivo.kml"""

def coord_txt(geom):
    t = geom["type"]
    if t == "Point":
        return "%s,%s,0" % tuple(geom["coordinates"])
    pts = geom["coordinates"][0] if t == "Polygon" else geom["coordinates"]
    return " ".join("%s,%s,0" % (x, y) for x, y in pts)

def geometria(geom):
    t, c = geom["type"], coord_txt(geom)
    if t == "Point":
        return "<Point><coordinates>%s</coordinates></Point>" % c
    if t == "LineString":
        return "<LineString><tessellate>1</tessellate><coordinates>%s</coordinates></LineString>" % c
    return "<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>%s</coordinates></LinearRing></outerBoundaryIs></Polygon>" % c

def placemark(nombre, estilo, geom, desc=""):
    d = "<description>%s</description>" % escape(desc) if desc else ""
    return "<Placemark><name>%s</name>%s<styleUrl>#%s</styleUrl>%s</Placemark>" % (escape(nombre), d, estilo, geometria(geom))

def carpeta(nombre, contenido, desc="", abierta=False):
    d = "<description>%s</description>" % escape(desc) if desc else ""
    return "<Folder><name>%s</name><open>%d</open>%s%s</Folder>" % (escape(nombre), int(abierta), d, "".join(contenido))

def estilos():
    out = []
    for i, (linea, ancho, relleno) in ESTILOS.items():
        poli = "<PolyStyle><color>%s</color></PolyStyle>" % kml(relleno[0], relleno[1]) if relleno else "<PolyStyle><fill>0</fill></PolyStyle>"
        out.append('<Style id="%s"><LineStyle><color>%s</color><width>%s</width></LineStyle>%s</Style>' % (i, kml(linea), ancho, poli))
    for i, href in ICONOS.items():
        out.append('<Style id="%s"><IconStyle><scale>1.1</scale><Icon><href>%s</href></Icon></IconStyle></Style>' % (i, href))
    return "".join(out)

def main(ruta, salida="fuentes/predio-editable.kml"):
    feats, originales, _ = convertir(ruta)
    ests = {e["id"]: e for e in json.load(open(os.path.join(AQUI, "datos/estaciones.json"), encoding="utf-8"))["estaciones"]}
    def etiqueta(eid):
        e = ests.get(eid, {})
        return ("Estación %s · %s" % (e["numero"], e.get("corto") or e["nombre"])) if e.get("numero") else (e.get("corto") or e.get("nombre") or eid)

    grupos = {g: [] for g in ("predio", "estaciones", "lotes", "edificios", "servicios", "rutas", "calles", "caminos", "paseos", "canales", "revisar")}
    for f, nombre in zip(feats, originales):
        p, g = f["properties"], f["geometry"]
        tipo = p["tipo"]
        partes = []
        if p.get("cultivo"): partes.append("Cultivo: " + p["cultivo"])
        if p.get("estacion"): partes.append(etiqueta(p["estacion"]))
        if p.get("nombre") and p["nombre"] != nombre: partes.append("En el mapa: " + p["nombre"])
        desc = " · ".join(partes)
        if tipo == "predio":
            grupos["predio"].append(placemark(nombre, "predio", g, desc))
        elif tipo == "servicio":
            grupos["servicios"].append(placemark(nombre, "ingreso" if p.get("servicio") == "ingreso" else "servicio", g, desc))
        elif tipo in ("ruta", "calle", "camino", "paseo", "canal"):
            estilo = "calle-" + p.get("superficie", "tierra") if tipo == "calle" else tipo
            grupos[{"ruta": "rutas", "calle": "calles", "camino": "caminos", "paseo": "paseos", "canal": "canales"}[tipo]].append(placemark(nombre, estilo, g, desc))
        elif p.get("revisar"):
            grupos["revisar"].append(placemark(nombre, "revisar", g, "Nombre sin reconocer: sumarlo a NOMBRES en kml_a_geojson.py"))
        elif p.get("estacion"):
            zona = ests.get(p["estacion"], {}).get("zona", "frutales")
            grupos["estaciones"].append((etiqueta(p["estacion"]), placemark(nombre, "est-" + zona, g, desc)))
        elif p.get("patron") == "edificio":
            grupos["edificios"].append(placemark(nombre, "edificio", g, desc))
        else:
            grupos["lotes"].append(placemark(nombre, "agua" if p.get("patron") == "agua" else "lote", g, desc))

    # estaciones: una subcarpeta por estación, en orden de número
    def orden(n):
        m = re.match(r"Estación (\d+)", n)
        return int(m.group(1)) if m else 99
    por_est = {}
    for n, pm in grupos["estaciones"]:
        por_est.setdefault(n, []).append(pm)
    est_carpetas = [carpeta(n, pms) for n, pms in sorted(por_est.items(), key=lambda x: orden(x[0]))]

    # referencia: ubicaciones provisorias (el conversor saltea esta carpeta)
    prov = open(os.path.join(AQUI, "datos/provisorios.js"), encoding="utf-8").read()
    prov = json.loads(prov[prov.index("{"):prov.rindex("}") + 1])
    ref = [placemark("Provisoria: " + etiqueta(f["properties"]["estacion"]), "provisoria", f["geometry"],
                     (f["properties"].get("nota", "") + ". Para ubicarla de verdad, dibujar su lote o edificio con el nombre que corresponda (tabla NOMBRES).").strip(". "))
           for f in prov["features"] if f["geometry"]["type"] == "Point"]

    canales_desc = ('Dibujar cada canal o acequia como RUTA (línea) siguiendo su traza, con un nombre que empiece con "Canal" '
                    'o "Acequia" (por ejemplo "Canal principal", "Canal secundario lote olivos", "Acequia norte"). '
                    "El nombre completo aparece al tocarlo en el mapa.")
    cuerpo = [
        carpeta("Predio (sectores)", grupos["predio"]),
        carpeta("Estaciones del recorrido", est_carpetas, "Color de la zona de cada estación (config.js)."),
        carpeta("Lotes y cultivos", grupos["lotes"]),
        carpeta("Edificios", grupos["edificios"]),
        carpeta("Ingresos y servicios", grupos["servicios"]),
        carpeta("Vías", [carpeta("Rutas", grupos["rutas"]), carpeta("Calles", grupos["calles"]),
                         carpeta("Caminos internos", grupos["caminos"]), carpeta("Paseos y senderos", grupos["paseos"])]),
        carpeta("Canales de riego", grupos["canales"], canales_desc, abierta=True),
    ]
    if grupos["revisar"]:
        cuerpo.append(carpeta("Sin reconocer", grupos["revisar"], "Nombres que el sitio no reconoce todavía."))
    cuerpo.append(carpeta("Referencia (no se importa)", [carpeta("Ubicaciones provisorias", ref)],
                          "Guía nomás: el conversor saltea toda carpeta cuyo nombre empiece con Referencia."))
    doc = ('<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>'
           "<name>EEA Catamarca – mapa del evento (editable)</name><open>1</open><description>%s</description>%s%s</Document></kml>\n"
           % (escape(AYUDA), estilos(), "".join(cuerpo)))
    with open(salida, "w", encoding="utf-8") as s:
        s.write(doc)
    print(f"{len(feats)} elementos -> {salida} ({len(ref)} provisorias de referencia)")

if __name__ == "__main__":
    main(*sys.argv[1:])
