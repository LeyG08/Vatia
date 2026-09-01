// ARCHIVO GENERADO por scripts/generar_tipos_atributos.py — NO editar a mano.
// Se deriva de libreria-simbolos/schemas/*.json. Para cambiar un campo, tocá
// el schema y volvé a correr el script; la CI verifica que estén sincronizados.
//
// Todos los campos son opcionales salvo el discriminante `tipo_aparato`: en el
// editor la ficha se completa de a poco, así que un aparato recién puesto en el
// plano tiene los atributos vacíos. La obligatoriedad la lleva `x-obligatorio`,
// que el Checklist AEA reporta sin bloquear.

/** Discriminante de la familia `aparato`. */
export type TipoAparato =
  | "banco_capacitores"
  | "contacto_auxiliar"
  | "contactor"
  | "fusible"
  | "guardamotor_magnetico"
  | "guardamotor_termomagnetico"
  | "instrumento_medicion"
  | "interruptor_diferencial"
  | "interruptor_termomagnetico"
  | "lampara_piloto"
  | "mccb_caja_moldeada"
  | "motor_trifasico"
  | "portafusible"
  | "pulsador"
  | "pulsador_emergencia"
  | "rele_auxiliar"
  | "rele_proteccion_tension"
  | "rele_termico"
  | "selector"
  | "sirena_alarma"
  | "transformador"
  | "transformador_corriente";

export interface AparatoBancoCapacitores {
  /** Tipo de aparato */
  tipo_aparato: "banco_capacitores";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Tensión (V) */
  tension_v?: number;
  /** Potencia (kVAR) */
  potencia_kvar?: number;
  /** Conexión */
  conexion?: "delta" | "estrella" | "otra";
  /** Cantidad de pasos */
  cantidad_pasos?: number;
}

export interface AparatoContactoAuxiliar {
  /** Tipo de aparato */
  tipo_aparato: "contacto_auxiliar";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Tipo de contacto */
  tipo_contacto?: "NA" | "NC" | "NA+NC" | "otra";
  /** Capacidad térmica Ith (A) */
  ith_a?: number;
  /** Tensión de operación (V) */
  ue_V?: number;
}

export interface AparatoContactor {
  /** Tipo de aparato */
  tipo_aparato: "contactor";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Cantidad de polos */
  cantidad_polos?: number;
  /** Tensión de operación (V) */
  ue_V?: number;
  /** Categoría de empleo */
  categoria_empleo?: "AC-1" | "AC-3" | "AC-4" | "AC-6b" | "otra";
  /** Corriente nominal (A) */
  in_a?: number;
  /** Tensión de bobina (V) */
  tension_bobina_v?: number;
}

/** Portafusible y fusible como dos productos distintos, como en las fichas SF-* del plano. */
export interface AparatoFusible {
  /** Tipo de aparato */
  tipo_aparato: "fusible";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Tensión del portafusible (V) */
  portafusible_tension_v?: number;
  /** Categoría del portafusible */
  portafusible_categoria?: string;
  /** Corriente nominal (A) */
  in_a?: number;
  /** Clase característica */
  clase_caracteristica?: "gG" | "gL" | "aM" | "F" | "otra";
  /** Tamaño */
  tamano?: string;
  /** Poder de corte (kA) */
  pdcc_kA?: number;
  /** Norma de fabricación */
  norma_fabricacion?: string;
}

/** Guardamotor magnético (IEC 60947-2/4-1): protege SOLO contra cortocircuito, con disparo magnético instantáneo. No lleva disparador térmico, por eso no declara rango de ajuste térmico Ir; la protección contra sobrecarga la aporta un relé térmico aparte. Simbólicamente se distingue del termomagnético en que lleva una sola caja de disparador. */
export interface AparatoGuardamotorMagnetico {
  tipo_aparato: "guardamotor_magnetico";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Cantidad de polos */
  cantidad_polos?: number;
  /** Tensión de operación (V) */
  ue_V?: number;
  /** Categoría de empleo */
  categoria_empleo?: "AC-3" | "AC-4" | "otra";
  /** Disparo magnético instantáneo (A) */
  ii_a?: number;
  /** Poder de corte Icu (kA) */
  icu_kA?: number;
  /** Poder de corte servicio Ics (A) */
  ics_kA?: number;
}

