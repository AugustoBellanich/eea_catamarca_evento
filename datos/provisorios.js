// Ubicaciones PROVISORIAS de estaciones que todavía no están en el KML. Solo para ver cómo quedarían:
// cuando una estación tenga su lote en el KML, la provisoria deja de usarse sola.
window.PROVISORIOS = {
 "type": "FeatureCollection",
 "features": [
  {
   "type": "Feature",
   "properties": {
    "id": "prov-e8",
    "tipo": "lote",
    "estacion": "e8",
    "provisorio": true,
    "nota": "Planilla: corrales en el sector de la dirección"
   },
   "geometry": {
    "type": "Point",
    "coordinates": [
     -65.7282081,
     -28.468796
    ]
   }
  },
  {
   "type": "Feature",
   "properties": {
    "id": "prov-e11",
    "tipo": "lote",
    "estacion": "e11",
    "provisorio": true,
    "nota": "Planilla: galería del SUM"
   },
   "geometry": {
    "type": "Point",
    "coordinates": [
     -65.7278742,
     -28.4681791
    ]
   }
  },
  {
   "type": "Feature",
   "properties": {
    "id": "prov-e7",
    "tipo": "lote",
    "estacion": "e7",
    "provisorio": true,
    "nota": "Planilla: lugar a definir"
   },
   "geometry": {
    "type": "Point",
    "coordinates": [
     -65.7265387,
     -28.4695158
    ]
   }
  },
  {
   "type": "Feature",
   "properties": {
    "id": "prov-e12",
    "tipo": "lote",
    "estacion": "e12",
    "provisorio": true,
    "nota": "Planilla: lote algodón (sin ubicar en el KML)"
   },
   "geometry": {
    "type": "Point",
    "coordinates": [
     -65.7264552,
     -28.4691045
    ]
   }
  },
  {
   "type": "Feature",
   "properties": {
    "id": "prov-girasol-romero",
    "tipo": "lote",
    "estacion": "girasol-romero",
    "provisorio": true,
    "nota": "Planilla: lotes girasol-romero (sin ubicar en el KML)"
   },
   "geometry": {
    "type": "Point",
    "coordinates": [
     -65.7265387,
     -28.4699271
    ]
   }
  },
  {
   "type": "Feature",
   "properties": {
    "id": "prov-e3",
    "tipo": "lote",
    "estacion": "e3",
    "provisorio": true,
    "nota": "Planilla: monte del ingreso. Se tomó el lote de olivos más cercano al ingreso principal",
    "cultivo": "olivo",
    "patron": "arboles"
   },
   "geometry": {
    "type": "Polygon",
    "coordinates": [
     [
      [
       -65.7283391,
       -28.4711009
      ],
      [
       -65.7283932,
       -28.4719572
      ],
      [
       -65.727855,
       -28.4719955
      ],
      [
       -65.7277555,
       -28.47116
      ],
      [
       -65.7283391,
       -28.4711009
      ]
     ]
    ]
   }
  }
 ]
};
