import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useMemo, useRef } from "react";
import {
  BARRA_GEO,
  useEditor,
  type DatosBarra,
  type NodoData,
} from "../lib/store";
import { GRILLA_PX } from "../lib/ruta";
import { anotacionBarra } from "../lib/anotaciones";
import { calcularTopologia } from "../lib/topologia";

const DIRECCIONES = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
] as const;

/** Estilo común de los puntos de conexión de la barra.
 * C13b: el Handle mide 0×0 — React Flow ancla el cable al BORDE del
 * handle medido, así que con tamaño real dejaba ~4,5 px de aire hasta
 * el centro. El puntito visible va en ::before (no se mide). */
const ESTILO_HANDLE = {
  width: 0,
  height: 0,
  border: "none",
  background: "transparent",
  pointerEvents: "all" as const,
};

/**
 * BARRA de distribución (C8). La acometida llega a ella y de ella
 * cuelgan los circuitos: los puntos de conexión se generan cada
 * GRILLA_PX a lo largo del eje (dos por punto, uno por lado), más
 * los extremos "in"/"out" heredados del símbolo original.
 *
 * El extremo derecho tiene un tirador para ESTIRAR la barra (snap a
 * grilla); con rotación 90° la barra queda vertical y el drag se
 * mapea al eje local según el giro. La ficha va en el extremo
 * izquierdo, POR ENCIMA de la barra, como en los planos reales.
 */
