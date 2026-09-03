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
import { GRILLA_PX } from "./ruta";
import {
  ALIMENTADOR_POR_DEFECTO,
  DATOS_PROYECTO_POR_DEFECTO,
  HOJA_POR_DEFECTO,
  NOTAS_GABINETE_POR_DEFECTO,
  ROTULO_POR_DEFECTO,
  hojaNuevaDesde,
  migrarAProyectoV5,
  rectanguloUtil,
  type AlimentadorConfig,
  type ConexionProyecto,
  type DatosProyecto,
  type FuenteCortocircuito,
  type Hoja,
  type HojaConfig,
  type NodoProyecto,
  type NotasGabineteConfig,
  type Proyecto,
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
      modo: parcial.modo ?? base.modo,
      tablero: tableroGuardado,
      notasGabinete,
      notaSeguridad:
        typeof parcial.notaSeguridad === "string"
          ? parcial.notaSeguridad
          : base.notaSeguridad,
      rotulo: fusionarRotulo(parcial.rotulo),
      // Campos opcionales simples: se pasan tal cual si están, sin
      // fusión de subcampos (a diferencia de rotulo/notasGabinete). Antes
      // "accesorios" quedaba afuera de este objeto por completo, así que
      // el espejo `s.hoja` lo perdía cada vez que se cambiaba de pestaña
      // (los datos reales sobrevivían en `proyecto.hojas` porque el merge
      // de más arriba no toca claves ausentes, pero la UI mostraba la
      // lista vacía hasta la próxima edición) — bug real, no cosmético.
      accesorios: Array.isArray(parcial.accesorios)
        ? parcial.accesorios
        : base.accesorios,
      fuente_cortocircuito: parcial.fuente_cortocircuito,
    },
    alimentadoresLegado,
  };
}

export interface DatosSimbolo extends Record<string, unknown> {
  tipo?: "simbolo";
  codigo_iec: string;
  rotacion: number;
  /** Ficha técnica de la familia aparato (C4); semilla = atributos_base */
  atributos: Record<string, unknown>;
  /**
   * Solo la usa el nodo "hoja" (marco/rótulo, ver tiposFlow.ts): en el
   * lienzo interactivo (una sola instancia de `<ReactFlow>`) no hace
   * falta, `HojaNode` lee la hoja activa directo del store. Pero
   * durante "Exportar proyecto" (E43) hay VARIAS instancias de
   * `<ReactFlow>` a la vez, una por hoja — sin esto, todas leían la
   * MISMA hoja activa global y el rótulo/tablero de todas las páginas
   * salvo la activa quedaba mal (bug real, encontrado en vivo con dos
   * hojas de tablero distinto).
   */
  hojaOverride?: Hoja;
}

export interface DatosAlimentador extends Record<string, unknown> {
  tipo: "alimentador";
  origen: string;
  fases: boolean;
  neutro: boolean;
  tierra: boolean;
  cantidadN: number | null;
  /**
   * Ficha del cable de alimentación (C5): MISMO schema que la conexión.
   * Los campos legados (fases/neutro/tierra/cantidadN) se mantienen por
   * compatibilidad y siembran estos atributos al cargar proyectos viejos.
   */
  atributos?: Record<string, unknown>;
}

/** Siembra la ficha nueva desde los campos legados (o la existente) */
function atributosAlimentador(
  d: Partial<DatosAlimentador>,
): Record<string, unknown> {
  if (d.atributos && typeof d.atributos === "object") return { ...d.atributos };
  const a: Record<string, unknown> = {};
  const fases =
    typeof d.cantidadN === "number" && d.cantidadN > 0
      ? d.cantidadN
      : d.fases
        ? 3
        : 0;
  if (fases > 0) a.cantidad_conductores = fases;
  if (d.neutro) a.lleva_neutro = true;
  if (d.tierra) a.lleva_tierra = true;
  return a;
}

export type NodoData = DatosSimbolo | DatosAlimentador | DatosBarra;

/**
 * BARRA de distribución (C8): la acometida llega a ella y de ella
 * cuelgan los circuitos. Es un nodo PROPIO (no el símbolo genérico)
 * porque su largo es estirable y sus puntos de conexión se generan
 * a lo largo de toda la barra, cada 10 px, arriba y abajo.
 */
export interface DatosBarra extends Record<string, unknown> {
  tipo: "barra";
  codigo_iec: string; // "S00119" — fija la familia de atributos
  rotacion: number; // 0 = horizontal; 90 = vertical (conexión entre barras)
  /** Largo útil entre extremos, en px. Múltiplo de la grilla. */
  largoPx: number;
  /** Ficha de la barra: dimensiones/material/norma/corriente */
  atributos: Record<string, unknown>;
}

/** Código IEC reservado para las barras de distribución */
export const BARRA_CODIGO = "S00119";

/** Largo por defecto = geometría del símbolo original (compatibilidad) */
export const LARGO_BARRA_DEFECTO_PX = 100;

/** Geometría local del nodo barra (px, sin rotar) */
export const BARRA_GEO = {
  /** Margen antes del primer extremo (donde van los handles "in"/"out") */
  padX: 10,
  /** Alto de la caja del nodo (la línea vive en el centro) */
  altoCaja: 40,
  /** Coordenada Y del eje de la barra dentro de la caja */
  centroY: 20,
};

export function esDatosAlimentador(d: NodoData): d is DatosAlimentador {
  return d.tipo === "alimentador";
}

function esDatosBarra(d: NodoData): d is DatosBarra {
  return d.tipo === "barra";
}

/** Snapshot por nodo durante el drag de estiramiento de barras (C8) */
const snapshotsEstiro = new Map<
  string,
  { data: DatosBarra; posicion: { x: number; y: number } }
>();

/* ==================== Conversiones RF ↔ proyecto ==================== */

function rfANodoProyecto(n: Node<NodoData>): NodoProyecto {
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
        // El cable REAL (editado en el panel) manda; el sembrado por
        // flags es solo red de seguridad si quedó vacío
        atributos:
          n.data.atributos && Object.keys(n.data.atributos).length > 0
            ? { ...n.data.atributos }
            : atributosAlimentador(n.data),
      },
    };
  }
  if (esDatosBarra(n.data)) {
    return {
      id: n.id,
      tipo: "barra" as const,
      posicion,
      rotacion: n.data.rotacion,
      datos: { largoPx: n.data.largoPx },
      atributos: { ...n.data.atributos },
    };
  }
  return {
    id: n.id,
    codigo_iec: n.data.codigo_iec,
    posicion,
    rotacion: n.data.rotacion,
    atributos: { ...n.data.atributos },
  };
}

function rfAConexionProyecto(e: Edge): ConexionProyecto {
  const paso = (e.data?.paso as { x: number; y: number } | undefined) ?? undefined;
  return {
    id: e.id,
    desde: `${e.source}.${e.sourceHandle ?? ""}`,
    hasta: `${e.target}.${e.targetHandle ?? ""}`,
    ...(paso ? { paso: { ...paso } } : {}),
    atributos_conductor: {
      ...((e.data?.atributosConductor as Record<string, unknown> | undefined) ??
        {}),
    },
  };
}

