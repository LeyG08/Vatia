import { useMemo, useState } from "react";
import { useEditor, construirEstadoHoja, type DatosSimbolo } from "../lib/store";
import { obtenerSimbolo } from "../lib/libreria";
import { armarChecklist } from "../lib/checklist";
import { categoriaDeTipoAparato, etiquetaCategoriaAparato } from "../lib/categoriasAparato";

/**
 * PROTOTIPO E81 — legajo del proyecto (dirección 4 del set de
 * disposiciones).
 *
 * La columna izquierda deja de ser SOLO una lista de símbolos para
 * arrastrar y pasa a ser el índice del legajo: proyecto ▸ hojas ▸
 * categorías ▸ aparatos. Es lo que hace falta cuando el proyecto tiene
 * seis tableros y ochenta aparatos y las pestañas de hoja ya no alcanzan
 * para orientarse — hoy, para encontrar "el guardamotor del ventilador
 * del tablero 3", hay que acordarse en qué hoja estaba y buscarlo a ojo
 * sobre el plano.
 *
 * Clic en un aparato = cambiar a su hoja y seleccionarlo. Cada renglón
 * muestra su referencia IEC 61346 y, si le faltan datos de ficha, cuántos
 * — así el legajo también dice qué queda por documentar, sin abrir el
 * checklist.
 *
 * E81.2 — la jerarquía de tableros. Las hojas dejan de ser una lista
 * plana: cuelgan unas de otras según de qué circuito seccional nacieron
 * (`hojaPadreId`), que es como se organiza una instalación real —
 * tablero general, seccionales, sub-seccionales. Dos controles viven
 * acá porque acá es donde se ve la estructura:
 *
 *  - el tablero PRINCIPAL se elige a mano (el orden de las hojas no
 *    alcanza para saberlo: un proyecto puede empezar por un seccional),
 *    y es de donde cuelga todo lo demás;
 *  - cada tablero puede prender o apagar la creación automática de la
 *    hoja de sus seccionales, para los casos en que ese tablero lo
 *    documenta otro o todavía no se sabe.
 */

interface ItemAparato {
  nodoId: string;
  hojaId: string;
  referencia: string;
  nombre: string;
  categoria: string;
  pendientes: number;
}

function nombreDeNodo(codigoIec: string | undefined, atributos: Record<string, unknown>): string {
  const simbolo = codigoIec ? obtenerSimbolo(codigoIec) : null;
  if (simbolo) return simbolo.metadata.nombre;
  const tipo = atributos.tipo_aparato;
  return typeof tipo === "string" ? tipo.replace(/_/g, " ") : "Elemento";
}

