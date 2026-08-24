import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  useStore,
  type EdgeProps,
} from "@xyflow/react";
import { rutaOrtogonal } from "../lib/ruta";
import { lineasMazo } from "../lib/anotaciones";
import type { DatosBarra } from "../lib/store";

/** Marcas de conductor según IEC 60617: trazos oblicuos a ~45°, juntos */
const SEP_TICKS = 8;
const LARGO_TICK = 15;

function puntosDe(d: string): [number, number][] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

interface UbicacionMarcas {
  x: number;
  y: number;
  ux: number;
  uy: number;
  sep: number;
}

/**
 * Punto sobre la polilínea en la fracción dada de su largo total,
 * con dirección del tramo y espacio libre para dibujar. Si el tramo
 * que toca es muy corto, cae al centro del tramo más largo.
 */
function ubicarEnTrayectoria(
  d: string,
  fraccion: number,
  cantidad: number,
): UbicacionMarcas | null {
  const pts = puntosDe(d);
  if (pts.length < 2) return null;

  let total = 0;
  const largos: number[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    largos.push(l);
    total += l;
  }
  if (total < 40) return null;

  const margen = 22;
  let s = fraccion * total;
  for (let i = 0; i + 1 < pts.length; i++) {
    const l = largos[i];
    if (s > l) {
      s -= l;
      continue;
    }
    if (l >= margen * 2 + Math.max(cantidad - 1, 0) * 4 + 8) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const t = Math.min(Math.max(s, margen), l - margen);
      const len = Math.hypot(x2 - x1, y2 - y1);
      return {
        x: x1 + ((x2 - x1) * t) / l,
        y: y1 + ((y2 - y1) * t) / l,
        ux: (x2 - x1) / len,
        uy: (y2 - y1) / len,
        // Separación adaptativa si el tramo es corto
        sep: Math.min(SEP_TICKS, Math.max(4, (l - margen * 2) / Math.max(cantidad - 1, 1))),
      };
    }
    // Tramo corto: probá en el centro de este mismo tramo si alcanza,
    // si no seguís recorriendo
    if (l >= 36) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      return {
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        ux: (x2 - x1) / len,
        uy: (y2 - y1) / len,
        sep: SEP_TICKS,
      };
    }
    s -= 0; // seguimos con el resto del acumulado
    break;
  }

  // Fallback: centro del tramo más largo
  let mejor = 0;
  for (let i = 1; i < largos.length; i++) if (largos[i] > largos[mejor]) mejor = i;
  if (largos[mejor] < 30) return null;
  const [x1, y1] = pts[mejor];
  const [x2, y2] = pts[mejor + 1];
  const len = largos[mejor];
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
    ux: (x2 - x1) / len,
    uy: (y2 - y1) / len,
    sep: SEP_TICKS,
  };
}

