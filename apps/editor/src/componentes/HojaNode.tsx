import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  MARGEN_IZQ_MM,
  MARGEN_RESTO_MM,
  PX_POR_MM,
  dimensionesHoja,
} from "../lib/tipos";
import { useEditor } from "../lib/store";

const mm = (v: number) => v * PX_POR_MM;

/**
 * Geometría del rótulo según IRAM 4508 (figura 1), reconstruida de la
 * norma: ancho total 175 mm con columnas 26 / 20 / 34 / 40 / 55 y alto
 * 79 mm con filas 4×10 + 20 + 19. Contorno igual al recuadro; líneas
 * internas finas.
 */
const ROTULO_COLUMNAS_MM = [26, 20, 34, 40, 55];
const ROTULO_FILAS_MM = [10, 10, 10, 10, 20, 19];

/**
 * Plantilla de hoja: arriba, sobre el recuadro, va el nombre del
 * tablero; a la izquierda las notas constructivas del gabinete; al pie
 * la nota de seguridad operativa cuando corresponde; en el vértice
 * inferior derecho el rótulo IRAM 4508. Los bloques son decorativos
 * (pointer-events none) para no estorbar el arrastre de símbolos.
 */
function bloqueStyle(style: CSSProperties): CSSProperties {
  return { position: "absolute", pointerEvents: "none", ...style };
}

interface CeldaRotuloProps {
  col: string;
  fila: string;
  etiqueta?: string;
  valor?: ReactNode;
  tamano?: number;
  fuerte?: boolean;
  centrado?: boolean;
  children?: ReactNode;
}

function CeldaRotulo({
  col,
  fila,
  etiqueta,
  valor,
  tamano = 2.2,
  fuerte = false,
  centrado = false,
  children,
}: CeldaRotuloProps) {
  return (
    <div
      style={{
        gridColumn: col,
        gridRow: fila,
        borderRight: "1px solid #111827",
        borderBottom: "1px solid #111827",
        padding: `${mm(0.7)} ${mm(1)}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: mm(0.3),
        alignItems: centrado ? "center" : "stretch",
        justifyContent: centrado ? "center" : "flex-start",
        textAlign: centrado ? "center" : "left",
      }}
    >
      {etiqueta !== undefined && (
        <span style={{ fontSize: mm(1.7), lineHeight: 1.25 }}>{etiqueta}</span>
      )}
      {valor !== undefined && (
        <span
          style={{
            fontSize: mm(tamano),
            fontWeight: fuerte ? 700 : 500,
            lineHeight: 1.25,
            whiteSpace: "pre-wrap",
          }}
        >
          {valor === "" ? "\u00a0" : valor}
        </span>
      )}
      {children}
    </div>
  );
}

function RotuloIram() {
  const rotulo = useEditor((s) => s.hoja.rotulo);
  const formato = useEditor((s) => s.hoja.formato);
  const anchoPx = mm(ROTULO_COLUMNAS_MM.reduce((a, b) => a + b, 0));
  const altoPx = mm(ROTULO_FILAS_MM.reduce((a, b) => a + b, 0));
  const escalaTexto =
    (rotulo.escala.trim() === "" ? "S/E" : rotulo.escala) +
    (rotulo.metodoIso ? ` ${rotulo.metodoIso}` : "");

  return (
    <div
      style={bloqueStyle({
        right: 0,
        bottom: 0,
        width: anchoPx,
        height: altoPx,
        boxSizing: "border-box",
        border: "2px solid #111827",
        background: "#fff",
        color: "#111827",
        display: "grid",
        gridTemplateColumns: ROTULO_COLUMNAS_MM.map((c) => mm(c)).join("px ") + "px",
        gridTemplateRows: ROTULO_FILAS_MM.map((f) => mm(f)).join("px ") + "px",
      })}
      aria-label="Rótulo IRAM 4508"
    >
      {/* Campo 1 — tolerancias generales (abarca las filas de responsables) */}
      <CeldaRotulo
        col="1"
        fila="1 / span 4"
        etiqueta="Tolerancias generales"
        valor={rotulo.toleranciasGenerales}
      />

      {/* Campo 2 — responsables: rol+fecha | nombre */}
      {rotulo.responsables.map((r, i) => (
        <Fragment key={`resp${i}`}>
          <CeldaRotulo col="2" fila={`${i + 1}`}>
            <span style={{ fontSize: mm(1.7), lineHeight: 1.25, color: "#374151" }}>
              {r.rol}
            </span>
            <span style={{ fontSize: mm(2.2), fontWeight: 500, lineHeight: 1.25 }}>
              {r.fecha === "" ? "\u00a0" : r.fecha}
            </span>
          </CeldaRotulo>
          <CeldaRotulo col="3" fila={`${i + 1}`} valor={r.nombre} />
        </Fragment>
      ))}

      {/* Campo 7 — cliente (+ localidad) sobre las dos primeras filas */}
      <div
        style={{
          gridColumn: "4",
          gridRow: "1 / span 2",
          borderRight: "1px solid #111827",
          borderBottom: "1px solid #111827",
          padding: `${mm(0.7)} ${mm(1)}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: mm(0.3),
        }}
      >
        <span style={{ fontSize: mm(1.7), lineHeight: 1.25 }}>Cliente</span>
        <span style={{ fontSize: mm(2.4), fontWeight: 700, lineHeight: 1.25 }}>
          {rotulo.cliente === "" ? "\u00a0" : rotulo.cliente}
        </span>
        {rotulo.localidad !== "" && (
          <span style={{ fontSize: mm(1.9), lineHeight: 1.25 }}>
            {rotulo.localidad}
          </span>
        )}
      </div>

      {/* Campo 8 — clave o número de lo representado */}
      <CeldaRotulo
        col="4"
        fila="3"
        etiqueta="Clave o número de lo representado"
        valor={rotulo.claveRepresentado}
        tamano={2.2}
      />

      {/* Campo 9 — nombre del archivo informático */}
      <CeldaRotulo
        col="4"
        fila="4"
        etiqueta="Nombre del archivo informático"
        valor={rotulo.nombreArchivo}
        tamano={2}
      />

      {/* Campo 6 — denominación de lo representado + campo 10 logo */}
      <div
        style={{
          gridColumn: "5",
          gridRow: "1 / span 4",
          borderRight: "1px solid #111827",
          borderBottom: "1px solid #111827",
          padding: `${mm(0.7)} ${mm(1)}`,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: mm(0.5),
        }}
      >
        <span style={{ fontSize: mm(1.7), lineHeight: 1.25 }}>
          Denominación de lo representado
        </span>
        {(rotulo.empresa !== "" || rotulo.logoTexto !== "") && (
          <span style={{ fontSize: mm(2), fontWeight: 600, lineHeight: 1.25 }}>
            {rotulo.logoTexto || rotulo.empresa}
          </span>
        )}
        <span
          style={{
            fontSize: mm(3.4),
            fontWeight: 700,
            lineHeight: 1.3,
            textAlign: "center",
            margin: "auto 0",
          }}
        >
          {rotulo.denominacion === "" ? "\u00a0" : rotulo.denominacion}
        </span>
      </div>

      {/* Campo 3 — escala + método ISO */}
      <CeldaRotulo
        col="1"
        fila="5"
        etiqueta="Escala"
        valor={escalaTexto}
        tamano={2.6}
        fuerte
      />

      {/* Campo 11 — número de plano del cliente */}
      <CeldaRotulo
        col="2 / 6"
        fila="5"
        etiqueta="N° de plano del cliente"
        valor={rotulo.numeroPlanoCliente}
        tamano={2.6}
        fuerte
      />

      {/* Campo 5 — formato */}
      <CeldaRotulo col="1" fila="6" etiqueta="Formato" valor={formato} tamano={2.6} fuerte />

      {/* Campo 12 — número de plano propio */}
      <CeldaRotulo
        col="2 / 5"
        fila="6"
        etiqueta="N° de plano"
        valor={rotulo.numeroPlano}
        tamano={3}
        fuerte
        centrado
      />

      {/* Campo 13 — paginación */}
      <CeldaRotulo
        col="5"
        fila="6"
        etiqueta="Pág."
        valor={rotulo.paginacion}
        tamano={2.6}
        centrado
      />
    </div>
  );
}

