import { lineasCable } from "../lib/anotaciones";
import type { CampoDescriptor } from "../lib/esquemas";
import { camposDeFamilia } from "../lib/esquemas";
import type { ResultadoIz } from "../lib/calculo";
import { seccionesDisponiblesMm2, seccionMinimaPeMm2 } from "../lib/secciones";
import type { ModoHoja } from "../lib/tipos";
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
  /**
   * Ib (A), ΔU% e Iz ya calculados por el llamador (necesita recorrer la
   * topología completa, algo que este formulario no tiene por qué saber
   * hacer). Ausentes cuando falta algún dato para calcularlos.
   */
  calculo?: {
    ibA: number | null;
    caidaPct: number | null;
    iz: ResultadoIz | null;
  };
}

/** Opciones del selector de sección — "6 mm²" en vez de solo "6", para
 * que se lea igual que el resto de la ficha técnica. */
function opcionesSeccion(material: unknown, modo: ModoHoja) {
  const mat = material === "Al" ? "Al" : "Cu";
  return seccionesDisponiblesMm2(mat, modo).map((s) => ({
    valor: String(s),
    etiqueta: `${s} mm²`,
  }));
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
export default function FormularioConductor({ atributos, onChange, encabezado, modo, calculo }: Props) {
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
  const camposRestantes = (camposDeFamilia("conductor", atributos) ?? []).filter(
    (c: CampoDescriptor) => !manejados.has(c.nombre),
  );
  // Método de instalación se saca del loop genérico: lleva un recordatorio
  // propio de códigos que no tiene ningún otro campo del schema.
  const metodoInstalacionCampo = camposRestantes.find((c) => c.nombre === "metodo_instalacion");
  const simples = camposRestantes.filter((c) => c.nombre !== "metodo_instalacion");

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
       * en silencio por una sección que la norma no tabula. */}
      <label className="campo-atributo">
        <span>Sección mm²<em className="obligatorio">*</em></span>
        <SelectorConEscape
          valor={valorComoTexto(atributos.seccion_fase_mm2)}
          opciones={opcionesSeccion(atributos.material, modo)}
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
            opciones={opcionesSeccion(atributos.material, modo)}
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
            opciones={opcionesSeccion(atributos.material, modo)}
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

      {/* ---- Método de instalación: código + recordatorio siempre visible ----
       * Pedido del usuario: se elige SOLO por el código (A1, B2, C...),
       * pero con un recordatorio de a qué corresponde cada uno — nadie
       * los recuerda de memoria, y ocultarlo detrás de un hover no
       * alcanza para consultarlo mientras se completa la ficha. */}
      {metodoInstalacionCampo && (
        <label className="campo-atributo" title={metodoInstalacionCampo.esquema.description}>
          <span>
            {metodoInstalacionCampo.title ?? "Método de instalación"}
            {metodoInstalacionCampo.obligatorio && <em className="obligatorio">*</em>}
          </span>
          <select
            value={valorComoTexto(atributos.metodo_instalacion)}
            onChange={(e) => onChange(poner(atributos, "metodo_instalacion", e.target.value || undefined))}
          >
            <option value="">—</option>
            {METODOS_INSTALACION.map(({ codigo }) => (
              <option key={codigo} value={codigo}>{codigo}</option>
            ))}
          </select>
        </label>
      )}
      {metodoInstalacionCampo && (
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
      )}

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
