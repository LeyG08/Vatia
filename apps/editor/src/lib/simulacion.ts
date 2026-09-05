/**
 * Motor de simulación de circuito (E62, pedido original E47: "para
 * poder enviar la señal al contactor para activarse... dejar al
 * contactor con su bobina asociada"). Resuelve, a partir del grafo real
 * del proyecto (todas las hojas, no solo la activa), qué bobinas están
 * energizadas y qué contactos/polos conducen — el mismo tipo de cálculo
 * que hace un simulador CADe SIMU, con reglas propias porque acá el
 * circuito de fuerza (unifilar) y el de comando (multifilar) son hojas
 * separadas, vinculadas por `atributos.referencia` (ver lib/referencia.ts).
 *
 * Convención de rieles del comando (E62, reemplazada por E64): la hoja
 * multifilar no tiene símbolos dedicados de riel L/N — reusa la "barra"
 * ya existente (ver `barra.schema.json`, campo `tipo_barra:
 * "riel_multifilar"`). Cada riel declara su propio `funcion_riel`:
 * "fase_viva" (fuente, se pueden colocar tantas como fases haga falta —
 * L1, L2, L3, L4… sin límite, para soportar más de 3 fases), "neutro"
 * (retorno de la bobina) o "tierra" (solo documentación, no participa
 * del cálculo). E62 inicialmente infería la fase viva de "la barra que
 * recibe un alimentador", pero la hoja multifilar nunca tuvo alimentador
 * disponible en la Paleta (E17) — E64 lo reemplaza por esta marca
 * explícita, que además no depende de que exista una fuente externa: un
 * riel de comando se entiende directamente vivo, como en cualquier
 * diagrama de escalera real. Una barra SIN `funcion_riel` (barra de
 * fuerza, o un riel armado antes de E64) conserva la heurística vieja:
 * fuente si un alimentador de la hoja la alimenta, retorno si no. No es
 * una regla normativa, es una convención de dibujo de ESTE proyecto —
 * documentada acá y en HISTORIAL.md.
 *
 * Algoritmo, por iteración de punto fijo (necesario porque un contactor
 * puede autoenclavarse con su propio contacto auxiliar — el caso más
 * común de un arranque directo — lo que crea una dependencia circular
 * bobina→contacto→bobina que solo se resuelve iterando hasta que el
 * conjunto de bobinas energizadas deja de cambiar):
 *
 * 1. Con el conjunto de bobinas energizadas de la iteración anterior
 *    (que arranca en `estadoInicial` — ver más abajo por qué importa
 *    cuál se use) más el estado manual de pulsadores/selectores, se
 *    decide qué interruptores de 2 terminales están "cerrados" en cada
 *    hoja.
 * 2. Se arma una red de uniones (Union-Find) por hoja: cada conexión
 *    dibujada siempre conduce (no se modela un cable cortado); cada
 *    aparato interruptor cerrado une sus dos terminales; una barra une
 *    TODOS sus terminales entre sí (es un riel); una bobina NUNCA une
 *    sus dos terminales (es una carga, no un interruptor).
 * 3. Con esa red ya armada: un aparato "sumidero" de un solo terminal
 *    (motor, lámpara, sirena…) está activo si su red llega a una fuente
 *    (alimentador o barra-L). Una bobina está energizada si UNO de sus
 *    terminales llega a una fuente Y EL OTRO llega a una barra-N de la
 *    misma hoja.
 * 4. El nuevo conjunto de bobinas energizadas alimenta la siguiente
 *    vuelta. Si no cambió respecto de la anterior, es un punto fijo
 *    estable y se devuelve. Si no converge en `MAX_ITERACIONES` (muy
 *    raro salvo un circuito genuinamente oscilante, que este motor no
 *    pretende modelar), se devuelve el último estado con `estable: false`.
 *
 * **Por qué hace falta `estadoInicial` (memoria entre llamadas)**: un
 * autoenclavamiento es, por diseño, BIESTABLE — con el pulsador de
 * marcha soltado, tanto "el contactor sigue enclavado" como "el
 * contactor está abierto" son puntos fijos válidos del mismo circuito
 * (es la definición misma de un enclavamiento). Arrancar SIEMPRE la
 * iteración desde el conjunto vacío sesga la solución hacia "todo
 * apagado" y rompe el enclavamiento apenas se suelta el pulsador — que
 * es exactamente lo contrario de cómo se comporta un contactor real
 * (mecánicamente sigue energizado hasta que algo interrumpe SU propio
 * camino). Por eso `simular()` no reinventa el estado en cada llamada:
 * el que la usa en modo interactivo tiene que guardar el
 * `bobinasEnergizadas` que devuelve y pasarlo de vuelta como
 * `estadoInicial` en la siguiente llamada (después de que el usuario
 * suelte o accione otro pulsador) — así el punto fijo que gana es el
 * más cercano al estado físico anterior, no uno elegido a ciegas.
 *
 * Qué NO modela todavía (simplificaciones conscientes, no bugs):
 * - Protecciones (termomagnético, MCCB, guardamotor, diferencial,
 *   fusible, portafusible, térmico) se asumen SIEMPRE cerradas — no
 *   hay disparo por sobrecarga/cortocircuito ni un campo "disparado".
 * - `selector` no tiene un campo de tipo de contacto en el schema (un
 *   selector real tiene varios bloques de contacto independientes por
 *   posición) — no es simulable todavía, se trata como abierto.
 * - `temporizador` se resuelve como una bobina instantánea: no hay
 *   dimensión de tiempo (el retardo a la conexión no se simula).
 * - Un `contacto_auxiliar` con `tipo_contacto: "NA+NC"` u "otra" no es
 *   un interruptor de 2 terminales simple — se trata como abierto.
 * - Los nodos de familia "carga" (S00120, cargas finales del unifilar)
 *   todavía no se incluyen en el resultado — este motor solo resuelve
 *   familia "aparato" (interruptores, bobinas y sus sumideros). Ver
 *   HISTORIAL.md para el alcance real de esta primera etapa.
 */
