/**
 * TOPOLOGÍA (Paso 4) — recorre el grafo de la hoja activa: quién alimenta
 * a quién, qué queda huérfano o en ciclo, y cuánta potencia agregada ve
 * cada barra. Todavía NO hace cálculo eléctrico (Ib/Iz/Icc/ΔU%) — eso es
 * el paso siguiente, motor de cálculo, y depende de tablas normativas que
 * todavía no cargamos.
 *
 * Dirección del grafo: React Flow ya la garantiza. Cada punto de conexión
 * de un símbolo es "source" (type=source, rol "salida") o "target"
 * (type=target, rol "entrada"/"tierra") — ver NodoSimbolo.tsx:120. El
 * alimentador solo tiene un handle "salida" (source) y la barra tiene
 * handles source Y target en cada punto (la corriente entra por uno y
 * sale por varios). React Flow no deja conectar source↔source ni
 * target↔target, así que edge.source SIEMPRE es aguas arriba de
 * edge.target.
 */
import type { Edge, Node } from "@xyflow/react";
import { obtenerSimbolo } from "./libreria";
import type { DatosAlimentador, DatosSimbolo, NodoData } from "./store";

export interface ResultadoTopologia {
  /** Alimentadores con fases (fuente de potencia real, no PAT) */
  raicesPotencia: Set<string>;
  /** ids de alimentador (potencia o PAT) — todos son raíz de ALGO */
  raices: Set<string>;
  /** Nodos con camino desde algún alimentador (potencia o PAT) */
  alcanzables: Set<string>;
  /** Nodos sin camino a ningún alimentador */
  huerfanos: string[];
  /** Cada ciclo hallado, como lista de ids en el orden del recorrido */
  ciclos: string[][];
  /** id de barra → suma de potencia_utilizacion_va × ks de las cargas de su subárbol */
  potenciaBarraVa: Map<string, number>;
  /**
   * id de conexión → potencia que circula por ESE cable (VA), para el
   * motor de cálculo (Ib). Si el destino es una carga, es su potencia
   * NOMINAL (sin Ku/Ks: un circuito dedicado tiene que soportar su carga
   * completa, la diversidad no aplica a un circuito derivado, solo al
   * tronco que agrupa varios). Si el destino es una barra, se reusa
   * `potenciaBarraVa` (ahí sí corresponde Ku/Ks: es el punto de
   * agregación). Cualquier otro destino intermedio: suma sin diversificar
   * de las cargas aguas abajo (conservador ante la duda).
   */
  potenciaConexionVa: Map<string, number>;
  /**
   * id de conexión → ¿el tramo es trifásico? Si el destino es una carga
   * con `alimentacion` declarada, se usa ese dato; cualquier otro destino
   * (barra u otro aparato intermedio que agrega más de una carga) se
   * asume trifásico, el caso estándar de un alimentador de distribución.
   */
  esTrifasica: Map<string, boolean>;
}

function familiaDe(n: Node<NodoData>): string | undefined {
  const d = n.data;
  if (d.tipo === "barra") return "barra";
  if (d.tipo === "alimentador") return "alimentador";
  return obtenerSimbolo((d as DatosSimbolo).codigo_iec)?.metadata
    .familia_atributos;
}

function esAlimentadorDePotencia(n: Node<NodoData>): boolean {
  const d = n.data;
  return d.tipo === "alimentador" && (d as DatosAlimentador).fases === true;
}

function construirSalientes(conexiones: Edge[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of conexiones) {
    const s = String(c.source);
    const t = String(c.target);
    if (!m.has(s)) m.set(s, []);
    m.get(s)!.push(t);
  }
  return m;
}

/** BFS desde un conjunto de ids semilla, siguiendo "salientes" */
function recorrerDesde(
  semillas: Iterable<string>,
  salientes: Map<string, string[]>,
): Set<string> {
  const vistos = new Set<string>(semillas);
  const pila = [...vistos];
  while (pila.length > 0) {
    const actual = pila.pop()!;
    for (const vecino of salientes.get(actual) ?? []) {
      if (!vistos.has(vecino)) {
        vistos.add(vecino);
        pila.push(vecino);
      }
    }
  }
  return vistos;
}

/** DFS de 3 colores: reporta cada ciclo hallado una vez, como tramo de la pila */
function detectarCiclos(
  ids: string[],
  salientes: Map<string, string[]>,
): string[][] {
  const color = new Map<string, 0 | 1 | 2>();
  const pila: string[] = [];
  const ciclos: string[][] = [];

  function visitar(id: string): void {
    color.set(id, 1);
    pila.push(id);
    for (const vecino of salientes.get(id) ?? []) {
      const c = color.get(vecino) ?? 0;
      if (c === 0) {
        visitar(vecino);
      } else if (c === 1) {
        const inicio = pila.indexOf(vecino);
        ciclos.push(pila.slice(inicio));
      }
    }
    pila.pop();
    color.set(id, 2);
  }

  for (const id of ids) {
    if ((color.get(id) ?? 0) === 0) visitar(id);
  }
  return ciclos;
}

/**
 * Ks (0..1, default 1) aplicado sobre la potencia YA ajustada por Ku
 * (potencia_utilizacion_va, calculada en FormularioCarga/utilizacion.ts).
 * Si todavía no hay potencia_utilizacion_va cargada, cae a potencia_va.
 */
function potenciaAgregableDeCarga(a: Record<string, unknown>): number {
  const base =
    typeof a.potencia_utilizacion_va === "number"
      ? a.potencia_utilizacion_va
      : typeof a.potencia_va === "number"
        ? a.potencia_va
        : 0;
  const ks = typeof a.ks === "number" && a.ks >= 0 && a.ks <= 1 ? a.ks : 1;
  return base * ks;
}

