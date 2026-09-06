import { useEditor, construirEstadoHoja } from "../lib/store";
import { armarChecklist } from "../lib/checklist";
import type { ItemAccesorio } from "../lib/tipos";

/**
 * E81.2 — la columna izquierda del modo Emitir.
 *
 * Emitir es el momento en que el trabajo sale del editor y se convierte
 * en un legajo que alguien firma. Antes, lo último que se toca antes de
 * exportar —los materiales adicionales, esos ítems sin símbolo propio que
 * igual hay que comprar— estaba enterrado como una solapa de
 * "Configuración de hoja", que es donde nadie va cuando está por
 * imprimir. Acá viven en el costado, junto a la lista de lo que se va a
 * emitir, y el plano de la derecha hace de previsualización: es la misma
 * lámina que sale al PDF.
 *
 * La notificación no es un adorno: una lista de materiales incompleta se
 * descubre en la obra, cuando falta el terminal.
 */

function PanelEmitir() {
  const proyecto = useEditor((s) => s.proyecto);
  const hojaActivaId = useEditor((s) => s.hojaActivaId);
  const cambiarHojaActiva = useEditor((s) => s.cambiarHojaActiva);
  const hoja = useEditor((s) => s.hoja);
  const nombreHojaActiva = useEditor(
    (s) => s.proyecto.hojas.find((h) => h.id === s.hojaActivaId)?.nombre ?? "esta hoja",
  );
  const actualizarHoja = useEditor((s) => s.actualizarHoja);
  const nodosVivos = useEditor((s) => s.nodos);
  const conexionesVivas = useEditor((s) => s.conexiones);

  const accesorios: ItemAccesorio[] = hoja.accesorios ?? [];

  /* Una fila por hoja del proyecto: qué formato sale, y si le quedan
   * datos de ficha sin cargar (que el PDF igual deja pasar, pero
   * conviene saber antes de mandarlo a firmar). */
  const hojas = proyecto.hojas.map((h) => {
    const esActiva = h.id === hojaActivaId;
    const estado = esActiva ? null : construirEstadoHoja(h);
    const problemas = esActiva
      ? armarChecklist(nodosVivos, conexionesVivas, h.modo)
      : armarChecklist(estado!.nodos, estado!.conexiones, estado!.cfg.modo);
    return {
      hoja: h,
      pendientes: problemas.reduce((t, p) => t + p.mensajes.length, 0),
      accesorios: (h.accesorios ?? []).length,
    };
  });

  const totalPendientes = hojas.reduce((t, h) => t + h.pendientes, 0);
  const hojasSinAccesorios = hojas.filter((h) => h.accesorios === 0).length;

  function actualizarAccesorio(id: string, patch: Partial<ItemAccesorio>) {
    actualizarHoja({
      accesorios: accesorios.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }

  function agregarAccesorio() {
    actualizarHoja({
      accesorios: [
        ...accesorios,
        { id: `acc-${Date.now().toString(36)}`, descripcion: "", cantidad: 1 },
      ],
    });
  }

  function quitarAccesorio(id: string) {
    actualizarHoja({ accesorios: accesorios.filter((a) => a.id !== id) });
  }

  return (
    <div className="emitir">
      <section className="emitir-bloque">
        <h3>Lo que se va a emitir</h3>
        <p className="emitir-ayuda">
          Clic en una hoja para verla en la lámina de la derecha, que es tal
          cual sale al PDF.
        </p>
        <ul className="emitir-hojas">
          {hojas.map(({ hoja: h, pendientes }) => (
            <li key={h.id}>
              <button
                type="button"
                className={`emitir-hoja${h.id === hojaActivaId ? " activa" : ""}`}
                onClick={() => cambiarHojaActiva(h.id)}
              >
                <span className="emitir-hoja-nombre">{h.nombre}</span>
                <span className="emitir-hoja-formato">
                  {h.formato} {h.orientacion === "horizontal" ? "↔" : "↕"}
                </span>
                {pendientes > 0 && (
                  <span
                    className="arbol-pendiente"
                    title={`${pendientes} dato(s) de ficha sin cargar en esta hoja`}
                  >
                    {pendientes}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {totalPendientes > 0 && (
          <p className="emitir-alerta">
            {totalPendientes} dato{totalPendientes === 1 ? "" : "s"} de ficha
            técnica sin cargar en el proyecto. El PDF sale igual, pero el
            legajo va incompleto — revisalo en el modo Verificar.
          </p>
        )}
      </section>

      <section className="emitir-bloque">
        <h3>Materiales adicionales</h3>
        <p className="emitir-ayuda">
          Ítems sin símbolo propio en el plano —terminales, peines de conexión,
          bornera de distribución— que igual entran en la lista de materiales.
          Se cargan por hoja: estos son los de <b>{nombreHojaActiva}</b>.
        </p>

        {accesorios.length === 0 && (
          <p className="emitir-alerta">
            Esta hoja no tiene ningún material adicional cargado. Si el tablero
            lleva borneras, terminales o peines, no van a aparecer en la lista
            de materiales.
          </p>
        )}
        {accesorios.length > 0 && hojasSinAccesorios > 0 && (
          <p className="emitir-aviso">
            {hojasSinAccesorios} hoja{hojasSinAccesorios === 1 ? "" : "s"} del
            proyecto sin materiales adicionales cargados.
          </p>
        )}

        <div className="emitir-accesorios">
          {accesorios.map((a) => (
            <div key={a.id} className="accesorio-fila">
              <input
                className="accesorio-descripcion"
                placeholder="Descripción (ej.: Terminal punta de lanza 2,5 mm²)"
                value={a.descripcion}
                onChange={(e) => actualizarAccesorio(a.id, { descripcion: e.target.value })}
              />
              <input
                className="accesorio-cantidad"
                type="number"
                min={1}
                value={a.cantidad}
                aria-label="Cantidad"
                onChange={(e) =>
                  actualizarAccesorio(a.id, {
                    cantidad: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                  })
                }
              />
              <button
                type="button"
                className="accesorio-quitar"
                onClick={() => quitarAccesorio(a.id)}
                title="Quitar este material"
                aria-label="Quitar este material"
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="accesorio-agregar" onClick={agregarAccesorio}>
            + Agregar material
          </button>
        </div>
      </section>
    </div>
  );
}

export default PanelEmitir;
