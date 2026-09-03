/**
 * Corriente admisible (Iz) — AEA 90364-5-52, Edición 2006, Capítulo 52
 * "Canalizaciones, cables y conductores", Anexo B.
 *
 * Fuente: D:\Drive\Normativas\AEA 90364\AEA-90364-5-2006.pdf (páginas
 * 52-91 a 52-111 del documento, verificadas visualmente contra el PDF
 * real, no solo por OCR). Cada tabla de acá es textualmente idéntica a
 * su equivalente en IEC 60364-5-52 — la AEA lo aclara en el pie de cada
 * tabla ("Origen: Tabla B52-X IEC 60364-5-52"), así que sirve para las
 * dos normativas que soporta el proyecto.
 *
 * Qué NO está todavía (etapa siguiente, ver docs/motor-de-calculo.md):
 * los métodos E, F y G (cables al aire libre sin canalización — tablas
 * B52-8 a B52-13) y las tablas de aislación mineral (B52-6/B52-7). Con
 * A1, A2, B1, B2, C, D1 y D2 ya está cubierta la enorme mayoría de
 * instalaciones interiores en caño/bandeja o enterradas.
 *
 * Nomenclatura de esta Tabla B52-1 (resumen de métodos de referencia):
 *   A1 = conductor aislado o cable unipolar, en caño embutido en pared
 *        térmicamente aislada.
 *   A2 = cable multipolar, en caño embutido en pared térmicamente
 *        aislada.
 *   B1 = conductor aislado o cable unipolar, en caño sobre pared o
 *        mampostería.
 *   B2 = cable multipolar, en caño sobre pared o mampostería.
 *   C  = cable uni o multipolar fijado directamente sobre la pared, sin
 *        caño.
 *   D1 = cable multipolar DENTRO de caño o conducto enterrado.
 *   D2 = cable multipolar DIRECTAMENTE enterrado, sin caño.
 * D1 y D2 dan Iz distinta (ver Tabla B52-16) — el schema de Vatia solo
 * tenía un código "D" genérico hasta que se cargó esta tabla; se separó
 * en D1/D2 porque la norma los separa.
 */

export const METODOS_CUBIERTOS = ["A1", "A2", "B1", "B2", "C", "D1", "D2"];

/** Sección nominal (mm²), cobre — Tablas B52-2 a B52-5. */
export const SECCIONES_CU = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300,
];
/** Sección nominal (mm²), aluminio — no existe la fila de 1,5 mm². */
export const SECCIONES_AL = [
  2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300,
];

/**
 * Cada tabla: filas en el mismo orden que SECCIONES_CU/SECCIONES_AL,
 * columnas en el orden de METODOS_CUBIERTOS. `null` = la norma no da
 * valor para esa combinación (ej.: aluminio de 2,5 mm² en D1/D2, sección
 * por debajo del mínimo práctico para ese método).
 */

// Tabla B52-2 — PVC/LSOH termoplástico, DOS conductores cargados, 70°C.
const B52_2_CU = [
  [13, 12, 15, 14, 17, 25, 29],
  [17, 16, 21, 20, 23, 33, 39],
  [23, 22, 28, 26, 31, 43, 51],
  [30, 28, 36, 33, 40, 53, 65],
  [40, 37, 50, 45, 55, 71, 88],
  [53, 50, 66, 60, 74, 91, 112],
  [70, 65, 88, 78, 97, 117, 144],
  [86, 80, 109, 97, 120, 140, 173],
  [104, 96, 131, 116, 146, 166, 207],
  [131, 121, 167, 146, 185, 205, 254],
  [158, 145, 202, 175, 224, 242, 306],
  [183, 167, 234, 202, 260, 276, 350],
  [209, 191, 261, 224, 299, 312, 393],
  [238, 216, 297, 256, 341, 350, 445],
  [279, 253, 348, 299, 401, 405, 519],
  [319, 291, 398, 343, 461, 457, 587],
];
const B52_2_AL = [
  [13, 13, 16, 15, 18, null, null],
  [17, 17, 22, 21, 24, 33, 40],
  [23, 22, 28, 26, 31, 40, 53],
  [31, 29, 38, 36, 43, 54, 67],
  [42, 38, 52, 47, 57, 70, 86],
  [55, 50, 69, 62, 72, 90, 112],
  [67, 62, 84, 75, 90, 106, 134],
  [81, 75, 103, 90, 109, 127, 161],
  [103, 94, 131, 114, 139, 157, 198],
  [124, 113, 157, 137, 170, 186, 237],
  [143, 131, 183, 157, 197, 212, 272],
  [164, 150, 204, 175, 227, 239, 305],
  [187, 170, 231, 200, 259, 269, 346],
  [219, 199, 271, 234, 306, 311, 403],
  [251, 229, 311, 268, 353, 351, 457],
];

