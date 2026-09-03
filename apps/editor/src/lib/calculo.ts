/**
 * MOTOR DE CÁLCULO — etapa 1: Ib (corriente de cálculo) y ΔU% (caída de
 * tensión) por tramo de cable. Depende de `datosProyecto` (tensión) y de
 * `topologia.ts` (potencia agregada aguas abajo de cada conexión, ya
 * calculada ahí — ver `ResultadoTopologia.potenciaConexionVa`).
 *
 * Lo que este módulo NO hace todavía: no compara contra la corriente
 * admisible Iz (eso exige las tablas normativas AEA 90364-5-52 /
 * IEC 60364-5-52 por sección/método/aislación — es la etapa siguiente,
 * y ese dato es demasiado sensible para transcribirlo sin que un
 * electricista lo valide primero). No calcula Icc (60909) ni contactos
 * indirectos. Es puramente informativo: no bloquea nada ni certifica que
 * un cable "está bien".
 *
 * Simplificación deliberada de la caída de tensión: se usa el modelo
 * resistivo puro (ΔU ≈ factor · ρ · L · Ib · cosφ / S), que ignora la
 * reactancia inductiva del cable. Es la aproximación habitual para
 * secciones chicas/medianas en baja tensión; para secciones grandes
 * (≳95 mm²) la reactancia empieza a pesar y esto puede quedar optimista.
 */
import type { DatosProyecto } from "./tipos";

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
