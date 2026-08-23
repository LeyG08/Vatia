import { useEditor } from "../lib/store";
import { PX_POR_MM, TAMANIOS_HOJA_MM, dimensionesHoja } from "../lib/tipos";
import type { FormatoHoja, OrientacionHoja, RotuloConfig } from "../lib/tipos";

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

const RESPONSABLES: Array<{
  key: "proyecto" | "dibujo" | "revision" | "aprobacion";
  etiqueta: string;
  campoNombre: keyof RotuloConfig;
  campoFecha: keyof RotuloConfig;
}> = [
  { key: "proyecto", etiqueta: "Proyectó", campoNombre: "proyectoNombre", campoFecha: "proyectoFecha" },
  { key: "dibujo", etiqueta: "Dibujó", campoNombre: "dibujoNombre", campoFecha: "dibujoFecha" },
  { key: "revision", etiqueta: "Revisó", campoNombre: "revisionNombre", campoFecha: "revisionFecha" },
  { key: "aprobacion", etiqueta: "Aprobó", campoNombre: "aprobacionNombre", campoFecha: "aprobacionFecha" },
];

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

        <h3>Rótulo — IRAM 4508</h3>

        <div className="panel-hoja-rotulo">
          <Campo
            etiqueta="Denominación"
            valor={hoja.rotulo.denominacion}
            onChange={(v) => actualizar({ rotulo: { denominacion: v } })}
          />
          <Campo
            etiqueta="Empresa (logo o sigla)"
            valor={hoja.rotulo.empresa}
            onChange={(v) => actualizar({ rotulo: { empresa: v } })}
          />
          <Campo
            etiqueta="Cliente"
            valor={hoja.rotulo.cliente}
            onChange={(v) => actualizar({ rotulo: { cliente: v } })}
          />
          <Campo
            etiqueta="N° de plano"
            valor={hoja.rotulo.numero}
            onChange={(v) => actualizar({ rotulo: { numero: v } })}
          />
          <Campo
            etiqueta="N° de plano del cliente"
            valor={hoja.rotulo.numeroCliente}
            onChange={(v) => actualizar({ rotulo: { numeroCliente: v } })}
          />
          <Campo
            etiqueta="Escala (método ISO (E))"
            valor={hoja.rotulo.escala}
            onChange={(v) => actualizar({ rotulo: { escala: v } })}
          />
          <Campo
            etiqueta="Tolerancias generales"
            valor={hoja.rotulo.tolerancias}
            onChange={(v) => actualizar({ rotulo: { tolerancias: v } })}
          />
          <Campo
            etiqueta="Nombre del archivo"
            valor={hoja.rotulo.archivo}
            onChange={(v) => actualizar({ rotulo: { archivo: v } })}
          />
        </div>

        <div className="panel-hoja-responsables">
          {RESPONSABLES.map(({ etiqueta, campoNombre, campoFecha }) => (
            <div key={etiqueta} className="panel-hoja-responsable">
              <strong>{etiqueta}</strong>
              <Campo
                etiqueta="Nombre"
                valor={String(hoja.rotulo[campoNombre])}
                onChange={(v) =>
                  actualizar({ rotulo: { [campoNombre]: v } })
                }
              />
              <Campo
                etiqueta="Fecha"
                valor={String(hoja.rotulo[campoFecha])}
                onChange={(v) =>
                  actualizar({ rotulo: { [campoFecha]: v } })
                }
              />
            </div>
          ))}
        </div>

        <footer className="panel-hoja-pie">
          <p>
            Enmarcado: margen izquierdo 20 mm (archivado), resto 10 mm.
          </p>
          <button type="button" onClick={alternar}>
            Cerrar
          </button>
        </footer>
      </section>
    </>
  );
}

export default PanelHoja;
