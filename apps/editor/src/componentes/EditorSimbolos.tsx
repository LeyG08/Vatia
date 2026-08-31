import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas as FabricCanvas, Circle, FabricObject, Line, Textbox, loadSVGFromString } from "fabric";
import { SIMBOLOS } from "../lib/libreria";
import { historialCanvas } from "../lib/historialCanvas";
import type { SimboloDef } from "../lib/tipos";

const ESCALA_EDICION = 20;

/**
 * Offset que lleva las coordenadas del SVG a las del canvas de edición:
 *
 *   canvasX = svgX * ESCALA_EDICION + offset.x
 *
 * Lleva DOS términos y omitir el segundo era el bug que arrastraban C37–C40:
 *
 *  1. el centrado del símbolo dentro del área visible, y
 *  2. el ORIGEN DEL VIEWBOX. Un símbolo cuyo viewBox arranca en (-10, -35)
 *     —como S00110— dibuja en coordenadas negativas; sin restar el origen,
 *     su terminal de entrada en y=-30 caía en -557 px y el símbolo aparecía
 *     cortado por arriba.
 *
 * Todas las conversiones SVG↔canvas del editor (carga de primitivas, guardado,
 * puntos de conexión y grilla) leen este mismo offset desde offsetRef, así que
 * corregirlo acá las corrige a todas de forma coherente.
 */
function offsetDeEncuadre(
  fc: FabricCanvas,
  vb: SimboloDef["viewBox"],
  zoom: number,
): { x: number; y: number } {
  return {
    x: (fc.getWidth() / zoom - vb.ancho * ESCALA_EDICION) / 2 - vb.minX * ESCALA_EDICION,
    y: (fc.getHeight() / zoom - vb.alto * ESCALA_EDICION) / 2 - vb.minY * ESCALA_EDICION,
  };
}

const ESTADOS: Array<{ valor: string; etiqueta: string }> = [
  { valor: "pendiente_revision", etiqueta: "Pendiente" },
  { valor: "verificado", etiqueta: "Verificado" },
  { valor: "corregido", etiqueta: "Corregido" },
];

interface Props {
  codigoInicial?: string;
}

