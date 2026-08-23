import { useEditor, type DatosSimbolo } from "../lib/store";
import { obtenerSimbolo } from "../lib/libreria";
import FormularioAtributos from "./FormularioAtributos";

/**
 * Panel flotante de ficha técnica (Fase C4): se abre al seleccionar UN
 * símbolo o UNA conexión y edita sus atributos en vivo contra el store.
 */
export default function PanelAtributos() {
  const nodos = useEditor((s) => s.nodos);
  const conexiones = useEditor((s) => s.conexiones);
  const actualizarNodo = useEditor((s) => s.actualizarAtributosNodo);
  const actualizarConexion = useEditor((s) => s.actualizarAtributosConexion);

  const simbolosSel = nodos.filter((n) => n.selected && n.type === "simbolo");
  const conexionesSel = conexiones.filter((e) => e.selected);

  if (simbolosSel.length === 1 && conexionesSel.length === 0) {
    const nodo = simbolosSel[0];
    const data = nodo.data as DatosSimbolo;
    const def = obtenerSimbolo(data.codigo_iec);
    return (
      <aside className="panel-atributos">
        <h3>
          {def?.metadata.nombre ?? data.codigo_iec}
          <span className="panel-atributos-sub">{data.codigo_iec}</span>
        </h3>
        <FormularioAtributos
          familia={def?.metadata.familia_atributos ?? "sin_ficha_tecnica"}
          atributos={data.atributos}
          onChange={(attrs) => actualizarNodo(nodo.id, attrs)}
        />
      </aside>
    );
  }

  if (conexionesSel.length === 1 && simbolosSel.length === 0) {
    const edge = conexionesSel[0];
    const attrs =
      (edge.data?.atributosConductor as Record<string, unknown> | undefined) ??
      {};
    return (
      <aside className="panel-atributos">
        <h3>
          Conexión
          <span className="panel-atributos-sub">mazo de conductores</span>
        </h3>
        <FormularioAtributos
          familia="conductor"
          atributos={attrs}
          onChange={(nuevos) => actualizarConexion(edge.id, nuevos)}
        />
      </aside>
    );
  }

  return null;
}
