import { type ReactElement } from "react";

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

    const va = calcularPotenciaVa(nuevos);
    if (va === null) {
      delete nuevos.potencia_va;
    } else {
      nuevos.potencia_va = va;
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

      <label className="campo-atributo" title={esTrifasica ? "En trifásica no aplica" : "Línea del tablero para equilibrar fases"}>
        <span>Línea asignada</span>
        {seleccion("linea_asignada", LINEAS, esTrifasica)}
      </label>

      <label className="campo-atributo" title="Sin neutro la carga queda entre fases (380 V)">
        <span>
          Neutro<em className="obligatorio">*</em>
        </span>
        <select
          value={
            atributos.lleva_neutro === true
              ? "si"
              : atributos.lleva_neutro === false
                ? "no"
                : ""
          }
          onChange={(e) =>
            actualizar(
              "lleva_neutro",
              e.target.value === "" ? undefined : e.target.value === "si",
            )
          }
        >
          <option value="">—</option>
          <option value="si">sí</option>
          <option value="no">no</option>
        </select>
      </label>

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
