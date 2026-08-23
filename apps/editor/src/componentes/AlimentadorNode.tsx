import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useEditor, type DatosAlimentador } from "../lib/store";
import { lineasMazo } from "../lib/anotaciones";

/** Misma geometría que las marcas de las conexiones (IEC 60617) */
const SEP = 8;
const LARGO = 15;

/**
 * Alimentador "Desde …": referencia de la alimentación del tablero.
 * Mismo lenguaje visual que las conexiones — marcas oblicuas por
 * conductor (neutro con círculo, tierra cortada) y la notación del
 * mazo al costado — más el campo "Desde" editable en el propio nodo.
 * La ficha completa se edita desde el panel (mismo formulario que una
 * conexión).
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
  const w = Math.max((total - 1) * SEP, 0) + 2 * h + 4;
  const wx = 1 / Math.SQRT2;
  const wy = 1 / Math.SQRT2;

  return (
    <div className={`nodo-alimentador${selected ? " sel" : ""}`}>
      <div className="alim-fila">
        <span className="alim-desde">Desde</span>
        <input
          className="nodrag alim-origen"
          value={data.origen}
          placeholder="TGBT"
          onChange={(e) => actualizar(id, { origen: e.target.value })}
        />
      </div>
      {total > 0 && (
        <div className="alim-mazo">
          <svg width={w} height={30} aria-hidden>
            <g stroke="#334155" strokeWidth={1.3} strokeLinecap="round" fill="none">
              {Array.from({ length: total }, (_, i) => {
                const cx = w / 2 + (i - (total - 1) / 2) * SEP;
                const cy = 15;
                const bx = cx + wx * h;
                const by = cy - wy * h;
                return (
                  <g key={i}>
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
            </g>
          </svg>
          {nota.length > 0 && (
            <div className="alim-nota">
              {nota.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="salida" />
    </div>
  );
}

export default AlimentadorNode;
