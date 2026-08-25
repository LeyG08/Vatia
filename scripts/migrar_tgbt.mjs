#!/usr/bin/env node
/**
 * C24 — Migración del unifilar TGBT (página 0 del PDF
 * «Unifilares de Tableros (PROV).pdf») a su hoja del proyecto PPS.
 *
 * Topología leída del plano:
 *   Red (3×240+N120, IRAM 2178) → QG-TGBT1 (EMA SACE ISOL Z500 500A)
 *   → KM1 (Siemens 3TF57 475A AC3) ─┐
 *   PAT generador (3×70) → QG-TGBT1 → KM2 (Siemens 3TA28 170A) ─┤
 *                                    Barra principal 3x30x10mm Cu
 *                                   (IRAM 2181-1, cobre desnudo, IP00,
 *                                    sin reserva futura) + PE.
 *
 * Idempotente: si la hoja ya tiene nodos, no hace nada.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = join(raiz, "apps/editor/ejemplos/proyecto-real-pps.json");
const proyecto = JSON.parse(readFileSync(ruta, "utf8"));

const hoja = proyecto.hojas.find((h) => h.tablero === "tgbt");
if (!hoja) throw new Error("No encuentro la hoja tgbt");
if (hoja.nodos.length > 0) {
  console.log("TGBT ya tiene contenido; nada que hacer.");
  process.exit(0);
}

const cable = (fase, neutro, norma) => ({
  cantidad_conductores: 3,
  tipo_cable: "unipolar",
  lleva_neutro: neutro !== null,
  ...(neutro !== null ? { seccion_neutro_mm2: neutro } : {}),
  lleva_tierra: false,
  seccion_fase_mm2: fase,
  material: "Cu",
  aislacion: "PVC",
  norma_iram: norma,
});

const c70 = cable(70, null, "IRAM NM 247-3");
const qgAttrs = {
  tipo_aparato: "interruptor_termomagnetico",
  marca: "EMA",
  modelo: "SACE ISOL Z500",
  cantidad_polos: 3,
  in_a: 500,
  curva_disparo: "-",
  pdcc_kA: 20,
  norma_fabricacion: "IEC 60947-2",
};

hoja.nodos = [
  {
    id: "ARed",
    tipo: "alimentador",
    posicion: { x: 340, y: 60 },
    rotacion: 0,
    datos: { origen: "Red de distribución", fases: true, neutro: true, tierra: false, cantidadN: null },
    atributos: cable(240, 120, "IRAM 2178"),
  },
  {
    id: "QG1",
    codigo_iec: "S00110",
    posicion: { x: 330, y: 220 },
    rotacion: 0,
    atributos: { ...qgAttrs },
  },
  {
    id: "KM1",
    codigo_iec: "S00112",
    posicion: { x: 330, y: 360 },
    rotacion: 0,
    atributos: {
      tipo_aparato: "contactor",
      marca: "Siemens",
      modelo: "3TF57",
      cantidad_polos: 3,
      ue_V: 415,
      categoria_empleo: "AC-3",
      in_a: 475,
      tension_bobina_v: 220,
    },
  },
  {
    id: "APat",
    tipo: "alimentador",
    posicion: { x: 660, y: 60 },
    rotacion: 0,
    datos: { origen: "PAT (generador)", fases: true, neutro: false, tierra: false, cantidadN: null },
    atributos: c70,
  },
  {
    id: "QG2",
    codigo_iec: "S00110",
    posicion: { x: 650, y: 220 },
    rotacion: 0,
    atributos: { ...qgAttrs },
  },
  {
    id: "KM2",
    codigo_iec: "S00112",
    posicion: { x: 650, y: 360 },
    rotacion: 0,
    atributos: {
      tipo_aparato: "contactor",
      marca: "Siemens",
      modelo: "3TA28",
      cantidad_polos: 3,
      ue_V: 380,
      categoria_empleo: "AC-3",
      in_a: 170,
      tension_bobina_v: 220,
    },
  },
  {
    id: "B1",
    tipo: "barra",
    codigo_iec: "S00119",
    posicion: { x: 250, y: 540 },
    rotacion: 0,
    datos: { largoPx: 620 },
    atributos: {
      dimensiones: "3 x 30 x 10 mm",
      es_conjunto: true,
      cantidad_fases: 3,
      incluye_neutro: true,
      incluye_tierra: false,
      material: "Cu",
      norma_iram: "IRAM 2181-1",
      corriente_admisible_A: 500,
    },
  },
  {
    id: "PE",
    codigo_iec: "S00118",
    posicion: { x: 180, y: 660 },
    rotacion: 0,
    atributos: {},
  },
];

const conCable = (desde, hasta, attrs) => ({
  desde,
  hasta,
  atributos_conductor: attrs,
});

hoja.conexiones = [
  conCable("ARed.salida", "QG1.1", cable(240, 120, "IRAM 2178")),
  conCable("QG1.2", "KM1.1", c70),
  conCable("KM1.2", "B1.140b", c70),
  conCable("APat.salida", "QG2.1", c70),
  conCable("QG2.2", "KM2.1", c70),
  conCable("KM2.2", "B1.260b", c70),
  conCable("B1.60a", "PE.PE", {
    cantidad_conductores: 0,
    tipo_cable: "unipolar",
    lleva_neutro: false,
    lleva_tierra: true,
    seccion_tierra_mm2: 16,
    material: "Cu",
    aislacion: "PVC",
    norma_iram: "IRAM NM 247-3",
  }),
];

hoja.notasGabinete = {
  material: "Gabinete o armazón metálico autoportante",
  claseAislacion: "Clase I (puesta a tierra de masas metálicas)",
  personalApto: "Exclusivo para personal BA5/BA4",
  gradoProteccion: "IP00 (tablero abierto según IEC 60529)",
  barrasOConductores: "Barras principales de cobre desnudo",
  reservaFutura: "Sin espacio de reserva futuro",
};
hoja.notaSeguridad =
  "Toda maniobra de desconexión se ejecuta en vacío, previa apertura del interruptor automático aguas abajo.";

hoja.migracion = {
  fuente: "Unifilares de Tableros.dwg",
  pagina: "p0",
  estado: "parcial",
};
proyecto.meta.ultimaModificacion = new Date().toISOString();

writeFileSync(ruta, JSON.stringify(proyecto, null, 2) + "\n");
console.log(
  `TGBT migrado: ${hoja.nodos.length} nodos, ${hoja.conexiones.length} conexiones.`,
);
