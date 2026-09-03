import { useRef, useCallback, useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEditor, historial, construirEstadoHoja } from "../lib/store";
import { serializarProyecto } from "../lib/tipos";
import { armarChecklist } from "../lib/checklist";
import { ZOOM_IMPRESION, medidasPaginaMm } from "../lib/impresion";
import DialogoExportarProyecto from "./DialogoExportarProyecto";

function BarraSuperior() {
  const nombre = useEditor((s) => s.nombreProyecto);
  const setNombre = useEditor((s) => s.setNombreProyecto);
  const serializar = useEditor((s) => s.serializarActual);
  const cargar = useEditor((s) => s.cargarProyecto);
  const nuevoProyectoFn = useEditor((s) => s.nuevoProyecto);
  const deshacerFn = useEditor((s) => s.deshacer);
  const rehacerFn = useEditor((s) => s.rehacer);
  const alternarPaleta = useEditor((s) => s.alternarPaleta);
  const paletaVisible = useEditor((s) => s.paletaVisible);
  const alternarHoja = useEditor((s) => s.alternarPanelHoja);
  const alternarProyecto = useEditor((s) => s.alternarPanelProyecto);
  const modoAdmin = useEditor((s) => s.modoAdmin);
  const version = useEditor((s) => s.version);
  const puedeDeshacer = version >= 0 && historial.puedeDeshacer;
  const puedeRehacer = version >= 0 && historial.puedeRehacer;
  const inputArchivo = useRef<HTMLInputElement>(null);

  const nodos = useEditor((s) => s.nodos);
  const conexiones = useEditor((s) => s.conexiones);
  const hoja = useEditor((s) => s.hoja);
  const seleccionarNodosFn = useEditor((s) => s.seleccionarNodos);
  const iniciarExportacionFn = useEditor((s) => s.iniciarExportacionCompleta);
  const finalizarExportacionFn = useEditor((s) => s.finalizarExportacionCompleta);
  const { setViewport, getViewport, setEdges } = useReactFlow();
  const [dialogoExportar, setDialogoExportar] = useState<{ totalPendientes: number } | null>(null);

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

  /**
   * Exportación a PDF: se reusa el mismo React Flow que ya está en
   * pantalla (ver lib/impresion.ts sobre por qué el zoom no es 1), solo
   * cambia el viewport y se llama a `window.print()` — no hay un
   * renderer paralelo que pueda desincronizarse del dibujo real.
   *
   * V1 exporta la hoja ACTIVA únicamente (una hoja por vez); exportar el
   * proyecto entero en un solo PDF multipágina queda como una etapa
   * siguiente del mismo punch list.
   */
  function exportarPdf() {
    const problemas = armarChecklist(nodos, conexiones, hoja.modo);
    const totalPendientes = problemas.reduce((t, p) => t + p.mensajes.length, 0);
    if (totalPendientes > 0) {
      const seguir = window.confirm(
        `Esta hoja tiene ${totalPendientes} pendiente${totalPendientes === 1 ? "" : "s"} de ficha técnica (Checklist AEA). ¿Exportar igual?`,
      );
      if (!seguir) return;
    }

    seleccionarNodosFn([]);
    setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)));

    const { anchoMm, altoMm } = medidasPaginaMm(hoja);
    const estiloPagina = document.createElement("style");
    estiloPagina.id = "estilo-pagina-impresion";
    estiloPagina.textContent = `@page { size: ${anchoMm}mm ${altoMm}mm; margin: 0; }`;
    document.head.appendChild(estiloPagina);

    const viewportPrevio = getViewport();
    setViewport({ x: 0, y: 0, zoom: ZOOM_IMPRESION }, { duration: 0 });

    function restaurar() {
      setViewport(viewportPrevio, { duration: 0 });
      estiloPagina.remove();
      window.removeEventListener("afterprint", restaurar);
    }
    window.addEventListener("afterprint", restaurar);

    // Dos frames: uno para que React aplique el cambio de viewport, otro
    // para que el navegador termine de pintar antes de abrir el diálogo.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  /**
   * Exportación del proyecto ENTERO: monta `<ExportacionProyecto>`
   * (una página React Flow por hoja + lista de materiales, ver ese
   * componente) y llama a `window.print()` — el navegador arma un único
   * PDF multipágina porque cada página tiene su propio `page-break-after`
   * (ver estilos.css). `document.body` recibe una clase mientras dura el
   * export para que el CSS de impresión sepa que tiene que ocultar el
   * lienzo interactivo normal y mostrar esta vista en su lugar.
   *
   * `serializar()` es el primer paso, no un detalle: vuelca la hoja
   * ACTIVA (nodos/conexiones "en vivo" en el store) a `proyecto.hojas`
   * ANTES de leer nada. Sin esto, la última hoja que el usuario editó
   * quedaría afuera del PDF y de la lista de materiales — su trabajo
   * más reciente vive en `nodos`/`conexiones` hasta que algo lo vuelca
   * (cambiar de hoja, o esto), no en `proyecto.hojas` todavía.
   */
  function exportarProyectoCompletoPdf() {
    const hojasFrescas = serializar().hojas;
    const totalPendientes = hojasFrescas.reduce((acc, h) => {
      const estado = construirEstadoHoja(h);
      const problemas = armarChecklist(estado.nodos, estado.conexiones, estado.cfg.modo);
      return acc + problemas.reduce((t, p) => t + p.mensajes.length, 0);
    }, 0);
    setDialogoExportar({ totalPendientes });
  }

  function confirmarExportarProyectoCompletoPdf(incluirBom: boolean) {
    setDialogoExportar(null);
    iniciarExportacionFn(incluirBom);
    document.body.classList.add("exportando-todo");

    function restaurar() {
      finalizarExportacionFn();
      document.body.classList.remove("exportando-todo");
      window.removeEventListener("afterprint", restaurar);
    }
    window.addEventListener("afterprint", restaurar);

    // Tres frames: montar <ExportacionProyecto> (con N instancias de
    // React Flow) tarda más que un simple cambio de viewport.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => window.print())),
    );
  }

  function nuevoProyecto() {
    if (
      window.confirm(
        "¿Empezar un proyecto en blanco? Se pierde el trabajo actual (descargalo con Guardar antes, si querés conservarlo).",
      )
    ) {
      nuevoProyectoFn();
    }
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
      alert(`No se pudo cargar el proyecto: ${String(err)}`);
    }
    e.target.value = "";
  }

  return (
    <>
      {dialogoExportar && (
        <DialogoExportarProyecto
          totalPendientes={dialogoExportar.totalPendientes}
          onCancelar={() => setDialogoExportar(null)}
          onConfirmar={confirmarExportarProyectoCompletoPdf}
        />
      )}
      <header className="barra-superior">
        <strong className="marca">Vatia</strong>
      {modoAdmin && (
        <span className="badge-admin" title="Modo administrador activo (Ctrl+Shift+A)">
          ADMIN
        </span>
      )}
      <button
        type="button"
        className={paletaVisible ? "activo" : ""}
        onClick={alternarPaleta}
        title="Mostrar / ocultar barra de símbolos"
      >
        ☰ Símbolos
      </button>
      <button
        type="button"
        onClick={() => alternarHoja()}
        title="Configuración de hoja (formato, orientación, rótulo)"
      >
        📐 Hoja…
      </button>
      <button
        type="button"
        onClick={() => alternarProyecto()}
        title="Datos del proyecto (normativa, tensión, esquema PAT, cortocircuito)"
      >
        ⚡ Proyecto…
      </button>
      <input
        className="nombre-proyecto"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        aria-label="Nombre del proyecto"
      />
      <button
        type="button"
        className="primario"
        onClick={guardar}
        title="Guardar proyecto JSON"
      >
        💾 Guardar
      </button>
      <button
        type="button"
        onClick={exportarPdf}
        title="Exportar la hoja activa a PDF (imprimir)"
      >
        🖨️ Exportar PDF
      </button>
      <button
        type="button"
        onClick={exportarProyectoCompletoPdf}
        title="Exportar TODAS las hojas del proyecto a un solo PDF, con lista de materiales"
      >
        🖨️ Exportar proyecto
      </button>
      <button
        type="button"
        onClick={nuevoProyecto}
        title="Empezar un proyecto en blanco (se pierde el actual)"
      >
        📄 Nuevo
      </button>
      <button
        type="button"
        onClick={() => inputArchivo.current?.click()}
        title="Cargar proyecto JSON"
      >
        📂 Cargar…
      </button>
      <input
        ref={inputArchivo}
        type="file"
        accept="application/json,.json"
        onChange={abrir}
        hidden
      />
      <span className="separador" />
      <button
        type="button"
        onClick={deshacerFn}
        disabled={!puedeDeshacer}
        title="Deshacer (Ctrl+Z)"
        aria-label="Deshacer"
      >
        ↶
      </button>
      <button
        type="button"
        onClick={rehacerFn}
        disabled={!puedeRehacer}
        title="Rehacer (Ctrl+Shift+Z)"
        aria-label="Rehacer"
      >
        ↷
      </button>
      <button
        type="button"
        className="btn-tema"
        onClick={toggleTema}
        title={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      >
        {oscuro ? "☀" : "🌙"}
      </button>
      <span className="ayuda">
        Atajos de teclado: presioná{" "}
        <kbd>?</kbd>
      </span>
      </header>
    </>
  );
}

export default BarraSuperior;
