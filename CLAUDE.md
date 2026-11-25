# eea_catamarca_evento — mapa interactivo de eventos de la EEA Catamarca

Sitio estático (HTML, CSS, JS con Leaflet, sin compilar) para guiar a los visitantes de un evento en el predio de
la EEA Catamarca (INTA, Sumalao). Primera edición: **INTA a Puertas Abiertas – 70 años, 3/12/2026**.
Iniciativa de Augusto Bellanich (Laboratorio AGTECH) como aporte a la jornada; no es parte de PROYECTO SENSOR.
La propuesta y su contexto están en `sensor-central/docs/propuestas/mapa-puertas-abiertas.md`.

Leer `README.md` antes de cambiar algo: ahí está qué archivo controla cada cosa.

## Reglas

1. **Augusto decide y revisa.** Nada se presenta ni se difunde a la organización sin su aprobación.
2. **`main` se publica sola** en Cloudflare Pages. Los cambios van en una rama (`tipo/descripcion-corta`) que se
   sube para revisar; unir a `main` requiere autorización de Augusto, salvo que él indique otra cosa.
3. **Contenido institucional chequeable:** las fichas salen de la planilla de estaciones y de lo que envía cada
   responsable. No inventar responsables, vínculos, servicios ni ubicaciones. Lo que falta queda en `null` o como
   ubicación provisoria marcada.
4. **Marca:** temática de los 70 años de INTA. Se usan los logos oficiales del aniversario de `img/` tal como están
   (no se dibujan, recortan ni recolorean). Colores tomados del logo: azul `#008bd2`, rojo `#e30613`, gris `#3c3c3b`.
5. **Datos personales:** el sitio no junta datos personales de los visitantes (nombre, contacto, ubicación, IP). Solo
   métricas de uso anónimas y una encuesta voluntaria y anónima de opciones (aprobado por Augusto el 25/11/2026; ver
   "Métricas y encuesta" en el README). La foto se arma en el teléfono y no se sube.
6. **Sin secretos** en el repo.
7. **Antes de entregar:** probar en un teléfono simulado (Playwright, 390×844) los tres niveles de zoom, una ficha,
   la agenda, el pasaporte y la foto; subir la versión del caché en `sw.js` si cambió código.
8. Idioma: español rioplatense; textos de interfaz cortos y claros.

## Commits

`tipo(área): qué cambió`, en español, en presente, sin punto final. Tipos: `feat`, `fix`, `datos`, `docs`,
`estilo`, `config`. Áreas: `mapa`, `ficha`, `agenda`, `pasaporte`, `foto`, `kml`, `estaciones`.
