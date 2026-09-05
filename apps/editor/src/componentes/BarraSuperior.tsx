import { useRef, useCallback, useEffect, useState } from "react";
import { useEditor, historial, construirEstadoHoja } from "../lib/store";
import { serializarProyecto, type Hoja } from "../lib/tipos";
import { armarChecklist } from "../lib/checklist";

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
  const modoSimulacion = useEditor((s) => s.modoSimulacion);
  const alternarSimulacion = useEditor((s) => s.alternarSimulacion);
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

  return (
    <>
      <header className="barra-superior">
        <strong className="marca">Vatia</strong>
      {modoAdmin && (
        <span className="badge-admin" title="Modo administrador activo (Ctrl+Shift+A)">
          ADMIN
        </span>
      )}
      {modoSimulacion && (
        <span className="badge-simulacion" title="Modo simulación activo">
          ▶ SIMULACIÓN
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
        className={modoSimulacion ? "activo" : ""}
        onClick={alternarSimulacion}
        title="Modo simulación: probar el circuito accionando pulsadores e interruptores"
      >
        {modoSimulacion ? "⏹ Detener simulación" : "▶ Simular"}
      </button>
      <button
        type="button"
        onClick={descargarPlanoActivo}
        title="Descargar la hoja activa como PDF"
      >
        ⬇️ Plano PDF
      </button>
      <button
        type="button"
        onClick={descargarTodosLosPlanos}
        title="Descargar TODAS las hojas del proyecto en un solo PDF"
      >
        ⬇️ Todos los planos
      </button>
      <button
        type="button"
        onClick={descargarListaDeMateriales}
        title="Descargar la lista de materiales de todo el proyecto como PDF, aparte de los planos"
      >
        ⬇️ Lista de materiales
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
