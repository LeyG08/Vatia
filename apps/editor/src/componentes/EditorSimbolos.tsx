import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas as FabricCanvas, Circle, FabricObject, Group, Line, Textbox, loadSVGFromString } from "fabric";
import { SIMBOLOS } from "../lib/libreria";
import type { SimboloDef } from "../lib/tipos";

const ESCALA_EDICION = 20;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, [filtro, tick]);

  const seleccionar = useCallback((s: SimboloDef) => {
    setSeleccionado(s);
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
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      fc.dispose();
      fabricRef.current = null;
    };
  }, []);

  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc || !seleccionado) return;

    fc.clear();
    const vb = seleccionado.viewBox;
    const svg = seleccionado.svgRaw;

    const zoomX = (fc.getWidth!() - 60) / (vb.ancho * ESCALA_EDICION);
    const zoomY = (fc.getHeight!() - 60) / (vb.alto * ESCALA_EDICION);
    const zoom = Math.min(zoomX, zoomY, 1);
    fc.setZoom(zoom);
    fc.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);

    const offsetX = (fc.getWidth!() / zoom - vb.ancho * ESCALA_EDICION) / 2 - vb.minX * ESCALA_EDICION;
    const offsetY = (fc.getHeight!() / zoom - vb.alto * ESCALA_EDICION) / 2 - vb.minY * ESCALA_EDICION;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${svg.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "")}</svg>`;
    const svgEl = tempDiv.querySelector("svg");
    if (!svgEl) return;
    svgEl.setAttribute("viewBox", `${vb.minX} ${vb.minY} ${vb.ancho} ${vb.alto}`);

    loadSVGFromString(svgEl.outerHTML).then((result) => {
      const objs = result.objects.filter(Boolean) as FabricObject[];
      if (objs.length === 0) return;

      const svgGroup = new Group(objs, {
        selectable: false,
        evented: false,
      });
      svgGroup.set({
        left: offsetX,
        top: offsetY,
        scaleX: ESCALA_EDICION,
        scaleY: ESCALA_EDICION,
      });
      fc.add(svgGroup);
      dibujarPuntosConexion(fc, seleccionado, offsetX, offsetY);
      fc.renderAll();
    });
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
