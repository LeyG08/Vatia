#!/usr/bin/env node
/**
 * C26 — Migración del unifilar TGBT (página 0) a su hoja, FIEL al
 * dibujo que hizo el usuario (Downloads\TGBT.json, interpretación del
 * AutoCAD sin la parte de comando).
 *
 * Topología según el usuario:
 *   - Red (transformador): multipolar 3×240+N120 IRAM 2178 → entra
 *     DIRECTO a la barra principal (30×10 mm Cu, 573 A).
 *   - Dos ramales hacia abajo: barra → KM (3TF57 / 3TA28) →
 *     QG-TGBT1 (EMA SACE ISOL Z500 500 A) → carga «seccional TS-G1».
 *   - Cada seccional recibe además un enlace SOLO NEUTRO 35 mm²
 *     directo desde la barra.
 *   - PAT (generador): unipolar 1×70 + tierra 70 IRAM 2004 → pasa por
 *     AFUERA de la barra hasta su propio seccional TS-G1.
 *
 * Los nodos y conexiones se copian VERBATIM del archivo del usuario
 * (ids, posiciones y fichas incluidas). Únicos ajustes:
 *   - los 4 cables sin atributos se completan con datos del PDF para
 *     que el checklist quede verde;
 *   - n8 recibe alimentacion:"monofasica" (1F+PE según el cable PAT);
 *   - a2/c11 suman aislacion "XLPE" (IRAM 2004 es XLPE; el checklist
 *     exige aislación cargada).
 *
 * Idempotente: SIEMPRE reconstruye la hoja tgbt desde esta definición.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = join(raiz, "apps/editor/ejemplos/proyecto-real-pps.json");
const proyecto = JSON.parse(readFileSync(ruta, "utf8"));

let hoja = proyecto.hojas.find((h) => h.tablero === "tgbt");
if (!hoja) {
  hoja = {
    id: "pps-hoja-0001",
    nombre: "TGBT",
    formato: "A3",
    orientacion: "horizontal",
    tablero: "tgbt",
    notasGabinete: {
      material: "",
      claseAislacion: "",
      personalApto: "",
      gradoProteccion: "",
      barrasOConductores: "",
      reservaFutura: "",
    },
    notaSeguridad: "",
    rotulo: {},
    nodos: [],
    conexiones: [],
    viewport: { x: 0, y: 0, zoom: 1.5 },
  };
  proyecto.hojas.unshift(hoja);
}

/** Cable idéntico en nodo y conexión. */
const c240 = {
  cantidad_conductores: 3,
  tipo_cable: "multipolar",
  lleva_neutro: true,
  lleva_tierra: false,
  seccion_fase_mm2: 240,
  seccion_neutro_mm2: 120,
  material: "Cu",
  aislacion: "PVC",
  norma_iram: "IRAM 2178",
};
const c70 = {
  cantidad_conductores: 3,
  tipo_cable: "unipolar",
  lleva_neutro: false,
  lleva_tierra: false,
  seccion_fase_mm2: 70,
  material: "Cu",
  aislacion: "PVC",
  norma_iram: "IRAM NM 247-3",
};
const cPat = {
  cantidad_conductores: 1,
  tipo_cable: "unipolar",
  lleva_neutro: false,
  lleva_tierra: true,
  seccion_fase_mm2: 70,
  seccion_tierra_mm2: 70,
  material: "Cu",
  aislacion: "XLPE",
  norma_iram: "IRAM 2004",
};

