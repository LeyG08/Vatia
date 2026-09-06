import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@xyflow/react";
import {
  useEditor,
  tamanoNodoPx,
  esDatosAlimentador,
  type DatosAlimentador,
  type DatosSimbolo,
} from "../lib/store";
import { obtenerSimbolo } from "../lib/libreria";
import { calcularTopologia } from "../lib/topologia";
import {
  calcularCaidaTensionPct,
  calcularIbA,
  calcularIzA,
  longitudTotalM,
  type TramoInstalacion,
} from "../lib/calculo";
import { avisoIncompatibilidadReferencia, esAccesorioReferencia } from "../lib/referencia";
import type { RolCircuito } from "../lib/secciones";
import FormularioAtributos from "./FormularioAtributos";
import FormularioConductor from "./FormularioConductor";
import FormularioCarga from "./FormularioCarga";

/** Jerarquía de hojas: si esta carga seccional ya tiene una hoja hija
 * colgando, ofrece ir a ella; si no, ofrece crearla. */
function HojaHijaAccion({ nodoId }: { nodoId: string }) {
  const hojaActivaId = useEditor((s) => s.hojaActivaId);
  const hijaExistente = useEditor((s) =>
    s.proyecto.hojas.find(
      (h) => h.hojaPadreId === hojaActivaId && h.nodoOrigenId === nodoId,
    ),
  );
  const crearOIr = useEditor((s) => s.crearOIrAHojaHija);

  return (
    <div className="panel-atributos-hoja-hija">
      <button type="button" onClick={() => crearOIr(nodoId)}>
        {hijaExistente
          ? `→ Ir a la hoja del tablero: ${hijaExistente.nombre}`
          : "+ Crear hoja del tablero seccional"}
      </button>
    </div>
  );
}

/**
 * Panel de ficha técnica (Fase C4): aparece JUNTO al símbolo o conexión
 * seleccionada, se puede arrastrar desde el encabezado y edita los
 * atributos en vivo contra el store (que a su vez los dibuja en la hoja).
 */
