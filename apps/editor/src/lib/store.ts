import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { Historial, type Comando } from "./historial";
import { obtenerSimbolo } from "./libreria";
import type { NodoProyecto, ProyectoJSON } from "./tipos";

export const ESCALA = 2;
export const PASO_ROTACION = 90;

export interface NodoData extends Record<string, unknown> {
  codigo_iec: string;
  rotacion: number;
}

interface EstadoEditor {
  nodos: Node<NodoData>[];
  conexiones: Edge[];
  nombreProyecto: string;
  problemasProyecto: string[];
  version: number;
  agregarSimbolo: (codigoIec: string, x: number, y: number) => void;
  onNodesChange: (cambios: NodeChange<Node<NodoData>>[]) => void;
  onEdgesChange: (cambios: EdgeChange[]) => void;
  onConnect: (conexion: Connection) => void;
  registrarArrastre: (ids: string[]) => void;
  confirmarArrastre: (
    despues: Record<string, { x: number; y: number }>,
  ) => void;
  rotarSeleccion: () => void;
  eliminarSeleccion: () => void;
  deshacer: () => void;
  rehacer: () => void;
  setNombreProyecto: (nombre: string) => void;
  cargarProyecto: (proyecto: ProyectoJSON) => void;
  serializarActual: () => ProyectoJSON;
}

