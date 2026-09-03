#!/usr/bin/env node
/**
 * C6 — Verificación del proyecto de prueba con valores REALES del PPS
 * (molino del fondo). Replica las reglas del Checklist (lib/checklist.ts)
 * sobre el JSON serializado, sin depender del editor:
 *
 *  1. Cada nodo referencia un código existente en la librería.
 *  2. Símbolos aparato: campos x-obligatorio del subtipo + x-alguno-obligatorio.
 *  3. Cables (conexiones y alimentadores): reglas POR CABLE idénticas al panel.
 *  4. Alimentadores: origen cargado.
 *
 * Salida esperada con los datos cargados: CERO pendientes.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const proyecto = JSON.parse(
  readFileSync(join(raiz, "apps/editor/ejemplos/proyecto-real-pps.json"), "utf8"),
);

const schemaAparato = JSON.parse(
  readFileSync(join(raiz, "libreria-simbolos/schemas/aparato.schema.json"), "utf8"),
);
const schemaCarga = JSON.parse(
  readFileSync(join(raiz, "libreria-simbolos/schemas/carga.schema.json"), "utf8"),
);
const schemaBarra = JSON.parse(
  readFileSync(join(raiz, "libreria-simbolos/schemas/barra.schema.json"), "utf8"),
);

/* ---- códigos y familia por símbolo (desde cada metadata.json) ---- */
const dirSimbolos = join(raiz, "libreria-simbolos/simbolos");
const METAS = new Map(); // codigo → { familia }
for (const carpeta of readdirSync(dirSimbolos)) {
  const codigo = carpeta.split("_")[0];
  try {
    const meta = JSON.parse(
      readFileSync(join(dirSimbolos, carpeta, "metadata.json"), "utf8"),
    );
    METAS.set(codigo, meta);
  } catch {
    /* carpeta sin metadata: se reporta al usarla */
  }
}
const codigosLibreria = new Set(METAS.keys());

/* ---- espejo de lib/esquemas.ts: resolución if/then por tipo_aparato ---- */
function subtipoDeAparato(tipo) {
  for (const rama of schemaAparato.allOf) {
    const ref = rama.then?.$ref ?? "";
    if (!ref.startsWith("#/$defs/")) continue;
    const clave = ref.slice("#/$defs/".length);
    if (rama.if?.properties?.tipo_aparato?.const === tipo) {
      return schemaAparato.$defs[clave];
    }
  }
  return null;
}

/**
 * Espejo de campoVisible() de apps/editor/src/lib/esquemas.ts.
 *
 * `x-visible-si` admite dos formas: "campo" (el campo debe valer true) y
 * "campo:valor1|valor2" (debe valer alguno de esos). Un campo oculto no se
 * exige, porque el formulario tampoco lo muestra.
 */
function campoVisible(def, attrs) {
  const regla = def && def["x-visible-si"];
  if (!regla) return true;
  const sep = regla.indexOf(":");
  if (sep === -1) return attrs[regla] === true;
  const campo = regla.slice(0, sep);
  const valores = regla.slice(sep + 1).split("|");
  return valores.includes(String(attrs[campo] ?? ""));
}

function reglasDeFamiliaAparato(attrs) {
  const sub = subtipoDeAparato(attrs.tipo_aparato);
  if (!sub) return null;
  const obligatorios = Object.entries(sub.properties ?? {})
    .filter(([, d]) => d && d["x-obligatorio"] === true && campoVisible(d, attrs))
    .map(([n]) => n);
  const alguno = Array.isArray(sub["x-alguno-obligatorio"])
    ? sub["x-alguno-obligatorio"]
    : [];
  return { obligatorios, alguno };
}

/** Familias sin subtipos (carga, barra, …): campos x-obligatorio de raíz */
function reglasDeRaiz(schema, attrs = {}) {
  return {
    obligatorios: Object.entries(schema.properties ?? {})
      .filter(([, d]) => d && d["x-obligatorio"] === true && campoVisible(d, attrs))
      .map(([n]) => n),
    alguno: [],
  };
}

