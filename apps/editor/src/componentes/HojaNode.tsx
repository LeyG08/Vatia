import { Handle, Position, type NodeProps } from "@xyflow/react";
import { PX_POR_MM, dimensionesHoja } from "../lib/tipos";
import { useEditor } from "../lib/store";

/** Márgenes del enmarcado en mm (izquierda mayor para archivado) */
const MARGEN_IZQ_MM = 20;
const MARGEN_RESTO_MM = 10;
/** Rótulo IRAM 4508: ancho total y alturas de franjas en mm */
const ROTULO_ANCHO_MM = 170;
const ALTO_TITULO_MM = 14;
const ALTO_MEDIA_MM = 12;
const ALTO_RESPONSABLES_MM = 16;

const mm = (v: number) => v * PX_POR_MM;

function Celda({
  etiqueta,
  valor,
  sub,
  className,
}: {
  etiqueta: string;
  valor: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={className ? `rotulo-celda ${className}` : "rotulo-celda"}>
      <span>{etiqueta}</span>
      <strong>{valor || "\u00a0"}</strong>
      {sub !== undefined && <em>{sub || "\u00a0"}</em>}
    </div>
  );
}

function HojaNode(_props: NodeProps) {
  const hoja = useEditor((s) => s.hoja);
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
            height: mm(ALTO_TITULO_MM + ALTO_MEDIA_MM + ALTO_RESPONSABLES_MM),
          }}
        >
          {/* Franja superior: denominación del plano */}
          <div
            className="rotulo-titulo"
            style={{ height: mm(ALTO_TITULO_MM) }}
          >
            <span>Denominación</span>
            <strong>{hoja.rotulo.titulo || "\u00a0"}</strong>
          </div>

          {/* Fila media: cliente / número de plano / escala */}
          <div
            className="rotulo-fila-media"
            style={{ height: mm(ALTO_MEDIA_MM) }}
          >
            <Celda className="rotulo-cliente" etiqueta="Cliente" valor={hoja.rotulo.cliente} />
            <Celda className="rotulo-numero" etiqueta="Plano N°" valor={hoja.rotulo.numero} />
            <Celda className="rotulo-escala" etiqueta="Escala" valor={hoja.rotulo.escala} />
          </div>

          {/* Fila inferior: responsables y fechas */}
          <div
            className="rotulo-responsables"
            style={{ height: mm(ALTO_RESPONSABLES_MM) }}
          >
            <Celda
              etiqueta="Proyectó"
              valor={hoja.rotulo.proyectoNombre}
              sub={hoja.rotulo.proyectoFecha}
            />
            <Celda
              etiqueta="Dibujó"
              valor={hoja.rotulo.dibujoNombre}
              sub={hoja.rotulo.dibujoFecha}
            />
            <Celda
              etiqueta="Revisó"
              valor={hoja.rotulo.revisionNombre}
              sub={hoja.rotulo.revisionFecha}
            />
            <Celda
              etiqueta="Aprobó"
              valor={hoja.rotulo.aprobacionNombre}
              sub={hoja.rotulo.aprobacionFecha}
            />
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