import type { Hoja, NodoProyecto, Proyecto } from "./tipos";

/** Protecciones de fuerza: se asumen sanas (cerradas) — no hay todavía
 * un campo de "disparado" en ningún schema de aparato. */
const TIPOS_SIEMPRE_CERRADO = new Set([
  "interruptor_termomagnetico",
  "mccb_caja_moldeada",
  "guardamotor_termomagnetico",
  "guardamotor_magnetico",
  "interruptor_diferencial",
  "fusible",
  "portafusible",
  "rele_termico",
]);

/** Aparatos de 2 terminales que van en SERIE en el circuito de fuerza
 * pero no son interruptores: siempre pasan la energía de un lado al
 * otro. Esta simulación es cualitativa (energizado sí/no) y no modela
 * relación de transformación ni el circuito secundario de un TC, así
 * que ambos se tratan como conductor directo. */
const TIPOS_PASO_DIRECTO = new Set(["transformador", "transformador_corriente"]);

/** Contactos manuales: el usuario los acciona en modo simulación
 * (`manual`, ver `simular()`). "selector" queda afuera a propósito: el
 * schema no declara qué contacto cierra en qué posición. Exportado para
 * que la UI (NodoSimbolo.tsx) sepa qué tipos de aparato son clicables
 * en modo simulación, sin duplicar la lista.
 *
 * `sensor_proximidad` (E67) entra acá igual que `interruptor_posicion`:
 * los dos son contactos accionados por algo EXTERNO al circuito (una
 * leva que llega, un objeto que se acerca), no por mando eléctrico —
 * en el modo interactivo, el clic del usuario representa "el objeto
 * está ahí", no una orden de mando. */
export const TIPOS_CONTACTO_MANUAL = new Set([
  "pulsador",
  "interruptor_posicion",
  "pulsador_emergencia",
  "sensor_proximidad",
]);

/** Cargas (bobinas): nunca unen sus dos terminales, se resuelven por
 * separado como "energizada" o no. */
const TIPOS_BOBINA = new Set(["rele_auxiliar", "temporizador"]);

const MAX_ITERACIONES = 25;

export type ManualSimulacion = ReadonlySet<string>;

export interface ResultadoSimulacion {
  /** clave `${hojaId}:${nodoId}` → true si el aparato conduce (interruptor
   * cerrado) o está energizado (bobina) o recibe tensión (sumidero). */
  aparatos: Map<string, boolean>;
  /** referencias (IEC 61346) de las bobinas energizadas en el resultado final. */
  bobinasEnergizadas: Set<string>;
  /** clave `${hojaId}:${nodoId}` de un motor_trifasico con `referencia`
   * cargada → sentido de giro calculado (E64), a partir de cuál de los
   * dos contactores marcados `rol_reversor` con el mismo
   * `motor_asociado` está cerrado. Solo aparecen motores con al menos un
   * contactor reversor asociado — el resto no tiene sentido que calcular. */
  sentidoGiroPorMotor: Map<string, "adelante" | "atras" | "detenido">;
  iteraciones: number;
  /** false si no se alcanzó un punto fijo en MAX_ITERACIONES (circuito
   * oscilante — no se pretende modelar, se devuelve el último estado). */
  estable: boolean;
}

