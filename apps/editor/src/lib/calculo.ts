/**
 * MOTOR DE CÁLCULO — etapa 1: Ib (corriente de cálculo), ΔU% (caída de
 * tensión) e Iz (corriente admisible) por tramo de cable. Depende de
 * `datosProyecto` (tensión) y de `topologia.ts` (potencia agregada aguas
 * abajo de cada conexión, ya calculada ahí — ver
 * `ResultadoTopologia.potenciaConexionVa`).
 *
 * Iz sale de `libreria-simbolos/normativa/tablaIzAea90364552.mjs`
 * (AEA 90364-5-52 / IEC 60364-5-52, Anexo B — ver
 * docs/normativa/iz-corriente-admisible.md para la referencia exacta y
 * qué métodos de instalación todavía faltan cargar). No calcula Icc
 * (60909) ni contactos indirectos. Es puramente informativo: no bloquea
 * nada ni certifica que un cable "está bien" — falta comparar contra la
 * corriente nominal de la protección aguas arriba (In), que es una
 * pregunta topológica distinta a la de este módulo.
 *
 * Simplificación deliberada de la caída de tensión: se usa el modelo
 * resistivo puro (ΔU ≈ factor · ρ · L · Ib · cosφ / S), que ignora la
 * reactancia inductiva del cable. Es la aproximación habitual para
 * secciones chicas/medianas en baja tensión; para secciones grandes
 * (≳95 mm²) la reactancia empieza a pesar y esto puede quedar optimista.
 */
import type { DatosProyecto } from "./tipos";
import {
  corrienteAdmisibleBaseA,
  FACTOR_TEMPERATURA_AIRE,
  FACTOR_TEMPERATURA_ENTERRADO,
  FACTOR_AGRUPAMIENTO_AIRE,
} from "../../../../libreria-simbolos/normativa/tablaIzAea90364552.mjs";

/** Resistividad de referencia a temperatura de servicio (Ω·mm²/m). */
const RHO_OHM_MM2_POR_M: Record<"Cu" | "Al", number> = {
  Cu: 0.0225,
  Al: 0.036,
};

/** cosφ asumido cuando el cable no tiene un valor propio declarado. */
export const COS_PHI_POR_DEFECTO = 0.85;

export interface DatosCableParaCalculo {
  longitud_m?: number;
  seccion_fase_mm2?: number;
  material?: "Cu" | "Al";
}

/**
 * Corriente de cálculo Ib (A) a partir de la potencia aparente en VA que
 * circula por el tramo (ya resuelta por topología) y si el tramo es
 * trifásico o monofásico. `null` si falta algún dato.
 */
export function calcularIbA(
  potenciaVa: number | null | undefined,
  trifasica: boolean,
  datosProyecto: DatosProyecto,
): number | null {
  if (typeof potenciaVa !== "number" || !(potenciaVa > 0)) return null;
  const v = trifasica
    ? Math.sqrt(3) * datosProyecto.tension_linea_v
    : datosProyecto.tension_fase_v;
  if (!(v > 0)) return null;
  return potenciaVa / v;
}

/**
 * Caída de tensión ΔU%, modelo resistivo. Monofásica: ida y vuelta
 * (factor 2). Trifásica equilibrada: solo la caída de línea (factor √3).
 */
export function calcularCaidaTensionPct(
  cable: DatosCableParaCalculo,
  ibA: number | null,
  trifasica: boolean,
  datosProyecto: DatosProyecto,
  cosPhi: number = COS_PHI_POR_DEFECTO,
): number | null {
  const { longitud_m, seccion_fase_mm2, material } = cable;
  if (
    !longitud_m ||
    !seccion_fase_mm2 ||
    !material ||
    typeof ibA !== "number" ||
    !(ibA > 0)
  ) {
    return null;
  }
  const vRef = trifasica
    ? datosProyecto.tension_linea_v
    : datosProyecto.tension_fase_v;
  if (!(vRef > 0)) return null;

  const factor = trifasica ? Math.sqrt(3) : 2;
  const rho = RHO_OHM_MM2_POR_M[material];
  const caidaV = (factor * rho * longitud_m * ibA * cosPhi) / seccion_fase_mm2;
  return (caidaV / vRef) * 100;
}

const METODOS_ENTERRADOS = new Set(["D1", "D2"]);

/** Valor de tabla más cercano a `temp` sin pasarse (la norma da pasos
 * discretos de 5°C; entre pasos, el criterio conservador es tomar el
 * escalón inferior — nunca sobrestimar Iz). */
function factorPorTemperatura(
  tabla: Record<number, number> | undefined,
  temp: number | undefined,
): number {
  if (!tabla || temp === undefined) return 1;
  const pasos = Object.keys(tabla)
    .map(Number)
    .sort((a, b) => a - b);
  let elegido = pasos[0];
  for (const p of pasos) {
    if (p <= temp) elegido = p;
  }
  return tabla[elegido] ?? 1;
}

/** Un TRAMO del recorrido físico del cable (E59): un mismo circuito
 * real puede ir parte encañado en pared y parte enterrado, cada tramo
 * con su propio método de instalación, temperatura ambiente y
 * canalización (E60: el agrupamiento también puede variar tramo a
 * tramo — un cable puede compartir bandeja con otros en un tramo y
 * seguir solo en el resto de su recorrido). */
export interface TramoInstalacion {
  metodo_instalacion?: string;
  longitud_m?: number;
  temperatura_ambiente_c?: number;
  canalizacion?: string;
}

export interface DatosCableParaIz {
  material?: "Cu" | "Al";
  aislacion?: "PVC" | "XLPE" | "EPR";
  seccion_fase_mm2?: number;
  tramos?: TramoInstalacion[];
}

