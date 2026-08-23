#!/usr/bin/env node
// Verificación de alineación a grilla del mini-unifilar de prueba.
//
// Replica EXACTA de la matemática del editor:
//   - apps/editor/src/componentes/NodoSimbolo.tsx (rotarPunto/direccionBase,
//     posición de handles en px)
//   - apps/editor/src/lib/ruta.ts (rutaOrtogonal con snapeo a grilla)
//
// Para cada símbolo × rotación (0/90/180/270) × ESCALA (2 y 4) verifica
// que los handles caen en múltiplos de 10 px. Después arma un unifilar
// completo, calcula las rutas de las conexiones y verifica que TODOS los
// vértices caen en grilla. Por último genera el JSON de proyecto como lo
// guardaría el editor y valida que el cargador lo aceptaría.

import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIB = join(RAIZ, "libreria-simbolos", "simbolos");

let fallos = 0;
function verificar(condicion, mensaje) {
  if (!condicion) {
    fallos += 1;
    console.error(`  ✗ ${mensaje}`);
  }
  return condicion;
}

const enGrilla = (v) => Math.abs(v / 10 - Math.round(v / 10)) < 1e-9;

/* ---- réplica de NodoSimbolo.tsx ---- */
const DIRECCIONES = ["top", "right", "bottom", "left"];

function direccionBase(p, vb) {
  const distancias = [
    { i: 0, d: Math.abs(p.y - vb.minY) },
    { i: 1, d: Math.abs(vb.minX + vb.ancho - p.x) },
    { i: 2, d: Math.abs(vb.minY + vb.alto - p.y) },
    { i: 3, d: Math.abs(p.x - vb.minX) },
  ];
  distancias.sort((a, b) => a.d - b.d);
  return distancias[0].i;
}

function rotarPunto(p, vb, rotacion) {
  const x = p.x - vb.minX;
  const y = p.y - vb.minY;
  const giro = (((rotacion % 360) + 360) % 360) / 90;
  let rx = x;
  let ry = y;
  let ancho = vb.ancho;
  let alto = vb.alto;
  if (giro === 1) {
    rx = vb.alto - y;
    ry = x;
    ancho = vb.alto;
    alto = vb.ancho;
  } else if (giro === 2) {
    rx = vb.ancho - x;
    ry = vb.alto - y;
  } else if (giro === 3) {
    rx = y;
    ry = vb.ancho - x;
    ancho = vb.alto;
    alto = vb.ancho;
  }
  return { x: rx, y: ry, cajaAncho: ancho, cajaAlto: alto, dir: DIRECCIONES[(direccionBase(p, vb) + giro) % 4] };
}

/* ---- réplica de ruta.ts ---- */
function snap(v) {
  return Math.round(v / 10) * 10;
}

function rutaOrtogonal(sx, sy, dirSalida, tx, ty, dirLlegada) {
  const saleVertical = dirSalida === "top" || dirSalida === "bottom";
  const llegaVertical = dirLlegada === "top" || dirLlegada === "bottom";
  sx = snap(sx); sy = snap(sy); tx = snap(tx); ty = snap(ty);
  if (saleVertical && llegaVertical) {
    if (sx === tx) return [[sx, sy], [tx, ty]];
    const fila = snap((sy + ty) / 2);
    return [[sx, sy], [sx, fila], [tx, fila], [tx, ty]];
  }
  if (!saleVertical && !llegaVertical) {
    if (sy === ty) return [[sx, sy], [tx, ty]];
    const columna = snap((sx + tx) / 2);
    return [[sx, sy], [columna, sy], [columna, ty], [tx, ty]];
  }
  if (saleVertical && !llegaVertical) return [[sx, sy], [sx, ty], [tx, ty]];
  return [[sx, sy], [tx, sy], [tx, ty]];
}

/* ---- carga de la librería ---- */
const simbolos = new Map();
for (const carpeta of readdirSync(LIB, { withFileTypes: true })) {
  if (!carpeta.isDirectory()) continue;
  const meta = JSON.parse(readFileSync(join(LIB, carpeta.name, "metadata.json"), "utf8"));
  const svg = readFileSync(join(LIB, carpeta.name, "simbolo.svg"), "utf8");
  const m = svg.match(/viewBox\s*=\s*"([^"]+)"/);
  const [minX, minY, ancho, alto] = m[1].split(/\s+/).map(Number);
  simbolos.set(meta.codigo_iec, { codigo: meta.codigo_iec, puntos: meta.puntos_conexion, viewBox: { minX, minY, ancho, alto }, carpeta: carpeta.name });
}

/* ---- 1) handles en grilla para toda rotación y ambas escalas ---- */
console.log("1) Handles por símbolo × rotación × ESCALA:");
for (const s of simbolos.values()) {
  let ok = true;
  for (const escala of [2, 4]) {
    for (let rot = 0; rot < 360; rot += 90) {
      for (const p of s.puntos) {
        const r = rotarPunto(p, s.viewBox, rot);
        // posición absoluta del handle con el nodo apoyado en grilla
        const absX = 100 + r.x * escala;
        const absY = 100 + r.y * escala;
        ok = verificar(enGrilla(absX) && enGrilla(absY),
          `${s.codigo} rot=${rot}° ESCALA=${escala} punto '${p.id}' cae en (${absX},${absY})`) && ok;
      }
    }
  }
  if (ok) console.log(`  ✓ ${s.codigo} (${s.carpeta})`);
}

