import { Fragment, useState } from "react";
import { useEditor } from "../lib/store";
import { TAMANIOS_HOJA_MM } from "../lib/tipos";
import type { FormatoHoja, ModoHoja, OrientacionHoja } from "../lib/tipos";

const FORMATOS = Object.keys(TAMANIOS_HOJA_MM) as FormatoHoja[];

const SECCIONES = [
  { id: "pagina", label: "Página", icono: "📐" },
  { id: "encabezado", label: "Encabezado y notas", icono: "📝" },
  { id: "rotulo", label: "Rótulo IRAM 4508", icono: "🏷️" },
  { id: "cortocircuito", label: "Fuente de cortocircuito", icono: "⚡" },

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
  const hojaActivaId = useEditor((s) => s.hojaActivaId);
  const renombrarHoja = useEditor((s) => s.renombrarHoja);
  const nombreHoja = useEditor(
    (s) => s.proyecto.hojas.find((h) => h.id === s.hojaActivaId)?.nombre ?? "",
  );
  /* La fuente de cortocircuito solo tiene sentido en la hoja del tablero
   * PRINCIPAL: una hoja seccional cuelga de un circuito ya existente y no
   * declara su propia red (E39).
   *
   * E81.2 — el usuario nunca elige "este alimentador es principal o
   * seccional": se deduce de la estructura. Si hay un tablero marcado
   * como principal en el legajo, es ese; si nadie lo marco todavia, vale
   * la regla vieja (cualquier hoja raiz, sin `hojaPadreId`), porque en un
   * proyecto de una sola hoja marcar el principal seria ceremonia
   * inutil. */
  const esAlimentadorPrincipal = useEditor((s) => {
    const activa = s.proyecto.hojas.find((h) => h.id === s.hojaActivaId);
    if (!activa) return false;
    const marcado = s.proyecto.hojas.find((h) => h.esTableroPrincipal);
    if (marcado) return marcado.id === activa.id;
    return !activa.hojaPadreId;
  });
  const [seccion, setSeccion] = useState<SeccionId>("pagina");
  // Si la hoja activa cambió y ya no es la del alimentador principal,
  // no mostrar la pestaña de cortocircuito seleccionada (quedaría
  // vacía) — se deriva en el render en vez de sincronizar con un efecto.
  const seccionMostrada: SeccionId =
    seccion === "cortocircuito" && !esAlimentadorPrincipal ? "pagina" : seccion;

  if (!abierto) return null;
  const [mmCorto, mmLargo] = TAMANIOS_HOJA_MM[hoja.formato];
  const mmW = hoja.orientacion === "horizontal" ? mmLargo : mmCorto;
  const mmH = hoja.orientacion === "horizontal" ? mmCorto : mmLargo;
  const rotulo = hoja.rotulo;
  const fuenteCc = hoja.fuente_cortocircuito ?? {};

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

  /* E82 — mientras la hoja siga con su nombre generico ("Hoja 3"),
   * ponerle nombre al tablero tambien la renombra: es el mismo tablero, y
   * nadie quiere escribir dos veces lo mismo. Si el usuario ya la
   * renombro a mano, no se le toca. */
  const cambiarNombreTablero = (v: string) => {
    actualizar({ tablero: v });
    if (/^Hoja \d+$/.test(nombreHoja) && v.trim() !== "") renombrarHoja(hojaActivaId, v);
  };

  const setResponsable = (i: number, campo: "fecha" | "nombre", v: string) => {
    const lista = rotulo.responsables.map((r, j) =>
      j === i ? { ...r, [campo]: v } : r,
    );
    setRotulo({ responsables: lista });
  };


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
            {SECCIONES.map((s) => {
              const bloqueada = s.id === "cortocircuito" && !esAlimentadorPrincipal;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={seccionMostrada === s.id ? "activo" : ""}
                  aria-current={seccionMostrada === s.id}
                  disabled={bloqueada}
                  title={
                    bloqueada
                      ? "Esta hoja cuelga de otro tablero — la fuente de cortocircuito se carga en la hoja del alimentador principal (la hoja raíz)."
                      : undefined
                  }
                  onClick={() => setSeccion(s.id)}
                >
                  <span className="panel-hoja-tab-icono" aria-hidden="true">
                    {s.icono}
                  </span>
                  {s.label}
                </button>
              );
            })}
          </nav>

          <div className="panel-hoja-contenido">
            {seccionMostrada === "pagina" && (
              <div className="panel-hoja-bloque">
                {/* E82 — el nombre del tablero se pregunta ACA, primero.
                  * Es el dato que define la hoja (se dibuja arriba del
                  * recuadro) y no pertenece al rotulo: el rotulo lleva
                  * datos del PROYECTO —empresa, cliente, responsables— y
                  * se hereda una sola vez. Antes estaba en "Encabezado y
                  * notas", tres secciones mas abajo, asi que una hoja
                  * recien creada salia con el encabezado vacio. */}
                <label className="panel-hoja-campo">
                  <span>Nombre del tablero</span>
                  <input
                    value={hoja.tablero}
                    placeholder="TGBT, TABLERO DE BOMBAS…"
                    onChange={(e) => cambiarNombreTablero(e.target.value)}
                  />
                </label>
                <p className="panel-hoja-ayuda">
                  Se dibuja arriba del recuadro y encabeza esta hoja.
                </p>

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

            {seccionMostrada === "encabezado" && (
              <>
                {/* E82 — el nombre del tablero se movio a la seccion
                  * "Pagina": es lo primero que se pregunta al crear la
                  * hoja, no un dato mas del encabezado. */}
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

            {seccionMostrada === "rotulo" && (
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
                {/* E81.2 — la denominación y el nombre de la hoja son lo
                  * mismo escrito dos veces: la pestaña dice "Tablero de
                  * bombas" y el rótulo del plano tiene que decir eso. Se
                  * sincroniza sola al renombrar la hoja; se apaga para
                  * los planos cuya denominación normalizada no coincide
                  * con el nombre de trabajo. */}
                <label className="panel-hoja-check">
                  <input
                    type="checkbox"
                    checked={hoja.tituloSigueALaHoja !== false}
                    onChange={(e) => actualizar({ tituloSigueALaHoja: e.target.checked })}
                  />
                  <span>
                    Seguir el nombre de la hoja al renombrarla
                  </span>
                </label>
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

            {seccionMostrada === "cortocircuito" && esAlimentadorPrincipal && (
              <div className="panel-hoja-bloque">
                <p className="panel-hoja-ayuda">
                  Datos de la acometida al tablero principal. De acá salen
                  las dos corrientes que hay que verificar: la <b>Icc
                  máxima</b> en bornes, que fija el poder de corte mínimo
                  de las protecciones, y la <b>Icc mínima</b> en el punto
                  más lejano, que dice si la protección llega a despejar
                  una falla al final de la línea. Esta hoja es el tablero
                  principal del proyecto: las hojas de tableros
                  seccionales no tienen esta sección, heredan el recorrido
                  del alimentador del que cuelgan.
                </p>

                <div className="panel-hoja-campo">
                  <span>Origen de la alimentación</span>
                  <div className="orientacion-opciones">
                    {(["red", "transformador"] as const).map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={(fuenteCc.origen ?? "red") === o ? "activo" : ""}
                        onClick={() => actualizar({ fuente_cortocircuito: { origen: o } })}
                      >
                        {o === "red" ? "Red pública" : "Transformador propio"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="panel-hoja-dos-col">
                  <label className="panel-hoja-campo">
                    <span>Potencia de cortocircuito Scc (MVA)</span>
                    <input
                      type="number"
                      min={0}
                      value={fuenteCc.scc_mva ?? ""}
                      onChange={(e) =>
                        actualizar({
                          fuente_cortocircuito: {
                            scc_mva:
                              e.target.value === ""
                                ? undefined
                                : Number.parseFloat(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="panel-hoja-campo">
                    <span>Corriente de cortocircuito Icc (kA)</span>
                    <input
                      type="number"
                      min={0}
                      value={fuenteCc.icc_ka ?? ""}
                      onChange={(e) =>
                        actualizar({
                          fuente_cortocircuito: {
                            icc_ka:
                              e.target.value === ""
                                ? undefined
                                : Number.parseFloat(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </div>

                {(fuenteCc.origen ?? "red") === "transformador" && (
                  <div className="panel-hoja-dos-col">
                    <label className="panel-hoja-campo">
                      <span>Potencia del transformador Sn (kVA)</span>
                      <input
                        type="number"
                        min={0}
                        value={fuenteCc.trafo_sn_kva ?? ""}
                        onChange={(e) =>
                          actualizar({
                            fuente_cortocircuito: {
                              trafo_sn_kva:
                                e.target.value === ""
                                  ? undefined
                                  : Number.parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label className="panel-hoja-campo">
                      <span>Tensión de cortocircuito ucc (%)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={fuenteCc.trafo_ucc_pct ?? ""}
                        onChange={(e) =>
                          actualizar({
                            fuente_cortocircuito: {
                              trafo_ucc_pct:
                                e.target.value === ""
                                  ? undefined
                                  : Number.parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                )}

                <h3>Acometida hasta el tablero</h3>
                <p className="panel-hoja-ayuda">
                  La impedancia de este tramo es lo que hace caer la Icc
                  entre el origen y el tablero: sin distancia y sección no
                  hay Icc mínima que calcular.
                </p>
                <div className="panel-hoja-dos-col">
                  <label className="panel-hoja-campo">
                    <span>
                      Distancia desde{" "}
                      {(fuenteCc.origen ?? "red") === "transformador"
                        ? "el transformador"
                        : "el punto de entrega"}{" "}
                      (m)
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={fuenteCc.distancia_m ?? ""}
                      onChange={(e) =>
                        actualizar({
                          fuente_cortocircuito: {
                            distancia_m:
                              e.target.value === ""
                                ? undefined
                                : Number.parseFloat(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="panel-hoja-campo">
                    <span>Sección de la acometida (mm²)</span>
                    <input
                      type="number"
                      min={0}
                      value={fuenteCc.seccion_acometida_mm2 ?? ""}
                      onChange={(e) =>
                        actualizar({
                          fuente_cortocircuito: {
                            seccion_acometida_mm2:
                              e.target.value === ""
                                ? undefined
                                : Number.parseFloat(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <div className="panel-hoja-campo">
                  <span>Material de la acometida</span>
                  <div className="orientacion-opciones">
                    {(["Cu", "Al"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={(fuenteCc.material_acometida ?? "Cu") === m ? "activo" : ""}
                        onClick={() =>
                          actualizar({ fuente_cortocircuito: { material_acometida: m } })
                        }
                      >
                        {m === "Cu" ? "Cobre" : "Aluminio"}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="panel-hoja-ayuda">
                  El cálculo de Icc máxima y mínima todavía no está
                  escrito: esto define el dato de entrada que va a
                  consumir.
                </p>
              </div>
            )}

            {/* E81.2 — los materiales adicionales se mudaron al modo
              * Emitir (ver PanelEmitir.tsx): es lo último que se toca
              * antes de exportar, y acá adentro nadie los encontraba
              * cuando estaba por imprimir. */}
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
