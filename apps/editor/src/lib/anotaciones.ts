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

function marcaModelo(a: Record<string, unknown>): string {
  return [capitalizar(a.marca), capitalizar(a.modelo)]
    .filter(Boolean)
    .join(" ");
}

function anotacionAparato(a: Record<string, unknown>): string[] {
  const lineas: string[] = [];
  const mm = marcaModelo(a);
  if (mm) lineas.push(mm);

  switch (a.tipo_aparato) {
    case "interruptor_termomagnetico": {
      const partes = [
        a.cantidad_polos != null ? `${a.cantidad_polos}P` : "",
        n(a.in_a) ? `${n(a.in_a)}A` : "",
        a.curva_disparo && a.curva_disparo !== "otra"
          ? `curva ${a.curva_disparo}`
          : "",
        n(a.pdcc_kA) ? `${n(a.pdcc_kA)}kA` : "",
      ].filter(Boolean);
      if (partes.length > 0) lineas.push(partes.join(" "));
      if (a.norma_fabricacion) lineas.push(capitalizar(a.norma_fabricacion));
      break;
    }
    case "contactor": {
      const partes = [
        a.cantidad_polos != null ? `${a.cantidad_polos}P` : "",
        n(a.in_a) ? `${n(a.in_a)}A` : "",
        a.categoria_empleo ? String(a.categoria_empleo) : "",
      ].filter(Boolean);
      if (partes.length > 0) lineas.push(partes.join(" "));
      const tens = [n(a.ue_V) ? `${n(a.ue_V)}V` : ""].filter(Boolean);
      if (tens.length > 0) lineas.push(tens.join(" "));
      if (n(a.tension_bobina_v))
        lineas.push(`Bobina ${n(a.tension_bobina_v)}V`);
      break;
    }
    case "fusible": {
      const porta = [
        capitalizar(a.portafusible_marca),
        capitalizar(a.portafusible_modelo),
      ]
        .filter(Boolean)
        .join(" ");
      const portaDatos = [
        n(a.portafusible_tension_v) ? `${n(a.portafusible_tension_v)}V` : "",
        capitalizar(a.portafusible_categoria),
      ]
        .filter(Boolean)
        .join(" ");
      const fus = [
        n(a.in_a) ? `${n(a.in_a)}A` : "",
        capitalizar(a.clase_caracteristica),
        capitalizar(a.tamano),
        n(a.pdcc_kA) ? `${n(a.pdcc_kA)}kA` : "",
      ].filter(Boolean);
      if (porta || portaDatos)
        lineas.push([porta, portaDatos].filter(Boolean).join(" · "));
      if (fus.length > 0) lineas.push(fus.join(" "));
      if (a.norma_fabricacion) lineas.push(capitalizar(a.norma_fabricacion));
      break;
    }
    case "motor_trifasico": {
      const potencia = n(a.potencia_hp)
        ? `${n(a.potencia_hp)}HP`
        : n(a.potencia_kw)
          ? `${n(a.potencia_kw)}kW`
          : "";
      const partes = [potencia, n(a.tension_v) ? `${n(a.tension_v)}V` : ""]
        .filter(Boolean);
      if (partes.length > 0) lineas.push(partes.join(" "));
      const extras = [
        n(a.in_a) ? `${n(a.in_a)}A` : "",
        n(a.rpm) ? `${n(a.rpm)}rpm` : "",
      ].filter(Boolean);
      if (extras.length > 0) lineas.push(extras.join(" "));
      break;
    }
    case "transformador": {
      const partes = [
        n(a.sn_kva) ? `${n(a.sn_kva)}kVA` : "",
        capitalizar(a.relacion),
      ].filter(Boolean);
      if (partes.length > 0) lineas.push(partes.join(" "));
      const extras = [
        capitalizar(a.grupo_conexion),
        n(a.impedancia_pct) ? `uk ${n(a.impedancia_pct)}%` : "",
      ].filter(Boolean);
      if (extras.length > 0) lineas.push(extras.join(" · "));
      break;
    }
  }
  return lineas;
}

function anotacionBarra(a: Record<string, unknown>): string[] {
  const partes = [
    capitalizar(a.material),
    capitalizar(a.perfil),
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