function ArbolProyecto() {
  const proyecto = useEditor((s) => s.proyecto);
  const hojaActivaId = useEditor((s) => s.hojaActivaId);
  const nodosVivos = useEditor((s) => s.nodos);
  const cambiarHojaActiva = useEditor((s) => s.cambiarHojaActiva);
  const seleccionarNodos = useEditor((s) => s.seleccionarNodos);
  const nombreProyecto = useEditor((s) => s.nombreProyecto);
  const marcarTableroPrincipal = useEditor((s) => s.marcarTableroPrincipal);
  const setAutoSeccionales = useEditor((s) => s.setAutoSeccionales);
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());

  /* La hoja ACTIVA se lee del espejo en vivo (`nodos`), no de
   * `proyecto.hojas`: ahí el trabajo más reciente todavía no está
   * volcado y el árbol mostraría el estado viejo. */
  const porHoja = useMemo(() => {
    return proyecto.hojas.map((hoja) => {
      const esActiva = hoja.id === hojaActivaId;
      const estado = esActiva ? null : construirEstadoHoja(hoja);
      const nodos = esActiva
        ? nodosVivos.map((n) => ({
            id: n.id,
            data: n.data as Record<string, unknown>,
          }))
        : (estado?.nodos ?? []).map((n) => ({
            id: n.id,
            data: n.data as Record<string, unknown>,
          }));

      const problemas = esActiva
        ? armarChecklist(nodosVivos, useEditor.getState().conexiones, hoja.modo)
        : armarChecklist(estado!.nodos, estado!.conexiones, estado!.cfg.modo);
      const pendientesPorNodo = new Map<string, number>();
      for (const p of problemas) {
        if (p.esConexion) continue; // los cables cuelgan de la conexión, no de un aparato
        pendientesPorNodo.set(p.id, (pendientesPorNodo.get(p.id) ?? 0) + p.mensajes.length);
      }

      const aparatos: ItemAparato[] = [];
      for (const n of nodos) {
        const data = n.data as unknown as DatosSimbolo;
        if (data?.tipo !== "simbolo") continue;
        const atributos = (data.atributos ?? {}) as Record<string, unknown>;
        const tipo = typeof atributos.tipo_aparato === "string" ? atributos.tipo_aparato : undefined;
        const categoria = categoriaDeTipoAparato(tipo);
        const referencia =
          typeof atributos.referencia === "string" && atributos.referencia.trim() !== ""
            ? atributos.referencia.trim()
            : "—";
        aparatos.push({
          nodoId: n.id,
          hojaId: hoja.id,
          referencia,
          nombre: nombreDeNodo(data.codigo_iec, atributos),
          categoria: categoria ? etiquetaCategoriaAparato(categoria) : "Otros",
          pendientes: pendientesPorNodo.get(n.id) ?? 0,
        });
      }

      const grupos = new Map<string, ItemAparato[]>();
      for (const a of aparatos) {
        if (!grupos.has(a.categoria)) grupos.set(a.categoria, []);
        grupos.get(a.categoria)!.push(a);
      }
      for (const lista of grupos.values()) {
        lista.sort((a, b) => a.referencia.localeCompare(b.referencia, "es", { numeric: true }));
      }

      return {
        hoja,
        grupos: [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)),
        total: aparatos.length,
        pendientes: aparatos.reduce((t, a) => t + a.pendientes, 0),
      };
    });
  }, [proyecto.hojas, hojaActivaId, nodosVivos]);

  function plegar(clave: string) {
    setPlegadas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  function irA(item: ItemAparato) {
    if (item.hojaId !== hojaActivaId) cambiarHojaActiva(item.hojaId);
    // La selección se aplica después del cambio de hoja: el espejo de
    // nodos se rearma en ese mismo momento y seleccionar antes no
    // encontraría el id.
    setTimeout(() => seleccionarNodos([item.nodoId]), 0);
  }

  const totalPendientes = porHoja.reduce((t, h) => t + h.pendientes, 0);

  /* Orden jerárquico: primero el tablero principal (o, si nadie lo marcó
   * todavía, las hojas sin padre), y debajo de cada uno sus seccionales,
   * en profundidad. Una hoja cuyo padre se borró vuelve a la raíz en vez
   * de desaparecer del legajo. */
  const porId = new Map(porHoja.map((h) => [h.hoja.id, h]));
  const hijosDe = new Map<string, typeof porHoja>();
  const raices: typeof porHoja = [];
  for (const item of porHoja) {
    const padre = item.hoja.hojaPadreId;
    if (padre && porId.has(padre)) {
      if (!hijosDe.has(padre)) hijosDe.set(padre, []);
      hijosDe.get(padre)!.push(item);
    } else {
      raices.push(item);
    }
  }
  raices.sort((a, b) => Number(!!b.hoja.esTableroPrincipal) - Number(!!a.hoja.esTableroPrincipal));

  const ordenadas: { item: (typeof porHoja)[number]; nivel: number }[] = [];
  const visitar = (item: (typeof porHoja)[number], nivel: number) => {
    ordenadas.push({ item, nivel });
    if (plegadas.has(item.hoja.id)) return;
    for (const hijo of hijosDe.get(item.hoja.id) ?? []) visitar(hijo, nivel + 1);
  };
  for (const r of raices) visitar(r, 0);

  const hayPrincipal = porHoja.some((h) => h.hoja.esTableroPrincipal);

  return (
    <div className="arbol">
      <div className="arbol-raiz">
        <span className="arbol-raiz-nombre">{nombreProyecto || "Proyecto sin nombre"}</span>
        <span className="arbol-raiz-meta">
          {proyecto.hojas.length} hoja{proyecto.hojas.length === 1 ? "" : "s"}
          {totalPendientes > 0 ? ` · ${totalPendientes} sin documentar` : " · completo"}
        </span>
      </div>

      {!hayPrincipal && porHoja.length > 0 && (
        <p className="arbol-aviso">
          Ningún tablero está marcado como principal. Marcalo con el ícono ⌂
          para que el resto cuelgue de él.
        </p>
      )}

      {ordenadas.map(({ item: { hoja, grupos, total, pendientes }, nivel }) => {
        const plegadaHoja = plegadas.has(hoja.id);
        const autoOn = hoja.autoSeccionales !== false;
        return (
          <div
            key={hoja.id}
            className={`arbol-hoja${nivel > 0 ? " arbol-hoja-hija" : ""}`}
            style={{ ["--nivel" as string]: nivel }}
          >
            <div className={`arbol-fila-tablero${hoja.id === hojaActivaId ? " activa" : ""}`}>
              <button
                type="button"
                className="arbol-fila arbol-fila-hoja"
                onClick={() => {
                  if (hoja.id !== hojaActivaId) cambiarHojaActiva(hoja.id);
                  else plegar(hoja.id);
                }}
                title={`${hoja.nombre} — ${hoja.modo}${
                  nivel > 0 ? " — tablero seccional" : ""
                }`}
              >
                <span
                  className="arbol-flecha"
                  onClick={(e) => {
                    e.stopPropagation();
                    plegar(hoja.id);
                  }}
                >
                  {plegadaHoja ? "▸" : "▾"}
                </span>
                <span className="arbol-nombre">{hoja.nombre}</span>
                <span className="arbol-conteo">{total}</span>
                {pendientes > 0 && <span className="arbol-pendiente">{pendientes}</span>}
              </button>

              {/* Los dos controles de la jerarquía, en el renglón del
                * tablero: cuál es el principal, y si sus seccionales se
                * abren solos. */}
              <button
                type="button"
                className={`arbol-marca${hoja.esTableroPrincipal ? " puesta" : ""}`}
                onClick={() => marcarTableroPrincipal(hoja.id)}
                aria-pressed={!!hoja.esTableroPrincipal}
                title={
                  hoja.esTableroPrincipal
                    ? "Este es el tablero principal del proyecto"
                    : "Marcar como tablero principal"
                }
              >
                ⌂
              </button>
              <button
                type="button"
                className={`arbol-marca${autoOn ? " puesta" : ""}`}
                onClick={() => setAutoSeccionales(hoja.id, !autoOn)}
                aria-pressed={autoOn}
                title={
                  autoOn
                    ? "Al cargar un circuito seccional en esta hoja se crea sola la hoja de su tablero. Clic para desactivarlo."
                    : "La hoja de los tableros seccionales de esta hoja se crea a mano. Clic para que se cree sola."
                }
              >
                ⑂
              </button>
            </div>

            {!plegadaHoja &&
              grupos.map(([categoria, items]) => {
                const claveGrupo = `${hoja.id}::${categoria}`;
                const plegadoGrupo = plegadas.has(claveGrupo);
                return (
                  <div key={claveGrupo} className="arbol-grupo">
                    <button
                      type="button"
                      className="arbol-fila arbol-fila-grupo"
                      onClick={() => plegar(claveGrupo)}
                    >
                      <span className="arbol-flecha">{plegadoGrupo ? "▸" : "▾"}</span>
                      <span className="arbol-nombre">{categoria}</span>
                      <span className="arbol-conteo">{items.length}</span>
                    </button>
                    {!plegadoGrupo &&
                      items.map((item) => (
                        <button
                          key={item.nodoId}
                          type="button"
                          className="arbol-fila arbol-fila-aparato"
                          onClick={() => irA(item)}
                          title={`${item.nombre} — ir al plano`}
                        >
                          <span className="arbol-ref">{item.referencia}</span>
                          <span className="arbol-nombre">{item.nombre}</span>
                          {item.pendientes > 0 && (
                            <span
                              className="arbol-pendiente"
                              title={`${item.pendientes} dato(s) de ficha sin cargar`}
                            >
                              {item.pendientes}
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

export default ArbolProyecto;
