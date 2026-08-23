import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { rutaOrtogonal } from "../lib/ruta";
import { lineasMazo } from "../lib/anotaciones";

/** Marcas de conductor según IEC 60617: trazos oblicuos a ~45°, juntos */
const SEP_TICKS = 6;
const LARGO_TICK = 12;

function puntosDe(d: string): [number, number][] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

/**
 * Marcas sobre la conexión, en el orden normado: fases, luego neutro
 * (trazo con CÍRCULO en su punta), luego tierra (trazo CORTADO por una
 * línea corta). Inclinadas ~45° respecto de la línea y agrupadas al
 * centro del segmento más largo del recorrido.
 */
function MarcasConductores({
  d,
  fases,
  neutro,
  tierra,
}: {
  d: string;
  fases: number;
  neutro: boolean;
  tierra: boolean;
}) {
  const total = fases + (neutro ? 1 : 0) + (tierra ? 1 : 0);
  if (total < 1) return null;
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
  // Dirección del trazo: la línea girada 45°
  const wx = (ux - uy) / Math.SQRT2;
  const wy = (uy + ux) / Math.SQRT2;
  const h = LARGO_TICK / 2;
  const mx = (mejor.x1 + mejor.x2) / 2;
  const my = (mejor.y1 + mejor.y2) / 2;
  // Separación adaptativa si el segmento es corto
  const sep = Math.min(SEP_TICKS, Math.max(4, (mejor.len - 20) / Math.max(total - 1, 1)));

  return (
    <g stroke="#334155" strokeWidth={1.3} strokeLinecap="round" fill="none">
      {Array.from({ length: total }, (_, i) => {
        const t = (i - (total - 1) / 2) * sep;
        const cx = mx + t * ux;
        const cy = my + t * uy;
        const ax = cx - wx * h;
        const ay = cy - wy * h;
        const bx = cx + wx * h;
        const by = cy + wy * h;
        return (
          <g key={i}>
            <line x1={ax} y1={ay} x2={bx} y2={by} />
            {neutro && i === fases && (
              <circle cx={bx} cy={by} r={2.4} fill="#fdfdfd" />
            )}
            {tierra && i === fases + (neutro ? 1 : 0) && (
              <line
                x1={bx - wy * 4}
                y1={by + wx * 4}
                x2={bx + wy * 4}
                y2={by - wx * 4}
              />
            )}
          </g>
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
  const m = (data?.atributosConductor as Record<string, unknown> | undefined) ?? {};

  return (
    <>
      <BaseEdge path={d} {...props} />
      <MarcasConductores
        d={d}
        fases={fases}
        neutro={m.lleva_neutro === true}
        tierra={m.lleva_tierra === true}
      />
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
