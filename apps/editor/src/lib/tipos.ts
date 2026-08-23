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
  posicion: { x: number; y: number };
  /** "simbolo" por defecto, para compatibilidad con proyectos viejos */
  tipo?: "simbolo" | "alimentador";
  codigo_iec?: string;
  rotacion?: number;
  /** Datos propios cuando tipo = "alimentador" */
  datos?: Partial<AlimentadorConfig>;
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
 * Alimentador "Desde …" que entra al tablero: es un nodo del plano con
 * un conductor saliente. La referencia se arma combinando libremente
 * fases / neutro / tierra, o bien declarando una cantidad arbitraria de
 * conductores (modo "n").
 */
export interface AlimentadorConfig {
  /** Procedencia, ej. "TGBT" o "PAT" (el "Desde" va fijo en el dibujo) */
  origen: string;
  /** Tres líneas (trifásico) */
  fases: boolean;
  neutro: boolean;
  tierra: boolean;
  /**
   * null = usa la combinación fases/neutro/tierra;
   * número positivo = cantidad arbitraria de conductores.
   */
  cantidadN: number | null;
}

export function ALIMENTADOR_POR_DEFECTO(): AlimentadorConfig {
  return { origen: "", fases: true, neutro: true, tierra: true, cantidadN: null };
}

/** Texto de referencia que acompaña al conductor del alimentador */
export function etiquetaConductores(a: AlimentadorConfig): string {
  if (a.cantidadN != null) return `${a.cantidadN} conductores`;
  const partes: string[] = [];
  if (a.fases) partes.push("3 líneas");
  if (a.neutro) partes.push("neutro");
  if (a.tierra) partes.push("tierra");
  return partes.length > 0 ? partes.join(" + ") : "—";
}

/** Una fila de responsables del rótulo (Proyectó / Dibujó / Revisó / Aprobó) */
export interface ResponsableRotulo {
  rol: string;
  fecha: string;
  nombre: string;
}

/**
 * Rótulo normalizado según IRAM 4508 (figura 1). Cubre los campos
 * mínimos de la norma; se dibuja en el vértice inferior derecho,
 * pegado al recuadro, con contorno igual a este y líneas internas finas.
 */
export interface RotuloConfig {
  /** Campo 10 — logo / razón social de la empresa */
  empresa: string;
  /** Texto que oficia de logo si no hay imagen */
  logoTexto: string;
  /** Campo 7 — cliente (+ localidad como subcampo) */
  cliente: string;
  localidad: string;
  /** Campo 6 — denominación de lo representado */
  denominacion: string;
  /** Campo 8 — clave o número de lo representado */
  claveRepresentado: string;
  /** Campo 9 — nombre del archivo informático */
  nombreArchivo: string;
  /** Campo 1 — tolerancias generales */
  toleranciasGenerales: string;
  /** Campo 3 — escala; vacío = sin escala ("S/E") */
  escala: string;
  /** Identificación del método ISO según la norma: "(E)" o "(A)" */
  metodoIso: "(E)" | "(A)" | "";
  /** Campo 2 — responsables con fecha y nombre */
  responsables: ResponsableRotulo[];
  /** Campo 12 — número de plano propio */
  numeroPlano: string;
  /** Campo 11 — número de plano del cliente */
  numeroPlanoCliente: string;
  /** Campo 13 — paginación, ej. "1/3" */
  paginacion: string;
}

export function ROTULO_POR_DEFECTO(): RotuloConfig {
  return {
    empresa: "",
    logoTexto: "",
    cliente: "",
    localidad: "",
    denominacion: "",
    claveRepresentado: "",
    nombreArchivo: "",
    toleranciasGenerales: "",
    escala: "",
    metodoIso: "(E)",
    responsables: [
      { rol: "Proyectó", fecha: "", nombre: "" },
      { rol: "Dibujó", fecha: "", nombre: "" },
      { rol: "Revisó", fecha: "", nombre: "" },
      { rol: "Aprobó", fecha: "", nombre: "" },
    ],
    numeroPlano: "",
    numeroPlanoCliente: "",
    paginacion: "1/1",
  };
}

/**
 * Notas constructivas del gabinete, con estructura FIJA: siempre son
 * estas seis líneas, en este orden (material, clase de aislación,
 * personal apto, grado de protección IP, barras/conductores interiores
 * y reserva futura). Se dibujan arriba a la izquierda de la hoja.
 */
export interface NotasGabineteConfig {
  /** Material del gabinete o armazón */
  material: string;
  /** Clase de aislación (Clase I / II) */
  claseAislacion: string;
  /** Personal apto para operar (BA4/BA5, etc.) */
  personalApto: string;
  /** Grado de protección IP según IEC 60529 */
  gradoProteccion: string;
  /** Barras principales o conductores dentro del gabinete */
  barrasOConductores: string;
  /** Reserva de espacio para el futuro */
  reservaFutura: string;
}

export function NOTAS_GABINETE_POR_DEFECTO(): NotasGabineteConfig {
  return {
    material: "Gabinete o armazón metálico autoportante",
    claseAislacion: "Clase I (puesta a tierra de masas metálicas)",
    personalApto: "Exclusivo para personal BA4 o BA5",
    gradoProteccion: "IP00 (tablero abierto según IEC 60529)",
    barrasOConductores: "Sistema de barras principales de cobre desnudo",
    reservaFutura: "Sin reserva de espacio futuro (0%)",
  };
}

export interface HojaConfig {
  formato: FormatoHoja;
  orientacion: OrientacionHoja;
  /** Nombre del tablero documentado; se dibuja arriba, sobre el recuadro */
  tablero: string;
  /** Notas constructivas del gabinete (estructura fija, arriba a la izquierda) */
  notasGabinete: NotasGabineteConfig;
  /** Nota de seguridad operativa al pie; vacía si la hoja no la lleva */
  notaSeguridad: string;
  /** Rótulo IRAM 4508 del vértice inferior derecho */
  rotulo: RotuloConfig;
}

export function HOJA_POR_DEFECTO(): HojaConfig {
  return {
    formato: "A3",
    orientacion: "horizontal",
    tablero: "TGBT",
    notasGabinete: NOTAS_GABINETE_POR_DEFECTO(),
    notaSeguridad: "",
    rotulo: ROTULO_POR_DEFECTO(),
  };
}

export function dimensionesHoja(hoja: HojaConfig): { pxW: number; pxH: number } {
  const [corto, largo] = TAMANIOS_HOJA_MM[hoja.formato];
  const [mmW, mmH] =
    hoja.orientacion === "horizontal" ? [largo, corto] : [corto, largo];
  // Redondeo a múltiplos de 10 px (= grilla de trabajo): así las cuatro
  // líneas del recuadro caen sobre líneas de la grilla/puntos de la
  // hoja en cualquier formato (desvío de aspecto < 0,2 %, invisible).
  const decena = (v: number) => Math.round(v / 10) * 10;
  return { pxW: decena(mmW * PX_POR_MM), pxH: decena(mmH * PX_POR_MM) };
}
