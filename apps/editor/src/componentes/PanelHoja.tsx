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

        <h3>Rótulo</h3>
        <div className="panel-hoja-rotulo">
          <Campo
            etiqueta="Empresa"
            valor={hoja.rotulo.empresa}
            onChange={(v) => actualizar({ rotulo: { empresa: v } })}
          />
          <Campo
            etiqueta="Proyecto"
            valor={hoja.rotulo.proyecto}
            onChange={(v) => actualizar({ rotulo: { proyecto: v } })}
          />
          <Campo
            etiqueta="Ubicación"
            valor={hoja.rotulo.ubicacion}
            onChange={(v) => actualizar({ rotulo: { ubicacion: v } })}
          />
          <Campo
            etiqueta="Plano N°"
            valor={hoja.rotulo.numero}
            onChange={(v) => actualizar({ rotulo: { numero: v } })}
          />
          <Campo
            etiqueta="Escala"
            valor={hoja.rotulo.escala}
            onChange={(v) => actualizar({ rotulo: { escala: v } })}
          />
          <Campo
            etiqueta="Fecha"
            valor={hoja.rotulo.fecha}
            onChange={(v) => actualizar({ rotulo: { fecha: v } })}
          />
          <Campo
            etiqueta="Dibujó"
            valor={hoja.rotulo.dibujo}
            onChange={(v) => actualizar({ rotulo: { dibujo: v } })}
          />
          <Campo
            etiqueta="Revisión"
            valor={hoja.rotulo.revision}
            onChange={(v) => actualizar({ rotulo: { revision: v } })}
          />
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
