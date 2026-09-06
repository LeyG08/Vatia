/**
 * Exportación a PDF (descarga directa con html2canvas + jsPDF, ver
 * lib/exportarPdf.ts): cada hoja se dibuja en una instancia de React Flow
 * propia, montada fuera de pantalla al tamaño físico real, y se captura
 * TAL COMO QUEDA dibujada — no hay un renderer paralelo.
 *
 * Por qué el zoom no es 1: el contenedor de cada hoja se fija a su
 * tamaño real en milímetros (ver HojaCanvas), que el navegador resuelve
 * a píxeles CSS a 96 dpi. La hoja se dibuja a `PX_POR_MM` unidades de
 * React Flow por milímetro (hoy 4) — sin corregir el zoom del viewport,
 * el contenido no llenaría ese contenedor a su tamaño real. El factor
 * que corrige esa diferencia es constante — no depende del formato de
 * hoja (A4..A0) ni de la orientación, porque `PX_POR_MM` es fijo — así
 * que se calcula una sola vez acá.
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
