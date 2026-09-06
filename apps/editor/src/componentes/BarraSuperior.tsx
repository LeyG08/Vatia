import { useRef, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  useEditor,
  historial,
  construirEstadoHoja,
  MODOS_TRABAJO,
} from "../lib/store";
import { serializarProyecto, type Hoja } from "../lib/tipos";
import { armarChecklist } from "../lib/checklist";

/** Un grupo de comandos de la cinta: los botones arriba, el rótulo del
 * grupo abajo. Va fuera del componente a propósito — declarado adentro,
 * React lo trata como un tipo nuevo en cada render y remonta sus hijos. */
function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="cinta-grupo">
      <div className="cinta-grupo-botones">{children}</div>
      <span className="cinta-grupo-titulo">{titulo}</span>
    </div>
  );
}

function BarraSuperior() {
  const nombre = useEditor((s) => s.nombreProyecto);
  const setNombre = useEditor((s) => s.setNombreProyecto);
  const serializar = useEditor((s) => s.serializarActual);
  const cargar = useEditor((s) => s.cargarProyecto);
  const nuevoProyectoFn = useEditor((s) => s.nuevoProyecto);
  const deshacerFn = useEditor((s) => s.deshacer);
  const rehacerFn = useEditor((s) => s.rehacer);
  const alternarHoja = useEditor((s) => s.alternarPanelHoja);
  const alternarProyecto = useEditor((s) => s.alternarPanelProyecto);
  const modoAdmin = useEditor((s) => s.modoAdmin);
  const modoSimulacion = useEditor((s) => s.modoSimulacion);
  const alternarSimulacion = useEditor((s) => s.alternarSimulacion);
  const modoTrabajo = useEditor((s) => s.modoTrabajo);
  const setModoTrabajo = useEditor((s) => s.setModoTrabajo);
  const columnaIzquierda = useEditor((s) => s.columnaIzquierda);
  const setColumnaIzquierda = useEditor((s) => s.setColumnaIzquierda);
  const tablaAbierta = useEditor((s) => s.tablaAbierta);
  const setTablaAbierta = useEditor((s) => s.setTablaAbierta);
  const setComandosAbiertos = useEditor((s) => s.setComandosAbiertos);
  const version = useEditor((s) => s.version);
  const puedeDeshacer = version >= 0 && historial.puedeDeshacer;
  const puedeRehacer = version >= 0 && historial.puedeRehacer;
  const inputArchivo = useRef<HTMLInputElement>(null);

  const hojaActivaId = useEditor((s) => s.hojaActivaId);
  const iniciarExportacionPdfFn = useEditor((s) => s.iniciarExportacionPdf);
  const pedirConfirmacion = useEditor((s) => s.pedirConfirmacion);
  const mostrarAlerta = useEditor((s) => s.mostrarAlerta);

  const [oscuro, setOscuro] = useState(() => {
    return localStorage.getItem("vatia-tema") === "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = oscuro ? "dark" : "";
    localStorage.setItem("vatia-tema", oscuro ? "dark" : "light");
  }, [oscuro]);

  const toggleTema = useCallback(() => setOscuro((v) => !v), []);

  const guardar = useCallback(() => {
    const proyecto = serializar();
    const blob = new Blob([serializarProyecto(proyecto)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${proyecto.meta.nombre || "proyecto"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [serializar]);

  // Ctrl+S / Cmd+S guarda (el resto de los atajos vive en App.tsx; este
  // queda acá porque guardar() ya está definido en este componente y no
  // amerita levantarlo al store solo para esto).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        guardar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guardar]);

  /** Total de pendientes de ficha técnica (Checklist AEA) de un grupo de
   * hojas — mismo cálculo para descargar una sola hoja o el proyecto
   * entero, contra datos FRESCOS (no el estado en memoria de la hoja
   * activa, que puede estar desactualizado para las demás). */
  function totalPendientesDe(hojas: Hoja[]): number {
    return hojas.reduce((acc, h) => {
      const estado = construirEstadoHoja(h);
      const problemas = armarChecklist(estado.nodos, estado.conexiones, estado.cfg.modo);
      return acc + problemas.reduce((t, p) => t + p.mensajes.length, 0);
    }, 0);
  }

  /**
   * Descarga directa de PDF (html2canvas + jsPDF, ver lib/exportarPdf.ts
   * y ExportacionProyecto.tsx): no hay diálogo de impresión del
   * navegador de por medio, el archivo se genera y se descarga solo — el
   * usuario se encarga de imprimirlo después, como cualquier PDF.
   *
   * `serializar()` es el primer paso siempre: vuelca la hoja ACTIVA
   * (nodos/conexiones "en vivo" en el store) a `proyecto.hojas` ANTES de
   * leer nada. Sin esto, la última hoja que el usuario editó quedaría
   * afuera del PDF — su trabajo más reciente vive en `nodos`/`conexiones`
   * hasta que algo lo vuelca (cambiar de hoja, o esto), no en
   * `proyecto.hojas` todavía.
   */
  function descargarPlanoActivo() {
    const hojaFresca = serializar().hojas.find((h) => h.id === hojaActivaId);
    if (!hojaFresca) {
      mostrarAlerta("No se encontró la hoja activa.");
      return;
    }
    const totalPendientes = totalPendientesDe([hojaFresca]);
    if (totalPendientes > 0) {
      pedirConfirmacion(
        `Esta hoja tiene ${totalPendientes} pendiente${totalPendientes === 1 ? "" : "s"} de ficha técnica (Checklist AEA). ¿Descargar igual?`,
        () => iniciarExportacionPdfFn("planos", [hojaFresca]),
      );
      return;
    }
    iniciarExportacionPdfFn("planos", [hojaFresca]);
  }

  /** Todas las hojas del proyecto en un solo PDF, cada una en su propia
   * página a su tamaño real (respeta el formato/orientación de cada
   * hoja — no hace falta que coincidan entre sí). */
  function descargarTodosLosPlanos() {
    const hojasFrescas = serializar().hojas;
    const totalPendientes = totalPendientesDe(hojasFrescas);
    if (totalPendientes > 0) {
      pedirConfirmacion(
        `El proyecto tiene ${totalPendientes} pendiente${totalPendientes === 1 ? "" : "s"} de ficha técnica (Checklist AEA, todas las hojas). ¿Descargar igual?`,
        () => iniciarExportacionPdfFn("planos", hojasFrescas),
      );
      return;
    }
    iniciarExportacionPdfFn("planos", hojasFrescas);
  }

  /** Lista de materiales de TODO el proyecto, en su propio PDF aparte de
   * los planos — pedido explícito: "de un lado la lista de materiales
   * para imprimir y de otro lado salga el plano". */
  function descargarListaDeMateriales() {
    iniciarExportacionPdfFn("bom", serializar().hojas);
  }

  function nuevoProyecto() {
    pedirConfirmacion(
      "¿Empezar un proyecto en blanco? Se pierde el trabajo actual (descargalo con Guardar antes, si querés conservarlo).",
      nuevoProyectoFn,
    );
  }

  async function abrir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      // Acepta v0/v1 ({nodos}) y v2/v3 ({hojas}); migrarAProyectoV3 decide
      const bruto = JSON.parse(texto) as {
        nodos?: unknown;
        hojas?: unknown;
      };
      if (!Array.isArray(bruto.nodos) && !Array.isArray(bruto.hojas)) {
        throw new Error("falta el array nodos o hojas");
      }
      cargar(texto);
    } catch (err) {
      mostrarAlerta(`No se pudo cargar el proyecto: ${String(err)}`);
    }
    e.target.value = "";
  }

  /* PROTOTIPO E81 - la cinta. Dos bandas: arriba la identidad, el nombre
   * del documento y las SOLAPAS DE MODO; abajo los comandos del modo
   * activo, agrupados y con su rotulo de grupo. Las solapas y los modos
   * son la misma cosa a proposito (direcciones 1 + 5 del set de
   * disposiciones): elegir "Simular" no abre una barra distinta, cambia
   * el estado de la aplicacion. */
  return (
    <>
      <header className="cinta">
        <div className="cinta-banda">
          <strong className="marca">Vatia</strong>
          {modoAdmin && (
            <span className="badge-admin" title="Modo administrador activo (Ctrl+Shift+A)">
              Admin
            </span>
          )}
          <input
            className="nombre-proyecto"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            aria-label="Nombre del proyecto"
          />

          <nav className="cinta-solapas" aria-label="Modo de trabajo">
            {MODOS_TRABAJO.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`cinta-solapa${modoTrabajo === m.id ? " activa" : ""}${
                  m.id === "simular" && modoSimulacion ? " viva" : ""
                }`}
                onClick={() => setModoTrabajo(m.id)}
                aria-pressed={modoTrabajo === m.id}
                title={m.ayuda}
              >
                {m.nombre}
              </button>
            ))}
          </nav>

          <div className="cinta-margen">
            <button
              type="button"
              className="btn-icono btn-buscar"
              onClick={() => setComandosAbiertos(true)}
              title="Buscar un simbolo o un comando (Ctrl+K)"
            >
              Buscar <kbd>Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="btn-icono"
              onClick={deshacerFn}
              disabled={!puedeDeshacer}
              title="Deshacer (Ctrl+Z)"
              aria-label="Deshacer"
            >
              &#8630;
            </button>
            <button
              type="button"
              className="btn-icono"
              onClick={rehacerFn}
              disabled={!puedeRehacer}
              title="Rehacer (Ctrl+Shift+Z)"
              aria-label="Rehacer"
            >
              &#8631;
            </button>
            <button
              type="button"
              className="btn-icono btn-tema"
              onClick={toggleTema}
              title={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            >
              {oscuro ? "\u2600" : "\u263e"}
            </button>
          </div>
        </div>

        <div className="cinta-comandos">
          {modoTrabajo === "dibujar" && (
            <>
              <Grupo titulo="Columna izquierda">
                <button
                  type="button"
                  className={columnaIzquierda === "simbolos" ? "activo" : ""}
                  onClick={() => setColumnaIzquierda("simbolos")}
                  title="Mostrar la libreria de simbolos"
                >
                  Simbolos
                </button>
                <button
                  type="button"
                  className={columnaIzquierda === "proyecto" ? "activo" : ""}
                  onClick={() => setColumnaIzquierda("proyecto")}
                  title="Mostrar el legajo del proyecto"
                >
                  Legajo
                </button>
              </Grupo>
              <Grupo titulo="Hoja">
                <button type="button" onClick={() => alternarHoja()}>
                  Formato y rotulo...
                </button>
                <button type="button" onClick={() => alternarProyecto()}>
                  Datos del proyecto...
                </button>
              </Grupo>
            </>
          )}

          {modoTrabajo === "documentar" && (
            <>
              <Grupo titulo="Fichas tecnicas">
                <button
                  type="button"
                  className={tablaAbierta ? "activo" : ""}
                  onClick={() => setTablaAbierta(!tablaAbierta)}
                  title="Planilla de carga: una fila por aparato, una columna por campo"
                >
                  Planilla de carga
                </button>
                <button type="button" onClick={() => alternarProyecto()}>
                  Datos del proyecto...
                </button>
              </Grupo>
              <Grupo titulo="Columna izquierda">
                <button
                  type="button"
                  className={columnaIzquierda === "proyecto" ? "activo" : ""}
                  onClick={() => setColumnaIzquierda("proyecto")}
                >
                  Legajo
                </button>
                <button
                  type="button"
                  className={columnaIzquierda === "simbolos" ? "activo" : ""}
                  onClick={() => setColumnaIzquierda("simbolos")}
                >
                  Simbolos
                </button>
              </Grupo>
            </>
          )}

          {modoTrabajo === "verificar" && (
            <Grupo titulo="Control">
              <button type="button" onClick={() => alternarProyecto()}>
                Normativa y tensiones...
              </button>
              <button type="button" onClick={() => alternarHoja()}>
                Rotulo y notas...
              </button>
            </Grupo>
          )}

          {modoTrabajo === "simular" && (
            <Grupo titulo="Circuito">
              <button
                type="button"
                className={modoSimulacion ? "vivo" : ""}
                onClick={alternarSimulacion}
                title="Reinicia el estado: todas las bobinas caen y los pulsadores vuelven a reposo"
              >
                {modoSimulacion ? "Reiniciar estado" : "Encender el circuito"}
              </button>
            </Grupo>
          )}

          {modoTrabajo === "emitir" && (
            <>
              <Grupo titulo="Planos">
                <button type="button" onClick={descargarPlanoActivo}>
                  Hoja activa
                </button>
                <button type="button" onClick={descargarTodosLosPlanos}>
                  Todas las hojas
                </button>
                <button type="button" onClick={descargarListaDeMateriales}>
                  Lista de materiales
                </button>
              </Grupo>
              <Grupo titulo="Archivo">
                <button type="button" className="primario" onClick={guardar}>
                  Guardar
                </button>
                <button type="button" onClick={() => inputArchivo.current?.click()}>
                  Abrir...
                </button>
                <button type="button" onClick={nuevoProyecto}>
                  Nuevo
                </button>
              </Grupo>
            </>
          )}

          <input
            ref={inputArchivo}
            type="file"
            accept="application/json,.json"
            onChange={abrir}
            hidden
          />

          <span className="cinta-ayuda">
            {MODOS_TRABAJO.find((m) => m.id === modoTrabajo)?.ayuda}
          </span>
        </div>
      </header>
    </>
  );
}

export default BarraSuperior;
