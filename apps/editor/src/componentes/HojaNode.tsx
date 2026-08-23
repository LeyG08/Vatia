import { Handle, Position, type NodeProps } from "@xyflow/react";
import { PX_POR_MM, dimensionesHoja } from "../lib/tipos";
import { useEditor } from "../lib/store";

/** Márgenes del enmarcado en mm (izquierda mayor para archivado) */
const MARGEN_IZQ_MM = 20;
const MARGEN_RESTO_MM = 10;
/** Rótulo: ancho y alto en mm */
const ROTULO_ANCHO_MM = 180;
const ROTULO_ALTO_MM = 32;

function HojaNode(_props: NodeProps) {
  const hoja = useEditor((s) => s.hoja);
  const { pxW, pxH } = dimensionesHoja(hoja);
  const mi = MARGEN_IZQ_MM * PX_POR_MM;
  const mr =
    (MARGEN_RESTO_MM * PX_POR_MM);

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
            width: ROTULO_ANCHO_MM * PX_POR_MM,
            height: ROTULO_ALTO_MM * PX_POR_MM,
          }}
        >
          <div className="rotulo-celda rotulo-empresa">
            <span>Empresa</span>
            <strong>{hoja.rotulo.empresa || "\u00a0"}</strong>
          </div>
          <div className="rotulo-celda">
            <span>Proyecto</span>
            <strong>{hoja.rotulo.proyecto || "\u00a0"}</strong>
          </div>
          <div className="rotulo-celda">
            <span>Ubicación</span>
            <strong>{hoja.rotulo.ubicacion || "\u00a0"}</strong>
          </div>
          <div className="rotulo-celda">
            <span>Plano N°</span>
            <strong>{hoja.rotulo.numero || "\u00a0"}</strong>
          </div>
          <div className="rotulo-celda">
            <span>Escala</span>
            <strong>{hoja.rotulo.escala || "\u00a0"}</strong>
          </div>
          <div className="rotulo-celda">
            <span>Fecha</span>
            <strong>{hoja.rotulo.fecha || "\u00a0"}</strong>
          </div>
          <div className="rotulo-celda">
            <span>Dibujó</span>
            <strong>{hoja.rotulo.dibujo || "\u00a0"}</strong>
          </div>
          <div className="rotulo-celda">
            <span>Revisión</span>
            <strong>{hoja.rotulo.revision || "\u00a0"}</strong>
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
