import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { rutaOrtogonal } from "../lib/ruta";
import { lineasMazo } from "../lib/anotaciones";

/** Marcas de conductor según IEC 60617: trazos oblicuos a ~45°, juntos */
const SEP_TICKS = 8;
const LARGO_TICK = 15;

function puntosDe(d: string): [number, number][] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

/** Segmento más largo del recorrido y dirección de sus marcas */
interface GeometriaMarcas {
  mx: number;
  my: number;
  ux: number;
  uy: number;
  sep: number;
}

function geometriaDe(d: string, total: number): GeometriaMarcas | null {
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
  return {
    mx: (mejor.x1 + mejor.x2) / 2,
    my: (mejor.y1 + mejor.y2) / 2,
    ux,
    uy,
    // Separación adaptativa si el segmento es corto
    sep: Math.min(SEP_TICKS, Math.max(4, (mejor.len - 20) / Math.max(total - 1, 1))),
  };
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
  const m = (data?.atributosConductor as Record<string, unknown> | undefined) ?? {};
  const lineas = lineasMazo(m);
  const fases =
    typeof m.cantidad_conductores === "number" ? m.cantidad_conductores : 0;
  const neutro = m.lleva_neutro === true;
  const tierra = m.lleva_tierra === true;

  // Marcas + anotación comparten la misma geometría (segmento más largo)
  const totalMarcas = fases + (neutro ? 1 : 0) + (tierra ? 1 : 0);
  const geo = geometriaDe(d, totalMarcas);
  const wx = geo ? (geo.ux - geo.uy) / Math.SQRT2 : 0;
  const wy = geo ? (geo.uy + geo.ux) / Math.SQRT2 : 0;
  const h = LARGO_TICK / 2;

  // El texto va AL COSTADO DERECHO de las marcas, centrado en altura,
  // igual que las anotaciones de los símbolos.
  const halfSpan = geo ? ((totalMarcas - 1) / 2) * geo.sep + h : 0;
  const labelX = geo
    ? geo.mx + halfSpan * Math.abs(geo.ux) + h * Math.abs(geo.uy) + 6
    : (sourceX + targetX) / 2;
  const labelY = geo ? geo.my : (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge path={d} {...props} />
      {geo && (
        <g stroke="#334155" strokeWidth={1.3} strokeLinecap="round" fill="none">
          {Array.from({ length: totalMarcas }, (_, i) => {
            const t = (i - (totalMarcas - 1) / 2) * geo.sep;
            const cx = geo.mx + t * geo.ux;
            const cy = geo.my + t * geo.uy;
            const bx = cx + wx * h;
            const by = cy + wy * h;
            return (
              <g key={i}>
                <line
                  x1={cx - wx * h}
                  y1={cy - wy * h}
                  x2={bx}
                  y2={by}
                />
                {neutro && i === fases && (
                  <circle cx={bx} cy={by} r={2.8} fill="#fdfdfd" />
                )}
                {tierra && i === fases + (neutro ? 1 : 0) && (
                  <line
                    x1={bx - wy * 5}
                    y1={by + wx * 5}
                    x2={bx + wy * 5}
                    y2={by - wx * 5}
                  />
                )}
              </g>
            );
          })}
        </g>
      )}
      {lineas.length > 0 && (
        <EdgeLabelRenderer>
          <div
            className="anotacion-edge"
            style={{
              transform: `translate(0, -50%) translate(${labelX}px, ${labelY}px)`,
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
