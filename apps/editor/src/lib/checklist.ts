/**
 * CHECKLIST AEA (C5) — revisión NO bloqueante de fichas técnicas.
 *
 * Reglas acordadas (docs/estado-revision-aea.md):
 * - Símbolos: los campos con x-obligatorio del schema deben estar
 *   cargados; x-alguno-obligatorio exige al menos uno.
 * - Conductores: se valida POR CABLE (nunca por rol de conexión):
 *   cantidad/secciones/material/aislación/norma + coherencia entre las
 *   llaves de neutro/tierra y sus secciones.
 * - Los alimentadores y los sin_ficha_tecnica no llevan ficha.
 */
import type { Edge, Node } from "@xyflow/react";
import {
  algunoObligatorio,
  camposDeFamilia,
  type FamiliaAtributos,
  campoVisible,
} from "./esquemas";
import { obtenerSimbolo } from "./libreria";
import type { NodoData } from "./store";
import type { ModoHoja } from "./tipos";
import { calcularTopologia } from "./topologia";

export interface ProblemaElemento {
  /** id del nodo/conexión para poder seleccionarlo desde el panel */
  id: string;
  esConexion: boolean;
  etiqueta: string;
  mensajes: string[];
}

function vacio(v: unknown): boolean {
  return (
    v === undefined ||
    v === null ||
    v === "" ||
    (typeof v === "number" && !Number.isFinite(v))
  );
}

/** "curva_caracteristica" → "Curva caracteristica"; unidades bien escritas */
export function humanizarCampo(nombre: string): string {
  let t = nombre.replace(/_/g, " ");
  t = t.replace(/\bka$/i, "kA");
  t = t.replace(/\bkw$/i, "kW");
  t = t.replace(/\bhp$/i, "HP");
  t = t.replace(/\bmm2$/i, "mm²");
  t = t.replace(/\bv$/i, "V");
  t = t.replace(/\ba$/i, "A");
  t = t.replace(/^./, (c) => c.toUpperCase());
  return t;
}

/** Etiqueta humana de un símbolo: nombre + marca/modelo si hay */
function etiquetaNodo(nodo: Node<NodoData>): string {
  const data = nodo.data as NodoData;
  if (data.tipo === "alimentador") {
    return `Alimentador${data.origen ? ` desde ${data.origen}` : ""}`;
  }
  const simbolo = obtenerSimbolo(data.codigo_iec);
  const base = simbolo?.metadata.nombre ?? data.codigo_iec ?? "Símbolo";
  const attrs = data.atributos ?? {};
  const marcaModelo = [attrs.marca, attrs.modelo]
    .filter((v) => typeof v === "string" && v !== "")
    .join(" ");
  return marcaModelo ? `${base} · ${marcaModelo}` : base;
}

/** Campos obligatorios vacíos + reglas "al menos uno" (schema-driven) */
function problemasFicha(
  familia: FamiliaAtributos,
  attrs: Record<string, unknown>,
): string[] {
  if (familia === "sin_ficha_tecnica") return [];
  const msj: string[] = [];

  if (familia === "aparato" && vacio(attrs.tipo_aparato)) {
    return ["Elegí el tipo de aparato en el formulario."];
  }

  for (const c of camposDeFamilia(familia, attrs) ?? []) {
    // Un campo oculto por x-visible-si no se exige: pedirlo sería reclamar
    // algo que el formulario ni siquiera muestra.
    if (!campoVisible(c.esquema, attrs)) continue;
    if (c.obligatorio && vacio(attrs[c.nombre])) {
      msj.push(`Falta ${humanizarCampo(c.nombre)}.`);
    }
  }
  const alguno = algunoObligatorio(familia, attrs);
  if (alguno && alguno.every((k) => vacio(attrs[k]))) {
    msj.push(
      `Cargá al menos uno de: ${alguno.map(humanizarCampo).join(" / ")}.`,
    );
  }
  return msj;
}

/**
 * Validación POR CABLE de una conexión (familia conductor). Las secciones
 * del neutro/tierra se heredan de la fase cuando no se cargan aparte;
 * una conexión de SOLO neutro o solo tierra es válida y exige su sección.
 */
