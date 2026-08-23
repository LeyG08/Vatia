import { useRef } from "react";
import { useEditor, historial } from "../lib/store";
import type { ProyectoJSON } from "../lib/tipos";

function BarraSuperior() {
  const nombre = useEditor((s) => s.nombreProyecto);
  const setNombre = useEditor((s) => s.setNombreProyecto);
  const serializar = useEditor((s) => s.serializarActual);
  const cargar = useEditor((s) => s.cargarProyecto);
  const deshacerFn = useEditor((s) => s.deshacer);
  const rehacerFn = useEditor((s) => s.rehacer);
  const alternarPaleta = useEditor((s) => s.alternarPaleta);
  const paletaVisible = useEditor((s) => s.paletaVisible);
  const alternarHoja = useEditor((s) => s.alternarPanelHoja);
  const version = useEditor((s) => s.version);
  const puedeDeshacer = version >= 0 && historial.puedeDeshacer;
  const puedeRehacer = version >= 0 && historial.puedeRehacer;
  const inputArchivo = useRef<HTMLInputElement>(null);

  function guardar() {
    const proyecto = serializar();
    const blob = new Blob([JSON.stringify(proyecto, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${proyecto.nombre || "proyecto"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function abrir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const datos = JSON.parse(texto) as ProyectoJSON;
      if (!Array.isArray(datos.nodos)) throw new Error("falta el array nodos");
      cargar(datos);
    } catch (err) {
      alert(`No se pudo cargar el proyecto: ${String(err)}`);
    }
    e.target.value = "";
  }

  return (
    <header className="barra-superior">
      <strong className="marca">Vatia</strong>
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
      <span className="ayuda">
        Arrastrar con rueda: desplazar · Clic izq. y arrastrar: seleccionar ·
        Ctrl+clic: sumar · Ctrl+C/V: copiar/pegar · R: rotar · Supr: borrar
      </span>
    </header>
  );
}

export default BarraSuperior;
