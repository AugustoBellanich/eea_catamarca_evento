# Mapa interactivo de eventos · EEA Catamarca (INTA)

Primera edición: **INTA a Puertas Abiertas – 70 años** (Sumalao, 3/12/2026). Todo el sitio lleva la temática
de los 70 años; el repo está armado para reutilizarlo en otros eventos de la EEA (ver "Reutilizar").

Mapa interactivo para la jornada del 3/12/2026. Aporte del Laboratorio AGTECH de la EEA Catamarca.
Sitio estático: HTML, CSS y JS con Leaflet, sin compilar y sin servidor propio.

## Qué hace

- **Mapa ilustrado tipo parque**: lotes dibujados con texturas según el cultivo (árboles, hileras, surcos, pasto,
  edificios), caminos, límite del predio y nombres de zona. Botón para pasar a la imagen satelital.
- **Medallas grandes por estación**: disco del color de la zona con ícono propio, número y cartel. De lejos se
  achican y quedan los nombres de zona; de cerca aparece el cartel.
- **Pasaporte de sellos**: cada estación se sella al escanear su QR o al pasar a menos de 60 m con la ubicación
  activada. Con el recorrido completo, la foto lleva la insignia "Recorrido completo".
- Vista de demostración con lotes inventados: `?demo`.
- "Estás aquí" con el GPS del teléfono y botón "Más cercana".
- Ficha de cada estación; se abre directo con `#e1`, `#e2`… (la 13, Girasol y romero, también con `#girasol-romero`):
  para los QR de cada parada.
- Foto con marco de los 70 años para compartir o descargar. La foto no sale del teléfono.
- Funciona con poca señal después de la primera carga (service worker).

## Archivos

| Archivo | Qué se toca |
|---|---|
| `config.js` | Centro del predio, imagen base, zonas y colores, radio de sello, contacto, Instagram, hashtag, concurso |
| `datos/agenda.js` | Agenda y avisos de respaldo (sin planilla o sin señal) |
| `plantillas/` | Encabezados de la planilla de agenda y avisos |
| `datos/provisorios.js` | Formato viejo de ubicaciones provisorias; hoy vacío (las provisorias son marcadores del KML) |
| `lib/fuentes/` | Tipografía Nunito (licencia SIL OFL), incluida para que ande sin señal |
| `arboles.js` | Dibujo de las plantas por cultivo (marco de plantación, colores de suelo) y de los edificios con volumen |
| `iconos.js` | Íconos de las estaciones (ilustraciones SVG propias, a color) |
| `herramientas/kml_a_geojson.py` | Pasa el KML/KMZ de Google Earth a `datos/estaciones.geojson` |
| `herramientas/kml_editable.py` | Reordena un KML en carpetas y con colores (estaciones, lotes por cultivo, vías, canales), para seguir dibujando en Google Earth |
| `fuentes/` | KML originales |
| `datos/estaciones.json` | Fichas: nombre corto del cartel, ícono, zona, textura (`patron`), textos, foto y `enlaces` (`[{"texto": "Video", "url": "…"}]`). Los `null` se completan con lo que mande cada responsable |
| `datos/demo.geojson` | Lotes inventados, solo para mostrar el estilo |
| `datos/estaciones.geojson` | Ubicación de cada estación (sale del modo editor) |
| `estilos.css` | Colores (el verde es provisorio hasta tener los oficiales de la campaña) |
| `app.js`, `sw.js` | Código; no hace falta tocarlo para cargar contenido |
| `metricas.js`, `functions/api/` | Métricas anónimas y encuesta (ver "Métricas y encuesta") |
| `herramientas/metricas.sql` | Tablas de la base D1 de métricas y consultas de ejemplo |

## Agenda y avisos

Se cargan desde una planilla de Google, así la organización los cambia durante la jornada sin tocar el sitio.

1. Crear una planilla con dos hojas, `Agenda` y `Avisos`, con los encabezados de `plantillas/agenda.csv` y
   `plantillas/avisos.csv` (se pueden importar esos archivos).
   - Agenda: `inicio`, `fin` (HH:MM), `titulo`, `estacion` (número, ej. `6`; vacío si no es de una estación),
     `lugar` (si no es una estación), `descripcion`.
   - Avisos: `hora`, `titulo`, `texto`, `prioridad` (`alta` muestra el cartel arriba del mapa y suma a la campana).
