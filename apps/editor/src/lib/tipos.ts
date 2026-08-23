export type RolConexion = "entrada" | "salida" | "tierra";
export type FamiliaAtributos = "aparato" | "conductor" | "barra";
export type EstadoRevision =
  | "pendiente_revision"
  | "verificado_aea"
  | "corregido";

export interface PuntoConexion {
  id: string;
  rol: RolConexion;
  x: number;
  y: number;
}

export interface MetadataSimbolo {
  codigo_iec: string;
  nombre: string;
  familia_atributos: FamiliaAtributos;
  estado_revision: EstadoRevision;
  puntos_conexion: PuntoConexion[];
  atributos_base?: Record<string, unknown>;
  version_libreria?: string;
  fuente_qet?: string;
}

export interface SimboloDef {
  codigo_iec: string;
  metadata: MetadataSimbolo;
  svgRaw: string;
  viewBox: { minX: number; minY: number; ancho: number; alto: number };
}

export interface ProblemaCarga {
  nivel: "error" | "aviso";
  mensaje: string;
}

export interface NodoProyecto {
  id: string;
  codigo_iec: string;
  posicion: { x: number; y: number };
  rotacion?: number;
  atributos?: Record<string, unknown>;
}

export interface ConexionProyecto {
  id: string;
  desde: string;
  hasta: string;
  atributos_conductor?: Record<string, unknown>;
}

export interface ProyectoJSON {
  nombre: string;
  nodos: NodoProyecto[];
  conexiones: ConexionProyecto[];
  modo_vista: "unifilar_simple" | "multifilar";
  hoja?: HojaConfig;
}

/* ---- Hoja / page setup ---- */

export type FormatoHoja = "A4" | "A3" | "A2" | "A1" | "A0";
export type OrientacionHoja = "horizontal" | "vertical";

/** Tamaño serie A en mm [lado corto, lado largo] */
export const TAMANIOS_HOJA_MM: Record<FormatoHoja, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};

/** Escala de dibujo en pantalla: 4 px por mm de hoja real */
export const PX_POR_MM = 4;

/**
 * Rótulo normalizado IRAM 4508: denominación del plano en la franja
 * superior; debajo cliente / número de plano / escala; y en la base los
 * responsables con sus fechas.
 */
export interface RotuloConfig {
  titulo: string;
  cliente: string;
  numero: string;
  escala: string;
  proyectoNombre: string;
  proyectoFecha: string;
  dibujoNombre: string;
  dibujoFecha: string;
  revisionNombre: string;
  revisionFecha: string;
  aprobacionNombre: string;
  aprobacionFecha: string;
}

export const ROTULO_VACIO: RotuloConfig = {
  titulo: "",
  cliente: "",
  numero: "",
  escala: "",
  proyectoNombre: "",
  proyectoFecha: "",
  dibujoNombre: "",
  dibujoFecha: "",
  revisionNombre: "",
  revisionFecha: "",
  aprobacionNombre: "",
  aprobacionFecha: "",
};

export interface HojaConfig {
  formato: FormatoHoja;
  orientacion: OrientacionHoja;
  rotulo: RotuloConfig;
}

export function HOJA_POR_DEFECTO(): HojaConfig {
  return {
    formato: "A3",
    orientacion: "horizontal",
    rotulo: { ...ROTULO_VACIO },
  };
}

export function dimensionesHoja(hoja: HojaConfig): { pxW: number; pxH: number } {
  const [corto, largo] = TAMANIOS_HOJA_MM[hoja.formato];
  const [mmW, mmH] =
    hoja.orientacion === "horizontal" ? [largo, corto] : [corto, largo];
  return { pxW: mmW * PX_POR_MM, pxH: mmH * PX_POR_MM };
}
