import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useEditor, type DatosAlimentador } from "../lib/store";
import { lineasMazo } from "../lib/anotaciones";

/** Misma geometría que las marcas de las conexiones (IEC 60617) */
const SEP = 8;
const LARGO = 15;
const ANCHO_LINEA = 132;

/**
 * Alimentación = CONDUCTOR VINIENTE desde el tablero: un cable que entra
 * al esquema con su etiqueta "Desde …" arriba y la notación del mazo
 * abajo, con las mismas marcas normadas que las conexiones (neutro =
 * círculo, tierra = corte). El punto de enganche está en el extremo
 * derecho del cable. La ficha completa se edita desde el panel.
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
  const wx = 1 / Math.SQRT2;
  const wy = 1 / Math.SQRT2;

  return (
    <div className={`nodo-alimentador${selected ? " sel" : ""}`}>
      <input
        className="nodrag alim-origen"
        value={data.origen}
        placeholder="Desde…"
        onChange={(e) => actualizar(id, { origen: e.target.value })}
        title="Procedencia de la alimentación"
      />
      <div className="alim-linea">
        <svg width={ANCHO_LINEA} height={30}>
          <line
            x1={0}
            y1={15}
            x2={ANCHO_LINEA - h}
            y2={15}
            stroke="#1e293b"
            strokeWidth={1.5}
          />
          {total > 0 &&
            Array.from({ length: total }, (_, i) => {
              const cx = ANCHO_LINEA / 2 + (i - (total - 1) / 2) * SEP;
              const cy = 15;
              const bx = cx + wx * h;
              const by = cy - wy * h;
              return (
                <g key={i} stroke="#334155" strokeWidth={1.3} strokeLinecap="round" fill="none">
                  <line x1={cx - wx * h} y1={cy + wy * h} x2={bx} y2={by} />
                  {neutro && i === fases && (
                    <circle cx={bx} cy={by} r={2.6} fill="#fdfdfd" />
                  )}
                  {tierra && i === fases + (neutro ? 1 : 0) && (
                    <line
                      x1={bx - wy * 3}
                      y1={by - wx * 3}
                      x2={bx + wy * 3}
                      y2={by + wx * 3}
                    />
                  )}
                </g>
              );
            })}
        </svg>
      </div>
      {nota.length > 0 && (
        <div className="alim-nota">
          {nota.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} id="salida" />
    </div>
  );
}

export default AlimentadorNode;