2. Archivo → Compartir → Publicar en la web → elegir la hoja → formato CSV → Publicar. Repetir con la otra hoja.
3. Pegar los dos enlaces en `config.js` (`agendaCSV` y `avisosCSV`).

El sitio consulta la planilla cada minuto y guarda la última versión para cuando no haya señal. Sin enlaces, usa
`datos/agenda.js` (hoy con filas de ejemplo). Un cambio en la planilla puede tardar unos minutos en verse,
porque Google demora en actualizar lo publicado.

## Lotes y estaciones

Desde el 24/11/2026 van separados. El **lote** es el cultivo o el edificio (nombre, cultivo, dibujo) y no cambia aunque deje
de ser parada; tocarlo muestra su nombre. La **estación** es un marcador del KML llamado "Estación N · nombre" (por
número; la que no tiene número, por su nombre: "Estación · Girasol y romero"), puesto dentro o cerca del lote donde se hace
la parada: ahí va la gota, se mide la distancia para el sello y termina "Cómo llegar". Las podadoras de `podaMecanica` se
dibujan en el lote donde está el marcador de esa estación.

## Estaciones con ubicación provisoria

Si el lugar no está confirmado, el marcador lleva "(provisoria)" al final del nombre: en el mapa se ve con borde punteado y
"?" en el número, y la descripción del marcador aparece en la ficha. Al confirmar el lugar, mover el marcador y sacar
"(provisoria)" del nombre.

## Estilo

Estilo visual: mapa ilustrado en paleta oliva: cada lote con su cultivo visto desde arriba —olivos, cítricos con frutitos,
nogales y pecanes, almendros, higueras, tuna, vid en hileras, surcos— plantado en hileras a lo largo del lado más largo
del polígono con un marco típico de cada especie (`arboles.js`, tabla `MARCO`; es ilustrativo, no el marco real del
ensayo), edificios con volumen, el Sector 3 como monte abierto (suelo desnudo, matas y árboles sueltos, como en la satelital),
podadoras moviéndose por la hilera en el lote de la estación de poda (`config.js`, `podaMecanica`; quietas si el
teléfono pide reducir movimiento), el corral
con cabras y ovejas, árboles sueltos y variados en el borde de los tres sectores (sin tapar los ingresos), caminos de tierra que empalman con las rutas y engordan al acercarse —todo se dibuja
sin tocar el KML—, construcciones en arena con sombra corta y paradas como gotas blancas con el número; las
paradas que se tocan en pantalla se juntan en un círculo oliva oscuro con la cantidad, que al tocarlo acerca; las selladas
se apagan y llevan un tilde; al tocar un lote que no es parada aparece su nombre abajo y se va solo.

**Satelital** (para ubicarse con la imagen real; después, con el ortomosaico del dron): sin colores de zona ni vías
dibujadas, solo contornos blancos finos de los lotes y del predio, el nombre chico de cada lote de cerca, y las paradas
y los servicios más chicos. Los recorridos y los avisos de cruce se ven igual.

## Lotes sin cultivo

"Lote vacío" se dibuja como lote arado (surcos de tierra, listo para sembrar); "Monte", como monte nativo (árboles nativos,
matas y claros); "Desmonte", casi todo tierra desnuda con algunos árboles; "Suelo desnudo", tierra sin plantas. La densidad
de cada uno está en `arboles.js` (`SILVESTRE` y `MARCO.arado`).

Otros predios: "Compostaje" con pilas largas de estiércol; "Generadores ESAPEN" como grupos electrógenos sobre ripio (la
cantidad y el tamaño son ilustrativos); "Observatorio climático" como parcela de césped cercada con instrumentos
(`arboles.js`, `MARCO.estiercol`, `MARCO.generadores`, `MARCO.observatorio`).

## Riego y agua

Capa propia (Capas → "Riego y agua", encendida de entrada): canales y acequias, cañerías subterráneas (azul oscuro), pozos de
agua, chimeneas de riego (solo de cerca) y tanques. Los canales y cañerías pasan **por debajo** de rutas, calles y el "Camino interno
principal" (el dibujo se corta en cada cruce; `app.js`, `CORTE` y `esViaPrincipal`) y por encima de los demás caminos
internos y senderos. En el KML van en la carpeta "Riego y agua"; se reconocen por el
nombre: "Canal…", "Acequia…", "Cañería…" (líneas), "Pozo de agua…", "Chimenea de riego…", "Tanque…" (marcadores) y
"Estanque" (polígono, se dibuja siempre como agua).

