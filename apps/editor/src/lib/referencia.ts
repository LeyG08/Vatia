/**
 * Designación de referencia automática (IEC 61346) para aparatos: al
 * colocar un símbolo se le asigna un valor como "KM3" en vez de dejarlo
 * en blanco para que el usuario lo escriba a mano. El prefijo depende
 * del tipo de aparato (K = relés/contactores auxiliares, Q = maniobra
 * de potencia, F = protección, M = motores, T = transformadores,
 * C = capacitores, H = señalización, P = medición, S = mando/pulsadores
 * /selectores — convención habitual en planos industriales) y el número
 * es el próximo libre para ese prefijo en TODO el proyecto, no solo en
 * la hoja activa.
 *
 * Sigue siendo un campo editable en la ficha técnica (PanelAtributos):
 * la asignación automática numera cada aparato por separado, pero NO
 * puede saber que la bobina de un contactor y sus contactos auxiliares,
 * colocados como símbolos distintos, tienen que compartir la misma
 * referencia — esa vinculación la hace el usuario a mano, corrigiendo
 * el campo. Es la base para la simulación tipo CADe SIMU (E47).
 */
export const PREFIJO_REFERENCIA_IEC61346: Readonly<Record<string, string>> = {
  interruptor_termomagnetico: "Q",
  contactor: "KM",
  fusible: "F",
  motor_trifasico: "M",
  motor_monofasico: "M",
  transformador: "T",
  mccb_caja_moldeada: "Q",
  guardamotor_termomagnetico: "Q",
  rele_termico: "F",
  contacto_auxiliar: "K",
  transformador_corriente: "T",
  banco_capacitores: "C",
  portafusible: "F",
  interruptor_diferencial: "Q",
  rele_proteccion_tension: "K",
  rele_auxiliar: "K",
  sirena_alarma: "H",
  instrumento_medicion: "P",
  guardamotor_magnetico: "Q",
  pulsador: "S",
  selector: "S",
  pulsador_emergencia: "S",
  lampara_piloto: "H",
  interruptor_posicion: "S",
  temporizador: "K",
};

/** Próxima referencia libre para `tipoAparato` — null si el tipo no
 * tiene prefijo asignado (no se aplica, sigue en blanco). */
export function proximaReferencia(
  tipoAparato: string,
  referenciasUsadas: Iterable<string>,
): string | null {
  const prefijo = PREFIJO_REFERENCIA_IEC61346[tipoAparato];
  if (!prefijo) return null;
  const regex = new RegExp(`^${prefijo}(\\d+)$`);
  let maximo = 0;
  for (const ref of referenciasUsadas) {
    const m = regex.exec(ref.trim());
    if (m) maximo = Math.max(maximo, Number.parseInt(m[1], 10));
  }
  return `${prefijo}${maximo + 1}`;
}

/**
 * Tipos "accesorio": nunca tienen designación propia fija, siempre
 * representan una PARTE de otro aparato — un contacto auxiliar, o la
 * bobina genérica "de contactor/relé" (S00130, `tipo_aparato:
 * "rele_auxiliar"`) que en un multifilar puede ser justamente el
 * comando de un contactor real y necesita adoptar SU prefijo "KM", no
 * el "K" que le tocaría como relé auxiliar suelto. Por eso quedan
 * afuera de la validación de prefijo, y nunca generan un conflicto de
 * "dos aparatos distintos con la misma referencia": por definición se
 * entienden como parte del aparato al que se los vincula a mano.
 */
const TIPOS_ACCESORIO_REFERENCIA = new Set(["contacto_auxiliar", "rele_auxiliar"]);

/** true si `tipoAparato` es de los que nunca tienen designación propia
 * fija — siempre representan una parte de OTRO aparato (ver el comentario
 * de `TIPOS_ACCESORIO_REFERENCIA` arriba). Lo usa el selector de
 * "vincular con…" de PanelAtributos/FormularioAtributos (E53) para saber
 * cuándo ofrecer una lista de referencias existentes en vez de un campo
 * de texto libre. */
export function esAccesorioReferencia(tipoAparato: string): boolean {
  return TIPOS_ACCESORIO_REFERENCIA.has(tipoAparato);
}

/** Aparatos que se accionan por una bobina de mando dibujada aparte —
 * son los que "les falta la bobina" mientras nadie la coloque. Hoy solo
 * el contactor: el resto de los aparatos multipolares de la librería son
 * de accionamiento manual o térmico. */