export default function ConexionEdge({
  id,
  source,
  target,
  targetX,
  targetY,
  sourceX,
  sourceY,
  sourcePosition,
  targetPosition,
  data,
  ...props
}: EdgeProps) {
  /* Dirección EFECTIVA de cualquier extremo (C12): se conserva el EJE
   * declarado del handle (vertical u horizontal) pero la POLARIDAD se
   * deriva de dónde está realmente el otro extremo. Así, si movés un
   * elemento al lado opuesto de la barra (o de cualquier otro nodo),
   * el cable se reorienta sin hacer "S" ni entrar del lado incorrecto
   * — antes solo corregíamos el lado de la barra y el OTRO extremo
   * tiraba del cable con su dirección vieja. */
  const dirEfectiva = (
    propio: { x: number; y: number },
    otro: { x: number; y: number },
    original: Position,
  ): Position => {
    const vertical =
      original === Position.Top || original === Position.Bottom;
    return vertical
      ? otro.y <= propio.y
        ? Position.Top
        : Position.Bottom
      : otro.x <= propio.x
        ? Position.Left
        : Position.Right;
  };
  /* En las barras además el extremo del cable se RECORRE a la
   * superficie visible del eje (≈3 px hacia el otro extremo): el
   * conductor SIEMPRE remata sobre la barra, sin cruzarla. */
  const nodos = useStore((s) => s.nodes);
  const MITAD_EJE = 3;
  const sobreSuperficie = (
    nodeId: string | null | undefined,
    propio: { x: number; y: number },
    otro: { x: number; y: number },
  ): { x: number; y: number } => {
    const n = nodos.find((x) => x.id === nodeId);
    if (!n || n.type !== "barra") return propio;
    const rot = ((((n.data as DatosBarra).rotacion ?? 0) % 180) + 180) % 180;
    return rot !== 0
      ? { x: propio.x + (otro.x <= propio.x ? -MITAD_EJE : MITAD_EJE), y: propio.y }
      : { x: propio.x, y: propio.y + (otro.y <= propio.y ? -MITAD_EJE : MITAD_EJE) };
  };

  const ini = sobreSuperficie(source, { x: sourceX, y: sourceY }, { x: targetX, y: targetY });
  const fin = sobreSuperficie(target, { x: targetX, y: targetY }, { x: sourceX, y: sourceY });

  const d = rutaOrtogonal(
    ini.x,
    ini.y,
    String(dirEfectiva({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, sourcePosition)),
    fin.x,
    fin.y,
    String(dirEfectiva({ x: targetX, y: targetY }, { x: sourceX, y: sourceY }, targetPosition)),
  );
  const m = (data?.atributosConductor as Record<string, unknown> | undefined) ?? {};
  const lineas = lineasMazo(m);
  const fases =
    typeof m.cantidad_conductores === "number" ? m.cantidad_conductores : 0;
  const neutro = m.lleva_neutro === true;
  const tierra = m.lleva_tierra === true;

  /* Conexiones hermanas (mismo origen): escalonan sus marcas y textos
   * a lo largo del recorrido para no apilarse cuando un elemento alimenta
   * varios circuitos desde el mismo handle. */
  const todas = useStore((s) => s.edges);
  const propia = todas.find((e) => e.id === id);
  const clave = propia
    ? `${propia.source}|${propia.sourceHandle ?? ""}`
    : `${id}`;
  const grupo = todas.filter(
    (e) => `${e.source}|${e.sourceHandle ?? ""}` === clave,
  );
  grupo.sort((a, b) => a.id.localeCompare(b.id));
  const indice = grupo.findIndex((e) => e.id === id);
  const fraccion =
    grupo.length > 1 ? (Math.max(indice, 0) + 1) / (grupo.length + 1) : 0.5;

  const totalMarcas = fases + (neutro ? 1 : 0) + (tierra ? 1 : 0);
  const geo = ubicarEnTrayectoria(d, fraccion, totalMarcas);
  const wx = geo ? (geo.ux - geo.uy) / Math.SQRT2 : 0;
  const wy = geo ? (geo.uy + geo.ux) / Math.SQRT2 : 0;
  const h = LARGO_TICK / 2;
  const halfSpan = geo ? ((totalMarcas - 1) / 2) * geo.sep + h : 0;

  // El texto va AL COSTADO DERECHO de las marcas, centrado en altura
  const labelX = geo
    ? geo.x + halfSpan * Math.abs(geo.ux) + h * Math.abs(geo.uy) + 6
    : (sourceX + targetX) / 2;
  const labelY = geo ? geo.y : (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge path={d} {...props} />
      {geo && totalMarcas > 0 && (
        <g stroke="#334155" strokeWidth={1.3} strokeLinecap="round" fill="none">
          {Array.from({ length: totalMarcas }, (_, i) => {
            const t = (i - (totalMarcas - 1) / 2) * geo.sep;
            const cx = geo.x + t * geo.ux;
            const cy = geo.y + t * geo.uy;
            const bx = cx + wx * h;
            const by = cy + wy * h;
            return (
              <g key={i}>
                <line x1={cx - wx * h} y1={cy - wy * h} x2={bx} y2={by} />
                {neutro && i === fases && (
                  <circle cx={bx} cy={by} r={2.8} fill="#fdfdfd" />
                )}
                {tierra && i === fases + (neutro ? 1 : 0) && (
                  <line
                    x1={bx - wy * 3}
                    y1={by + wx * 3}
                    x2={bx + wy * 3}
                    y2={by - wx * 3}
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