## Capas

El botón "Capas" (arriba a la derecha) cambia entre ilustrado y satelital y muestra u oculta las estaciones, los ingresos
y servicios, el riego y agua, y los **símbolos de cultivos**: un disco blanco con el dibujo del cultivo sobre cada lote que no es parada
(apagado de entrada; las plantas se ven siempre). Va en todos los lotes cultivados, no en edificios ni en lotes arados, de
monte o desmonte; si en el centro del lote hay una gota, se corre a un lugar libre del mismo lote. Tocar un símbolo muestra
el nombre del lote.

## Caminos

En Google Earth, dibujar cada camino como **ruta** (línea). El nombre dice qué es, y el conversor lo toma solo:

| Nombre empieza con | Qué es | Cómo se dibuja |
|---|---|---|
| "Ruta", "RP" o "RN" | Ruta asfaltada (ej. "RP N° 33") | Gris con borde blanco |
| "Calle asfalto" | Calle asfaltada del barrio (ej. "Calle asfalto Manuel Soria") | Gris claro con borde blanco, más fina |
| "Calle tierra" | Calle de tierra del barrio | Arena fina |
| "Camino" | Camino de tierra interno | Arena con borde sutil y línea central punteada |
| "Paseo" o "Sendero" | Paseo peatonal del recorrido | Blanco hueso |
| "Canal" o "Acequia" | Canal de riego (capa "Riego y agua") | Canal: bordo, agua celeste y brillo; acequia: más fina y suave. Pasan por debajo de rutas, calles y el "Camino interno principal" (cortados en el cruce) y por encima de los demás caminos y senderos; se tocan para ver el nombre. No lo usa "Cómo llegar". Dibujado como polígono, entra como superficie de agua |
| "Cañería" | Cañería de riego subterránea (capa "Riego y agua") | Línea azul oscuro continua, con el mismo criterio de cruces que los canales |

Sin caminos dibujados, la tierra clara del predio que queda entre los lotes ya se lee como camino.

"Cómo llegar" usa estas líneas: arma el recorrido por los caminos internos (desde la ubicación del visitante o, sin GPS,
desde el ingreso principal), usa calles y rutas solo cuando no queda otra y marca con un "!" amarillo cada lugar donde el
recorrido cruza o va junto a una calle o ruta, con el aviso de precaución. Muestra solo los metros (se va caminando). Los sectores con un solo ingreso abierto se
declaran en `config.js` (`accesos`, hoy el Sector 2 por "Ingreso sector 2", ubicado frente al cruce de la RP 33 con
Manuel Soria por corrección en `CORRECCIONES` del conversor): el recorrido entra y sale solo por ahí.
Sin caminos cargados, va en línea recta.

Techos: `"techo": "vidrio"` dibuja un invernadero (naves de vidrio), `"tejas"` un techo terracota a dos aguas (edificio
de la EEA y laboratorio de aceite), `"chapa"` un galpón de chapa gris ondulada con poca pendiente (todo lo que se llama
"Galpón …", secadero, depósito y residuos agroquímicos) y `"losa"` (o nada) un techo plano. Se fija en la tabla `NOMBRES` del
conversor o, para un edificio puntual, escribiendo en su descripción de Google Earth "Techo: chapa" (o tejas, vidrio, losa),
que manda sobre la tabla.
Los "Pecanes jóvenes" de la estación 5 se dibujan como plantines recién implantados (tazón de riego y tutor). Más adelante, con los
caminos cargados, "Cómo llegar" puede seguirlos en lugar de ir en línea recta.

## Métricas y encuesta (anónimas)

Para que la EEA sepa cómo se vivió la jornada, sin juntar datos personales (ni nombre, ni contacto, ni ubicación, ni IP).
Cada teléfono lleva un número al azar para contar visitantes distintos. Si el navegador pide no ser rastreado (Do Not
Track / GPC), no se mandan métricas. El aviso está al pie del pasaporte.

1. **Visitas** (Cloudflare Web Analytics): en Cloudflare → el proyecto de Pages → Metrics → Web Analytics → Enable. No
   requiere código: da visitas, páginas, dispositivos, países y de dónde llegan.