/** Union-Find con compresión de camino, sobre claves de terminal
 * `${nodoId}#${handle}`. */
class UnionFind {
  private padre = new Map<string, string>();

  make(clave: string): void {
    if (!this.padre.has(clave)) this.padre.set(clave, clave);
  }

  find(clave: string): string {
    this.make(clave);
    let raiz = clave;
    while (this.padre.get(raiz) !== raiz) raiz = this.padre.get(raiz)!;
    let actual = clave;
    while (this.padre.get(actual) !== raiz) {
      const siguiente = this.padre.get(actual)!;
      this.padre.set(actual, raiz);
      actual = siguiente;
    }
    return raiz;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.padre.set(ra, rb);
  }
}

function partirTerminal(direccion: string): [string, string] {
  const punto = direccion.indexOf(".");
  if (punto === -1) return [direccion, ""];
  return [direccion.slice(0, punto), direccion.slice(punto + 1)];
}

function tipoAparatoDe(nodo: NodoProyecto): string | null {
  const t = nodo.atributos?.tipo_aparato;
  return typeof t === "string" ? t : null;
}

function referenciaDe(nodo: NodoProyecto): string | null {
  const r = nodo.atributos?.referencia;
  return typeof r === "string" && r.trim() !== "" ? r.trim() : null;
}

/** Decide si un aparato de 2 terminales conduce (interruptor cerrado)
 * con el estado de bobinas de la vuelta ANTERIOR y el estado manual de
 * esta simulación. Devuelve `null` si el tipo no es un interruptor de
 * 2 terminales simulable (bobina, sumidero, o un caso no cubierto). */
function calcularCerrado(
  nodo: NodoProyecto,
  hojaId: string,
  bobinasEnergizadas: ReadonlySet<string>,
  manual: ManualSimulacion,
): boolean | null {
  const tipo = tipoAparatoDe(nodo);
  if (!tipo) return null;

  if (TIPOS_SIEMPRE_CERRADO.has(tipo) || TIPOS_PASO_DIRECTO.has(tipo)) return true;

  if (tipo === "contactor") {
    const ref = referenciaDe(nodo);
    return ref !== null && bobinasEnergizadas.has(ref);
  }

  if (tipo === "contacto_auxiliar") {
    const ref = referenciaDe(nodo);
    if (ref === null) return false;
    const energizada = bobinasEnergizadas.has(ref);
    const tipoContacto = nodo.atributos?.tipo_contacto;
    if (tipoContacto === "NA") return energizada;
    if (tipoContacto === "NC") return !energizada;
    return false; // "NA+NC"/"otra": no es un interruptor simple de 2 terminales
  }

  if (TIPOS_CONTACTO_MANUAL.has(tipo)) {
    const accionado = manual.has(`${hojaId}:${nodo.id}`);
    if (tipo === "pulsador_emergencia") return !accionado; // NC fijo: accionar ABRE
    const tipoContacto = nodo.atributos?.tipo_contacto;
    if (tipoContacto === "NA") return accionado;
    if (tipoContacto === "NC") return !accionado;
    return false;
  }

  return null;
}

interface RedHoja {
  find: (nodoId: string, handle: string) => string;
  terminales: Map<string, Set<string>>;
  esFuente: (rep: string) => boolean;
  esRetornoN: (rep: string) => boolean;
}