/* ---- 2) mini-unifilar armado con las reglas del editor ---- */
// Colocaciones (nodos snapeados a grilla, ESCALA=4 como en producción)
const ESCALA = 4;
const colocaciones = [
  { id: "Q1", codigo: "S00110", pos: { x: 400, y: 40 } },
  { id: "K1", codigo: "S00112", pos: { x: 400, y: 360 } },
  { id: "F1", codigo: "S00113", pos: { x: 400, y: 720 } },
  { id: "PE", codigo: "S00118", pos: { x: 160, y: 900 } },
  { id: "X1", codigo: "S00119", pos: { x: 260, y: 1120 } },
  { id: "M1", codigo: "S00115", pos: { x: 760, y: 1040 } },
];

const nodos = colocaciones.map(({ id, codigo, pos }) => {
  const s = simbolos.get(codigo);
  verificar(Boolean(s), `${id}: código ${codigo} inexistente en librería`);
  return { id, codigo, simbolo: s, pos };
});

function handleAbs(nodo, puntoId) {
  const r = rotarPunto(
    nodo.simbolo.puntos.find((p) => p.id === puntoId),
    nodo.simbolo.viewBox,
    0,
  );
  return {
    x: nodo.pos.x + r.x * ESCALA,
    y: nodo.pos.y + r.y * ESCALA,
    dir: r.dir,
    rol: nodo.simbolo.puntos.find((p) => p.id === puntoId).rol,
  };
}

console.log("\n2) Extremos de conexión del mini-unifilar (ESCALA=4):");
for (const n of nodos) {
  for (const p of n.simbolo.puntos) {
    const h = handleAbs(n, p.id);
    verificar(enGrilla(h.x) && enGrilla(h.y),
      `${n.id}.${p.id} en (${h.x},${h.y}) fuera de grilla (${h.dir})`);
    console.log(`  ✓ ${n.id}.${p.id} (${p.rol}) → (${h.x}, ${h.y}) sale hacia ${h.dir}`);
  }
}

const conexiones = [
  ["Q1.out", "K1.in"],
  ["K1.out", "F1.1"],
  ["F1.2", "X1.in"],
  ["X1.out", "M1.in"],
  ["K1.in", "PE.PE"], // tierra tomada desde la entrada del contactor
];

console.log("\n3) Rutas ortogonales (todos los vértices deben caer en grilla):");
for (const [desde, hasta] of conexiones) {
  const [nd, pd] = desde.split(".");
  const [nh, ph] = hasta.split(".");
  const a = handleAbs(nodos.find((n) => n.id === nd), pd);
  const b = handleAbs(nodos.find((n) => n.id === nh), ph);
  const ruta = rutaOrtogonal(a.x, a.y, a.dir, b.x, b.y, b.dir);
  const todosEnGrilla = ruta.every(([x, y]) => enGrilla(x) && enGrilla(y));
  verificar(todosEnGrilla, `${desde}→${hasta}: vértices fuera de grilla: ${JSON.stringify(ruta)}`);
  const d = ruta.map(([x, y]) => `L ${x} ${y}`).join(" ").replace(/^L/, "M");
  console.log(`  ✓ ${desde} → ${hasta}: ${d}`);
}

/* ---- 3) serialización como la haría el editor + validación de carga ---- */
const proyecto = {
  nombre: "mini_unifilar_prueba",
  nodos: nodos.map(({ id, codigo, pos }) => ({
    id,
    codigo_iec: codigo,
    posicion: { x: pos.x, y: pos.y },
    rotacion: 0,
    atributos: {},
  })),
  conexiones: conexiones.map(([desde, hasta], i) => ({
    id: `c${i + 1}`,
    desde,
    hasta,
    atributos_conductor: {},
  })),
  modo_vista: "unifilar_simple",
};

console.log("\n4) Validación del proyecto serializado (como cargarProyecto):");
for (const n of proyecto.nodos) {
  verificar(simbolos.has(n.codigo_iec), `nodo ${n.id}: código desconocido ${n.codigo_iec}`);
  verificar(enGrilla(n.posicion.x) && enGrilla(n.posicion.y), `nodo ${n.id}: posición fuera de grilla`);
}
for (const c of proyecto.conexiones) {
  const [nd, pd] = c.desde.split(".");
  const [nh, ph] = c.hasta.split(".");
  const origen = nodos.find((n) => n.id === nd);
  const destino = nodos.find((n) => n.id === nh);
  verificar(Boolean(origen?.simbolo.puntos.find((p) => p.id === pd)),
    `${c.id}: handle origen ${c.desde} inexistente`);
  verificar(Boolean(destino?.simbolo.puntos.find((p) => p.id === ph)),
    `${c.id}: handle destino ${c.hasta} inexistente`);
}

const rutaSalida = join(RAIZ, "apps", "editor", "ejemplos", "mini-unifilar.json");
writeFileSync(rutaSalida, JSON.stringify(proyecto, null, 2) + "\n");

if (fallos > 0) {
  console.error(`\nFALLA: ${fallos} verificaciones incorrectas`);
  process.exit(1);
}
console.log(`\nOK: alineación verificada · proyecto demo guardado en ${rutaSalida}`);
