import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ESCALA, useEditor, type DatosSimbolo } from "../lib/store";
import { obtenerSimbolo, svgLimpio } from "../lib/libreria";
import { anotacionNodo } from "../lib/anotaciones";
import { TIPOS_CONTACTO_MANUAL } from "../lib/simulacion";
import type { SimboloDef } from "../lib/tipos";

const DIRECCIONES = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
];

function direccionBase(p: { x: number; y: number }, vb: SimboloDef["viewBox"]) {
  const distancias = [
    { i: 0, d: Math.abs(p.y - vb.minY) },
    { i: 1, d: Math.abs(vb.minX + vb.ancho - p.x) },
    { i: 2, d: Math.abs(vb.minY + vb.alto - p.y) },
    { i: 3, d: Math.abs(p.x - vb.minX) },
  ];
  distancias.sort((a, b) => a.d - b.d);
  return distancias[0].i;
}

interface PuntoRotado {
  x: number;
  y: number;
  cajaAncho: number;
  cajaAlto: number;
  direccion: Position;
}

function rotarPunto(
  p: { x: number; y: number },
  vb: SimboloDef["viewBox"],
  rotacion: number,
): PuntoRotado {
  const x = p.x - vb.minX;
  const y = p.y - vb.minY;
  const giro = (((rotacion % 360) + 360) % 360) / 90;
  let rx = x;
  let ry = y;
  let ancho = vb.ancho;
  let alto = vb.alto;

  if (giro === 1) {
    rx = vb.alto - y;
    ry = x;
    ancho = vb.alto;
    alto = vb.ancho;
  } else if (giro === 2) {
    rx = vb.ancho - x;
    ry = vb.alto - y;
  } else if (giro === 3) {
    rx = y;
    ry = vb.ancho - x;
    ancho = vb.alto;
    alto = vb.ancho;
  }

  return {
    x: rx,
    y: ry,
    cajaAncho: ancho,
    cajaAlto: alto,
    direccion: DIRECCIONES[(direccionBase(p, vb) + giro) % 4],
  };
}

