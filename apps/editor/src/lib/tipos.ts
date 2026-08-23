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

/** Márgenes del enmarcado en mm según IRAM 4504 (izquierda mayor para archivado) */
export const MARGEN_IZQ_MM = 25;
export const MARGEN_RESTO_MM = 10;

/**
 * Rectángulo útil de trabajo dentro del enmarcado, en px de canvas.
 * Todo símbolo debe vivir acá: la hoja es un espacio finito, si algo
 * no entra corresponde pasar a otra lámina.
 */
export function rectanguloUtil(hoja: HojaConfig): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  const { pxW, pxH } = dimensionesHoja(hoja);
  return {
    x0: MARGEN_IZQ_MM * PX_POR_MM,
    y0: MARGEN_RESTO_MM * PX_POR_MM,
    x1: pxW - MARGEN_RESTO_MM * PX_POR_MM,
    y1: pxH - MARGEN_RESTO_MM * PX_POR_MM,
  };
}

/**
 * Encabezado de hoja según los unifilares reales del proyecto (PPS):
 * no hay cajetín IRAM; cada lámina se identifica arriba al centro con
 * el nombre del tablero y de dónde viene su alimentación.
 */
export interface EncabezadoConfig {
  /** Nombre del tablero que documenta la hoja, ej. "TS-G1" o "TGBT" */
  tablero: string;
  /** Procedencias de alimentación, ej. ["Desde TGBT", "Desde PAT"] */
  alimentadores: string[];
}

export interface HojaConfig {
  formato: FormatoHoja;
  orientacion: OrientacionHoja;
  encabezado: EncabezadoConfig;
  /** Notas constructivas del gabinete, una por renglón (arriba a la izquierda) */
  notasGabinete: string[];
  /** Nota de seguridad operativa al pie; vacía si la hoja no la lleva */
  notaSeguridad: string;
}

export function HOJA_POR_DEFECTO(): HojaConfig {
  return {
    formato: "A3",
    orientacion: "horizontal",
    encabezado: { tablero: "TGBT", alimentadores: ["Desde PAT"] },
    notasGabinete: [
      "Gabinete o armazón metálico autoportante",
      "Clase I (puesta a tierra de masas metálicas)",
      "Exclusivo para personal BA4 o BA5",
      "IP00 (tablero abierto según IEC 60529)",
      "Sistema de barras principales de cobre desnudo",
      "Sin reserva de espacio futuro (0%)",
    ],
    notaSeguridad: "",
  };
}

export function dimensionesHoja(hoja: HojaConfig): { pxW: number; pxH: number } {
  const [corto, largo] = TAMANIOS_HOJA_MM[hoja.formato];
  const [mmW, mmH] =
    hoja.orientacion === "horizontal" ? [largo, corto] : [corto, largo];
  return { pxW: mmW * PX_POR_MM, pxH: mmH * PX_POR_MM };
}
