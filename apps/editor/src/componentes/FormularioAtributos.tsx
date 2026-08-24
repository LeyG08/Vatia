import { useMemo, type ReactElement } from "react";
import {
  type FamiliaAtributos,
  camposDeFamilia,
  algunoObligatorio,
  parAutomatico,
} from "../lib/esquemas";

interface Props {
  familia: FamiliaAtributos;
  atributos: Record<string, unknown>;
  onChange: (nuevosAtributos: Record<string, unknown>) => void;
}

function valorComoTexto(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

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

export default function FormularioAtributos({ familia, atributos, onChange }: Props) {
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
        const { nombre, esquema, obligatorio } = campo;
        const valorActual = atributos[nombre];

        let control: ReactElement;

        if (esquema.enum) {
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
          <label key={nombre} className="campo-atributo" title={esquema.description}>
            <span>
              {nombre}
              {obligatorio && <em className="obligatorio" aria-label="obligatorio">*</em>}
            </span>
            {control}
          </label>
        );
      })}

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
    </div>
  );
}