export interface AparatoGuardamotorTermomagnetico {
  /** Tipo de aparato */
  tipo_aparato: "guardamotor_termomagnetico";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Cantidad de polos */
  cantidad_polos?: number;
  /** Tensión de operación (V) */
  ue_V?: number;
  /** Categoría de empleo */
  categoria_empleo?: "AC-3" | "AC-4" | "otra";
  /** Disparo térmico mínimo (A) */
  ir_min_a?: number;
  /** Disparo térmico máximo (A) */
  ir_max_a?: number;
  /** Disparo magnético instantáneo (A) */
  ii_a?: number;
  /** Poder de corte Icu (kA) */
  icu_kA?: number;
  /** Poder de corte servicio Ics (A) */
  ics_kA?: number;
}

export interface AparatoInstrumentoMedicion {
  /** Tipo de aparato */
  tipo_aparato: "instrumento_medicion";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Tipo de instrumento */
  tipo_instrumento?: "voltimetro" | "amperimetro" | "multifuncion" | "otro";
  /** Escala de medición */
  escala?: string;
  /** Clase de precisión */
  clase_precision?: string;
}

export interface AparatoInterruptorDiferencial {
  /** Tipo de aparato */
  tipo_aparato: "interruptor_diferencial";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Cantidad de polos */
  cantidad_polos?: number;
  /** Corriente nominal (A) */
  in_a?: number;
  /** Sensibilidad (mA) */
  sensibilidad_ma?: number;
  /** Tipo diferencial */
  tipo_diferencial?: "AC" | "A" | "B" | "F";
  /** Clase de disparo */
  clase_selectivo?: "instantaneo" | "selectivo_s";
  /** Tiempo de no respuesta (ms) */
  tiempo_no_respuesta_ms?: number;
  /** Norma de fabricación */
  norma_fabricacion?: string;
}

export interface AparatoInterruptorTermomagnetico {
  /** Tipo de aparato */
  tipo_aparato: "interruptor_termomagnetico";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Cantidad de polos */
  cantidad_polos?: number;
  /** Corriente nominal (A) */
  in_a?: number;
  /** Curva de disparo */
  curva_disparo?: "B" | "C" | "D" | "K" | "Z" | "otra";
  /** Poder de corte (kA) */
  pdcc_kA?: number;
  /** Norma de fabricación */
  norma_fabricacion?: string;
}

/** Lámpara piloto / de señalización, símbolo general (IEC 60617 08-80-44). */
export interface AparatoLamparaPiloto {
  /** Tipo de aparato */
  tipo_aparato: "lampara_piloto";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Color */
  color?: "RD" | "YE" | "GN" | "BU" | "WH";
  /** Tipo de lámpara */
  tipo_lampara?: "LED" | "IN" | "Ne" | "FL";
  /** Tensión (V) */
  tension_v?: number;
}

/** Interruptor automatico en caja moldeada (IEC 60947-2). La norma no distingue aparatos por la construccion del envolvente, asi que no hay un simbolo IEC propio del MCCB: se dibuja el interruptor automatico rodeado por el envolvente moldeado, y el tipo de disparo se declara aca, en la ficha, habilitando los campos de ajuste que correspondan. */
export interface AparatoMccbCajaMoldeada {
  /** Tipo de aparato */
  tipo_aparato: "mccb_caja_moldeada";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Cantidad de polos */
  cantidad_polos?: number;
  /** Tipo de disparo */
  tipo_disparo?: "termomagnetico" | "magnetico" | "electronico";
  /** Ajuste térmico mínimo Ir (A) */
  ir_a_min?: number;
  /** Ajuste térmico máximo Ir (A) */
  ir_a_max?: number;
  /** Ajuste magnético Im (A) */
  im_a?: number;
  /** Poder de corte (kA) */
  pdcc_kA?: number;
  /** Categoría de utilización */
  categoria_utilizacion?: "A" | "B";
  /** Icw (kA, 1s) */
  icw_kA?: number;
  /** Icm (kA cresta) */
  icm_kA?: number;
  /** Norma de fabricación */
  norma_fabricacion?: string;
}

export interface AparatoMotorTrifasico {
  /** Tipo de aparato */
  tipo_aparato: "motor_trifasico";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Potencia (kW) */
  potencia_kw?: number;
  /** Potencia (HP) */
  potencia_hp?: number;
  /** Tensión (V) */
  tension_v?: number;
  /** Corriente nominal (A) */
  in_a?: number;
  /** Eficiencia (%) */
  eficiencia_pct?: number;
  /** Factor de potencia (cos φ) */
  factor_potencia?: number;
  /** Velocidad (RPM) */
  rpm?: number;
}

export interface AparatoPortafusible {
  /** Tipo de aparato */
  tipo_aparato: "portafusible";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Marca del portafusible */
  portafusible_marca?: string;
  /** Modelo del portafusible */
  portafusible_modelo?: string;
  /** Tensión del portafusible (V) */
  portafusible_tension_v?: number;
  /** Categoría del portafusible */
  portafusible_categoria?: string;
  /** Corriente máxima (A) */
  corriente_maxima_a?: number;
}