/* ---- espejo de lib/checklist.ts ---- */
const vacio = (v) =>
  v === undefined || v === null || v === "" ||
  (typeof v === "number" && !Number.isFinite(v));

function humanizar(nombre) {
  let t = nombre.replace(/_/g, " ");
  t = t.replace(/\bka$/i, "kA").replace(/\bkw$/i, "kW").replace(/\bhp$/i, "HP");
  t = t.replace(/\bmm2$/i, "mm²").replace(/\bv$/i, "V").replace(/\ba$/i, "A");
  return t.replace(/^./, (c) => c.toUpperCase());
}

function problemasFicha(familia, attrs) {
  if (familia === "sin_ficha_tecnica") return [];
  let reglas;
  if (familia === "aparato") {
    if (vacio(attrs.tipo_aparato)) {
      return ["Elegí el tipo de aparato en el formulario."];
    }
    reglas = reglasDeFamiliaAparato(attrs);
  } else if (familia === "carga") {
    reglas = reglasDeRaiz(schemaCarga, attrs);
  } else if (familia === "barra") {
    reglas = reglasDeRaiz(schemaBarra, attrs);
  } else {
    return []; // conductor: el cable se valida por conexión
  }
  if (!reglas) return ["tipo_aparato desconocido"];
  const msj = [];
  for (const campo of reglas.obligatorios) {
    if (vacio(attrs[campo])) msj.push(`Falta ${humanizar(campo)}.`);
  }
  if (reglas.alguno.length > 0 && reglas.alguno.every((k) => vacio(attrs[k]))) {
    msj.push(`Cargá al menos uno de: ${reglas.alguno.map(humanizar).join(" / ")}.`);
  }
  return msj;
}

function problemasCable(a) {
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
    if (neutro && !sNeutro) msj.push("Falta la sección del neutro.");
    if (tierra && !sTierra) msj.push("Falta la sección de la tierra.");
  }
  if (vacio(a.material)) msj.push("Falta material.");
  if (vacio(a.aislacion)) msj.push("Falta aislación.");
  if (vacio(a.norma_iram)) msj.push("Falta norma IRAM.");
  if (vacio(a.longitud_m)) msj.push("Falta la longitud del tramo.");
  if (vacio(a.metodo_instalacion)) msj.push("Falta el método de instalación.");
  if (!neutro && sNeutro) msj.push("Hay sección de neutro cargada pero el neutro está apagado.");
  if (!tierra && sTierra) msj.push("Hay sección de tierra cargada pero la tierra está apagada.");
  if (sFase) {
    if (sNeutro && sNeutro > sFase) msj.push("La sección del neutro es mayor que la de fase.");
    if (sTierra && sTierra > sFase) msj.push("La sección de la tierra es mayor que la de fase.");
  }
  return msj;
}

/**
 * Campos que un plano unifilar NO puede tener: dependen de la instalación
 * física real (recorrido de la canalización, largo del tramo), no del
 * dibujo. Son x-obligatorio en el schema (el Checklist AEA los advierte en
 * la app, sin bloquear el guardado — ver checklist.ts), pero acá NO cuentan
 * como pendientes que hacen fallar la migración: exigirlos habría dejado
 * este verificador en rojo permanente hasta que alguien mida la instalación
 * real, que es exactamente el estado que entrena a ignorar un chequeo.
 * Se imprimen igual, con ⚠ en vez de ✗, para que el hueco quede visible.
 */
const MENSAJES_INFORMATIVOS = new Set([
  "Falta la longitud del tramo.",
  "Falta el método de instalación.",
]);

function clasificar(mensajes) {
  const bloqueantes = mensajes.filter((m) => !MENSAJES_INFORMATIVOS.has(m));
  const informativos = mensajes.filter((m) => MENSAJES_INFORMATIVOS.has(m));
  return { bloqueantes, informativos };
}

