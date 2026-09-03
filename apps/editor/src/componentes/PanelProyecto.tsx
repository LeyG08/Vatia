import { useEditor } from "../lib/store";
import type { EsquemaPAT, Normativa } from "../lib/tipos";

const NORMATIVAS: Normativa[] = ["AEA", "IEC"];
const ESQUEMAS_PAT: EsquemaPAT[] = ["TT", "TN-S", "TN-C", "IT"];

function valorComoTexto(v: number | undefined): string {
  return v === undefined ? "" : String(v);
}

/**
 * Datos eléctricos base del proyecto (C41): normativa, tensión y esquema
 * de puesta a tierra, y fuente de cortocircuito. Antes de esto la tensión
 * estaba hardcodeada en 220/380 V dentro del formulario de carga; ahora
 * cualquier cálculo futuro (Iz, ΔU%, contactos indirectos) la lee de acá.
 */
function PanelProyecto() {
  const abierto = useEditor((s) => s.panelProyectoAbierto);
  const alternar = useEditor((s) => s.alternarPanelProyecto);
  const datos = useEditor((s) => s.proyecto.datosProyecto);
  const actualizar = useEditor((s) => s.actualizarDatosProyecto);

  if (!abierto) return null;

  return (
    <>
      <div className="modal-fondo" onClick={alternar} />
      <section className="panel-hoja" role="dialog" aria-label="Datos del proyecto">
        <h2>Datos del proyecto</h2>

        <div className="panel-hoja-bloque">
          <label className="panel-hoja-campo">
            <span>Normativa de cálculo</span>
            <select
              value={datos.normativa}
              onChange={(e) =>
                actualizar({ normativa: e.target.value as Normativa })
              }
            >
              {NORMATIVAS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <div className="panel-hoja-dos-col">
            <label className="panel-hoja-campo">
              <span>Tensión fase-neutro (V)</span>
              <input
                type="number"
                min={0}
                value={valorComoTexto(datos.tension_fase_v)}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value) || 0;
                  // Sistema trifásico equilibrado: U_línea = √3 · U_fase.
                  // Se actualizan las dos juntas — cargar una sola y dejar
                  // la otra desactualizada es peor que redondear.
                  actualizar({
                    tension_fase_v: v,
                    tension_linea_v: Math.round(v * Math.sqrt(3)),
                  });
                }}
              />
            </label>
            <label className="panel-hoja-campo">
              <span>Tensión fase-fase (V)</span>
              <input
                type="number"
                min={0}
                value={valorComoTexto(datos.tension_linea_v)}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value) || 0;
                  actualizar({
                    tension_linea_v: v,
                    tension_fase_v: Math.round(v / Math.sqrt(3)),
                  });
                }}
              />
            </label>
          </div>

          <label className="panel-hoja-campo">
            <span>Esquema de puesta a tierra</span>
            <select
              value={datos.esquema_pat}
              onChange={(e) =>
                actualizar({ esquema_pat: e.target.value as EsquemaPAT })
              }
            >
              {ESQUEMAS_PAT.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="panel-hoja-ayuda">
          La fuente de cortocircuito (Scc / Icc) ahora se carga por
          alimentador, en Hoja… → Fuente de cortocircuito de la hoja del
          alimentador principal — no es un dato único de todo el proyecto,
          porque cada alimentador puede venir de una red distinta.
        </p>

        <footer className="panel-hoja-pie">
          <button type="button" onClick={alternar}>
            Cerrar
          </button>
        </footer>
      </section>
    </>
  );
}

export default PanelProyecto;
