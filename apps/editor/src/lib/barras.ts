/**
 * Corriente admisible de una BARRA a partir de sus dimensiones y
 * material (E55/E56/E57 — corrección del usuario a E54: "de las barras
 * hay tablas de corriente admisible por sus dimensiones y normativa,
 * que la normativa cambia si es Cu o Al", y después "DIN 43671 donde
 * esta normado corriente admisible y dimensiones").
 *
 * Fuente real, encontrada en el propio disco del usuario y verificada
 * visualmente (mismo criterio que la tabla de cables,
 * `libreria-simbolos/normativa/tablaIzAea90364552.mjs`):
 * `D:\Drive\Facultad\PPS\Hojas de datos\ficha_tecnica_pletina_de_cobre.pdf`
 * — Bronmetal, "Pletinas de cobre para aplicaciones eléctricas, según
 * EN 13601", tabla "INTENSIDAD ADMISIBLE. DIN 43671" (35°C ambiente,
 * 65°C temperatura final de barra, conductividad 56 MΩ⁻¹mm⁻²). Esta
 * ficha vive en la carpeta del propio PPS del usuario — es, casi
 * seguro, la fuente real del dato ya cargado en el proyecto (barra
 * 30×10mm → 573 A, corriente alterna hasta 60 Hz, barra brillante, 1
 * barra: coincide EXACTO con lo que trae el proyecto real). Un
 * catálogo de Rittal independiente (DIN 43671 también) da el mismo
 * valor para esa fila, así que las dos fuentes se corroboran entre sí.
 *
 * A diferencia de la de cables, esta SÍ cubre el agrupamiento real:
 * corriente para 1, 2, 3 y 4 barras apiladas por fase (columnas
 * "Nº barras" de la ficha) — el agrupamiento NO es lineal (hay
 * calentamiento mutuo entre barras), así que antes de esta corrección
 * no había forma de darle un valor real a ese caso.
 *
 * NO hay una tabla igual de verificable para ALUMINIO — es una norma
 * DISTINTA (DIN 43670, no 43671: "la normativa cambia si es Cu o Al"
 * es literal, no solo la tabla) y esta ficha es solo de cobre. Se
 * deriva de la tabla de cobre con el factor de conversión Cu→Al
 * habitual (el cobre admite ~1,27 veces más que el aluminio a igual
 * sección, por su mayor conductividad — consistente en las fuentes de
 * fabricante consultadas), no es una tabla propia transcripta.
 *
 * Fuera de esta tabla (secciones no tabuladas, o más de 4 barras
 * apiladas) se cae a una estimación por densidad de corriente típica,
 * deliberadamente más conservadora e imprecisa — sirve de piso, no de
 * reemplazo.
 */
interface FilaBarra {
  anchoMm: number;
  espesorMm: number;
  /** Corriente continua CA hasta 60 Hz, barra de cobre BRILLANTE (sin
   * pintar) — índice 0 = 1 barra, índice 1 = 2 barras apiladas por
   * fase, etc. `undefined` = la ficha no da valor para esa cantidad en
   * esta sección (barras chicas no se apilan en la práctica). */
  corrienteCuA: [number, number?, number?, number?];
}

/** Tabla Bronmetal / DIN 43671 — corriente alterna hasta 60 Hz, barra
 * de cobre brillante (sin pintar), 35°C aire / 65°C barra. */
const TABLA_DIN_43671_CU: FilaBarra[] = [
  { anchoMm: 12, espesorMm: 2, corrienteCuA: [108, 182, 216] },
  { anchoMm: 15, espesorMm: 2, corrienteCuA: [128, 212, 247] },
  { anchoMm: 15, espesorMm: 3, corrienteCuA: [162, 282, 361] },
  { anchoMm: 20, espesorMm: 2, corrienteCuA: [162, 264, 298] },
  { anchoMm: 20, espesorMm: 3, corrienteCuA: [204, 348, 431] },
  { anchoMm: 20, espesorMm: 5, corrienteCuA: [274, 500, 690] },
  { anchoMm: 20, espesorMm: 10, corrienteCuA: [427, 825, 1180] },
  { anchoMm: 25, espesorMm: 3, corrienteCuA: [245, 412, 498] },
  { anchoMm: 25, espesorMm: 5, corrienteCuA: [327, 586, 795] },
  { anchoMm: 30, espesorMm: 3, corrienteCuA: [285, 476, 564] },
  { anchoMm: 30, espesorMm: 5, corrienteCuA: [379, 672, 896] },
  { anchoMm: 30, espesorMm: 10, corrienteCuA: [573, 1060, 1480] },
  { anchoMm: 40, espesorMm: 3, corrienteCuA: [366, 600, 690] },
  { anchoMm: 40, espesorMm: 5, corrienteCuA: [482, 836, 1090] },
  { anchoMm: 40, espesorMm: 10, corrienteCuA: [715, 1290, 1770, 2280] },
  { anchoMm: 50, espesorMm: 5, corrienteCuA: [583, 994, 1260, 1920] },
  { anchoMm: 50, espesorMm: 10, corrienteCuA: [852, 1510, 2040, 2600] },
  { anchoMm: 60, espesorMm: 5, corrienteCuA: [688, 1150, 1440, 2210] },
  { anchoMm: 60, espesorMm: 10, corrienteCuA: [985, 1720, 2300, 2900] },
  { anchoMm: 80, espesorMm: 5, corrienteCuA: [885, 1450, 1750, 2720] },
  { anchoMm: 80, espesorMm: 10, corrienteCuA: [1240, 2110, 2790, 3450] },
  { anchoMm: 100, espesorMm: 5, corrienteCuA: [1080, 1730, 2050, 3190] },
  { anchoMm: 100, espesorMm: 10, corrienteCuA: [1490, 2480, 3260, 3980] },
  { anchoMm: 120, espesorMm: 10, corrienteCuA: [1740, 2860, 3740, 4500] },
  { anchoMm: 160, espesorMm: 10, corrienteCuA: [2220, 3590, 4680, 5530] },
  { anchoMm: 200, espesorMm: 10, corrienteCuA: [2690, 4310, 5610, 6540] },
];