function nuevoIdEn(existentes: { id: string }[], prefijo: string): string {
  let max = 0;
  for (const e of existentes) {
    const m = e.id.match(new RegExp(`^${prefijo}(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefijo}${max + 1}`;
}

/**
 * Convierte los nodos/conexiones serializados de una hoja al estado de
 * trabajo de React Flow, validando códigos contra la librería, migrando
 * alimentadores legados del encabezado y descartando conexiones huérfanas.
 * Devuelve también la HojaConfig normalizada de esa hoja.
 */
export function construirEstadoHoja(hojaSer: Hoja): {
  cfg: HojaConfig;
  nodos: Node<NodoData>[];
  conexiones: Edge[];
  problemas: string[];
} {
  const etiqueta = hojaSer.nombre || "Hoja";
  const fusion = fusionarHoja(hojaSer as Partial<HojaConfig>);
  const nodos: Node<NodoData>[] = [];
  const problemas: string[] = [];
  for (const n of hojaSer.nodos ?? []) {
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
          atributos:
            n.atributos && Object.keys(n.atributos).length > 0
              ? { ...n.atributos }
              : atributosAlimentador(d as Partial<DatosAlimentador>),
        },
      });
      continue;
    }
    // BARRA (C13b): PRIMERO por tipo — las barras nativas no llevan
    // codigo_iec en el archivo (rfANodoProyecto no lo escribe), así que
    // resolver el símbolo antes acá las descartaba JUNTO con todas sus
    // conexiones al reabrir un proyecto guardado. El chequeo por código
    // queda para migrar proyectos viejos que traían S00119 como
    // símbolo genérico.
    if (n.tipo === "barra" || n.codigo_iec === BARRA_CODIGO) {
      const simboloBarra =
        obtenerSimbolo(n.codigo_iec ?? "") ?? obtenerSimbolo(BARRA_CODIGO);
      nodos.push({
        id: n.id,
        type: "barra",
        position: { x: n.posicion?.x ?? 0, y: n.posicion?.y ?? 0 },
        data: {
          tipo: "barra",
          codigo_iec: BARRA_CODIGO,
          rotacion: (((n.rotacion ?? 0) % 360) + 360) % 360,
          largoPx:
            typeof n.datos?.largoPx === "number" &&
            Number.isFinite(n.datos.largoPx) &&
            n.datos.largoPx >= 40
              ? Math.round(n.datos.largoPx / GRILLA_PX) * GRILLA_PX
              : LARGO_BARRA_DEFECTO_PX,
          atributos: {
            ...(simboloBarra?.metadata.atributos_base ?? {}),
            ...(n.atributos ?? {}),
          },
        },
      });
      continue;
    }
    const simbolo = obtenerSimbolo(n.codigo_iec ?? "");
    if (!simbolo) {
      problemas.push(
        `[${etiqueta}] nodo ${n.id}: código ${n.codigo_iec} no existe en la librería — se omite`,
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
        atributos: {
          ...simbolo.metadata.atributos_base,
          ...(n.atributos ?? {}),
        },
      },
    });
  }
  // Migración: encabezado.alimentadores de proyectos viejos → nodos
  const r = rectanguloUtil(fusion.hoja);
  for (const a of fusion.alimentadoresLegado) {
    const datos = { tipo: "alimentador", ...a } as DatosAlimentador;
    const t = esDatosAlimentador(datos)
      ? TAMANO_ALIMENTADOR_PX
      : { ancho: 0, alto: 0 };
    const snap = (v: number) => Math.round(v / 10) * 10;
    nodos.push({
      id: nuevoIdEn(nodos, "a"),
      type: "alimentador",
      position: {
        x: snap(
          r.x0 +
            60 +
            nodos.filter((n) => esDatosAlimentador(n.data)).length *
              (t.ancho + 20),
        ),
        y: snap(r.y0 + 170),
      },
      data: {
        ...datos,
        atributos: atributosAlimentador(datos as Partial<DatosAlimentador>),
      },
    });
  }
  const idsValidos = new Set(nodos.map((n) => n.id));
  const conexiones: Edge[] = [];
  for (const c of hojaSer.conexiones ?? []) {
    const [src, srcH] = c.desde.split(".");
    const [tgt, tgtH] = c.hasta.split(".");
    if (!idsValidos.has(src) || !idsValidos.has(tgt)) {
      problemas.push(
        `[${etiqueta}] conexión ${c.id}: extremo inexistente (${src} → ${tgt}) — se omite`,
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
      data: {
        atributosConductor: { ...(c.atributos_conductor ?? {}) },
        paso: c.paso ? { ...c.paso } : null,
      },
    });
  }
  return { cfg: fusion.hoja, nodos, conexiones, problemas };
}