2. **Uso del mapa** (`metricas.js` → `functions/api/eventos.js`): fichas abiertas, QR, sellos (por QR o GPS), recorrido
   completo, "Cómo llegar", lista, agenda, pasaporte, capas, foto (armada, compartida, descargada), Instagram. Los eventos
   se juntan en el teléfono y se mandan de a tandas; sin señal se guardan y se mandan después.
3. **Encuesta** (`config.js`, `encuesta` → `functions/api/encuesta.js`): 9 preguntas de opciones, todas optativas
   (procedencia, perfil, edad, primera visita, cómo se enteró, qué interesó, interés en capacitación o asistencia,
   valoración de la jornada y del mapa). Está en el pasaporte y se ofrece una vez al llegar a 4 estaciones selladas.
   Las preguntas se cambian en `config.js` (los `id` se guardan tal cual: no cambiarlos durante la jornada).

Puesta en marcha (una vez, en Cloudflare, con la cuenta del proyecto de Pages):

1. Workers & Pages → D1 → Create database → nombre `pa70-metricas`.
2. En la consola de la base, pegar y ejecutar `herramientas/metricas.sql`.
3. Proyecto de Pages → Settings → Bindings → Add → D1 database: nombre de variable `DB`, base `pa70-metricas`
   (en Production; también en Preview si se quiere probar en las ramas).
4. Settings → Variables and secrets → Add → `CLAVE_METRICAS`, tipo Secret, con una clave larga (no va en el repo).
5. Volver a publicar (o esperar al próximo cambio en `main`).

Resultados: `https://inta70-catamarca.pages.dev/api/resumen?clave=CLAVE` devuelve los totales (visitantes, eventos,
fichas más vistas, sellos por QR o GPS, personas por hora y la encuesta contada por opción). Para cruces más finos, las
consultas de ejemplo al pie de `herramientas/metricas.sql` se pegan en la consola de D1.
Sin la base enlazada el sitio funciona igual: los eventos quedan guardados en cada teléfono hasta que la base exista.
Plan gratuito: 100.000 escrituras por día en D1 y 100.000 pedidos por día a las funciones; alcanza de sobra para la jornada.

## Logo y colores oficiales

Logos del aniversario 70 (archivos oficiales, sin modificar) en `img/logo-inta70-*.png`: versión blanca sobre
azul (bienvenida y encabezado) y versión color sobre blanco (pin de la vista lejana y marco de la foto). Se eligen
en `config.js` (`logo`, `logoColor`). Colores tomados del logo: azul `#008bd2`, rojo `#e30613`, gris `#3c3c3b`
(`estilos.css`, `--marca`, `--rojo-inta`, `--gris-inta`).

## Niveles de detalle del mapa

Como en los planos de parques: de lejos, solo el pin de INTA; a media distancia, ingresos y paradas; de cerca, los
lotes con su textura, su frutita y su nombre. Cada parada tiene un punto en su lugar y su banderín se ubica en el
primer hueco libre alrededor, unido por una línea guía, para que no se pisen ni se crucen (en la vista inicial
solo el número; después número e ícono; de cerca, también el nombre). Los cortes se cambian en `config.js` (`zoomParadas`, `zoomLotes`).

## Ubicar las estaciones desde Google Earth (recomendado)

El KML vigente es `fuentes/predio-2026-11-25c.kml` (el `25` es el que exportó Augusto con canales, acequias y cañerías, tal cual; el `25b` es ese reordenado; el `25c` saca el sendero del algodón y pone la estación 12 en el punto de encuentro, junto al ingreso del Sector 2): carpetas (predio, estaciones, lotes por cultivo, edificios, servicios,
vías, canales), los colores de cada zona, las correcciones ya aplicadas y, en cada elemento, qué entiende el sitio. Abrirlo en
Google Earth, agregar lo nuevo y exportar la carpeta completa. Para reordenar en carpetas un KML exportado:
`python herramientas/kml_editable.py fuentes/archivo.kml fuentes/salida.kml`. El conversor saltea toda carpeta cuyo nombre
empiece con "Referencia" (para dejar guías que no van al mapa).

1. Dibujar en Google Earth el límite del predio, los lotes, los edificios y los ingresos (marcadores).
2. Exportar la carpeta como KML o KMZ y guardarla en `fuentes/`.
3. `python herramientas/kml_a_geojson.py fuentes/archivo.kmz` → genera `datos/mapa.js` (lo que lee el sitio) y una
   copia en `datos/estaciones.geojson` para abrir en QGIS.
