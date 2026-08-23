import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useEditor, type DatosAlimentador } from "../lib/store";
import { lineasMazo } from "../lib/anotaciones";

/** Misma geometría que las marcas de las conexiones (IEC 60617) */
const SEP = 8;
const LARGO = 15;
const ALTO_LINEA = 88;

/* Posición EXACTA de la punta del cable dentro del nodo:
   borde(1) + padding(2) + etiqueta(58) + gap(4) + centro del svg(15)
   = 80 → MÚLTIPLO DE LA GRILLA: alineado con los símbolos, la
   conexión vertical sale recta sin desvíos. */
const CABLE_X = 80;
/* borde(1) + padding(2) + largo de la línea (88) */
const PUNTA_Y = 91;

/**
 * Alimentación = CONDUCTOR VINIENTE desde el tablero, en VERTICAL.
 * Caja mínima: etiqueta «Desde …» con la notación debajo, y el cable a
 * la derecha con sus marcas normadas (neutro = círculo, tierra =
 * corte). El punto de conexión está EXACTAMENTE en la punta inferior
 * del cable.
 */
function AlimentadorNode({
  id,
  data,
  selected,
}: NodeProps<Node<DatosAlimentador>>) {
  const actualizar = useEditor((s) => s.actualizarDatosAlimentador);
  const attrs = data.atributos ?? {};
  const nota = lineasMazo(attrs);

  const fases =
    typeof attrs.cantidad_conductores === "number"
      ? attrs.cantidad_conductores
      : 0;
  const neutro = attrs.lleva_neutro === true;
  const tierra = attrs.lleva_tierra === true;
  const total = fases + (neutro ? 1 : 0) + (tierra ? 1 : 0);
  const h = LARGO / 2;
  // Línea vertical hacia abajo → trazo inclinado a 45°
  const wx = -1 / Math.SQRT2;
  const wy = 1 / Math.SQRT2;

  return (
    <div className={`nodo-alimentador${selected ? " sel" : ""}`}>
      <div className="alim-col">
        <span className="alim-desde">Desde</span>
        <input
          className="nodrag alim-origen"
          value={data.origen}
          placeholder="TGBT"
          onChange={(e) => actualizar(id, { origen: e.target.value })}
          title="Procedencia de la alimentación"
        />
        {nota.length > 0 && (
          <div className="alim-nota">
            {nota.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </div>
      <svg className="alim-linea" width={30} height={ALTO_LINEA}>
        <line
          x1={15}
          y1={0}
          x2={15}
          y2={ALTO_LINEA - 4}
          stroke="#1e293b"
          strokeWidth={1.5}
        />
        {total > 0 &&
          Array.from({ length: total }, (_, i) => {
            const cy = ALTO_LINEA / 2 + (i - (total - 1) / 2) * SEP;
            const bx = 15 + wx * h;
            const by = cy + wy * h;
            return (
              <g key={i} stroke="#334155" strokeWidth={1.3} strokeLinecap="round" fill="none">
                <line x1={15 - wx * h} y1={cy - wy * h} x2={bx} y2={by} />
                {neutro && i === fases && (
                  <circle cx={bx} cy={by} r={2.6} fill="#fdfdfd" />
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
      </svg>
      {/* El punto de conexión va JUSTO en la punta inferior del cable */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="salida"
        style={{
          left: CABLE_X,
          top: PUNTA_Y,
          bottom: "auto",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}

export default AlimentadorNode;
