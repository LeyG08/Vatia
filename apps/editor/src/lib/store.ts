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
  paletaVisible: boolean;
  version: number;
  alternarPaleta: () => void;
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
  copiarSeleccion: () => void;
  pegar: () => void;
  deshacer: () => void;
  rehacer: () => void;
  setNombreProyecto: (nombre: string) => void;
  cargarProyecto: (proyecto: ProyectoJSON) => void;
  serializarActual: () => ProyectoJSON;
}

interface ContenidoPortapapeles {
  items: { codigo_iec: string; rotacion: number; x: number; y: number }[];
  enlaces: {
    s: number;
    sh: string | null;
    t: number;
    th: string | null;
  }[];
}

let portapapeles: ContenidoPortapapeles | null = null;

function nuevoId(existentes: { id: string }[], prefijo: string): string {
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
    paletaVisible: true,
    version: 0,

    alternarPaleta() {
      set((s) => ({ paletaVisible: !s.paletaVisible }));
    },

    agregarSimbolo(codigoIec, x, y) {
      const simbolo = obtenerSimbolo(codigoIec);
      if (!simbolo) return;
      const nodo: Node<NodoData> = {
        id: nuevoId(get().nodos, "n"),
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
        id: nuevoId(get().conexiones, "c"),
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

    copiarSeleccion() {
      const seleccion = get().nodos.filter((n) => n.selected);
      if (seleccion.length === 0) return;
      const indice = new Map(seleccion.map((n, i) => [n.id, i] as const));
      const enlaces: ContenidoPortapapeles["enlaces"] = [];
      for (const e of get().conexiones) {
        if (indice.has(e.source) && indice.has(e.target)) {
          enlaces.push({
            s: indice.get(e.source)!,
            sh: e.sourceHandle ?? null,
            t: indice.get(e.target)!,
            th: e.targetHandle ?? null,
          });
        }
      }
      portapapeles = {
        items: seleccion.map((n) => ({
          codigo_iec: n.data.codigo_iec,
          rotacion: n.data.rotacion,
          x: n.position.x,
          y: n.position.y,
        })),
        enlaces,
      };
    },

    pegar() {
      if (!portapapeles || portapapeles.items.length === 0) return;
      const snapshotNodos = get().nodos;
      const snapshotConexiones = get().conexiones;

      const maxSufijo = (existentes: { id: string }[], prefijo: string) => {
        let max = 0;
        for (const e of existentes) {
          const m = e.id.match(new RegExp(`^${prefijo}(\\d+)$`));
          if (m) max = Math.max(max, Number(m[1]));
        }
        return max;
      };
      let proximoN = maxSufijo(snapshotNodos, "n");
      let proximoC = maxSufijo(snapshotConexiones, "c");

      const nuevosNodos: Node<NodoData>[] = portapapeles.items.map((it) => ({
        id: `n${++proximoN}`,
        type: "simbolo",
        position: { x: it.x + 20, y: it.y + 20 },
        data: { codigo_iec: it.codigo_iec, rotacion: it.rotacion },
        selected: true,
      }));
      const idDe = (i: number) => nuevosNodos[i].id;
      const nuevasConexiones: Edge[] = portapapeles.enlaces.map((l) => ({
        id: `c${++proximoC}`,
        source: idDe(l.s),
        sourceHandle: l.sh,
        target: idDe(l.t),
        targetHandle: l.th,
        type: "step",
      }));

      ejecutar({
        descripcion: "pegar selección",
        do: () =>
          set((s) => ({
            nodos: [
              ...s.nodos.map((n) => ({ ...n, selected: false })),
              ...nuevosNodos.map((n) => ({ ...n })),
            ],
            conexiones: [...s.conexiones, ...nuevasConexiones.map((e) => ({ ...e }))],
          })),
        undo: () =>
          set({ nodos: snapshotNodos, conexiones: snapshotConexiones }),
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
