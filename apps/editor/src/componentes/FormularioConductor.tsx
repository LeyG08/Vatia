import { lineasCable } from "../lib/anotaciones";
import type { CampoDescriptor } from "../lib/esquemas";
import { camposDeFamilia } from "../lib/esquemas";
import type { ResultadoIz } from "../lib/calculo";
import {
  seccionesDisponiblesMm2,
  seccionMinimaPeMm2,
  seccionMinimaMm2,
  type RolCircuito,
} from "../lib/secciones";
import type { ModoHoja, Normativa } from "../lib/tipos";
import SelectorConEscape from "./SelectorConEscape";

interface Props {
  atributos: Record<string, unknown>;
  onChange: (nuevosAtributos: Record<string, unknown>) => void;
  /** Campo extra arriba del cuerpo (ej.: "Desde dónde viene" del alimentador) */
  encabezado?: React.ReactNode;
  /** Modo de la hoja activa (E54): decide qué secciones normadas se
   * ofrecen — el rango completo de fuerza en unifilar, recortado a la
   * práctica de comando en multifilar. */
  modo: ModoHoja;
  /** Normativa del proyecto (E60) — decide el mínimo de sección junto
   * con `rol`. */
  normativa: Normativa;
  /** Rol de este circuito (E60): una conexión cualquiera es "terminal";
   * un alimentador es "seccional" (hoja con padre) o "principal" (hoja
   * raíz) — determina el mínimo AEA, ver lib/secciones.ts. */
  rol: RolCircuito;
  /**
   * Ib (A), ΔU% e Iz ya calculados por el llamador (necesita recorrer la
   * topología completa, algo que este formulario no tiene por qué saber
   * hacer). Ausentes cuando falta algún dato para calcularlos.
   */
  calculo?: {
    ibA: number | null;
    caidaPct: number | null;
    iz: ResultadoIz | null;
    /** Cuántos conductores comparten la canalización dada, contado
     * solo — 1 = va solo, sin agrupamiento. Función y no un número: la
     * canalización es por TRAMO (E60), no por cable entero. */
    circuitosAgrupadosDe: (canalizacion: string | undefined) => number;
  };
}

/** Opciones del selector de sección — "6 mm²" en vez de solo "6", para
 * que se lea igual que el resto de la ficha técnica. */
function opcionesSeccion(material: unknown, modo: ModoHoja, minimoMm2: number) {
  const mat = material === "Al" ? "Al" : "Cu";
  return seccionesDisponiblesMm2(mat, modo, minimoMm2).map((s) => ({
    valor: String(s),
    etiqueta: `${s} mm²`,
  }));
}

/** Un tramo del recorrido físico del cable (E59/E60) — ver
 * TramoInstalacion en lib/calculo.ts, mismo shape. */
interface Tramo {
  metodo_instalacion?: string;
  longitud_m?: number;
  temperatura_ambiente_c?: number;
  canalizacion?: string;
}

