"""Convierte el KML/KMZ de Google Earth en datos/estaciones.geojson.

Uso: python herramientas/kml_a_geojson.py fuentes/predio.kml   (o .kmz)

Cada elemento del KML se reconoce por su nombre (tabla NOMBRES): qué cultivo es (la frutita que se dibuja)
y, si es parte de una estación, cuál. Varios lotes pueden ser de la misma estación. Lo que no está en la tabla
entra como lote sin frutita y se avisa por pantalla para revisarlo.
"""
import json, os, sys, zipfile, re, unicodedata
import xml.etree.ElementTree as ET

NS = {"k": "http://www.opengis.net/kml/2.2"}

# nombre en Google Earth (sin tildes, minúsculas) -> qué es
# id de estación: se vuelve tocable y lleva medalla. Sin id: lote de contexto (solo se dibuja).
NOMBRES = {
    "eea catamarca":         {"tipo": "predio"},
    "eea catamarca 1/3":     {"tipo": "predio", "nombre": "Sector 1"},
    "eea catamarca 2/3":     {"tipo": "predio", "nombre": "Sector 2"},
    "eea catamarca 3/3":     {"tipo": "predio", "nombre": "Sector 3", "paisaje": "monte"},  # monte abierto: suelo desnudo, pasto y árboles sueltos
    # Lotes y edificios
    "almendros":             {"cultivo": "almendra", "patron": "arboles"},
    "invernadero":           {"cultivo": "sanidad", "patron": "edificio", "techo": "vidrio"},
    "laboratorio de aceite": {"cultivo": "aceite", "patron": "edificio", "techo": "tejas"},
    "vid":                   {"cultivo": "vid", "patron": "hileras"},
    "sum":                   {"cultivo": "charla", "patron": "edificio"},
    "laboratorio suelo":     {"cultivo": "suelo", "patron": "edificio"},
    "nogal":                 {"cultivo": "nogal", "patron": "arboles"},
    "animales":              {"cultivo": "ganado", "patron": "pasto", "nombre": "Corrales"},
    "algodon":               {"cultivo": "algodon", "patron": "surcos", "nombre": "Algodón"},
    "algogon":               {"cultivo": "algodon", "patron": "surcos", "nombre": "Algodón"},
    "girasol perenne":       {"cultivo": "girasol", "patron": "surcos"},
    "pecanes":               {"cultivo": "pecan", "patron": "arboles"},
    "pecanes jovenes":       {"cultivo": "pecan_joven", "patron": "arboles", "nombre": "Pecanes jóvenes"},  # plantines recién implantados
    "citricos":              {"cultivo": "naranja", "patron": "arboles", "nombre": "Cítricos"},
    "lima":                  {"cultivo": "lima", "patron": "arboles"},
    "tuna":                  {"cultivo": "tuna", "patron": "pasto"},
    "olivos":                {"cultivo": "olivo", "patron": "arboles"},
    "olivo":                 {"cultivo": "olivo", "patron": "arboles"},
    "almendro":              {"cultivo": "almendra", "patron": "arboles"},
    "lote con frutal mixto": {"cultivo": "frutal", "patron": "arboles", "nombre": "Frutal mixto"},
    "portainjerto de citricos": {"cultivo": "naranja", "patron": "arboles", "nombre": "Portainjertos de cítricos"},
    "vivero de citricos":    {"cultivo": "naranja", "patron": "surcos", "nombre": "Vivero de cítricos"},
    "ensayo con pasturas nativas": {"cultivo": "pastura", "patron": "pasto", "nombre": "Pasturas nativas"},
    "de mip":                {"cultivo": "edificio", "patron": "edificio", "nombre": "Edificio MIP"},
    "olvios":                {"cultivo": "olivo", "patron": "arboles", "nombre": "Olivos"},
    "higuera":               {"cultivo": "higo", "patron": "arboles"},
    "higueras":              {"cultivo": "higo", "patron": "arboles"},
    "estanque":              {"cultivo": "estanque", "patron": "agua"},
    "de frutales":           {"cultivo": "edificio", "patron": "edificio", "nombre": "Edificio de frutales"},
    "residuos agroquimicos": {"patron": "liso", "nombre": "Residuos agroquímicos"},
    "centro regional catamarca - la rioja": {"cultivo": "edificio", "patron": "edificio", "nombre": "Centro Regional"},
    "eea catamarca (edificio)": {"cultivo": "edificio", "patron": "edificio", "nombre": "Edificio EEA", "techo": "tejas"},
    # Servicios
    "ingreso 1":             {"tipo": "servicio", "servicio": "ingreso", "nombre": "Ingreso"},
    "ingreso 2":             {"tipo": "servicio", "servicio": "ingreso", "nombre": "Ingreso"},
    "ingreso principal":     {"tipo": "servicio", "servicio": "ingreso"},
    "ingreso secundario":    {"tipo": "servicio", "servicio": "ingreso"},
    "ingreso zona 2":        {"tipo": "servicio", "servicio": "ingreso", "nombre": "Ingreso sector 2"},
    "estacion meteorologica inta": {"tipo": "servicio", "servicio": "clima", "nombre": "Estación meteorológica"},
}

