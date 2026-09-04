/**
 * Secciones de conductor normadas (E54) — reusa la tabla Iz YA cargada y
 * verificada contra el PDF real de la norma (ver
 * docs/normativa/iz-corriente-admisible.md), no inventa una lista propia:
 * el cobre arranca en 1,5 mm², el aluminio en 2,5 (la norma no tabula
 * aluminio de 1,5 mm²). Pedido explícito del usuario: "la sección se
 * debería colocar... de forma discreta 1.5 2 4 6 10 16..." — con esto la
 * sección elegida SIEMPRE tiene una fila en la tabla, así que el cálculo
 * de Iz (lib/calculo.ts) deja de fallar en silencio cuando el usuario
 * tipeaba un número que no era ninguno de los tabulados.
 */
import {
  SECCIONES_CU,
  SECCIONES_AL,
} from "../../../../libreria-simbolos/normativa/tablaIzAea90364552.mjs";
import type { ModoHoja } from "./tipos";

/** Techo práctico para un conductor de circuito de COMANDO (control):
 * el cableado de mando de un tablero industrial rara vez pasa de 4 mm²
 * — pedido explícito ("dependiendo si la norma se trata de multifilares
 * o unifilares permite una sección o no"). NO es un límite normativo
 * tabulado (la tabla Iz cargada es para fuerza; la norma no da un techo
 * específico de sección de comando) — es un techo de PRÁCTICA habitual
 * de tablero, así que la lista sigue ofreciendo "Otra…" para el caso
 * que lo necesite. */
const TECHO_COMANDO_MM2 = 4;

/** Secciones normadas disponibles (mm²) para elegir, según el material
 * del conductor y si la hoja es de fuerza (unifilar, rango completo) o
 * de comando (multifilar, recortado al techo de arriba). */
export function seccionesDisponiblesMm2(
  material: "Cu" | "Al" | undefined,
  modo: ModoHoja,
): number[] {
  const base: readonly number[] = material === "Al" ? SECCIONES_AL : SECCIONES_CU;
  return modo === "multifilar" ? base.filter((s) => s <= TECHO_COMANDO_MM2) : [...base];
}

/**
 * Sección mínima recomendada del conductor de PROTECCIÓN (PE), según la
 * regla proporcional de IEC 60364-5-54 / AEA 90364-5-54 respecto de la
 * sección de fase del mismo cable: S≤16 → Spe=S; 16<S≤35 → Spe=16;
 * S>35 → Spe=S/2. `null` si falta la sección de fase — sin eso no hay
 * nada contra qué comparar.
 */
export function seccionMinimaPeMm2(seccionFaseMm2: number | undefined): number | null {
  if (!seccionFaseMm2 || seccionFaseMm2 <= 0) return null;
  if (seccionFaseMm2 <= 16) return seccionFaseMm2;
  if (seccionFaseMm2 <= 35) return 16;
  return seccionFaseMm2 / 2;
}