function problemasCable(a: Record<string, unknown>): string[] {
  const msj: string[] = [];
  const num = (k: string): number | undefined =>
    typeof a[k] === "number" ? (a[k] as number) : undefined;

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
    // Sin fases, cada línea presente necesita su propia sección
    if (neutro && !sNeutro) msj.push("Falta la sección del neutro.");
    if (tierra && !sTierra) msj.push("Falta la sección de la tierra.");
  }
  if (vacio(a.material)) msj.push("Falta material.");
  if (vacio(a.aislacion)) msj.push("Falta aislación.");
  if (vacio(a.norma_iram)) msj.push("Falta norma IRAM.");
  // Longitud y método de instalación son x-obligatorio en el schema (para
  // caída de tensión y corriente admisible), pero problemasCable() es
  // hardcodeado y no lee camposDeFamilia() para "conductor" — sin esto,
  // marcarlos obligatorios en el schema no los hacía advertir nunca.
  if (vacio(a.longitud_m)) msj.push("Falta la longitud del tramo.");
  if (vacio(a.metodo_instalacion)) msj.push("Falta el método de instalación.");

  // Coherencia llaves ↔ secciones
  if (!neutro && sNeutro) {
    msj.push("Hay sección de neutro cargada pero el neutro está apagado.");
  }
  if (!tierra && sTierra) {
    msj.push("Hay sección de tierra cargada pero la tierra está apagada.");
  }
  if (sFase) {
    if (sNeutro && sNeutro > sFase) {
      msj.push("La sección del neutro es mayor que la de fase.");
    }
    if (sTierra && sTierra > sFase) {
      msj.push("La sección de la tierra es mayor que la de fase.");
    }
  }
  return msj;
}

/** Arma el checklist completo de la hoja activa (nodos + conexiones) */
export function armarChecklist(
  nodos: Node[],
  conexiones: Edge[],
  modo: ModoHoja = "unifilar",
): ProblemaElemento[] {
  const nombresPorId = new Map<string, string>();
  for (const n of nodos) {
    nombresPorId.set(n.id, etiquetaNodo(n as Node<NodoData>));
  }

  const salida: ProblemaElemento[] = [];

  for (const n of nodos) {
    const data = n.data as NodoData;
    if (data.tipo === "alimentador") {
      // La alimentación se trata como un cable más + su origen
      const msj: string[] = [];
      if (typeof data.origen !== "string" || data.origen.trim() === "") {
        msj.push("Falta el origen (desde dónde viene).");
      }
      msj.push(...problemasCable(data.atributos ?? {}));
      if (msj.length > 0) {
        salida.push({
          id: n.id,
          esConexion: false,
          etiqueta: nombresPorId.get(n.id) ?? n.id,
          mensajes: msj,
        });
      }
      continue;
    }
    const familia = obtenerSimbolo(data.codigo_iec)?.metadata
      .familia_atributos as FamiliaAtributos | undefined;
    if (!familia) continue;
    const msj = problemasFicha(familia, data.atributos ?? {});
    if (msj.length > 0) {
      salida.push({
        id: n.id,
        esConexion: false,
        etiqueta: nombresPorId.get(n.id) ?? n.id,
        mensajes: msj,
      });
    }
  }

  for (const c of conexiones) {
    const attrs =
      (c.data?.atributosConductor as Record<string, unknown> | undefined) ??
      {};
    const msj = problemasCable(attrs);
    if (msj.length > 0) {
      const a = nombresPorId.get(String(c.source)) ?? "?";
      const b = nombresPorId.get(String(c.target)) ?? "?";
      salida.push({
        id: c.id,
        esConexion: true,
        etiqueta: `Conexión ${a} → ${b}`,
        mensajes: msj,
      });
    }
  }

  // Topología (Paso 4): elementos sin camino a ningún alimentador, y
  // ciclos del cableado (casi siempre un error de conexión). El check de
  // "huérfano" es un concepto de fuerza (huérfano = sin camino a un
  // alimentador, y en multifilar directamente no hay ninguno — ver
  // Paleta.tsx, el botón de alimentador se oculta ahí): en una hoja
  // multifilar marcaría CADA símbolo como huérfano, puro ruido. Los
  // ciclos sí se siguen chequeando: un lazo de cableado es un error de
  // conexión en cualquier modo.
  const topo = calcularTopologia(nodos as Node<NodoData>[], conexiones);
  if (modo !== "multifilar") {
    for (const id of topo.huerfanos) {
      salida.push({
        id,
        esConexion: false,
        etiqueta: nombresPorId.get(id) ?? id,
        mensajes: ["Sin conexión a ningún alimentador."],
      });
    }
  }
  for (const ciclo of topo.ciclos) {
    const etiquetas = ciclo.map((id) => nombresPorId.get(id) ?? id);
    salida.push({
      id: ciclo[0],
      esConexion: false,
      etiqueta: nombresPorId.get(ciclo[0]) ?? ciclo[0],
      mensajes: [`Ciclo de cableado: ${etiquetas.join(" → ")} → …`],
    });
  }

  return salida;
}
