import { useState } from "react";
import { useEditor } from "../lib/store";

/**
 * Pestañas de hojas del proyecto (Fase 6): activar, agregar, duplicar,
 * renombrar (doble clic) y eliminar. La hoja activa se marca visualmente;
 * el cambio de pestaña preserva el viewport propio de cada hoja.
 */
export default function PestanasHoja() {
  const hojas = useEditor((s) => s.proyecto.hojas);
  const activa = useEditor((s) => s.hojaActivaId);
  const agregarHoja = useEditor((s) => s.agregarHoja);
  const duplicarHoja = useEditor((s) => s.duplicarHoja);
  const eliminarHojaFn = useEditor((s) => s.eliminarHoja);
  const renombrarHojaFn = useEditor((s) => s.renombrarHoja);
  const cambiarHojaActiva = useEditor((s) => s.cambiarHojaActiva);

  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");

  function confirmarRenombre(id: string) {
    const nombre = borrador.trim();
    if (nombre !== "") {
      renombrarHojaFn(id, nombre);
    }
    setEditando(null);
  }

  return (
    <div className="pestanas-hoja" role="tablist" aria-label="Hojas del proyecto">
      {hojas.map((h, i) => (
        <div
          key={h.id}
          role="tab"
          aria-selected={h.id === activa}
          tabIndex={0}
          className={`pestana-hoja${h.id === activa ? " activa" : ""}`}
          onClick={() => {
            if (h.id !== activa && editando !== h.id) cambiarHojaActiva(h.id);
          }}
          onKeyDown={(e) => {
            if (
              (e.key === "Enter" || e.key === " ") &&
              h.id !== activa &&
              editando !== h.id
            ) {
              e.preventDefault();
              cambiarHojaActiva(h.id);
            }
          }}
          onDoubleClick={() => {
            setBorrador(h.nombre);
            setEditando(h.id);
          }}
          title={`${h.nombre} — doble clic para renombrar`}
        >
          {editando === h.id ? (
            <input
              className="pestana-nombre-input"
              value={borrador}
              autoFocus
              onChange={(e) => setBorrador(e.target.value)}
              onBlur={() => confirmarRenombre(h.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditando(null);
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className="pestana-nombre">
                {i + 1}. {h.nombre}
              </span>
              <button
                type="button"
                className="pestana-accion"
                title="Duplicar hoja"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicarHoja(h.id);
                }}
              >
                ⧉
              </button>
              {hojas.length > 1 && (
                <button
                  type="button"
                  className="pestana-accion"
                  title="Eliminar hoja con todo su contenido"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(
                        `¿Eliminar la hoja «${h.nombre}» con todo su contenido? Esta acción no se puede deshacer.`,
                      )
                    ) {
                      eliminarHojaFn(h.id);
                    }
                  }}
                >
                  ✕
                </button>
              )}
            </>
          )}
        </div>
      ))}
      <button
        type="button"
        className="pestana-hoja nueva"
        title="Nueva hoja"
        onClick={() => agregarHoja()}
      >
        ＋ Nueva
      </button>
    </div>
  );
}
