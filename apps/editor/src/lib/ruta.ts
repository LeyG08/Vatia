/** Grilla de la hoja en px de flujo */
export const GRILLA_PX = 10;

function snap(v: number): number {
  return Math.round(v / GRILLA_PX) * GRILLA_PX;
}

/**
 * Enrutado ortogonal con los quiebres SIEMPRE en nodos de la grilla
 * (múltiplos de 10 px). Los extremos ya caen en grilla porque la
 * colocación de símbolos alinea su eje; los tramos intermedios se
 * snapean explícitamente.
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

  sx = snap(sx);
  sy = snap(sy);
  tx = snap(tx);
  ty = snap(ty);

  if (saleVertical && llegaVertical) {
    if (sx === tx) return `M ${sx} ${sy} L ${tx} ${ty}`;
    const fila = snap((sy + ty) / 2);
    return `M ${sx} ${sy} L ${sx} ${fila} L ${tx} ${fila} L ${tx} ${ty}`;
  }

  if (!saleVertical && !llegaVertical) {
    if (sy === ty) return `M ${sx} ${sy} L ${tx} ${ty}`;
    const columna = snap((sx + tx) / 2);
    return `M ${sx} ${sy} L ${columna} ${sy} L ${columna} ${ty} L ${tx} ${ty}`;
  }

  if (saleVertical && !llegaVertical) {
    // sale en vertical hasta la fila del objetivo y entra horizontal
    return `M ${sx} ${sy} L ${sx} ${ty} L ${tx} ${ty}`;
  }

  // sale horizontal hasta la columna del objetivo y entra vertical
  return `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}`;
}
