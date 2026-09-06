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
import type { Hoja } from "./tipos";

export const nodeTypes = {
  simbolo: NodoSimbolo,
  alimentador: AlimentadorNode,
  barra: BarraNode,
  hoja: HojaNode,
} as const;

export const edgeTypes = { conexion: ConexionEdge } as const;

/**
 * Nodo de fondo (marco/rótulo IRAM) que representa la lámina en sí.
 *
 * Devuelve SIEMPRE la misma referencia para una `instancia` dada — nunca
 * un objeto nuevo. Encontrado en vivo: cuando esto era una fábrica que
 * creaba un objeto distinto en cada llamada, el nodo quedaba trabado en
 * `visibility: hidden` para siempre (React Flow mide un nodo por
 * ResizeObserver y nunca terminaba de "engancharlo" si la referencia
 * cambiaba de una pasada a la siguiente — más visible todavía bajo
 * StrictMode, que renderiza el `useMemo` que arma `nodosConHoja` dos
 * veces en la primera pasada). El marco y el rótulo directamente no se
 * veían.
 *
 * `instancia` separa el lienzo interactivo (una sola instancia de
 * `<ReactFlow>`, activa todo el tiempo) de cada página de
 * `ExportacionProyecto.tsx` (una instancia de `<ReactFlow>` por hoja,
 * todas montadas a la vez durante un export): cada una necesita su
 * PROPIO objeto estable — compartir uno solo entre instancias
 * concurrentes de React Flow arriesga que una pise el `measured` que
 * puso la otra.
 *
 * `hojaOverride` (E43): sin esto, `HojaNode` siempre lee la hoja
 * ACTIVA global (`useEditor(s => s.hoja)`) — correcto para el lienzo
 * interactivo (una sola instancia), pero durante "Exportar proyecto"
 * TODAS las instancias leían la misma, así que el rótulo/tablero de
 * cualquier página que no fuera la activa salía mal (bug real,
 * encontrado en vivo con dos hojas de tablero distinto). Se guarda en
 * `data.hojaOverride`, mutado IN SITU sobre el mismo objeto cacheado
 * (nunca se reemplaza el nodo entero) — así una hoja que cambió entre
 * dos exportaciones no queda con datos viejos, pero la referencia del
 * nodo se mantiene estable para no gatillar la regresión de arriba.
 */
const instanciasHoja = new Map<string, Node<NodoData>>();

export function crearNodoHoja(
  instancia = "lienzo",
  hojaOverride?: Hoja,
): Node<NodoData> {
  let nodo = instanciasHoja.get(instancia);
  if (!nodo) {
    nodo = {
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
    instanciasHoja.set(instancia, nodo);
  }
  (nodo.data as { hojaOverride?: Hoja }).hojaOverride = hojaOverride;
  return nodo;
}