4. Cada elemento se reconoce por su **nombre** (tabla `NOMBRES` del script): ahí se dice qué cultivo o edificio es cada
   lote. Las estaciones son los marcadores "Estación N · …" (ver "Lotes y estaciones"). Lo que no está en la tabla entra
   como lote sin cultivo y el script lo avisa.

## Ubicar las estaciones (modo editor)

Forma vieja (un polígono por estación); se sigue leyendo, pero lo recomendado es el KML con marcadores.

1. Abrir el sitio con `?editar` al final de la dirección (mejor en la computadora).
2. Navegar al predio y tocar **Centrar acá**: copia `centro` y `zoom` para pegar en `config.js`.
3. Dibujar primero el **límite del predio** (polígono) y los **caminos** principales (línea): son el fondo del
   mapa ilustrado.
4. Elegir una estación → **Polígono** → tocar los vértices del lote → **Terminar**.
   Para las que están bajo techo (labs., SUM, galería) usar **Punto**.
5. **Exportar mapa** y reemplazar `datos/mapa.js` con el archivo descargado.

Lo dibujado queda guardado en ese navegador hasta exportarlo.

## Probar en la computadora

Abrir `index.html` con doble clic funciona para ver el mapa y las fichas. El GPS y el modo sin señal necesitan
HTTPS: se prueban ya publicado en Cloudflare (o con `python -m http.server` y `http://localhost:8000`).

Después de editar `datos/estaciones.json` (las fichas), correr `python herramientas/actualizar_fichas.py`.

## Publicar (Cloudflare Pages, carga directa)

1. Cloudflare → Workers & Pages → Create → Pages → *Upload assets*.
2. Nombre del proyecto, por ejemplo `inta70-catamarca` → queda en `https://inta70-catamarca.pages.dev`.
3. Arrastrar la carpeta (o el zip). Para actualizar, *Create deployment* y volver a subir.

HTTPS es obligatorio para el GPS y la cámara: Pages ya lo da.

## Antes de la jornada

- [ ] `centro` real en `config.js` y estaciones dibujadas.
- [x] Cuenta oficial de Instagram: @intacatamarca.
- [ ] Hashtag oficial (Comunicación).
- [ ] Marco oficial de los 70 años (PNG con transparencia) en lugar del marco provisorio de texto.
- [ ] Revisar los términos de uso de la imagen satelital, o reemplazarla por el ortomosaico del dron
      (`gdal2tiles.py --xyz -z 16-20 orto.tif teselas/` y cambiar `teselas.url` a `teselas/{z}/{x}/{y}.png`).
- [ ] Fichas completas (`datos/estaciones.json`).
- [ ] Subir la versión del caché en `sw.js` (`pa70-v1` → `pa70-v2`…) en cada publicación con cambios de código.
- [ ] Prueba en el predio: señal, GPS, sol, QR, foto y compartir en Android y iPhone.

## Publicación

El sitio se publica en Cloudflare Pages conectado a este repo: cada cambio en `main` se publica solo.
Configuración del proyecto en Cloudflare: sin comando de compilación, directorio de salida `/`.
`index.html` lleva `noindex` mientras sea prototipo: quitarlo cuando la organización lo apruebe.

## Reutilizar para otro evento

Sin tocar código:

| Qué cambia | Dónde |
|---|---|
| Nombre, fecha, contacto, Instagram, hashtag, concurso | `config.js` |
| Plano del predio y lotes | KML de Google Earth → `herramientas/kml_a_geojson.py` → `datos/mapa.js` |
| Estaciones (fichas) | `datos/estaciones.json` → `herramientas/actualizar_fichas.py` |
| Ubicación de cada estación (y si es provisoria) | Marcadores "Estación N · …" del KML |
| Agenda y avisos | planilla publicada (`agendaCSV`, `avisosCSV`) o `datos/agenda.js` |
| Zonas y colores | `config.js` (`zonas`) |
| Colores de la interfaz | `estilos.css` (`--marca`) |
| Textos de la bienvenida y el marco de la foto | `index.html` (bienvenida) y `app.js` (`componer`) |

Para un evento nuevo conviene una rama o una carpeta por evento, así esta edición queda como estaba.
