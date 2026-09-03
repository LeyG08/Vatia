/**
 * Reglas de validación de fichas técnicas y cables, compartidas entre el
 * editor (apps/editor/src/lib/checklist.ts y esquemas.ts, vía Vite/TS) y el
 * verificador de proyectos reales (scripts/verificar_proyecto_real.mjs, vía
 * Node puro). Antes las dos copias vivían duplicadas byte a byte en ambos
 * lugares: un cambio en una no se propagaba nunca a la otra, que es
 * exactamente el riesgo que este módulo elimina.
 *
 * Es JS plano (no TS) a propósito: así lo importa igual un script Node sin
 * necesitar un transpilador, y el editor lo importa con `allowJs` sin
 * necesitar un `.d.ts` aparte.
 */

/** ¿El valor cuenta como "no cargado" para un campo obligatorio? */
export function esVacio(v) {
  return (
    v === undefined ||
    v === null ||
    v === "" ||
    (typeof v === "number" && !Number.isFinite(v))
  );
}

/** "curva_caracteristica" → "Curva caracteristica"; unidades bien escritas */
export function humanizarCampo(nombre) {
  let t = nombre.replace(/_/g, " ");
  t = t.replace(/\bka$/i, "kA");
  t = t.replace(/\bkw$/i, "kW");
  t = t.replace(/\bhp$/i, "HP");
  t = t.replace(/\bmm2$/i, "mm²");
  t = t.replace(/\bv$/i, "V");
  t = t.replace(/\ba$/i, "A");
  return t.replace(/^./, (c) => c.toUpperCase());
}

/**
 * ¿Corresponde mostrar (y exigir) este campo?
 *
 * `x-visible-si` admite dos formas:
 *   "es_conjunto"                              → el campo que gobierna debe valer true
 *   "tipo_disparo:termomagnetico|electronico"  → debe valer alguno de esos
 *
 * La usan TANTO el formulario (para ocultar) COMO el checklist y el
 * verificador (para no exigir un campo que está oculto).
 */
export function esCampoVisible(esquema, atributos) {
  const regla = esquema?.["x-visible-si"];
  if (!regla) return true;
  const sep = regla.indexOf(":");
  if (sep === -1) return atributos[regla] === true;
  const campo = regla.slice(0, sep);
  const valores = regla.slice(sep + 1).split("|");
  return valores.includes(String(atributos[campo] ?? ""));
}

/**
 * Mensajes de "Falta X" / "Cargá al menos uno de…" a partir de una lista ya
 * resuelta de nombres de campo obligatorios (visibles) y de la regla
 * x-alguno-obligatorio. Quien llama resuelve el schema — el editor y el
 * verificador lo hacen de formas distintas (JSON importado por Vite vs.
 * leído con `fs`) — pero el criterio de qué mensaje corresponde es uno solo.
 */
export function mensajesDeCampos(obligatorios, alguno, atributos) {
  const msj = [];
  for (const campo of obligatorios) {
    if (esVacio(atributos[campo])) msj.push(`Falta ${humanizarCampo(campo)}.`);
  }
  if (alguno.length > 0 && alguno.every((k) => esVacio(atributos[k]))) {
    msj.push(`Cargá al menos uno de: ${alguno.map(humanizarCampo).join(" / ")}.`);
  }
  return msj;
}

/**
 * Validación POR CABLE (familia conductor), nunca por rol de conexión:
 * cantidad/secciones/material/aislación/norma + coherencia entre las llaves
 * de neutro/tierra y sus secciones. La usan tanto las conexiones entre
 * símbolos como los alimentadores.
 */
export function problemasCable(a) {
  const msj = [];
  const num = (k) => (typeof a[k] === "number" ? a[k] : undefined);
  const fases = num("cantidad_conductores") ?? 0;
  const neutro = a.lleva_neutro === true;
  const tierra = a.lleva_tierra === true;
  const sFase = num("seccion_fase_mm2");
  const sNeutro = num("seccion_neutro_mm2");
  const sTierra = num("seccion_tierra_mm2");

  if (fases === 0 && !neutro && !tierra) {
    return ["Cable sin conductores: activá fases, neutro o tierra."];
  }
  if (fases > 0 && !sFase) msj.push("Falta la sección de fase.");
  if (fases === 0) {
    // Sin fases, cada línea presente necesita su propia sección
    if (neutro && !sNeutro) msj.push("Falta la sección del neutro.");
    if (tierra && !sTierra) msj.push("Falta la sección de la tierra.");
  }
  if (esVacio(a.material)) msj.push("Falta material.");
  if (esVacio(a.aislacion)) msj.push("Falta aislación.");
  if (esVacio(a.norma_iram)) msj.push("Falta norma IRAM.");
  if (esVacio(a.longitud_m)) msj.push("Falta la longitud del tramo.");
  if (esVacio(a.metodo_instalacion)) msj.push("Falta el método de instalación.");

  // Coherencia llaves ↔ secciones
  if (!neutro && sNeutro) {
    msj.push("Hay sección de neutro cargada pero el neutro está apagado.");
  }
  if (!tierra && sTierra) {
    msj.push("Hay sección de tierra cargada pero la tierra está apagada.");
  }
  if (sFase) {
    if (sNeutro && sNeutro > sFase) {
      msj.push("La sección del neutro es mayor que la de fase.");
    }
    if (sTierra && sTierra > sFase) {
      msj.push("La sección de la tierra es mayor que la de fase.");
    }
  }
  return msj;
}
