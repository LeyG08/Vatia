import type { FamiliaAtributos } from "./tipos";
import type { DatosSimbolo } from "./store";
import { poderDeCorteKA, rangoAjusteA } from "./electrico";

/** Estética de plano: todo texto que arranca, arranca con mayúscula */
export function capitalizar(texto: unknown): string {
  const s = String(texto ?? "").trim();
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : "";
}

function n(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

/**
 * "Ir min..max A" del aparato regulable.
 *
 * La lectura del rango va por rangoAjusteA() y no por los campos directos,
 * porque el MCCB los nombra ir_a_min/ir_a_max y el guardamotor y el relé
 * térmico ir_min_a/ir_max_a: el mismo dato con el sufijo invertido.
 */
function lineaAjuste(a: Record<string, unknown>): string {
  const r = rangoAjusteA(a);
  if (!r) return "";
  return `Ir ${r.min ?? ""}..${r.max ?? ""} A`;
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
      const pdcc = pdccEnA(poderDeCorteKA(a));
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
        // SIN capitalizar: gG, gL y aM son designaciones de IEC 60269
        // sensibles a mayúsculas. "GG" no existe como clase de fusible.
        String(a.clase_caracteristica ?? "").trim(),
      ].filter(Boolean);
      if (f.length > 0) l.push(f.join(" "));
      if (a.tamano) l.push(capitalizar(a.tamano));
      const pdcc = pdccEnA(poderDeCorteKA(a));
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
    case "mccb_caja_moldeada": {
      if (a.cantidad_polos != null) l.push(`${a.cantidad_polos}P`);
      const ajusteMccb = lineaAjuste(a);
      if (ajusteMccb) l.push(ajusteMccb);
      if (n(a.im_a)) l.push(`Im ${n(a.im_a)} A`);
      const pdcc = pdccEnA(poderDeCorteKA(a));
      if (pdcc) l.push(`PdCC ${pdcc}`);
      if (a.norma_fabricacion) l.push(`Norma ${capitalizar(a.norma_fabricacion)}`);
      break;
    }
    case "guardamotor_termomagnetico": {
      if (a.cantidad_polos != null) l.push(`${a.cantidad_polos}P`);
      const ajusteGuardamotor = lineaAjuste(a);
      if (ajusteGuardamotor) l.push(ajusteGuardamotor);
      if (n(a.ii_a)) l.push(`Ii ${n(a.ii_a)} A`);
      const icu = pdccEnA(poderDeCorteKA(a));
      if (icu) l.push(`Icu ${icu}`);
      if (a.categoria_empleo) l.push(`Cat ${a.categoria_empleo}`);
      break;
    }
    case "rele_termico": {
      if (a.cantidad_polos != null) l.push(`${a.cantidad_polos}P`);
      const ajusteRele = lineaAjuste(a);
      if (ajusteRele) l.push(ajusteRele);
      if (a.clase_disparo) l.push(`Clase ${capitalizar(a.clase_disparo)}`);
      break;
    }
    case "contacto_auxiliar": {
      if (a.tipo_contacto) l.push(`Contacto ${a.tipo_contacto}`);
      if (n(a.ith_a)) l.push(`Ith ${n(a.ith_a)} A`);
      break;
    }
    case "transformador_corriente": {
      if (a.relacion) l.push(`TI ${a.relacion}`);
      if (n(a.s_va)) l.push(`${n(a.s_va)} VA`);
      if (a.clase_precision) l.push(`Clase ${a.clase_precision}`);
      break;
    }
    case "banco_capacitores": {
      if (n(a.potencia_kvar)) l.push(`${n(a.potencia_kvar)} kvar`);
      if (n(a.tension_v)) l.push(`${n(a.tension_v)} V`);
      if (a.conexion) l.push(capitalizar(a.conexion));
      break;
    }
    case "portafusible": {
      const pf = [capitalizar(a.portafusible_marca), capitalizar(a.portafusible_modelo)].filter(Boolean).join(" ");
      if (pf) l.push(`Base ${pf}`);
      if (n(a.portafusible_tension_v)) l.push(`${n(a.portafusible_tension_v)} V`);
      break;
    }
    case "interruptor_diferencial": {
      if (a.cantidad_polos != null) l.push(`${a.cantidad_polos}P`);
      if (n(a.in_a)) l.push(`In ${n(a.in_a)} A`);
      if (n(a.sensibilidad_ma)) l.push(`IΔn ${n(a.sensibilidad_ma)} mA`);
      if (a.tipo_diferencial) l.push(`Tipo ${a.tipo_diferencial}`);
      break;
    }
    case "rele_proteccion_tension": {
      if (n(a.ue_v)) l.push(`Ue ${n(a.ue_v)} V`);
      if (n(a.subtension_pct) || n(a.sobretension_pct)) {
        l.push(`U< ${n(a.subtension_pct)}% · U> ${n(a.sobretension_pct)}%`);
      }
      if (n(a.retardo_disparo_s)) l.push(`t ${n(a.retardo_disparo_s)} s`);
      break;
    }
    case "rele_auxiliar": {
      if (n(a.tension_bobina_v)) l.push(`Bobina ${n(a.tension_bobina_v)} V`);
      if (a.configuracion_contactos) l.push(String(a.configuracion_contactos));
      if (n(a.capacidad_termica_contactos_a)) l.push(`Ith ${n(a.capacidad_termica_contactos_a)} A`);
      break;
    }
    case "sirena_alarma": {
      if (n(a.tension_v)) l.push(`${n(a.tension_v)} V`);
      if (a.tipo_senal) l.push(capitalizar(a.tipo_senal));
      break;
    }
    case "instrumento_medicion": {
      if (a.tipo_instrumento) l.push(capitalizar(a.tipo_instrumento));
      if (a.escala) l.push(String(a.escala));
      break;
    }
  }
  return l;
}