function proximoId(existentes: { id: string }[], prefijo: string): string {
  let max = 0;
  for (const e of existentes) {
    const m = e.id.match(new RegExp(`^${prefijo}(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefijo}${max + 1}`;
}

const historial = new Historial();
let arrastreEnCurso: Record<string, { x: number; y: number }> | null = null;

export const useEditor = create<EstadoEditor>((set, get) => {
  function ejecutar(cmd: Comando): void {
    historial.ejecutar(cmd);
    set({ version: get().version + 1 });
  }

  return {
    nodos: [],
    conexiones: [],
    nombreProyecto: "proyecto_sin_nombre",
    problemasProyecto: [],
    version: 0,

    agregarSimbolo(codigoIec, x, y) {
      const simbolo = obtenerSimbolo(codigoIec);
      if (!simbolo) return;
      const nodo: Node<NodoData> = {
        id: proximoId(get().nodos, "n"),
        type: "simbolo",
        position: { x, y },
        data: { codigo_iec: codigoIec, rotacion: 0 },
        selected: true,
      };
      ejecutar({
        descripcion: `agregar ${codigoIec}`,
        do: () => set((s) => ({ nodos: [...s.nodos.map((n) => ({ ...n, selected: false })), nodo] })),
        undo: () => set((s) => ({ nodos: s.nodos.filter((n) => n.id !== nodo.id) })),
      });
    },

    onNodesChange(cambios) {
      set((s) => ({ nodos: applyNodeChanges(cambios, s.nodos) }));
    },

    onEdgesChange(cambios) {
      set((s) => ({ conexiones: applyEdgeChanges(cambios, s.conexiones) }));
    },

    onConnect(conexion) {
      if (!conexion.source || !conexion.target) return;
      if (conexion.source === conexion.target) return;
      const edge: Edge = {
        id: proximoId(get().conexiones, "c"),
        source: conexion.source,
        sourceHandle: conexion.sourceHandle,
        target: conexion.target,
        targetHandle: conexion.targetHandle,
        type: "step",
      };
      ejecutar({
        descripcion: `conectar ${edge.id}`,
        do: () => set((s) => ({ conexiones: addEdge(edge, s.conexiones) })),
        undo: () =>
          set((s) => ({
            conexiones: s.conexiones.filter((e) => e.id !== edge.id),
          })),
      });
    },

    registrarArrastre(ids) {
      arrastreEnCurso = {};
      for (const n of get().nodos) {
        if (ids.includes(n.id)) {
          arrastreEnCurso[n.id] = { ...n.position };
        }
      }
    },

    confirmarArrastre(despues) {
      if (!arrastreEnCurso) return;
      const snapshotAntes = arrastreEnCurso;
      arrastreEnCurso = null;
      const ids = Object.keys(despues).filter(
        (id) =>
          snapshotAntes[id] &&
          (snapshotAntes[id].x !== despues[id].x ||
            snapshotAntes[id].y !== despues[id].y),
      );
      if (ids.length === 0) return;
      ejecutar({
        descripcion: "mover nodos",
        do: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              despues[n.id]
                ? { ...n, position: { ...despues[n.id] } }
                : n,
            ),
          })),
        undo: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              snapshotAntes[n.id]
                ? { ...n, position: { ...snapshotAntes[n.id] } }
                : n,
            ),
          })),
      });
    },

    rotarSeleccion() {
      const seleccionadas = get().nodos.filter((n) => n.selected);
      if (seleccionadas.length === 0) return;
      const antes = new Map(
        seleccionadas.map((n) => [n.id, n.data.rotacion] as const),
      );
      const despuesRot = PASO_ROTACION;
      ejecutar({
        descripcion: "rotar selección",
        do: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              antes.has(n.id)
                ? {
                    ...n,
                    data: { ...n.data, rotacion: (antes.get(n.id)! + despuesRot) % 360 },
                  }
                : n,
            ),
          })),
        undo: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              antes.has(n.id)
                ? { ...n, data: { ...n.data, rotacion: antes.get(n.id)! } }
                : n,
            ),
          })),
      });
    },

    eliminarSeleccion() {
      const nodosSel = get().nodos.filter((n) => n.selected);
      const edgesSel = get().conexiones.filter((e) => e.selected);
      if (nodosSel.length === 0 && edgesSel.length === 0) return;
      const idsNodos = new Set(nodosSel.map((n) => n.id));
      const snapshotNodos = get().nodos;
      const snapshotEdges = get().conexiones;
      ejecutar({
        descripcion: "eliminar selección",
        do: () =>
          set((s) => ({
            nodos: s.nodos.filter((n) => !idsNodos.has(n.id)),
            conexiones: s.conexiones.filter(
              (e) =>
                !idsNodos.has(e.source) &&
                !idsNodos.has(e.target) &&
                !edgesSel.some((se) => se.id === e.id),
            ),
          })),
        undo: () => set({ nodos: snapshotNodos, conexiones: snapshotEdges }),
      });
    },

    deshacer() {
      if (historial.deshacer()) set({ version: get().version + 1 });
    },

    rehacer() {
      if (historial.rehacer()) set({ version: get().version + 1 });
    },

    setNombreProyecto(nombre) {
      set({ nombreProyecto: nombre });
    },

    cargarProyecto(proyecto) {
      const nodos: Node<NodoData>[] = [];
      const problemas: string[] = [];
      for (const n of proyecto.nodos ?? []) {
        const simbolo = obtenerSimbolo(n.codigo_iec);
        if (!simbolo) {
          problemas.push(
            `nodo ${n.id}: código ${n.codigo_iec} no existe en la librería — se omite`,
          );
          continue;
        }
        nodos.push({
          id: n.id,
          type: "simbolo",
          position: { x: n.posicion?.x ?? 0, y: n.posicion?.y ?? 0 },
          data: { codigo_iec: n.codigo_iec, rotacion: ((n.rotacion ?? 0) % 360 + 360) % 360 },
        });
      }
      const idsValidos = new Set(nodos.map((n) => n.id));
      const conexiones: Edge[] = [];
      for (const c of proyecto.conexiones ?? []) {
        const [src, srcH] = c.desde.split(".");
        const [tgt, tgtH] = c.hasta.split(".");
        if (!idsValidos.has(src) || !idsValidos.has(tgt)) {
          problemas.push(
            `conexión ${c.id}: extremo inexistente (${src} → ${tgt}) — se omite`,
          );
          continue;
        }
        conexiones.push({
          id: c.id,
          source: src,
          sourceHandle: srcH ?? null,
          target: tgt,
          targetHandle: tgtH ?? null,
          type: "step",
        });
      }
      historial.limpiar();
      set({
        nodos,
        conexiones,
        nombreProyecto: proyecto.nombre || "proyecto_sin_nombre",
        problemasProyecto: problemas,
        version: get().version + 1,
      });
    },

    serializarActual() {
      const { nodos, conexiones, nombreProyecto } = get();
      const nodosProyecto: NodoProyecto[] = nodos.map((n) => ({
        id: n.id,
        codigo_iec: n.data.codigo_iec,
        posicion: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        rotacion: n.data.rotacion,
        atributos: {},
      }));
      const conexionesProyecto = conexiones.map((e) => ({
        id: e.id,
        desde: `${e.source}.${e.sourceHandle ?? ""}`,
        hasta: `${e.target}.${e.targetHandle ?? ""}`,
        atributos_conductor: {},
      }));
      return {
        nombre: nombreProyecto,
        nodos: nodosProyecto,
        conexiones: conexionesProyecto,
        modo_vista: "unifilar_simple",
      };
    },
  };
});

export { historial };
