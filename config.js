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

  // Sectores con un solo ingreso abierto el día del evento: "Cómo llegar" entra y sale solo por ahí.
  accesos: { "Sector 2": "Ingreso sector 2" },

  // Estación donde se dibujan las podadoras trabajando (su ficha: poda mecánica): van en el lote donde está su marcador.
  podaMecanica: "e3",

  // Pasaporte: la estación se sella al abrir su QR o al pasar a menos de esta distancia (m).
  radioSello: 60,

  // Contacto institucional (dirección oficial de la EEA).
  contacto: "eeacatamarca@inta.gob.ar",

  // Instagram: cuenta oficial de la EEA. A COMPLETAR con Comunicación: el hashtag.
  instagram: "@intacatamarca",          // cuenta oficial de la EEA Catamarca (Augusto, 24/11/2026)
  hashtag: "#INTA70Catamarca",

  // Métricas de uso anónimas (metricas.js → functions/api/eventos.js). Sin nombre, contacto ni ubicación.
  metricas: { activo: true },

  // Encuesta breve, voluntaria y anónima (functions/api/encuesta.js). Se ofrece en el pasaporte y, una vez, al llegar
  // a "ofrecerConSellos" estaciones selladas. "id" de pregunta y de opción: minúsculas y guion bajo (así se guardan).
  // "varias": se pueden marcar varias opciones. Todas las preguntas son optativas.
  encuesta: {
    activa: true,
    ofrecerConSellos: 4,
    preguntas: [
      { id: "procedencia", texto: "¿Desde dónde venís?", opciones: [
        ["valle_viejo", "Valle Viejo"], ["capital", "San Fernando del V. de Catamarca"], ["otro_depto", "Otro departamento de Catamarca"],
        ["otra_provincia", "Otra provincia"] ] },
      { id: "perfil", texto: "¿Cómo te describís?", opciones: [
        ["productor", "Productor/a agropecuario/a"], ["estudiante_secundario", "Estudiante secundario/a"],
        ["estudiante_superior", "Estudiante terciario/universitario"], ["docente", "Docente"],
        ["tecnico", "Técnico/a o profesional del agro"], ["empresa", "Empresa o cooperativa"],
        ["organismo", "Organismo público o institución"], ["publico", "Público en general"] ] },
      { id: "edad", texto: "Edad", opciones: [
        ["menos_18", "Menos de 18"], ["18_29", "18 a 29"], ["30_44", "30 a 44"], ["45_59", "45 a 59"], ["60_mas", "60 o más"] ] },
      { id: "primera_vez", texto: "¿Es tu primera visita a la EEA Catamarca?", opciones: [["si", "Sí"], ["no", "No, ya vine antes"]] },
      { id: "como_se_entero", texto: "¿Cómo te enteraste de la jornada?", varias: true, opciones: [
        ["redes_inta", "Redes de INTA"], ["escuela", "Escuela o institución"], ["medios", "Radio, TV o diario"],
        ["conocidos", "Por conocidos"], ["trabajo", "Por mi trabajo"], ["otro", "Otro"] ] },
      { id: "interes", texto: "¿Qué te interesó más?", varias: true, opciones: [
        ["frutales", "Frutales"], ["laboratorios", "Laboratorios"], ["cultivos", "Cultivos y huerta"],
        ["ganaderia", "Producción animal"], ["charlas", "Charlas"], ["riego", "Riego y agua"] ] },
      { id: "vinculo", texto: "¿Te interesa que INTA te acompañe con capacitación o asistencia técnica?", opciones: [
        ["si", "Sí"], ["ya_trabajo", "Ya trabajo con INTA"], ["no", "Por ahora no"] ] },
      { id: "valoracion", texto: "¿Qué te pareció la jornada?", opciones: [
        ["5", "Excelente"], ["4", "Muy buena"], ["3", "Buena"], ["2", "Regular"], ["1", "Mala"] ] },
      { id: "mapa", texto: "¿Te sirvió este mapa?", opciones: [["mucho", "Sí, mucho"], ["algo", "Algo"], ["poco", "Poco"]] },
    ],
  },

  // Concurso de fotos: queda apagado hasta que la organización apruebe las bases.
  concurso: {
    activo: false,
    texto: "Publicá tu foto en Instagram con el hashtag y etiquetando a la cuenta de la EEA. Participan las fotos publicadas hasta el 4/12 a las 23:59.",
    bases: "", // enlace a las bases y condiciones
  },
};
