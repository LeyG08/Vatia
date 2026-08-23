import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ESCALA, type DatosSimbolo } from "../lib/store";
import { obtenerSimbolo, svgLimpio } from "../lib/libreria";
import { anotacionNodo } from "../lib/anotaciones";
import type { SimboloDef } from "../lib/tipos";

const DIRECCIONES = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
];

function direccionBase(p: { x: number; y: number }, vb: SimboloDef["viewBox"]) {
  const distancias = [
    { i: 0, d: Math.abs(p.y - vb.minY) },
    { i: 1, d: Math.abs(vb.minX + vb.ancho - p.x) },
    { i: 2, d: Math.abs(vb.minY + vb.alto - p.y) },
    { i: 3, d: Math.abs(p.x - vb.minX) },
  ];
  distancias.sort((a, b) => a.d - b.d);
  return distancias[0].i;
}

interface PuntoRotado {
  x: number;
  y: number;
  cajaAncho: number;
  cajaAlto: number;
  direccion: Position;
}

function rotarPunto(
  p: { x: number; y: number },
  vb: SimboloDef["viewBox"],
  rotacion: number,
): PuntoRotado {
  const x = p.x - vb.minX;
  const y = p.y - vb.minY;
  const giro = (((rotacion % 360) + 360) % 360) / 90;
  let rx = x;
  let ry = y;
  let ancho = vb.ancho;
  let alto = vb.alto;

  if (giro === 1) {
    rx = vb.alto - y;
    ry = x;
    ancho = vb.alto;
    alto = vb.ancho;
  } else if (giro === 2) {
    rx = vb.ancho - x;
    ry = vb.alto - y;
  } else if (giro === 3) {
    rx = y;
    ry = vb.ancho - x;
    ancho = vb.alto;
    alto = vb.ancho;
  }

  return {
    x: rx,
    y: ry,
    cajaAncho: ancho,
    cajaAlto: alto,
    direccion: DIRECCIONES[(direccionBase(p, vb) + giro) % 4],
  };
}

function NodoSimbolo({ data }: NodeProps<Node<DatosSimbolo>>) {
  const simbolo = obtenerSimbolo(data.codigo_iec);

  if (!simbolo) {
    return <div className="nodo-faltante">? {data.codigo_iec}</div>;
  }

  const vb = simbolo.viewBox;
  const rotacion = ((data.rotacion % 360) + 360) % 360;
  const puntos = simbolo.metadata.puntos_conexion.map((p) => ({
    punto: p,
    r: rotarPunto(p, vb, rotacion),
  }));
  const caja = puntos[0]?.r ?? {
    cajaAncho: vb.ancho,
    cajaAlto: vb.alto,
  };
  const anchoPx = Math.max(1, Math.round(caja.cajaAncho * ESCALA));
  const altoPx = Math.max(1, Math.round(caja.cajaAlto * ESCALA));
  const esCarga = simbolo.metadata.familia_atributos === "carga";
  const lineas = anotacionNodo(simbolo.metadata.familia_atributos, data);

  return (
    <div
      className="nodo-simbolo"
      style={{ width: anchoPx, height: altoPx }}
      title={simbolo.metadata.nombre}
    >
      <div
        className="simbolo-svg"
        style={{
          width: Math.max(1, Math.round(vb.ancho * ESCALA)),
          height: Math.max(1, Math.round(vb.alto * ESCALA)),
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) rotate(${rotacion}deg)`,
        }}
        dangerouslySetInnerHTML={{ __html: svgLimpio(simbolo.svgRaw) }}
      />
      {puntos.map(({ punto, r }) => (
        <Handle
          key={punto.id}
          id={punto.id}
          type={punto.rol === "salida" ? "source" : "target"}
          position={r.direccion}
          className={`handle-${punto.rol}`}
          style={{
            width: 10,
            height: 10,
            border: "1.5px solid rgba(37, 99, 235, 0.55)",
            borderRadius: "50%",
            background: "transparent",
            pointerEvents: "all",
            left: `${(r.x / r.cajaAncho) * 100}%`,
            top: `${(r.y / r.cajaAlto) * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
      {lineas.length > 0 && (
        <div
          className={`anotacion-nodo${esCarga ? " anotacion-carga" : ""}`}
        >
          {lineas.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NodoSimbolo;