/** Pulsador de mando (IEC 60617 07-72-02): contacto momentáneo, retorno automático por resorte al soltar. */
export interface AparatoPulsador {
  /** Tipo de aparato */
  tipo_aparato: "pulsador";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Tipo de contacto */
  tipo_contacto?: "NA" | "NC";
  /** Iluminado */
  iluminado?: boolean;
  /** Color */
  color?: "RD" | "YE" | "GN" | "BU" | "WH";
  /** Capacidad térmica Ith (A) */
  ith_a?: number;
}

/** Pulsador de parada de emergencia, cabeza de seta (IEC 60617 07-72-06): contacto NC con maniobra positiva de apertura y retención mecánica — queda enclavado hasta liberarlo a mano (girar o tirar), no vuelve solo. El contacto es siempre NC: la parada de emergencia corta, nunca cierra. */
export interface AparatoPulsadorEmergencia {
  /** Tipo de aparato */
  tipo_aparato: "pulsador_emergencia";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Capacidad térmica Ith (A) */
  ith_a?: number;
}

export interface AparatoReleAuxiliar {
  /** Tipo de aparato */
  tipo_aparato: "rele_auxiliar";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Tensión de bobina (V) */
  tension_bobina_v?: number;
  /** Configuración de contactos */
  configuracion_contactos?: "2PDT" | "3PDT" | "4PDT" | "otra";
  /** Capacidad térmica contactos (A) */
  capacidad_termica_contactos_a?: number;
}

export interface AparatoReleProteccionTension {
  /** Tipo de aparato */
  tipo_aparato: "rele_proteccion_tension";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Tensión asignada (V) */
  ue_v?: number;
  /** Umbral subtensión (%) */
  subtension_pct?: number;
  /** Umbral sobretensión (%) */
  sobretension_pct?: number;
  /** Umbral de asimetría (%) */
  asimetria_pct?: number;
  /** Retardo de disparo (s) */
  retardo_disparo_s?: number;
}

export interface AparatoReleTermico {
  /** Tipo de aparato */
  tipo_aparato: "rele_termico";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Cantidad de polos */
  cantidad_polos?: number;
  /** Tensión de operación (V) */
  ue_V?: number;
  /** Categoría de empleo */
  categoria_empleo?: "AC-3" | "AC-4" | "otra";
  /** Disparo térmico mínimo (A) */
  ir_min_a?: number;
  /** Disparo térmico máximo (A) */
  ir_max_a?: number;
  /** Clase de disparo */
  clase_disparo?: string;
}

/** Selector rotativo de mando (IEC 60617 07-72-04): mantiene la posición elegida, sin retorno automático salvo que se indique lo contrario. */
export interface AparatoSelector {
  /** Tipo de aparato */
  tipo_aparato: "selector";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Cantidad de posiciones */
  posiciones?: number;
  /** Con retorno automático */
  con_retorno_automatico?: boolean;
  /** Capacidad térmica Ith (A) */
  ith_a?: number;
}

export interface AparatoSirenaAlarma {
  /** Tipo de aparato */
  tipo_aparato: "sirena_alarma";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Tensión (V) */
  tension_v?: number;
  /** Tipo de señal */
  tipo_senal?: "continua" | "intermitente" | "multitonos" | "otra";
  /** Nivel sonoro (dB) */
  nivel_sonoro_db?: number;
}

export interface AparatoTransformador {
  /** Tipo de aparato */
  tipo_aparato: "transformador";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Potencia aparente (kVA) */
  sn_kva?: number;
  /** Relación de transformación */
  relacion?: string;
  /** Grupo de conexión */
  grupo_conexion?: string;
  /** Impedancia (%) */
  impedancia_pct?: number;
}

export interface AparatoTransformadorCorriente {
  /** Tipo de aparato */
  tipo_aparato: "transformador_corriente";
  /** Marca */
  marca?: string;
  /** Modelo */
  modelo?: string;
  /** Relación de transformación */
  relacion?: string;
  /** Potencia de precisión (VA) */
  s_va?: number;
  /** Clase de precisión */
  clase_precision?: string;
  /** Factor de seguridad (FS) */
  fs?: number;
  /** Tensión asignada (kV) */
  ue_kv?: number;
}

