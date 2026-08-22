import { useCallback, useEffect } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import BarraSuperior from "./componentes/BarraSuperior";
import Paleta from "./componentes/Paleta";
import PanelProblemas from "./componentes/PanelProblemas";
import NodoSimbolo from "./componentes/NodoSimbolo";
import { useEditor } from "./lib/store";

const nodeTypes = { simbolo: NodoSimbolo } as const;

function Lienzo() {
  const nodos = useEditor((s) => s.nodos);
  const conexiones = useEditor((s) => s.conexiones);
  const onNodesChange = useEditor((s) => s.onNodesChange);
  const onEdgesChange = useEditor((s) => s.onEdgesChange);
  const onConnect = useEditor((s) => s.onConnect);
  const agregarSimbolo = useEditor((s) => s.agregarSimbolo);
  const registrarArrastre = useEditor((s) => s.registrarArrastre);
  const confirmarArrastre = useEditor((s) => s.confirmarArrastre);
  const rotarSeleccion = useEditor((s) => s.rotarSeleccion);
  const eliminarSeleccion = useEditor((s) => s.eliminarSeleccion);
  const deshacerFn = useEditor((s) => s.deshacer);
  const rehacerFn = useEditor((s) => s.rehacer);
  const { screenToFlowPosition } = useReactFlow();

  const soltarDesdePaleta = useCallback(
    (evento: React.DragEvent) => {
      evento.preventDefault();
      const codigo = evento.dataTransfer.getData("application/vatia-simbolo");
      if (!codigo) return;
      const posicion = screenToFlowPosition({
        x: evento.clientX,
        y: evento.clientY,
      });
      agregarSimbolo(
        codigo,
        Math.round(posicion.x / 10) * 10,
        Math.round(posicion.y / 10) * 10,
      );
    },
    [agregarSimbolo, screenToFlowPosition],
  );

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
  }, [deshacerFn, eliminarSeleccion, rehacerFn, rotarSeleccion]);

  return (
    <div
      className="lienzo"
      onDrop={soltarDesdePaleta}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
    >
      <ReactFlow
        nodes={nodos}
        edges={conexiones}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={(c) => c.source !== c.target}
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
        multiSelectionKeyCode={["Shift"]}
        defaultEdgeOptions={{ type: "step" }}
        connectionRadius={24}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={10} size={1} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
      <PanelProblemas />
    </div>
  );
}

function Cuerpo() {
  const agregarSimbolo = useEditor((s) => s.agregarSimbolo);
  const { screenToFlowPosition } = useReactFlow();

  function agregarAlCentro(codigo: string) {
    const contenedor = document.querySelector(".lienzo");
    const rect = contenedor?.getBoundingClientRect();
    const centro = rect
      ? screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      : { x: 0, y: 0 };
    agregarSimbolo(
      codigo,
      Math.round(centro.x / 10) * 10,
      Math.round(centro.y / 10) * 10,
    );
  }

  return (
    <div className="cuerpo">
      <Paleta onAgregar={agregarAlCentro} />
      <Lienzo />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="app">
        <BarraSuperior />
        <Cuerpo />
      </div>
    </ReactFlowProvider>
  );
}
