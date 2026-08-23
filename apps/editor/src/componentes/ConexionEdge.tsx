import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { rutaOrtogonal } from "../lib/ruta";
import { textoMazo } from "../lib/anotaciones";

export default function ConexionEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  ...props
}: EdgeProps) {
  const d = rutaOrtogonal(
    sourceX,
    sourceY,
    String(sourcePosition),
    targetX,
    targetY,
    String(targetPosition),
  );
  const texto = textoMazo(
    (data?.atributosConductor as Record<string, unknown> | undefined) ?? {},
  );

  return (
    <>
      <BaseEdge path={d} {...props} />
      {texto && (
        <EdgeLabelRenderer>
          <div
            className="anotacion-edge"
            style={{
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`,
            }}
          >
            {texto}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
