import { useEditor } from "../lib/store";
import Paleta from "./Paleta";
import ArbolProyecto from "./ArbolProyecto";

/**
 * PROTOTIPO E81 — la columna izquierda pasa a tener dos solapas en vez de
 * ser solo la librería: el LEGAJO del proyecto (árbol de hojas y
 * aparatos, dirección 4) y los SÍMBOLOS de siempre.
 *
 * Comparten un mismo ancho y un mismo lugar a propósito: son las dos
 * formas de "traer algo al plano" —uno lo busca en el catálogo, el otro
 * lo busca en lo que ya dibujó— y tenerlas como paneles separados
 * competiría por el mismo espacio sin ganar nada.
 */
function ColumnaIzquierda({
  onIniciarArrastre,
}: {
  onIniciarArrastre: (codigo: string, e: React.MouseEvent) => void;
}) {
  const cual = useEditor((s) => s.columnaIzquierda);
  const setCual = useEditor((s) => s.setColumnaIzquierda);

  return (
    <div className="columna-izq">
      <div className="columna-izq-solapas" role="tablist" aria-label="Columna izquierda">
        <button
          type="button"
          role="tab"
          aria-selected={cual === "proyecto"}
          className={cual === "proyecto" ? "activa" : ""}
          onClick={() => setCual("proyecto")}
        >
          Legajo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={cual === "simbolos"}
          className={cual === "simbolos" ? "activa" : ""}
          onClick={() => setCual("simbolos")}
        >
          Símbolos
        </button>
      </div>
      <div className="columna-izq-cuerpo">
        {cual === "proyecto" ? (
          <ArbolProyecto />
        ) : (
          <Paleta onIniciarArrastre={onIniciarArrastre} />
        )}
      </div>
    </div>
  );
}

export default ColumnaIzquierda;
