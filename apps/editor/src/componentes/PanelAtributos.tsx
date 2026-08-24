import { useEffect, useRef, useState } from "react";
import { useStore } from "@xyflow/react";
import {
  useEditor,
  tamanoNodoPx,
  type DatosAlimentador,
  type DatosSimbolo,
} from "../lib/store";
import { obtenerSimbolo } from "../lib/libreria";
import FormularioAtributos from "./FormularioAtributos";
import FormularioConductor from "./FormularioConductor";
import FormularioCarga from "./FormularioCarga";

/**
 * Panel de ficha técnica (Fase C4): aparece JUNTO al símbolo o conexión
 * seleccionada, se puede arrastrar desde el encabezado y edita los
 * atributos en vivo contra el store (que a su vez los dibuja en la hoja).
 */
export default function PanelAtributos() {
  const nodos = useEditor((s) => s.nodos);
  const conexiones = useEditor((s) => s.conexiones);
  const actualizarNodo = useEditor((s) => s.actualizarAtributosNodo);
  const actualizarConexion = useEditor((s) => s.actualizarAtributosConexion);
  const actualizarAlimentador = useEditor((s) => s.actualizarDatosAlimentador);
  // [tx, ty, zoom] del viewport, para anclar el panel junto al elemento
  const transform = useStore((s) => s.transform);

  const simbolosSel = nodos.filter(
    (n) =>
      n.selected &&
      (n.type === "simbolo" || n.type === "alimentador" || n.type === "barra"),
  );
  const conexionesSel = conexiones.filter((e) => e.selected);

  const nodo =
    simbolosSel.length === 1 && conexionesSel.length === 0
      ? simbolosSel[0]
      : null;
  const edge =
    conexionesSel.length === 1 && simbolosSel.length === 0
      ? conexionesSel[0]
      : null;

  const idActual = nodo?.id ?? edge?.id ?? null;
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  const ultimoId = useRef<string | null>(null);
  const dragRef = useRef<{ px: number; py: number } | null>(null);
  useEffect(() => {
    if (idActual !== ultimoId.current) {
      ultimoId.current = idActual;
      setDelta({ x: 0, y: 0 });
    }
  }, [idActual]);

  if (!nodo && !edge) return null;

  let baseX: number;
  let baseY: number;

  if (nodo) {
    const t = tamanoNodoPx(nodo.data as DatosSimbolo);
    const zoom = transform[2] || 1;
    baseX = (nodo.position.x + t.ancho) * zoom + transform[0] + 14;
    baseY = nodo.position.y * zoom + transform[1];
  } else if (edge) {
    const origen = nodos.find((m) => m.id === edge.source);
    const t = origen ? tamanoNodoPx(origen.data as DatosSimbolo) : { ancho: 40 };
    const zoom = transform[2] || 1;
    baseX =
      ((origen?.position.x ?? 0) + t.ancho) * zoom + transform[0] + 14;
    baseY = (origen?.position.y ?? 0) * zoom + transform[1];
  } else {
    return null;
  }

  const left = Math.min(Math.max(baseX + delta.x, 8), window.innerWidth - 316);
  const top = Math.min(Math.max(baseY + delta.y, 60), window.innerHeight - 200);

  const tituloNodo = (() => {
    if (!nodo) return null;
    if ((nodo.data as DatosAlimentador).tipo === "alimentador") {
      return { nombre: "Alimentación", codigo: "Desde dónde viene" };
    }
    const data = nodo.data as DatosSimbolo;
    const def = obtenerSimbolo(data.codigo_iec);
    return { nombre: def?.metadata.nombre ?? data.codigo_iec, codigo: data.codigo_iec };
  })();

  return (
    <aside
      className="panel-atributos"
      style={{ left, top }}
      role="dialog"
      aria-label="Ficha técnica"
    >
      <h3
        onPointerDown={(e) => {
          dragRef.current = { px: e.clientX - delta.x, py: e.clientY - delta.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragRef.current)
            setDelta({ x: e.clientX - dragRef.current.px, y: e.clientY - dragRef.current.py });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        title="Arrastrá desde acá para mover el panel"
      >
        <span className="panel-atributos-mover">⠿</span>
        {tituloNodo ? (
          <>
            {tituloNodo.nombre}
            <span className="panel-atributos-sub">{tituloNodo.codigo}</span>
          </>
        ) : (
          <>
            Conexión
            <span className="panel-atributos-sub">Mazo de conductores</span>
          </>
        )}
      </h3>
      {nodo ? (
        (nodo.data as DatosAlimentador).tipo === "alimentador" ? (
          <FormularioConductor
            atributos={
              (nodo.data as DatosAlimentador).atributos ?? {}
            }
            onChange={(attrs) =>
              actualizarAlimentador(nodo.id, { atributos: attrs })
            }
            encabezado={
              <label className="campo-atributo">
                <span>
                  Desde<em className="obligatorio">*</em>
                </span>
                <input
                  type="text"
                  placeholder="TGBT"
                  value={(nodo.data as DatosAlimentador).origen}
                  onChange={(e) =>
                    actualizarAlimentador(nodo.id, { origen: e.target.value })
                  }
                />
              </label>
            }
          />
        ) : obtenerSimbolo((nodo.data as DatosSimbolo).codigo_iec)?.metadata
              .familia_atributos === "carga" ? (
          <FormularioCarga
            atributos={(nodo.data as DatosSimbolo).atributos}
            onChange={(attrs) => actualizarNodo(nodo.id, attrs)}
          />
        ) : (
          <FormularioAtributos
            familia={
              obtenerSimbolo((nodo.data as DatosSimbolo).codigo_iec)?.metadata
                .familia_atributos ?? "sin_ficha_tecnica"
            }
            atributos={(nodo.data as DatosSimbolo).atributos}
            onChange={(attrs) => actualizarNodo(nodo.id, attrs)}
          />
        )
      ) : (
        <FormularioConductor
          atributos={
            (edge!.data?.atributosConductor as Record<string, unknown> | undefined) ??
            {}
          }
          onChange={(attrs) => actualizarConexion(edge!.id, attrs)}
        />
      )}
    </aside>
  );
}