interface EstadoEditor {
  /** Proyecto completo v2 (todas las hojas con su contenido serializado) */
  proyecto: Proyecto;
  hojaActivaId: string;
  /** Estado de trabajo React Flow de la HOJA ACTIVA */
  nodos: Node<NodoData>[];
  conexiones: Edge[];
  nombreProyecto: string;
  problemasProyecto: string[];
  paletaVisible: boolean;
  panelHojaAbierto: boolean;
  panelProyectoAbierto: boolean;
  modoAdmin: boolean;
  /** true justo después de recuperar un autoguardado al abrir la app */
  avisoRecuperado: boolean;
  descartarAvisoRecuperado: () => void;
  /** true mientras se arma la vista de impresión de TODAS las hojas
   * (exportarProyectoCompletoPdf en BarraSuperior) — ver ExportacionProyecto.tsx */
  exportandoTodo: boolean;
  /** si la exportación en curso agrega la página de lista de materiales
   * al final — se pregunta cada vez (BarraSuperior), no es una preferencia
   * fija: no toda impresión necesita la lista. */
  incluirBomEnExportacion: boolean;
  iniciarExportacionCompleta: (incluirBom: boolean) => void;
  finalizarExportacionCompleta: () => void;
  /** true mientras se arma la vista de impresión de los unifilares
   * combinados en hoja(s) A0 (E46) — ver ExportacionA0.tsx */
  exportandoA0: boolean;
  /** si el usuario permitió partir en varias hojas A0 cuando el
   * combinado no entra en una sola — opción explícita, no automática
   * ("esto debe ser una opción para el que lo quiera así"). */
  permitirVariasPaginasA0: boolean;
  iniciarExportacionA0: (permitirVariasPaginas: boolean) => void;
  finalizarExportacionA0: () => void;
  /** Config de la hoja activa (espejo para componentes) */
  hoja: HojaConfig;
  version: number;
  /**
   * Id de la hoja para la que se acaba de colocar el primer alimentador
   * (E39): dispara el prompt de "Fuente de cortocircuito" una sola vez,
   * en el momento en que tiene sentido preguntarlo. `null` = sin prompt
   * pendiente.
   */
  promptCortocircuitoHojaId: string | null;
  cerrarPromptCortocircuito: () => void;
  /**
   * Reemplaza `window.confirm`/`window.alert` (E41): esos diálogos
   * nativos del navegador no se pueden estilar ni quedan integrados a
   * la página — el usuario los señaló como algo que no quiere ver más.
   * `null` = sin diálogo pendiente. `onConfirmar` es `undefined` para
   * una alerta simple (un solo botón "Aceptar").
   */
  confirmacion: { mensaje: string; onConfirmar?: () => void } | null;
  pedirConfirmacion: (mensaje: string, onConfirmar: () => void) => void;
  mostrarAlerta: (mensaje: string) => void;
  cerrarConfirmacion: () => void;
  alternarPaleta: () => void;
  alternarPanelHoja: () => void;
  alternarPanelProyecto: () => void;
  alternarAdmin: () => void;
  actualizarHoja: (
    patch: Partial<
      Omit<HojaConfig, "rotulo" | "notasGabinete" | "fuente_cortocircuito">
    > & {
      rotulo?: Partial<RotuloConfig>;
      notasGabinete?: Partial<NotasGabineteConfig>;
      fuente_cortocircuito?: Partial<FuenteCortocircuito>;
    },
  ) => void;
  /** Datos eléctricos base del proyecto (tensión, esquema PAT, normativa) */
  actualizarDatosProyecto: (patch: Partial<DatosProyecto>) => void;
  agregarSimbolo: (codigoIec: string, x: number, y: number) => void;
  agregarAlimentador: (x?: number, y?: number) => void;
  actualizarDatosAlimentador: (
    id: string,
    patch: Partial<Omit<DatosAlimentador, "tipo">>,
  ) => void;
  /** Ficha/largo de la barra (C8) */
  actualizarDatosBarra: (
    id: string,
    patch: Partial<Omit<DatosBarra, "tipo">>,
  ) => void;
  /**
   * Estiramiento de la barra con drag desde CUALQUIERA de sus dos
   * extremos (C11): "der" mantiene fijo el extremo izquierdo, "izq"
   * el derecho (corriendo la posición para compensar). "inicio"/
   * "moviendo" aplican en vivo SIN historial; "fin" consolida un
   * único paso de undo/redo con el estado previo al gesto.
   */
  estirarBarra: (
    id: string,
    largoPx: number,
    fase: "inicio" | "moviendo" | "fin",
    origen?: "der" | "izq",
  ) => void;
  /** Reemplaza la ficha técnica completa de un símbolo (C4) */
  actualizarAtributosNodo: (
    id: string,
    atributos: Record<string, unknown>,
  ) => void;
  /** Reemplaza los atributos del cable de una conexión (C4) */
  actualizarAtributosConexion: (
    id: string,
    atributos: Record<string, unknown>,
  ) => void;
  onNodesChange: (cambios: NodeChange<Node<NodoData>>[]) => void;
  onEdgesChange: (cambios: EdgeChange[]) => void;
  onConnect: (conexion: Connection) => void;
  /** Reancla los dos extremos de una conexión existente (C11): agarrá
   * la punta del cable y soltala en otro handle sin perder el cable. */
  reconectarConexion: (id: string, conexion: Connection) => void;
  registrarArrastre: (ids: string[]) => void;
  confirmarArrastre: (
    despues: Record<string, { x: number; y: number }>,
  ) => void;
  /** C22: acomoda posiciones SIN historial (alineación fina de
   * alimentadores al mapa de puntos tras cargar o soltar). */
  fijarPosiciones: (mapa: Record<string, { x: number; y: number }>) => void;
  /** C29: quiebre arrastrable del cable (ver notas en la impl.) */
  moverPasoConexion: (id: string, punto: { x: number; y: number }) => void;
  confirmarPasoConexion: (
    id: string,
    antes: { x: number; y: number } | null,
  ) => void;
  limpiarPasoConexion: (id: string) => void;
  rotarSeleccion: () => void;
  eliminarSeleccion: () => void;
  copiarSeleccion: () => void;
  pegar: () => void;
  deshacer: () => void;
  rehacer: () => void;
  /** Marca como seleccionados SOLO los ids dados (sin historial) */
  seleccionarNodos: (ids: string[]) => void;
  setNombreProyecto: (nombre: string) => void;
  /* ---- Multi-hoja ---- */
  agregarHoja: () => string;
  eliminarHoja: (id: string) => void;
  duplicarHoja: (id: string) => string | null;
  renombrarHoja: (id: string, nombre: string) => void;
  reordenarHojas: (desde: number, hacia: number) => void;
  cambiarHojaActiva: (id: string, viewportActual?: Viewport) => void;
  moverSeleccionAHoja: (
    destinoId: string,
  ) => { movidos: number; cortadas: number } | null;
  /** Jerarquía de hojas: crea (o, si ya existe, navega a) la hoja hija
   * que cuelga de una carga seccional de la hoja activa. */
  crearOIrAHojaHija: (nodoId: string) => string;
  /** Hoja padre de la activa según hojaPadreId, si tiene */
  hojaPadreDeActiva: () => Hoja | null;
  irAHojaPadre: () => void;
  guardarViewport: (vp: Viewport) => void;
  cargarProyecto: (entrada: ProyectoJSON | Proyecto | string) => void;
  /** Empieza un proyecto en blanco y borra el autoguardado — es la única
   * forma de "soltar" un proyecto recuperado sin querer, ya que ahora
   * recargar la página lo trae de vuelta en vez de arrancar en blanco. */
  nuevoProyecto: () => void;
  serializarActual: () => Proyecto;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
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
  return nuevoIdEn(existentes, prefijo);
}

/** Copia profunda de una config de hoja (datos planos JSON-safe) */
function clonarCfg(cfg: HojaConfig): HojaConfig {
  return JSON.parse(JSON.stringify(cfg)) as HojaConfig;
}

/**
 * Vuelca el estado de trabajo (nodos/conexiones de React Flow) de la hoja
 * activa dentro de `proyecto.hojas`, en un objeto NUEVO — sin llamar a
 * `set()`. Función pura para que el autosave (fuera del store) pueda leer
 * el proyecto completo sin disparar otra notificación de zustand (eso
 * causaría un `set()` dentro del propio listener del autosave → loop).
 */
