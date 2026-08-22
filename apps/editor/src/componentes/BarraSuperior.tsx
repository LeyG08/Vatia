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
      <input
        className="nombre-proyecto"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        aria-label="Nombre del proyecto"
      />
      <button type="button" onClick={guardar}>
        Guardar JSON
      </button>
      <button type="button" onClick={() => inputArchivo.current?.click()}>
        Cargar…
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
        disabled={!historial.puedeDeshacer}
        title="Ctrl+Z"
      >
        Deshacer
      </button>
      <button
        type="button"
        onClick={rehacerFn}
        disabled={!historial.puedeRehacer}
        title="Ctrl+Shift+Z"
      >
        Rehacer
      </button>
      <span className="ayuda">
        R: rotar 90° · Supr: borrar · arrastrar desde la paleta
      </span>
    </header>
  );
}

export default BarraSuperior;