export default function PanelAtributos() {
  const nodos = useEditor((s) => s.nodos);
  const conexiones = useEditor((s) => s.conexiones);
  const datosProyecto = useEditor((s) => s.proyecto.datosProyecto);
  const proyectoHojas = useEditor((s) => s.proyecto.hojas);
  const hojaActivaId = useEditor((s) => s.hojaActivaId);
  const modo = useEditor((s) => s.hoja.modo);
  const modoSimulacion = useEditor((s) => s.modoSimulacion);
  // Rol del alimentador (E60): "principal" si esta hoja es la raíz
  // (línea desde la fuente), "seccional" si cuelga de otra hoja (va a
  // un tablero seccional) — decide el mínimo AEA de su sección.
  const rolAlimentador: RolCircuito = proyectoHojas.find((h) => h.id === hojaActivaId)
    ?.hojaPadreId
    ? "seccional"
    : "principal";
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

  // Circuitos agrupados por canalización (E58/E60): cada TRAMO puede
  // tener su propia canalización (un cable puede compartir bandeja en
  // un tramo y seguir solo en el resto de su recorrido) — se arma un
  // mapa canalización → cuántos TRAMOS (de cualquier conductor o
  // alimentador) de la hoja ACTIVA la comparten, y se resuelve por
  // tramo, no por cable entero. Reemplaza el número que antes se
  // tipeaba a mano por cable (fácil de desincronizar). Solo la hoja
  // activa: agrupar circuitos entre hojas distintas no es un caso real
  // (cada hoja es su propio tablero, con su propio recorrido físico).
  const conteoPorCanalizacion = useMemo(() => {
    const mapa = new Map<string, number>();
    function registrar(tramos: unknown) {
      if (!Array.isArray(tramos)) return;
      for (const t of tramos) {
        const canal = (t as Record<string, unknown> | null)?.canalizacion;
        if (typeof canal !== "string" || canal.trim() === "") continue;
        const clave = canal.trim();
        mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
      }
    }
    for (const c of conexiones) {
      registrar((c.data?.atributosConductor as Record<string, unknown> | undefined)?.tramos);
    }
    for (const n of nodos) {
      if (esDatosAlimentador(n.data)) registrar(n.data.atributos?.tramos);
    }
    return mapa;
  }, [conexiones, nodos]);

  const circuitosAgrupadosDe = useCallback(
    (canal: string | undefined) => {
      if (typeof canal !== "string" || canal.trim() === "") return 1;
      return Math.max(1, conteoPorCanalizacion.get(canal.trim()) ?? 1);
    },
    [conteoPorCanalizacion],
  );

  // Cálculo (Ib / ΔU%) del cable seleccionado — ver lib/calculo.ts. Solo
  // tiene sentido para una conexión real (no para el alimentador: ahí la
  // potencia "aguas abajo" ya es la del proyecto entero, no un tramo).
  const calculoEdge = useMemo(() => {
    if (!edge) return undefined;
    const topo = calcularTopologia(nodos, conexiones);
    const potenciaVa = topo.potenciaConexionVa.get(edge.id) ?? null;
    const trifasica = topo.esTrifasica.get(edge.id) ?? true;
    const ibA = calcularIbA(potenciaVa, trifasica, datosProyecto);
    const atributosConductor =
      (edge.data?.atributosConductor as Record<string, unknown> | undefined) ?? {};
    const tramos = atributosConductor.tramos as TramoInstalacion[] | undefined;
    const caidaPct = calcularCaidaTensionPct(
      { ...atributosConductor, longitud_m: longitudTotalM(tramos) },
      ibA,
      trifasica,
      datosProyecto,
    );
    const iz = calcularIzA(atributosConductor, trifasica, circuitosAgrupadosDe);
    return { ibA, caidaPct, iz, circuitosAgrupadosDe };
  }, [edge, nodos, conexiones, datosProyecto, circuitosAgrupadosDe]);

  // Todo uso de "referencia" en el proyecto entero (todas las hojas,
  // incluida la activa vía `nodos` en vivo — su entrada en
  // `proyecto.hojas` puede estar desactualizada hasta que algo la
  // vuelque). Base común para tres cosas de la ficha técnica de aparato
  // (E52/E53, ver lib/referencia.ts): el aviso de incompatibilidad al
  // editar a mano, el selector "vincular con…" de las piezas accesorio
  // (contacto auxiliar / bobina) y la lista de "vinculado con" que
  // muestra dónde más aparece esa misma referencia — pedido explícito:
  // "en los multifilares... a la hora de hacerlo quedan vinculados para
  // la simulación". Se recalcula solo cuando cambia el árbol de nodos,
  // no en cada tecla tipeada de otros campos.
  const usosPorReferencia = useMemo(() => {
    const mapa = new Map<
      string,
      { id: string; tipoAparato: string; etiqueta: string; hoja: string }[]
    >();
    function registrar(
      id: string,
      codigoIec: string | undefined,
      atributos: Record<string, unknown> | undefined,
      nombreHoja: string,
    ) {
      const ref = atributos?.referencia;
      const tipo = atributos?.tipo_aparato;
      if (typeof ref !== "string" || ref.trim() === "" || typeof tipo !== "string") return;
      const base = (codigoIec && obtenerSimbolo(codigoIec)?.metadata.nombre) ?? codigoIec ?? "Símbolo";
      const mm = [atributos?.marca, atributos?.modelo]
        .filter((v) => typeof v === "string" && v !== "")
        .join(" ");
      const clave = ref.trim();
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push({
        id,
        tipoAparato: tipo,
        etiqueta: mm ? `${base} · ${mm}` : base,
        hoja: nombreHoja,
      });
    }
    for (const h of proyectoHojas) {
      if (h.id === hojaActivaId) continue; // la activa se lee de `nodos`, en vivo
      for (const n of h.nodos ?? []) registrar(n.id, n.codigo_iec, n.atributos, h.nombre);
    }
    const nombreHojaActiva =
      proyectoHojas.find((h) => h.id === hojaActivaId)?.nombre ?? "esta hoja";
    for (const n of nodos) {
      const d = n.data as DatosSimbolo;
      registrar(n.id, d.codigo_iec, d.atributos, nombreHojaActiva);
    }
    return mapa;
  }, [proyectoHojas, nodos, hojaActivaId]);

  const tiposPorReferencia = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    for (const [ref, usos] of usosPorReferencia) {
      mapa.set(ref, new Set(usos.map((u) => u.tipoAparato)));
    }
    return mapa;
  }, [usosPorReferencia]);

  // Referencias ya usadas en el proyecto, para el selector de las
  // piezas "accesorio" — con una etiqueta representativa (preferí un
  // aparato "cuerpo" si hay uno, es el dato más útil para reconocerlo).
  const opcionesReferencia = useMemo(() => {
    const out: { referencia: string; etiqueta: string }[] = [];
    for (const [ref, usos] of usosPorReferencia) {
      const cuerpo = usos.find((u) => !esAccesorioReferencia(u.tipoAparato));
      const rep = cuerpo ?? usos[0];
      out.push({ referencia: ref, etiqueta: `${ref} — ${rep.etiqueta}` });
    }
    return out.sort((a, b) => a.referencia.localeCompare(b.referencia));
  }, [usosPorReferencia]);

  const avisoReferencia = useMemo(() => {
    if (!nodo || esDatosAlimentador(nodo.data)) return null;
    const data = nodo.data as DatosSimbolo;
    const a = data.atributos ?? {};
    const tipo = a.tipo_aparato;
    const ref = a.referencia;
    if (typeof tipo !== "string" || typeof ref !== "string") return null;
    return avisoIncompatibilidadReferencia(tipo, ref, tiposPorReferencia);
  }, [nodo, tiposPorReferencia]);

  // "Vinculado con…": el resto de los símbolos que comparten la MISMA
  // referencia que el seleccionado, para que se vea aunque estén en otra
  // hoja (el resaltado en el lienzo, más abajo en NodoSimbolo.tsx, solo
  // puede pintar los de la hoja activa).
  const vinculosReferencia = useMemo(() => {
    if (!nodo || esDatosAlimentador(nodo.data)) return [];
    const data = nodo.data as DatosSimbolo;
    const ref = data.atributos?.referencia;
    if (typeof ref !== "string" || ref.trim() === "") return [];
    const usos = usosPorReferencia.get(ref.trim()) ?? [];
    return usos.filter((u) => u.id !== nodo.id);
  }, [nodo, usosPorReferencia]);

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

  // E64, bug real encontrado en vivo: presionar un pulsador en modo
  // simulación también lo SELECCIONA (comportamiento normal de React
  // Flow), y este panel abierto puede quedar tapando otro aparato
  // cercano, comiéndose el siguiente clic. Se probó deshabilitar la
  // selección con `elementsSelectable={false}` en App.tsx, pero React
  // Flow también bloquea con eso el pointer-events de TODO el nodo — ya
  // no llegaba ni el clic del pulsador. Ocultar el panel es la solución
  // que no interfiere con el modo simulación en sí: editar una ficha
  // mientras se simula tampoco tiene sentido.
  if (modoSimulacion) return null;
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
            <span className="panel-atributos-sub">Cable</span>
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
            modo={modo}
            normativa={datosProyecto.normativa}
            rol={rolAlimentador}
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
          <>
            <FormularioCarga
              atributos={(nodo.data as DatosSimbolo).atributos}
              onChange={(attrs) => actualizarNodo(nodo.id, attrs)}
            />
            {(nodo.data as DatosSimbolo).atributos.tipo_carga === "seccional" && (
              <HojaHijaAccion nodoId={nodo.id} />
            )}
          </>
        ) : (
          <FormularioAtributos
            familia={
              obtenerSimbolo((nodo.data as DatosSimbolo).codigo_iec)?.metadata
                .familia_atributos ?? "sin_ficha_tecnica"
            }
            atributos={(nodo.data as DatosSimbolo).atributos}
            onChange={(attrs) => actualizarNodo(nodo.id, attrs)}
            avisoReferencia={avisoReferencia}
            opcionesReferencia={opcionesReferencia}
            vinculosReferencia={vinculosReferencia}
          />
        )
      ) : (
        <FormularioConductor
          atributos={
            (edge!.data?.atributosConductor as Record<string, unknown> | undefined) ??
            {}
          }
          onChange={(attrs) => actualizarConexion(edge!.id, attrs)}
          modo={modo}
          normativa={datosProyecto.normativa}
          rol="terminal"
          calculo={calculoEdge}
        />
      )}
    </aside>
  );
}
