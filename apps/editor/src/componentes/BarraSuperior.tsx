import { useRef, useCallback, useEffect, useState } from "react";
import { useEditor, historial } from "../lib/store";

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

  const [oscuro, setOscuro] = useState(() => {
    return localStorage.getItem("vatia-tema") === "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = oscuro ? "dark" : "";
    localStorage.setItem("vatia-tema", oscuro ? "dark" : "light");
  }, [oscuro]);

  const toggleTema = useCallback(() => setOscuro((v) => !v), []);

  function guardar() {
    const proyecto = serializar();
    const blob = new Blob([JSON.stringify(proyecto, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${proyecto.meta.nombre || "proyecto"}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
      <button type="button" onClick={guardar} title="Guardar proyecto JSON">
        💾 Guardar
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
      >
        ↶
      </button>
      <button
        type="button"
        onClick={rehacerFn}
        disabled={!puedeRehacer}
        title="Rehacer (Ctrl+Shift+Z)"
      >
        ↷
      </button>
      <button
        type="button"
        className="btn-tema"
        onClick={toggleTema}
        title={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      >
        {oscuro ? "☀" : "🌙"}
      </button>
      <span className="ayuda">
        Arrastrar con rueda: desplazar · Clic izq. y arrastrar: seleccionar ·
        Ctrl+clic: sumar · Ctrl+C/V: copiar/pegar · R: rotar · Supr: borrar
      </span>
    </header>
  );
}

export default BarraSuperior;
