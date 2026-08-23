import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { rutaOrtogonal } from "../lib/ruta";
import { lineasMazo } from "../lib/anotaciones";

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
  const lineas = lineasMazo(
    (data?.atributosConductor as Record<string, unknown> | undefined) ?? {},
  );

  return (
    <>
      <BaseEdge path={d} {...props} />
      {lineas.length > 0 && (
        <EdgeLabelRenderer>
          <div
            className="anotacion-edge"
            style={{
              transform: `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`,
            }}
          >
            {lineas.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