function proyectoVolcado(
  estado: Pick<EstadoEditor, "proyecto" | "hojaActivaId" | "nodos" | "conexiones" | "hoja">,
  viewport?: Viewport,
): Proyecto {
  const { proyecto, hojaActivaId, nodos, conexiones, hoja } = estado;
  return {
    ...proyecto,
    hojas: proyecto.hojas.map((h) =>
      h.id === hojaActivaId
        ? {
            ...h,
            ...clonarCfg(hoja),
            nodos: nodos.map(rfANodoProyecto),
            conexiones: conexiones.map(rfAConexionProyecto),
            viewport: viewport ?? h.viewport,
          }
        : h,
    ),
  };
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
export const TAMANO_ALIMENTADOR_PX = { ancho: 100, alto: 92 };

export function tamanoNodoPx(data: NodoData): { ancho: number; alto: number } {
  if (esDatosAlimentador(data)) return { ...TAMANO_ALIMENTADOR_PX };
  if (esDatosBarra(data)) {
    // Caja local: largo + márgenes de extremos × alto fijo.
    // Con giro de 90°/270° la caja queda vertical (dimensiones swaps).
    const anchoLocal = data.largoPx + 2 * BARRA_GEO.padX;
    const giro = ((((data.rotacion % 360) + 360) % 360) / 90) | 0;
    const vertical = giro % 2 === 1;
    return {
      ancho: vertical ? BARRA_GEO.altoCaja : anchoLocal,
      alto: vertical ? anchoLocal : BARRA_GEO.altoCaja,
    };
  }
  return tamanoWrapperPx(data.codigo_iec, data.rotacion);
}

/** Proyecto vacío inicial con una sola hoja */
function proyectoInicial(): { proyecto: Proyecto; hojaId: string } {
  const hoja = hojaNuevaDesde(HOJA_POR_DEFECTO(), "Hoja 1");
  return {
    proyecto: {
      version: 5,
      meta: {
        nombre: "proyecto_sin_nombre",
        fechaCreacion: new Date().toISOString(),
        ultimaModificacion: new Date().toISOString(),
      },
      hojas: [hoja],
      datosProyecto: DATOS_PROYECTO_POR_DEFECTO(),
    },
    hojaId: hoja.id,
  };
}

const inicial = proyectoInicial();

/**
 * Autoguardado en el navegador (Paso "finalizar el editor"): hasta acá el
 * único guardado era la descarga manual de un JSON — cerrar la pestaña sin
 * haber guardado perdía todo el trabajo. Esto es una red de seguridad
 * local, no un reemplazo: "Guardar" sigue descargando el archivo igual
 * que siempre. Si el día de mañana existe guardado en la nube, esta misma
 * clave de localStorage puede convivir con eso sin tocarse.
 */
const CLAVE_AUTOGUARDADO = "vatia-autoguardado";

export const useEditor = create<EstadoEditor>((set, get) => {
  /** Vuelca SOLO la config (rótulo/notas/formato) a la entrada activa */
  function volcarCfgActiva(cfg: HojaConfig): void {
    const { proyecto, hojaActivaId } = get();
    set({
      proyecto: {
        ...proyecto,
        hojas: proyecto.hojas.map((h) =>
          h.id === hojaActivaId ? { ...h, ...clonarCfg(cfg) } : h,
        ),
      },
    });
  }

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

  /** Guarda el estado de trabajo actual dentro de la entrada de la hoja activa */
  function volcarActiva(viewport?: Viewport): void {
    set({ proyecto: proyectoVolcado(get(), viewport) });
  }

  return {
    proyecto: inicial.proyecto,
    hojaActivaId: inicial.hojaId,
    nodos: [],
    conexiones: [],
    nombreProyecto: inicial.proyecto.meta.nombre,
    problemasProyecto: [],
    paletaVisible: true,
    panelHojaAbierto: false,
    panelProyectoAbierto: false,
    modoAdmin: localStorage.getItem("vatia-admin") === "true",
    avisoRecuperado: false,
    exportandoTodo: false,
    incluirBomEnExportacion: false,
    exportandoA0: false,
    permitirVariasPaginasA0: false,
    hoja: clonarCfg(inicial.proyecto.hojas[0]),
    version: 0,
    promptCortocircuitoHojaId: null,
    confirmacion: null,

    descartarAvisoRecuperado() {
      set({ avisoRecuperado: false });
    },

    cerrarPromptCortocircuito() {
      set({ promptCortocircuitoHojaId: null });
    },

    pedirConfirmacion(mensaje, onConfirmar) {
      set({ confirmacion: { mensaje, onConfirmar } });
    },

    mostrarAlerta(mensaje) {
      set({ confirmacion: { mensaje } });
    },

    cerrarConfirmacion() {
      set({ confirmacion: null });
    },

    iniciarExportacionCompleta(incluirBom) {
      set({ exportandoTodo: true, incluirBomEnExportacion: incluirBom });
    },
    finalizarExportacionCompleta() {
      set({ exportandoTodo: false });
    },

    iniciarExportacionA0(permitirVariasPaginas) {
      set({ exportandoA0: true, permitirVariasPaginasA0: permitirVariasPaginas });
    },
    finalizarExportacionA0() {
      set({ exportandoA0: false });
    },

    alternarPaleta() {
      set((s) => ({ paletaVisible: !s.paletaVisible }));
    },

    alternarPanelHoja() {
      set((s) => ({ panelHojaAbierto: !s.panelHojaAbierto }));
    },

    alternarPanelProyecto() {
      set((s) => ({ panelProyectoAbierto: !s.panelProyectoAbierto }));
    },

    actualizarDatosProyecto(patch) {
      set((s) => ({
        proyecto: {
          ...s.proyecto,
          datosProyecto: { ...s.proyecto.datosProyecto, ...patch },
        },
      }));
    },

    alternarAdmin() {
      set((s) => {
        const siguiente = !s.modoAdmin;
        localStorage.setItem("vatia-admin", String(siguiente));
        return { modoAdmin: siguiente };
      });
    },

    actualizarHoja(patch) {
      // Escribe en el espejo Y en la entrada del proyecto (para que el
      // cambio sobreviva al cambio de pestaña)
      set((s) => ({
        hoja: {
          ...s.hoja,
          ...patch,
          notasGabinete: {
            ...s.hoja.notasGabinete,
            ...(patch.notasGabinete ?? {}),
          },
          rotulo: { ...s.hoja.rotulo, ...(patch.rotulo ?? {}) },
          fuente_cortocircuito:
            patch.fuente_cortocircuito !== undefined
              ? { ...s.hoja.fuente_cortocircuito, ...patch.fuente_cortocircuito }
              : s.hoja.fuente_cortocircuito,
        },
      }));
      const espejo = get().hoja;
      volcarCfgActiva(espejo);
    },
    agregarSimbolo(codigoIec, x, y) {
      const simbolo = obtenerSimbolo(codigoIec);
      if (!simbolo) return;
      // La barra de distribución es un nodo propio (C8): estirable,
      // con puntos de conexión a lo largo de toda su extensión
      if (codigoIec === BARRA_CODIGO) {
        const data: DatosBarra = {
          tipo: "barra",
          codigo_iec: BARRA_CODIGO,
          rotacion: 0,
          largoPx: LARGO_BARRA_DEFECTO_PX,
          atributos: { ...simbolo.metadata.atributos_base },
        };
        const pos = limitarAHoja(x, y, data);
        const nodo: Node<NodoData> = {
          id: nuevoId(get().nodos, "n"),
          type: "barra",
          position: pos,
          data,
          selected: true,
        };
        ejecutar({
          descripcion: "agregar barra",
          do: () => set((s) => ({ nodos: [...s.nodos.map((n) => ({ ...n, selected: false })), nodo] })),
          undo: () => set((s) => ({ nodos: s.nodos.filter((n) => n.id !== nodo.id) })),
        });
        return;
      }
      const data: DatosSimbolo = {
        tipo: "simbolo",
        codigo_iec: codigoIec,
        rotacion: 0,
        atributos: { ...simbolo.metadata.atributos_base },
      };
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
      // Semilla coherente con los valores por defecto (3F+N+PE)
      data.atributos = atributosAlimentador(data);
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

      // Primer alimentador de una hoja RAÍZ (alimentador principal) que
      // todavía no tiene fuente de cortocircuito cargada: se pregunta acá
      // mismo, en el momento en que "se le asigna al alimentador" (E39) —
      // en vez de dejarlo escondido en Configuración de hoja hasta que a
      // alguien se le ocurra ir a buscarlo. Una hoja seccional (cuelga de
      // otro tablero) no tiene fuente propia, así que no se pregunta ahí.
      const fuenteActual = get().hoja.fuente_cortocircuito;
      if (
        existentes === 0 &&
        get().hojaPadreDeActiva() === null &&
        !fuenteActual?.scc_mva &&
        !fuenteActual?.icc_ka
      ) {
        set({ promptCortocircuitoHojaId: get().hojaActivaId });
      }
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

    actualizarDatosBarra(id, patch) {
      const snapshot = get().nodos.find((n) => n.id === id);
      if (!snapshot || !esDatosBarra(snapshot.data)) return;
      ejecutar({
        descripcion: `editar barra ${id}`,
        do: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              n.id === id && esDatosBarra(n.data)
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

    estirarBarra(id, largoPx, fase, origen = "der") {
      const normalizar = (v: number): number =>
        Math.min(
          2000,
          Math.max(40, Math.round(v / GRILLA_PX) * GRILLA_PX),
        );
      /** Largo+posición coherentes: estirando desde el extremo IZQ el
       * extremo derecho queda fijo (la posición corre sobre el eje
       * local según el giro). */
      const aplicar = (largo: number) => {
        const base = snapshotsEstiro.get(id);
        set((s) => ({
          nodos: s.nodos.map((n) => {
            if (!(n.id === id && esDatosBarra(n.data))) return n;
            let posicion = n.position;
            if (origen === "izq" && base) {
              const giro =
                ((((n.data.rotacion % 360) + 360) % 360) / 90) | 0;
              const ux = giro === 0 ? 1 : giro === 2 ? -1 : 0;
              const uy = giro === 1 ? 1 : giro === 3 ? -1 : 0;
              const delta = base.data.largoPx - largo;
              posicion = {
                x: base.posicion.x + ux * delta,
                y: base.posicion.y + uy * delta,
              };
            }
            return { ...n, data: { ...n.data, largoPx: largo }, position: posicion };
          }),
        }));
      };

      if (fase === "inicio") {
        const nodo = get().nodos.find((n) => n.id === id);
        if (!nodo || !esDatosBarra(nodo.data)) return;
        snapshotsEstiro.set(id, {
          data: nodo.data,
          posicion: { ...nodo.position },
        });
        aplicar(normalizar(largoPx));
        return;
      }
      if (fase === "moviendo") {
        aplicar(normalizar(largoPx));
        return;
      }
      // fin: un solo paso de historial con el estado previo al gesto
      const antes = snapshotsEstiro.get(id);
      snapshotsEstiro.delete(id);
      if (!antes) return;
      const nodoFinal = get().nodos.find((n) => n.id === id);
      const valorFinal =
        nodoFinal && esDatosBarra(nodoFinal.data)
          ? nodoFinal.data.largoPx
          : normalizar(largoPx);
      let posicionFinal = antes.posicion;
      if (origen === "izq") {
        const giro = ((((antes.data.rotacion % 360) + 360) % 360) / 90) | 0;
        const ux = giro === 0 ? 1 : giro === 2 ? -1 : 0;
        const uy = giro === 1 ? 1 : giro === 3 ? -1 : 0;
        const delta = antes.data.largoPx - valorFinal;
        posicionFinal = {
          x: antes.posicion.x + ux * delta,
          y: antes.posicion.y + uy * delta,
        };
      }
      ejecutar({
        descripcion: `estirar barra ${id}`,
        do: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              n.id === id && esDatosBarra(n.data)
                ? {
                    ...n,
                    data: { ...n.data, largoPx: valorFinal },
                    posicion: posicionFinal,
                  }
                : n,
            ),
          })),
        undo: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              n.id === id
                ? { ...n, data: antes.data, position: antes.posicion }
                : n,
            ),
          })),
      });
    },

    actualizarAtributosNodo(id, atributos) {
      const snapshot = get().nodos.find((n) => n.id === id);
      if (!snapshot || esDatosAlimentador(snapshot.data)) return;
      const antes = snapshot.data.atributos;
      if (
        Object.keys(antes).length === Object.keys(atributos).length &&
        Object.entries(atributos).every(
          ([k, v]) => k in antes && antes[k] === v,
        )
      )
        return; // nada cambió → no ensucia el historial
      ejecutar({
        descripcion: `editar atributos ${id}`,
        do: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              n.id === id && !esDatosAlimentador(n.data)
                ? { ...n, data: { ...n.data, atributos } }
                : n,
            ),
          })),
        undo: () =>
          set((s) => ({
            nodos: s.nodos.map((n) =>
              n.id === id && !esDatosAlimentador(n.data)
                ? { ...n, data: { ...n.data, atributos: antes } }
                : n,
            ),
          })),
      });
    },

    actualizarAtributosConexion(id, atributos) {
      const snapshot = get().conexiones.find((e) => e.id === id);
      if (!snapshot) return;
      const antes = (snapshot.data?.atributosConductor as Record<string, unknown> | undefined) ?? {};
      if (
        Object.keys(antes).length === Object.keys(atributos).length &&
        Object.entries(atributos).every(
          ([k, v]) => k in antes && antes[k] === v,
        )
      )
        return;
      ejecutar({
        descripcion: `editar cable ${id}`,
        do: () =>
          set((s) => ({
            conexiones: s.conexiones.map((e) =>
              e.id === id
                ? { ...e, data: { ...(e.data ?? {}), atributosConductor: atributos } }
                : e,
            ),
          })),
        undo: () =>
          set((s) => ({
            conexiones: s.conexiones.map((e) =>
              e.id === id
                ? { ...e, data: { ...(e.data ?? {}), atributosConductor: antes } }
                : e,
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
        data: { atributosConductor: {} },
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

    reconectarConexion(id, conexion) {
      if (!conexion.source || !conexion.target) return;
      const antes = get().conexiones.find((e) => e.id === id);
      if (!antes) return;
      const despues = {
        source: conexion.source,
        sourceHandle: conexion.sourceHandle ?? null,
        target: conexion.target,
        targetHandle: conexion.targetHandle ?? null,
      };
      if (
        antes.source === despues.source &&
        antes.target === despues.target &&
        (antes.sourceHandle ?? null) === despues.sourceHandle &&
        (antes.targetHandle ?? null) === despues.targetHandle
      )
        return; // soltó donde mismo: nada que hacer
      ejecutar({
        descripcion: `reconectar ${id}`,
        do: () =>
          set((s) => ({
            conexiones: s.conexiones.map((e) =>
              e.id === id ? { ...e, ...despues } : e,
            ),
          })),
        undo: () =>
          set((s) => ({
            conexiones: s.conexiones.map((e) =>
              e.id === id
                ? {
                    ...e,
                    source: antes.source,
                    sourceHandle: antes.sourceHandle,
                    target: antes.target,
                    targetHandle: antes.targetHandle,
                  }
                : e,
            ),
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

    fijarPosiciones(mapa) {
      const hay = Object.keys(mapa).length > 0;
      if (!hay) return;
      set((s) => ({
        nodos: s.nodos.map((n) =>
          mapa[n.id] ? { ...n, position: { ...mapa[n.id] } } : n,
        ),
      }));
    },

    /* C29: quiebre arrastrable del cable. moverPaso actualiza SIN
     * historial mientras se arrastra; confirmarPaso graba la entrada de
     * deshacer una sola vez al soltar; limpiarPaso quita el paso
     * (vuelve a ruta automática) también con historial. */
    moverPasoConexion(id, punto) {
      set((s) => ({
        conexiones: s.conexiones.map((e) =>
          e.id === id ? { ...e, data: { ...e.data, paso: { ...punto } } } : e,
        ),
      }));
    },
    confirmarPasoConexion(id, antes) {
      const despues = (
        get().conexiones.find((e) => e.id === id)?.data as
          | { paso?: { x: number; y: number } | null }
          | undefined
      )?.paso ?? null;
      if (!despues) return;
      if (antes && despues.x === antes.x && despues.y === antes.y) return;
      ejecutar({
        descripcion: "quiebre de conexión",
        do: () =>
          set((s) => ({
            conexiones: s.conexiones.map((e) =>
              e.id === id
                ? { ...e, data: { ...e.data, paso: { ...despues } } }
                : e,
            ),
          })),
        undo: () =>
          set((s) => ({
            conexiones: s.conexiones.map((e) =>
              e.id === id
                ? { ...e, data: { ...e.data, paso: antes ?? null } }
                : e,
            ),
          })),
      });
    },
    limpiarPasoConexion(id) {
      const actual = (
        get().conexiones.find((e) => e.id === id)?.data as
          | { paso?: { x: number; y: number } | null }
          | undefined
      )?.paso ?? null;
      if (!actual) return;
      ejecutar({
        descripcion: "quitar quiebre",
        do: () =>
          set((s) => ({
            conexiones: s.conexiones.map((e) =>
              e.id === id ? { ...e, data: { ...e.data, paso: null } } : e,
            ),
          })),
        undo: () =>
          set((s) => ({
            conexiones: s.conexiones.map((e) =>
              e.id === id
                ? { ...e, data: { ...e.data, paso: { ...actual } } }
                : e,
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
      const snapshotHojas = get().proyecto.hojas;
      const hojaActivaId = get().hojaActivaId;
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
            // Si el nodo borrado era el origen de una hoja hija, se
            // desvincula (la hoja no se toca, solo pierde el link).
            proyecto: {
              ...s.proyecto,
              hojas: s.proyecto.hojas.map((h) =>
                h.hojaPadreId === hojaActivaId &&
                h.nodoOrigenId &&
                idsNodos.has(h.nodoOrigenId)
                  ? { ...h, hojaPadreId: undefined, nodoOrigenId: undefined }
                  : h,
              ),
            },
          })),
        undo: () =>
          set((s) => ({
            nodos: snapshotNodos,
            conexiones: snapshotEdges,
            proyecto: { ...s.proyecto, hojas: snapshotHojas },
          })),
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
        data: { atributosConductor: {} },
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

    seleccionarNodos(ids) {
      const sel = new Set(ids);
      set((s) => ({
        nodos: s.nodos.map((n) =>
          n.selected === sel.has(n.id)
            ? n
            : { ...n, selected: sel.has(n.id) },
        ),
      }));
    },

    setNombreProyecto(nombre) {
      set((s) => ({
        nombreProyecto: nombre,
        proyecto: {
          ...s.proyecto,
          meta: { ...s.proyecto.meta, nombre },
        },
      }));
    },

    /* ==================== Multi-hoja ==================== */

    agregarHoja() {
      const { proyecto } = get();
      // Nombre único "Hoja N"
      let n = proyecto.hojas.length + 1;
      const nombres = new Set(proyecto.hojas.map((h) => h.nombre));
      while (nombres.has(`Hoja ${n}`)) n += 1;
      const nueva = hojaNuevaDesde(clonarCfg(get().hoja), `Hoja ${n}`);
      set((s) => ({
        proyecto: { ...s.proyecto, hojas: [...s.proyecto.hojas, nueva] },
        version: s.version + 1,
      }));
      // NO se cambia la hoja activa (decisión de diseño): el usuario
      // queda donde está y va a la nueva desde la pestaña.
      return nueva.id;
    },

    crearOIrAHojaHija(nodoId) {
      const { proyecto, hojaActivaId, nodos } = get();
      // Ya existe una hoja hija de este nodo puntual: navegar, no duplicar.
      const existente = proyecto.hojas.find(
        (h) => h.hojaPadreId === hojaActivaId && h.nodoOrigenId === nodoId,
      );
      if (existente) {
        get().cambiarHojaActiva(existente.id);
        return existente.id;
      }

      const nodo = nodos.find((n) => n.id === nodoId);
      const atributos = (nodo?.data as { atributos?: Record<string, unknown> } | undefined)
        ?.atributos;
      const sugerido =
        (typeof atributos?.descripcion === "string" && atributos.descripcion.trim()) ||
        (typeof atributos?.codigo_circuito === "string" &&
          `Tablero ${atributos.codigo_circuito}`) ||
        "Hoja hija";
      const nombres = new Set(proyecto.hojas.map((h) => h.nombre));
      let nombre = sugerido;
      let sufijo = 2;
      while (nombres.has(nombre)) {
        nombre = `${sugerido} (${sufijo})`;
        sufijo += 1;
      }

      const nueva: Hoja = {
        ...hojaNuevaDesde(HOJA_POR_DEFECTO(), nombre),
        modo: get().hoja.modo,
        hojaPadreId: hojaActivaId,
        nodoOrigenId: nodoId,
      };
      const indice = proyecto.hojas.findIndex((h) => h.id === hojaActivaId);
      const hojas = [...proyecto.hojas];
      hojas.splice(indice + 1, 0, nueva);
      set((s) => ({
        proyecto: { ...s.proyecto, hojas },
        version: s.version + 1,
      }));
      get().cambiarHojaActiva(nueva.id);
      return nueva.id;
    },

    hojaPadreDeActiva() {
      const { proyecto, hojaActivaId } = get();
      const activa = proyecto.hojas.find((h) => h.id === hojaActivaId);
      if (!activa?.hojaPadreId) return null;
      return proyecto.hojas.find((h) => h.id === activa.hojaPadreId) ?? null;
    },

    irAHojaPadre() {
      const padre = get().hojaPadreDeActiva();
      if (padre) get().cambiarHojaActiva(padre.id);
    },

    eliminarHoja(id) {
      const { proyecto, hojaActivaId } = get();
      if (proyecto.hojas.length <= 1) return; // nunca sin hojas
      const indice = proyecto.hojas.findIndex((h) => h.id === id);
      if (indice === -1) return;

      // Si borramos la activa, primero nos mudamos a una vecina
      if (id === hojaActivaId) {
        const vecina =
          proyecto.hojas[indice + 1] ?? proyecto.hojas[indice - 1];
        get().cambiarHojaActiva(vecina.id);
      }

      set((s) => ({
        proyecto: {
          ...s.proyecto,
          hojas: s.proyecto.hojas.filter((h) => h.id !== id),
        },
        version: s.version + 1,
      }));
      historial.eliminarHoja(id);

      // Barrido defensivo: ninguna conexión de las hojas restantes debe
      // apuntar a nodos inexistentes (por invariante no debería pasar), y
      // ninguna hoja hija debe quedar apuntando a un padre borrado — se
      // desvincula (queda como hoja de nivel raíz), nunca se borra en
      // cadena: es contenido del usuario.
      set((s) => ({
        proyecto: {
          ...s.proyecto,
          hojas: s.proyecto.hojas.map((h) => {
            const ids = new Set(h.nodos.map((n) => n.id));
            const filtradas = h.conexiones.filter((c) => {
              const [a] = c.desde.split(".");
              const [b] = c.hasta.split(".");
              return ids.has(a) && ids.has(b);
            });
            const huerfana = h.hojaPadreId === id;
            if (filtradas.length === h.conexiones.length && !huerfana) return h;
            return {
              ...h,
              conexiones: filtradas,
              ...(huerfana ? { hojaPadreId: undefined, nodoOrigenId: undefined } : {}),
            };
          }),
        },
      }));
    },

    duplicarHoja(id) {
      const { proyecto, hojaActivaId } = get();
      const fuente = proyecto.hojas.find((h) => h.id === id);
      if (!fuente) return null;
      // Si duplicamos la activa, volcamos su estado de trabajo primero
      if (id === hojaActivaId) volcarActiva();
      const orig = get().proyecto.hojas.find((h) => h.id === id)!;

      // Remapeo de ids para preservar unicidad global (la regla de corte
      // por pertenencia a hoja depende de que los ids no colisionen)
      const mapa = new Map<string, string>();
      const nodosCopiados: NodoProyecto[] = orig.nodos.map((n) => {
        const prefijo = n.tipo === "alimentador" ? "a" : "n";
        const nuevoIdStr = `${prefijo}${Date.now().toString(36)}${mapa.size}${Math.floor(Math.random() * 1000)}`;
        mapa.set(n.id, nuevoIdStr);
        return { ...n, id: nuevoIdStr, atributos: { ...(n.atributos ?? {}) } };
      });
      const conexionesCopiadas: ConexionProyecto[] = orig.conexiones.map(
        (c, i) => {
          const [src, srcH] = c.desde.split(".");
          const [tgt, tgtH] = c.hasta.split(".");
          return {
            id: `c${Date.now().toString(36)}d${i}`,
            desde: `${mapa.get(src) ?? src}.${srcH ?? ""}`,
            hasta: `${mapa.get(tgt) ?? tgt}.${tgtH ?? ""}`,
            ...(c.paso ? { paso: { ...c.paso } } : {}),
            atributos_conductor: { ...(c.atributos_conductor ?? {}) },
          };
        },
      );

      const indice = get().proyecto.hojas.findIndex((h) => h.id === id);
      const nombres = new Set(get().proyecto.hojas.map((h) => h.nombre));
      let sufijo = 2;
      while (nombres.has(`${orig.nombre} (${sufijo})`)) sufijo += 1;
      const copia: Hoja = {
        ...clonarCfg(orig),
        id: crypto.randomUUID(),
        nombre: `${orig.nombre} (${sufijo})`,
        nodos: nodosCopiados,
        conexiones: conexionesCopiadas,
        viewport: orig.viewport ? { ...orig.viewport } : undefined,
        // clonarCfg clona TODO lo que trae orig en tiempo de ejecución
        // (JSON.stringify no respeta el tipo HojaConfig), así que si la
        // fuente era una hoja hija, el link se colaría acá también: dos
        // hojas no pueden "colgar" del mismo nodo de origen. La copia
        // nace independiente.
        hojaPadreId: undefined,
        nodoOrigenId: undefined,
      };
      const hojas = [...get().proyecto.hojas];
      hojas.splice(indice + 1, 0, copia);
      set((s) => ({
        proyecto: { ...s.proyecto, hojas },
        version: s.version + 1,
      }));
      return copia.id;
    },

    renombrarHoja(id, nombre) {
      set((s) => ({
        proyecto: {
          ...s.proyecto,
          hojas: s.proyecto.hojas.map((h) =>
            h.id === id ? { ...h, nombre } : h,
          ),
        },
        version: s.version + 1,
      }));
    },

    reordenarHojas(desde, hacia) {
      set((s) => {
        const hojas = [...s.proyecto.hojas];
        if (
          desde < 0 ||
          hacia < 0 ||
          desde >= hojas.length ||
          hacia >= hojas.length
        ) {
          return {};
        }
        const [quitada] = hojas.splice(desde, 1);
        hojas.splice(hacia, 0, quitada);
        return {
          proyecto: { ...s.proyecto, hojas },
          version: s.version + 1,
        };
      });
    },

    cambiarHojaActiva(id, viewportActual) {
      const { hojaActivaId, proyecto } = get();
      if (id === hojaActivaId) return;
      const destino = proyecto.hojas.find((h) => h.id === id);
      if (!destino) return;
      // 1) Volcar el trabajo de la hoja saliente (+ su viewport)
      volcarActiva(viewportActual);
      // 2) Cargar el estado de trabajo de la hoja entrante
      const fuente = get().proyecto.hojas.find((h) => h.id === id)!;
      const construido = construirEstadoHoja(fuente);
      historial.usar(id);
      set({
        hojaActivaId: id,
        nodos: construido.nodos,
        conexiones: construido.conexiones,
        hoja: construido.cfg,
        version: get().version + 1,
      });
    },

    guardarViewport(vp) {
      const { proyecto, hojaActivaId } = get();
      set({
        proyecto: {
          ...proyecto,
          hojas: proyecto.hojas.map((h) =>
            h.id === hojaActivaId ? { ...h, viewport: vp } : h,
          ),
        },
      });
    },

    /**
     * Mueve la selección de la hoja activa a otra hoja.
     * Regla de corte: las conexiones internas viajan; las que cruzan
     * hojas se cortan (se informan). Todo queda como UN comando compuesto
     * en la pila de la hoja ORIGEN (donde está mirando el usuario):
     * Ctrl+Z restaura nodos + conexiones cortadas atómicamente.
     */
    moverSeleccionAHoja(destinoId) {
      const { nodos, conexiones, proyecto, hojaActivaId } = get();
      if (destinoId === hojaActivaId) return null;
      const destino = proyecto.hojas.find((h) => h.id === destinoId);
      if (!destino) return null;
      const seleccion = nodos.filter((n) => n.selected);
      if (seleccion.length === 0) return null;
      const idsSel = new Set(seleccion.map((n) => n.id));

      // Conexiones que viajan (ambos extremos) vs que se cortan (uno)
      const viajan = conexiones.filter(
        (e) => idsSel.has(e.source) && idsSel.has(e.target),
      );
      const cortadas = conexiones.filter(
        (e) => idsSel.has(e.source) !== idsSel.has(e.target),
      );

      // Nuevos ids en el espacio de la hoja destino
      const remap = new Map<string, string>();
      for (const n of seleccion) {
        const prefijo = esDatosAlimentador(n.data) ? "a" : "n";
        remap.set(
          n.id,
          `${prefijo}${Date.now().toString(36)}${remap.size}${Math.floor(Math.random() * 1000)}`,
        );
      }
      const nodosDestino: NodoProyecto[] = seleccion.map(rfANodoProyecto).map(
        (np, i) => ({ ...np, id: [...remap.values()][i] }),
      );
      const connsDestino: ConexionProyecto[] = viajan.map((e, i) => {
        const paso =
          (e.data?.paso as { x: number; y: number } | undefined) ?? undefined;
        return {
          id: `c${Date.now().toString(36)}m${i}`,
          desde: `${remap.get(e.source)}.`,
          hasta: `${remap.get(e.target)}.`,
          ...(paso ? { paso: { ...paso } } : {}),
          atributos_conductor: {
            ...((e.data?.atributosConductor as Record<string, unknown> | undefined) ??
              {}),
          },
        };
      });

      const snapshotNodos = nodos;
      const snapshotConexiones = conexiones;

      ejecutar({
        descripcion: `mover ${seleccion.length} símbolos a «${destino.nombre}»`,
        do: () => {
          // Origen: fuera selección y sus aristas (viajaron o cortadas)
          set((s) => ({
            nodos: s.nodos.filter((n) => !idsSel.has(n.id)),
            conexiones: s.conexiones.filter(
              (e) => !idsSel.has(e.source) && !idsSel.has(e.target),
            ),
          }));
          // Destino: llegan nodos y conexiones internas
          set((s) => ({
            proyecto: {
              ...s.proyecto,
              hojas: s.proyecto.hojas.map((h) =>
                h.id === destinoId
                  ? {
                      ...h,
                      nodos: [...h.nodos, ...nodosDestino],
                      conexiones: [...h.conexiones, ...connsDestino],
                    }
                  : h,
              ),
            },
          }));
        },
        undo: () => {
          // Restaurar origen tal como estaba…
          set({ nodos: snapshotNodos, conexiones: snapshotConexiones });
          // …y quitar de destino lo que había llegado
          const idsLlegaron = new Set(nodosDestino.map((n) => n.id));
          const idsConns = new Set(connsDestino.map((c) => c.id));
          set((s) => ({
            proyecto: {
              ...s.proyecto,
              hojas: s.proyecto.hojas.map((h) =>
                h.id === destinoId
                  ? {
                      ...h,
                      nodos: h.nodos.filter((n) => !idsLlegaron.has(n.id)),
                      conexiones: h.conexiones.filter(
                        (c) => !idsConns.has(c.id),
                      ),
                    }
                  : h,
              ),
            },
          }));
        },
      });

      return { movidos: seleccion.length, cortadas: cortadas.length };
    },

    cargarProyecto(entrada) {
      const bruto = migrarAProyectoV5(entrada);

      const problemas: string[] = [];
      const hojasNormalizadas: Hoja[] = bruto.hojas.map((h) => {
        const construida = construirEstadoHoja(h);
        problemas.push(...construida.problemas);
        return {
          ...(h as Hoja),
          ...construida.cfg,
          id: h.id || crypto.randomUUID(),
          nombre: h.nombre || "Hoja",
          nodos: construida.nodos.map(rfANodoProyecto),
          conexiones: construida.conexiones.map(rfAConexionProyecto),
          viewport: h.viewport,
        };
      });
      if (hojasNormalizadas.length === 0) {
        hojasNormalizadas.push(hojaNuevaDesde(HOJA_POR_DEFECTO(), "Hoja 1"));
      }

      const proyecto: Proyecto = {
        version: 5,
        meta: bruto.meta ?? {
          nombre: "proyecto_sin_nombre",
          fechaCreacion: new Date().toISOString(),
          ultimaModificacion: new Date().toISOString(),
        },
        hojas: hojasNormalizadas,
        datosProyecto: bruto.datosProyecto ?? DATOS_PROYECTO_POR_DEFECTO(),
      };

      const primera = proyecto.hojas[0];
      const estado = construirEstadoHoja(primera);
      historial.limpiar(); // limpia TODAS las pilas
      historial.usar(primera.id);
      set({
        proyecto,
        hojaActivaId: primera.id,
        nodos: estado.nodos,
        conexiones: estado.conexiones,
        nombreProyecto: proyecto.meta.nombre || "proyecto_sin_nombre",
        problemasProyecto: problemas,
        hoja: estado.cfg,
        version: get().version + 1,
      });
    },

    nuevoProyecto() {
      try {
        localStorage.removeItem(CLAVE_AUTOGUARDADO);
      } catch {
        /* localStorage no disponible: igual arranca en blanco en memoria */
      }
      const fresco = proyectoInicial();
      historial.limpiar();
      historial.usar(fresco.hojaId);
      const estado = construirEstadoHoja(fresco.proyecto.hojas[0]);
      set({
        proyecto: fresco.proyecto,
        hojaActivaId: fresco.hojaId,
        nodos: estado.nodos,
        conexiones: estado.conexiones,
        nombreProyecto: fresco.proyecto.meta.nombre,
        problemasProyecto: [],
        hoja: estado.cfg,
        avisoRecuperado: false,
        version: get().version + 1,
      });
    },

    serializarActual() {
      volcarActiva();
      return get().proyecto;
    },
  };
});

// La hoja inicial tiene su pila de historial desde el arranque
historial.usar(inicial.hojaId);

(function recuperarAutoguardado() {
  try {
    const guardado = localStorage.getItem(CLAVE_AUTOGUARDADO);
    if (guardado) {
      useEditor.getState().cargarProyecto(guardado);
      useEditor.setState({ avisoRecuperado: true });
    }
  } catch {
    /* localStorage no disponible o el JSON guardado está corrupto:
     * arranca en blanco, como si no hubiera autoguardado. */
  }
})();

let temporizadorAutoguardado: ReturnType<typeof setTimeout> | undefined;
useEditor.subscribe(() => {
  clearTimeout(temporizadorAutoguardado);
  temporizadorAutoguardado = setTimeout(() => {
    try {
      // proyectoVolcado (no serializarActual): NO llama a set(), para no
      // volver a notificar a este mismo listener y reprogramarse solo
      // para siempre.
      const proyecto = proyectoVolcado(useEditor.getState());
      localStorage.setItem(CLAVE_AUTOGUARDADO, JSON.stringify(proyecto));
    } catch {
      /* cuota de localStorage excedida u otro error: se ignora — el
       * trabajo en memoria no se pierde por esto, solo la red de
       * seguridad queda sin actualizar hasta el próximo cambio. */
    }
  }, 1000);
});

export { historial };
