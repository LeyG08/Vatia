import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { PX_POR_MM, dimensionesHoja } from "../lib/tipos";
import { useEditor } from "../lib/store";

/** Márgenes del enmarcado en mm (izquierda mayor para archivado) */
const MARGEN_IZQ_MM = 20;
const MARGEN_RESTO_MM = 10;

/**
 * Rótulo IRAM 4508:2008 (figura 1): ancho total 175 mm y tres columnas.
 * Columna izquierda (26 mm) con tolerancias generales arriba y escala
 * abajo; columna central (49 mm) con las cuatro filas de responsables,
 * cada una partida en rol / fecha / nombre; columna derecha (100 mm)
 * con cliente, denominación, número de plano del cliente y la fila
 * final formato / número de plano / paginación.
 */
const ROTULO_ANCHO_MM = 175;
const COL_TOL_MM = 26;
const COL_RESP_MM = 49;
const FILA_RESP_MM = 9;

const mm = (v: number) => v * PX_POR_MM;

function Celda({
  etiqueta,
  valor,
  className,
  style,
}: {
  etiqueta: string;
  valor: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className ? `rot-celda ${className}` : "rot-celda"} style={style}>
      <span>{etiqueta}</span>
      <strong>{valor || "\u00a0"}</strong>
    </div>
  );
}

function Responsable({
  rol,
  nombre,
  fecha,
}: {
  rol: string;
  nombre: string;
  fecha: string;
}) {
  return (
    <div className="rot-resp">
      <span className="rot-rol">{rol}</span>
      <span className="rot-fecha">{fecha || "\u00a0"}</span>
      <span className="rot-nombre">{nombre || "\u00a0"}</span>
    </div>
  );
}

function HojaNode(_props: NodeProps) {
  const hoja = useEditor((s) => s.hoja);
  const r = hoja.rotulo;
  const { pxW, pxH } = dimensionesHoja(hoja);
  const mi = mm(MARGEN_IZQ_MM);
  const mr = mm(MARGEN_RESTO_MM);

  return (
    <div
      className="hoja"
      style={{ width: pxW, height: pxH }}
      aria-label="Hoja de plano"
    >
      <div className="hoja-marco" style={{ inset: mr, left: mi }}>
        <div
          className="hoja-rotulo"
          style={{
            width: mm(ROTULO_ANCHO_MM),
            height: mm(FILA_RESP_MM * 4 + 18),
            gridTemplateColumns: `${mm(COL_TOL_MM)}px ${mm(COL_RESP_MM)}px 1fr`,
            gridTemplateRows: `repeat(4, ${mm(FILA_RESP_MM)}px) 1fr`,
          }}
        >
          {/* Columna izquierda: tolerancias generales */}
          <div className="rot-tol rot-celda">
            <span>Tolerancias generales</span>
            <p>{r.tolerancias || "\u00a0"}</p>
          </div>

          {/* Columna central: responsables con fecha y nombre */}
          <Responsable rol="Proyecto" nombre={r.proyectoNombre} fecha={r.proyectoFecha} />
          <Responsable rol="Dibujó" nombre={r.dibujoNombre} fecha={r.dibujoFecha} />
          <Responsable rol="Revisó" nombre={r.revisionNombre} fecha={r.revisionFecha} />
          <Responsable rol="Aprobó" nombre={r.aprobacionNombre} fecha={r.aprobacionFecha} />

          {/* Franja inferior izquierda: escala junto al método ISO (E) */}
          <div className="rot-escala rot-celda">
            <span>Escala · Método ISO (E)</span>
            <strong>{r.escala || "\u00a0"}</strong>
            <em>{"ISO\u00a0(E)"}</em>
          </div>

          {/* Columna derecha: cliente / denominación / n° plano cliente / fila final */}
          <div className="rot-info">
            <Celda className="rot-cliente" etiqueta="Cliente" valor={r.cliente} style={{ height: mm(12) }} />

            <div className="rot-denominacion">
              <em>{r.empresa || "\u00a0"}</em>
              <strong>{r.denominacion || "\u00a0"}</strong>
              {r.archivo && <small>{r.archivo}</small>}
            </div>

            <Celda
              className="rot-numcliente"
              etiqueta="N° de plano del cliente"
              valor={r.numeroCliente}
              style={{ height: mm(9) }}
            />

            <div className="rot-final" style={{ height: mm(9) }}>
              <Celda className="rot-formato" etiqueta="Formato" valor={hoja.formato} />
              <Celda className="rot-numero" etiqueta="N° de plano" valor={r.numero} />
              <Celda className="rot-pag" etiqueta="Página" valor="1/1" />
            </div>
          </div>
        </div>
      </div>
      {/* handles inertes para que RF no reclame; no conectables */}
      <Handle type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Top} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}

export default HojaNode;