function NodoSimbolo({ id, data, selected }: NodeProps<Node<DatosSimbolo>>) {
  const simbolo = obtenerSimbolo(data.codigo_iec);
  const tensionFaseV = useEditor((s) => s.proyecto.datosProyecto.tension_fase_v);
  const tensionLineaV = useEditor((s) => s.proyecto.datosProyecto.tension_linea_v);
  // Modo simulación (E63): resalta el estado calculado por
  // lib/simulacion.ts y permite accionar pulsadores/interruptores de
  // posición con el mouse. `resultado`/`manual` cambian de referencia en
  // cada recálculo, así que comparar por referencia (default de zustand)
  // ya evita renders de más.
  const modoSimulacion = useEditor((s) => s.modoSimulacion);
  const resultadoSimulacion = useEditor((s) => s.simulacionResultado);
  const manualSimulacion = useEditor((s) => s.simulacionManual);
  const hojaActivaId = useEditor((s) => s.hojaActivaId);
  const accionarSimulacion = useEditor((s) => s.accionarSimulacion);
  // Resalta en el lienzo los símbolos que comparten la MISMA referencia
  // (IEC 61346) que el seleccionado — pedido explícito: "en los
  // multifilares... a la hora de hacerlo quedan vinculados para la
  // simulación" (E53). Selector primitivo (string|null): zustand
  // solo re-renderiza este nodo si el valor realmente cambia, aunque el
  // selector recorra `nodos` en cada actualización del store.
  const referenciaSeleccionada = useEditor((s) => {
    if (selected) return null; // el propio seleccionado no se resalta a sí mismo
    const sel = s.nodos.find((n) => n.selected && n.type === "simbolo");
    if (!sel) return null;
    const ref = (sel.data as DatosSimbolo).atributos?.referencia;
    return typeof ref === "string" && ref.trim() !== "" ? ref.trim() : null;
  });
  const miReferencia =
    typeof data.atributos?.referencia === "string" ? data.atributos.referencia.trim() : "";
  const vinculado = referenciaSeleccionada !== null && miReferencia === referenciaSeleccionada;

  const tipoAparato =
    typeof data.atributos?.tipo_aparato === "string" ? data.atributos.tipo_aparato : null;
  const claveSimulacion = `${hojaActivaId}:${id}`;
  const energizado =
    modoSimulacion && resultadoSimulacion?.aparatos.get(claveSimulacion) === true;
  const accionado = modoSimulacion && manualSimulacion.has(claveSimulacion);
  const accionable = modoSimulacion && tipoAparato !== null && TIPOS_CONTACTO_MANUAL.has(tipoAparato);
  // pulsador_emergencia enclava mecánicamente (se togglea con un clic);
  // pulsador/interruptor_posicion son momentáneos: conducen solo
  // mientras se los mantiene apretados (press/release real, no un clic).
  const esEnclavable = tipoAparato === "pulsador_emergencia";
  const onAccionarInicio = accionable
    ? (e: React.PointerEvent) => {
        e.stopPropagation();
        accionarSimulacion(id, esEnclavable ? !accionado : true);
      }
    : undefined;
  const onAccionarFin = accionable && !esEnclavable
    ? (e: React.PointerEvent) => {
        e.stopPropagation();
        accionarSimulacion(id, false);
      }
    : undefined;

  if (!simbolo) {
    return <div className="nodo-faltante">? {data.codigo_iec}</div>;
  }

  const vb = simbolo.viewBox;
  const rotacion = ((data.rotacion % 360) + 360) % 360;
  const puntos = simbolo.metadata.puntos_conexion.map((p) => ({
    punto: p,
    r: rotarPunto(p, vb, rotacion),
  }));
  const caja = puntos[0]?.r ?? {
    cajaAncho: vb.ancho,
    cajaAlto: vb.alto,
  };
  const anchoPx = Math.max(1, Math.round(caja.cajaAncho * ESCALA));
  const altoPx = Math.max(1, Math.round(caja.cajaAlto * ESCALA));
  const esCarga = simbolo.metadata.familia_atributos === "carga";
  const lineas = anotacionNodo(
    simbolo.metadata.familia_atributos,
    data,
    tensionFaseV,
    tensionLineaV,
  );
  // E64: sentido de giro calculado — pedido explícito ("que el motor lo
  // muestre"), solo visible en modo simulación y solo si el motor tiene
  // al menos un contactor reversor asociado (ver simulacion.ts).
  const sentidoGiro =
    modoSimulacion && tipoAparato === "motor_trifasico"
      ? resultadoSimulacion?.sentidoGiroPorMotor.get(claveSimulacion)
      : undefined;
  const NOMBRE_SENTIDO: Record<string, string> = {
    adelante: "adelante",
    atras: "atrás",
    detenido: "detenido",
  };
  const lineasConSentido = sentidoGiro
    ? [...lineas, { texto: `⟳ Sentido: ${NOMBRE_SENTIDO[sentidoGiro]}`, secundaria: true }]
    : lineas;

  return (
    <div
      className={`nodo-simbolo${vinculado ? " nodo-simbolo-vinculado" : ""}${
        energizado ? " nodo-simbolo-energizado" : ""
      }${accionable ? " nodo-simbolo-accionable" : ""}${
        accionado ? " nodo-simbolo-presionado" : ""
      }`}
      style={{ width: anchoPx, height: altoPx }}
      title={simbolo.metadata.nombre}
      onPointerDown={onAccionarInicio}
      onPointerUp={onAccionarFin}
      onPointerLeave={onAccionarFin}
    >
      <div
        className="simbolo-svg"
        style={{
          width: Math.max(1, Math.round(vb.ancho * ESCALA)),
          height: Math.max(1, Math.round(vb.alto * ESCALA)),
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) rotate(${rotacion}deg)`,
        }}
        dangerouslySetInnerHTML={{ __html: svgLimpio(simbolo.svgRaw) }}
      />
      {puntos.map(({ punto, r }) => (
        <Handle
          key={punto.id}
          id={punto.id}
          type={punto.rol === "salida" ? "source" : "target"}
          position={r.direccion}
          className={`handle-${punto.rol}`}
          style={{
            /* C13b: 0×0 — RF ancla al borde del handle; con tamaño
             * real quedaban ~5 px de aire. El anillo visible es el
             * ::before de la clase. */
            width: 0,
            height: 0,
            border: "none",
            background: "transparent",
            pointerEvents: "all",
            left: `${(r.x / r.cajaAncho) * 100}%`,
            top: `${(r.y / r.cajaAlto) * 100}%`,
          }}
        />
      ))}
      {lineasConSentido.length > 0 && (
        <div
          className={`anotacion-nodo${esCarga ? " anotacion-carga" : ""}`}
        >
          {lineasConSentido.map((l, i) => (
            <div key={i} className={l.secundaria ? "anotacion-sec" : undefined}>
              {l.texto}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NodoSimbolo;