/** Cobre admite ~1,27 veces más que aluminio a igual sección (mayor
 * conductividad) — factor documentado en guías de fabricante, no una
 * tabla propia de DIN 43670 transcripta. */
const FACTOR_CU_A_AL = 1.27;

/** Densidad de corriente (A/mm²) para el caso SIN tabla (sección fuera
 * de rango, o más de 4 barras apiladas) — deliberadamente más
 * conservadora que la tabla real: sirve de piso, no de reemplazo. */
const DENSIDAD_CORRIENTE_A_MM2: Record<"Cu" | "Al", number> = {
  Cu: 1.3,
  Al: 0.9,
};

export interface CorrienteAdmisibleBarra {
  corrienteA: number;
  /** "tabla" = valor real de DIN 43671 (cobre, sección y cantidad de
   * barras tabuladas); "estimado" = densidad de corriente típica
   * (sección o cantidad fuera de la tabla, o aluminio derivado). */
  fuente: "tabla" | "estimado";
}

/** Busca la fila EXACTA (ancho, espesor) — la norma no interpola entre
 * pasos, tampoco se inventa acá. */
function filaTabla(anchoMm: number, espesorMm: number): FilaBarra | null {
  return (
    TABLA_DIN_43671_CU.find((f) => f.anchoMm === anchoMm && f.espesorMm === espesorMm) ?? null
  );
}

/**
 * Parsea `dimensiones` — el campo acepta DOS formatos reales, vistos
 * en proyectos reales de Vatia: "30x10mm" (ancho x espesor de una
 * barra, cantidad implícita 1) o "3x30x10mm" (cantidad de barras
 * apiladas por fase x ancho x espesor, ver barra.schema.json).
 *
 * Con sección Y cantidad de barras (1 a 4) tabuladas: valor REAL de
 * DIN 43671 (cobre) o derivado con el factor Cu→Al (aluminio). En
 * cualquier otro caso (sección no tabulada, o más de 4 barras
 * apiladas) cae a la estimación por densidad de corriente. `null` si
 * no se puede parsear o falta algún dato.
 */
export function estimarCorrienteAdmisibleBarraA(
  dimensiones: string | undefined,
  material: "Cu" | "Al" | undefined,
): CorrienteAdmisibleBarra | null {
  if (!dimensiones) return null;
  const num = (s: string) => Number.parseFloat(s.replace(",", "."));

  let cantidad = 1;
  let ancho: number;
  let espesor: number;

  const conCantidad = /(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i.exec(
    dimensiones,
  );
  if (conCantidad) {
    cantidad = num(conCantidad[1]);
    ancho = num(conCantidad[2]);
    espesor = num(conCantidad[3]);
  } else {
    const sinCantidad = /(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i.exec(dimensiones);
    if (!sinCantidad) return null;
    ancho = num(sinCantidad[1]);
    espesor = num(sinCantidad[2]);
  }
  if (!(cantidad > 0) || !(ancho > 0) || !(espesor > 0)) return null;

  const mat = material ?? "Cu";
  if (Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= 4) {
    const fila = filaTabla(ancho, espesor);
    const corrienteCu = fila?.corrienteCuA[cantidad - 1];
    if (corrienteCu != null) {
      const corrienteA = mat === "Al" ? Math.round(corrienteCu / FACTOR_CU_A_AL) : corrienteCu;
      return { corrienteA, fuente: "tabla" };
    }
  }

  const areaMm2 = cantidad * ancho * espesor;
  const corrienteA = Math.round(areaMm2 * DENSIDAD_CORRIENTE_A_MM2[mat]);
  return { corrienteA, fuente: "estimado" };
}