function BarraNode({ id, data, selected }: NodeProps<Node<DatosBarra>>) {
  const estirar = useEditor((s) => s.estirarBarra);
  const nodos = useEditor((s) => s.nodos);
  const conexiones = useEditor((s) => s.conexiones);
  const refDrag = useRef<{ x0: number; y0: number; largo0: number } | null>(
    null,
  );
  // Paso 4: potencia agregada (Ku×Ks) de las cargas del subárbol de ESTA
  // barra — se recalcula del grafo en vivo, no se guarda en el proyecto.
  const potenciaVa = useMemo(() => {
    const topo = calcularTopologia(nodos as Node<NodoData>[], conexiones);
    return topo.potenciaBarraVa.get(id) ?? 0;
  }, [nodos, conexiones, id]);

  const { largoPx, rotacion } = data;
  const giro = ((((rotacion % 360) + 360) % 360) / 90) | 0;
  const anchoLocal = largoPx + 2 * BARRA_GEO.padX;
  const altoLocal = BARRA_GEO.altoCaja;
  const vertical = giro % 2 === 1;
  const cajaAncho = vertical ? altoLocal : anchoLocal;
  const cajaAlto = vertical ? anchoLocal : altoLocal;

  /** Punto local (sin rotar) → coordenadas % dentro de la caja girada */
  function proyectar(px: number, py: number) {
    let rx = px;
    let ry = py;
    if (giro === 1) {
      rx = altoLocal - py;
      ry = px;
    } else if (giro === 2) {
      rx = anchoLocal - px;
      ry = altoLocal - py;
    } else if (giro === 3) {
      rx = py;
      ry = anchoLocal - px;
    }
    return {
      left: `${(rx / cajaAncho) * 100}%`,
      top: `${(ry / cajaAlto) * 100}%`,
    };
  }

  /** Dirección base desplazada por el giro */
  function direccion(base: number) {
    return DIRECCIONES[(base + giro) % 4];
  }

  /** Drag de estiramiento, reutilizado por los DOS extremos (C11):
   * desde la derecha crece el extremo derecho; desde la izquierda se
   * corre la posición para mantener fijo el extremo derecho. */
  function gripHandlers(origen: "der" | "izq") {
    return {
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        refDrag.current = { x0: e.clientX, y0: e.clientY, largo0: largoPx };
        estirar(id, largoPx, "inicio", origen);
      },
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
        const d = refDrag.current;
        if (!d) return;
        // Delta de pantalla → delta sobre el eje LOCAL de la barra
        const dx = e.clientX - d.x0;
        const dy = e.clientY - d.y0;
        const deltaLocal =
          giro === 0 ? dx : giro === 1 ? dy : giro === 2 ? -dx : -dy;
        const pedido =
          origen === "der" ? d.largo0 + deltaLocal : d.largo0 - deltaLocal;
        estirar(id, pedido, "moviendo", origen);
      },
      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
        const d = refDrag.current;
        if (!d) return;
        const dx = e.clientX - d.x0;
        const dy = e.clientY - d.y0;
        const deltaLocal =
          giro === 0 ? dx : giro === 1 ? dy : giro === 2 ? -dx : -dy;
        refDrag.current = null;
        const pedido =
          origen === "der" ? d.largo0 + deltaLocal : d.largo0 - deltaLocal;
        const final =
          Math.round(pedido / GRILLA_PX) * GRILLA_PX;
        estirar(id, final, "fin", origen);
      },
    };
  }

  const gripDerecho = gripHandlers("der");
  const gripIzquierdo = gripHandlers("izq");

  // Puntos de conexión cada grilla a lo largo del eje local
  const cantidad = largoPx / GRILLA_PX; // pasos de 10 px
  const offsets = Array.from(
    { length: cantidad + 1 },
    (_, i) => i * GRILLA_PX,
  );

  const ficha = anotacionBarra(data.atributos ?? {});
  if (potenciaVa > 0) ficha.push(`Σ cargas: ${potenciaVa} VA`);

  /* E80: un riel de comando con función declarada (E64) se dibuja con el
   * color de esa función — marrón la fase, celeste el neutro, verde el
   * PE. Acá el trazo ENTERO es una sola función, a diferencia del cable
   * del unifilar, donde la línea representa todo el cable junto y el
   * color va en las marcas de composición. La barra de fuerza no se
   * colorea: es un juego de barras, lleva todo junto. */
  const funcionRiel =
    data.atributos?.tipo_barra === "riel_multifilar" &&
    typeof data.atributos?.funcion_riel === "string"
      ? data.atributos.funcion_riel
      : null;

  /* E82: la etiqueta del riel (L1, L2, L3) elige cual de los tres colores
   * normalizados de fase le toca. Solo aplica a fases: neutro y tierra
   * tienen un color unico cada uno. */
  const etiquetaFase =
    funcionRiel === "fase_viva" && typeof data.atributos?.etiqueta_fase === "string"
      ? data.atributos.etiqueta_fase.trim().toUpperCase()
      : null;
  const claseFase =
    etiquetaFase === "L1" || etiquetaFase === "L2" || etiquetaFase === "L3"
      ? ` fase-${etiquetaFase}`
      : "";

  return (
    <div
      className={`nodo-barra${selected ? " sel" : ""}${
        funcionRiel ? ` riel-${funcionRiel}` : ""
      }${claseFase}`}
      style={{ width: cajaAncho, height: cajaAlto }}
      title={funcionRiel ? `Riel de comando (${funcionRiel.replace("_", " ")})` : "Barra de distribución"}
    >
      {/* Eje de la barra (C21: gira con el nodo) */}
      <div
        className={`barra-eje${vertical ? " barra-eje-v" : ""}`}
        style={
          vertical
            ? {
                top: `${(BARRA_GEO.padX / cajaAlto) * 100}%`,
                bottom: `${(BARRA_GEO.padX / cajaAlto) * 100}%`,
              }
            : {
                left: `${(BARRA_GEO.padX / cajaAncho) * 100}%`,
                right: `${(BARRA_GEO.padX / cajaAncho) * 100}%`,
              }
        }
      />
      {offsets.map((o) => {
        const pos = proyectar(BARRA_GEO.padX + o, BARRA_GEO.centroY);
        const esExtremoIzq = o === 0;
        const esExtremoDer = o === largoPx;
        return (
          <span key={o}>
            <Handle
              id={`${o}a`}
              type="source"
              position={direccion(0)}
              className="handle-barra hb-fuente"
              style={{ ...ESTILO_HANDLE, ...pos }}
            />
            <Handle
              id={`${o}b`}
              type="target"
              position={direccion(2)}
              className="handle-barra hb-destino"
              style={{ ...ESTILO_HANDLE, ...pos }}
            />
            {esExtremoIzq && (
              <Handle
                id="in"
                type="target"
                position={direccion(3)}
                className="handle-barra hb-destino"
                style={{ ...ESTILO_HANDLE, ...pos }}
              />
            )}
            {esExtremoDer && (
              <Handle
                id="out"
                type="source"
                position={direccion(1)}
                className="handle-barra hb-fuente"
                style={{ ...ESTILO_HANDLE, ...pos }}
              />
            )}
          </span>
        );
      })}
      {/* Tiradores de estiramiento en AMBOS extremos (C11) */}
      <div
        className="barra-grip barra-grip-izq nodrag"
        style={proyectar(BARRA_GEO.padX - 6, BARRA_GEO.centroY)}
        {...gripIzquierdo}
        title="Arrastrá para alargar por el extremo izquierdo"
      />
      <div
        className="barra-grip nodrag"
        style={proyectar(anchoLocal - BARRA_GEO.padX + 6, BARRA_GEO.centroY)}
        {...gripDerecho}
        title="Arrastrá para alargar la barra"
      />
      {ficha.length > 0 && (
        <div className="anotacion-nodo anotacion-barra">
          {ficha.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BarraNode;