/**
 * Suma la potencia agregable (Ku/Ks aplicados) de todas las cargas
 * alcanzables desde `id` sin cruzar hacia una barra — esa tiene su propio
 * total, calculado aparte para no sumarla dos veces. Corta ciclos con un
 * set de visitados propio de cada recorrido.
 */
function sumarPotenciaAgregableDesde(
  id: string,
  visitados: Set<string>,
  porId: Map<string, Node<NodoData>>,
  salientes: Map<string, string[]>,
): number {
  let total = 0;
  for (const vecino of salientes.get(id) ?? []) {
    if (visitados.has(vecino)) continue;
    visitados.add(vecino);
    const n = porId.get(vecino);
    if (!n) continue;
    const fam = familiaDe(n);
    if (fam === "barra") continue;
    if (fam === "carga") {
      total += potenciaAgregableDeCarga((n.data as DatosSimbolo).atributos ?? {});
    }
    total += sumarPotenciaAgregableDesde(vecino, visitados, porId, salientes);
  }
  return total;
}

/**
 * Para cada barra, suma la potencia agregable de TODAS las cargas de su
 * subárbol aguas abajo (a través de los aparatos intermedios que haga
 * falta), sin cruzar hacia otra barra — esa tiene su propio total.
 */
function calcularPotenciaBarras(
  nodos: Node<NodoData>[],
  salientes: Map<string, string[]>,
): Map<string, number> {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const resultado = new Map<string, number>();
  for (const n of nodos) {
    if (familiaDe(n) === "barra") {
      resultado.set(
        n.id,
        Math.round(sumarPotenciaAgregableDesde(n.id, new Set([n.id]), porId, salientes)),
      );
    }
  }
  return resultado;
}

/**
 * Potencia nominal (SIN Ku/Ks) de todas las cargas alcanzables desde `id`
 * sin cruzar hacia una barra. La usa el cable de un circuito derivado: ese
 * tramo tiene que soportar la carga completa, no una fracción diversificada
 * — la diversidad es una propiedad del punto donde varios circuitos se
 * agrupan, no de un circuito individual.
 */
function sumarPotenciaNominalDesde(
  id: string,
  visitados: Set<string>,
  porId: Map<string, Node<NodoData>>,
  salientes: Map<string, string[]>,
): number {
  let total = 0;
  for (const vecino of salientes.get(id) ?? []) {
    if (visitados.has(vecino)) continue;
    visitados.add(vecino);
    const n = porId.get(vecino);
    if (!n) continue;
    const fam = familiaDe(n);
    if (fam === "barra") continue;
    if (fam === "carga") {
      const p = (n.data as DatosSimbolo).atributos?.potencia_va;
      if (typeof p === "number") total += p;
    }
    total += sumarPotenciaNominalDesde(vecino, visitados, porId, salientes);
  }
  return total;
}

/** Ver `ResultadoTopologia.potenciaConexionVa` */
function calcularPotenciaConexiones(
  nodos: Node<NodoData>[],
  conexiones: Edge[],
  salientes: Map<string, string[]>,
  potenciaBarraVa: Map<string, number>,
): Map<string, number> {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const resultado = new Map<string, number>();
  for (const c of conexiones) {
    const t = String(c.target);
    const n = porId.get(t);
    if (!n) continue;
    const fam = familiaDe(n);
    if (fam === "barra") {
      const p = potenciaBarraVa.get(t);
      if (p !== undefined) resultado.set(c.id, p);
      continue;
    }
    if (fam === "carga") {
      const propia = (n.data as DatosSimbolo).atributos?.potencia_va;
      const base = typeof propia === "number" ? propia : 0;
      resultado.set(
        c.id,
        Math.round(base + sumarPotenciaNominalDesde(t, new Set([t]), porId, salientes)),
      );
      continue;
    }
    resultado.set(
      c.id,
      Math.round(sumarPotenciaNominalDesde(t, new Set([t]), porId, salientes)),
    );
  }
  return resultado;
}

/** Ver `ResultadoTopologia.esTrifasica` */
function calcularTrifasicaConexiones(
  nodos: Node<NodoData>[],
  conexiones: Edge[],
): Map<string, boolean> {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const resultado = new Map<string, boolean>();
  for (const c of conexiones) {
    const n = porId.get(String(c.target));
    if (n && familiaDe(n) === "carga") {
      const alimentacion = (n.data as DatosSimbolo).atributos?.alimentacion;
      resultado.set(c.id, alimentacion === "trifasica");
    } else {
      resultado.set(c.id, true);
    }
  }
  return resultado;
}

export function calcularTopologia(
  nodos: Node<NodoData>[],
  conexiones: Edge[],
): ResultadoTopologia {
  const salientes = construirSalientes(conexiones);
  const raicesPotencia = new Set(
    nodos.filter(esAlimentadorDePotencia).map((n) => n.id),
  );
  const raices = new Set(
    nodos.filter((n) => n.data.tipo === "alimentador").map((n) => n.id),
  );
  const alcanzables = recorrerDesde(raices, salientes);
  const huerfanos = nodos
    .map((n) => n.id)
    .filter((id) => !alcanzables.has(id));
  const ciclos = detectarCiclos(
    nodos.map((n) => n.id),
    salientes,
  );
  const potenciaBarraVa = calcularPotenciaBarras(nodos, salientes);
  const potenciaConexionVa = calcularPotenciaConexiones(
    nodos,
    conexiones,
    salientes,
    potenciaBarraVa,
  );
  const esTrifasica = calcularTrifasicaConexiones(nodos, conexiones);

  return {
    raicesPotencia,
    raices,
    alcanzables,
    huerfanos,
    ciclos,
    potenciaBarraVa,
    potenciaConexionVa,
    esTrifasica,
  };
}
