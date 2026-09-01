/**
 * Lectura normalizada de la ficha técnica.
 *
 * Las fichas viajan por el editor como `Record<string, unknown>` y cada subtipo
 * de aparato nombra las mismas magnitudes a su manera, porque cada uno sigue la
 * norma de fabricación que le corresponde. Un verificador de selectividad o de
 * filiación necesita preguntar "¿cuál es el poder de corte de este aparato?"
 * sin saber de qué subtipo se trata, y eso es lo que resuelve este módulo.
 *
 * Las discrepancias reales que hay hoy en los schemas:
 *
 * - **Poder de corte**: `pdcc_kA` en el termomagnético (IEC 60898-1 lo llama
 *   Icn), en el MCCB y en el fusible; `icu_kA` + `ics_kA` en los guardamotores
 *   (IEC 60947-2). Son la misma pregunta con dos nombres.
 * - **Rango de ajuste**: el MCCB usa `ir_a_min` / `ir_a_max` y el guardamotor y
 *   el relé térmico usan `ir_min_a` / `ir_max_a` — el mismo concepto con el
 *   sufijo invertido. Es una inconsistencia de nomenclatura, no una distinción
 *   técnica.
 *
 * Todo devuelve `null` cuando el dato no está cargado, que es el estado normal
 * de una ficha a medio completar.
 */

import type { AtributosAparato, TipoAparato } from "./tiposAtributos";

type Ficha = Record<string, unknown>;

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** El primer valor numérico presente entre varias claves alternativas. */
function primero(a: Ficha, claves: readonly string[]): number | null {
  for (const k of claves) {
    const v = numero(a[k]);
    if (v !== null) return v;
  }
  return null;
}

/**
 * Vista tipada de una ficha de aparato, o `null` si no declara `tipo_aparato`.
 * Es el puente entre el `Record<string, unknown>` que guarda el proyecto y los
 * tipos generados desde los schemas.
 */
export function comoAparato(a: Ficha | undefined): AtributosAparato | null {
  if (!a || typeof a.tipo_aparato !== "string") return null;
  return a as unknown as AtributosAparato;
}

export function tipoDeAparato(a: Ficha | undefined): TipoAparato | null {
  const ap = comoAparato(a);
  return ap ? (ap.tipo_aparato as TipoAparato) : null;
}

/**
 * Poder de corte último, en kA. Unifica `icu_kA` (IEC 60947-2) con `pdcc_kA`
 * (Icn de IEC 60898-1 y el genérico del MCCB y el fusible).
 *
 * Es el valor que hay que comparar contra la corriente de cortocircuito
 * presunta en el punto de instalación.
 */
export function poderDeCorteKA(a: Ficha | undefined): number | null {
  return a ? primero(a, ["icu_kA", "pdcc_kA"]) : null;
}

/**
 * Poder de corte de servicio Ics, en kA. Solo lo declaran los subtipos de
 * IEC 60947-2; en los demás no existe el concepto y devuelve `null`.
 */
export function poderDeCorteServicioKA(a: Ficha | undefined): number | null {
  return a ? numero(a.ics_kA) : null;
}

/**
 * Rango de ajuste de la protección térmica, en amperes.
 *
 * Absorbe la inconsistencia de nomenclatura entre `ir_a_min` / `ir_a_max`
 * (MCCB) e `ir_min_a` / `ir_max_a` (guardamotor y relé térmico).
 */
export function rangoAjusteA(a: Ficha | undefined): { min: number | null; max: number | null } | null {
  if (!a) return null;
  const min = primero(a, ["ir_a_min", "ir_min_a"]);
  const max = primero(a, ["ir_a_max", "ir_max_a"]);
  return min === null && max === null ? null : { min, max };
}

/**
 * Corriente nominal o de ajuste del aparato, en amperes: lo que define su
 * escalón de protección.
 *
 * Cuando el aparato es regulable se toma el **máximo** del rango, que es el
 * peor caso para verificar que la protección no supere la corriente admisible
 * del conductor.
 */
export function corrienteNominalA(a: Ficha | undefined): number | null {
  if (!a) return null;
  const directa = numero(a.in_a);
  if (directa !== null) return directa;
  const rango = rangoAjusteA(a);
  if (rango?.max != null) return rango.max;
  return primero(a, ["ith_a", "corriente_maxima_a"]);
}
