// Íconos de las estaciones: ilustraciones a color sobre disco blanco (el aro lleva el color de la zona).
// Dibujos propios y genéricos del agro; no usan marcas ni personajes.
window.ICONOS = (function () {
  const svg = (c) => `<svg viewBox="0 0 48 48" aria-hidden="true">${c}</svg>`;
  const O = 'stroke="#3b2f2a" stroke-width="1.6" stroke-linejoin="round"'; // contorno
  return {
    aceite: svg(`
      <path d="M20 6h8v5h-8z" fill="#2e7d32" ${O}/>
      <path d="M19 11h10l1 5c4 2 6 6 6 11v13a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V27c0-5 2-9 6-11z" fill="#e8f0d8" ${O}/>
      <path d="M13 28h22v12a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2z" fill="#d8b417"/>
      <rect x="16" y="22" width="16" height="9" rx="2" fill="#fff" ${O}/>
      <ellipse cx="24" cy="26.5" rx="4" ry="2.4" fill="#4a7a2a"/>`),
    sanidad: svg(`
      <path d="M8 38C8 20 18 9 37 8c0 19-10 30-27 30" fill="#5fb547" ${O}/>
      <path d="M11 36L30 15" stroke="#2e7d32" stroke-width="2" fill="none"/>
      <circle cx="22" cy="24" r="5" fill="#e53935" ${O}/><path d="M22 19v10" stroke="#3b2f2a" stroke-width="1.4"/>
      <circle cx="20" cy="22" r="1" fill="#111"/><circle cx="24" cy="26" r="1" fill="#111"/>
      <circle cx="34" cy="33" r="7" fill="#cfe8fb" stroke="#37474f" stroke-width="3"/>
      <path d="M39 38l5 5" stroke="#37474f" stroke-width="4" stroke-linecap="round"/>`),
    olivo: svg(`
      <path d="M6 40C16 31 27 21 42 8" stroke="#7a5230" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="17" cy="25" rx="9" ry="3.6" fill="#8aa04a" ${O} transform="rotate(-38 17 25)"/>
      <ellipse cx="31" cy="13" rx="9" ry="3.6" fill="#a3b765" ${O} transform="rotate(-38 31 13)"/>
      <ellipse cx="33" cy="27" rx="9" ry="3.6" fill="#8aa04a" ${O} transform="rotate(22 33 27)"/>
      <ellipse cx="21" cy="37" rx="4.6" ry="5.6" fill="#3d2a4d" ${O}/><ellipse cx="19.5" cy="35" rx="1.3" ry="1.8" fill="#8e7aa6"/>
      <ellipse cx="12" cy="31" rx="3.8" ry="4.6" fill="#6b8e23" ${O}/>`),
    suelo: svg(`
      <path d="M24 20V9" stroke="#2e7d32" stroke-width="2.4"/>
      <path d="M24 14c-2-5-7-6-11-5 1 5 6 7 11 5zM24 12c2-5 7-6 11-5-1 5-6 7-11 5z" fill="#66bb6a" ${O}/>
      <path d="M6 20h36v7H6z" fill="#7b4a26" ${O}/><path d="M6 27h36v7H6z" fill="#a26a3a" ${O}/>
      <path d="M6 34h36v7H6z" fill="#cf9f63" ${O}/>
      <circle cx="14" cy="30" r="1.8" fill="#5a3418"/><circle cx="33" cy="37" r="2.2" fill="#9e7a50"/><circle cx="29" cy="23.5" r="1.4" fill="#4a2a12"/>`),
    nogal: svg(`
      <path d="M32 6c7 2 10 8 9 15-6-1-11-6-9-15z" fill="#6aa84f" ${O}/>
      <path d="M21 10c9 0 15 7 15 15s-6 16-15 16S6 33 6 25s6-15 15-15z" fill="#b07a45" ${O}/>
      <path d="M21 10v31" stroke="#6d4524" stroke-width="2"/>
      <path d="M12 18c3 2 3 5 0 7s-3 6 0 8M30 18c-3 2-3 5 0 7s3 6 0 8M16 14c2 3 2 6 0 8M26 14c-2 3-2 6 0 8" stroke="#6d4524" stroke-width="1.5" fill="none"/>
      <ellipse cx="38" cy="34" rx="4" ry="7" fill="#8b5a2b" ${O} transform="rotate(25 38 34)"/>`),
    charla: svg(`
      <path d="M5 10h25v16H17l-7 6v-6H5z" fill="#7e57c2" ${O}/>
      <path d="M43 19h-20v16h12l6 5v-5h2z" fill="#ffca28" ${O}/>
      <circle cx="12" cy="18" r="1.8" fill="#fff"/><circle cx="17.5" cy="18" r="1.8" fill="#fff"/><circle cx="23" cy="18" r="1.8" fill="#fff"/>
      <path d="M27 26h11M27 30h8" stroke="#5d4037" stroke-width="2" stroke-linecap="round"/>`),
    huerta: svg(`
      <path d="M14 18c-2-6 0-11 4-12 1 4 0 8-4 12zM18 18c1-6 6-9 10-8-1 4-5 7-10 8zM16 18c-6-2-9-6-8-10 4 0 7 4 8 10z" fill="#43a047" ${O}/>
      <path d="M10 19h12l-6 25z" fill="#fb8c00" ${O}/>
      <path d="M12 25h4M13 31h3M14 37h2" stroke="#c75b00" stroke-width="1.6"/>
      <circle cx="33" cy="33" r="10" fill="#9ccc65" ${O}/><path d="M33 23c-4 4-4 16 0 20M33 23c4 4 4 16 0 20M24 31c5 1 13 1 18 0" stroke="#558b2f" stroke-width="1.5" fill="none"/>`),
    ganado: svg(`
      <path d="M9 22c0-4 4-6 8-5 2-3 7-3 9 0 3-2 8-1 9 3 3 1 4 5 2 8 1 4-2 7-6 6-2 3-7 3-9 0-3 2-8 1-9-2-4 0-6-6-4-10z" fill="#f5efe1" ${O}/>
      <path d="M14 34v8M20 35v7M28 35v7M33 33v8" stroke="#3b2f2a" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M36 17c2-3 6-3 7 0l1 8c0 3-3 4-5 3l-4-3z" fill="#6d4c41" ${O}/>
      <path d="M38 16c-1-4 1-7 4-8M42 15c1-3 3-4 5-4" stroke="#8d6e63" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="40.5" cy="20" r="1.2" fill="#fff"/>`),
    vid: svg(`
      <path d="M24 4v7" stroke="#6d4c41" stroke-width="2.4"/>
      <path d="M25 9c3-5 10-6 15-3-2 6-9 8-15 3z" fill="#7cb342" ${O}/>
      ${[[18,15],[27,15],[13,22],[22.5,22],[31.5,22],[17,29],[26.5,29],[21.5,36],[30,35],[12,30]].map(([x,y])=>
        `<circle cx="${x}" cy="${y}" r="5" fill="#6a2c70" ${O}/><circle cx="${x-1.6}" cy="${y-1.6}" r="1.4" fill="#b98ac0"/>`).join("")}`),
    riego: svg(`
      <path d="M18 6c7 9 12 16 12 22a12 12 0 0 1-24 0c0-6 5-13 12-22z" fill="#29a3e8" ${O}/>
      <path d="M11 29a7 7 0 0 0 6 7" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <rect x="34" y="20" width="5" height="22" rx="1.5" fill="#90a4ae" ${O}/><rect x="32" y="15" width="9" height="7" rx="2" fill="#37474f" ${O}/>
      <path d="M32 11a7 7 0 0 1 9 0M29 7a12 12 0 0 1 15 0" stroke="#fb8c00" stroke-width="2.4" fill="none" stroke-linecap="round"/>`),
    institucion: svg(`
      <path d="M5 18L24 7l19 11z" fill="#1e88e5" ${O}/>
      <rect x="7" y="18" width="34" height="4" fill="#e3f2fd" ${O}/>
      <path d="M10 22h5v14h-5zM18 22h5v14h-5zM26 22h5v14h-5zM34 22h5v14h-5z" fill="#fff" ${O}/>
      <rect x="5" y="36" width="38" height="5" fill="#90a4ae" ${O}/>`),
    girasol: svg(`
      <path d="M24 30v15" stroke="#388e3c" stroke-width="3"/><path d="M24 40c-4-4-9-4-11-2 3 3 8 4 11 2z" fill="#66bb6a" ${O}/>
      ${Array.from({length:12},(_,i)=>`<ellipse cx="24" cy="8.5" rx="3.4" ry="7" fill="#fbc02d" ${O} transform="rotate(${i*30} 24 19)"/>`).join("")}
      <circle cx="24" cy="19" r="7.5" fill="#6d4c2f" ${O}/><circle cx="22" cy="17" r="1" fill="#a1887f"/><circle cx="26" cy="20" r="1" fill="#a1887f"/><circle cx="23" cy="22" r="1" fill="#a1887f"/>`),
    algodon: svg(`
      <path d="M24 32v13" stroke="#6d4c41" stroke-width="3"/>
      <path d="M12 30c4 4 20 4 24 0l-3 5c-5 3-13 3-18 0z" fill="#8d6e63" ${O}/>
      <circle cx="16" cy="22" r="7" fill="#fff" ${O}/><circle cx="32" cy="22" r="7" fill="#fff" ${O}/>
      <circle cx="24" cy="14" r="7.5" fill="#fff" ${O}/><circle cx="24" cy="26" r="7" fill="#fff" ${O}/>
      <path d="M8 40c3-3 7-3 10 0-3 2-7 2-10 0z" fill="#66bb6a" ${O}/>`),
    // Cultivos de los lotes (frutitas)
    almendra: svg(`
      <path d="M30 6c8 3 10 10 7 15-6-2-9-8-7-15z" fill="#7cb342" ${O}/>
      <path d="M22 10c9 4 14 14 12 23-2 7-9 10-14 7-7-4-10-14-7-22 2-5 5-8 9-8z" fill="#c8915a" ${O}/>
      <path d="M20 16c3 5 4 13 2 20" stroke="#8d5a2b" stroke-width="1.4" fill="none"/>`),
    pecan: svg(`
      <path d="M24 6c8 0 11 9 11 18s-3 18-11 18-11-9-11-18S16 6 24 6z" fill="#9c5f2d" ${O}/>
      <path d="M24 7v34" stroke="#5d3412" stroke-width="1.6"/><path d="M18 14c2 3 2 6 0 9M30 14c-2 3-2 6 0 9M18 27c2 3 2 6 0 9M30 27c-2 3-2 6 0 9" stroke="#5d3412" stroke-width="1.3" fill="none"/>`),
    naranja: svg(`
      <circle cx="24" cy="27" r="15" fill="#fb8c00" ${O}/><circle cx="19" cy="22" r="3" fill="#ffb74d"/>
      <path d="M24 12c0-4 2-6 5-6" stroke="#5d4037" stroke-width="2" fill="none"/>
      <path d="M26 11c4-5 11-5 14-2-4 5-10 5-14 2z" fill="#43a047" ${O}/>`),
    lima: svg(`
      <ellipse cx="24" cy="27" rx="16" ry="13" fill="#9ccc65" ${O}/><path d="M8 27h-2M40 27h2" stroke="#3b2f2a" stroke-width="2"/>
      <ellipse cx="19" cy="23" rx="4" ry="2.4" fill="#dcedc8"/>
      <path d="M25 14c4-5 10-5 13-2-4 5-9 5-13 2z" fill="#43a047" ${O}/>`),
    tuna: svg(`
      <ellipse cx="22" cy="30" rx="11" ry="14" fill="#66bb6a" ${O}/>
      ${[[18,24],[26,22],[20,33],[27,32],[22,40]].map(([x,y])=>`<path d="M${x-1.5} ${y}h3M${x} ${y-1.5}v3" stroke="#e8f5e9" stroke-width="1.2"/>`).join("")}
      <ellipse cx="34" cy="12" rx="5" ry="6.5" fill="#d81b60" ${O}/><ellipse cx="18" cy="12" rx="4.5" ry="6" fill="#f06292" ${O}/>`),
    higo: svg(`
      <path d="M24 9c2 0 3 2 3 4 7 3 11 10 11 17a14 14 0 0 1-28 0c0-7 4-14 11-17 0-2 1-4 3-4z" fill="#6a1b4d" ${O}/>
      <path d="M24 9V5" stroke="#5d4037" stroke-width="2.4"/><ellipse cx="18" cy="26" rx="3" ry="5" fill="#9c4f7c"/>`),
    estanque: svg(`
      <ellipse cx="24" cy="30" rx="19" ry="11" fill="#29a3e8" ${O}/>
      <path d="M11 29q4-3 8 0t8 0 8 0" stroke="#e1f5fe" stroke-width="2" fill="none"/>
      <path d="M17 18c3-6 6-9 7-11 1 2 4 5 7 11a7 7 0 0 1-14 0z" fill="#4fc3f7" ${O}/>`),
    edificio: svg(`
      <path d="M8 20L24 9l16 11v21H8z" fill="#eceff1" ${O}/><path d="M6 21L24 8l18 13" stroke="#c62828" stroke-width="3" fill="none" stroke-linejoin="round"/>
      <rect x="20" y="29" width="8" height="12" fill="#8d6e63" ${O}/><rect x="12" y="24" width="5" height="5" fill="#90caf9" ${O}/><rect x="31" y="24" width="5" height="5" fill="#90caf9" ${O}/>`),
    frutal: svg(`
      <circle cx="17" cy="29" r="10" fill="#e53935" ${O}/><circle cx="14" cy="26" r="2.5" fill="#ff8a80"/>
      <path d="M31 17c6 0 9 7 9 13a9 9 0 0 1-18 0c0-6 3-13 9-13z" fill="#cddc39" ${O}/>
      <path d="M17 19c0-4 2-6 4-7M31 17v-5" stroke="#5d4037" stroke-width="2" fill="none"/>
      <path d="M21 12c3-4 8-4 10-1-3 3-7 3-10 1z" fill="#43a047" ${O}/>`),
    pastura: svg(`
      <path d="M6 40h36" stroke="#8d6e63" stroke-width="3" stroke-linecap="round"/>
      <path d="M10 40c0-10 2-18 5-24M14 40c1-8 4-14 9-18M20 40c0-12 1-22 4-30M26 40c1-9 4-16 10-20M32 40c0-8 2-15 6-19M37 40c1-6 3-10 6-12"
        stroke="#7cb342" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M24 10c-1 3 0 5 2 6M15 16c-1 3 0 5 2 5" stroke="#c0ca33" stroke-width="3" fill="none" stroke-linecap="round"/>`),
    clima: svg(`
      <path d="M22 8v24" stroke="#546e7a" stroke-width="3"/><rect x="18" y="32" width="8" height="10" rx="2" fill="#90a4ae" ${O}/>
      <path d="M22 10l14-4M22 10l12 8" stroke="#546e7a" stroke-width="2.4"/>
      <circle cx="36" cy="6" r="3" fill="#29a3e8" ${O}/><circle cx="34" cy="18" r="3" fill="#29a3e8" ${O}/>
      <circle cx="12" cy="18" r="6" fill="#fbc02d" ${O}/><path d="M12 8v2M12 26v2M2 18h2M20 18h2" stroke="#f57f17" stroke-width="2"/>`),
    pozo: svg(`
      <rect x="10" y="30" width="28" height="10" rx="2" fill="#90a4ae" ${O}/>
      <path d="M20 30V14h8v16" fill="#b0bec5" ${O}/><path d="M16 14h16" stroke="#546e7a" stroke-width="3" stroke-linecap="round"/>
      <path d="M24 4c-3 4-5 6-5 8.5a5 5 0 0 0 10 0C29 10 27 8 24 4z" fill="#29a3e8" ${O}/>`),
    ingreso: svg(`
      <path d="M8 42V14h6v28M34 42V14h6v28" fill="#90a4ae" ${O}/>
      <path d="M14 18h20M14 26h20" stroke="#6d4c41" stroke-width="3"/>
      <path d="M17 34h12l-4-4M29 34l-4 4" stroke="#2e7d32" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
    sello: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 25l8 8 15-17" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
})();
