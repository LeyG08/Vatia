import { useState } from "react";
import { useEditor, type DatosSimbolo } from "../lib/store";
import { camposDeFamilia, campoVisible, type CampoDescriptor } from "../lib/esquemas";
import { obtenerSimbolo } from "../lib/libreria";

/**
 * PROTOTIPO E81 — planilla de carga (dirección 6 del set de
 * disposiciones).
 *
 * El cuello de botella real de Vatia hoy no es dibujar: es completar las
 * fichas técnicas. En el proyecto del PPS hay 24 pendientes, y cargarlos
 * significa seleccionar 24 símbolos en el plano, uno por uno, y llenar un
 * globo flotante cada vez. Con una planilla se hace como se hace de
 * verdad: se agarran todos los interruptores termomagnéticos juntos y se
 * completa la columna "Curva de disparo" de arriba abajo, porque casi
 * siempre son todos iguales.
 *
 * Las columnas NO están escritas a mano: salen del schema del
 * `tipo_aparato` elegido, así que la planilla se mantiene sola cuando la
 * ficha técnica cambia. Se muestran los campos obligatorios (los que
 * advierte el Checklist AEA) más la referencia, que es la que vincula
 * bobina y contactos para la simulación.
 */

interface FilaAparato {
  nodoId: string;
  nombre: string;
  atributos: Record<string, unknown>;
}

function etiquetaTipo(tipo: string): string {
  return tipo.charAt(0).toUpperCase() + tipo.slice(1).replace(/_/g, " ");
}

