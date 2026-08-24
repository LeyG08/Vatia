import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import BarraSuperior from "./componentes/BarraSuperior";
import Paleta from "./componentes/Paleta";
import PanelProblemas from "./componentes/PanelProblemas";
import ChecklistAea from "./componentes/ChecklistAea";
import PanelHoja from "./componentes/PanelHoja";
import PanelAtributos from "./componentes/PanelAtributos";
import PestanasHoja from "./componentes/PestanasHoja";
import NodoSimbolo from "./componentes/NodoSimbolo";
import AlimentadorNode from "./componentes/AlimentadorNode";
import BarraNode from "./componentes/BarraNode";
import HojaNode from "./componentes/HojaNode";
import ConexionEdge from "./componentes/ConexionEdge";
import { ESCALA, useEditor, tamanoNodoPx, type NodoData } from "./lib/store";
import { obtenerSimbolo, svgLimpio } from "./lib/libreria";
import { dimensionesHoja, rectanguloUtil } from "./lib/tipos";

const nodeTypes = {
  simbolo: NodoSimbolo,
  alimentador: AlimentadorNode,
  barra: BarraNode,
  hoja: HojaNode,
} as const;
const edgeTypes = { conexion: ConexionEdge } as const;

const NODO_HOJA: Node<NodoData> = {
  id: "hoja",
  type: "hoja",
  position: { x: 0, y: 0 },
  data: { codigo_iec: "", rotacion: 0, atributos: {} },
  draggable: false,
  selectable: false,
  deletable: false,
  connectable: false,
  style: { zIndex: -1 } as React.CSSProperties,
  // Exenta del clamp global: la lámina es MÁS grande que el marco útil
  extent: [
    [-100000, -100000],
    [100000, 100000],
  ],
};

interface ArrastreEnCurso {
  codigo: string;
  clienteX: number;
  clienteY: number;
}

interface ToastMover {
  mensaje: string;
  destinoId: string | null;
}

interface ZonaRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Un símbolo con bbox en (x,y) invade alguna zona reservada */
function invadeZona(
  zonas: ZonaRect[],
  x: number,
  y: number,
  data: NodoData,
): boolean {
  const t = tamanoNodoPx(data);
  return zonas.some(
    (z) => x < z.x1 && x + t.ancho > z.x0 && y < z.y1 && y + t.alto > z.y0,
  );
}

