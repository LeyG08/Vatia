import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useEditor, type DatosAlimentador } from "../lib/store";
import { lineasMazo } from "../lib/anotaciones";

/** Misma geometría que las marcas de las conexiones (IEC 60617) */
const SEP = 8;
const LARGO = 15;
const ALTO_LINEA = 88;

/**
 * Alimentación = CONDUCTOR VINIENTE desde el tablero, en VERTICAL:
 * baja desde arriba con su etiqueta «Desde …» a la izquierda y la
 * notación del mazo al costado derecho (igual que las conexiones),
 * con las mismas marcas normadas (neutro = círculo, tierra = corte).
 * El enganche está en el extremo inferior del cable.
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
      <input
        className="nodrag alim-origen"
        value={data.origen}
        placeholder="Desde…"
        onChange={(e) => actualizar(id, { origen: e.target.value })}
        title="Procedencia de la alimentación"
      />
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
            const cx = 15;
            const cy = ALTO_LINEA / 2 + (i - (total - 1) / 2) * SEP;
            const bx = cx + wx * h;
            const by = cy + wy * h;
            return (
              <g key={i} stroke="#334155" strokeWidth={1.3} strokeLinecap="round" fill="none">
                <line x1={cx - wx * h} y1={cy - wy * h} x2={bx} y2={by} />
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
      {nota.length > 0 && (
        <div className="alim-nota">
          {nota.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="salida" />
    </div>
  );
}

export default AlimentadorNode;
