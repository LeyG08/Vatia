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
import {
  ALIMENTADOR_POR_DEFECTO,
  HOJA_POR_DEFECTO,
  NOTAS_GABINETE_POR_DEFECTO,
  ROTULO_POR_DEFECTO,
  rectanguloUtil,
  type AlimentadorConfig,
  type HojaConfig,
  type NodoProyecto,
  type NotasGabineteConfig,
  type ProyectoJSON,
  type ResponsableRotulo,
  type RotuloConfig,
} from "./tipos";

/**
 * Escala de renderizado: px de canvas por unidad del viewBox del símbolo.
 * Fija por librería — el tamaño del símbolo no es modificable por el
 * usuario. Debe mantenerse par y los símbolos pasan el lint de grilla
 * para ESCALA 2 y 4 (ver scripts/lint_simbolos.py).
 */
export const ESCALA = 2;
export const PASO_ROTACION = 90;

/**
 * Fusiona el rótulo guardado con los defaults, tomando solo campos
 * conocidos y validando tipos: los proyectos viejos no deben colar
 * basura al estado.
 */
function fusionarRotulo(guardado?: Partial<RotuloConfig> | null): RotuloConfig {
  const base = ROTULO_POR_DEFECTO();
  if (!guardado) return base;
  const texto = (v: unknown, fb: string) =>
    typeof v === "string" ? v : fb;
  const guardadas = Array.isArray(guardado.responsables)
    ? guardado.responsables
    : [];
  const responsables: ResponsableRotulo[] = base.responsables.map((r, i) => {
    const g = guardadas[i] as Partial<ResponsableRotulo> | undefined;
    if (!g) return r;
    return {
      rol: texto(g.rol, r.rol),
      fecha: texto(g.fecha, ""),
      nombre: texto(g.nombre, ""),
    };
  });
  const metodo =
    guardado.metodoIso === "(E)" ||
    guardado.metodoIso === "(A)" ||
    guardado.metodoIso === ""
      ? guardado.metodoIso
      : base.metodoIso;
  return {
    empresa: texto(guardado.empresa, base.empresa),
    logoTexto: texto(guardado.logoTexto, base.logoTexto),
    cliente: texto(guardado.cliente, base.cliente),
    localidad: texto(guardado.localidad, base.localidad),
    denominacion: texto(guardado.denominacion, base.denominacion),
    claveRepresentado: texto(guardado.claveRepresentado, base.claveRepresentado),
    nombreArchivo: texto(guardado.nombreArchivo, base.nombreArchivo),
    toleranciasGenerales: texto(
      guardado.toleranciasGenerales,
      base.toleranciasGenerales,
    ),
    escala: texto(guardado.escala, base.escala),
    metodoIso: metodo,
    responsables,
    numeroPlano: texto(guardado.numeroPlano, base.numeroPlano),
    numeroPlanoCliente: texto(guardado.numeroPlanoCliente, base.numeroPlanoCliente),
    paginacion: texto(guardado.paginacion, base.paginacion),
  };
}

/** Forma que podían tener hojas de versiones anteriores del editor */
interface HojaLegada {
  encabezado?: { tablero?: unknown; alimentadores?: unknown };
}

/**
 * Fusiona la hoja guardada con los defaults. Además devuelve los
 * alimentadores "encabezado.alimentadores" de proyectos de la etapa
 * anterior (textos fijos del encabezado): se migran a nodos.
 */
