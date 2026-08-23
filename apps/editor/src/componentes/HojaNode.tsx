import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  MARGEN_IZQ_MM,
  MARGEN_RESTO_MM,
  PX_POR_MM,
  calcularPaginacion,
  dimensionesHoja,
  numeroPlanoConSufijo,
  type NotasGabineteConfig,
} from "../lib/tipos";
import { useEditor } from "../lib/store";

const mm = (v: number) => v * PX_POR_MM;

/** Aumento de letra pedido para el rótulo (~2 px sobre lo calculado) */
const FUENTE_EXTRA_PX = 2;

/**
 * Geometría del rótulo según IRAM 4508 (figura 1), ajustada a pedido
 * del usuario: ancho total 174,5 mm con columnas 26 / 20 / 34 / 40 / 54,5.
 * Filas: 4×10 (responsables) + 12 (escala / nº cliente) + 10
 * (denominación del plano a ancho completo) + 10 (formato / nº plano /
 * paginación) = 72 mm. Contorno fundido con el recuadro en ambas esquinas
 * inferiores; líneas internas finas.
 * El ancho 174,5 mm (698 px pistas) + 4 px de borde = 702 px exterior,
 * igual a la caja de borde del recuadro en A4 vertical (700 px útil +
 * 2 px de borde centrado). Con right:-2 ambos vértices funden píxel a píxel.
 */
