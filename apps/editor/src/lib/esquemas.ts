import brutoAparato from "../../../../libreria-simbolos/schemas/aparato.schema.json";
import brutoConductor from "../../../../libreria-simbolos/schemas/conductor.schema.json";
import brutoBarra from "../../../../libreria-simbolos/schemas/barra.schema.json";
import brutoCarga from "../../../../libreria-simbolos/schemas/carga.schema.json";
import { esCampoVisible } from "../../../../libreria-simbolos/verificacion/reglasFicha.mjs";

export type FamiliaAtributos =
  | "aparato"
  | "conductor"
  | "barra"
  | "carga"
  | "sin_ficha_tecnica";

type EsquemaCampo = {
  type?: string;
  enum?: string[];
  const?: string;
  description?: string;
  title?: string;
  exclusiveMinimum?: number;
  minimum?: number;
  maximum?: number;
  "x-obligatorio"?: boolean;
  "x-visible-si"?: string;
};

type EsquemaDef = {
  properties?: Record<string, EsquemaCampo>;
  allOf?: { $ref?: string }[];
  required?: string[];
  "x-obligatorio"?: boolean;
  "x-alguno-obligatorio"?: string[];
  "x-par-automatico"?: {
    campos: [string, string];
    factor_hp_a_kw: number;
  };
};

type EsquemaRaiz = {
  $defs?: Record<string, EsquemaDef>;
  properties?: Record<string, EsquemaCampo>;
};

const schemaAparato = brutoAparato as unknown as EsquemaRaiz;
const schemaConductor = brutoConductor as unknown as EsquemaRaiz;
const schemaBarra = brutoBarra as unknown as EsquemaRaiz;
const schemaCarga = brutoCarga as unknown as EsquemaRaiz;

export interface CampoDescriptor {
  nombre: string;
  esquema: EsquemaCampo;
  obligatorio: boolean;
  title?: string;
}

export interface ReglaParAutomatico {
  campos: [string, string];
  factorHpAKw: number;
}

const DEFS_POR_FAMILIA: Record<
  Exclude<FamiliaAtributos, "sin_ficha_tecnica">,
  EsquemaRaiz
> = {
  aparato: schemaAparato,
  conductor: schemaConductor,
  barra: schemaBarra,
  carga: schemaCarga,
};

function resolverRef(raiz: EsquemaRaiz, ref: string): EsquemaDef {
  const nombre = ref.replace("#/$defs/", "");
  const def = raiz.$defs?.[nombre];
  if (!def) throw new Error(`$ref no resuelto: ${ref}`);
  return def;
}

function propiedadesDeDef(raiz: EsquemaRaiz, def: EsquemaDef): Record<string, EsquemaCampo> {
  const props: Record<string, EsquemaCampo> = {};
  for (const rama of def.allOf ?? []) {
    if (!rama.$ref) continue;
    Object.assign(props, propiedadesDeDef(raiz, resolverRef(raiz, rama.$ref)));
  }
  Object.assign(props, def.properties);
  return props;
}

/**
 * ¿Corresponde mostrar (y exigir) este campo?
 *
 * `x-visible-si` admite dos formas:
 *   "es_conjunto"                              → el campo que gobierna debe valer true
 *   "tipo_disparo:termomagnetico|electronico"  → debe valer alguno de esos
 *
 * La primera es la histórica (C15, composición del juego de barras). La
 * segunda se agregó para el tipo de disparo del MCCB, donde la condición no es
 * booleana sino por valor: según sea termomagnético, magnético o electrónico
 * se habilitan distintos campos de ajuste.
 *
 * La usan TANTO el formulario (para ocultar) COMO el checklist (para no exigir
 * un campo que está oculto); si solo la usara el formulario, el checklist
 * pediría cargar campos que el usuario no puede ver.
 *
 * Implementación real en libreria-simbolos/verificacion/reglasFicha.mjs,
 * compartida con scripts/verificar_proyecto_real.mjs (Node puro, sin Vite).
 */
export function campoVisible(
  esquema: { "x-visible-si"?: string },
  atributos: Record<string, unknown>,
): boolean {
  return esCampoVisible(esquema, atributos);
}

export function subtiposAparato(): string[] {
  return Object.keys(schemaAparato.$defs ?? {}).filter((k) => k !== "base_comun");
}

export function camposDeFamilia(
  familia: FamiliaAtributos,
  atributos: Record<string, unknown>,
): CampoDescriptor[] | null {
  if (familia === "sin_ficha_tecnica") return null;

  const raiz = DEFS_POR_FAMILIA[familia];
  let props: Record<string, EsquemaCampo>;

  if (familia === "aparato") {
    const tipo = typeof atributos.tipo_aparato === "string" ? atributos.tipo_aparato : "";
    const def = tipo ? schemaAparato.$defs?.[tipo] : undefined;
    if (!def) return [];
    props = propiedadesDeDef(schemaAparato, def);
    delete props.tipo_aparato;
  } else {
    props = raiz.properties ?? {};
  }

  return Object.entries(props).map(([nombre, esquema]) => ({
    nombre,
    esquema,
    obligatorio: esquema["x-obligatorio"] === true,
    title: esquema.title,
  }));
}

export function algunoObligatorio(
  familia: FamiliaAtributos,
  atributos: Record<string, unknown>,
): string[] | null {
  if (familia !== "aparato") return null;
  const tipo = typeof atributos.tipo_aparato === "string" ? atributos.tipo_aparato : "";
  const def = tipo ? schemaAparato.$defs?.[tipo] : undefined;
  return def?.["x-alguno-obligatorio"] ?? null;
}

export function parAutomatico(
  familia: FamiliaAtributos,
  atributos: Record<string, unknown>,
): ReglaParAutomatico | null {
  if (familia !== "aparato") return null;
  const tipo = typeof atributos.tipo_aparato === "string" ? atributos.tipo_aparato : "";
  const regla = tipo ? schemaAparato.$defs?.[tipo]?.["x-par-automatico"] : undefined;
  if (!regla) return null;
  return { campos: regla.campos, factorHpAKw: regla.factor_hp_a_kw };
}