export default function EditorSimbolos({ codigoInicial }: Props) {
  const [filtro, setFiltro] = useState("");
  const [seleccionado, setSeleccionado] = useState<SimboloDef | null>(
    codigoInicial ? (SIMBOLOS.get(codigoInicial) ?? null) : null,
  );
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [editando, setEditando] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [, forceRender] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0, zoom: 1 });
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const [gridVersion, setGridVersion] = useState(0);

  // Zoom mostrado en la toolbar. Es estado y no una lectura de
  // fabricRef.current durante el render: leer un ref mutable mientras se
  // renderiza devuelve el valor de la pasada anterior.
  const [zoomActual, setZoomActual] = useState(1);

  const lista = useMemo(() => {
    const todos = [...SIMBOLOS.values()].sort((a, b) =>
      a.codigo_iec.localeCompare(b.codigo_iec),
    );
    if (!filtro.trim()) return todos;
    const q = filtro.toLowerCase();
    return todos.filter(
      (s) =>
        s.codigo_iec.toLowerCase().includes(q) ||
        s.metadata.nombre.toLowerCase().includes(q),
    );
    // `tick` es deliberado y NO sobra, aunque oxlint lo marque: SIMBOLOS es un
    // Map de módulo que el HMR de la librería muta EN EL LUGAR, así que su
    // identidad nunca cambia y el memo no se recalcularía solo. `tick` es lo
    // que fuerza el recálculo cuando llega un metadata-update o un svg-update.
  }, [filtro, tick]);

  const seleccionar = useCallback((s: SimboloDef) => {
    historialCanvas.limpiar();
    setSeleccionado(s);
    setEditando(false);
    setDirty(false);
    setMensaje(null);
  }, []);

  const cambiarEstado = useCallback(async (nuevoEstado: string) => {
    if (!seleccionado || guardando) return;
    const codigo = seleccionado.codigo_iec;
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, estado: nuevoEstado }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.sin_cambio) {
          setMensaje("Sin cambios");
        } else {
          setMensaje(`${codigo}: ${data.anterior} → ${data.nuevo}`);
          if (data.metadata) {
            const prev = SIMBOLOS.get(codigo);
            if (prev) prev.metadata = data.metadata;
            setSeleccionado(prev ? { ...prev, metadata: data.metadata } : null);
            setTick((t) => t + 1);
          }
        }
      } else {
        setMensaje(`Error: ${data.error}`);
      }
    } catch (err) {
      setMensaje(`Error de red: ${String(err)}`);
    } finally {
      setGuardando(false);
    }
  }, [seleccionado, guardando]);

  const guardarGeometria = useCallback(async () => {
    const fc = fabricRef.current;
    if (!fc || !seleccionado || guardando) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const vb = seleccionado.viewBox;
      const { x: offsetX, y: offsetY } = offsetRef.current;

      const prims = fc.getObjects().filter((o) => (o as any)._esPrimitiva);
      if (prims.length === 0) { setMensaje("No hay primitivas"); setGuardando(false); return; }

      const markers = fc.getObjects().filter((o) => !(o as any)._esPrimitiva);
      const savedPrims = prims.map((p) => ({
        obj: p, left: p.left ?? 0, top: p.top ?? 0, scaleX: p.scaleX ?? 1, scaleY: p.scaleY ?? 1,
      }));
      const savedMarkers = markers.map((m) => ({ obj: m, visible: m.visible }));

      markers.forEach((m) => m.set("visible", false));

      for (const p of prims) {
        const svgX = ((p.left ?? 0) - offsetX) / ESCALA_EDICION;
        const svgY = ((p.top ?? 0) - offsetY) / ESCALA_EDICION;
        p.set({ left: svgX, top: svgY, scaleX: 1, scaleY: 1 });
      }

      fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
      fc.renderAll();

      let rawSvg = fc.toSVG();
      rawSvg = rawSvg.replace(/<svg[^>]*>/, "").replace(/<\/svg>$/, "").trim();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.minX} ${vb.minY} ${vb.ancho} ${vb.alto}">${rawSvg}</svg>`;

      for (const s of savedPrims) {
        s.obj.set({ left: s.left, top: s.top, scaleX: s.scaleX, scaleY: s.scaleY });
      }
      for (const s of savedMarkers) {
        s.obj.set("visible", s.visible);
      }

      const zoomX = (fc.getWidth() - 60) / (vb.ancho * ESCALA_EDICION);
      const zoomY = (fc.getHeight() - 60) / (vb.alto * ESCALA_EDICION);
      const zoom = Math.min(zoomX, zoomY, 1);
      fc.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
      fc.renderAll();

      const res = await fetch("/api/geometry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: seleccionado.codigo_iec, svg }),
      });
      const data = await res.json();
      if (data.ok) {
        const prev = SIMBOLOS.get(seleccionado.codigo_iec);
        if (prev) { prev.svgRaw = data.svg; prev.viewBox = data.viewBox; }
        setSeleccionado(prev ? { ...prev, svgRaw: data.svg, viewBox: data.viewBox } as SimboloDef : null);
        setTick((t) => t + 1);
        setDirty(false);
        setEditando(false);
        historialCanvas.limpiar();
        setMensaje("Geometría guardada");
      } else {
        setMensaje(`Lint: ${data.errores.join("; ")}`);
      }
    } catch (err) {
      setMensaje(`Error: ${String(err)}`);
    } finally {
      setGuardando(false);
    }
  }, [seleccionado, guardando]);

  const cancelarEdicion = useCallback(() => {
    historialCanvas.limpiar();
    setEditando(false);
    setDirty(false);
    setMensaje(null);
    setSeleccionado((sel) => sel ? { ...sel } : null);
  }, []);

  const toggleEdicion = useCallback(() => {
    if (editando) {
      cancelarEdicion();
    } else {
      historialCanvas.limpiar();
      setEditando(true);
      setDirty(false);
    }
  }, [editando, cancelarEdicion]);

  const aplicarZoom = useCallback((factor: number, cx: number, cy: number) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const vt = fc.viewportTransform!;
    const oldZoom = vt[0];
    const newZoom = Math.max(0.05, Math.min(20, oldZoom * factor));
    const r = newZoom / oldZoom;
    vt[0] = newZoom;
    vt[3] = newZoom;
    vt[4] = cx - (cx - vt[4]) * r;
    vt[5] = cy - (cy - vt[5]) * r;
    fc.setViewportTransform(vt);
    fc.renderAll();
    setGridVersion((v) => v + 1);
    setZoomActual(newZoom);
  }, []);

  const zoomIn = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    aplicarZoom(1.25, fc.getWidth() / 2, fc.getHeight() / 2);
  }, [aplicarZoom]);

  const zoomOut = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    aplicarZoom(0.8, fc.getWidth() / 2, fc.getHeight() / 2);
  }, [aplicarZoom]);

  const zoomFit = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc || !seleccionado) return;
    const vb = seleccionado.viewBox;
    const zx = (fc.getWidth() - 60) / (vb.ancho * ESCALA_EDICION);
    const zy = (fc.getHeight() - 60) / (vb.alto * ESCALA_EDICION);
    const zoom = Math.min(zx, zy, 1);
    const { x: ox, y: oy } = offsetDeEncuadre(fc, vb, zoom);
    fc.setViewportTransform([zoom, 0, 0, zoom, ox, oy]);
    offsetRef.current = { x: ox, y: oy, zoom };
    fc.renderAll();
    setGridVersion((v) => v + 1);
    setZoomActual(zoom);
  }, [seleccionado]);

  // Metadata update listener (external edits)
  useEffect(() => {
    const handler = (e: Event) => {
      const { codigo, metadata } = (e as CustomEvent).detail;
      const prev = SIMBOLOS.get(codigo);
      if (prev) prev.metadata = metadata;
      setSeleccionado((sel) =>
        sel?.codigo_iec === codigo ? { ...sel, metadata } as SimboloDef : sel,
      );
      setTick((t) => t + 1);
    };
    window.addEventListener("vatia:metadata-update", handler);
    return () => window.removeEventListener("vatia:metadata-update", handler);
  }, []);

  // SVG update listener (external edits)
  useEffect(() => {
    const handler = (e: Event) => {
      const { codigo, svg, viewBox } = (e as CustomEvent).detail;
      const prev = SIMBOLOS.get(codigo);
      if (prev) { prev.svgRaw = svg; prev.viewBox = viewBox; }
      setSeleccionado((sel) =>
        sel?.codigo_iec === codigo ? { ...sel, svgRaw: svg, viewBox } as SimboloDef : sel,
      );
      setTick((t) => t + 1);
    };
    window.addEventListener("vatia:svg-update", handler);
    return () => window.removeEventListener("vatia:svg-update", handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) historialCanvas.rehacerFn();
        else historialCanvas.deshacerFn();
        forceRender((n) => n + 1);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomIn();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        zoomFit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editando, zoomIn, zoomOut, zoomFit]);

  // Canvas initialization
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fc = new FabricCanvas(canvasRef.current, {
      width: rect.width,
      height: rect.height,
      backgroundColor: "var(--bg-surface-alt)",
      selection: false,
      renderOnAddRemove: true,
    });
    fabricRef.current = fc;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        fc.setDimensions({ width, height });
        fc.renderAll();
        setGridVersion((v) => v + 1);
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      fc.dispose();
      fabricRef.current = null;
    };
  }, []);

  // SVG rendering: strip viewBox, inline <g>, load flat primitives
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc || !seleccionado) return;

    fc.clear();
    historialCanvas.limpiar();
    setEditando(false);
    setDirty(false);

    const vb = seleccionado.viewBox;
    const svgRaw = seleccionado.svgRaw;

    const tempDiv = document.createElement("div");
    const cleanInner = inlineSvgGroups(svgRaw);
    tempDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">${cleanInner}</svg>`;
    const svgEl = tempDiv.querySelector("svg");
    if (!svgEl) return;

    loadSVGFromString(svgEl.outerHTML).then((result) => {
      const objs = result.objects.filter(Boolean) as FabricObject[];
      if (objs.length === 0) return;

      const zx = (fc.getWidth() - 60) / (vb.ancho * ESCALA_EDICION);
      const zy = (fc.getHeight() - 60) / (vb.alto * ESCALA_EDICION);
      const zoom = Math.min(zx, zy, 1);
      fc.setZoom(zoom);

      const { x: ox, y: oy } = offsetDeEncuadre(fc, vb, zoom);

      for (const obj of objs) {
        // OJO con el origen: loadSVGFromString devuelve las primitivas con
        // originX/originY = "center" y left/top apuntando al CENTRO de su caja.
        // Forzar aquí originX:"left"/originY:"top" NO reposiciona nada — Fabric
        // se limita a reinterpretar left/top como esquina, y cada primitiva se
        // corre media caja. Ese era el desfase que partía el símbolo en dos
        // fragmentos (C37–C40). Se conserva el origen que trae Fabric.
        obj.set({
          left: (obj.left ?? 0) * ESCALA_EDICION + ox,
          top: (obj.top ?? 0) * ESCALA_EDICION + oy,
          scaleX: ESCALA_EDICION,
          scaleY: ESCALA_EDICION,
          selectable: false,
          evented: false,
        });
        (obj as any)._esPrimitiva = true;
        fc.add(obj);
      }

      offsetRef.current = { x: ox, y: oy, zoom };
      dibujarPuntosConexion(fc, seleccionado, ox, oy);
      fc.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
      fc.renderAll();
      setZoomActual(zoom);
    });
  }, [seleccionado]);

  // Toggle edit mode on canvas objects
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    if (editando) {
      fc.getObjects().forEach((obj) => {
        if ((obj as any)._esPrimitiva) {
          obj.set({ selectable: true, evented: true });
        }
      });
      fc.selection = false;

      const prevPositions = new Map<FabricObject, { left: number; top: number }>();

      const movingHandler = (e: any) => {
        const obj = e.target as FabricObject;
        if ((obj as any)._esPrimitiva && !prevPositions.has(obj)) {
          prevPositions.set(obj, { left: obj.left ?? 0, top: obj.top ?? 0 });
        }
      };

      const modifiedHandler = (e: any) => {
        const obj = e.target as FabricObject;
        if (!(obj as any)._esPrimitiva) return;
        const prev = prevPositions.get(obj);
        if (!prev) return;
        const leftAntes = prev.left;
        const topAntes = prev.top;
        const leftNuevo = obj.left ?? 0;
        const topNuevo = obj.top ?? 0;

        prevPositions.delete(obj);

        if (leftAntes !== leftNuevo || topAntes !== topNuevo) {
          const cmd = {
            descripcion: `Mover ${obj.type ?? "objeto"}`,
            do: () => { obj.set({ left: leftNuevo, top: topNuevo }); fc.renderAll(); },
            undo: () => { obj.set({ left: leftAntes, top: topAntes }); fc.renderAll(); },
          };
          historialCanvas.ejecutar(cmd);
          setDirty(true);
          forceRender((n) => n + 1);
        }
      };

      fc.on("object:moving", movingHandler);
      fc.on("object:modified", modifiedHandler);

      return () => {
        fc.off("object:moving", movingHandler);
        fc.off("object:modified", modifiedHandler);
      };
    } else {
      fc.getObjects().forEach((obj) => {
        obj.set({ selectable: false, evented: false });
      });
      fc.selection = false;
      fc.renderAll();
    }
  }, [editando]);

  // Grid overlay via Canvas2D
  useEffect(() => {
    const gridCanvas = gridCanvasRef.current;
    const fc = fabricRef.current;
    if (!gridCanvas || !fc) return;

    const w = fc.getWidth();
    const h = fc.getHeight();
    gridCanvas.width = w;
    gridCanvas.height = h;
    const ctx = gridCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    if (!editando || !seleccionado) return;

    const vt = fc.viewportTransform!;
    const [a, , , d, e, f] = vt;
    const MULTIPLO = 10;
    const { x: offsetX, y: offsetY } = offsetRef.current;

    const sxOff = a * offsetX + e;
    const syOff = d * offsetY + f;

    const svgLeft = -sxOff / (a * ESCALA_EDICION);
    const svgRight = (w - sxOff) / (a * ESCALA_EDICION);
    const svgTop = -syOff / (d * ESCALA_EDICION);
    const svgBottom = (h - syOff) / (d * ESCALA_EDICION);
    const x0 = Math.floor(svgLeft / MULTIPLO) * MULTIPLO;
    const y0 = Math.floor(svgTop / MULTIPLO) * MULTIPLO;

    ctx.fillStyle = "rgba(100,116,139,0.5)";
    for (let x = x0; x <= svgRight; x += MULTIPLO) {
      for (let y = y0; y <= svgBottom; y += MULTIPLO) {
        const sx = a * x * ESCALA_EDICION + sxOff;
        const sy = d * y * ESCALA_EDICION + syOff;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [editando, seleccionado, gridVersion]);

  // Zoom: mouse wheel (works when symbol selected, regardless of edit mode)
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc || !seleccionado) return;

    const onWheel = (opt: any) => {
      const e = opt.e as WheelEvent;
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.1 : 1 / 1.1;
      aplicarZoom(factor, e.offsetX, e.offsetY);
    };

    fc.on("mouse:wheel", onWheel);
    return () => { fc.off("mouse:wheel", onWheel); };
  }, [seleccionado, aplicarZoom]);

  // Panning: Space+drag OR middle-click drag (works when symbol selected)
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc || !seleccionado) return;

    let spaceHeld = false;
    let active = false;
    let lastX = 0;
    let lastY = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        spaceHeld = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") { spaceHeld = false; active = false; }
    };

    const onMouseDown = (opt: any) => {
      if (spaceHeld || opt.e.button === 1) {
        active = true;
        lastX = opt.e.clientX;
        lastY = opt.e.clientY;
        fc.selection = false;
        opt.e.preventDefault();
      }
    };
    const onMouseMove = (opt: any) => {
      if (!active) return;
      const dx = opt.e.clientX - lastX;
      const dy = opt.e.clientY - lastY;
      lastX = opt.e.clientX;
      lastY = opt.e.clientY;
      const vt = fc.viewportTransform!;
      vt[4] += dx;
      vt[5] += dy;
      fc.setViewportTransform(vt);
      fc.renderAll();
      setGridVersion((v) => v + 1);
    };
    const onMouseUp = () => { active = false; };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    fc.on("mouse:down", onMouseDown);
    fc.on("mouse:move", onMouseMove);
    fc.on("mouse:up", onMouseUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      fc.off("mouse:down", onMouseDown);
      fc.off("mouse:move", onMouseMove);
      fc.off("mouse:up", onMouseUp);
    };
  }, [seleccionado]);

  return (
    <div className="editor-simbolos">
      <div className="editor-simbolos-panel">
        <div className="editor-simbolos-buscar">
          <input
            type="text"
            placeholder="Buscar símbolo..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
          <span className="editor-simbolos-count">{lista.length}</span>
        </div>
        <ul className="editor-simbolos-lista">
          {lista.map((s) => (
            <li
              key={s.codigo_iec}
              className={
                "editor-simbolos-item" +
                (seleccionado?.codigo_iec === s.codigo_iec ? " activo" : "")
              }
              onClick={() => seleccionar(s)}
            >
              <span
                className="editor-simbolos-mini"
                dangerouslySetInnerHTML={{ __html: s.svgRaw }}
              />
              <div className="editor-simbolos-info">
                <span className="editor-simbolos-codigo">{s.codigo_iec}</span>
                <span className="editor-simbolos-nombre">{s.metadata.nombre}</span>
              </div>
              <span className={"editor-simbolos-badge " + s.metadata.estado_revision}>
                {s.metadata.estado_revision === "verificado" ? "✓" : s.metadata.estado_revision === "corregido" ? "✎" : "…"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="editor-simbolos-canvas-wrap" ref={containerRef}>
        <canvas ref={canvasRef} />
        <canvas ref={gridCanvasRef} className="editor-simbolos-grid" />
        {seleccionado && (
          <div className="editor-simbolos-meta">
            <div className="editor-simbolos-meta-info">
              <strong>{seleccionado.codigo_iec}</strong> — {seleccionado.metadata.nombre}
              <br />
              <small>
                viewBox: {seleccionado.viewBox.minX}, {seleccionado.viewBox.minY}{" "}
                {seleccionado.viewBox.ancho}×{seleccionado.viewBox.alto} ·{" "}
                {seleccionado.metadata.puntos_conexion.length} puntos de conexión
              </small>
            </div>
            <div className="editor-simbolos-toolbar">
              <button
                type="button"
                onClick={toggleEdicion}
                className={editando ? "activo" : ""}
              >
                {editando ? "Salir edición" : "Editar geometría"}
              </button>
              {editando && (
                <>
                  <span className="separador" />
                  <button
                    type="button"
                    onClick={() => { historialCanvas.deshacerFn(); forceRender((n) => n + 1); }}
                    disabled={!historialCanvas.puedeDeshacer}
                    title="Deshacer (Ctrl+Z)"
                  >
                    ↶
                  </button>
                  <button
                    type="button"
                    onClick={() => { historialCanvas.rehacerFn(); forceRender((n) => n + 1); }}
                    disabled={!historialCanvas.puedeRehacer}
                    title="Rehacer (Ctrl+Shift+Z)"
                  >
                    ↷
                  </button>
                  <span className="separador" />
                  <button
                    type="button"
                    onClick={guardarGeometria}
                    disabled={!dirty || guardando}
                  >
                    Guardar
                  </button>
                  <button type="button" onClick={cancelarEdicion}>
                    Cancelar
                  </button>
                </>
              )}
              <span className="separador" />
              <button type="button" onClick={zoomOut} title="Zoom out (Ctrl+-)">−</button>
              <span className="editor-simbolos-zoom" onClick={zoomFit} title="Ajustar vista (Ctrl+0)">
                {Math.round(zoomActual * 100)}%
              </span>
              <button type="button" onClick={zoomIn} title="Zoom in (Ctrl+=)">+</button>
            </div>
            <div className="editor-simbolos-estado">
              <label className="editor-simbolos-estado-label">Estado:</label>
              <select
                className="editor-simbolos-estado-select"
                value={seleccionado.metadata.estado_revision}
                onChange={(e) => cambiarEstado(e.target.value)}
                disabled={guardando}
              >
                {ESTADOS.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.etiqueta}
                  </option>
                ))}
              </select>
              {guardando && <span className="editor-simbolos-guardando">Guardando...</span>}
              {mensaje && <span className="editor-simbolos-mensaje">{mensaje}</span>}
            </div>
          </div>
        )}
        {!seleccionado && (
          <div className="editor-simbolos-placeholder">
            Seleccioná un símbolo de la lista para editarlo
          </div>
        )}
      </div>
    </div>
  );
}