/** Arma la red eléctrica de UNA hoja para esta vuelta de iteración. */
function construirRed(
  hoja: Hoja,
  bobinasEnergizadas: ReadonlySet<string>,
  manual: ManualSimulacion,
): RedHoja {
  const uf = new UnionFind();
  const terminales = new Map<string, Set<string>>();
  const nodosPorId = new Map(hoja.nodos.map((n) => [n.id, n]));

  function clave(nodoId: string, handle: string): string {
    const k = `${nodoId}#${handle}`;
    uf.make(k);
    if (!terminales.has(nodoId)) terminales.set(nodoId, new Set());
    terminales.get(nodoId)!.add(handle);
    return k;
  }

  // El cable en sí siempre conduce — no se modela un cable cortado.
  for (const c of hoja.conexiones) {
    const [nA, hA] = partirTerminal(c.desde);
    const [nB, hB] = partirTerminal(c.hasta);
    uf.union(clave(nA, hA), clave(nB, hB));
  }

  for (const [nodoId, handles] of terminales) {
    const nodo = nodosPorId.get(nodoId);
    if (!nodo) continue;
    const arr = [...handles];

    if (nodo.tipo === "barra") {
      for (let i = 1; i < arr.length; i++) uf.union(clave(nodoId, arr[0]), clave(nodoId, arr[i]));
      continue;
    }
    if (nodo.tipo === "alimentador") continue; // es fuente por sí mismo, no necesita unirse internamente

    const tipo = tipoAparatoDe(nodo);
    if (tipo && TIPOS_BOBINA.has(tipo)) continue; // carga: nunca une sus terminales

    if (arr.length !== 2) {
      // No es un aparato de 2 terminales conocido con ambigüedad: si es
      // desconocido (sin tipo_aparato, ej. "sin_ficha_tecnica") se
      // asume conductor simple para no romper el resto de la red.
      if (!tipo) for (let i = 1; i < arr.length; i++) uf.union(clave(nodoId, arr[0]), clave(nodoId, arr[i]));
      continue;
    }

    if (!tipo) {
      // Sin tipo_aparato (ficha sin cargar todavía): conductor simple,
      // no hay forma de saber si sería un interruptor.
      uf.union(clave(nodoId, arr[0]), clave(nodoId, arr[1]));
      continue;
    }
    const cerrado = calcularCerrado(nodo, hoja.id, bobinasEnergizadas, manual);
    // `cerrado === null` = tipo reconocido pero no es un interruptor de
    // 2 terminales simulable (selector, rele_proteccion_tension, un
    // sumidero con 2 puntos de conexión…): se deja ABIERTO por
    // defecto — conservador, no inventa continuidad que no se puede
    // verificar.
    if (cerrado) uf.union(clave(nodoId, arr[0]), clave(nodoId, arr[1]));
  }

  const fuenteReps = new Set<string>();
  for (const nodo of hoja.nodos) {
    if (nodo.tipo === "alimentador") {
      for (const h of terminales.get(nodo.id) ?? []) fuenteReps.add(uf.find(clave(nodo.id, h)));
      continue;
    }
    // E64: un riel multifilar de "fase viva" es fuente por sí mismo, sin
    // depender de un alimentador — un circuito de comando no se
    // alimenta desde la red (no hay alimentador disponible en esa
    // hoja), se entiende que el riel YA está vivo. Se pueden colocar
    // tantos rieles de fase viva como haga falta (L1, L2, L3, L4…),
    // cada uno cuenta como fuente independiente.
    if (nodo.tipo === "barra" && nodo.atributos?.funcion_riel === "fase_viva") {
      for (const h of terminales.get(nodo.id) ?? []) fuenteReps.add(uf.find(clave(nodo.id, h)));
    }
  }

  const retornoReps = new Set<string>();
  for (const nodo of hoja.nodos) {
    if (nodo.tipo !== "barra") continue;
    const handles = terminales.get(nodo.id);
    if (!handles || handles.size === 0) continue;
    const rep = uf.find(clave(nodo.id, [...handles][0]));
    if (fuenteReps.has(rep)) continue;
    const funcionRiel = nodo.atributos?.funcion_riel;
    // Tierra (PE) no participa del lazo de mando L-N: no es fuente ni
    // retorno, solo documentación. Una barra sin `funcion_riel` (barra
    // de FUERZA, o un riel viejo de antes de E64) conserva la
    // heurística original: todo lo que no sea fuente es retorno.
    if (funcionRiel === "tierra") continue;
    retornoReps.add(rep);
  }

  return {
    find: (nodoId, handle) => uf.find(clave(nodoId, handle)),
    terminales,
    esFuente: (rep) => fuenteReps.has(rep),
    esRetornoN: (rep) => retornoReps.has(rep),
  };
}

/**
 * Simula el proyecto entero (todas las hojas) con el estado manual dado
 * de pulsadores/selectores/fines de carrera accionados. `manual` son
 * claves `${hojaId}:${nodoId}` — pensado para venir de un estado de UI
 * efímero (no se persiste en el archivo del proyecto).
 */
