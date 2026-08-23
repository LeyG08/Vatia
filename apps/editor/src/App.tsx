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
import PanelHoja from "./componentes/PanelHoja";
import NodoSimbolo from "./componentes/NodoSimbolo";
import AlimentadorNode from "./componentes/AlimentadorNode";
import HojaNode from "./componentes/HojaNode";
import ConexionEdge from "./componentes/ConexionEdge";
import { ESCALA, useEditor, tamanoNodoPx, type NodoData } from "./lib/store";
import { obtenerSimbolo, svgLimpio } from "./lib/libreria";
import { dimensionesHoja, rectanguloUtil } from "./lib/tipos";

const nodeTypes = {
  simbolo: NodoSimbolo,
  alimentador: AlimentadorNode,
  hoja: HojaNode,
} as const;
const edgeTypes = { conexion: ConexionEdge } as const;

const NODO_HOJA: Node<NodoData> = {
  id: "hoja",
  type: "hoja",
  position: { x: 0, y: 0 },
  data: { codigo_iec: "", rotacion: 0 },
  draggable: false,
  selectable: false,
  deletable: false,
  connectable: false,
  style: { zIndex: -1 } as React.CSSProperties,
};

interface ArrastreEnCurso {
  codigo: string;
  clienteX: number;
  clienteY: number;
}

function Editor() {
  const nodos = useEditor((s) => s.nodos);
  const conexiones = useEditor((s) => s.conexiones);
  const hoja = useEditor((s) => s.hoja);
  const paletaVisible = useEditor((s) => s.paletaVisible);
  const onNodesChange = useEditor((s) => s.onNodesChange);
  const onEdgesChange = useEditor((s) => s.onEdgesChange);
  const onConnect = useEditor((s) => s.onConnect);
  const agregarSimbolo = useEditor((s) => s.agregarSimbolo);
  const registrarArrastre = useEditor((s) => s.registrarArrastre);
  const confirmarArrastre = useEditor((s) => s.confirmarArrastre);
  const rotarSeleccion = useEditor((s) => s.rotarSeleccion);
  const eliminarSeleccion = useEditor((s) => s.eliminarSeleccion);
  const copiarSeleccion = useEditor((s) => s.copiarSeleccion);
  const pegarFn = useEditor((s) => s.pegar);
  const deshacerFn = useEditor((s) => s.deshacer);
  const rehacerFn = useEditor((s) => s.rehacer);
  const [arrastre, setArrastre] = useState<ArrastreEnCurso | null>(null);
  const arrastreRef = useRef<ArrastreEnCurso | null>(null);
  useEffect(() => {
    arrastreRef.current = arrastre;
  }, [arrastre]);
  const { screenToFlowPosition } = useReactFlow();

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
      agregarSimbolo(actual.codigo, x, y);
    }

    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    return () => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      document.body.classList.remove("arrastrando");
    };
  }, [agregarSimbolo, arrastre, screenToFlowPosition]);

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
   * la lámina y ningún símbolo se coloca fuera del marco útil. */
  const { pxW, pxH } = dimensionesHoja(hoja);
  const PAD = 40;
  const extensionVista = useMemo<
    [[number, number], [number, number]]
  >(
    () => [
      [-PAD, -PAD],
      [pxW + PAD, pxH + PAD],
    ],
    [pxW, pxH],
  );
  const extensionNodos = useMemo<
    [[number, number], [number, number]]
  >(
    () => [
      [0, 0],
      [pxW, pxH],
    ],
    [pxW, pxH],
  );

  // Reencuadra la hoja cuando cambia el formato u orientación
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = window.setTimeout(() => fitView({ padding: 0.12, duration: 150 }), 60);
    return () => window.clearTimeout(t);
  }, [fitView, pxW, pxH]);

  // Símbolos que se van del marco útil: hay que pasarlos a otra hoja
  const util = rectanguloUtil(hoja);
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

  return (
    <div className="cuerpo">
      {paletaVisible && <Paleta onIniciarArrastre={iniciarArrastre} />}
      <div className="lienzo">
        {idsFuera.size > 0 && (
          <div className="aviso-fuera-hoja" role="alert">
            {idsFuera.size} símbolo{idsFuera.size > 1 ? "s" : ""} fuera del
            marco útil — pasá el contenido a otra hoja
          </div>
        )}
        <ReactFlow
          nodes={nodosMarcados}
          edges={conexiones}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={(c) => c.source !== c.target && c.source !== "hoja" && c.target !== "hoja"}
          onNodeDragStart={(_, nodo) => registrarArrastre([nodo.id])}
          onNodeDragStop={(_, nodo, nodosAfectados) => {
            const despues: Record<string, { x: number; y: number }> = {};
            for (const n of nodosAfectados ?? [nodo]) {
              despues[n.id] = {
                x: Math.round(n.position.x),
                y: Math.round(n.position.y),
              };
            }
            confirmarArrastre(despues);
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
          connectionRadius={12}
          fitView
          proOptions={{ hideAttribution: true }}
        />
        <PanelProblemas />
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
        <Editor />
      </div>
    </ReactFlowProvider>
  );
}