function inlineSvgGroups(svgStr: string): string {
  const doc = new DOMParser().parseFromString(svgStr, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return svgStr;

  let changed = true;
  while (changed) {
    changed = false;
    for (const g of Array.from(svg.querySelectorAll("g"))) {
      if (g.querySelector("g")) continue;
      changed = true;
      const ga: Record<string, string> = {};
      for (const a of Array.from(g.attributes)) ga[a.name] = a.value;
      const parent = g.parentNode!;
      while (g.firstChild) {
        const ch = g.firstChild;
        if (ch.nodeType === Node.ELEMENT_NODE) {
          for (const [k, v] of Object.entries(ga)) {
            if (!(ch as Element).hasAttribute(k)) (ch as Element).setAttribute(k, v);
          }
        }
        parent.insertBefore(ch, g);
      }
      g.remove();
    }
  }

  const full = new XMLSerializer().serializeToString(svg);
  return full.replace(/<svg[^>]*>/, "").replace(/<\/svg>$/, "").trim();
}

function dibujarPuntosConexion(
  fc: FabricCanvas,
  s: SimboloDef,
  offsetX: number,
  offsetY: number,
) {
  const colores: Record<string, string> = {
    entrada: "#e11d48",
    salida: "#2563eb",
    tierra: "#16a34a",
  };

  for (const p of s.metadata.puntos_conexion) {
    const x = offsetX + p.x * ESCALA_EDICION;
    const y = offsetY + p.y * ESCALA_EDICION;
    const color = colores[p.rol] ?? "#e11d48";
    const r = 4;

    const circulo = new Circle({
      left: x - r,
      top: y - r,
      radius: r,
      fill: color,
      stroke: "#ffffff",
      strokeWidth: 1.5,
      selectable: false,
      evented: false,
      originX: "left",
      originY: "top",
    });

    const etiqueta = new Textbox(`${p.id} (${p.rol})`, {
      left: x + r + 3,
      top: y - 6,
      fontSize: 8,
      fill: color,
      fontFamily: "monospace",
      selectable: false,
      evented: false,
      width: 120,
    });

    const cruzH = new Line([x - 7, y, x + 7, y], {
      stroke: color,
      strokeWidth: 1,
      selectable: false,
      evented: false,
      strokeDasharray: [3, 2],
    });
    const cruzV = new Line([x, y - 7, x, y + 7], {
      stroke: color,
      strokeWidth: 1,
      selectable: false,
      evented: false,
      strokeDasharray: [3, 2],
    });

    fc.add(cruzH, cruzV, circulo, etiqueta);
  }
}
