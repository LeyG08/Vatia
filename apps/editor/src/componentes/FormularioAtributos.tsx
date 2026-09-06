import { Fragment, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  type FamiliaAtributos,
  camposDeFamilia,
  algunoObligatorio,
  parAutomatico,
  campoVisible,
} from "../lib/esquemas";
import { esAccesorioReferencia } from "../lib/referencia";
import {
  estimarCorrienteAdmisibleBarraA,
  anchosBarraDisponiblesMm,
  espesoresBarraDisponiblesMm,
  cantidadesBarraDisponibles,
} from "../lib/barras";
import SelectorConEscape from "./SelectorConEscape";

interface UsoReferencia {
  id: string;
  tipoAparato: string;
  etiqueta: string;
  hoja: string;
}

interface Props {
  familia: FamiliaAtributos;
  atributos: Record<string, unknown>;
  onChange: (nuevosAtributos: Record<string, unknown>) => void;
  /** Aviso de incompatibilidad del campo "referencia" (E52, ver
   * lib/referencia.ts) — calculado por el padre, que es quien tiene
   * acceso al resto del proyecto; se muestra pegado al campo, no
   * bloquea el guardado. */
  avisoReferencia?: string | null;
  /** Referencias YA usadas en el proyecto — para las piezas "accesorio"
   * (contacto auxiliar, bobina genérica) el campo "referencia" se
   * ofrece como lista en vez de texto libre: elegir de acá ES vincular
   * la pieza a un aparato existente (E53). */
  opcionesReferencia?: { referencia: string; etiqueta: string }[];
  /** El resto de los símbolos que comparten la MISMA referencia que
   * este — se muestra como "Vinculado con…" debajo del campo, aunque
   * estén en otra hoja (E53). */
  vinculosReferencia?: UsoReferencia[];
}

