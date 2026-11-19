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
- Ficha de cada estación; se abre directo con `#e1`, `#e2`… (`#girasol-romero` para la que no tiene número):
  para los QR de cada parada.
- Foto con marco de los 70 años para compartir o descargar. La foto no sale del teléfono.
- Funciona con poca señal después de la primera carga (service worker).

## Archivos

| Archivo | Qué se toca |
|---|---|
| `config.js` | Centro del predio, imagen base, zonas y colores, radio de sello, contacto, Instagram, hashtag, concurso |
| `datos/agenda.js` | Agenda y avisos de respaldo (sin planilla o sin señal) |
| `plantillas/` | Encabezados de la planilla de agenda y avisos |
| `datos/provisorios.js` | Ubicaciones provisorias de estaciones sin lugar en el KML |
| `lib/fuentes/` | Tipografía Nunito (licencia SIL OFL), incluida para que ande sin señal |
| `iconos.js` | Íconos de las estaciones (ilustraciones SVG propias, a color) |
| `herramientas/kml_a_geojson.py` | Pasa el KML/KMZ de Google Earth a `datos/estaciones.geojson` |
| `fuentes/` | KML originales |
| `datos/estaciones.json` | Fichas: nombre corto del cartel, ícono, zona, textura (`patron`), textos, foto y `enlaces` (`[{"texto": "Video", "url": "…"}]`). Los `null` se completan con lo que mande cada responsable |
| `datos/demo.geojson` | Lotes inventados, solo para mostrar el estilo |
| `datos/estaciones.geojson` | Ubicación de cada estación (sale del modo editor) |
| `estilos.css` | Colores (el verde es provisorio hasta tener los oficiales de la campaña) |
| `app.js`, `sw.js` | Código; no hace falta tocarlo para cargar contenido |

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

## Estaciones con ubicación provisoria

`datos/provisorios.js` pone en el mapa, marcadas como provisorias (borde punteado y "?" en el número), las
estaciones que todavía no están en el KML. Apenas una estación tiene su lote en el KML, la provisoria deja de
usarse sola. Para cambiar un lugar provisorio, editar sus coordenadas en ese archivo.

## Capas

El botón "Capas" (arriba a la derecha) cambia entre ilustrado y satelital y muestra u oculta estaciones, lotes y
cultivos, e ingresos y servicios. Con las estaciones apagadas queda solo el plano de la EEA con cada lote.

## Caminos

En Google Earth, dibujar cada camino como **ruta** (línea) con un nombre que empiece con "Camino" ("Camino",
"Camino principal"…). El conversor los toma solos y el modo ilustrado los dibuja como calles. Más adelante, con los
caminos cargados, "Cómo llegar" puede seguirlos en lugar de ir en línea recta.

## Logo oficial

Cuando Comunicación lo envíe: guardarlo en `img/` y poner la ruta en `config.js` (`logo`). Aparece en la bienvenida.

## Niveles de detalle del mapa

Como en los planos de parques: de lejos, solo el pin de INTA; a media distancia, ingresos y paradas; de cerca, los
lotes con su textura, su frutita y su nombre. Cada parada tiene un punto en su lugar y su banderín se ubica en el
primer hueco libre alrededor, unido por una línea guía, para que no se pisen ni se crucen (en la vista inicial
solo el número; después número e ícono; de cerca, también el nombre). Los cortes se cambian en `config.js` (`zoomParadas`, `zoomLotes`).

## Ubicar las estaciones desde Google Earth (recomendado)

1. Dibujar en Google Earth el límite del predio, los lotes, los edificios y los ingresos (marcadores).
2. Exportar la carpeta como KML o KMZ y guardarla en `fuentes/`.
3. `python herramientas/kml_a_geojson.py fuentes/archivo.kmz` → genera `datos/mapa.js` (lo que lee el sitio) y una
   copia en `datos/estaciones.geojson` para abrir en QGIS.
4. Cada elemento se reconoce por su **nombre** (tabla `NOMBRES` del script): ahí se dice qué lote es cada
   estación. Lo que no está en la tabla entra como lote de contexto y el script lo avisa.

## Ubicar las estaciones (modo editor)

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
- [ ] Cuenta oficial de Instagram y hashtag (Comunicación).
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
| Ubicaciones provisorias | `datos/provisorios.js` |
| Agenda y avisos | planilla publicada (`agendaCSV`, `avisosCSV`) o `datos/agenda.js` |
| Zonas y colores | `config.js` (`zonas`) |
| Colores de la interfaz | `estilos.css` (`--marca`) |
| Textos de la bienvenida y el marco de la foto | `index.html` (bienvenida) y `app.js` (`componer`) |

Para un evento nuevo conviene una rama o una carpeta por evento, así esta edición queda como estaba.