export interface ResultadoIz {
  /** Corriente admisible de tabla, sin corregir. */
  izBaseA: number;
  /** Corriente admisible ya corregida por temperatura y agrupamiento —
   * la que corresponde comparar contra Ib. */
  izCorregidaA: number;
  factorTemperatura: number;
  factorAgrupamiento: number;
  /** Nº de tramo (1-based) que resultó el más restrictivo — el que fija
   * el Iz del cable entero. `1` si hay un solo tramo (el caso común). */
  tramoLimitante: number;
}

/** Suma la longitud de todos los tramos — la caída de tensión depende
 * de la longitud TOTAL del recorrido, no de un tramo en particular.
 * `undefined` si no hay ningún tramo con longitud cargada. */
export function longitudTotalM(tramos: TramoInstalacion[] | undefined): number | undefined {
  if (!tramos || tramos.length === 0) return undefined;
  const total = tramos.reduce(
    (acc, t) => acc + (typeof t.longitud_m === "number" ? t.longitud_m : 0),
    0,
  );
  return total > 0 ? total : undefined;
}

/**
 * Corriente admisible corregida del cable ENTERO: se calcula Iz por
 * CADA tramo (su propio método + temperatura) y se toma el MÍNIMO — el
 * tramo más restrictivo manda, AEA 90364-5-52 / IEC 60364-5-52 (E59:
 * antes el cable tenía un solo método de instalación para todo el
 * recorrido, que no siempre es real). `null` si falta algún dato común
 * (material/aislación/sección) o si NINGÚN tramo tiene su método
 * cargado, o cuya combinación de método+sección no está tabulada (ver
 * docs/normativa/iz-corriente-admisible.md).
 *
 * NO incluye la corrección por resistividad térmica del terreno
 * (Tabla B52-16, métodos D1/D2): el schema de conductor todavía no
 * tiene ese campo, así que ese factor queda implícitamente en 1 — un
 * tramo enterrado en un terreno de peor resistividad térmica que la de
 * referencia (1 K·m/W) puede admitir MENOS de lo que este cálculo diga.
 *
 * `circuitosAgrupadosDe`: resuelve, para la canalización de CADA
 * tramo, cuántos conductores la comparten (INCLUIDO él, mínimo 1) —
 * una función y no un número porque cada tramo puede tener su PROPIA
 * canalización (E60: un cable puede compartir bandeja con otros en un
 * tramo y seguir solo en el resto). Es responsabilidad del que llama
 * resolverlo (recorriendo el campo `canalizacion` del resto del
 * proyecto, ver PanelAtributos.tsx) — este módulo no conoce el resto
 * de los conductores.
 */
export function calcularIzA(
  cable: DatosCableParaIz,
  trifasica: boolean,
  circuitosAgrupadosDe: (canalizacion: string | undefined) => number = () => 1,
): ResultadoIz | null {
  const { material, aislacion, seccion_fase_mm2, tramos } = cable;
  if (!material || !aislacion || !seccion_fase_mm2 || !tramos || tramos.length === 0) {
    return null;
  }

  let mejor: ResultadoIz | null = null;
  tramos.forEach((tramo, indice) => {
    const metodo = tramo.metodo_instalacion;
    if (!metodo) return;
    const izBaseA = corrienteAdmisibleBaseA({
      aislacion,
      conductoresCargados: trifasica ? 3 : 2,
      material,
      metodoInstalacion: metodo,
      seccionMm2: seccion_fase_mm2,
    });
    if (izBaseA === null) return;

    const enterrado = METODOS_ENTERRADOS.has(metodo);
    const tablaTemp = enterrado
      ? FACTOR_TEMPERATURA_ENTERRADO[aislacion]
      : FACTOR_TEMPERATURA_AIRE[aislacion];
    const factorTemperatura = factorPorTemperatura(tablaTemp, tramo.temperatura_ambiente_c);

    // El agrupamiento (Tabla B52-17) solo está cargado para el caso "al
    // aire, ítem 1" — no corresponde aplicarlo a un método enterrado
    // (D1/D2 tienen sus propias tablas de agrupamiento, B52-18 a
    // B52-21, todavía sin cargar). El método G ("separados un diámetro")
    // tampoco lleva este factor: la Tabla B52-1 (continuación) marca la
    // columna de agrupamiento con "-" para G — separar los cables un
    // diámetro es justamente lo que evita el efecto que este factor
    // corrige, así que la norma no pide una reducción adicional acá.
    const factorAgrupamiento = enterrado || metodo === "G"
      ? 1
      : factorPorAgrupamiento(circuitosAgrupadosDe(tramo.canalizacion));
    const izCorregidaA = izBaseA * factorTemperatura * factorAgrupamiento;

    if (!mejor || izCorregidaA < mejor.izCorregidaA) {
      mejor = {
        izBaseA,
        izCorregidaA,
        factorTemperatura,
        factorAgrupamiento,
        tramoLimitante: indice + 1,
      };
    }
  });

  return mejor;
}

/** Cantidades no tabuladas (10, 11, 13...) toman el escalón inferior
 * más cercano — conservador, nunca sobrestima Iz. Más de 9 circuitos:
 * la norma no exige mayor reducción salvo que caiga justo en 12/16/20. */
function factorPorAgrupamiento(cantidad: number | undefined): number {
  if (cantidad === undefined || cantidad <= 1) return 1;
  const pasos = Object.keys(FACTOR_AGRUPAMIENTO_AIRE)
    .map(Number)
    .sort((a, b) => a - b);
  let elegido = pasos[0];
  for (const p of pasos) {
    if (p <= cantidad) elegido = p;
  }
  return FACTOR_AGRUPAMIENTO_AIRE[elegido] ?? 1;
}