function fusionarHoja(
  guardada?: Partial<HojaConfig> | HojaLegada | null,
): { hoja: HojaConfig; alimentadoresLegado: AlimentadorConfig[] } {
  const base = HOJA_POR_DEFECTO();
  if (!guardada) return { hoja: base, alimentadoresLegado: [] };
  const legada = guardada as HojaLegada;
  const parcial = guardada as Partial<HojaConfig>;
  // Proyectos intermedios (F2/F3) guardaban las notas como lista libre
  // de strings: se descarta y vuelven los defaults de estructura fija.
  const ngBase = NOTAS_GABINETE_POR_DEFECTO();
  const ngGuardado = (parcial.notasGabinete ?? {}) as Partial<NotasGabineteConfig>;
  const textoNg = (v: unknown, fb: string) => (typeof v === "string" ? v : fb);
  const notasGabinete: NotasGabineteConfig = {
    material: textoNg(ngGuardado.material, ngBase.material),
    claseAislacion: textoNg(ngGuardado.claseAislacion, ngBase.claseAislacion),
    personalApto: textoNg(ngGuardado.personalApto, ngBase.personalApto),
    gradoProteccion: textoNg(ngGuardado.gradoProteccion, ngBase.gradoProteccion),
    barrasOConductores: textoNg(
      ngGuardado.barrasOConductores,
      ngBase.barrasOConductores,
    ),
    reservaFutura: textoNg(ngGuardado.reservaFutura, ngBase.reservaFutura),
  };
  const alimentadoresLegado: AlimentadorConfig[] = [];
  if (Array.isArray(legada.encabezado?.alimentadores)) {
    for (const a of legada.encabezado.alimentadores) {
      if (typeof a === "string" && a.trim() !== "") {
        alimentadoresLegado.push({
          ...ALIMENTADOR_POR_DEFECTO(),
          origen: a.replace(/^Desde\s+/i, "").trim(),
        });
      }
    }
  }
  const tableroGuardado =
    typeof (guardada as Partial<HojaConfig>).tablero === "string"
      ? (guardada as Partial<HojaConfig>).tablero!
      : typeof legada.encabezado?.tablero === "string"
        ? legada.encabezado.tablero
        : base.tablero;
  return {
    hoja: {
      formato: parcial.formato ?? base.formato,
      orientacion: parcial.orientacion ?? base.orientacion,
      tablero: tableroGuardado,
      notasGabinete,
      notaSeguridad:
        typeof parcial.notaSeguridad === "string"
          ? parcial.notaSeguridad
          : base.notaSeguridad,
      rotulo: fusionarRotulo(parcial.rotulo),
    },
    alimentadoresLegado,
  };
}

export interface DatosSimbolo extends Record<string, unknown> {
  tipo?: "simbolo";
  codigo_iec: string;
  rotacion: number;
}

export interface DatosAlimentador extends Record<string, unknown> {
  tipo: "alimentador";
  origen: string;
  fases: boolean;
  neutro: boolean;
  tierra: boolean;
  cantidadN: number | null;
}

export type NodoData = DatosSimbolo | DatosAlimentador;

function esDatosAlimentador(d: NodoData): d is DatosAlimentador {
  return d.tipo === "alimentador";
}