function imprimirResultado(etiqueta, mensajes) {
  const { bloqueantes, informativos } = clasificar(mensajes);
  if (bloqueantes.length === 0 && informativos.length === 0) {
    console.log(`  ✓ ${etiqueta}`);
  } else {
    const lineas = [
      ...bloqueantes.map((m) => `      - ${m}`),
      ...informativos.map((m) => `      ⚠ ${m} (dato de sitio, no bloquea)`),
    ];
    const marca = bloqueantes.length > 0 ? "✗" : "⚠";
    console.log(`  ${marca} ${etiqueta}\n${lineas.join("\n")}`);
  }
  return bloqueantes.length;
}

/* ---- barrido ----
 * C22: el proyecto es MULTI-HOJA (un hoja por unifilar del DWG).
 * Las hojas con contenido se validan igual que antes; las VACÍAS son
 * unifilares aún no migrados: se informan pero NO hacen fallar. */
let totalPendientes = 0;
let totalInformativos = 0;
const nombres = new Map();
const vacias = [];

for (const hoja of proyecto.hojas) {
  if (
    (!hoja.nodos || hoja.nodos.length === 0) &&
    (!hoja.conexiones || hoja.conexiones.length === 0)
  ) {
    vacias.push(hoja.nombre ?? hoja.id);
    continue;
  }
  console.log(`— Hoja «${hoja.nombre}» (${hoja.tablero ?? "?"})`);
  for (const n of hoja.nodos) {
  if (n.tipo === "alimentador") {
    nombres.set(n.id, `Alimentador${n.datos?.origen ? ` desde ${n.datos.origen}` : ""}`);
    const msj = [
      ...(typeof n.datos?.origen !== "string" || n.datos.origen.trim() === ""
        ? ["Falta el origen (desde dónde viene)."]
        : []),
      ...problemasCable(n.atributos ?? {}),
    ];
    totalPendientes += imprimirResultado(nombres.get(n.id), msj);
    totalInformativos += clasificar(msj).informativos.length;
    continue;
  }
  /* C26: la app resuelve el código por tipo cuando falta (barra →
   * S00119, ver construirEstadoHoja); el verificador espeja eso. */
  const codigo = n.codigo_iec ?? (n.tipo === "barra" ? "S00119" : n.codigo_iec);
  if (!codigosLibreria.has(codigo)) {
    totalPendientes += 1;
    console.log(`  ✗ ${n.id}: código ${n.codigo_iec} NO existe en la librería`);
    continue;
  }
  const attrs = n.atributos ?? {};
  const familia = METAS.get(codigo)?.familia_atributos;
  const marcaModelo = [attrs.marca, attrs.modelo].filter(Boolean).join(" ");
  const etiqueta = `${n.id} (${codigo})${marcaModelo ? ` · ${marcaModelo}` : ""}`;
  nombres.set(n.id, `${codigo}${marcaModelo ? ` ${marcaModelo}` : ""}`);
  const msj = problemasFicha(familia, attrs);
  totalPendientes += msj.length;
  console.log(msj.length === 0
    ? `  ✓ ${etiqueta}`
    : `  ✗ ${etiqueta}\n      - ${msj.join("\n      - ")}`);
}

  for (const c of hoja.conexiones) {
    const msj = problemasCable(c.atributos_conductor ?? {});
    const etiqueta = `Conexión ${c.desde} → ${c.hasta}`;
    totalPendientes += imprimirResultado(etiqueta, msj);
    totalInformativos += clasificar(msj).informativos.length;
  }
}

if (vacias.length > 0) {
  console.log(
    `\nSin migrar aún (${vacias.length} hojas vacías, no fallan): ` +
      vacias.join(", "),
  );
}

const sufijoInformativos =
  totalInformativos > 0
    ? ` (+ ${totalInformativos} dato(s) de sitio pendientes de medir en obra, no bloquean)`
    : "";
console.log(
  totalPendientes === 0
    ? `\nOK: proyecto real del PPS sin pendientes de fichas técnicas${sufijoInformativos}`
    : `\nFALLO: ${totalPendientes} pendiente(s)${sufijoInformativos}`,
);
process.exit(totalPendientes === 0 ? 0 : 1);