/** Ficha de un aparato, discriminada por `tipo_aparato`. */
export type AtributosAparato =
  | AparatoBancoCapacitores
  | AparatoContactoAuxiliar
  | AparatoContactor
  | AparatoFusible
  | AparatoGuardamotorMagnetico
  | AparatoGuardamotorTermomagnetico
  | AparatoInstrumentoMedicion
  | AparatoInterruptorDiferencial
  | AparatoInterruptorTermomagnetico
  | AparatoLamparaPiloto
  | AparatoMccbCajaMoldeada
  | AparatoMotorTrifasico
  | AparatoPortafusible
  | AparatoPulsador
  | AparatoPulsadorEmergencia
  | AparatoReleAuxiliar
  | AparatoReleProteccionTension
  | AparatoReleTermico
  | AparatoSelector
  | AparatoSirenaAlarma
  | AparatoTransformador
  | AparatoTransformadorCorriente;

/** Fase C (revisada con el usuario). La conexión representa un CABLE. La notación del plano depende de tipo_cable: unipolar = 'n x 1 x S' (conductores sueltos), multipolar = '1 x n x S' (un cable con núcleos, contando el neutro). Neutro y tierra van como llave activada/desactivada; su sección se anota SOLO cuando difiere de la de fase (ej: '1 x 4 x 25 mm² + 16 mm²'). Los campos con x-obligatorio son advertidos por el Checklist AEA (§C5): no bloquean el guardado. */
export interface AtributosConductor {
  /** Cantidad de conductores */
  cantidad_conductores?: number;
  /** Tipo de cable */
  tipo_cable?: "unipolar" | "multipolar";
  /** Lleva neutro */
  lleva_neutro?: boolean;
  /** Sección neutro (mm²) */
  seccion_neutro_mm2?: number;
  /** Lleva tierra */
  lleva_tierra?: boolean;
  /** Sección tierra (mm²) */
  seccion_tierra_mm2?: number;
  /** Sección de fase (mm²) */
  seccion_fase_mm2?: number;
  /** Longitud (m) */
  longitud_m?: number;
  /** Material */
  material?: "Cu" | "Al";
  /** Método de instalación */
  metodo_instalacion?: "A1" | "A2" | "B1" | "B2" | "C" | "D" | "E" | "F" | "G";
  /** Temperatura ambiente (°C) */
  temperatura_ambiente_c?: number;
  /** Circuitos agrupados */
  cantidad_circuitos_agrupados?: number;
  /** Aislación */
  aislacion?: "PVC" | "XLPE" | "EPR";
  /** Norma IRAM */
  norma_iram?: string;
}

/** Fase C8. La barra es el nodo de distribución del tablero: la acometida llega a ella y de ella cuelgan los circuitos. La ficha se anota en el extremo izquierdo, por encima de la barra, con el formato del plano real: dimensiones · material · norma IRAM · corriente admisible. Los campos con x-obligatorio son advertidos por el Checklist: no bloquean el guardado. */
export interface AtributosBarra {
  /** Dimensiones del perfil */
  dimensiones?: string;
  /** Es juego de barras */
  es_conjunto?: boolean;
  /** Fases del juego */
  cantidad_fases?: number;
  /** Incluye neutro */
  incluye_neutro?: boolean;
  /** Incluye tierra (PE) */
  incluye_tierra?: boolean;
  /** Material */
  material?: "Cu" | "Al";
  /** Norma IRAM */
  norma_iram?: string;
  /** Corriente admisible (A) */
  corriente_admisible_A?: number;
}

/** Fase C7/C9. Destino de un circuito de distribución: IUG (iluminación), TUG (tomacorrientes de uso general), ACU (aire acondicionado), seccional u otra. La potencia aparente (VA) se CALCULA sola a partir de la alimentación, el neutro y la corriente; el usuario no la carga a mano. */
export interface AtributosCarga {
  /** Código de circuito */
  codigo_circuito?: string;
  /** Tipo de carga */
  tipo_carga?: "IUG" | "TUG" | "ACU" | "seccional" | "otra";
  /** Alimentación */
  alimentacion?: "monofasica" | "trifasica";
  /** Línea asignada */
  linea_asignada?: "L1" | "L2" | "L3";
  /** Lleva neutro */
  lleva_neutro?: boolean;
  /** Lleva tierra */
  lleva_tierra?: boolean;
  /** Corriente (A) */
  corriente_a?: number;
  /** Potencia aparente (VA) */
  potencia_va?: number;
  /** Coef. utilización (Ku) */
  ku?: number;
  /** Coef. de simultaneidad (Ks) */
  ks?: number;
  /** Potencia de utilización (VA) */
  potencia_utilizacion_va?: number;
  /** Descripción de la carga */
  descripcion?: string;
}

/** Cualquier ficha técnica de la librería. */
export type AtributosFicha =
  | AtributosAparato
  | AtributosConductor
  | AtributosBarra
  | AtributosCarga;