interface EstadoEditor {
  nodos: Node<NodoData>[];
  conexiones: Edge[];
  nombreProyecto: string;
  problemasProyecto: string[];
  paletaVisible: boolean;
  panelHojaAbierto: boolean;
  hoja: HojaConfig;
  version: number;
  alternarPaleta: () => void;
  alternarPanelHoja: () => void;
  actualizarHoja: (
    patch: Partial<Omit<HojaConfig, "rotulo" | "notasGabinete">> & {
      rotulo?: Partial<RotuloConfig>;
      notasGabinete?: Partial<NotasGabineteConfig>;
    },
  ) => void;
  agregarSimbolo: (codigoIec: string, x: number, y: number) => void;
  agregarAlimentador: (x?: number, y?: number) => void;
  actualizarDatosAlimentador: (
    id: string,
    patch: Partial<Omit<DatosAlimentador, "tipo">>,
  ) => void;
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
  items: {
    datos: NodoData;
    x: number;
    y: number;
  }[];
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

/** Tamaño del wrapper de un símbolo en px, igualando la caja de NodoSimbolo */
export function tamanoWrapperPx(
  codigo: string,
  rotacion: number,
): { ancho: number; alto: number } {
  const s = obtenerSimbolo(codigo);
  if (!s) return { ancho: 0, alto: 0 };
  const giro = (((rotacion % 360) + 360) % 360) / 90;
  const swap = giro === 1 || giro === 3;
  const anchoU = swap ? s.viewBox.alto : s.viewBox.ancho;
  const altoU = swap ? s.viewBox.ancho : s.viewBox.alto;
  return {
    ancho: Math.max(1, Math.round(anchoU * ESCALA)),
    alto: Math.max(1, Math.round(altoU * ESCALA)),
  };
}

/** Tamaño fijo de la tarjeta del nodo alimentador (ver estilos.css) */
export const TAMANO_ALIMENTADOR_PX = { ancho: 150, alto: 100 };

export function tamanoNodoPx(data: NodoData): { ancho: number; alto: number } {
  return esDatosAlimentador(data)
    ? { ...TAMANO_ALIMENTADOR_PX }
    : tamanoWrapperPx(data.codigo_iec, data.rotacion);
}

export const useEditor = create<EstadoEditor>((set, get) => {
  function ejecutar(cmd: Comando): void {
    historial.ejecutar(cmd);
    set({ version: get().version + 1 });
  }

  /**
   * La hoja es un espacio finito: encierra la posición dentro del marco
   * útil, snapeando a la grilla y sin dejar que el cuerpo del símbolo se
   * pase del borde derecho/inferior. Si algo no entra, corresponde otra
   * hoja.
   */
  function limitarAHoja(
    x: number,
    y: number,
    data: NodoData,
  ): { x: number; y: number } {
    const r = rectanguloUtil(get().hoja);
    const t = tamanoNodoPx(data);
    const loX = Math.ceil(r.x0 / 10) * 10;
    const loY = Math.ceil(r.y0 / 10) * 10;
    const hiX = Math.max(loX, Math.floor((r.x1 - t.ancho) / 10) * 10);
    const hiY = Math.max(loY, Math.floor((r.y1 - t.alto) / 10) * 10);
    const snap = (v: number) => Math.round(v / 10) * 10;
    return {
      x: Math.min(Math.max(snap(x), loX), hiX),
      y: Math.min(Math.max(snap(y), loY), hiY),
    };
  }

  return {
    nodos: [],
    conexiones: [],
    nombreProyecto: "proyecto_sin_nombre",
    problemasProyecto: [],
    paletaVisible: true,
    panelHojaAbierto: false,
    hoja: HOJA_POR_DEFECTO(),
    version: 0,

    alternarPaleta() {
      set((s) => ({ paletaVisible: !s.paletaVisible }));
    },

    alternarPanelHoja() {
      set((s) => ({ panelHojaAbierto: !s.panelHojaAbierto }));
    },

    actualizarHoja(patch) {
      set((s) => ({
        hoja: {
          ...s.hoja,
          ...patch,
          notasGabinete: {
            ...s.hoja.notasGabinete,
            ...(patch.notasGabinete ?? {}),
          },
          rotulo: { ...s.hoja.rotulo, ...(patch.rotulo ?? {}) },
        },
      }));
    },
    agregarSimbolo(codigoIec, x, y) {
      const simbolo = obtenerSimbolo(codigoIec);
      if (!simbolo) return;
      const data: DatosSimbolo = { tipo: "simbolo", codigo_iec: codigoIec, rotacion: 0 };
      const pos = limitarAHoja(x, y, data);
      const nodo: Node<NodoData> = {
        id: nuevoId(get().nodos, "n"),
        type: "simbolo",
        position: pos,
        data,
        selected: true,
      };
      ejecutar({
        descripcion: `agregar ${codigoIec}`,
        do: () => set((s) => ({ nodos: [...s.nodos.map((n) => ({ ...n, selected: false })), nodo] })),
        undo: () => set((s) => ({ nodos: s.nodos.filter((n) => n.id !== nodo.id) })),
      });
    },

    agregarAlimentador(x, y) {
      const r = rectanguloUtil(get().hoja);
      const existentes = get().nodos.filter((n) => esDatosAlimentador(n.data)).length;
      const data: DatosAlimentador = {
        tipo: "alimentador",
        ...ALIMENTADOR_POR_DEFECTO(),
      };
      // Debajo del bloque de notas del gabinete para no taparlo
      const pos = limitarAHoja(
        x ?? r.x0 + 60 + existentes * (TAMANO_ALIMENTADOR_PX.ancho + 20),
        y ?? r.y0 + 170,
        data,
      );
      const nodo: Node<NodoData> = {
        id: nuevoId(get().nodos, "a"),
        type: "alimentador",
        position: pos,
        data,
        selected: true,
      };
      ejecutar({
        descripcion: "agregar alimentador",
        do: () => set((s) => ({ nodos: [...s.nodos.map((n) => ({ ...n, selected: false })), nodo] })),
        undo: () => set((s) => ({ nodos: s.nodos.filter((n) => n.id !== nodo.id) })),
      });
    },

    actualizarDatosAlimentador(id, patch) {
      const snapshot = get().nodos.find((n) => n.id === id);
      if (!snapshot || !esDatosAlimentador(snapshot.data)) return;
      ejecutar({
        descripcion: `editar alimentador ${id}`,
        do: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              n.id === id && esDatosAlimentador(n.data)
                ? { ...n, data: { ...n.data, ...patch } }
                : n,
            ),
          })),
        undo: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              n.id === id ? { ...n, data: snapshot.data } : n,
            ),
          })),
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
        type: "conexion",
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
      // Encierra cada nodo movido dentro del marco útil de la hoja
      const enHoja: Record<string, { x: number; y: number }> = {};
      for (const id of ids) {
        const n = get().nodos.find((m) => m.id === id);
        if (!n) continue;
        enHoja[id] = limitarAHoja(despues[id].x, despues[id].y, n.data);
      }
      ejecutar({
        descripcion: "mover nodos",
        do: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              enHoja[n.id]
                ? { ...n, position: { ...enHoja[n.id] } }
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
      // Solo los símbolos rotan; los alimentadores son tarjetas fijas
      const seleccionadas = get().nodos.filter(
        (n) => n.selected && !esDatosAlimentador(n.data),
      );
      if (seleccionadas.length === 0) return;
      const antes = new Map(
        seleccionadas.map((n) => [n.id, (n.data as DatosSimbolo).rotacion] as const),
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
                    data: {
                      ...n.data,
                      rotacion: (antes.get(n.id)! + despuesRot) % 360,
                    },
                  }
                : n,
            ),
          })),
        undo: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              antes.has(n.id)
                ? {
                    ...n,
                    data: { ...n.data, rotacion: antes.get(n.id)! },
                  }
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
          datos: { ...n.data },
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

      const nuevosNodos: Node<NodoData>[] = [];
      for (const it of portapapeles.items) {
        const pos = limitarAHoja(it.x + 20, it.y + 20, it.datos);
        nuevosNodos.push({
          id: `n${++proximoN}`,
          type: esDatosAlimentador(it.datos) ? "alimentador" : "simbolo",
          position: pos,
          data: { ...it.datos },
          selected: true,
        });
      }
      const idDe = (i: number) => nuevosNodos[i].id;
      const nuevasConexiones: Edge[] = portapapeles.enlaces.map((l) => ({
        id: `c${++proximoC}`,
        source: idDe(l.s),
        sourceHandle: l.sh,
        target: idDe(l.t),
        targetHandle: l.th,
        type: "conexion",
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
        if (n.tipo === "alimentador") {
          const d = { ...ALIMENTADOR_POR_DEFECTO(), ...(n.datos ?? {}) };
          nodos.push({
            id: n.id,
            type: "alimentador",
            position: { x: n.posicion?.x ?? 0, y: n.posicion?.y ?? 0 },
            data: {
              tipo: "alimentador",
              origen: typeof d.origen === "string" ? d.origen : "",
              fases: typeof d.fases === "boolean" ? d.fases : true,
              neutro: typeof d.neutro === "boolean" ? d.neutro : true,
              tierra: typeof d.tierra === "boolean" ? d.tierra : true,
              cantidadN:
                typeof d.cantidadN === "number" &&
                Number.isFinite(d.cantidadN) &&
                d.cantidadN > 0
                  ? Math.floor(d.cantidadN)
                  : null,
            },
          });
          continue;
        }
        const simbolo = obtenerSimbolo(n.codigo_iec ?? "");
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
          data: {
            tipo: "simbolo",
            codigo_iec: n.codigo_iec!,
            rotacion: (((n.rotacion ?? 0) % 360) + 360) % 360,
          },
        });
      }
      // Migración: encabezado.alimentadores de proyectos viejos → nodos
      const fusion = fusionarHoja(proyecto.hoja);
      for (const a of fusion.alimentadoresLegado) {
        const r = rectanguloUtil(fusion.hoja);
        const datos = { tipo: "alimentador", ...a } as DatosAlimentador;
        const pos = limitarAHoja(
          r.x0 + 60 + nodos.filter((n) => esDatosAlimentador(n.data)).length *
            (TAMANO_ALIMENTADOR_PX.ancho + 20),
          r.y0 + 170,
          datos,
        );
        nodos.push({
          id: nuevoId(nodos, "a"),
          type: "alimentador",
          position: pos,
          data: { ...datos },
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
          type: "conexion",
        });
      }
      historial.limpiar();
      set({
        nodos,
        conexiones,
        nombreProyecto: proyecto.nombre || "proyecto_sin_nombre",
        problemasProyecto: problemas,
        hoja: fusion.hoja,
        version: get().version + 1,
      });
    },

    serializarActual() {
      const { nodos, conexiones, nombreProyecto, hoja } = get();
      const nodosProyecto: NodoProyecto[] = nodos.map((n) => {
        const posicion = {
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
        };
        if (esDatosAlimentador(n.data)) {
          return {
            id: n.id,
            tipo: "alimentador" as const,
            posicion,
            datos: {
              origen: n.data.origen,
              fases: n.data.fases,
              neutro: n.data.neutro,
              tierra: n.data.tierra,
              cantidadN: n.data.cantidadN,
            },
          };
        }
        return {
          id: n.id,
          codigo_iec: n.data.codigo_iec,
          posicion,
          rotacion: n.data.rotacion,
          atributos: {},
        };
      });
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
        hoja,
      };
    },
  };
});

export { historial };
