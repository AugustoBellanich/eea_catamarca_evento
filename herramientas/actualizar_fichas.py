"""Pasa datos/estaciones.json (fichas) a datos/estaciones.js, que es lo que lee el sitio.
Correrlo después de editar las fichas: python herramientas/actualizar_fichas.py"""
import json
d = json.load(open("datos/estaciones.json", encoding="utf-8"))
with open("datos/estaciones.js", "w", encoding="utf-8") as js:
    js.write("// Generado por herramientas/actualizar_fichas.py desde estaciones.json. No editar a mano.\nwindow.ESTACIONES = ")
    json.dump(d, js, ensure_ascii=False, indent=1)
    js.write(";\n")
print(len(d["estaciones"]), "fichas -> datos/estaciones.js")