const ROTULO_COLUMNAS_MM = [26, 20, 34, 40, 54.5];
const ROTULO_FILAS_MM = [10, 10, 10, 10, 12, 10, 10];

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
  /** No dibuja la línea interna contra el contorno derecho */
  sinDerecha?: boolean;
  /** No dibuja la línea interna contra el contorno inferior */
  sinAbajo?: boolean;
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
  sinDerecha = false,
  sinAbajo = false,
  children,
}: CeldaRotuloProps) {
  // Sangrías: etiquetas 1,5 mm, valores 3 mm, centrados 0
  const padLabel = centrado ? 0 : mm(1.5);
  const padValue = centrado ? 0 : mm(3);

  return (
    <div
      style={{
        gridColumn: col,
        gridRow: fila,
        borderRight: sinDerecha ? undefined : "1px solid #111827",
        borderBottom: sinAbajo ? undefined : "1px solid #111827",
        padding: `${mm(0.7)} 0`,
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
        <span
          style={{
            fontSize: mm(1.7) + FUENTE_EXTRA_PX,
            lineHeight: 1.25,
            paddingLeft: padLabel,
            paddingRight: mm(1),
          }}
        >
          {etiqueta}
        </span>
      )}
      {valor !== undefined && (
        <span
          style={{
            fontSize: mm(tamano) + FUENTE_EXTRA_PX,
            fontWeight: fuerte ? 700 : 500,
            lineHeight: 1.25,
            whiteSpace: "pre-wrap",
            paddingLeft: padValue,
            paddingRight: mm(1),
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
  // Paginación y nº de plano calculados sobre el proyecto multi-hoja:
  // con una sola hoja se muestra tal cual el usuario los cargó
  const totalHojas = useEditor((s) => s.proyecto.hojas.length);
  const indiceHoja = useEditor((s) =>
    s.proyecto.hojas.findIndex((h) => h.id === s.hojaActivaId),
  );
  const paginacionMostrada = calcularPaginacion(
    rotulo.paginacion,
    indiceHoja,
    totalHojas,
  );
  const numeroPlanoMostrado = numeroPlanoConSufijo(
    rotulo.numeroPlano,
    indiceHoja,
    totalHojas,
  );
  const escalaTexto =
    (rotulo.escala.trim() === "" ? "S/E" : rotulo.escala) +
    (rotulo.metodoIso ? ` ${rotulo.metodoIso}` : "");

  return (
    <div
      style={bloqueStyle({
        // Contorno del rótulo fundido con el recuadro: el corrimiento
        // de 2 px hacia afuera hace coincidir ambas trazas píxel a
        // píxel, sobre las líneas de puntos de la grilla.
        right: -2,
        bottom: -2,
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
            <span
              style={{
                fontSize: mm(1.7) + FUENTE_EXTRA_PX,
                lineHeight: 1.25,
                color: "#374151",
                paddingLeft: mm(1.5),
                paddingRight: mm(1),
              }}
            >
              {r.rol}
            </span>
            <span
              style={{
                fontSize: mm(2.2) + FUENTE_EXTRA_PX,
                fontWeight: 500,
                lineHeight: 1.25,
                paddingLeft: mm(3),
                paddingRight: mm(1),
              }}
            >
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
          padding: `${mm(0.7)} 0`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: mm(0.3),
        }}
      >
        <span
          style={{
            fontSize: mm(1.7) + FUENTE_EXTRA_PX,
            lineHeight: 1.25,
            paddingLeft: mm(1.5),
            paddingRight: mm(1),
          }}
        >
          Cliente
        </span>
        <span
          style={{
            fontSize: mm(2.4) + FUENTE_EXTRA_PX,
            fontWeight: 700,
            lineHeight: 1.25,
            paddingLeft: mm(3),
            paddingRight: mm(1),
          }}
        >
          {rotulo.cliente === "" ? "\u00a0" : rotulo.cliente}
        </span>
        {rotulo.localidad !== "" && (
          <span
            style={{
              fontSize: mm(1.9) + FUENTE_EXTRA_PX,
              lineHeight: 1.25,
              paddingLeft: mm(3),
              paddingRight: mm(1),
            }}
          >
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

      {/* Campo 10 — logo / empresa (zona derecha de las filas de arriba) */}
      <div
        style={{
          gridColumn: "5",
          gridRow: "1 / span 4",
          borderBottom: "1px solid #111827",
          padding: `${mm(0.7)} 0`,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: mm(0.5),
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontSize: mm(1.7) + FUENTE_EXTRA_PX,
            lineHeight: 1.25,
            paddingLeft: 0,
            paddingRight: mm(1),
          }}
        >
          Empresa / logo
        </span>
        <span
          style={{
            fontSize: mm(3) + FUENTE_EXTRA_PX,
            fontWeight: 700,
            lineHeight: 1.3,
            margin: "auto 0",
            wordBreak: "break-word",
            paddingLeft: 0,
            paddingRight: mm(1),
          }}
        >
          {rotulo.logoTexto || rotulo.empresa || "\u00a0"}
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
        sinDerecha
      />

      {/* Campo 6 — denominación del plano, a ancho completo */}
      <CeldaRotulo
        col="1 / 6"
        fila="6"
        etiqueta="Denominación del plano"
        valor={rotulo.denominacion}
        tamano={3.2}
        fuerte
        centrado
        sinDerecha
      />

      {/* Campo 5 — formato */}
      <CeldaRotulo
        col="1"
        fila="7"
        etiqueta="Formato"
        valor={formato}
        tamano={2.6}
        fuerte
        sinAbajo
      />

      {/* Campo 12 — número de plano propio (con sufijo -1, -2… si hay varias hojas) */}
      <CeldaRotulo
        col="2 / 5"
        fila="7"
        etiqueta="N° de plano"
        valor={numeroPlanoMostrado}
        tamano={2.8}
        fuerte
        centrado
        sinAbajo
      />

      {/* Campo 13 — paginación automática "X / Y" */}
      <CeldaRotulo
        col="5"
        fila="7"
        etiqueta="Pág."
        valor={paginacionMostrada}
        tamano={2.4}
        centrado
        sinDerecha
        sinAbajo
      />
    </div>
  );
}

/** Estructura fija de las notas: campo → etiqueta que se imprime */
const NOTAS_GABINETE_FIJAS: [keyof NotasGabineteConfig, string][] = [
  ["material", "Material"],
  ["claseAislacion", "Clase de aislación"],
  ["personalApto", "Personal apto"],
  ["gradoProteccion", "Grado de protección IP"],
  ["barrasOConductores", "Barras/conductores interiores"],
  ["reservaFutura", "Reserva futura"],
];

function HojaNode(_props: NodeProps) {
  const hoja = useEditor((s) => s.hoja);
  const { pxW, pxH } = dimensionesHoja(hoja);
  const mi = mm(MARGEN_IZQ_MM);
  const mr = mm(MARGEN_RESTO_MM);
  const textoChico = { fontSize: mm(2.5), lineHeight: 1.45 };
  // Notas del gabinete con +2 px sobre el texto chico, para lectura
  // cómoda en el papel impreso
  const textoNotasGabinete = { fontSize: mm(2.5) + 2, lineHeight: 1.45 };

  // Notas con su etiqueta fija; se saltean solo si el campo quedó vacío
  const notasGabinete = NOTAS_GABINETE_FIJAS.map(([campo, etiqueta]) => ({
    etiqueta,
    valor: hoja.notasGabinete[campo],
  })).filter((n) => n.valor.trim() !== "");

  return (
    <div
      className="hoja"
      style={{ width: pxW, height: pxH }}
      aria-label="Hoja de plano"
    >
      {/* Recuadro montado 1 px hacia afuera de las líneas de grilla:
       * con borde de 2 px, su eje queda EXACTO sobre los puntos */}
      <div className="hoja-marco" style={{ inset: mr - 1, left: mi - 1 }}>
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

        {/* Notas constructivas del gabinete: estructura fija con
         * etiquetas. Misma distancia del recuadro que la nota de seguridad
         * inferior (4 mm) para simetría vertical. En vertical usan columna
         * angosta a la izquierda para no invadir el centro del unifilar. */}
        {notasGabinete.length > 0 && (
          <div
                        style={bloqueStyle({
              top: mm(4),
              left: mm(6),
              maxWidth: hoja.orientacion === "vertical" ? mm(80) : mm(105),
              color: "#111827",
            })}
          >
            {notasGabinete.map((n) => (
              <p key={n.etiqueta} style={{ ...textoNotasGabinete, margin: 0 }}>
                <strong>{n.etiqueta}:</strong> {n.valor}
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
