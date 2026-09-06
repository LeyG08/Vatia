/**
 * Categorías visuales de la paleta para la familia "aparato" (C4): antes
 * todos los símbolos de aparato caían en una sola lista larga bajo
 * "Aparatos" — pedido explícito del usuario: separarlos en protección,
 * maniobra, medición, etc., como en un catálogo real, en vez de todo
 * junto. Es solo agrupación de PALETA — no reemplaza `tipo_aparato`
 * (el discriminador real de la ficha técnica, en `esquemas.ts`).
 */
export type CategoriaAparato =
  | "proteccion"
  | "maniobra"
  | "motores_transformadores"
  | "medicion"
  | "senalizacion"
  | "mando"
  | "contactos_bobinas"
  | "deteccion";

export const ORDEN_CATEGORIAS_APARATO: CategoriaAparato[] = [
  "proteccion",
  "maniobra",
  "motores_transformadores",
  "medicion",
  "senalizacion",
  "mando",
  "contactos_bobinas",
  "deteccion",
];

const ETIQUETAS: Record<CategoriaAparato, string> = {
  proteccion: "Protección",
  maniobra: "Maniobra",
  motores_transformadores: "Motores y transformadores",
  medicion: "Medición y compensación",
  senalizacion: "Señalización y alarmas",
  mando: "Mando",
  contactos_bobinas: "Contactos y bobinas",
  deteccion: "Detección",
};

export function etiquetaCategoriaAparato(c: CategoriaAparato): string {
  return ETIQUETAS[c];
}

const CATEGORIA_POR_TIPO_APARATO: Readonly<Record<string, CategoriaAparato>> = {
  interruptor_termomagnetico: "proteccion",
  mccb_caja_moldeada: "proteccion",
  fusible: "proteccion",
  portafusible: "proteccion",
  guardamotor_termomagnetico: "proteccion",
  guardamotor_magnetico: "proteccion",
  interruptor_diferencial: "proteccion",
  rele_termico: "proteccion",
  rele_proteccion_tension: "proteccion",
  contactor: "maniobra",
  motor_trifasico: "motores_transformadores",
  motor_monofasico: "motores_transformadores",
  transformador: "motores_transformadores",
  transformador_corriente: "medicion",
  instrumento_medicion: "medicion",
  banco_capacitores: "medicion",
  sirena_alarma: "senalizacion",
  lampara_piloto: "senalizacion",
  pulsador: "mando",
  pulsador_emergencia: "mando",
  selector: "mando",
  contacto_auxiliar: "contactos_bobinas",
  rele_auxiliar: "contactos_bobinas",
  temporizador: "contactos_bobinas",
  interruptor_posicion: "deteccion",
};

/** null si el tipo no tiene categoría mapeada (símbolo nuevo sin
 * actualizar acá, o sin `atributos_base.tipo_aparato` todavía). */
export function categoriaDeTipoAparato(
  tipoAparato: string | undefined,
): CategoriaAparato | null {
  if (!tipoAparato) return null;
  return CATEGORIA_POR_TIPO_APARATO[tipoAparato] ?? null;
}
