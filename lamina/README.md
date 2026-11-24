# Lámina para redes

Mapa estático de la EEA Catamarca ilustrado "a mano" (papel, acuarela, tinta, letra manuscrita), para compartir en redes.
Se dibuja con los mismos datos del sitio: `datos/mapa.js` (KML convertido), `datos/estaciones.js` y `config.js` (zonas,
logo, Instagram). Si cambia el KML o una ficha, se vuelve a exportar y la lámina sale al día.

- `python lamina/exportar.py` → `lamina/salida/eea-catamarca-feed.png` (1080×1350, publicación) y
  `lamina/salida/eea-catamarca-historia.png` (1080×1920, historia), ambas al doble de resolución (2160 px de ancho).
- Para verla en el navegador: `python -m http.server` en la raíz y abrir `http://localhost:8000/lamina/?formato=feed`.

Qué es real y qué es dibujo: lotes, edificios, caminos, rutas, techos y estaciones son los del KML. Las plantas son
simbólicas (más espaciadas que en el campo para que se lean). La escala gráfica es la del dibujo.

Librerías incluidas (sin internet): rough.js 4.6.6 (MIT, trazo a mano) y tipografía Caveat / Caveat Brush (SIL OFL).