// Tabla B52-3 — XLPE/EPR/LSOH termoestable, DOS conductores cargados, 90°C.
const B52_3_CU = [
  [17, 17, 21, 20, 22, 29, 34],
  [24, 23, 28, 27, 30, 39, 46],
  [32, 30, 38, 36, 41, 50, 60],
  [41, 38, 49, 46, 53, 63, 76],
  [56, 52, 68, 63, 73, 83, 102],
  [74, 69, 91, 83, 97, 106, 135],
  [96, 90, 121, 108, 126, 137, 175],
  [119, 110, 149, 133, 156, 165, 210],
  [144, 132, 180, 159, 190, 196, 251],
  [182, 167, 230, 201, 245, 241, 307],
  [219, 200, 278, 241, 298, 285, 369],
  [253, 230, 322, 278, 348, 325, 420],
  [289, 264, 358, 304, 401, 367, 472],
  [329, 299, 409, 349, 460, 411, 535],
  [386, 351, 480, 418, 545, 475, 623],
  [442, 402, 549, 484, 631, 537, 704],
];
const B52_3_AL = [
  [18, 18, 23, 21, 24, null, null],
  [25, 24, 30, 28, 32, 39, 47],
  [32, 30, 39, 36, 41, 46, 62],
  [44, 41, 54, 49, 56, 63, 79],
  [58, 55, 72, 66, 76, 83, 104],
  [76, 71, 96, 86, 92, 105, 136],
  [94, 87, 118, 105, 115, 127, 163],
  [114, 105, 143, 126, 140, 150, 194],
  [144, 132, 182, 159, 180, 185, 239],
  [174, 159, 220, 191, 219, 219, 286],
  [200, 183, 256, 220, 255, 249, 326],
  [230, 209, 279, 238, 295, 282, 366],
  [262, 238, 319, 273, 338, 316, 415],
  [308, 279, 375, 326, 399, 365, 484],
  [352, 320, 429, 378, 462, 412, 547],
];

// Tabla B52-4 — PVC/LSOH termoplástico, TRES conductores cargados, 70°C.
const B52_4_CU = [
  [12, 11, 14, 13, 15, 20, 25],
  [16, 15, 18, 17, 21, 27, 34],
  [21, 20, 25, 23, 28, 35, 44],
  [27, 25, 32, 30, 36, 44, 55],
  [37, 34, 44, 40, 50, 58, 74],
  [49, 45, 59, 54, 66, 75, 95],
  [64, 59, 77, 70, 84, 96, 123],
  [77, 72, 96, 86, 104, 115, 147],
  [94, 86, 117, 103, 125, 137, 173],
  [118, 109, 149, 130, 160, 169, 211],
  [143, 130, 180, 156, 194, 201, 254],
  [164, 150, 208, 179, 225, 228, 290],
  [188, 171, 228, 196, 260, 258, 325],
  [213, 194, 258, 222, 297, 289, 369],
  [249, 227, 301, 258, 351, 333, 428],
  [285, 259, 343, 295, 404, 377, 484],
];
const B52_4_AL = [
  [12, 12, 14, 13, 16, null, null],
  [16, 15, 19, 18, 22, 27, 34],
  [21, 20, 24, 23, 28, 34, 45],
  [28, 27, 34, 31, 38, 45, 57],
  [37, 36, 46, 42, 51, 58, 73],
  [50, 46, 61, 54, 64, 74, 94],
  [61, 57, 75, 67, 78, 90, 113],
  [73, 68, 90, 80, 96, 105, 135],
  [93, 85, 116, 101, 122, 131, 168],
  [112, 103, 140, 121, 148, 155, 202],
  [130, 117, 162, 139, 171, 176, 231],
  [148, 135, 177, 153, 197, 200, 260],
  [169, 153, 200, 173, 225, 224, 294],
  [197, 180, 234, 202, 265, 258, 341],
  [227, 206, 266, 231, 305, 291, 386],
];

