import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useEditor, type DatosAlimentador } from "../lib/store";
import { etiquetaConductores } from "../lib/tipos";

/**
 * Combinaciones libres de fases / neutro / tierra para la referencia
 * del conductor que sale del alimentador, más el modo "cantidad n de
 * conductores" cuando la alimentación no encaja en esas categorías.
 */
const OPCIONES: { valor: string; etiqueta: string }[] = [
  { valor: "", etiqueta: "—" },
  { valor: "L", etiqueta: "3 líneas" },
  { valor: "LN", etiqueta: "3 líneas + neutro" },
  { valor: "LT", etiqueta: "3 líneas + tierra" },
  { valor: "LNT", etiqueta: "3 líneas + neutro + tierra" },
  { valor: "N", etiqueta: "Neutro" },
  { valor: "T", etiqueta: "Tierra" },
  { valor: "NT", etiqueta: "Neutro + tierra" },
  { valor: "n", etiqueta: "Cantidad n de conductores…" },
];

function AlimentadorNode({
  id,
  data,
  selected,
}: NodeProps<Node<DatosAlimentador>>) {
  const actualizar = useEditor((s) => s.actualizarDatosAlimentador);
  const modoN = data.cantidadN != null;
  const combo = modoN
    ? "n"
    : `${data.fases ? "L" : ""}${data.neutro ? "N" : ""}${data.tierra ? "T" : ""}`;

  const cambiarCombo = (v: string) => {
    if (v === "n") {
      actualizar(id, { cantidadN: data.cantidadN ?? 4 });
      return;
    }
    actualizar(id, {
      cantidadN: null,
      fases: v.includes("L"),
      neutro: v.includes("N"),
      tierra: v.includes("T"),
    });
  };

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
      <select
        className="nodrag alim-combo"
        value={combo}
        onChange={(e) => cambiarCombo(e.target.value)}
        title="Referencia del conductor"
      >
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      {modoN && (
        <label className="alim-fila alim-n">
          <span>n =</span>
          <input
            type="number"
            min={1}
            max={99}
            className="nodrag"
            value={data.cantidadN ?? 1}
            onChange={(e) => {
              const v = Number(e.target.value);
              actualizar(id, {
                cantidadN:
                  Number.isFinite(v) && v > 0 ? Math.min(99, Math.floor(v)) : null,
              });
            }}
          />
          <span>conductores</span>
        </label>
      )}
      <span className="alim-tag">{etiquetaConductores(data)}</span>
      <Handle type="source" position={Position.Bottom} id="salida" />
    </div>
  );
}

export default AlimentadorNode;