const TIPOS_QUE_NECESITAN_BOBINA = new Set(["contactor"]);

export interface AparatoColocado {
  tipoAparato: string;
  referencia: string;
}

/**
 * Referencia sugerida al COLOCAR una pieza accesorio (E78).
 *
 * Pedido explícito del usuario: "en el contactor no pusiste la bobina
 * para su activación para la simulación, y para los relés los contactos
 * que se activan ante su activación". El mecanismo de vinculación ya
 * existía (compartir `referencia`, E53), pero la referencia automática
 * numeraba cada pieza por separado — una bobina recién colocada nacía
 * como "K1" al lado de un contactor "KM1", así que la simulación las
 * veía como dos aparatos distintos y el contactor nunca cerraba. Había
 * que corregir el campo a mano para que algo funcionara.
 *
 * Ahora la pieza nace ya vinculada al aparato más probable:
 *  - una BOBINA (`rele_auxiliar`) adopta la referencia del primer
 *    aparato de mando que todavía no tiene bobina — típicamente el
 *    contactor recién colocado;
 *  - un CONTACTO AUXILIAR adopta la referencia de la última bobina
 *    colocada, que es el aparato que se acaba de armar.
 *
 * Devuelve `null` si no hay candidato: ahí se cae a la numeración
 * normal de `proximaReferencia()`. Sigue siendo un campo editable con
 * su lista desplegable (E53) — esto es un valor por defecto útil, no
 * una decisión irreversible.
 */
export function referenciaSugeridaAccesorio(
  tipoAparato: string,
  colocados: readonly AparatoColocado[],
): string | null {
  const refsDeBobinas = new Set(
    colocados.filter((a) => a.tipoAparato === "rele_auxiliar").map((a) => a.referencia),
  );

  if (tipoAparato === "rele_auxiliar") {
    const sinBobina = colocados.filter(
      (a) => TIPOS_QUE_NECESITAN_BOBINA.has(a.tipoAparato) && !refsDeBobinas.has(a.referencia),
    );
    return sinBobina.length > 0 ? sinBobina[0].referencia : null;
  }

  if (tipoAparato === "contacto_auxiliar") {
    const bobinas = colocados.filter((a) => a.tipoAparato === "rele_auxiliar");
    return bobinas.length > 0 ? bobinas[bobinas.length - 1].referencia : null;
  }

  return null;
}

/**
 * Avisa (no bloquea — "debería decirte que hay incompatibilidad", pedido
 * explícito) cuando una referencia editada A MANO es sospechosa. Dos
 * chequeos:
 *  1. El PREFIJO no es el habitual para este tipo de aparato — posible
 *     error de tipeo (ej. "F1" en un contactor, que espera "KM").
 *  2. La MISMA referencia ya la usa, en cualquier hoja del proyecto, un
 *     aparato "cuerpo" de un tipo DISTINTO — dos aparatos distintos no
 *     pueden ser el mismo dispositivo físico (ej. un fusible con la
 *     referencia de un contactor ya existente).
 * `tiposPorReferencia` es el mapa referencia → tipos de aparato que YA
 * la usan en el proyecto (incluida esta misma hoja, sin excluir el nodo
 * actual: si su propio tipo coincide nunca cuenta como conflicto).
 */
export function avisoIncompatibilidadReferencia(
  tipoAparato: string,
  referencia: string,
  tiposPorReferencia: Map<string, Set<string>>,
): string | null {
  const ref = referencia.trim();
  if (ref === "" || TIPOS_ACCESORIO_REFERENCIA.has(tipoAparato)) return null;

  const esperado = PREFIJO_REFERENCIA_IEC61346[tipoAparato];
  if (esperado) {
    const m = /^[A-Za-z]+/.exec(ref);
    const prefijo = m ? m[0] : "";
    if (prefijo !== esperado) {
      return `El prefijo "${prefijo || ref}" no es el habitual para este tipo de aparato (se esperaba "${esperado}") — revisá que no sea un error de tipeo.`;
    }
  }

  const otrosTipos = tiposPorReferencia.get(ref);
  if (otrosTipos) {
    const otroCuerpo = [...otrosTipos].find(
      (t) => t !== tipoAparato && !TIPOS_ACCESORIO_REFERENCIA.has(t),
    );
    if (otroCuerpo) {
      return `La referencia "${ref}" ya la usa un aparato de otro tipo en el proyecto — dos aparatos distintos no pueden ser el mismo dispositivo.`;
    }
  }
  return null;
}