function valorComoTexto(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
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

/**
 * Referencia de los códigos de método de instalación (AEA 90364-5-52 /
 * IEC 60364-5-52, Anexo B, Tabla B52-1). Notas propias y resumidas, no una
 * transcripción de la norma — ver docs/normativa/README.md sobre por qué
 * no se versiona el texto completo de la tabla acá.
 */
const METODOS_INSTALACION: { codigo: string; descripcion: string }[] = [
  { codigo: "A1", descripcion: "Conductores aislados en tubo embutido en pared aislante térmicamente (ej. tabique de Durlock)." },
  { codigo: "A2", descripcion: "Cable multipolar en tubo embutido en pared aislante térmicamente." },
  { codigo: "B1", descripcion: "Conductores aislados en tubo sobre pared o embutido en mampostería (el caso más común en obra civil)." },
  { codigo: "B2", descripcion: "Cable multipolar en tubo sobre pared o embutido en mampostería." },
  { codigo: "C", descripcion: "Cable mono o multipolar fijado directamente sobre la pared, sin tubo." },
  { codigo: "D1", descripcion: "Cable multipolar dentro de caño o conducto enterrado." },
  { codigo: "D2", descripcion: "Cable multipolar directamente enterrado, sin caño." },
  { codigo: "E", descripcion: "Cable multipolar al aire libre, en bandeja o escalera (no en contacto mutuo con otros cables)." },
  { codigo: "F", descripcion: "Cables monopolares en contacto mutuo, al aire libre en bandeja." },
  { codigo: "G", descripcion: "Cables monopolares separados entre sí (espaciados), al aire libre en bandeja." },
];

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
export default function FormularioConductor({
  atributos,
  onChange,
  encabezado,
  modo,
  normativa,
  rol,
  calculo,
}: Props) {
  const fases =
    typeof atributos.cantidad_conductores === "number"
      ? atributos.cantidad_conductores
      : 0;
  const minimoFaseMm2 = seccionMinimaMm2(normativa, rol);

  // Campos simples restantes, resueltos desde el schema (sin hardcodear)
  const manejados = new Set([
    "cantidad_conductores",
    "tipo_cable",
    "lleva_neutro",
    "seccion_neutro_mm2",
    "lleva_tierra",
    "seccion_tierra_mm2",
    "seccion_fase_mm2",
    "tramos",
  ]);
  const simples = (camposDeFamilia("conductor", atributos) ?? []).filter(
    (c: CampoDescriptor) => !manejados.has(c.nombre),
  );

  const tramos = Array.isArray(atributos.tramos) ? (atributos.tramos as Tramo[]) : [];
  function actualizarTramos(nuevos: Tramo[]) {
    onChange(poner(atributos, "tramos", nuevos.length > 0 ? nuevos : undefined));
  }
  function actualizarTramo(indice: number, campo: keyof Tramo, valor: unknown) {
    const nuevos = tramos.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t));
    actualizarTramos(nuevos);
  }

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
            disabled={fases <= 0}
            onClick={() => onChange(poner(atributos, "cantidad_conductores", Math.max(0, fases - 1)))}
            title="Quitar conductor de fase (0 = solo neutro/tierra)"
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

      {/* ---- Sección de fase ----
       * Lista normada (E54), no texto libre: son los valores REALES de
       * la tabla Iz ya cargada (Tablas B52-2 a B52-5, ver
       * lib/secciones.ts) — así el cálculo de Iz más abajo nunca falla
       * en silencio por una sección que la norma no tabula. Recortada
       * al mínimo AEA por rol de circuito (E60) — "Otra…" sigue
       * permitiendo bajar de ahí a mano, para el caso excepcional. */}
      <label
        className="campo-atributo"
        title={`Mínimo para este circuito (${rol}, ${normativa}): ${minimoFaseMm2} mm².`}
      >
        <span>Sección mm²<em className="obligatorio">*</em></span>
        <SelectorConEscape
          valor={valorComoTexto(atributos.seccion_fase_mm2)}
          opciones={opcionesSeccion(atributos.material, modo, minimoFaseMm2)}
          placeholder="mm²"
          etiquetaVacio="—"
          onChange={(v) =>
            onChange(poner(atributos, "seccion_fase_mm2", v === "" ? undefined : Number.parseFloat(v)))
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
          <SelectorConEscape
            valor={valorComoTexto(atributos.seccion_neutro_mm2)}
            opciones={opcionesSeccion(atributos.material, modo, 0)}
            placeholder="mm²"
            etiquetaVacio="= fase"
            onChange={(v) =>
              onChange(poner(atributos, "seccion_neutro_mm2", v === "" ? undefined : Number.parseFloat(v)))
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
          <SelectorConEscape
            valor={valorComoTexto(atributos.seccion_tierra_mm2)}
            opciones={opcionesSeccion(atributos.material, modo, 0)}
            placeholder="mm²"
            etiquetaVacio="= fase"
            onChange={(v) =>
              onChange(poner(atributos, "seccion_tierra_mm2", v === "" ? undefined : Number.parseFloat(v)))
            }
          />
        </label>
      )}
      {/* Mínimo de PE recomendado (E54): regla proporcional IEC
       * 60364-5-54 / AEA 90364-5-54 respecto de la sección de fase —
       * S≤16→Spe=S, 16<S≤35→Spe=16, S>35→Spe=S/2. Solo avisa si el
       * usuario cargó una sección de tierra MENOR a la que pide la
       * regla: tener más cobre que el mínimo nunca es un problema. */}
      {atributos.lleva_tierra === true &&
        typeof atributos.seccion_tierra_mm2 === "number" &&
        (() => {
          const minimo = seccionMinimaPeMm2(atributos.seccion_fase_mm2 as number | undefined);
          if (minimo === null || (atributos.seccion_tierra_mm2 as number) >= minimo) return null;
          return (
            <p className="form-atributos-aviso">
              La sección de tierra ({atributos.seccion_tierra_mm2 as number} mm²) queda por
              debajo del mínimo recomendado para {atributos.seccion_fase_mm2 as number} mm² de
              fase: {minimo} mm² (IEC 60364-5-54 / AEA 90364-5-54).
            </p>
          );
        })()}

      {/* ---- Resto: campos que faltan (desde schema) ----
       * Cubre enum/número/entero/booleano/texto, igual que el renderer
       * genérico de FormularioAtributos.tsx. Hasta acá solo entendía enum
       * y texto: cualquier campo numérico que se agregara al schema de
       * conductor (longitud_m, temperatura_ambiente_c, cantidad_
       * circuitos_agrupados) se hubiera guardado como STRING en vez de
       * number, en silencio — el <input type="text"> nunca lo convertía. */}
      {simples.map((campo) => {
        const v = atributos[campo.nombre];
        const texto = valorComoTexto(v);
        let control: React.ReactNode;
        if (campo.esquema.enum) {
          control = (
            <select
              value={texto}
              onChange={(e) => onChange(poner(atributos, campo.nombre, e.target.value || undefined))}
            >
              <option value="">—</option>
              {campo.esquema.enum.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          );
        } else if (campo.esquema.type === "boolean") {
          control = (
            <select
              value={v === true ? "si" : v === false ? "no" : ""}
              onChange={(e) =>
                onChange(
                  poner(atributos, campo.nombre, e.target.value === "" ? undefined : e.target.value === "si"),
                )
              }
            >
              <option value="">—</option>
              <option value="si">sí</option>
              <option value="no">no</option>
            </select>
          );
        } else if (campo.esquema.type === "number" || campo.esquema.type === "integer") {
          control = (
            <input
              type="number"
              step={campo.esquema.type === "integer" ? 1 : "any"}
              min={campo.esquema.minimum ?? campo.esquema.exclusiveMinimum}
              max={campo.esquema.maximum}
              value={texto}
              onChange={(e) =>
                onChange(
                  poner(
                    atributos,
                    campo.nombre,
                    e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
                  ),
                )
              }
            />
          );
        } else {
          control = (
            <input
              type="text"
              value={texto}
              onChange={(e) => onChange(poner(atributos, campo.nombre, e.target.value || undefined))}
            />
          );
        }
        return (
          <label key={campo.nombre} className="campo-atributo" title={campo.esquema.description}>
            <span>
              {/* Título humano del schema; sin esto caía en el nombre
               * crudo del campo ("material", "aislacion", "norma_iram")
               * en vez de "Material", "Aislación", "Norma IRAM". */}
              {campo.title ?? campo.nombre}
              {campo.obligatorio && <em className="obligatorio">*</em>}
            </span>
            {control}
          </label>
        );
      })}

      {/* ---- Tramos de instalación (E59) ----
       * Un mismo cable puede recorrer varios métodos de instalación
       * distintos (parte encañado en pared, parte enterrado…) — pedido
       * explícito del usuario. El caso común (un solo tramo) es
       * simplemente una lista de un elemento, sin ceremonia extra. El
       * tramo que resultó el más restrictivo (el que fija el Iz del
       * cable entero) se marca cuando hay más de uno. */}
      <div className="fc-tramos">
        <span className="fc-tramos-titulo">
          Tramos de instalación<em className="obligatorio">*</em>
        </span>
        {tramos.length === 0 && (
          <p className="form-atributos-vacio">Sin tramos cargados todavía.</p>
        )}
        {tramos.map((tramo, i) => (
          <div className="fc-tramo" key={i}>
            {tramos.length > 1 && (
              <div className="fc-tramo-encabezado">
                <span>
                  Tramo {i + 1}
                  {calculo?.iz?.tramoLimitante === i + 1 && (
                    <em className="fc-tramo-limitante" title="Es el tramo más restrictivo: el que fija el Iz del cable entero.">
                      {" "}
                      · más restrictivo
                    </em>
                  )}
                </span>
                <button type="button" onClick={() => actualizarTramos(tramos.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              </div>
            )}
            <label className="campo-atributo" title="Código de método de instalación (AEA 90364-5-52 / IEC 60364-5-52, Anexo B, Tabla B52-1) DE ESTE TRAMO.">
              <span>
                Método<em className="obligatorio">*</em>
              </span>
              <select
                value={valorComoTexto(tramo.metodo_instalacion)}
                onChange={(e) => actualizarTramo(i, "metodo_instalacion", e.target.value || undefined)}
              >
                <option value="">—</option>
                {METODOS_INSTALACION.map(({ codigo }) => (
                  <option key={codigo} value={codigo}>{codigo}</option>
                ))}
              </select>
            </label>
            <label className="campo-atributo">
              <span>
                Longitud (m)<em className="obligatorio">*</em>
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={valorComoTexto(tramo.longitud_m)}
                onChange={(e) =>
                  actualizarTramo(
                    i,
                    "longitud_m",
                    e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
                  )
                }
              />
            </label>
            <label className="campo-atributo fc-sub">
              <span>↳ Temperatura ambiente (°C)</span>
              <input
                type="number"
                step="any"
                value={valorComoTexto(tramo.temperatura_ambiente_c)}
                onChange={(e) =>
                  actualizarTramo(
                    i,
                    "temperatura_ambiente_c",
                    e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
                  )
                }
              />
            </label>
            <label
              className="campo-atributo"
              title="Identificador de la canalización que comparte ESTE TRAMO con otros conductores del proyecto (ej. 'Bandeja 1') — un cable puede compartir bandeja en un tramo y seguir solo en el resto de su recorrido."
            >
              <span>Canalización</span>
              <input
                type="text"
                placeholder="ej. Bandeja 1"
                value={valorComoTexto(tramo.canalizacion)}
                onChange={(e) => actualizarTramo(i, "canalizacion", e.target.value || undefined)}
              />
            </label>
            {calculo &&
              typeof tramo.canalizacion === "string" &&
              tramo.canalizacion.trim() !== "" &&
              calculo.circuitosAgrupadosDe(tramo.canalizacion) > 1 && (
                <p
                  className="fc-tramo-agrupados"
                  title="Cuántos tramos del proyecto comparten esta canalización — ya está incluido en el Iz de este tramo."
                >
                  Circuitos agrupados: {calculo.circuitosAgrupadosDe(tramo.canalizacion)}
                </p>
              )}
          </div>
        ))}
        <button
          type="button"
          className="fc-tramo-agregar"
          onClick={() => actualizarTramos([...tramos, {}])}
        >
          + Agregar tramo
        </button>
      </div>
      <details className="fc-metodos-recordatorio">
        <summary>Qué es cada método de instalación</summary>
        <dl>
          {METODOS_INSTALACION.map(({ codigo, descripcion }) => (
            <div key={codigo}>
              <dt>{codigo}</dt>
              <dd>{descripcion}</dd>
            </div>
          ))}
        </dl>
      </details>

      {/* ---- Vista previa de la notación ---- */}
      {preview.length > 0 && (
        <div className="fc-preview">
          {preview.map((linea, i) => (
            <div key={i}>{linea}</div>
          ))}
        </div>
      )}

      {/* ---- Cálculo (informativo, Paso "motor de cálculo") ----
       * Ib y ΔU% son una estimación (modelo resistivo, ignora la
       * reactancia del cable). Iz sale de la tabla real AEA 90364-5-52 /
       * IEC 60364-5-52 (ver docs/normativa/iz-corriente-admisible.md) —
       * no es una estimación, pero todavía no cubre los métodos E/F/G ni
       * corrige por resistividad térmica del terreno en enterrados. */}
      {calculo && (calculo.ibA !== null || calculo.caidaPct !== null || calculo.iz) && (
        <div className="fc-calculo">
          <span className="fc-calculo-titulo">Cálculo</span>
          {calculo.ibA !== null && (
            <div className="fc-calculo-linea">
              <span>Ib (corriente de cálculo)</span>
              <strong>{calculo.ibA.toFixed(1)} A</strong>
            </div>
          )}
          {calculo.iz && (
            <div className="fc-calculo-linea">
              <span>Iz (corriente admisible)</span>
              <strong>{calculo.iz.izCorregidaA.toFixed(1)} A</strong>
            </div>
          )}
          {calculo.ibA !== null && calculo.iz && (
            <div
              className={`fc-calculo-linea fc-calculo-veredicto${
                calculo.ibA <= calculo.iz.izCorregidaA ? " ok" : " mal"
              }`}
            >
              <span>Ib ≤ Iz</span>
              <strong>
                {calculo.ibA <= calculo.iz.izCorregidaA ? "✓ cumple" : "✗ no cumple"}
              </strong>
            </div>
          )}
          {calculo.caidaPct !== null && (
            <div className="fc-calculo-linea">
              <span>ΔU (caída de tensión, estimada)</span>
              <strong>{calculo.caidaPct.toFixed(2)} %</strong>
            </div>
          )}
          <p className="fc-calculo-nota">
            Ib y ΔU%: estimación (modelo resistivo). Iz: Tabla AEA 90364-5-52
            / IEC 60364-5-52 — no cubre todavía los métodos E, F, G ni la
            resistividad térmica del terreno en enterrados. No reemplaza el
            cálculo normativo completo (falta comparar contra la protección).
          </p>
        </div>
      )}
    </div>
  );
}
