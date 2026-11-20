// Configuración del sitio. Lo que dice "A COMPLETAR" se reemplaza antes de la jornada.
window.CONFIG = {
  titulo: "INTA a Puertas Abiertas",
  tituloCorto: "Puertas Abiertas",          // encabezado, al lado del logo
  subtituloCorto: "EEA Catamarca · Sumalao",
  // Logos oficiales del aniversario 70 (archivos de Comunicación, sin modificar): color y blanco (negativo).
  logo: "img/logo-inta70-blanco-izquierda.png",        // sobre fondo azul: bienvenida y encabezado
  logoColor: "img/logo-inta70-color-izquierda.png",    // sobre fondo blanco: pin lejano y marco de la foto
  subtitulo: "70 años · EEA Catamarca · Sumalao",
  fecha: "3 de diciembre de 2026",
  fechaISO: "2026-12-03",
  anioInicio: 1956, anioActual: 2026,       // el sello de la bienvenida cuenta los años (INTA se creó en 1956) // día de la jornada: la agenda marca "Ahora" y "Próximo" solo ese día

  // Centro del predio (del KML de Augusto, 19/11/2026). Al cargar, el mapa se ajusta al límite del predio.
  centro: [-28.4686, -65.7277],
  zoom: 16,

  // Imagen base. Esri World Imagery con atribución; revisar sus términos antes de publicar.
  // Cuando esté el ortomosaico del dron: teselas en /teselas/{z}/{x}/{y}.png y cambiar acá.
  teselas: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    atribucion: "Imagen: Esri, Maxar, Earthstar Geographics",
    zoomMax: 17,      // zoom con foto real asegurado en la zona (al cargar se consulta si hay más detalle)
    zoomTope: 19.5,   // hasta dónde se deja acercar en modo satelital (se amplía la mejor foto disponible)
    // Consulta de disponibilidad de Esri: dice en qué zoom hay foto para un punto. Vacío para no consultar.
    disponibilidad: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap/{z}/{y}/{x}/1/1",
  },

  // Zonas del recorrido (propuesta para revisar con la organización). El color va en el disco de cada estación.
  zonas: {
    frutales:     { nombre: "Frutales",            color: "#2e7d32" },
    laboratorios: { nombre: "Laboratorios",        color: "#00838f" },
    cultivos:     { nombre: "Cultivos y huerta",   color: "#e65100" },
    ganaderia:    { nombre: "Producción animal",   color: "#6d4c41" },
    encuentro:    { nombre: "Encuentro y charlas", color: "#8e24aa" },
  },

  // Niveles de detalle del mapa (zoom de Leaflet):
  //   menos de "paradas": solo el pin de INTA · desde "paradas": ingresos y paradas · desde "lotes": frutitas y nombres
  zoomParadas: 15,
  zoomLotes: 17,

  // Agenda y avisos: enlaces CSV de una planilla de Google publicada en la web (Archivo → Compartir → Publicar en la web,
  // una hoja por enlace, formato CSV). Vacíos: se usa datos/agenda.js. Se consultan cada minuto mientras haya señal.
  agendaCSV: "",
  avisosCSV: "",

  // Estación donde se dibujan las podadoras trabajando (su ficha: poda mecánica en los lotes del ingreso).
  podaMecanica: "e3",

  // Pasaporte: la estación se sella al abrir su QR o al pasar a menos de esta distancia (m).
  radioSello: 60,

  // Contacto institucional (dirección oficial de la EEA).
  contacto: "eeacatamarca@inta.gob.ar",

  // A COMPLETAR con Comunicación: cuenta oficial y hashtag.
  instagram: "@cuenta_oficial_eea",
  hashtag: "#INTA70Catamarca",

  // Concurso de fotos: queda apagado hasta que la organización apruebe las bases.
  concurso: {
    activo: false,
    texto: "Publicá tu foto en Instagram con el hashtag y etiquetando a la cuenta de la EEA. Participan las fotos publicadas hasta el 4/12 a las 23:59.",
    bases: "", // enlace a las bases y condiciones
  },
};