function valorComoTexto(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

interface DimensionesBarra {
  cantidad: number;
  ancho: number | undefined;
  espesor: number | undefined;
}

/** Parsea el texto de `dimensiones` en (cantidad, ancho, espesor) — los
 * mismos dos formatos reales que ya entiende `lib/barras.ts`. */
function parsearDimensiones(valor: string): DimensionesBarra {
  const m3 = /^\s*(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i.exec(valor);
  if (m3) return { cantidad: Number(m3[1]), ancho: Number(m3[2]), espesor: Number(m3[3]) };
  const m2 = /^\s*(\d+)\s*x\s*(\d+)/i.exec(valor);
  if (m2) return { cantidad: 1, ancho: Number(m2[1]), espesor: Number(m2[2]) };
  return { cantidad: 1, ancho: undefined, espesor: undefined };
}

/** Compone (cantidad, ancho, espesor) de vuelta al texto de
 * `dimensiones` — inverso de `parsearDimensiones`. "" si todavía falta
 * ancho o espesor (selección a medio hacer). */
function componerDimensiones({ cantidad, ancho, espesor }: DimensionesBarra): string {
  if (ancho === undefined || espesor === undefined) return "";
  return cantidad > 1 ? `${cantidad}x${ancho}x${espesor}mm` : `${ancho}x${espesor}mm`;
}

/**
 * Dimensiones de barra (E60): tres selectores en cascada sobre la
 * MISMA tabla real DIN 43671 de `lib/barras.ts` — pedido explícito del
 * usuario: "las dimensiones deben ser las normalizadas, seleccionamos
 * primero 30mm o 40mm... y luego la otra dimensión 3mm o 4mm...". Sin
 * escape a texto libre a propósito: el pedido es justamente que no se
 * pueda cargar cualquier número.
 *
 * Estado LOCAL, no derivado directo de `valor`: elegir el ancho todavía
 * no compone una `dimensiones` válida (falta el espesor) — emitir ""
 * al padre en ese momento borraba el ancho recién elegido en el
 * siguiente render (encontrado en vivo: la lista de espesores quedaba
 * vacía después de elegir el ancho). El efecto solo resincroniza desde
 * afuera cuando `valor` cambia por algo que ESTE componente no generó
 * (otro nodo seleccionado, deshacer, etc.).
 */
function SelectorDimensionesBarra({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (v: string) => void;
}) {
  const [estado, setEstado] = useState<DimensionesBarra>(() => parsearDimensiones(valor));

  useEffect(() => {
    if (valor !== componerDimensiones(estado)) {
      setEstado(parsearDimensiones(valor));
    }
    // Solo resincroniza cuando CAMBIA `valor` desde afuera — comparar
    // contra `estado` acá adentro dispararía en cada tecla propia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const anchos = anchosBarraDisponiblesMm();
  const espesores = estado.ancho !== undefined ? espesoresBarraDisponiblesMm(estado.ancho) : [];
  const cantidades =
    estado.ancho !== undefined && estado.espesor !== undefined
      ? cantidadesBarraDisponibles(estado.ancho, estado.espesor)
      : [1];

  function actualizar(cambio: Partial<DimensionesBarra>) {
    const siguiente = { ...estado, ...cambio };
    setEstado(siguiente);
    const compuesto = componerDimensiones(siguiente);
    if (compuesto) onChange(compuesto);
  }

  return (
    <span className="selector-dimensiones-barra">
      <select
        value={estado.ancho ?? ""}
        onChange={(e) =>
          actualizar({
            ancho: e.target.value ? Number(e.target.value) : undefined,
            espesor: undefined,
            cantidad: 1,
          })
        }
      >
        <option value="">Ancho —</option>
        {anchos.map((a) => (
          <option key={a} value={a}>
            {a} mm
          </option>
        ))}
      </select>
      <select
        value={estado.espesor ?? ""}
        disabled={estado.ancho === undefined}
        onChange={(e) =>
          actualizar({
            espesor: e.target.value ? Number(e.target.value) : undefined,
            cantidad: 1,
          })
        }
      >
        <option value="">Espesor —</option>
        {espesores.map((e) => (
          <option key={e} value={e}>
            {e} mm
          </option>
        ))}
      </select>
      <select
        value={estado.cantidad}
        disabled={estado.ancho === undefined || estado.espesor === undefined}
        onChange={(e) => actualizar({ cantidad: Number(e.target.value) })}
      >
        {cantidades.map((c) => (
          <option key={c} value={c}>
            {c} {c === 1 ? "barra" : "barras"}
          </option>
        ))}
      </select>
    </span>
  );
}


/** Campos del JUEGO DE BARRAS que maneja el bloque de composición
 * (chips): nunca se renderizan como campos sueltos. */
const CAMPOS_COMPOSICION_BARRA = [
  "cantidad_fases",
  "incluye_neutro",
  "incluye_tierra",
];

/**
 * Estimación de la corriente de placa de un motor trifásico a partir
 * de su potencia MECÁNICA de eje + eficiencia + cos φ + tensión:
 *   I = P_eje / (√3 · V · cosφ · η)
 * El HP/kW de placa NO es potencia eléctrica: sin η el 1:1 estaba mal.
 * Devuelve null si no hay potencia cargada. Es solo un auxiliar del
 * formulario: nunca pisa un In real ya cargado.
 */
function estimarInA(a: Record<string, unknown>): number | null {
  let pWatts: number | null = null;
  if (typeof a.potencia_kw === "number" && a.potencia_kw > 0) {
    pWatts = a.potencia_kw * 1000;
  } else if (typeof a.potencia_hp === "number" && a.potencia_hp > 0) {
    pWatts = a.potencia_hp * 745.7;
  }
  if (pWatts === null) return null;

  const ef =
    typeof a.eficiencia_pct === "number" && a.eficiencia_pct > 0
      ? a.eficiencia_pct / 100
      : 0.9;
  const cos =
    typeof a.factor_potencia === "number" && a.factor_potencia > 0
      ? a.factor_potencia
      : 0.85;
  const v = typeof a.tension_v === "number" && a.tension_v > 0 ? a.tension_v : 400;
  const i = pWatts / (Math.sqrt(3) * v * cos * ef);
  return Math.round(i * 10) / 10;
}

export default function FormularioAtributos({
  familia,
  atributos,
  onChange,
  avisoReferencia,
  opcionesReferencia,
  vinculosReferencia,
}: Props) {
  const campos = useMemo(() => camposDeFamilia(familia, atributos), [familia, atributos]);
  const alguno = useMemo(() => algunoObligatorio(familia, atributos), [familia, atributos]);
  const reglaPar = useMemo(() => parAutomatico(familia, atributos), [familia, atributos]);

  if (campos === null) {
    return <p className="form-atributos-vacio">Este símbolo no lleva ficha técnica.</p>;
  }
  if (campos.length === 0) {
    return (
      <p className="form-atributos-vacio">
        Tipo de aparato desconocido ({String(atributos.tipo_aparato ?? "—")}).
      </p>
    );
  }

  function actualizar(nombre: string, valor: unknown) {
    const nuevos: Record<string, unknown> = { ...atributos };

    if (valor === undefined || valor === "") {
      delete nuevos[nombre];
    } else {
      nuevos[nombre] = valor;
    }

    if (reglaPar && reglaPar.campos.includes(nombre) && typeof valor === "number") {
      const [campoA, campoB] = reglaPar.campos;
      const otro = nombre === campoA ? campoB : campoA;
      if (!Number.isFinite(valor)) {
        delete nuevos[otro];
      } else {
        const convertido =
          nombre === "potencia_hp"
            ? valor * reglaPar.factorHpAKw
            : valor / reglaPar.factorHpAKw;
        nuevos[otro] = Math.round(convertido * 100) / 100;
      }
    }

    // C15: al declarar un JUEGO de barras, precargamos una composición
    // razonable (3F+N+PE); siempre editable a continuación.
    if (nombre === "es_conjunto" && valor === true) {
      if (nuevos.cantidad_fases == null) nuevos.cantidad_fases = 3;
      if (nuevos.incluye_neutro == null) nuevos.incluye_neutro = true;
      if (nuevos.incluye_tierra == null) nuevos.incluye_tierra = true;
    }

    onChange(nuevos);
  }

  return (
    <div className="form-atributos">
      {alguno && (
        <p className="form-atributos-aviso">
          Al menos uno de estos campos es obligatorio: {alguno.join(", ")}.
        </p>
      )}
      {campos.map((campo) => {
        const { nombre, esquema, obligatorio, title } = campo;
        const valorActual = atributos[nombre];

        // Campos condicionales (x-visible-si): solo se muestran cuando su
        // condición se cumple. Ver campoVisible() en lib/esquemas.ts.
        if (!campoVisible(esquema, atributos)) return null;
        // Composición del juego de barras: la dibuja el bloque de
        // chips de más abajo (C16), no campos sueltos.
        if (
          familia === "barra" &&
          CAMPOS_COMPOSICION_BARRA.includes(nombre)
        ) {
          return null;
        }

        let control: ReactElement;

        if (
          nombre === "referencia" &&
          typeof atributos.tipo_aparato === "string" &&
          esAccesorioReferencia(atributos.tipo_aparato) &&
          opcionesReferencia &&
          opcionesReferencia.length > 0
        ) {
          control = (
            <SelectorConEscape
              valor={valorComoTexto(valorActual)}
              opciones={opcionesReferencia.map((o) => ({ valor: o.referencia, etiqueta: o.etiqueta }))}
              onChange={(v) => actualizar(nombre, v || undefined)}
              placeholder="ej. KM1"
              etiquetaVacio="— sin vincular —"
            />
          );
        } else if (familia === "barra" && nombre === "dimensiones") {
          control = (
            <SelectorDimensionesBarra
              valor={valorComoTexto(valorActual)}
              onChange={(v) => actualizar(nombre, v || undefined)}
            />
          );
        } else if (esquema.enum) {
          control = (
            <select
              value={valorComoTexto(valorActual)}
              onChange={(e) => actualizar(nombre, e.target.value || undefined)}
            >
              <option value="">—</option>
              {esquema.enum.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          );
        } else if (esquema.type === "boolean") {
          control = (
            <select
              value={valorActual === true ? "si" : valorActual === false ? "no" : ""}
              onChange={(e) =>
                actualizar(
                  nombre,
                  e.target.value === "" ? undefined : e.target.value === "si",
                )
              }
            >
              <option value="">—</option>
              <option value="si">sí</option>
              <option value="no">no</option>
            </select>
          );
        } else if (esquema.type === "number" || esquema.type === "integer") {
          control = (
            <input
              type="number"
              step={esquema.type === "integer" ? 1 : "any"}
              min={esquema.minimum ?? esquema.exclusiveMinimum}
              max={esquema.maximum}
              value={valorComoTexto(valorActual)}
              onChange={(e) => {
                const texto = e.target.value;
                actualizar(
                  nombre,
                  texto === "" ? undefined : Number.parseFloat(texto),
                );
              }}
            />
          );
        } else {
          control = (
            <input
              type="text"
              value={valorComoTexto(valorActual)}
              onChange={(e) => actualizar(nombre, e.target.value || undefined)}
            />
          );
        }

        return (
          <Fragment key={nombre}>
            <label className="campo-atributo" title={esquema.description}>
              <span>
                {title ?? nombre}
                {obligatorio && <em className="obligatorio" aria-label="obligatorio">*</em>}
              </span>
              {control}
            </label>
            {nombre === "referencia" && avisoReferencia && (
              <p className="form-atributos-aviso">{avisoReferencia}</p>
            )}
            {nombre === "referencia" && vinculosReferencia && vinculosReferencia.length > 0 && (
              <p className="form-atributos-vinculos">
                Vinculado con:{" "}
                {vinculosReferencia
                  .map((v) => `${v.etiqueta} (${v.hoja})`)
                  .join(" · ")}
              </p>
            )}
          </Fragment>
        );
      })}

      {/* C16: composición del JUEGO DE BARRAS elegible con chips.
       * Cuántas barras de fase representa (1F/2F/3F) y si incluye
       * neutro (N) y/o tierra (PE). Los valores viven en los mismos
       * campos del schema; acá se eligen, no quedan fijos. */}
      {familia === "barra" && atributos.es_conjunto === true && (
        <div
          className="campo-atributo"
          title="Qué representa el juego: cuántas fases y si suma neutro y/o tierra"
        >
          <span>Composición</span>
          <div className="chips" role="group" aria-label="Composición del juego de barras">
            {[1, 2, 3].map((f) => (
              <button
                key={f}
                type="button"
                className={`chip${atributos.cantidad_fases === f ? " on" : ""}`}
                onClick={() => actualizar("cantidad_fases", f)}
                title={`${f} ${f === 1 ? "barra de fase" : "barras de fase"}`}
              >
                {f}F
              </button>
            ))}
            <button
              type="button"
              className={`chip${atributos.incluye_neutro === true ? " on" : ""}`}
              onClick={() => actualizar("incluye_neutro", atributos.incluye_neutro !== true)}
              title="Incluye una barra de neutro"
            >
              N
            </button>
            <button
              type="button"
              className={`chip${atributos.incluye_tierra === true ? " on" : ""}`}
              onClick={() => actualizar("incluye_tierra", atributos.incluye_tierra !== true)}
              title="Incluye una barra de tierra (PE)"
            >
              PE
            </button>
          </div>
        </div>
      )}

      {/* Motor trifásico: si falta In de placa, ofrecé una ESTIMACIÓN
          explícita (η y cos φ por defecto si no están cargados). El
          botón completa el campo Y TAMBIÉN deja cargados los valores
          supuestos de η/cosφ (C11: el plano documenta qué se asumió);
          nunca pisa un valor real ya existente. */}
      {familia === "aparato" &&
        atributos.tipo_aparato === "motor_trifasico" &&
        atributos.in_a == null &&
        (() => {
          const est = estimarInA(atributos);
          if (est === null) return null;
          const ef =
            typeof atributos.eficiencia_pct === "number" && atributos.eficiencia_pct > 0
              ? atributos.eficiencia_pct
              : 90;
          const cos =
            typeof atributos.factor_potencia === "number" && atributos.factor_potencia > 0
              ? atributos.factor_potencia
              : 0.85;
          const usarEstimacion = () => {
            const nuevos: Record<string, unknown> = { ...atributos, in_a: est };
            if (atributos.eficiencia_pct == null) nuevos.eficiencia_pct = ef;
            if (atributos.factor_potencia == null) nuevos.factor_potencia = cos;
            onChange(nuevos);
          };
          return (
            <div className="estimacion-in">
              <span title="Estimación desde potencia de eje + η + cosφ + tensión; no reemplaza el dato de placa">
                In ≈ {est} A (estimado, η={ef}% · cosφ={cos})
              </span>
              <button type="button" onClick={usarEstimacion}>
                usar
              </button>
            </div>
          );
        })()}

      {/* Barra: si falta la corriente admisible, ofrecé el valor de
          DIN 43671 (cobre, tabla real) o una ESTIMACIÓN por densidad de
          corriente si la sección no está tabulada o hay varias barras
          apiladas (E55/E56, ver lib/barras.ts). Nunca pisa un valor
          real ya cargado. */}
      {familia === "barra" &&
        atributos.corriente_admisible_A == null &&
        (() => {
          const est = estimarCorrienteAdmisibleBarraA(
            atributos.dimensiones as string | undefined,
            atributos.material as "Cu" | "Al" | undefined,
          );
          if (est === null) return null;
          const usarEstimacion = () =>
            onChange({ ...atributos, corriente_admisible_A: est.corrienteA });
          const esTabla = est.fuente === "tabla";
          return (
            <div className="estimacion-in">
              <span
                title={
                  esTabla
                    ? "DIN 43671 (barras de cobre desnudas, 35°C aire / 65°C barra) — aluminio derivado con el factor de conversión Cu→Al habitual (÷1,27). Ver lib/barras.ts."
                    : "Estimación por densidad de corriente típica de barra de tablero BT — sección no tabulada en DIN 43671, o varias barras apiladas (el agrupamiento no es lineal). No reemplaza la tabla real del fabricante. Ver lib/barras.ts."
                }
              >
                Corriente admisible ≈ {est.corrienteA} A
                {esTabla ? " (DIN 43671)" : " (estimado)"}
              </span>
              <button type="button" onClick={usarEstimacion}>
                usar
              </button>
            </div>
          );
        })()}
    </div>
  );
}
