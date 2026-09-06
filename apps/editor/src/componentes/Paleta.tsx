import { useRef, useState } from "react";
import { SIMBOLOS, svgLimpio } from "../lib/libreria";
import { SIMBOLOS_COMANDO } from "../lib/libreriaComando";
import { useEditor } from "../lib/store";
import type { FamiliaAtributos, SimboloDef } from "../lib/tipos";
import {
  categoriaDeTipoAparato,
  etiquetaCategoriaAparato,
  ORDEN_CATEGORIAS_APARATO,
} from "../lib/categoriasAparato";

const ETIQUETAS_FAMILIA: Record<Exclude<FamiliaAtributos, "aparato">, string> = {
  conductor: "Conductores",
  barra: "Barras",
  carga: "Cargas",
  sin_ficha_tecnica: "Auxiliares",
};

/** Título de grupo de paleta para un símbolo: los de familia "aparato" se
 * reparten por categoría (protección, maniobra…, C4/pedido explícito del
 * usuario: "no todo junto"); el resto conserva un único grupo por
 * familia. Sin categoría mapeada (símbolo nuevo, o sin `atributos_base`
 * todavía) cae en "Otros aparatos" en vez de desaparecer de la paleta. */
function grupoDe(s: SimboloDef): string {
  if (s.metadata.familia_atributos !== "aparato") {
    return ETIQUETAS_FAMILIA[s.metadata.familia_atributos];
  }
  const tipo = s.metadata.atributos_base?.tipo_aparato;
  const categoria = categoriaDeTipoAparato(typeof tipo === "string" ? tipo : undefined);
  return categoria ? etiquetaCategoriaAparato(categoria) : "Otros aparatos";
}

/* E80, pedido explícito: "esto de la barra habría que dejarlo arriba del
 * todo porque es lo más importante a la hora de hacer un diagrama porque
 * si no este no tiene sentido". La barra/riel es de donde cuelga todo lo
 * demás, así que encabeza la paleta en vez de quedar sepultada entre las
 * categorías de aparatos. */
const ORDEN_GRUPOS = [
  ETIQUETAS_FAMILIA.barra,
  ...ORDEN_CATEGORIAS_APARATO.map(etiquetaCategoriaAparato),
  "Otros aparatos",
  ETIQUETAS_FAMILIA.conductor,
  ETIQUETAS_FAMILIA.carga,
  ETIQUETAS_FAMILIA.sin_ficha_tecnica,
];

const PALABRAS_POLO = ["unipolar", "bipolar", "tripolar", "tetrapolar"];
const RE_POLO = new RegExp(`\\s+(${PALABRAS_POLO.join("|")})\\b`, "i");

/** Nombre del símbolo sin la palabra de cantidad de polos — para el
 * botón representante del grupo ("Interruptor termomagnético
 * (multifilar)" en vez de repetir "unipolar/bipolar/…"). */
function nombreSinPolo(nombre: string): string {
  return nombre.replace(RE_POLO, "").trim();
}

/** Solo la palabra de polos ("Tripolar") — para la etiqueta de cada
 * variante DENTRO del flyout, ya que el nombre base va en el botón que
 * lo abre. */
function etiquetaPolo(nombre: string): string {
  const m = RE_POLO.exec(nombre);
  if (!m) return nombre;
  const palabra = m[1];
  return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
}

function cantidadPolosDe(s: SimboloDef): number | null {
  const cp = s.metadata.atributos_base?.cantidad_polos;
  return typeof cp === "number" ? cp : null;
}

/** E72 (pedido explícito: en vez de listar cada variante de polos como
 * un ítem aparte, agruparlas detrás de un solo botón que las despliega
 * al pasar el mouse). Un símbolo entra a un grupo de polos solo si
 * comparte `tipo_aparato` con al menos otro Y declara `cantidad_polos`
 * en su ficha base — así NO agrupa pulsador NA/NC, contacto auxiliar
 * NA/NC, etc. (esos son símbolos distintos, no "el mismo aparato con
 * más polos"), solo las variantes multipolares de E69 en adelante. */
interface ItemPaleta {
  representante: SimboloDef;
  variantes: SimboloDef[] | null; // null = símbolo suelto, sin variantes de polo
}

