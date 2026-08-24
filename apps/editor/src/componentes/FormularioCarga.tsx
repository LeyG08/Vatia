import { type ReactElement } from "react";
import {
  calcularUtilizacionVa,
  kuSugeridoPara,
} from "../lib/utilizacion";

interface Props {
  atributos: Record<string, unknown>;
  onChange: (nuevosAtributos: Record<string, unknown>) => void;
}

function valorComoTexto(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

/**
 * Potencia aparente en VA a partir de la alimentación, el neutro y la
 * corriente (regla C9 acordada con el usuario):
 *   monofásica con neutro → S = 220 · I
 *   monofásica sin neutro (entre fases) → S = 380 · I
 *   trifásica → S = √3 · 380 · I
 */
export function calcularPotenciaVa(a: Record<string, unknown>): number | null {
  const i =
    typeof a.corriente_a === "number" &&
    Number.isFinite(a.corriente_a) &&
    a.corriente_a > 0
      ? a.corriente_a
      : null;
  if (i === null) return null;
  if (a.alimentacion === "trifasica") {
    return Math.round(Math.sqrt(3) * 380 * i);
  }
  return Math.round((a.lleva_neutro === false ? 380 : 220) * i);
}

const TIPOS = ["IUG", "TUG", "ACU", "seccional", "otra"];
const LINEAS = ["L1", "L2", "L3"];

/**
 * Ficha de una CARGA (destino de circuito). La potencia NO se edita:
 * se recalcula sola cada vez que cambian alimentación / neutro /
 * corriente.
 */
export default function FormularioCarga({ atributos, onChange }: Props) {
  function actualizar(nombre: string, valor: unknown) {
    const nuevos: Record<string, unknown> = { ...atributos };
    if (valor === undefined || valor === "") {
      delete nuevos[nombre];
    } else {
      nuevos[nombre] = valor;
    }

    // Al elegir tipo de carga, si todavía no cargó un Ku a mano,
    // precargá el sugerido (queda editable).
    if (nombre === "tipo_carga" && nuevos.ku === undefined) {
      const sugerido = kuSugeridoPara(valor);
      if (sugerido !== undefined) nuevos.ku = sugerido;
    }

    const va = calcularPotenciaVa(nuevos);
    if (va === null) {
      delete nuevos.potencia_va;
    } else {
      nuevos.potencia_va = va;
    }

    // Potencia de utilización encadenada a la nominal (se guarda para
    // el futuro agregador de tablero con Ks)
    const util = calcularUtilizacionVa(nuevos);
    if (util === null) {
      delete nuevos.potencia_utilizacion_va;
    } else {
      nuevos.potencia_utilizacion_va = util;
    }

    // Si pasa a trifásica, la línea asignada deja de aplicar
    if (
      nuevos.alimentacion === "trifasica" &&
      typeof nuevos.linea_asignada === "string"
    ) {
      delete nuevos.linea_asignada;
    }

    onChange(nuevos);
  }

  function seleccion(
    nombre: string,
    opciones: string[],
    deshabilitado = false,
  ): ReactElement {
    return (
      <select
        disabled={deshabilitado}
        value={valorComoTexto(atributos[nombre])}
        onChange={(e) => actualizar(nombre, e.target.value || undefined)}
      >
        <option value="">—</option>
        {opciones.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
    );
  }

  const esTrifasica = atributos.alimentacion === "trifasica";
  const vaCalculada = calcularPotenciaVa(atributos);
  const utilCalculada = calcularUtilizacionVa(atributos);

  return (
    <div className="form-atributos">
      <label className="campo-atributo">
        <span>
          Circuito<em className="obligatorio">*</em>
        </span>
        <input
          type="text"
          placeholder="C1"
          value={valorComoTexto(atributos.codigo_circuito)}
          onChange={(e) => actualizar("codigo_circuito", e.target.value || undefined)}
        />
      </label>

      <label className="campo-atributo" title="IUG iluminación · TUG tomacorrientes · ACU aire acondicionado">
        <span>
          Tipo de carga<em className="obligatorio">*</em>
        </span>
        {seleccion("tipo_carga", TIPOS)}
      </label>

      <label className="campo-atributo">
        <span>
          Alimentación<em className="obligatorio">*</em>
        </span>
        {seleccion("alimentacion", ["monofasica", "trifasica"])}
      </label>

      {/* C13: línea asignada como CHIPS que se iluminan (L1/L2/L3).
       * En trifásica quedan apagados: no aplica. Click de nuevo =
       * deseleccionar. */}
      <div className="campo-atributo" title={esTrifasica ? "En trifásica no aplica" : "Línea del tablero para equilibrar fases"}>
        <span>Línea asignada</span>
        <div className="chips" role="group" aria-label="Línea asignada">
          {LINEAS.map((ln) => (
            <button
              key={ln}
              type="button"
              disabled={esTrifasica}
              className={`chip${atributos.linea_asignada === ln ? " on" : ""}`}
              onClick={() =>
                actualizar(
                  "linea_asignada",
                  atributos.linea_asignada === ln ? undefined : ln,
                )
              }
            >
              {ln}
            </button>
          ))}
        </div>
      </div>

      {/* C13: neutro como par de chips iluminados (obligatorio) */}
      <div className="campo-atributo" title="Sin neutro la carga queda entre fases (380 V)">
        <span>
          Neutro<em className="obligatorio">*</em>
        </span>
        <div className="chips" role="group" aria-label="Neutro">
          <button
            type="button"
            className={`chip${atributos.lleva_neutro === true ? " on" : ""}`}
            onClick={() => actualizar("lleva_neutro", true)}
          >
            con neutro
          </button>
          <button
            type="button"
            className={`chip${atributos.lleva_neutro === false ? " on" : ""}`}
            onClick={() => actualizar("lleva_neutro", false)}
          >
            sin neutro
          </button>
        </div>
      </div>

      <label className="campo-atributo" title="Con la corriente se calcula la potencia automáticamente">
        <span>Corriente (A)</span>
        <input
          type="number"
          step="any"
          min={0}
          value={valorComoTexto(atributos.corriente_a)}
          onChange={(e) =>
            actualizar(
              "corriente_a",
              e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
            )
          }
        />
      </label>

      <label className="campo-atributo" title="Calculada automáticamente según alimentación y corriente">
        <span>Potencia (VA)</span>
        <input type="text" readOnly value={vaCalculada === null ? "" : String(vaCalculada)} />
      </label>

      <label
        className="campo-atributo"
        title="Coeficiente de utilización: fracción de la nominal en uso. Sugerido por tipo de carga, siempre editable"
      >
        <span>Ku utilización</span>
        <input
          type="number"
          step="0.05"
          min={0}
          max={1}
          placeholder="1"
          value={valorComoTexto(atributos.ku)}
          onChange={(e) =>
            actualizar(
              "ku",
              e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
            )
          }
        />
      </label>

      <label className="campo-atributo" title="potencia_va × Ku — se guardará para el agregador de tablero con Ks">
        <span>Pot. utilización (VA)</span>
        <input type="text" readOnly value={utilCalculada === null ? "" : String(utilCalculada)} />
      </label>

      <label className="campo-atributo">
        <span>Descripción</span>
        <input
          type="text"
          placeholder="Luces Tablero"
          value={valorComoTexto(atributos.descripcion)}
          onChange={(e) => actualizar("descripcion", e.target.value || undefined)}
        />
      </label>
    </div>
  );
}
