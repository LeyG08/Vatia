import { Fragment, useState } from "react";
import { useEditor } from "../lib/store";
import { TAMANIOS_HOJA_MM } from "../lib/tipos";
import type { FormatoHoja, ItemAccesorio, ModoHoja, OrientacionHoja } from "../lib/tipos";

const FORMATOS = Object.keys(TAMANIOS_HOJA_MM) as FormatoHoja[];

const SECCIONES = [
  { id: "pagina", label: "Página", icono: "📐" },
  { id: "encabezado", label: "Encabezado y notas", icono: "📝" },
  { id: "rotulo", label: "Rótulo IRAM 4508", icono: "🏷️" },
  { id: "materiales", label: "Materiales adicionales", icono: "📦" },
] as const;
type SeccionId = (typeof SECCIONES)[number]["id"];

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
  const hayNodos = useEditor((s) => s.nodos.length > 0);
  const [seccion, setSeccion] = useState<SeccionId>("pagina");

  if (!abierto) return null;
  const [mmCorto, mmLargo] = TAMANIOS_HOJA_MM[hoja.formato];
  const mmW = hoja.orientacion === "horizontal" ? mmLargo : mmCorto;
  const mmH = hoja.orientacion === "horizontal" ? mmCorto : mmLargo;
  const rotulo = hoja.rotulo;

  const setRotulo = (patch: Partial<typeof rotulo>) =>
    actualizar({ rotulo: patch });

  /* ---- Fechas dd/mm/aaaa (ej.: 10/05/2026) ---- */

  /** Máscara mientras se escribe: solo dígitos, barras automáticas */
  function enmascararFecha(v: string): string {
    const d = v.replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  }

  /** ¿Es una fecha completa y real? */
  function fechaValida(v: string): boolean {
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return false;
    const [dd, mm, aaaa] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mm < 1 || mm > 12 || dd < 1) return false;
    const dias = new Date(aaaa, mm, 0).getDate();
    return dd <= dias;
  }

  const setResponsable = (i: number, campo: "fecha" | "nombre", v: string) => {
    const lista = rotulo.responsables.map((r, j) =>
      j === i ? { ...r, [campo]: v } : r,
    );
    setRotulo({ responsables: lista });
  };

  /* ---- Accesorios: ítems de la lista de materiales sin símbolo propio
   * (terminales, peines de conexión, bornera de distribución…) ---- */
  const accesorios = hoja.accesorios ?? [];
  const agregarAccesorio = () =>
    actualizar({
      accesorios: [
        ...accesorios,
        { id: crypto.randomUUID(), descripcion: "", cantidad: 1 },
      ],
    });
  const actualizarAccesorio = (id: string, cambios: Partial<ItemAccesorio>) =>
    actualizar({
      accesorios: accesorios.map((a) => (a.id === id ? { ...a, ...cambios } : a)),
    });
  const eliminarAccesorio = (id: string) =>
    actualizar({ accesorios: accesorios.filter((a) => a.id !== id) });

  return (
    <>
      <div className="modal-fondo" onClick={alternar} />
      <section
        className="panel-hoja panel-hoja--tabulado"
        role="dialog"
        aria-label="Configuración de hoja"
      >
        <h2>Configuración de hoja</h2>

        <div className="panel-hoja-layout">
          <nav className="panel-hoja-tabs" aria-label="Secciones de la hoja">
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={seccion === s.id ? "activo" : ""}
                aria-current={seccion === s.id}
                onClick={() => setSeccion(s.id)}
              >
                <span className="panel-hoja-tab-icono" aria-hidden="true">
                  {s.icono}
                </span>
                {s.label}
              </button>
            ))}
          </nav>

          <div className="panel-hoja-contenido">
            {seccion === "pagina" && (
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
                  Hoja: {mmW} × {mmH} mm.
                </p>

                <div className="panel-hoja-campo">
                  <span>Tipo de esquema</span>
                  <div className="orientacion-opciones">
                    {(["unifilar", "multifilar"] as ModoHoja[]).map((m) => {
                      const bloqueado = hayNodos && hoja.modo !== m;
                      return (
                        <button
                          key={m}
                          type="button"
                          className={hoja.modo === m ? "activo" : ""}
                          disabled={bloqueado}
                          onClick={() => actualizar({ modo: m })}
                          title={
                            bloqueado
                              ? "Esta hoja ya tiene símbolos del otro tipo — cambiar el esquema mezclaría fuerza y comando en la misma hoja. Movelos a otra hoja o borralos primero."
                              : m === "unifilar"
                                ? "Símbolos de fuerza (potencia)"
                                : "Símbolos de comando y control"
                          }
                        >
                          {m === "unifilar" ? "Unifilar" : "Multifilar"}
                        </button>
                      );
                    })}
                  </div>
                  {hayNodos && (
                    <p className="panel-hoja-ayuda">
                      No se puede cambiar mientras la hoja tenga símbolos —
                      mezclar fuerza y comando en la misma hoja no está
                      permitido.
                    </p>
                  )}
                </div>
              </div>
            )}

            {seccion === "encabezado" && (
              <>
                <h3>Encabezado del tablero</h3>
                <div className="panel-hoja-bloque">
                  <Campo
                    etiqueta="Tablero"
                    valor={hoja.tablero}
                    onChange={(v) => actualizar({ tablero: v })}
                  />
                </div>

                <h3>Notas del gabinete</h3>
                <div className="panel-hoja-bloque">
                  <Campo
                    etiqueta="Material del gabinete"
                    valor={hoja.notasGabinete.material}
                    onChange={(v) => actualizar({ notasGabinete: { material: v } })}
                  />
                  <Campo
                    etiqueta="Clase de aislación"
                    valor={hoja.notasGabinete.claseAislacion}
                    onChange={(v) =>
                      actualizar({ notasGabinete: { claseAislacion: v } })
                    }
                  />
                  <Campo
                    etiqueta="Personal apto para operar"
                    valor={hoja.notasGabinete.personalApto}
                    onChange={(v) =>
                      actualizar({ notasGabinete: { personalApto: v } })
                    }
                  />
                  <Campo
                    etiqueta="Grado de protección IP"
                    valor={hoja.notasGabinete.gradoProteccion}
                    onChange={(v) =>
                      actualizar({ notasGabinete: { gradoProteccion: v } })
                    }
                  />
                  <Campo
                    etiqueta="Barras o conductores interiores"
                    valor={hoja.notasGabinete.barrasOConductores}
                    onChange={(v) =>
                      actualizar({ notasGabinete: { barrasOConductores: v } })
                    }
                  />
                  <Campo
                    etiqueta="Reserva para el futuro"
                    valor={hoja.notasGabinete.reservaFutura}
                    onChange={(v) =>
                      actualizar({ notasGabinete: { reservaFutura: v } })
                    }
                  />
                </div>

                <h3>Nota de seguridad operativa</h3>
                <label className="panel-hoja-campo">
                  <span>Texto al pie de la hoja</span>
                  <textarea
                    rows={4}
                    value={hoja.notaSeguridad}
                    onChange={(e) => actualizar({ notaSeguridad: e.target.value })}
                    placeholder="NOTA DE SEGURIDAD OPERATIVA — SECCIONADORES FUSIBLES: …"
                  />
                </label>
              </>
            )}

            {seccion === "rotulo" && (
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
                          inputMode="numeric"
                          placeholder="dd/mm/aaaa"
                          value={r.fecha}
                          className={
                            r.fecha !== "" && !fechaValida(r.fecha) ? "invalido" : ""
                          }
                          onChange={(e) =>
                            setResponsable(i, "fecha", enmascararFecha(e.target.value))
                          }
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
            )}

            {seccion === "materiales" && (
              <>
                <p className="panel-hoja-ayuda">
                  Ítems sin símbolo propio en el plano — terminales, peines de
                  conexión, bornera de distribución, lo que haga falta. Se
                  suman a la lista de materiales del PDF (opcional al
                  exportar el proyecto completo).
                </p>
                <div className="panel-hoja-bloque panel-hoja-accesorios">
                  {accesorios.map((a) => (
                    <div key={a.id} className="accesorio-fila">
                      <input
                        className="accesorio-descripcion"
                        placeholder="Descripción (ej.: Terminal punta de lanza 2,5 mm²)"
                        value={a.descripcion}
                        onChange={(e) =>
                          actualizarAccesorio(a.id, { descripcion: e.target.value })
                        }
                      />
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className="accesorio-cantidad"
                        value={a.cantidad}
                        onChange={(e) =>
                          actualizarAccesorio(a.id, {
                            cantidad: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                          })
                        }
                      />
                      <input
                        className="accesorio-marca"
                        placeholder="Marca"
                        value={a.marca ?? ""}
                        onChange={(e) =>
                          actualizarAccesorio(a.id, { marca: e.target.value || undefined })
                        }
                      />
                      <input
                        className="accesorio-modelo"
                        placeholder="Modelo"
                        value={a.modelo ?? ""}
                        onChange={(e) =>
                          actualizarAccesorio(a.id, { modelo: e.target.value || undefined })
                        }
                      />
                      <button
                        type="button"
                        className="accesorio-quitar"
                        title="Quitar este accesorio"
                        onClick={() => eliminarAccesorio(a.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button type="button" className="accesorio-agregar" onClick={agregarAccesorio}>
                    + Agregar accesorio
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="panel-hoja-pie">
          <button type="button" onClick={alternar}>
            Cerrar
          </button>
        </footer>
      </section>
    </>
  );
}

export default PanelHoja;