/**
 * Ficha de la BARRA en el formato del plano real (C8), APILADA (C20):
 * un ítem por línea, sin amontonar en un solo renglón:
 *   Juego de barras 3P+N+PE     ← si es conjunto (C15/C11)
 *   3x30x10mm · Cu              ← dimensiones con el material al lado
 *   500 A · IRAM 2181-1         ← corriente admisible con la norma al lado
 * Se dibuja en el extremo izquierdo, por encima de la barra.
 */
export function anotacionBarra(a: Record<string, unknown>): string[] {
  const lineas: string[] = [];
  if (a.es_conjunto === true) {
    if (typeof a.cantidad_fases === "number" && a.cantidad_fases > 0) {
      const partes = [`${a.cantidad_fases}P`];
      if (a.incluye_neutro === true) partes.push("N");
      if (a.incluye_tierra === true) partes.push("PE");
      lineas.push(`Juego de barras ${partes.join("+")}`);
    } else {
      lineas.push("Juego de barras");
    }
  }
  const dims = typeof a.dimensiones === "string" ? a.dimensiones.trim() : "";
  const mat = capitalizar(a.material);
  if (dims !== "" || mat) {
    lineas.push([dims, mat].filter(Boolean).join(" · "));
  }
  const ultima = [
    n(a.corriente_admisible_A) ? `${n(a.corriente_admisible_A)} A` : "",
    capitalizar(a.norma_iram),
  ].filter(Boolean);
  if (ultima.length > 0) lineas.push(ultima.join(" · "));
  return lineas;
}

/**
 * Bloque DEBAJO de la flecha de destino de circuito (§C7/C9), en el
 * orden del plano real: código / tipo / alimentación / potencia
 * aparente / corriente / designación. Solo líneas con valor.
 * La alimentación sale de C9: "1F 220 V · L1" (mono con neutro),
 * "1F 380 V · L2" (mono entre fases) o "3F 380 V" (trifásica).
 * La utilización (C10/C13) va como línea SECUNDARIA: más chica y
 * gris, sin ensuciar la nominal.
 */
