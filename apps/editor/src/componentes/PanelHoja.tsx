import { useEditor } from "../lib/store";
import { PX_POR_MM, TAMANIOS_HOJA_MM, dimensionesHoja } from "../lib/tipos";
import type { FormatoHoja, OrientacionHoja } from "../lib/tipos";

const FORMATOS = Object.keys(TAMANIOS_HOJA_MM) as FormatoHoja[];

function Campo({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="panel-hoja-campo">
      <span>{etiqueta}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
      />
    </label>
  );
}

function PanelHoja() {
  const abierto = useEditor((s) => s.panelHojaAbierto);
  const alternar = useEditor((s) => s.alternarPanelHoja);
  const hoja = useEditor((s) => s.hoja);
  const actualizar = useEditor((s) => s.actualizarHoja);

  if (!abierto) return null;
  const { pxW, pxH } = dimensionesHoja(hoja);
  const [mmCorto, mmLargo] = TAMANIOS_HOJA_MM[hoja.formato];
  const mmW = hoja.orientacion === "horizontal" ? mmLargo : mmCorto;
  const mmH = hoja.orientacion === "horizontal" ? mmCorto : mmLargo;

  const setAlimentador = (i: number, v: string) => {
    const lista = [...hoja.encabezado.alimentadores];
    lista[i] = v;
    actualizar({ encabezado: { alimentadores: lista } });
  };

  return (
    <>
      <div className="modal-fondo" onClick={alternar} />
      <section className="panel-hoja" role="dialog" aria-label="Configuración de hoja">
        <h2>Configuración de hoja</h2>

        <div className="panel-hoja-bloque">
          <label className="panel-hoja-campo">
            <span>Formato (serie A)</span>
            <select
              value={hoja.formato}
              onChange={(e) =>
                actualizar({ formato: e.target.value as FormatoHoja })
              }
            >
              {FORMATOS.map((f) => (
                <option key={f} value={f}>
                  {f} — {TAMANIOS_HOJA_MM[f][0]}×{TAMANIOS_HOJA_MM[f][1]} mm
                </option>
              ))}
            </select>
          </label>

          <div className="panel-hoja-campo">
            <span>Orientación</span>
            <div className="orientacion-opciones">
              {(["horizontal", "vertical"] as OrientacionHoja[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  className={hoja.orientacion === o ? "activo" : ""}
                  onClick={() => actualizar({ orientacion: o })}
                >
                  {o === "horizontal" ? "▭ Horizontal" : "▯ Vertical"}
                </button>
              ))}
            </div>
          </div>

          <p className="panel-hoja-dimension">
            Hoja: {mmW} × {mmH} mm → {(pxW / PX_POR_MM).toFixed(0)}×
            {(pxH / PX_POR_MM).toFixed(0)} mm en pantalla a{" "}
            {PX_POR_MM} px/mm.
          </p>
        </div>

        <h3>Encabezado del tablero</h3>

        <div className="panel-hoja-bloque">
          <Campo
            etiqueta="Tablero"
            valor={hoja.encabezado.tablero}
            onChange={(v) => actualizar({ encabezado: { tablero: v } })}
          />

          <div className="panel-hoja-campo">
            <span>Alimentadores</span>
            {hoja.encabezado.alimentadores.map((a, i) => (
              <div key={i} className="panel-hoja-item">
                <input
                  value={a}
                  onChange={(e) => setAlimentador(i, e.target.value)}
                  placeholder="Desde …"
                />
                <button
                  type="button"
                  onClick={() =>
                    actualizar({
                      encabezado: {
                        alimentadores:
                          hoja.encabezado.alimentadores.filter(
                            (_, j) => j !== i,
                          ),
                      },
                    })
                  }
                  aria-label={`Quitar ${a || "alimentador"}`}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="panel-hoja-agregar"
              onClick={() =>
                actualizar({
                  encabezado: {
                    alimentadores: [...hoja.encabezado.alimentadores, ""],
                  },
                })
              }
            >
              + Agregar alimentador
            </button>
          </div>
        </div>

        <h3>Notas del gabinete</h3>

        <label className="panel-hoja-campo">
          <span>Una nota por renglón (se dibujan arriba a la izquierda)</span>
          <textarea
            rows={6}
            value={hoja.notasGabinete.join("\n")}
            onChange={(e) =>
              actualizar({ notasGabinete: e.target.value.split("\n") })
            }
            placeholder={"Gabinete o armazón metálico autoportante\nIP00 …"}
          />
        </label>

        <h3>Nota de seguridad operativa</h3>

        <label className="panel-hoja-campo">
          <span>Texto al pie de la hoja; vacío si la lámina no lo lleva</span>
          <textarea
            rows={4}
            value={hoja.notaSeguridad}
            onChange={(e) => actualizar({ notaSeguridad: e.target.value })}
            placeholder="NOTA DE SEGURIDAD OPERATIVA — SECCIONADORES FUSIBLES: …"
          />
        </label>

        <footer className="panel-hoja-pie">
          <p>Enmarcado: margen izquierdo 25 mm (archivado), resto 10 mm.</p>
          <button type="button" onClick={alternar}>
            Cerrar
          </button>
        </footer>
      </section>
    </>
  );
}

export default PanelHoja;
