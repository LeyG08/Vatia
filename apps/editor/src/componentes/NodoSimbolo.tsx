import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ESCALA, type NodoData } from "../lib/store";
import { obtenerSimbolo, svgLimpio } from "../lib/libreria";
import type { SimboloDef } from "../lib/tipos";

function posicionBorde(p: { x: number; y: number }, vb: SimboloDef["viewBox"]) {
  const distancias = [
    { pos: Position.Top, d: Math.abs(p.y - vb.minY) },
    { pos: Position.Bottom, d: Math.abs(vb.minY + vb.alto - p.y) },
    { pos: Position.Left, d: Math.abs(p.x - vb.minX) },
    { pos: Position.Right, d: Math.abs(vb.minX + vb.ancho - p.x) },
  ];
  distancias.sort((a, b) => a.d - b.d);
  return distancias[0].pos;
}

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
            position={posicionBorde(p, vb)}
            className={`handle-${p.rol}`}
            style={{
              width: 10,
              height: 10,
              border: "1.5px solid rgba(37, 99, 235, 0.55)",
              borderRadius: "50%",
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
