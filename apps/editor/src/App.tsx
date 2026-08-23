import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import BarraSuperior from "./componentes/BarraSuperior";
import Paleta from "./componentes/Paleta";
import PanelProblemas from "./componentes/PanelProblemas";
import NodoSimbolo from "./componentes/NodoSimbolo";
import { ESCALA, useEditor } from "./lib/store";
import { obtenerSimbolo, svgLimpio } from "./lib/libreria";

const nodeTypes = { simbolo: NodoSimbolo } as const;

interface ArrastreEnCurso {
  codigo: string;
  clienteX: number;
  clienteY: number;
}

function Editor() {
  const nodos = useEditor((s) => s.nodos);
  const conexiones = useEditor((s) => s.conexiones);
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

  return (
    <div className="cuerpo">
      {paletaVisible && <Paleta onIniciarArrastre={iniciarArrastre} />}
      <div className="lienzo">
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
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Control"
          defaultEdgeOptions={{
            type: "step",
            style: { strokeWidth: 1.5, stroke: "#1e293b" },
          }}
          connectionRadius={12}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={10} size={1} />
        </ReactFlow>
        <PanelProblemas />
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