hoja.nodos = [
  {
    id: "a1",
    tipo: "alimentador",
    posicion: { x: 728, y: 43 },
    rotacion: 0,
    datos: {
      origen: "Transformador",
      fases: true,
      neutro: true,
      tierra: false,
      cantidadN: null,
      atributos: { ...c240 },
    },
    atributos: { ...c240 },
  },
  {
    id: "n1",
    tipo: "barra",
    posicion: { x: 100, y: 150 },
    rotacion: 0,
    datos: { largoPx: 1020 },
    atributos: {
      dimensiones: "30x10mm",
      es_conjunto: true,
      cantidad_fases: 3,
      incluye_neutro: true,
      incluye_tierra: false,
      material: "Cu",
      norma_iram: "IRAM 2181-1",
      corriente_admisible_A: 573,
    },
  },
  {
    id: "n2",
    codigo_iec: "S00112",
    posicion: { x: 730, y: 290 },
    rotacion: 0,
    atributos: {
      tipo_aparato: "contactor",
      marca: "SIEMENS",
      modelo: "3TF57",
      cantidad_polos: 3,
      ue_V: 415,
      categoria_empleo: "AC-3",
      in_a: 475,
      tension_bobina_v: 220,
    },
  },
  {
    id: "n3",
    codigo_iec: "S00112",
    posicion: { x: 900, y: 290 },
    rotacion: 0,
    atributos: {
      tipo_aparato: "contactor",
      marca: "SIEMENS",
      modelo: "3TA28",
      cantidad_polos: 3,
      ue_V: 690,
      categoria_empleo: "AC-3",
      tension_bobina_v: 220,
      in_a: 170,
    },
  },
  {
    id: "n4",
    codigo_iec: "S00121",
    posicion: { x: 750, y: 440 },
    rotacion: 0,
    atributos: {
      tipo_aparato: "mccb_caja_moldeada",
      marca: "EMA SACE",
      modelo: "ISOL Z500",
      cantidad_polos: 3,
      tipo_disparo: "termomagnetico",
      ir_a_min: 500,
      ir_a_max: 500,
      pdcc_kA: 2500,
      norma_fabricacion: "IEC 60947-2",
    },
  },
  {
    id: "n5",
    codigo_iec: "S00121",
    posicion: { x: 890, y: 460 },
    rotacion: 0,
    atributos: {
      tipo_aparato: "mccb_caja_moldeada",
      marca: "EMA SACE",
      modelo: "ISOL Z500",
      cantidad_polos: 3,
      tipo_disparo: "termomagnetico",
      ir_a_min: 500,
      ir_a_max: 500,
      pdcc_kA: 2500,
      norma_fabricacion: "IEC 60947-2",
    },
  },
  {
    id: "n6",
    codigo_iec: "S00120",
    posicion: { x: 730, y: 600 },
    rotacion: 0,
    atributos: {
      codigo_circuito: "TS-G1",
      tipo_carga: "seccional",
      ku: 1,
      alimentacion: "trifasica",
      lleva_neutro: true,
      descripcion: "Tablero General 1",
    },
  },
  {
    id: "n7",
    codigo_iec: "S00120",
    posicion: { x: 900, y: 600 },
    rotacion: 0,
    atributos: {
      codigo_circuito: "TS-G1",
      tipo_carga: "seccional",
      ku: 1,
      alimentacion: "trifasica",
      lleva_neutro: true,
      descripcion: "Tablero General 1",
    },
  },
  {
    id: "a2",
    tipo: "alimentador",
    posicion: { x: 1287, y: 53 },
    rotacion: 0,
    datos: {
      origen: "PAT",
      fases: true,
      neutro: false,
      tierra: true,
      cantidadN: null,
      atributos: { ...cPat },
    },
    atributos: { ...cPat },
  },
  {
    id: "n8",
    codigo_iec: "S00120",
    posicion: { x: 1390, y: 600 },
    rotacion: 0,
    atributos: {
      codigo_circuito: "TS-G1",
      tipo_carga: "seccional",
      ku: 1,
      alimentacion: "monofasica",
      lleva_neutro: false,
      descripcion: "Tablero General 1",
    },
  },
];

const con = (id, desde, hasta, attrs) => ({
  id,
  desde,
  hasta,
  ...(attrs ? { atributos_conductor: attrs } : {}),
});

hoja.conexiones = [
  con("c1", "a1.salida", "n1.760b", { ...c240 }),
  con("c3", "n1.810a", "n3.in", { ...c70 }),
  con("c4", "n1.640a", "n2.in", { ...c70 }),
  con("c5", "n2.out", "n4.in", { ...c70 }),
  con("c6", "n3.out", "n5.in", { ...c70 }),
  con("c7", "n4.out", "n6.in", { ...c70 }),
  con("c8", "n5.out", "n7.in", { ...c70 }),
  con("c9", "n1.970a", "n7.in", {
    cantidad_conductores: 0,
    tipo_cable: "unipolar",
    lleva_neutro: true,
    lleva_tierra: false,
    seccion_neutro_mm2: 35,
    material: "Cu",
    aislacion: "PVC",
    norma_iram: "IRAM NM 247-3",
  }),
  con("c10", "n1.390a", "n6.in", {
    cantidad_conductores: 0,
    tipo_cable: "unipolar",
    lleva_neutro: true,
    lleva_tierra: false,
    seccion_neutro_mm2: 35,
    material: "Cu",
    aislacion: "PVC",
    norma_iram: "IRAM NM 247-3",
  }),
  con("c11", "a2.salida", "n8.in", { ...cPat }),
];

proyecto.meta.ultimaModificacion = new Date().toISOString();
writeFileSync(ruta, JSON.stringify(proyecto, null, 2) + "\n");

console.log(
  `TGBT reconstruido fiel al usuario: ${hoja.nodos.length} nodos, ${hoja.conexiones.length} conexiones.`,
);