# Correcciones de ubicación indicadas por Augusto sobre el mapa (se aplican después de leer el KML).
# 20/11/2026: el ingreso habilitado del Sector 2 es el que queda frente al cruce de la RP 33 con Manuel Soria
# (punta del camino interno que va hacia el algodón), no el del norte.
CORRECCIONES = {
    "ingreso zona 2": [-65.7296176, -28.4724063],
}

def clave(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"\s+", " ", s.strip().lower())
    return re.sub(r"^edificio:? ", "", s)  # "Edificio de MIP" queda "de mip"  # "Edificio: SUM" y "Edificio SUM" valen igual que "SUM"

def coords(txt):
    out = []
    for t in txt.split():
        lon, lat = t.split(",")[:2]
        out.append([round(float(lon), 7), round(float(lat), 7)])
    return out

def leer(ruta):
    if ruta.lower().endswith(".kmz"):
        with zipfile.ZipFile(ruta) as z:
            nombre = next(n for n in z.namelist() if n.lower().endswith(".kml"))
            return ET.fromstring(z.read(nombre))
    return ET.parse(ruta).getroot()

ESTACIONES = None
def estaciones():
    global ESTACIONES
    if ESTACIONES is None:
        ruta = os.path.join(os.path.dirname(__file__), "..", "datos", "estaciones.json")
        ESTACIONES = json.load(open(ruta, encoding="utf-8"))["estaciones"]
    return ESTACIONES

def estacion_de(k):
    """ "estacion 5 · nogal y pecan" -> e5; "estacion · girasol y romero" -> girasol-romero (por número, id o nombre corto)."""
    resto = re.sub(r"^estacion\s*", "", re.sub(r"\(provisori[ao]\)", "", k)).strip(" ·:-")
    m = re.match(r"(\d+)", resto)
    for e in estaciones():
        if m and str(e.get("numero")) == m.group(1):
            return e["id"]
    for e in estaciones():
        if resto in (e["id"], clave(e.get("corto") or ""), clave(e.get("nombre") or "")):
            return e["id"]
    return None

def reconocer(nombre):
    """Qué es un elemento según su nombre en Google Earth: (clave, info) o (clave, None) si no se reconoce."""
    k = clave(nombre)
    if k == "eea catamarca" and re.match(r"(?i)\s*edificio", nombre):
        k = "eea catamarca (edificio)"
    info = NOMBRES.get(k)
    if info is None and k.startswith("camino"):  # "Camino", "Camino principal", etc.: caminos de tierra internos
        info = {"tipo": "camino"}
    if info is None and (k.startswith("ruta") or re.match(r"r[pn] ", k)):  # "Ruta…", "RP N° 33", "RN …": rutas
        info = {"tipo": "ruta"}
    m = re.match(r"calle (asfalto|tierra) ?(.*)", k)
    if info is None and m:  # "Calle asfalto Manuel Soria", "Calle tierra América": calles de afuera del predio
        calle = re.sub(r"(?i)^calle (asfalto|tierra) ?", "", nombre).strip()
        info = {"tipo": "calle", "superficie": m.group(1), "nombre": ("Calle " + calle.title()) if calle else "Calle"}
    if info is None and (k.startswith("paseo") or k.startswith("sendero")):  # paseo peatonal del recorrido
        info = {"tipo": "paseo"}
    if info is None and (k.startswith("canal") or k.startswith("acequia")):  # "Canal…", "Acequia…": riego
        info = {"tipo": "canal"}
    if info is None and k.startswith("estacion"):  # "Estación 5 · Nogal y pecán": punto de la estación (dentro o cerca de su lote)
        eid = estacion_de(k)
        if eid:
            info = {"tipo": "estacion", "estacion": eid}
            if "provisori" in k:
                info["provisorio"] = True
    return k, info