// Tabla B52-5 — XLPE/EPR/LSOH termoestable, TRES conductores cargados, 90°C.
const B52_5_CU = [
  [15, 15, 18, 18, 20, 25, 29],
  [21, 20, 25, 24, 27, 33, 39],
  [28, 27, 34, 32, 36, 42, 51],
  [36, 35, 44, 40, 47, 52, 64],
  [49, 46, 60, 55, 65, 69, 87],
  [66, 62, 80, 73, 87, 89, 113],
  [86, 81, 106, 96, 108, 114, 148],
  [106, 99, 131, 116, 134, 138, 177],
  [128, 118, 159, 140, 163, 163, 209],
  [163, 149, 202, 177, 208, 202, 256],
  [197, 179, 245, 212, 253, 239, 308],
  [227, 207, 284, 244, 293, 272, 351],
  [259, 236, 311, 273, 338, 307, 393],
  [295, 268, 349, 309, 386, 344, 447],
  [346, 315, 410, 362, 455, 398, 519],
  [396, 360, 468, 414, 524, 449, 586],
];
const B52_5_AL = [
  [17, 16, 20, 19, 22, null, null],
  [23, 22, 26, 25, 29, 33, 40],
  [29, 28, 35, 32, 37, 41, 52],
  [40, 37, 47, 44, 52, 53, 67],
  [53, 50, 65, 58, 69, 69, 88],
  [69, 65, 85, 76, 82, 88, 115],
  [86, 79, 106, 94, 102, 106, 137],
  [103, 95, 127, 113, 124, 127, 162],
  [129, 119, 163, 142, 158, 156, 198],
  [156, 143, 197, 171, 192, 186, 239],
  [179, 164, 228, 197, 223, 211, 272],
  [206, 187, 243, 218, 258, 238, 305],
  [233, 212, 273, 248, 294, 267, 347],
  [273, 248, 319, 289, 348, 308, 403],
  [313, 285, 366, 331, 400, 349, 456],
];

/**
 * clave: `${aislacion}|${conductoresCargados}|${material}` → { filas, tabla }
 * aislacion tal como la carga el schema: "PVC" | "XLPE" | "EPR" (XLPE y
 * EPR comparten tabla en la norma, misma temperatura de conductor 90°C).
 */
const TABLAS = {
  "PVC|2|Cu": { filas: SECCIONES_CU, tabla: B52_2_CU },
  "PVC|2|Al": { filas: SECCIONES_AL, tabla: B52_2_AL },
  "XLPE|2|Cu": { filas: SECCIONES_CU, tabla: B52_3_CU },
  "XLPE|2|Al": { filas: SECCIONES_AL, tabla: B52_3_AL },
  "EPR|2|Cu": { filas: SECCIONES_CU, tabla: B52_3_CU },
  "EPR|2|Al": { filas: SECCIONES_AL, tabla: B52_3_AL },
  "PVC|3|Cu": { filas: SECCIONES_CU, tabla: B52_4_CU },
  "PVC|3|Al": { filas: SECCIONES_AL, tabla: B52_4_AL },
  "XLPE|3|Cu": { filas: SECCIONES_CU, tabla: B52_5_CU },
  "XLPE|3|Al": { filas: SECCIONES_AL, tabla: B52_5_AL },
  "EPR|3|Cu": { filas: SECCIONES_CU, tabla: B52_5_CU },
  "EPR|3|Al": { filas: SECCIONES_AL, tabla: B52_5_AL },
};

/**
 * Corriente admisible de base (A), sin corregir por temperatura ni
 * agrupamiento — ver `factorTemperatura()` y `factorAgrupamiento()`.
 *
 * `conductoresCargados`: 2 (circuito monofásico, L+N) o 3 (trifásico,
 * L1+L2+L3 — el neutro no cuenta como cargado salvo armónicos, Nota 2
 * de la tabla). `null` si el método, la sección o la combinación no
 * están en la tabla (p. ej. E/F/G, todavía no cargados).
 */