function HojaNode(_props: NodeProps) {
  const hoja = useEditor((s) => s.hoja);
  const { pxW, pxH } = dimensionesHoja(hoja);
  const mi = mm(MARGEN_IZQ_MM);
  const mr = mm(MARGEN_RESTO_MM);
  const textoChico = { fontSize: mm(2.5), lineHeight: 1.45 };

  return (
    <div
      className="hoja"
      style={{ width: pxW, height: pxH }}
      aria-label="Hoja de plano"
    >
      <div className="hoja-marco" style={{ inset: mr, left: mi }}>
        {/* Encabezado del tablero: sobre el recuadro, arriba al centro */}
        <div
          style={bloqueStyle({
            top: mm(-7),
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            color: "#111827",
          })}
        >
          <strong style={{ fontSize: mm(5), lineHeight: 1.15 }}>
            {hoja.tablero || "\u00a0"}
          </strong>
        </div>

        {/* Notas constructivas del gabinete, una por renglón */}
        {hoja.notasGabinete.length > 0 && (
          <div
            style={bloqueStyle({
              top: mm(16),
              left: mm(6),
              maxWidth: mm(95),
              color: "#111827",
            })}
          >
            {hoja.notasGabinete.map((n, i) => (
              <p key={i} style={{ ...textoChico, margin: 0 }}>
                {n}
              </p>
            ))}
          </div>
        )}

        {/* Nota de seguridad operativa al pie, a la izquierda del rótulo */}
        {hoja.notaSeguridad.trim() !== "" && (
          <div
            style={bloqueStyle({
              bottom: mm(4),
              left: mm(6),
              maxWidth: mm(120),
              color: "#111827",
              whiteSpace: "pre-wrap",
            })}
          >
            <p style={{ ...textoChico, margin: 0 }}>{hoja.notaSeguridad}</p>
          </div>
        )}

        {/* Rótulo IRAM 4508 pegado al vértice inferior derecho */}
        <RotuloIram />
      </div>
      {/* handles inertes para que RF no reclame; no conectables */}
      <Handle type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Top} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}

export default HojaNode;
