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
    </div>
  );
}
