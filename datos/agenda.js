// Agenda y avisos de respaldo (se usan si config.js no tiene enlaces a la planilla, o sin señal).
// Las filas marcadas como ejemplo son solo para ver cómo se muestra: se reemplazan por la agenda real.
window.AGENDA = {
  actividades: [
    { inicio: "09:00", fin: "09:30", titulo: "Ejemplo: Bienvenida e inicio de recorridos", estacion: "", lugar: "Ingreso principal", ejemplo: true },
    { inicio: "10:00", fin: "10:45", titulo: "Ejemplo: Charla en el SUM", estacion: "e6", lugar: "SUM", ejemplo: true },
    { inicio: "11:00", fin: "11:30", titulo: "Ejemplo: Demostración en la estación de riego", estacion: "e10", lugar: "", ejemplo: true },
  ],
  avisos: [
    { hora: "08:30", titulo: "Ejemplo de aviso", texto: "Así se ven los anuncios que envía la organización durante la jornada.", prioridad: "alta", ejemplo: true },
  ],
};
