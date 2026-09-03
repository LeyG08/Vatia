/**
 * Registro de tipos de nodo/conexión de React Flow, compartido entre el
 * lienzo interactivo (App.tsx) y la vista de impresión de todas las hojas
 * (componentes/ExportacionProyecto.tsx) — las dos montan instancias de
 * `<ReactFlow>` y tienen que dibujar los símbolos EXACTAMENTE igual, así
 * que usan el mismo `nodeTypes`/`edgeTypes`, no una copia.
 */
import type { Node } from "@xyflow/react";
import NodoSimbolo from "../componentes/NodoSimbolo";
import AlimentadorNode from "../componentes/AlimentadorNode";
import BarraNode from "../componentes/BarraNode";
import HojaNode from "../componentes/HojaNode";
import ConexionEdge from "../componentes/ConexionEdge";
import type { NodoData } from "./store";

export const nodeTypes = {
  simbolo: NodoSimbolo,
  alimentador: AlimentadorNode,
  barra: BarraNode,
  hoja: HojaNode,
} as const;

export const edgeTypes = { conexion: ConexionEdge } as const;

/** Nodo de fondo (marco/rótulo IRAM) que representa la lámina en sí. */
export function crearNodoHoja(): Node<NodoData> {
  return {
    id: "hoja",
    type: "hoja",
    position: { x: 0, y: 0 },
    data: { codigo_iec: "", rotacion: 0, atributos: {} },
    draggable: false,
    selectable: false,
    deletable: false,
    connectable: false,
    style: { zIndex: -1 } as React.CSSProperties,
    // Exenta del clamp global: la lámina es MÁS grande que el marco útil
    extent: [
      [-100000, -100000],
      [100000, 100000],
    ],
  };
}
