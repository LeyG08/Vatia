/** Grilla de la hoja en px de flujo */
export const GRILLA_PX = 10;

function snap(v: number): number {
  return Math.round(v / GRILLA_PX) * GRILLA_PX;
}

/**
 * Arma el path descartando puntos consecutivos repetidos (evita
 * segmentos de longitud cero cuando el quiebre cae sobre un extremo).
 */
function armar(puntos: [number, number][]): string {
  const limpios: [number, number][] = [];
  for (const p of puntos) {
    const previo = limpios[limpios.length - 1];
    if (!previo || previo[0] !== p[0] || previo[1] !== p[1]) limpios.push(p);
  }
  return (
    `M ${limpios[0][0]} ${limpios[0][1]} ` +
    limpios
      .slice(1)
      .map((p) => `L ${p[0]} ${p[1]}`)
      .join(" ")
  );
}

/**
 * Enrutado ortogonal. Los EXTREMOS quedan EXACTOS donde están los
 * handles (sin snap: los terminales viven en múltiplos de ESCALA, no
 * de la grilla — moverlos despega la conexión del símbolo). El snap a
 * grilla solo aplica a los QUIEBRES intermedios, y si el quiebre
 * snapeado cae fuera del tramo útil se usa el punto medio real.
 */
export function rutaOrtogonal(
  sx: number,
  sy: number,
  dirSalida: string,
  tx: number,
  ty: number,
  dirLlegada: string,
): string {
  const saleVertical = dirSalida === "top" || dirSalida === "bottom";
  const llegaVertical = dirLlegada === "top" || dirLlegada === "bottom";

  if (saleVertical && llegaVertical) {
    if (sx === tx) return armar([[sx, sy], [tx, ty]]);
    // Quiebre en una fila intermedia: snapeado pero DENTRO del tramo
    const lo = Math.min(sy, ty);
    const hi = Math.max(sy, ty);
    let fila = snap((sy + ty) / 2);
    if (fila <= lo || fila >= hi) fila = (sy + ty) / 2;
    return armar([[sx, sy], [sx, fila], [tx, fila], [tx, ty]]);
  }

  if (!saleVertical && !llegaVertical) {
    if (sy === ty) return armar([[sx, sy], [tx, ty]]);
    const lo = Math.min(sx, tx);
    const hi = Math.max(sx, tx);
    let columna = snap((sx + tx) / 2);
    if (columna <= lo || columna >= hi) columna = (sx + tx) / 2;
    return armar([[sx, sy], [columna, sy], [columna, ty], [tx, ty]]);
  }

  if (saleVertical && !llegaVertical) {
    // sale en vertical hasta la fila del objetivo y entra horizontal
    return armar([[sx, sy], [sx, ty], [tx, ty]]);
  }

  // sale horizontal hasta la columna del objetivo y entra vertical
  return armar([[sx, sy], [tx, sy], [tx, ty]]);
}