export function simular(
  proyecto: Proyecto,
  manual: ManualSimulacion = new Set(),
  estadoInicial: ReadonlySet<string> = new Set(),
): ResultadoSimulacion {
  let bobinasEnergizadas = new Set(estadoInicial);
  let aparatos = new Map<string, boolean>();
  let iteraciones = 0;
  let estable = false;

  for (let vuelta = 0; vuelta < MAX_ITERACIONES; vuelta++) {
    iteraciones = vuelta + 1;
    aparatos = new Map<string, boolean>();
    const nuevasBobinas = new Set<string>();

    for (const hoja of proyecto.hojas) {
      const red = construirRed(hoja, bobinasEnergizadas, manual);

      for (const nodo of hoja.nodos) {
        if (nodo.tipo === "alimentador" || nodo.tipo === "barra") continue;
        const tipo = tipoAparatoDe(nodo);
        if (!tipo) continue;
        const clave = `${hoja.id}:${nodo.id}`;
        const handles = [...(red.terminales.get(nodo.id) ?? [])];

        if (TIPOS_BOBINA.has(tipo)) {
          if (handles.length !== 2) {
            aparatos.set(clave, false);
            continue;
          }
          const repA = red.find(nodo.id, handles[0]);
          const repB = red.find(nodo.id, handles[1]);
          const energizada =
            (red.esFuente(repA) && red.esRetornoN(repB)) ||
            (red.esFuente(repB) && red.esRetornoN(repA));
          aparatos.set(clave, energizada);
          const ref = referenciaDe(nodo);
          if (energizada && ref !== null) nuevasBobinas.add(ref);
          continue;
        }

        const cerrado = calcularCerrado(nodo, hoja.id, bobinasEnergizadas, manual);
        if (cerrado !== null) {
          aparatos.set(clave, cerrado);
          continue;
        }

        // Sumidero genérico (motor, lámpara, sirena, instrumento…): vivo
        // si algún terminal suyo llega a una fuente.
        const activo = handles.some((h) => red.esFuente(red.find(nodo.id, h)));
        aparatos.set(clave, activo);
      }
    }

    if (nuevasBobinas.size === bobinasEnergizadas.size && [...nuevasBobinas].every((r) => bobinasEnergizadas.has(r))) {
      bobinasEnergizadas = nuevasBobinas;
      estable = true;
      break;
    }
    bobinasEnergizadas = nuevasBobinas;
  }

  const sentidoGiroPorMotor = calcularSentidoGiro(proyecto, aparatos);

  return { aparatos, bobinasEnergizadas, sentidoGiroPorMotor, iteraciones, estable };
}

/**
 * Sentido de giro (E64, pedido explícito: "que el motor lo muestre"): no
 * hace falta modelar terminales de fase en el motor ni rastrear qué fases
 * cruza cada contactor — alcanza con el mismo mecanismo de `referencia`
 * que ya vincula bobina↔contactos. Un arranque reversible se arma con DOS
 * contactores, cada uno marcado `rol_reversor: "adelante"|"atras"` y
 * `motor_asociado` con la referencia del motor: el que esté cerrado
 * define el sentido. Si están cerrados los dos a la vez (falla de
 * enclavamiento) o ninguno, se informa "detenido" — ambiguo a propósito,
 * nunca se inventa un sentido sin una single respuesta clara.
 */
function calcularSentidoGiro(
  proyecto: Proyecto,
  aparatos: ReadonlyMap<string, boolean>,
): Map<string, "adelante" | "atras" | "detenido"> {
  const reversoresPorMotor = new Map<string, { adelante?: string; atras?: string }>();
  for (const hoja of proyecto.hojas) {
    for (const nodo of hoja.nodos) {
      if (tipoAparatoDe(nodo) !== "contactor") continue;
      const rol = nodo.atributos?.rol_reversor;
      if (rol !== "adelante" && rol !== "atras") continue;
      const motorRef = nodo.atributos?.motor_asociado;
      if (typeof motorRef !== "string" || motorRef.trim() === "") continue;
      const entrada = reversoresPorMotor.get(motorRef.trim()) ?? {};
      entrada[rol] = `${hoja.id}:${nodo.id}`;
      reversoresPorMotor.set(motorRef.trim(), entrada);
    }
  }

  const resultado = new Map<string, "adelante" | "atras" | "detenido">();
  for (const hoja of proyecto.hojas) {
    for (const nodo of hoja.nodos) {
      if (tipoAparatoDe(nodo) !== "motor_trifasico") continue;
      const ref = referenciaDe(nodo);
      if (ref === null) continue;
      const reversores = reversoresPorMotor.get(ref);
      if (!reversores) continue;
      const adelante = reversores.adelante !== undefined && aparatos.get(reversores.adelante) === true;
      const atras = reversores.atras !== undefined && aparatos.get(reversores.atras) === true;
      resultado.set(
        `${hoja.id}:${nodo.id}`,
        adelante && !atras ? "adelante" : atras && !adelante ? "atras" : "detenido",
      );
    }
  }
  return resultado;
}