def placemarks(nodo, saltar=False):
    """Recorre los Placemark; los de una carpeta que empieza con "Referencia" se saltean (solo son guía)."""
    for hijo in nodo:
        etiqueta = hijo.tag.split("}")[-1]
        if etiqueta == "Placemark":
            if not saltar:
                yield hijo
        elif etiqueta in ("Document", "Folder", "kml"):
            nombre = (hijo.findtext("k:name", default="", namespaces=NS) or "").strip()
            yield from placemarks(hijo, saltar or (etiqueta == "Folder" and clave(nombre).startswith("referencia")))

def convertir(ruta):
    """Lee el KML/KMZ y devuelve (features, nombres originales en el mismo orden, sin reconocer)."""
    raiz = leer(ruta)
    feats, originales, sin_mapear = [], [], []
    for n, pm in enumerate(placemarks([raiz]), 1):
        nombre = (pm.findtext("k:name", default="", namespaces=NS) or "").strip()
        k, info = reconocer(nombre)
        if info is None:
            sin_mapear.append(nombre)
            info = {"revisar": True}
        pol = pm.find(".//k:Polygon/k:outerBoundaryIs/k:LinearRing/k:coordinates", NS)
        pto = pm.find(".//k:Point/k:coordinates", NS)
        lin = pm.find(".//k:LineString/k:coordinates", NS)
        if pol is not None:
            geom = {"type": "Polygon", "coordinates": [coords(pol.text)]}
        elif pto is not None:
            geom = {"type": "Point", "coordinates": coords(pto.text)[0]}
        elif lin is not None:
            geom = {"type": "LineString", "coordinates": coords(lin.text)}
        else:
            continue
        if info.get("tipo") == "estacion" and geom["type"] != "Point":  # la estación va como punto; un polígono así no cuenta
            sin_mapear.append(nombre + " (las estaciones van como marcador)")
            continue
        if k in CORRECCIONES and geom["type"] == "Point":
            geom = {"type": "Point", "coordinates": CORRECCIONES[k]}
        if info.get("tipo") == "canal" and geom["type"] == "Polygon":  # canal dibujado como superficie: lote de agua
            info = {"cultivo": "estanque", "patron": "agua"}
        tipo = info.get("tipo", "lote")
        props = {"id": {"estacion": "est-%s" % info.get("estacion"), "predio": "predio", "camino": "camino-%d" % n, "ruta": "ruta-%d" % n, "paseo": "paseo-%d" % n, "calle": "calle-%d" % n, "canal": "canal-%d" % n}.get(tipo, "k%d" % n), "tipo": tipo}
        props["nombre"] = info.get("nombre", re.sub(r"(?i)^edificio:?\s*", "", nombre))
        props.update({c: info[c] for c in ("cultivo", "patron", "estacion", "servicio", "superficie", "paisaje", "techo", "revisar", "provisorio") if c in info})
        if tipo == "estacion":
            props["nombre"] = nombre
            nota = (pm.findtext("k:description", default="", namespaces=NS) or "").strip()
            if nota:
                props["nota"] = nota
        feats.append({"type": "Feature", "properties": props, "geometry": geom})
        originales.append(nombre)
    # Predio en sectores: id único por sector.
    sectores = [f for f in feats if f["properties"]["tipo"] == "predio"]
    for i, f in enumerate(sectores, 1):
        f["properties"]["id"] = "predio" if len(sectores) == 1 else "predio-%d" % i
    vistas = [f["properties"]["estacion"] for f in feats if f["properties"]["tipo"] == "estacion"]
    for eid in sorted(set(x for x in vistas if vistas.count(x) > 1)):
        print("Aviso: la estación %s tiene más de un punto; el mapa usa el primero." % eid)
    return feats, originales, sin_mapear

def main(ruta, salida="datos/estaciones.geojson"):
    feats, _, sin_mapear = convertir(ruta)
    json.dump({"type": "FeatureCollection", "_fuente": ruta, "features": feats}, open(salida, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    with open("datos/mapa.js", "w", encoding="utf-8") as js:
        js.write("// Generado por herramientas/kml_a_geojson.py. No editar a mano.\nwindow.MAPA = ")
        json.dump({"type": "FeatureCollection", "features": feats}, js, ensure_ascii=False)
        js.write(";\n")
    print(f"{len(feats)} elementos -> {salida} y datos/mapa.js")
    if sin_mapear:
        print("Sin reconocer (entran como lote sin frutita, revisar):", sin_mapear)

if __name__ == "__main__":
    main(*sys.argv[1:])
