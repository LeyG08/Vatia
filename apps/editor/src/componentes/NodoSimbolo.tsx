import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ESCALA, type NodoData } from "../lib/store";
import { obtenerSimbolo, svgLimpio } from "../lib/libreria";

const POSICION_POR_ROL = {
  entrada: Position.Top,
  salida: Position.Bottom,
  tierra: Position.Top,
} as const;

function NodoSimbolo({ data }: NodeProps<Node<NodoData>>) {
  const simbolo = obtenerSimbolo(data.codigo_iec);

  if (!simbolo) {
    return <div className="nodo-faltante">? {data.codigo_iec}</div>;
  }

  const vb = simbolo.viewBox;
  const anchoPx = Math.max(1, Math.round(vb.ancho * ESCALA));
  const altoPx = Math.max(1, Math.round(vb.alto * ESCALA));

  return (
    <div
      className="nodo-simbolo"
      style={{ width: anchoPx, height: altoPx }}
      title={simbolo.metadata.nombre}
    >
      <div
        className="nodo-simbolo-inner"
        style={{ transform: `rotate(${data.rotacion}deg)` }}
      >
        <div
          className="simbolo-svg"
          dangerouslySetInnerHTML={{ __html: svgLimpio(simbolo.svgRaw) }}
        />
        {simbolo.metadata.puntos_conexion.map((p) => (
          <Handle
            key={p.id}
            id={p.id}
            type={p.rol === "salida" ? "source" : "target"}
            position={POSICION_POR_ROL[p.rol]}
            className={`handle-${p.rol}`}
            style={{
              width: 8,
              height: 8,
              border: "none",
              background: "transparent",
              pointerEvents: "all",
              left: `${((p.x - vb.minX) / vb.ancho) * 100}%`,
              top: `${((p.y - vb.minY) / vb.alto) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default NodoSimbolo;