function anotacionCarga(
  a: Record<string, unknown>,
  tensionFaseV: number,
  tensionLineaV: number,
): LineaAnotacion[] {
  const l: LineaAnotacion[] = [];
  if (a.codigo_circuito) l.push({ texto: String(a.codigo_circuito) });
  if (a.tipo_carga) l.push({ texto: String(a.tipo_carga) });
  if (a.alimentacion) {
    const tri = a.alimentacion === "trifasica";
    const v = `${tri || a.lleva_neutro === false ? tensionLineaV : tensionFaseV} V`;
    // C15: el NEUTRO se declara en la línea ("1F N", "3F N") para
    // distinguirlo de un circuito entre fases a simple vista.
    const conN = a.lleva_neutro === true ? " N" : "";
    const linea = !tri && typeof a.linea_asignada === "string" ? ` · ${a.linea_asignada}` : "";
    l.push({ texto: `${tri ? "3F" : "1F"}${conN} ${v}${linea}` });
  }
  if (n(a.potencia_va)) l.push({ texto: `${n(a.potencia_va)} VA` });
  if (n(a.corriente_a)) l.push({ texto: `${n(a.corriente_a)} A` });
  // Utilización como dato SECUNDARIO, en % del nominal (C15):
  // solo si Ku cargado y < 1 (con Ku=1 no aporta nada).
  if (
    typeof a.ku === "number" &&
    a.ku < 1 &&
    n(a.potencia_utilizacion_va)
  ) {
    l.push({
      texto: `útil ${n(a.potencia_utilizacion_va)} VA (${Math.round(a.ku * 100)} %)`,
      secundaria: true,
    });
  }
  if (a.descripcion) l.push({ texto: capitalizar(a.descripcion) });
  return l;
}

/** Línea de anotación bajo un símbolo. Las secundarias se dibujan un
 * paso más chicas y claras (jerarquía de plano, C13). */
export interface LineaAnotacion {
  texto: string;
  secundaria?: boolean;
}

/** Líneas de anotación bajo un símbolo, como en los planos reales */
export function anotacionNodo(
  familia: FamiliaAtributos,
  data: DatosSimbolo,
  tensionFaseV = 220,
  tensionLineaV = 380,
): LineaAnotacion[] {
  const a = (data.atributos ?? {}) as Record<string, unknown>;
  const planas = (ss: string[]): LineaAnotacion[] => ss.map((t) => ({ texto: t }));
  if (familia === "aparato") return planas(anotacionAparato(a));
  if (familia === "barra") return planas(anotacionBarra(a));
  if (familia === "carga") return anotacionCarga(a, tensionFaseV, tensionLineaV);
  return [];
}

/**
 * Anotación del CABLE sobre la conexión. Reglas (acordadas con el
 * usuario):
 * - unipolar   → "n × 1 × S"; multipolar → "1 × n × S".
 * - Los conductores se agrupan POR SECCIÓN con su cantidad real
 *   (C15): el neutro y la tierra ya no se cuelgan de la sección de
 *   fase. Secciones iguales se suman en un mismo grupo.
 * - Multipolar uniforme → "1 × 6 × 16 mm²"; con secciones mezcladas
 *   el detalle va adentro: "1 × (3×50 + 2×35) mm²". Unipolar:
 *   "3×50 + 2×35 mm²" (C22: sin repetir "1 x" por grupo — más corto
 *   para que la nota no invada el diagrama).
 * - Puede haber conexiones SOLO de neutro o solo de tierra: se
 *   representan igualmente ("1 × 16 mm²").
 * - Orden del bloque: SECCIONES / material-aislación / norma IRAM.
 */
export function lineasCable(a: Record<string, unknown>): string[] {
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
    typeof a.cantidad_conductores === "number" && a.cantidad_conductores > 0
      ? a.cantidad_conductores
      : 0;
  const mp = a.tipo_cable === "multipolar";
  const sN = a.lleva_neutro ? n(a.seccion_neutro_mm2) || sf : "";
  const sT = a.lleva_tierra ? n(a.seccion_tierra_mm2) || sf : "";

  // Un grupo por sección, sumando cantidades reales
  const grupos: { cant: number; s: string }[] = [];
  const sumar = (cant: number, s: string) => {
    if (!s || cant <= 0) return;
    const g = grupos.find((x) => x.s === s);
    if (g) g.cant += cant;
    else grupos.push({ cant, s });
  };
  sumar(fases, sf);
  sumar(1, sN);
  sumar(1, sT);
  if (grupos.length === 0) return [];

  let linea1 = "";
  if (mp) {
    linea1 =
      grupos.length === 1
        ? `1 × ${grupos[0].cant} × ${grupos[0].s} mm²`
        : `1 × (${grupos.map((g) => `${g.cant}×${g.s}`).join(" + ")}) mm²`;
  } else {
    linea1 = grupos.map((g) => `${g.cant}×${g.s}`).join(" + ") + " mm²";
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
