/**
 * Coeficiente de utilización Ku (C10, pedido del usuario).
 *
 * Cada circuito de carga trabaja a una fracción de su potencia
 * nominal. El valor se SUGIERE según el tipo de carga pero queda
 * siempre editable a mano:
 *   IUG (iluminación) → cercano a 1
 *   TUG (tomacorrientes) → más bajo
 *   ACU / motores → entre 0,75 y 0,9
 *
 * potencia_utilizacion_va = potencia_va × ku (ku ausente ⇒ 1: la
 * utilización iguala a la nominal). El dato SE GUARDA en los
 * atributos porque el futuro nodo agregador de tablero lo va a sumar
 * junto con el coeficiente de simultaneidad Ks — esa agregación NO se
 * implementa acá todavía.
 *
 * Este módulo es compartible: cualquier familia futura que represente
 * una carga (flecha o no) puede reusar estas funciones.
 */

export const KU_SUGERIDO_POR_TIPO: Record<string, number> = {
  IUG: 0.9,
  TUG: 0.5,
  ACU: 0.85,
  seccional: 1,
  otra: 1,
};

export function kuSugeridoPara(tipoCarga: unknown): number | undefined {
  return typeof tipoCarga === "string" ? KU_SUGERIDO_POR_TIPO[tipoCarga] : undefined;
}

function kuDe(a: Record<string, unknown>): number {
  return typeof a.ku === "number" && a.ku >= 0 && a.ku <= 1 ? a.ku : 1;
}

/** Potencia de utilización en VA (redondeada), o null sin potencia nominal */
export function calcularUtilizacionVa(a: Record<string, unknown>): number | null {
  const nominal = typeof a.potencia_va === "number" && a.potencia_va > 0 ? a.potencia_va : null;
  if (nominal === null) return null;
  return Math.round(nominal * kuDe(a));
}
