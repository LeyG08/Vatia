import { lineasCable } from "../lib/anotaciones";
import type { CampoDescriptor } from "../lib/esquemas";
import { camposDeFamilia } from "../lib/esquemas";

interface Props {
  atributos: Record<string, unknown>;
  onChange: (nuevosAtributos: Record<string, unknown>) => void;
  /** Campo extra arriba del cuerpo (ej.: "Desde dónde viene" del alimentador) */
  encabezado?: React.ReactNode;
}

function poner(
  attrs: Record<string, unknown>,
  nombre: string,
  valor: unknown,
): Record<string, unknown> {
  const nuevos = { ...attrs };
  if (valor === undefined || valor === "") delete nuevos[nombre];
  else nuevos[nombre] = valor;
  return nuevos;
}

/** Llave on/off (neutro / tierra) */
function Llave({
  activada,
  onToggle,
}: {
  activada: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`fc-llave${activada ? " activa" : ""}`}
      role="switch"
      aria-checked={activada}
      onClick={onToggle}
    >
      <span className="fc-llave-perilla" />
      <span className="fc-llave-texto">{activada ? "Sí" : "No"}</span>
    </button>
  );
}

/**
 * Formulario de CONEXIÓN (familia conductor) con UI propia pedida por
 * el usuario: barras que representan los conductores de fase, llaves
 * para neutro/tierra con sección opcional si difiere, radios
 * unipolar/multipolar y vista previa de la notación del plano.
 * El resto de campos (material, aislación, norma) usa el render común.
 */
export default function FormularioConductor({ atributos, onChange, encabezado }: Props) {
  const fases =
    typeof atributos.cantidad_conductores === "number"
      ? atributos.cantidad_conductores
      : 0;

  // Campos simples restantes, resueltos desde el schema (sin hardcodear)
  const manejados = new Set([
    "cantidad_conductores",
    "tipo_cable",
    "lleva_neutro",
    "seccion_neutro_mm2",
    "lleva_tierra",
    "seccion_tierra_mm2",
    "seccion_fase_mm2",
  ]);
  const simples = (camposDeFamilia("conductor", atributos) ?? []).filter(
    (c: CampoDescriptor) => !manejados.has(c.nombre),
  );

  const preview = lineasCable(atributos);

  return (
    <div className="form-atributos fc">
      {encabezado}

      {/* ---- Conductores de fase: número con stepper ---- */}
      <div className="campo-atributo">
        <span>
          Conductores<em className="obligatorio">*</em>
        </span>
        <div className="fc-fases">
          <button
            type="button"
            className="fc-paso"
            disabled={fases <= 1}
            onClick={() => onChange(poner(atributos, "cantidad_conductores", Math.max(1, fases - 1)))}
            title="Quitar conductor de fase"
          >
            −
          </button>
          <span className="fc-numero">{fases || "—"}</span>
          <button
            type="button"
            className="fc-paso"
            onClick={() => onChange(poner(atributos, "cantidad_conductores", fases + 1))}
            title="Agregar conductor de fase"
          >
            +
          </button>
        </div>
      </div>

      {/* ---- Sección de fase ---- */}
      <label className="campo-atributo">
        <span>Sección mm²<em className="obligatorio">*</em></span>
        <input
          type="number"
          min={0}
          step="any"
          value={(atributos.seccion_fase_mm2 as number | undefined) ?? ""}
          onChange={(e) =>
            onChange(
              poner(
                atributos,
                "seccion_fase_mm2",
                e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
              ),
            )
          }
        />
      </label>

      {/* ---- Unipolares / Multipolar ---- */}
      <div className="campo-atributo">
        <span>Tipo<em className="obligatorio">*</em></span>
        <div className="fc-tipos">
          {(["unipolar", "multipolar"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`fc-tipo${atributos.tipo_cable === t ? " activa" : ""}`}
              onClick={() => onChange(poner(atributos, "tipo_cable", t))}
              title={
                t === "unipolar"
                  ? "Conductores sueltos → se anota n x 1 x S"
                  : "Un cable con núcleos → se anota 1 x n x S"
              }
            >
              {t === "unipolar" ? "Unipolares" : "Multipolar"}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Neutro ---- */}
      <div className="campo-atributo">
        <span>Neutro</span>
        <Llave
          activada={atributos.lleva_neutro === true}
          onToggle={() => {
            const nuevos = poner(atributos, "lleva_neutro", atributos.lleva_neutro !== true);
            if (atributos.lleva_neutro === true) delete nuevos.seccion_neutro_mm2;
            onChange(nuevos);
          }}
        />
      </div>
      {atributos.lleva_neutro === true && (
        <label className="campo-atributo fc-sub">
          <span>↳ Sección distinta</span>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="= fase"
            value={(atributos.seccion_neutro_mm2 as number | undefined) ?? ""}
            onChange={(e) =>
              onChange(
                poner(
                  atributos,
                  "seccion_neutro_mm2",
                  e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
                ),
              )
            }
          />
        </label>
      )}

      {/* ---- Tierra ---- */}
      <div className="campo-atributo">
        <span>Tierra (PE)</span>
        <Llave
          activada={atributos.lleva_tierra === true}
          onToggle={() => {
            const nuevos = poner(atributos, "lleva_tierra", atributos.lleva_tierra !== true);
            if (atributos.lleva_tierra === true) delete nuevos.seccion_tierra_mm2;
            onChange(nuevos);
          }}
        />
      </div>
      {atributos.lleva_tierra === true && (
        <label className="campo-atributo fc-sub">
          <span>↳ Sección distinta</span>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="= fase"
            value={(atributos.seccion_tierra_mm2 as number | undefined) ?? ""}
            onChange={(e) =>
              onChange(
                poner(
                  atributos,
                  "seccion_tierra_mm2",
                  e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
                ),
              )
            }
          />
        </label>
      )}

      {/* ---- Resto: material / aislación / norma (desde schema) ---- */}
      {simples.map((campo) => {
        const v = atributos[campo.nombre];
        let control: React.ReactNode;
        if (campo.esquema.enum) {
          control = (
            <select
              value={v === undefined || v === null ? "" : String(v)}
              onChange={(e) => onChange(poner(atributos, campo.nombre, e.target.value || undefined))}
            >
              <option value="">—</option>
              {campo.esquema.enum.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          );
        } else {
          control = (
            <input
              type="text"
              value={v === undefined || v === null ? "" : String(v)}
              onChange={(e) => onChange(poner(atributos, campo.nombre, e.target.value || undefined))}
            />
          );
        }
        return (
          <label key={campo.nombre} className="campo-atributo" title={campo.esquema.description}>
            <span>
              {campo.nombre}
              {campo.obligatorio && <em className="obligatorio">*</em>}
            </span>
            {control}
          </label>
        );
      })}

      {/* ---- Vista previa de la notación ---- */}
      {preview.length > 0 && (
        <div className="fc-preview">
          {preview.map((linea, i) => (
            <div key={i}>{linea}</div>
          ))}
        </div>
      )}
    </div>
  );
}
