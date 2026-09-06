import { useEditor } from "../lib/store";
import Paleta from "./Paleta";
import ArbolProyecto from "./ArbolProyecto";
import PanelEmitir from "./PanelEmitir";

/**
 * PROTOTIPO E81 — la columna izquierda pasa a tener dos solapas en vez de
 * ser solo la librería: el LEGAJO del proyecto (árbol de hojas y
 * aparatos, dirección 4) y los SÍMBOLOS de siempre.
 *
 * Comparten un mismo ancho y un mismo lugar a propósito: son las dos
 * formas de "traer algo al plano" —uno lo busca en el catálogo, el otro
 * lo busca en lo que ya dibujó— y tenerlas como paneles separados
 * competiría por el mismo espacio sin ganar nada.
 *
 * E81.1: estas solapas son el ÚNICO lugar donde se cambia de una a la
 * otra. La cinta las repetía arriba, además con el orden invertido, y
 * dos controles para lo mismo a dos centímetros de distancia se leen
 * como dos cosas distintas.
 */
function ColumnaIzquierda({
  onIniciarArrastre,
}: {
  onIniciarArrastre: (codigo: string, e: React.MouseEvent) => void;
}) {
  const cual = useEditor((s) => s.columnaIzquierda);
  const setCual = useEditor((s) => s.setColumnaIzquierda);
  const modoTrabajo = useEditor((s) => s.modoTrabajo);

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
        {/* E81.2 — la tercera solapa aparece solo en el modo Emitir: lo
          * que se va a imprimir y los materiales adicionales, que antes
          * estaban enterrados en "Configuración de hoja", que es donde
          * nadie va cuando está por exportar. */}
        {modoTrabajo === "emitir" && (
          <button
            type="button"
            role="tab"
            aria-selected={cual === "emitir"}
            className={cual === "emitir" ? "activa" : ""}
            onClick={() => setCual("emitir")}
          >
            Emitir
          </button>
        )}
      </div>
      <div className="columna-izq-cuerpo">
        {cual === "emitir" && modoTrabajo === "emitir" ? (
          <PanelEmitir />
        ) : cual === "proyecto" ? (
          <ArbolProyecto />
        ) : (
          <Paleta onIniciarArrastre={onIniciarArrastre} />
        )}
      </div>
    </div>
  );
}

export default ColumnaIzquierda;
