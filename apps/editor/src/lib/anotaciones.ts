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

function anotacionBarra(a: Record<string, unknown>): string[] {
  const l: string[] = [];
  if (a.material) l.push(capitalizar(a.material));
  if (a.perfil) l.push(capitalizar(a.perfil));
  if (n(a.seccion_mm2)) l.push(`${n(a.seccion_mm2)} mm²`);
  if (n(a.corriente_admisible_A)) l.push(`${n(a.corriente_admisible_A)} A`);
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
  return [];
}

/**
 * Anotación del MAZO sobre la conexión, en DOS líneas al estilo del
 * plano real:
 *   1 x 4 x 25 mm² + 16 mm²      ← notación (según tipo de cable)
 *   Cu/PVC · IRAM 2178           ← material/aislación, y al lado la norma
 *
 * Reglas (acordadas con el usuario):
 * - unipolar   → "F x 1 x S" (conductores sueltos)
 * - multipolar → "1 x n x S" donde n cuenta fases + neutro
 * - neutro/tierra con sección IGUAL a fase no agregan nada extra
 *   (multipolar) o se listan explícitos (unipolar); si difieren se
 *   anexan como "+ X mm²".
 */
export function lineasMazo(a: Record<string, unknown>): string[] {
  const tieneAlgo =
    a.cantidad_conductores || a.material || a.aislacion || a.norma_iram;
  if (!tieneAlgo) return [];

  const sf = n(a.seccion_fase_mm2);
  const fases =
    typeof a.cantidad_conductores === "number" ? a.cantidad_conductores : 0;
  const mp = a.tipo_cable === "multipolar";

  let principal = "";
  if (fases > 0 && sf) {
    principal = mp
      ? `1 x ${fases + (a.lleva_neutro ? 1 : 0)} x ${sf} mm²`
      : `${fases} x 1 x ${sf} mm²`;
  }

  const extras: string[] = [];
  if (a.lleva_neutro && sf) {
    const sn = n(a.seccion_neutro_mm2);
    if (!mp) extras.push(`1 x 1 x ${sn || sf} mm²`);
    else if (sn && sn !== String(sf)) extras.push(`${sn} mm²`);
  }
  if (a.lleva_tierra && sf) {
    const st = n(a.seccion_tierra_mm2);
    if (!mp) extras.push(`1 x 1 x ${st || sf} mm²`);
    else extras.push(`${st || sf} mm²`);
  }

  const linea1 = [principal, ...extras].filter(Boolean).join(" + ");

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
