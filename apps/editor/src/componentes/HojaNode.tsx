import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  MARGEN_IZQ_MM,
  MARGEN_RESTO_MM,
  PX_POR_MM,
  dimensionesHoja,
} from "../lib/tipos";
import { useEditor } from "../lib/store";

const mm = (v: number) => v * PX_POR_MM;

/**
 * Plantilla de hoja según los unifilares reales del proyecto: no hay
 * cajetín IRAM. Arriba al centro va el encabezado del tablero con sus
 * alimentadores; a la izquierda las notas constructivas del gabinete;
 * al pie la nota de seguridad operativa cuando corresponde. Los tres
 * bloques son decorativos (no interceptan el mouse) para que nunca
 * estorben el arrastre de símbolos.
 */
function bloqueStyle(style: CSSProperties): CSSProperties {
  return { position: "absolute", pointerEvents: "none", ...style };
}

function HojaNode(_props: NodeProps) {
  const hoja = useEditor((s) => s.hoja);
  const { pxW, pxH } = dimensionesHoja(hoja);
  const mi = mm(MARGEN_IZQ_MM);
  const mr = mm(MARGEN_RESTO_MM);
  const { tablero, alimentadores } = hoja.encabezado;
  const textoChico = { fontSize: mm(2.5), lineHeight: 1.45 };

  return (
    <div
      className="hoja"
      style={{ width: pxW, height: pxH }}
      aria-label="Hoja de plano"
    >
      <div className="hoja-marco" style={{ inset: mr, left: mi }}>
        {/* Encabezado centrado: nombre del tablero + alimentadores */}
        <div
          style={bloqueStyle({
            top: mm(3),
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            color: "#111827",
          })}
        >
          <strong style={{ fontSize: mm(5), lineHeight: 1.15 }}>
            {tablero || "\u00a0"}
          </strong>
          {alimentadores.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: mm(7),
                marginTop: mm(1),
                fontSize: mm(2.8),
                fontWeight: 600,
                whiteSpace: "pre",
              }}
            >
              {alimentadores.map((a, i) => (
                <span key={i}>{a}</span>
              ))}
            </div>
          )}
        </div>

        {/* Notas constructivas del gabinete, una por renglón */}
        {hoja.notasGabinete.length > 0 && (
          <div
            style={bloqueStyle({
              top: mm(16),
              left: mm(6),
              maxWidth: mm(95),
              color: "#111827",
            })}
          >
            {hoja.notasGabinete.map((n, i) => (
              <p key={i} style={{ ...textoChico, margin: 0 }}>
                {n}
              </p>
            ))}
          </div>
        )}

        {/* Nota de seguridad operativa al pie */}
        {hoja.notaSeguridad.trim() !== "" && (
          <div
            style={bloqueStyle({
              bottom: mm(4),
              left: mm(6),
              maxWidth: mm(140),
              color: "#111827",
              whiteSpace: "pre-wrap",
            })}
          >
            <p style={{ ...textoChico, margin: 0 }}>{hoja.notaSeguridad}</p>
          </div>
        )}
      </div>
      {/* handles inertes para que RF no reclame; no conectables */}
      <Handle type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Top} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}

export default HojaNode;
