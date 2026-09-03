/**
 * Exportación a PDF (impresión del navegador): la hoja activa se imprime
 * TAL COMO ESTÁ dibujada en el lienzo — no hay un renderer paralelo, se
 * reusa el mismo React Flow que ya se ve en pantalla. Lo único que hace
 * falta es (a) ocultar el resto de la interfaz bajo `@media print`
 * (ver estilos.css) y (b) llevar el viewport a la escala física real
 * antes de llamar a `window.print()`.
 *
 * Por qué el zoom no es 1: la hoja se dibuja a `PX_POR_MM` unidades de
 * React Flow por milímetro real (hoy 4). Al imprimir, el navegador trata
 * 1 unidad de React Flow como 1 px CSS, y 1 px CSS son 1/96", no 1/(4·mm).
 * El factor que corrige esa diferencia es constante — no depende del
 * formato de hoja (A4..A0) ni de la orientación, porque `PX_POR_MM` es
 * fijo — así que se calcula una sola vez acá.
 */
import { PX_POR_MM, TAMANIOS_HOJA_MM, type HojaConfig } from "./tipos";

/** 1 pulgada = 96 px CSS = 25,4 mm (estándar de impresión del navegador) */
const PX_CSS_POR_PULGADA = 96;
const MM_POR_PULGADA = 25.4;

export const ZOOM_IMPRESION =
  PX_CSS_POR_PULGADA / (PX_POR_MM * MM_POR_PULGADA);

/** Tamaño real (mm) de la hoja activa, para el `@page` dinámico. */
export function medidasPaginaMm(hoja: Pick<HojaConfig, "formato" | "orientacion">): {
  anchoMm: number;
  altoMm: number;
} {
  const [corto, largo] = TAMANIOS_HOJA_MM[hoja.formato];
  return hoja.orientacion === "horizontal"
    ? { anchoMm: largo, altoMm: corto }
    : { anchoMm: corto, altoMm: largo };
}
