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

/**
 * Solo lo ESENCIAL del plano: lo demás (marca, modelo, norma, poder de
 * corte, categoría…) es dato normalizado/de catálogo y no se repite
 * sobre la hoja. Una línea corta por aparato.
 */
function anotacionAparato(a: Record<string, unknown>): string[] {
  switch (a.tipo_aparato) {
    case "interruptor_termomagnetico": {
      const partes = [
        a.cantidad_polos != null ? `${a.cantidad_polos}P` : "",
        n(a.in_a) ? `${n(a.in_a)}A` : "",
        a.curva_disparo && a.curva_disparo !== "otra"
          ? String(a.curva_disparo)
          : "",
      ].filter(Boolean);
      return partes.length > 0 ? [partes.join(" · ")] : [];
    }
    case "contactor": {
      const partes = [
        a.cantidad_polos != null ? `${a.cantidad_polos}P` : "",
        n(a.in_a) ? `${n(a.in_a)}A` : "",
        a.categoria_empleo === "AC-1" ||
        a.categoria_empleo === "AC-3" ||
        a.categoria_empleo === "AC-4"
          ? String(a.categoria_empleo)
          : "",
      ].filter(Boolean);
      return partes.length > 0 ? [partes.join(" · ")] : [];
    }
    case "fusible": {
      const partes = [
        n(a.in_a) ? `${n(a.in_a)}A` : "",
        capitalizar(a.clase_caracteristica),
        capitalizar(a.tamano),
      ].filter(Boolean);
      return partes.length > 0 ? [partes.join(" · ")] : [];
    }
    case "motor_trifasico": {
      const potencia = n(a.potencia_hp)
        ? `${n(a.potencia_hp)}HP`
        : n(a.potencia_kw)
          ? `${n(a.potencia_kw)}kW`
          : "";
      const partes = [potencia, n(a.tension_v) ? `${n(a.tension_v)}V` : ""]
        .filter(Boolean);
      return partes.length > 0 ? [partes.join(" · ")] : [];
    }
    case "transformador": {
      const partes = [
        n(a.sn_kva) ? `${n(a.sn_kva)}kVA` : "",
        capitalizar(a.relacion),
      ].filter(Boolean);
      return partes.length > 0 ? [partes.join(" · ")] : [];
    }
  }
  return [];
}

function anotacionBarra(a: Record<string, unknown>): string[] {
  const partes = [
    capitalizar(a.material),
    n(a.seccion_mm2) ? `${n(a.seccion_mm2)}mm²` : "",
    n(a.corriente_admisible_A) ? `${n(a.corriente_admisible_A)}A` : "",
  ].filter(Boolean);
  return partes.length > 0 ? [partes.join(" · ")] : [];
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
 * Texto del mazo sobre una conexión, al estilo del plano real:
 * "3x1x70+1x1x50mm² · Cu · PVC · 0,6/1kV · IRAM NM 247-3".
 * Sin datos mínimos devuelve vacío (no anota).
 */
export function textoMazo(a: Record<string, unknown>): string {
  const tieneMasoMenos =
    a.cantidad_conductores || a.material || a.norma_iram || a.aislacion;
  if (!tieneMasoMenos) return "";

  const sf = n(a.seccion_fase_mm2);
  let mazo = "";
  if (a.cantidad_conductores && sf) {
    mazo = `${a.cantidad_conductores}x1x${sf}`;
    if (a.lleva_neutro)
      mazo += `+1x1x${n(a.seccion_neutro_mm2) || sf}`;
    if (a.lleva_tierra)
      mazo += `+1x1x${n(a.seccion_tierra_mm2) || sf}`;
    mazo += "mm²";
  }
  const resto = [
    capitalizar(a.material),
    capitalizar(a.aislacion),
    String(a.tension_asignada ?? "").trim(),
    capitalizar(a.norma_iram),
  ].filter(Boolean);

  return [mazo, ...resto].filter(Boolean).join(" · ");
}
