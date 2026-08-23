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
}