function Editor() {
  const nodos = useEditor((s) => s.nodos);
  const conexiones = useEditor((s) => s.conexiones);
  const hoja = useEditor((s) => s.hoja);
  const paletaVisible = useEditor((s) => s.paletaVisible);
  const onNodesChange = useEditor((s) => s.onNodesChange);
  const onEdgesChange = useEditor((s) => s.onEdgesChange);
  const onConnect = useEditor((s) => s.onConnect);
  const reconectar = useEditor((s) => s.reconectarConexion);
  const agregarSimbolo = useEditor((s) => s.agregarSimbolo);
  const agregarAlimentador = useEditor((s) => s.agregarAlimentador);
  const registrarArrastre = useEditor((s) => s.registrarArrastre);
  const confirmarArrastre = useEditor((s) => s.confirmarArrastre);
  const rotarSeleccion = useEditor((s) => s.rotarSeleccion);
  const eliminarSeleccion = useEditor((s) => s.eliminarSeleccion);
  const copiarSeleccion = useEditor((s) => s.copiarSeleccion);
  const pegarFn = useEditor((s) => s.pegar);
  const deshacerFn = useEditor((s) => s.deshacer);
  const rehacerFn = useEditor((s) => s.rehacer);
  const hojaActivaId = useEditor((s) => s.hojaActivaId);
  const guardarViewportFn = useEditor((s) => s.guardarViewport);
  const agregarHojaFn = useEditor((s) => s.agregarHoja);
  const seleccionarNodosFn = useEditor((s) => s.seleccionarNodos);
  const moverSeleccionAHojaFn = useEditor((s) => s.moverSeleccionAHoja);
  const cambiarHojaActivaFn = useEditor((s) => s.cambiarHojaActiva);
  const [arrastre, setArrastre] = useState<ArrastreEnCurso | null>(null);
  const arrastreRef = useRef<ArrastreEnCurso | null>(null);
  useEffect(() => {
    arrastreRef.current = arrastre;
  }, [arrastre]);
  const { screenToFlowPosition } = useReactFlow();

  /* Aviso posterior a un movimiento de contenido entre hojas:
   * ofrece saltar a la hoja destino o cerrar el mensaje */
  const [toast, setToast] = useState<ToastMover | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 10000);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* Zonas reservadas (rótulo IRAM, notas del gabinete y nota de
   * seguridad): ningún símbolo puede QUEDAR encima. Los rects se miden
   * en coords de flujo justo antes de validar, así siguen a la hoja
   * activa con su zoom real. */
  const zonasRef = useRef<ZonaRect[]>([]);
  const preArrastreRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  const capturarZonas = useCallback(function capturarZonas(): ZonaRect[] {
    const zonas: ZonaRect[] = [];
    document
      .querySelectorAll<HTMLElement>(".hoja .zona-protegida")
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const a = screenToFlowPosition({ x: r.left, y: r.top });
        const b = screenToFlowPosition({ x: r.right, y: r.bottom });
        zonas.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y });
      });
    return zonas;
  }, [screenToFlowPosition]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) rehacerFn();
        else deshacerFn();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        copiarSeleccion();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        pegarFn();
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        rotarSeleccion();
      }
      if (e.key === "Delete") {
        eliminarSeleccion();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    copiarSeleccion,
    deshacerFn,
    eliminarSeleccion,
    pegarFn,
    rehacerFn,
    rotarSeleccion,
  ]);

  useEffect(() => {
    if (!arrastre) return;
    document.body.classList.add("arrastrando");

    function mover(e: MouseEvent) {
      setArrastre((a) =>
        a ? { ...a, clienteX: e.clientX, clienteY: e.clientY } : a,
      );
    }

    function soltar(e: MouseEvent) {
      document.body.classList.remove("arrastrando");
      const actual = arrastreRef.current;
      setArrastre(null);
      if (!actual) return;
      const sobreLienzo = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest(".lienzo");
      if (!sobreLienzo) return;
      // C13: el ALIMENTADOR también se arrastra desde la paleta
      if (actual.codigo === "@alimentador") {
        const flujo = screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        const x = Math.round(flujo.x / 10) * 10;
        const y = Math.round(flujo.y / 10) * 10;
        const datosPrueba = {
          tipo: "alimentador",
          origen: "",
        } as NodoData;
        if (invadeZona(capturarZonas(), x, y, datosPrueba)) {
          setToast({
            mensaje:
              "Ahí están el rótulo y las notas: soltalo dentro del recuadro",
            destinoId: null,
          });
          return;
        }
        agregarAlimentador(x, y);
        return;
      }
      const simbolo = obtenerSimbolo(actual.codigo);
      if (!simbolo) return;
      const vb = simbolo.viewBox;
      const flujo = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const eje =
        simbolo.metadata.puntos_conexion.reduce((acc, p) => acc + p.x, 0) /
        simbolo.metadata.puntos_conexion.length;
      const offsetXEje = (eje - vb.minX) * ESCALA;
      const x = Math.round((flujo.x - offsetXEje) / 10) * 10;
      const y = Math.round(flujo.y / 10) * 10;
      // La colocación desde la paleta respeta las mismas zonas reservadas
      const datosPrueba = {
        codigo_iec: actual.codigo,
        rotacion: 0,
      } as NodoData;
      if (invadeZona(capturarZonas(), x, y, datosPrueba)) {
        setToast({
          mensaje:
            "Ahí están el rótulo y las notas: soltalo dentro del recuadro",
          destinoId: null,
        });
        return;
      }
      agregarSimbolo(actual.codigo, x, y);
    }

    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    return () => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      document.body.classList.remove("arrastrando");
    };
  }, [
    agregarSimbolo,
    agregarAlimentador,
    arrastre,
    capturarZonas,
    screenToFlowPosition,
  ]);

  const iniciarArrastre = useCallback(
    (codigo: string, e: React.MouseEvent) => {
      e.preventDefault();
      setArrastre({ codigo, clienteX: e.clientX, clienteY: e.clientY });
    },
    [],
  );

  const simboloFantasma = arrastre ? obtenerSimbolo(arrastre.codigo) : null;
  let offsetFantasmaX = 0;
  if (simboloFantasma) {
    const pc = simboloFantasma.metadata.puntos_conexion;
    const eje = pc.reduce((acc, p) => acc + p.x, 0) / pc.length;
    offsetFantasmaX =
      (eje - simboloFantasma.viewBox.minX) * ESCALA;
  }

  const nodosConHoja = useMemo<Node<NodoData>[]>(
    () => [NODO_HOJA, ...nodos],
    [nodos],
  );

  /* Hoja como único espacio de trabajo: el viewport no puede escapar de
   * la lámina y ningún símbolo se coloca fuera del marco útil (los
   * márgenes IRAM quedan reservados para rótulo, notas y encuadre). */
  const { pxW, pxH } = dimensionesHoja(hoja);
  const PAD = 40;
  const util = rectanguloUtil(hoja);
  const extensionVista = useMemo<
    [[number, number], [number, number]]
  >(
    () => [
      [-PAD, -PAD],
      [pxW + PAD, pxH + PAD],
    ],
    [pxW, pxH],
  );
  // Límite duro de arrastre: el recuadro útil, no la lámina completa
  const extensionNodos = useMemo<
    [[number, number], [number, number]]
  >(
    () => [
      [util.x0, util.y0],
      [util.x1, util.y1],
    ],
    [util.x0, util.y0, util.x1, util.y1],
  );

  // Reencuadra la hoja cuando cambia el formato u orientación
  const { fitView, setViewport } = useReactFlow();
  useEffect(() => {
    const t = window.setTimeout(() => fitView({ padding: 0.12, duration: 150 }), 60);
    return () => window.clearTimeout(t);
  }, [fitView, pxW, pxH]);

  // Cada hoja recuerda su propio encuadre: al cambiar de pestaña se
  // restaura el viewport guardado (o se reencuadra si nunca hubo uno)
  useEffect(() => {
    const t = window.setTimeout(() => {
      const { proyecto } = useEditor.getState();
      const destino = proyecto.hojas.find((h) => h.id === hojaActivaId);
      if (destino?.viewport) {
        setViewport(destino.viewport);
      } else {
        fitView({ padding: 0.12, duration: 150 });
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [fitView, setViewport, hojaActivaId]);

  // Símbolos que se van del marco útil: hay que pasarlos a otra hoja
  const idsFuera = useMemo(() => {
    const ids = new Set<string>();
    for (const n of nodos) {
      const t = tamanoNodoPx(n.data);
      if (
        n.position.x < util.x0 ||
        n.position.y < util.y0 ||
        n.position.x + t.ancho > util.x1 ||
        n.position.y + t.alto > util.y1
      ) {
        ids.add(n.id);
      }
    }
    return ids;
  }, [nodos, util.x0, util.y0, util.x1, util.y1]);

  const nodosMarcados = useMemo(
    () =>
      nodosConHoja.map((n) =>
        idsFuera.has(n.id)
          ? { ...n, className: "nodo-fuera-hoja" }
          : n,
      ),
    [nodosConHoja, idsFuera],
  );

  /** Regla "mover a hoja nueva": crea la hoja, selecciona los símbolos
   * fuera del marco y ejecuta el movimiento compuesto deshacible */
  function moverFueraANuevaHoja() {
    if (idsFuera.size === 0) return;
    const nuevaId = agregarHojaFn();
    seleccionarNodosFn([...idsFuera]);
    const r = moverSeleccionAHojaFn(nuevaId);
    if (!r) return;
    const { proyecto } = useEditor.getState();
    const destino = proyecto.hojas.find((h) => h.id === nuevaId);
    const cortadas =
      r.cortadas > 0
        ? ` — ${r.cortadas} conexión${r.cortadas === 1 ? "" : "es"} cortada${r.cortadas === 1 ? "" : "s"}`
        : "";
    setToast({
      mensaje: `${r.movidos} símbolo${r.movidos === 1 ? "" : "s"} movido${r.movidos === 1 ? "" : "s"} a «${destino?.nombre ?? "nueva hoja"}»${cortadas}`,
      destinoId: nuevaId,
    });
  }

  return (
    <div className="cuerpo">
      {paletaVisible && <Paleta onIniciarArrastre={iniciarArrastre} />}
      <div className="lienzo">
        {idsFuera.size > 0 && (
          <div className="aviso-fuera-hoja" role="alert">
            <span>
              {idsFuera.size} símbolo{idsFuera.size > 1 ? "s" : ""} fuera del
              marco útil
            </span>
            <button type="button" onClick={moverFueraANuevaHoja}>
              Mover a hoja nueva →
            </button>
          </div>
        )}
        {toast && (
          <div className="toast-mover" role="status">
            <span>{toast.mensaje}</span>
            {toast.destinoId && (
              <button
                type="button"
                onClick={() => cambiarHojaActivaFn(toast.destinoId as string)}
              >
                Ir a la hoja →
              </button>
            )}
            <button
              type="button"
              className="cerrar"
              title="Cerrar aviso"
              onClick={() => setToast(null)}
            >
              ✕
            </button>
          </div>
        )}
        <PanelAtributos />
        <ReactFlow
          nodes={nodosMarcados}
          edges={conexiones}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={(edgeViejo, conexionNueva) =>
            reconectar(edgeViejo.id, conexionNueva)
          }
          edgesReconnectable={true}
          isValidConnection={(c) => c.source !== c.target && c.source !== "hoja" && c.target !== "hoja"}
          onNodeDragStart={(_, nodo) => {
            registrarArrastre([nodo.id]);
            zonasRef.current = capturarZonas();
            preArrastreRef.current = new Map(
              useEditor.getState().nodos.map((n) => [
                n.id,
                { ...n.position },
              ]),
            );
          }}
          onMoveEnd={(_, vp) => guardarViewportFn(vp)}
          onNodeDragStop={(_, nodo, nodosAfectados) => {
            const afectados = nodosAfectados ?? [nodo];
            let revertidos = 0;
            const reversiones: {
              id: string;
              type: "position";
              position: { x: number; y: number };
              dragging: boolean;
            }[] = [];
            const despues: Record<string, { x: number; y: number }> = {};
            for (const n of afectados) {
              const rx = Math.round(n.position.x);
              const ry = Math.round(n.position.y);
              const previa = preArrastreRef.current.get(n.id);
              if (
                previa &&
                invadeZona(
                  zonasRef.current,
                  rx,
                  ry,
                  n.data,
                )
              ) {
                /* FIX rebote: revertir DIRECTO por onNodesChange.
                 * No depende de confirmarArrastre, que hace return sin
                 * ejecutar cuando la posición final coincide con el
                 * snapshot inicial (exactamente el caso del rebote). */
                reversiones.push({
                  id: n.id,
                  type: "position",
                  position: previa,
                  dragging: false,
                });
                revertidos += 1;
              } else {
                despues[n.id] = { x: rx, y: ry };
              }
            }
            if (reversiones.length > 0) onNodesChange(reversiones);
            confirmarArrastre(despues);
            if (revertidos > 0) {
              setToast({
                mensaje: `Rótulo y notas están reservados: ${revertidos} símbolo${revertidos === 1 ? "" : "s"} volvió${revertidos === 1 ? "" : "ron"} a su lugar`,
                destinoId: null,
              });
            }
          }}
          snapToGrid
          snapGrid={[10, 10]}
          deleteKeyCode={[]}
          panOnDrag={[1]}
          selectionOnDrag
          multiSelectionKeyCode="Control"
          zoomOnDoubleClick={false}
          minZoom={0.1}
          maxZoom={2.5}
          translateExtent={extensionVista}
          nodeExtent={extensionNodos}
          defaultEdgeOptions={{
            type: "conexion",
            style: { strokeWidth: 1.5, stroke: "#1e293b" },
          }}
          /* C17: radio de imán generoso — al soltar una punta de cable
           * (o al conectar) agarra el handle MÁS CERCANO sin apuntar
           * fino: mover extremos de conexión queda sencillo. */
          connectionRadius={30}
          fitView
          proOptions={{ hideAttribution: true }}
        />
        <div className="paneles-flotantes">
          <ChecklistAea />
          <PanelProblemas />
        </div>
        <PanelHoja />
      </div>
      {arrastre && simboloFantasma && (
        <div
          className="fantasma-arrastre"
          style={{
            left: arrastre.clienteX - offsetFantasmaX,
            top: arrastre.clienteY,
            width: Math.round(simboloFantasma.viewBox.ancho * ESCALA),
            height: Math.round(simboloFantasma.viewBox.alto * ESCALA),
          }}
          dangerouslySetInnerHTML={{
            __html: svgLimpio(simboloFantasma.svgRaw),
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="app">
        <BarraSuperior />
        <PestanasHoja />
        <Editor />
      </div>
    </ReactFlowProvider>
  );
}
