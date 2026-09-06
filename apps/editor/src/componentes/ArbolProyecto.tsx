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

  return (
    <div className="arbol">
      <div className="arbol-raiz">
        <span className="arbol-raiz-nombre">{nombreProyecto || "Proyecto sin nombre"}</span>
        <span className="arbol-raiz-meta">
          {proyecto.hojas.length} hoja{proyecto.hojas.length === 1 ? "" : "s"}
          {totalPendientes > 0 ? ` · ${totalPendientes} sin documentar` : " · completo"}
        </span>
      </div>

      {porHoja.map(({ hoja, grupos, total, pendientes }) => {
        const plegadaHoja = plegadas.has(hoja.id);
        return (
          <div key={hoja.id} className="arbol-hoja">
            <button
              type="button"
              className={`arbol-fila arbol-fila-hoja${hoja.id === hojaActivaId ? " activa" : ""}`}
              onClick={() => {
                if (hoja.id !== hojaActivaId) cambiarHojaActiva(hoja.id);
                else plegar(hoja.id);
              }}
              title={`${hoja.nombre} — ${hoja.modo}`}
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
