import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  useStore,
  useStoreApi,
  type EdgeProps,
} from "@xyflow/react";
import { useRef } from "react";
import { GRILLA_PX, rutaOrtogonal } from "../lib/ruta";
import { lineasCable } from "../lib/anotaciones";
import { useEditor } from "../lib/store";

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

/**
 * E82 — color del cable segun el riel del que sale.
 *
 * Un multifilar con tres fases es ilegible si las tres lineas son del
 * mismo negro: lo que distingue una fase de otra en el tablero real es
 * el color del conductor, y el plano tiene que decir lo mismo. El color
 * NO se guarda en el cable: se lee del riel que tiene en la punta, asi
 * que cambiar la etiqueta del riel de L2 a L3 repinta sus cables solo.
 *
 * Devuelve `null` cuando ningun extremo es un riel con funcion
 * declarada — un cable que no toca ningun riel se queda en tinta, no se
 * le inventa una fase que el dibujo no declara.
 */
function colorDeRiel(atributos: Record<string, unknown> | undefined): string | null {
  if (!atributos || atributos.tipo_barra !== "riel_multifilar") return null;
  const funcion = atributos.funcion_riel;
  if (funcion === "neutro") return "var(--neutro)";
  if (funcion === "tierra") return "var(--tierra)";
  if (funcion !== "fase_viva") return null;
  const etiqueta =
    typeof atributos.etiqueta_fase === "string"
      ? atributos.etiqueta_fase.trim().toUpperCase()
      : "";
  if (etiqueta === "L1") return "var(--fase-l1)";
  if (etiqueta === "L2") return "var(--fase-l2)";
  if (etiqueta === "L3") return "var(--fase-l3)";
  return "var(--fase)";
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
  style,
  selected,
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
  /* C13: el extremo del cable termina EXACTAMENTE sobre el centro del
   * eje de la barra (banda oscura de 5 px): aunque el navegador tarde
   * un tick en medir el handle durante el arrastre, el conductor
   * SIEMPRE se ve unido. El recorte de ±3 px a la superficie visible
   * quedó descartado: con elementos cruzados de lado dejaba un hueco
   * apreciable entre el cable y la barra. */
  /* C22: mientras el usuario arrastra UNA punta de este cable
   * (conexión nueva o reconexión) el quiebre intermedio va SIN snap:
   * sigue al puntero de forma continua y no da saltos bruscos de
   * grilla. Al soltar, la ruta queda con el criterio definitivo.
   * (Acceso tolerante: el shape del estado de conexión cambió entre
   * versiones de React Flow — nodeId vs startHandle.nodeId.) */
  const vuelo = useStore(
    (s) => s.connection as unknown as {
      inProgress: boolean;
      edgeId?: string;
      nodeId?: string;
      startHandle?: { nodeId?: string };
    },
  );
  const propiaVuela =
    vuelo.inProgress &&
    (vuelo.edgeId === id ||
      vuelo.nodeId === source ||
      vuelo.nodeId === target ||
      vuelo.startHandle?.nodeId === source ||
      vuelo.startHandle?.nodeId === target);
  /* C29: quiebre arrastrable — data.paso fuerza una esquina exacta.
   * Mientras se arrastra una punta (vuelo) la ruta automática manda. */
  const paso =
    ((data?.paso as { x: number; y: number } | null | undefined) ?? null);
  const d = rutaOrtogonal(
    sourceX,
    sourceY,
    String(dirEfectiva({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, sourcePosition)),
    targetX,
    targetY,
    String(dirEfectiva({ x: targetX, y: targetY }, { x: sourceX, y: sourceY }, targetPosition)),
    propiaVuela,
    propiaVuela ? null : paso,
  );
  /* El color se resuelve mirando los DOS extremos: da igual si el riel
   * quedo como origen o como destino del cable. */
  const colorFase = useStore((st) => {
    const nodoDe = (idNodo: string) =>
      (st.nodeLookup.get(idNodo)?.data as { atributos?: Record<string, unknown> } | undefined)
        ?.atributos;
    return colorDeRiel(nodoDe(source)) ?? colorDeRiel(nodoDe(target));
  });

  const m = (data?.atributosConductor as Record<string, unknown> | undefined) ?? {};
    const lineas = lineasCable(m);
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

  /* ---- C29: grip del quiebre (visible con el cable seleccionado) ---- */
  const moverPaso = useEditor((s) => s.moverPasoConexion);
  const confirmarPaso = useEditor((s) => s.confirmarPasoConexion);
  const limpiarPaso = useEditor((s) => s.limpiarPasoConexion);
  const api = useStoreApi();
  const antesRef = useRef<{ x: number; y: number } | null>(null);

  // Posición del grip: la esquina forzada si existe; si no, el punto
  // medio del recorrido automático (arrastrarla lo CREA ahí).
  let gripX: number;
  let gripY: number;
  if (paso) {
    gripX = Math.round(paso.x / GRILLA_PX) * GRILLA_PX;
    gripY = Math.round(paso.y / GRILLA_PX) * GRILLA_PX;
  } else {
    const pts = puntosDe(d);
    let total = 0;
    for (let i = 0; i + 1 < pts.length; i++)
      total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    let restante = total / 2;
    gripX = (sourceX + targetX) / 2;
    gripY = (sourceY + targetY) / 2;
    for (let i = 0; i + 1 < pts.length; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (restante <= l) {
        gripX = pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * restante) / l;
        gripY = pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * restante) / l;
        break;
      }
      restante -= l;
    }
  }

  const agarrarPaso = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    antesRef.current = paso ? { ...paso } : null;
    const move = (ev: PointerEvent) => {
      const estado = api.getState();
      const t = estado.transform;
      const rect = estado.domNode?.getBoundingClientRect();
      if (!rect) return;
      moverPaso(id, {
        x: (ev.clientX - rect.left - t[0]) / t[2],
        y: (ev.clientY - rect.top - t[1]) / t[2],
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      confirmarPaso(id, antesRef.current);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <>
      <BaseEdge
        path={d}
        style={
          // La seleccion manda sobre el color de fase: hay que poder ver
          // cual es el cable que se esta por mover.
          colorFase && !selected ? { ...style, stroke: colorFase } : style
        }
      />
      {geo && totalMarcas > 0 && (
        /* E80 — color por función del conductor (pedido explícito: "en la
         * parte de unifilar, para hacer más sencilla el plano visual,
         * agregá colores por fase, neutro y tierra y en sus conexiones").
         *
         * En un unifilar la LÍNEA es una sola para todo el cable, así que
         * no hay un color único que la describa: lo que sí describe la
         * composición son estas marcas, que ya dicen cuántas fases lleva
         * y si lleva neutro y tierra. Cada marca toma ahora el color de
         * su función según el código AEA — marrón la fase, celeste el
         * neutro, verde el PE — y así la composición se lee de un
         * vistazo, sin leer la anotación. El trazo del cable en sí sigue
         * siendo tinta: es el circuito, no una fase. */
        <g strokeWidth={1.3} strokeLinecap="round" fill="none">
          {Array.from({ length: totalMarcas }, (_, i) => {
            const t = (i - (totalMarcas - 1) / 2) * geo.sep;
            const cx = geo.x + t * geo.ux;
            const cy = geo.y + t * geo.uy;
            const bx = cx + wx * h;
            const by = cy + wy * h;
            const esNeutro = neutro && i === fases;
            const esTierra = tierra && i === fases + (neutro ? 1 : 0);
            const clase = esTierra
              ? "marca-tierra"
              : esNeutro
                ? "marca-neutro"
                : "marca-fase";
            return (
              <g key={i} className={clase}>
                <line x1={cx - wx * h} y1={cy - wy * h} x2={bx} y2={by} />
                {esNeutro && <circle cx={bx} cy={by} r={2.8} className="marca-neutro-punto" />}
                {esTierra && (
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
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="paso-grip nodrag nopan"
            data-edge={id}
            title="Arrastrá para mover el quiebre · clic derecho lo quita"
            style={{
              transform: `translate(-50%, -50%) translate(${gripX}px, ${gripY}px)`,
            }}
            onPointerDown={agarrarPaso}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              limpiarPaso(id);
            }}
          />
        </EdgeLabelRenderer>
      )}
    </>
  );
}
