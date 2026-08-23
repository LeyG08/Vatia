import { Fragment } from "react";
import { useEditor } from "../lib/store";
import { PX_POR_MM, TAMANIOS_HOJA_MM, dimensionesHoja } from "../lib/tipos";
import type { FormatoHoja, OrientacionHoja } from "../lib/tipos";

const FORMATOS = Object.keys(TAMANIOS_HOJA_MM) as FormatoHoja[];

function Campo({
  etiqueta,
  valor,
  onChange,
  placeholder,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="panel-hoja-campo">
      <span>{etiqueta}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "—"}
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
  const rotulo = hoja.rotulo;

  const setRotulo = (patch: Partial<typeof rotulo>) =>
    actualizar({ rotulo: patch });

  const setResponsable = (i: number, campo: "fecha" | "nombre", v: string) => {
    const lista = rotulo.responsables.map((r, j) =>
      j === i ? { ...r, [campo]: v } : r,
    );
    setRotulo({ responsables: lista });
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
            valor={hoja.tablero}
            onChange={(v) => actualizar({ tablero: v })}
          />
          <p className="panel-hoja-dimension">
            Los alimentadores «Desde …» se agregan desde la paleta y quedan
            como nodos conectables sobre la hoja.
          </p>
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

        <h3>Rótulo IRAM 4508</h3>

        <div className="panel-hoja-bloque">
          <Campo
            etiqueta="Empresa"
            valor={rotulo.empresa}
            onChange={(v) => setRotulo({ empresa: v })}
          />
          <Campo
            etiqueta="Texto del logo (si no hay imagen)"
            valor={rotulo.logoTexto}
            onChange={(v) => setRotulo({ logoTexto: v })}
          />
          <Campo
            etiqueta="Cliente"
            valor={rotulo.cliente}
            onChange={(v) => setRotulo({ cliente: v })}
          />
          <Campo
            etiqueta="Localidad"
            valor={rotulo.localidad}
            onChange={(v) => setRotulo({ localidad: v })}
          />
          <Campo
            etiqueta="Denominación de lo representado"
            valor={rotulo.denominacion}
            onChange={(v) => setRotulo({ denominacion: v })}
          />
          <Campo
            etiqueta="Clave o número de lo representado"
            valor={rotulo.claveRepresentado}
            onChange={(v) => setRotulo({ claveRepresentado: v })}
          />
          <Campo
            etiqueta="Nombre del archivo informático"
            valor={rotulo.nombreArchivo}
            onChange={(v) => setRotulo({ nombreArchivo: v })}
          />
          <Campo
            etiqueta="Tolerancias generales"
            valor={rotulo.toleranciasGenerales}
            onChange={(v) => setRotulo({ toleranciasGenerales: v })}
            placeholder="±0,5 ISO 2768-mK"
          />

          <div className="panel-hoja-dos-col">
            <Campo
              etiqueta="Escala (vacío = S/E)"
              valor={rotulo.escala}
              onChange={(v) => setRotulo({ escala: v })}
              placeholder="1:50"
            />
            <label className="panel-hoja-campo">
              <span>Método ISO</span>
              <select
                value={rotulo.metodoIso}
                onChange={(e) =>
                  setRotulo({
                    metodoIso: e.target.value as "(E)" | "(A)" | "",
                  })
                }
              >
                <option value="(E)">(E)</option>
                <option value="(A)">(A)</option>
                <option value="">Sin método</option>
              </select>
            </label>
          </div>

          <div className="panel-hoja-campo">
            <span>Responsables (fecha — nombre)</span>
            <div className="panel-hoja-resp">
              {rotulo.responsables.map((r, i) => (
                <Fragment key={r.rol}>
                  <em>{r.rol}</em>
                  <input
                    placeholder="dd/mm/aa"
                    value={r.fecha}
                    onChange={(e) => setResponsable(i, "fecha", e.target.value)}
                  />
                  <input
                    placeholder="Nombre y apellido"
                    value={r.nombre}
                    onChange={(e) => setResponsable(i, "nombre", e.target.value)}
                  />
                </Fragment>
              ))}
            </div>
          </div>

          <div className="panel-hoja-dos-col">
            <Campo
              etiqueta="N° de plano"
              valor={rotulo.numeroPlano}
              onChange={(v) => setRotulo({ numeroPlano: v })}
            />
            <Campo
              etiqueta="N° de plano del cliente"
              valor={rotulo.numeroPlanoCliente}
              onChange={(v) => setRotulo({ numeroPlanoCliente: v })}
            />
          </div>
          <Campo
            etiqueta="Paginación"
            valor={rotulo.paginacion}
            onChange={(v) => setRotulo({ paginacion: v })}
            placeholder="1/1"
          />
        </div>

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
