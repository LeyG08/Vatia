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
import {
  esVacio,
  humanizarCampo,
  mensajesDeCampos,
  problemasCable,
} from "../../../../libreria-simbolos/verificacion/reglasFicha.mjs";

export { humanizarCampo };

export interface ProblemaElemento {
  /** id del nodo/conexión para poder seleccionarlo desde el panel */
  id: string;
  esConexion: boolean;
  etiqueta: string;
  mensajes: string[];
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

/**
 * Campos obligatorios vacíos + reglas "al menos uno" (schema-driven).
 *
 * Resuelve el schema con esquemas.ts (JSON importado por Vite) y delega el
 * criterio de qué mensaje corresponde a reglasFicha.mjs, compartido con
 * scripts/verificar_proyecto_real.mjs.
 */
function problemasFicha(
  familia: FamiliaAtributos,
  attrs: Record<string, unknown>,
): string[] {
  if (familia === "sin_ficha_tecnica") return [];
  if (familia === "aparato" && esVacio(attrs.tipo_aparato)) {
    return ["Elegí el tipo de aparato en el formulario."];
  }

  const obligatorios = (camposDeFamilia(familia, attrs) ?? [])
    // Un campo oculto por x-visible-si no se exige: pedirlo sería reclamar
    // algo que el formulario ni siquiera muestra.
    .filter((c) => c.obligatorio && campoVisible(c.esquema, attrs))
    .map((c) => c.nombre);
  const alguno = algunoObligatorio(familia, attrs) ?? [];
  return mensajesDeCampos(obligatorios, alguno, attrs);
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