function TablaAparatos() {
  const nodos = useEditor((s) => s.nodos);
  const tablaTipo = useEditor((s) => s.tablaTipo);
  const setTablaTipo = useEditor((s) => s.setTablaTipo);
  const setTablaAbierta = useEditor((s) => s.setTablaAbierta);
  const actualizarAtributosNodo = useEditor((s) => s.actualizarAtributosNodo);
  const seleccionarNodos = useEditor((s) => s.seleccionarNodos);
  const [soloIncompletos, setSoloIncompletos] = useState(false);

  /* Aparatos de la hoja activa, agrupados por tipo_aparato. Sin
   * `useMemo` a propósito: el mapa se arma mutándolo y la memoización
   * manual bloqueaba al compilador de React, que igual memoriza esto
   * solo. Una hoja tiene decenas de nodos, no miles. */
  const porTipo = (() => {
    const mapa = new Map<string, FilaAparato[]>();
    for (const n of nodos) {
      const data = n.data as unknown as DatosSimbolo;
      if (data?.tipo !== "simbolo") continue;
      const atributos = (data.atributos ?? {}) as Record<string, unknown>;
      const tipo = atributos.tipo_aparato;
      if (typeof tipo !== "string" || tipo === "") continue;
      if (!mapa.has(tipo)) mapa.set(tipo, []);
      mapa.get(tipo)!.push({
        nodoId: n.id,
        nombre: obtenerSimbolo(data.codigo_iec)?.metadata.nombre ?? tipo,
        atributos,
      });
    }
    return mapa;
  })();

  const tipos = [...porTipo.keys()].sort();
  const tipoActivo = tablaTipo && porTipo.has(tablaTipo) ? tablaTipo : (tipos[0] ?? null);

  /** Cuántos campos obligatorios le faltan a una fila. */
  function faltantesDe(fila: FilaAparato, campos: CampoDescriptor[]): number {
    return campos.filter((c) => {
      const v = fila.atributos[c.nombre];
      return c.obligatorio && (v === undefined || v === null || v === "");
    }).length;
  }

  const filas = tipoActivo ? (porTipo.get(tipoActivo) ?? []) : [];

  /* Las columnas salen del schema del tipo activo. Se toma la ficha del
   * primer aparato como referencia para resolver los campos con
   * `x-visible-si` (por ejemplo, "sección del neutro" solo aparece si el
   * cable lleva neutro): dentro de un mismo tipo esas condiciones casi
   * siempre coinciden, y si no, el campo igual se puede editar abriendo
   * la ficha completa del aparato. */
  const campos: CampoDescriptor[] = (() => {
    if (!tipoActivo) return [];
    const muestra = filas[0]?.atributos ?? { tipo_aparato: tipoActivo };
    const todos = camposDeFamilia("aparato", muestra) ?? [];
    return todos
      .filter((c) => campoVisible(c.esquema, muestra))
      .filter((c) => c.obligatorio || c.nombre === "referencia")
      .slice(0, 9);
  })();

  const visibles = soloIncompletos
    ? filas.filter((f) => faltantesDe(f, campos) > 0)
    : filas;

  function editar(fila: FilaAparato, campo: CampoDescriptor, valor: string | boolean) {
    let v: unknown = valor;
    if (typeof valor === "string") {
      if (valor === "") v = undefined;
      else if (campo.esquema.type === "number" || campo.esquema.type === "integer") {
        const n = Number(valor.replace(",", "."));
        v = Number.isFinite(n) ? n : undefined;
      }
    }
    const siguientes = { ...fila.atributos };
    if (v === undefined) delete siguientes[campo.nombre];
    else siguientes[campo.nombre] = v;
    actualizarAtributosNodo(fila.nodoId, siguientes);
  }

  const totalFaltantes = filas.reduce((t, f) => t + faltantesDe(f, campos), 0);

  return (
    <aside className="planilla">
      <header className="planilla-cabecera">
        <div>
          <h2>Planilla de carga</h2>
          <p className="planilla-ayuda">
            Una fila por aparato de esta hoja, una columna por campo obligatorio.
            Se completa de arriba abajo.
          </p>
        </div>
        <button
          type="button"
          className="planilla-cerrar"
          onClick={() => setTablaAbierta(false)}
          title="Cerrar la planilla"
          aria-label="Cerrar la planilla"
        >
          ✕
        </button>
      </header>

      {tipos.length === 0 ? (
        <p className="planilla-vacia">
          Esta hoja todavía no tiene aparatos con ficha técnica. Colocá alguno
          desde la librería y aparece acá.
        </p>
      ) : (
        <>
          <div className="planilla-tipos" role="tablist" aria-label="Tipo de aparato">
            {tipos.map((t) => {
              const lista = porTipo.get(t) ?? [];
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={t === tipoActivo}
                  className={`planilla-chip${t === tipoActivo ? " activo" : ""}`}
                  onClick={() => setTablaTipo(t)}
                >
                  {etiquetaTipo(t)}
                  <span className="planilla-chip-conteo">{lista.length}</span>
                </button>
              );
            })}
          </div>

          <div className="planilla-filtro">
            <label>
              <input
                type="checkbox"
                checked={soloIncompletos}
                onChange={(e) => setSoloIncompletos(e.target.checked)}
              />
              <span>Solo los incompletos</span>
            </label>
            <span className="planilla-estado">
              {totalFaltantes === 0
                ? "Sin datos pendientes"
                : `${totalFaltantes} dato${totalFaltantes === 1 ? "" : "s"} sin cargar`}
            </span>
          </div>

          <div className="planilla-grilla">
            <table>
              <thead>
                <tr>
                  <th className="col-aparato">Aparato</th>
                  {campos.map((c) => (
                    <th key={c.nombre} title={c.esquema.description ?? undefined}>
                      {c.title ?? c.nombre}
                      {c.obligatorio && <span className="obligatorio">*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((fila) => (
                  <tr key={fila.nodoId}>
                    <th scope="row" className="col-aparato">
                      <button
                        type="button"
                        className="planilla-ir"
                        onClick={() => seleccionarNodos([fila.nodoId])}
                        title="Seleccionarlo en el plano"
                      >
                        {typeof fila.atributos.referencia === "string" &&
                        fila.atributos.referencia.trim() !== ""
                          ? fila.atributos.referencia
                          : "—"}
                      </button>
                      <span className="planilla-nombre">{fila.nombre}</span>
                    </th>
                    {campos.map((c) => {
                      const valor = fila.atributos[c.nombre];
                      const vacio = valor === undefined || valor === null || valor === "";
                      const clase = c.obligatorio && vacio ? "celda falta" : "celda";
                      if (c.esquema.enum) {
                        return (
                          <td key={c.nombre} className={clase}>
                            <select
                              value={typeof valor === "string" ? valor : ""}
                              onChange={(e) => editar(fila, c, e.target.value)}
                            >
                              <option value="">—</option>
                              {c.esquema.enum.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }
                      if (c.esquema.type === "boolean") {
                        return (
                          <td key={c.nombre} className={clase}>
                            <input
                              type="checkbox"
                              checked={valor === true}
                              onChange={(e) => editar(fila, c, e.target.checked)}
                            />
                          </td>
                        );
                      }
                      const esNumero =
                        c.esquema.type === "number" || c.esquema.type === "integer";
                      return (
                        <td key={c.nombre} className={clase}>
                          <input
                            type={esNumero ? "number" : "text"}
                            value={valor === undefined || valor === null ? "" : String(valor)}
                            onChange={(e) => editar(fila, c, e.target.value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </aside>
  );
}

export default TablaAparatos;
