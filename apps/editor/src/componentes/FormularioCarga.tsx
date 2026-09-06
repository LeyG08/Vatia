import { type ReactElement } from "react";
import { useEditor } from "../lib/store";
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
 *   monofásica con neutro → S = tensiónFase · I
 *   monofásica sin neutro (entre fases) → S = tensiónLínea · I
 *   trifásica → S = √3 · tensiónLínea · I
 *
 * C41: tensiónFase/tensiónLínea vienen de datosProyecto (antes hardcodeadas
 * en 220/380 V acá mismo); el llamador las pasa porque este módulo no
 * tiene acceso al store.
 */
export function calcularPotenciaVa(
  a: Record<string, unknown>,
  tensionFaseV = 220,
  tensionLineaV = 380,
): number | null {
  const i =
    typeof a.corriente_a === "number" &&
    Number.isFinite(a.corriente_a) &&
    a.corriente_a > 0
      ? a.corriente_a
      : null;
  if (i === null) return null;
  // C30: sin fases definidas no hay tensión de referencia → no se calcula
  if (a.alimentacion !== "monofasica" && a.alimentacion !== "trifasica")
    return null;
  if (a.alimentacion === "trifasica") {
    return Math.round(Math.sqrt(3) * tensionLineaV * i);
  }
  return Math.round((a.lleva_neutro === false ? tensionLineaV : tensionFaseV) * i);
}

const TIPOS = ["IUG", "TUG", "ACU", "seccional", "otra"];
const LINEAS = ["L1", "L2", "L3"];

/**
 * Ficha de una CARGA (destino de circuito). La potencia NO se edita:
 * se recalcula sola cada vez que cambian alimentación / neutro /
 * corriente.
 */
export default function FormularioCarga({ atributos, onChange }: Props) {
  const tensionFaseV = useEditor((s) => s.proyecto.datosProyecto.tension_fase_v);
  const tensionLineaV = useEditor((s) => s.proyecto.datosProyecto.tension_linea_v);

  function actualizar(nombre: string, valor: unknown) {
    const nuevos: Record<string, unknown> = { ...atributos };
    if (valor === undefined || valor === "") {
      delete nuevos[nombre];
    } else {
      nuevos[nombre] = valor;
    }

    // Al elegir tipo de carga, si todavía no cargó un Ku a mano,
    // precargá el sugerido (queda editable).
    /* E82 — la descripcion de una carga SECCIONAL es el nombre de un
     * tablero, y en un plano los tableros se rotulan en mayuscula. Se
     * normaliza al guardar y no al escribir, para no pelearse con el
     * cursor mientras se tipea. */
    if (
      nombre === "descripcion" &&
      typeof valor === "string" &&
      nuevos.tipo_carga === "seccional"
    ) {
      nuevos.descripcion = valor.toUpperCase();
    }
    if (nombre === "tipo_carga" && nuevos.ku === undefined) {
      const sugerido = kuSugeridoPara(valor);
      if (sugerido !== undefined) nuevos.ku = sugerido;
    }

    const va = calcularPotenciaVa(nuevos, tensionFaseV, tensionLineaV);
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
  const vaCalculada = calcularPotenciaVa(atributos, tensionFaseV, tensionLineaV);
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

      {/* C30: composición LIBRE de la carga — fases (— / 1F / 3F),
       * neutro y tierra independientes entre sí. Sin fases la potencia
       * no se calcula (no hay tensión de referencia). */}
      <div className="campo-atributo" title="Cantidad de fases que entran a la carga">
        <span>Fases</span>
        <div className="chips" role="group" aria-label="Fases">
          {(
            [
              ["", "—"],
              ["monofasica", "1F"],
              ["trifasica", "3F"],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button
              key={etiqueta}
              type="button"
              className={`chip${(atributos.alimentacion as string | undefined ?? "") === valor ? " on" : ""}`}
              onClick={() => actualizar("alimentacion", valor || undefined)}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="campo-atributo" title={`Sin neutro la carga queda entre fases (${tensionLineaV} V)`}>
        <span>Neutro</span>
        <div className="chips" role="group" aria-label="Neutro">
          <button
            type="button"
            className={`chip${atributos.lleva_neutro === true ? " on" : ""}`}
            onClick={() => actualizar("lleva_neutro", true)}
          >
            con N
          </button>
          <button
            type="button"
            className={`chip${atributos.lleva_neutro === false ? " on" : ""}`}
            onClick={() => actualizar("lleva_neutro", false)}
          >
            sin N
          </button>
        </div>
      </div>

      <div className="campo-atributo" title="Conductor de tierra (PE), independiente del neutro">
        <span>Tierra</span>
        <div className="chips" role="group" aria-label="Tierra">
          <button
            type="button"
            className={`chip${atributos.lleva_tierra === true ? " on" : ""}`}
            onClick={() => actualizar("lleva_tierra", true)}
          >
            con PE
          </button>
          <button
            type="button"
            className={`chip${atributos.lleva_tierra === false ? " on" : ""}`}
            onClick={() => actualizar("lleva_tierra", false)}
          >
            sin PE
          </button>
        </div>
      </div>

      {/* C13: línea asignada como CHIPS que se iluminan (L1/L2/L3).
       * Solo aplica a monofásica (C30: con fases "—" tampoco aplica).
       * Click de nuevo = deseleccionar. */}
      <div className="campo-atributo" title={esTrifasica ? "En trifásica no aplica" : "Línea del tablero para equilibrar fases"}>
        <span>Línea asignada</span>
        <div className="chips" role="group" aria-label="Línea asignada">
          {LINEAS.map((ln) => (
            <button
              key={ln}
              type="button"
              disabled={!atributos.alimentacion || esTrifasica}
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

      <label
        className="campo-atributo"
        title="cosφ: IUG/TUG cercano a 1 (resistivo), ACU y cargas con motor 0,8-0,9 (inductivo). Todavía no lo consume ningún cálculo."
      >
        <span>Factor de potencia (cosφ)</span>
        <input
          type="number"
          step="0.01"
          min={0}
          max={1}
          value={valorComoTexto(atributos.factor_potencia)}
          onChange={(e) =>
            actualizar(
              "factor_potencia",
              e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
            )
          }
        />
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

      <label
        className="campo-atributo"
        title="Simultaneidad de ESTA carga respecto de las demás del mismo tablero (distinto de Ku, que ajusta la potencia propia). En ACU o máquinas compuestas, la potencia ya puede venir afectada por la simultaneidad interna de sus propios elementos — acá va la simultaneidad ADICIONAL con el resto."
      >
        <span>Ks simultaneidad</span>
        <input
          type="number"
          step="0.05"
          min={0}
          max={1}
          placeholder="1"
          value={valorComoTexto(atributos.ks)}
          onChange={(e) =>
            actualizar(
              "ks",
              e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
            )
          }
        />
      </label>

      {/* C16: la potencia y la utilización se CALCULAN solas — ya no
       * van como campos del formulario (confundían); solo un aviso de
       * qué está quedando. En el plano se anotan igual. */}
      {vaCalculada !== null && (() => {
        const ku = typeof atributos.ku === "number" ? atributos.ku : null;
        return (
          <p className="form-calculado">
            = {vaCalculada} VA
            {utilCalculada !== null && ku !== null && ku < 1
              ? ` · útil ${utilCalculada} VA (${Math.round(ku * 100)} %)`
              : ""}
          </p>
        );
      })()}

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
