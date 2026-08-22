import { useState } from "react";
import { PROBLEMAS_LIBRERIA } from "../lib/libreria";
import { useEditor } from "../lib/store";

function PanelProblemas() {
  const [abierto, setAbierto] = useState(true);
  const problemasProyecto = useEditor((s) => s.problemasProyecto);

  const todos = [
    ...PROBLEMAS_LIBRERIA.map((p) => ({
      nivel: p.nivel,
      mensaje: `[librería] ${p.mensaje}`,
    })),
    ...problemasProyecto.map((m) => ({
      nivel: "aviso" as const,
      mensaje: `[proyecto] ${m}`,
    })),
  ];

  if (todos.length === 0 && !abierto) return null;
  const hayErrores = todos.some((p) => p.nivel === "error");

  return (
    <section className={`panel-problemas ${hayErrores ? "con-errores" : ""}`}>
      <button
        type="button"
        className="panel-problemas-cabecera"
        onClick={() => setAbierto((a) => !a)}
      >
        {abierto ? "▾" : "▸"} Problemas ({todos.length})
      </button>
      {abierto &&
        (todos.length === 0 ? (
          <p className="sin-problemas">Sin problemas de carga.</p>
        ) : (
          <ul>
            {todos.map((p, i) => (
              <li key={i} className={p.nivel}>
                {p.mensaje}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}

export default PanelProblemas;