export function corrienteAdmisibleBaseA({
  aislacion,
  conductoresCargados,
  material,
  metodoInstalacion,
  seccionMm2,
}) {
  const entrada = TABLAS[`${aislacion}|${conductoresCargados}|${material}`];
  if (!entrada) return null;
  const colIdx = METODOS_CUBIERTOS.indexOf(metodoInstalacion);
  if (colIdx === -1) return null;
  const filaIdx = entrada.filas.indexOf(seccionMm2);
  if (filaIdx === -1) return null;
  return entrada.tabla[filaIdx][colIdx] ?? null;
}

/**
 * Tabla B52-14 — corrección por temperatura ambiente ≠ 40°C (cables al
 * aire, métodos A1/A2/B1/B2/C/E/F/G). Referencia 40°C = factor 1,00.
 * EPR comparte tabla con XLPE (misma temperatura de conductor, 90°C).
 * @type {Record<string, Record<number, number>>}
 */
export const FACTOR_TEMPERATURA_AIRE = {
  PVC: { 10: 1.4, 15: 1.35, 20: 1.29, 25: 1.22, 30: 1.15, 35: 1.08, 40: 1.0, 45: 0.91, 50: 0.82, 55: 0.7, 60: 0.57 },
  XLPE: { 10: 1.26, 15: 1.23, 20: 1.19, 25: 1.14, 30: 1.1, 35: 1.05, 40: 1.0, 45: 0.96, 50: 0.9, 55: 0.84, 60: 0.78, 65: 0.71, 70: 0.64, 75: 0.55, 80: 0.45 },
  EPR: { 10: 1.26, 15: 1.23, 20: 1.19, 25: 1.14, 30: 1.1, 35: 1.05, 40: 1.0, 45: 0.96, 50: 0.9, 55: 0.84, 60: 0.78, 65: 0.71, 70: 0.64, 75: 0.55, 80: 0.45 },
};

/**
 * Tabla B52-15 — corrección por temperatura del TERRENO ≠ 25°C (cables
 * enterrados, métodos D1/D2). Referencia 25°C = factor 1,00.
 * @type {Record<string, Record<number, number>>}
 */
export const FACTOR_TEMPERATURA_ENTERRADO = {
  PVC: { 10: 1.16, 15: 1.11, 20: 1.05, 25: 1.0, 30: 0.94, 35: 0.88, 40: 0.81, 45: 0.75, 50: 0.66, 55: 0.58, 60: 0.47 },
  XLPE: { 10: 1.11, 15: 1.08, 20: 1.04, 25: 1.0, 30: 0.97, 35: 0.93, 40: 0.89, 45: 0.83, 50: 0.79, 55: 0.74, 60: 0.68, 65: 0.63, 70: 0.55, 75: 0.48, 80: 0.4 },
  EPR: { 10: 1.11, 15: 1.08, 20: 1.04, 25: 1.0, 30: 0.97, 35: 0.93, 40: 0.89, 45: 0.83, 50: 0.79, 55: 0.74, 60: 0.68, 65: 0.63, 70: 0.55, 75: 0.48, 80: 0.4 },
};

/**
 * Tabla B52-16 — corrección por resistividad térmica del terreno ≠
 * 1 K·m/W (métodos D1/D2 — dan factores distintos entre sí). Referencia
 * 1 K·m/W = factor 1,00.
 */
export const FACTOR_RESISTIVIDAD_TERRENO = {
  D1: { 0.5: 1.08, 0.8: 1.02, 1: 1.0, 1.5: 0.93, 2: 0.89, 2.5: 0.85, 3: 0.81 },
  D2: { 0.5: 1.25, 0.8: 1.08, 1: 1.0, 1.5: 0.85, 2: 0.75, 2.5: 0.67, 3: 0.6 },
};

/**
 * Tabla B52-17, ítem 1 — corrección por agrupamiento de circuitos o
 * cables multipolares, "agrupados en aire, sobre una superficie,
 * embutidos o encerrados", válida para los métodos A1/A2/B1/B2/C (los
 * que ya están cargados). Referencia: 1 circuito = factor 1,00. Más de
 * 9 circuitos: la norma no exige mayor reducción (usar el valor de 9,
 * salvo que caiga justo en 12/16/20).
 * @type {Record<number, number>}
 */
export const FACTOR_AGRUPAMIENTO_AIRE = {
  1: 1.0, 2: 0.8, 3: 0.7, 4: 0.65, 5: 0.6, 6: 0.57, 7: 0.54, 8: 0.52, 9: 0.5,
  12: 0.45, 16: 0.41, 20: 0.38,
};