function agruparPorPolos(simbolos: SimboloDef[]): ItemPaleta[] {
  const porTipo = new Map<string, SimboloDef[]>();
  const sueltos: SimboloDef[] = [];
  for (const s of simbolos) {
    const tipo = s.metadata.atributos_base?.tipo_aparato;
    if (typeof tipo === "string" && cantidadPolosDe(s) !== null) {
      if (!porTipo.has(tipo)) porTipo.set(tipo, []);
      porTipo.get(tipo)!.push(s);
    } else {
      sueltos.push(s);
    }
  }
  const items: ItemPaleta[] = [];
  for (const variantes of porTipo.values()) {
    if (variantes.length < 2) {
      sueltos.push(...variantes);
      continue;
    }
    variantes.sort((a, b) => (cantidadPolosDe(a) ?? 0) - (cantidadPolosDe(b) ?? 0));
    items.push({ representante: variantes[0], variantes });
  }
  for (const s of sueltos) items.push({ representante: s, variantes: null });
  return items.sort((a, b) => a.representante.codigo_iec.localeCompare(b.representante.codigo_iec));
}

function Paleta({
  onIniciarArrastre,
}: {
  onIniciarArrastre: (codigo: string, e: React.MouseEvent) => void;
}) {
  const agregarAlimentador = useEditor((s) => s.agregarAlimentador);
  const modo = useEditor((s) => s.hoja.modo);
  // E66, pedido explícito del usuario ("en el multifilar deben estar
  // TODOS los elementos existentes porque uno nunca sabe qué se va a
  // usar"): multifilar muestra la UNIÓN de las dos librerías (fuerza +
  // comando), no solo la de comando — un circuito de mando puede
  // necesitar cualquier cosa (un fusible de mando, un transformador
  // chico, un instrumento…), no solo los símbolos pensados para él.
  // Fuerza sigue mostrando solo su propia librería a propósito (regla
  // de alcance acordada: "fuerza solo protecciones y cargas").
  const libreria =
    modo === "multifilar" ? new Map([...SIMBOLOS, ...SIMBOLOS_COMANDO]) : SIMBOLOS;
  const simbolos = [...libreria.values()].sort((a, b) =>
    a.codigo_iec.localeCompare(b.codigo_iec),
  );

  const grupos = new Map<string, SimboloDef[]>();
  for (const s of simbolos) {
    const titulo = grupoDe(s);
    if (!grupos.has(titulo)) grupos.set(titulo, []);
    grupos.get(titulo)!.push(s);
  }
  const gruposOrdenados = [...grupos.entries()].sort(
    ([a], [b]) => ORDEN_GRUPOS.indexOf(a) - ORDEN_GRUPOS.indexOf(b),
  );

  // E72: flyout de variantes de polo. `position: fixed` (no `absolute`)
  // para que no lo recorte el `overflow-y: auto` de `.paleta` — se
  // posiciona a mano con el rectángulo del botón que lo abrió. Un
  // timeout chico en el cierre deja pasar el mouse del botón al
  // flyout sin que se cierre de golpe (mismo criterio que un submenú
  // nativo).
  const [grupoAbierto, setGrupoAbierto] = useState<{
    item: ItemPaleta;
    rect: DOMRect;
  } | null>(null);
  // E80: preset del juego de rieles de alimentación (solo multifilar).
  const agregarRieles = useEditor((s) => s.agregarRielesAlimentacion);
  const [presetAbierto, setPresetAbierto] = useState(false);
  const [presetFases, setPresetFases] = useState(3);
  const [presetNeutro, setPresetNeutro] = useState(true);
  const [presetTierra, setPresetTierra] = useState(false);
  const cierreRef = useRef<number | null>(null);

  function abrirGrupo(item: ItemPaleta, rect: DOMRect) {
    if (cierreRef.current !== null) {
      window.clearTimeout(cierreRef.current);
      cierreRef.current = null;
    }
    setGrupoAbierto({ item, rect });
  }
  function programarCierre() {
    cierreRef.current = window.setTimeout(() => setGrupoAbierto(null), 200);
  }

  return (
    <aside className="paleta">
      <div className="paleta-cabecera">
        <h2>Símbolos</h2>
        <p className="paleta-ayuda">Mantené presionado y arrastrá al plano</p>
      </div>

      {modo === "multifilar" && (
        <div className="paleta-grupo">
          <h3>Alimentación</h3>
          {/* E80: el juego de rieles se coloca completo y ya tipado. Cada
            * riel colocado a mano nacía como "fase viva" (E64), así que
            * un neutro sin corregir dejaba a la simulación sin retorno y
            * no se energizaba nada. */}
          <button
            type="button"
            className="paleta-item paleta-preset"
            onClick={() => setPresetAbierto((v) => !v)}
            aria-expanded={presetAbierto}
            title="Colocar el juego de rieles (fases + neutro + tierra) arriba de la hoja"
          >
            <span className="paleta-nombre">Rieles de alimentación…</span>
            <span className="paleta-item-grupo-flecha">{presetAbierto ? "▾" : "▸"}</span>
          </button>
          {presetAbierto && (
            <div className="paleta-preset-panel">
              <label className="paleta-preset-campo">
                <span>Fases</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={presetFases}
                  onChange={(e) =>
                    setPresetFases(Math.min(12, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              </label>
              <label className="paleta-preset-check">
                <input
                  type="checkbox"
                  checked={presetNeutro}
                  onChange={(e) => setPresetNeutro(e.target.checked)}
                />
                <span>Neutro (N)</span>
              </label>
              <label className="paleta-preset-check">
                <input
                  type="checkbox"
                  checked={presetTierra}
                  onChange={(e) => setPresetTierra(e.target.checked)}
                />
                <span>Tierra (PE)</span>
              </label>
              <p className="paleta-preset-resumen">
                {[
                  ...Array.from({ length: presetFases }, (_, i) => `L${i + 1}`),
                  ...(presetNeutro ? ["N"] : []),
                  ...(presetTierra ? ["PE"] : []),
                ].join(" · ")}
              </p>
              <button
                type="button"
                className="paleta-preset-colocar"
                onClick={() => {
                  agregarRieles({
                    fases: presetFases,
                    neutro: presetNeutro,
                    tierra: presetTierra,
                  });
                  setPresetAbierto(false);
                }}
              >
                Colocar rieles
              </button>
            </div>
          )}
        </div>
      )}

      {modo === "unifilar" && (
        <div className="paleta-grupo">
          <h3>Alimentación</h3>
          {/* C13: igual que los símbolos — mantener presionado y
           * arrastrar al plano. El click simple sigue agregando en el
           * lugar de siempre. Solo tiene sentido en fuerza: un circuito
           * de comando no se alimenta "desde la red", se alimenta desde
           * un aparato de la propia hoja. */}
          <button
            type="button"
            className="paleta-item paleta-alim"
            onMouseDown={(e) => onIniciarArrastre("@alimentador", e)}
            onClick={() => agregarAlimentador()}
            title="Arrastrá al plano (o click para agregar) — conductor viniente desde el tablero"
          >
            <span className="paleta-nombre">+ Alimentador «Desde …»</span>
          </button>
        </div>
      )}

      {gruposOrdenados.map(([titulo, items]) => (
        <div key={titulo} className="paleta-grupo">
          <h3>{titulo}</h3>
          {agruparPorPolos(items).map((item) =>
            item.variantes ? (
              <div
                key={item.representante.codigo_iec}
                className="paleta-item-contenedor"
                onMouseEnter={(e) => abrirGrupo(item, e.currentTarget.getBoundingClientRect())}
                onMouseLeave={programarCierre}
              >
                <button
                  type="button"
                  className="paleta-item paleta-item-grupo"
                  title={`${nombreSinPolo(item.representante.metadata.nombre)} — pasá el mouse para elegir cantidad de polos`}
                >
                  <span
                    className="paleta-thumb"
                    dangerouslySetInnerHTML={{ __html: svgLimpio(item.representante.svgRaw) }}
                  />
                  <span className="paleta-nombre">
                    {nombreSinPolo(item.representante.metadata.nombre)}
                  </span>
                  <span className="paleta-item-grupo-flecha">▸</span>
                </button>
              </div>
            ) : (
              <button
                key={item.representante.codigo_iec}
                type="button"
                className="paleta-item"
                onMouseDown={(e) => onIniciarArrastre(item.representante.codigo_iec, e)}
                title={item.representante.metadata.nombre}
              >
                <span
                  className="paleta-thumb"
                  dangerouslySetInnerHTML={{ __html: svgLimpio(item.representante.svgRaw) }}
                />
                <span className="paleta-nombre">{item.representante.metadata.nombre}</span>
              </button>
            ),
          )}
        </div>
      ))}

      {grupoAbierto && (
        <div
          className="paleta-flyout"
          style={{
            top: grupoAbierto.rect.top,
            left: grupoAbierto.rect.right + 4,
          }}
          onMouseEnter={() => abrirGrupo(grupoAbierto.item, grupoAbierto.rect)}
          onMouseLeave={programarCierre}
        >
          {grupoAbierto.item.variantes!.map((v) => (
            <button
              key={v.codigo_iec}
              type="button"
              className="paleta-item"
              onMouseDown={(e) => onIniciarArrastre(v.codigo_iec, e)}
              title={v.metadata.nombre}
            >
              <span
                className="paleta-thumb"
                dangerouslySetInnerHTML={{ __html: svgLimpio(v.svgRaw) }}
              />
              <span className="paleta-nombre">{etiquetaPolo(v.metadata.nombre)}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

export default Paleta;
