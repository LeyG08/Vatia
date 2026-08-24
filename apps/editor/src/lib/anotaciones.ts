import type { FamiliaAtributos } from "./tipos";
import type { DatosSimbolo } from "./store";

/** Estética de plano: todo texto que arranca, arranca con mayúscula */
export function capitalizar(texto: unknown): string {
  const s = String(texto ?? "").trim();
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : "";
}

function n(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

/** PdCC guardado en kA (schema); el plano lo anota en amperes */
function pdccEnA(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "";
  return v < 10 ? `${Math.round(v * 1000)} A` : `${v} kA`;
}

/**
 * TODOS los datos cargados, una línea por característica, al estilo de
 * la ficha del plano real:
 *   3P x 10A
 *   Curva C
 *   PdCC 3000 A
 *   Norma IEC 60898-1
 * Solo se muestran los campos con valor.
 */
function anotacionAparato(a: Record<string, unknown>): string[] {
  const l: string[] = [];
  const mm = [capitalizar(a.marca), capitalizar(a.modelo)]
    .filter(Boolean)
    .join(" ");
  if (mm) l.push(mm);

  switch (a.tipo_aparato) {
    case "interruptor_termomagnetico": {
      if (a.cantidad_polos != null && n(a.in_a))
        l.push(`${a.cantidad_polos}P x ${n(a.in_a)} A`);
      else if (a.cantidad_polos != null) l.push(`${a.cantidad_polos}P`);
      else if (n(a.in_a)) l.push(`${n(a.in_a)} A`);
      if (a.curva_disparo && a.curva_disparo !== "otra")
        l.push(`Curva ${a.curva_disparo}`);
      const pdcc = pdccEnA(a.pdcc_kA);
      if (pdcc) l.push(`PdCC ${pdcc}`);
      if (a.norma_fabricacion) l.push(`Norma ${capitalizar(a.norma_fabricacion)}`);
      break;
    }
    case "contactor": {
      if (a.cantidad_polos != null && n(a.in_a))
        l.push(`${a.cantidad_polos}P x ${n(a.in_a)} A`);
      if (a.categoria_empleo) l.push(`Categoría ${a.categoria_empleo}`);
      if (n(a.ue_V)) l.push(`Ue ${n(a.ue_V)} V`);
      if (n(a.tension_bobina_v)) l.push(`Bobina ${n(a.tension_bobina_v)} V`);
      break;
    }
    case "fusible": {
      const porta = [capitalizar(a.marca), capitalizar(a.modelo)]
        .filter(Boolean)
        .join(" ");
      if (porta) l.push(`Portafusible ${porta}`);
      const portaDatos = [
        n(a.portafusible_tension_v) ? `${n(a.portafusible_tension_v)} V` : "",
        capitalizar(a.portafusible_categoria),
      ].filter(Boolean);
      if (portaDatos.length > 0) l.push(portaDatos.join(" · "));
      const f = [
        n(a.in_a) ? `${n(a.in_a)} A` : "",
        capitalizar(a.clase_caracteristica),
      ].filter(Boolean);
      if (f.length > 0) l.push(f.join(" "));
      if (a.tamano) l.push(capitalizar(a.tamano));
      const pdcc = pdccEnA(a.pdcc_kA);
      if (pdcc) l.push(`PdCC ${pdcc}`);
      if (a.norma_fabricacion) l.push(`Norma ${capitalizar(a.norma_fabricacion)}`);
      break;
    }
    case "motor_trifasico": {
      if (n(a.potencia_hp)) l.push(`${n(a.potencia_hp)} HP`);
      else if (n(a.potencia_kw)) l.push(`${n(a.potencia_kw)} kW`);
      if (n(a.tension_v)) l.push(`${n(a.tension_v)} V`);
      if (n(a.in_a)) l.push(`In ${n(a.in_a)} A`);
      if (n(a.rpm)) l.push(`${n(a.rpm)} rpm`);
      break;
    }
    case "transformador": {
      if (n(a.sn_kva)) l.push(`${n(a.sn_kva)} kVA`);
      if (a.relacion) l.push(capitalizar(a.relacion));
      if (a.grupo_conexion) l.push(capitalizar(a.grupo_conexion));
      if (n(a.impedancia_pct)) l.push(`uk ${n(a.impedancia_pct)} %`);
      break;
    }
  }
  return l;
}

/**
 * Ficha de la BARRA en el formato del plano real (C8), en UNA línea:
 * "3x30x10mm · Cu · IRAM 2181-1 · 500 A". Si la línea representa un
 * CONJUNTO de barras (una por fase, C11) se antepone "Juego de
 * barras". Se dibuja en el extremo izquierdo, por encima de la barra.
 */
export function anotacionBarra(a: Record<string, unknown>): string[] {
  const partes = [
    a.es_conjunto === true ? "Juego de barras" : "",
    typeof a.dimensiones === "string" ? a.dimensiones : "",
    capitalizar(a.material),
    capitalizar(a.norma_iram),
    n(a.corriente_admisible_A) ? `${n(a.corriente_admisible_A)} A` : "",
  ].filter(Boolean);
  return partes.length > 0 ? [partes.join(" · ")] : [];
}

/**
 * Bloque DEBAJO de la flecha de destino de circuito (§C7/C9), en el
 * orden del plano real: código / tipo / alimentación / potencia
 * aparente / corriente / designación. Solo líneas con valor.
 * La alimentación sale de C9: "1F 220 V · L1" (mono con neutro),
 * "1F 380 V · L2" (mono entre fases) o "3F 380 V" (trifásica).
 */
function anotacionCarga(a: Record<string, unknown>): string[] {
  const l: string[] = [];
  if (a.codigo_circuito) l.push(String(a.codigo_circuito));
  if (a.tipo_carga) l.push(String(a.tipo_carga));
  if (a.alimentacion) {
    const tri = a.alimentacion === "trifasica";
    const v = tri || a.lleva_neutro === false ? "380 V" : "220 V";
    const linea = !tri && typeof a.linea_asignada === "string" ? ` · ${a.linea_asignada}` : "";
    l.push(`${tri ? "3F" : "1F"} ${v}${linea}`);
  }
  if (n(a.potencia_va)) l.push(`${n(a.potencia_va)} VA`);
  if (n(a.corriente_a)) l.push(`${n(a.corriente_a)} A`);
  // Utilización como dato SECUNDARIO: solo si Ku cargado y < 1
  // (con Ku=1 la utilización iguala a la nominal y no aporta nada).
  if (
    typeof a.ku === "number" &&
    a.ku < 1 &&
    n(a.potencia_utilizacion_va)
  ) {
    l.push(
      `Ku=${String(a.ku).replace(".", ",")} → ${n(a.potencia_utilizacion_va)} VA útil.`,
    );
  }
  if (a.descripcion) l.push(capitalizar(a.descripcion));
  return l;
}

/** Líneas de anotación bajo un símbolo, como en los planos reales */
export function anotacionNodo(
  familia: FamiliaAtributos,
  data: DatosSimbolo,
): string[] {
  const a = (data.atributos ?? {}) as Record<string, unknown>;
  if (familia === "aparato") return anotacionAparato(a);
  if (familia === "barra") return anotacionBarra(a);
  if (familia === "carga") return anotacionCarga(a);
  return [];
}

/**
 * Anotación del MAZO sobre la conexión. Reglas (acordadas con el usuario):
 * - unipolar   → "n x 1 x S"; multipolar → "1 x n x S".
 * - Si TODOS los conductores comparten la MISMA sección (incluidos
 *   neutro y tierra) se agrupan en un solo término: "5 x 1 x 16 mm²".
 * - Si hay secciones distintas, lo diferente se anexa con "+ X mm²"
 *   (multipolar) o se lista explícito (unipolar).
 * - Puede haber conexiones SOLO de neutro o solo de tierra: se
 *   representan igualmente ("1 x 1 x 16 mm²").
 */
export function lineasMazo(a: Record<string, unknown>): string[] {
  const tieneAlgo =
    a.cantidad_conductores ||
    a.lleva_neutro ||
    a.lleva_tierra ||
    a.material ||
    a.aislacion ||
    a.norma_iram;
  if (!tieneAlgo) return [];

  const sf = n(a.seccion_fase_mm2);
  const fases =
    typeof a.cantidad_conductores === "number" ? a.cantidad_conductores : 0;
  const mp = a.tipo_cable === "multipolar";
  const sN = a.lleva_neutro ? n(a.seccion_neutro_mm2) || sf : "";
  const sT = a.lleva_tierra ? n(a.seccion_tierra_mm2) || sf : "";

  interface Grupo {
    cant: number;
    s: string;
  }
  const grupos: Grupo[] = [];
  if (fases > 0 && sf) grupos.push({ cant: fases, s: sf });
  if (sN) grupos.push({ cant: 1, s: sN });
  if (sT) grupos.push({ cant: 1, s: sT });
  if (grupos.length === 0) return [];

  const token = (cant: number, s: string) =>
    mp ? `1 x ${cant} x ${s} mm²` : `${cant} x 1 x ${s} mm²`;

  let linea1 = "";
  const primera = grupos[0].s;
  if (grupos.every((g) => g.s === primera)) {
    // Todo con la misma sección: un único término con el TOTAL
    const total = grupos.reduce((t, g) => t + g.cant, 0);
    linea1 = token(total, primera);
  } else {
    const partes: string[] = [];
    const gF = grupos.find((g) => g.cant > 1);
    if (gF) {
      const nucleos = gF.cant + (sN ? 1 : 0);
      partes.push(
        mp
          ? `1 x ${nucleos} x ${gF.s} mm²`
          : `${gF.cant} x 1 x ${gF.s} mm²`,
      );
      if (sN && !(mp && sN === gF.s)) {
        partes.push(mp ? `${sN} mm²` : `1 x 1 x ${sN} mm²`);
      }
      if (sT) partes.push(mp ? `${sT} mm²` : `1 x 1 x ${sT} mm²`);
    } else {
      // Sin fases cargadas: neutro/tierra explícitos uno por uno
      for (const g of grupos) partes.push(token(g.cant, g.s));
    }
    linea1 = partes.join(" + ");
  }

  const matAis = [
    capitalizar(a.material),
    capitalizar(a.aislacion),
  ].filter(Boolean);
  const linea2partes = [
    matAis.length > 0 ? matAis.join("/") : "",
    capitalizar(a.norma_iram),
  ].filter(Boolean);

  return [linea1, ...linea2partes].filter(Boolean);
}
