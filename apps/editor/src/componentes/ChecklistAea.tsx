import { useMemo, useState } from "react";
import { useEditor } from "../lib/store";
import { armarChecklist } from "../lib/checklist";

/**
 * Checklist AEA (C5): pendientes de ficha técnica de la hoja activa.
 * NO bloquea nada — solo avisa. Clic en un símbolo lo selecciona para
 * corregirlo desde el panel de atributos.
 */
function ChecklistAea() {
  const nodos = useEditor((s) => s.nodos);
  const conexiones = useEditor((s) => s.conexiones);
  const modo = useEditor((s) => s.hoja.modo);
  const seleccionarNodosFn = useEditor((s) => s.seleccionarNodos);
  const [abierto, setAbierto] = useState(true);

  const problemas = useMemo(
    () => armarChecklist(nodos, conexiones, modo),
    [nodos, conexiones, modo],
  );
  const total = problemas.reduce((t, p) => t + p.mensajes.length, 0);

  return (
    <section className={`checklist-aea ${total > 0 ? "pendientes" : ""}`}>
      <button
        type="button"
        className="checklist-cabecera"
        onClick={() => setAbierto((a) => !a)}
      >
        {abierto ? "▾" : "▸"}{" "}
        {total > 0
          ? `Faltan completar campos obligatorios (${total})`
          : "✓ Campos obligatorios completos"}
      </button>
      {abierto &&
        (total === 0 ? (
          <p className="sin-problemas">Todas las fichas técnicas completas.</p>
        ) : (
          <ul className="checklist-elementos">
            {problemas.map((p) => (
              <li key={p.id} className="checklist-elemento">
                <button
                  type="button"
                  className="checklist-ir"
                  disabled={p.esConexion}
                  title={
                    p.esConexion
                      ? "Seleccioná la conexión en el plano"
                      : "Seleccionar en el plano"
                  }
                  onClick={() => {
                    if (!p.esConexion) seleccionarNodosFn([p.id]);
                  }}
                >
                  {p.etiqueta}
                </button>
                <ul>
                  {p.mensajes.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}

export default ChecklistAea;
