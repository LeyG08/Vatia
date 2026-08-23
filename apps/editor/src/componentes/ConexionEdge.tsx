import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { rutaOrtogonal } from "../lib/ruta";
import { lineasMazo } from "../lib/anotaciones";

/** Marcas de conductor según IEC 60617: un trazo oblicuo por línea */
const ESPACIO_TICKS = 9;
const LARGO_TICK = 12;

function puntosDe(d: string): [number, number][] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

/**
 * Trazos oblicuos cruzando la conexión, centrados en su segmento más
 * largo: uno por conductor de línea (fases), como en el plano real.
 */
function TicksConductores({ d, cantidad }: { d: string; cantidad: number }) {
  if (cantidad < 1) return null;
  const pts = puntosDe(d);
  let mejor: { x1: number; y1: number; x2: number; y2: number; len: number } | null = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (!mejor || len > mejor.len) mejor = { x1, y1, x2, y2, len };
  }
  if (!mejor || mejor.len < 30) return null;

  const ux = (mejor.x2 - mejor.x1) / mejor.len;
  const uy = (mejor.y2 - mejor.y1) / mejor.len;
  const px = -uy;
  const py = ux;
  const mx = (mejor.x1 + mejor.x2) / 2;
  const my = (mejor.y1 + mejor.y2) / 2;
  const h = LARGO_TICK / 2;

  return (
    <g stroke="#334155" strokeWidth={1.3} strokeLinecap="round">
      {Array.from({ length: cantidad }, (_, i) => {
        const t = (i - (cantidad - 1) / 2) * ESPACIO_TICKS;
        const cx = mx + t * ux;
        const cy = my + t * uy;
        return (
          <line
            key={i}
            x1={cx - px * h}
            y1={cy - py * h}
            x2={cx + px * h}
            y2={cy + py * h}
          />
        );
      })}
    </g>
  );
}

export default function ConexionEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  ...props
}: EdgeProps) {
  const d = rutaOrtogonal(
    sourceX,
    sourceY,
    String(sourcePosition),
    targetX,
    targetY,
    String(targetPosition),
  );
  const lineas = lineasMazo(
    (data?.atributosConductor as Record<string, unknown> | undefined) ?? {},
  );
  const fases =
    typeof data?.atributosConductor === "object" &&
    data?.atributosConductor !== null &&
    typeof (data.atributosConductor as Record<string, unknown>).cantidad_conductores === "number"
      ? ((data.atributosConductor as Record<string, unknown>).cantidad_conductores as number)
      : 0;

  return (
    <>
      <BaseEdge path={d} {...props} />
      <TicksConductores d={d} cantidad={fases} />
      {lineas.length > 0 && (
        <EdgeLabelRenderer>
          <div
            className="anotacion-edge"
            style={{
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`,
            }}
          >
            {lineas.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
