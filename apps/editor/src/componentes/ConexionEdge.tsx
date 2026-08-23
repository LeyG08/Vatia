import { BaseEdge, type EdgeProps } from "@xyflow/react";
import { rutaOrtogonal } from "../lib/ruta";

export default function ConexionEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
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
  return <BaseEdge path={d} {...props} />;
}
