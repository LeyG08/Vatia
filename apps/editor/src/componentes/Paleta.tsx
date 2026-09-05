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

const ORDEN_GRUPOS = [
  ...ORDEN_CATEGORIAS_APARATO.map(etiquetaCategoriaAparato),
  "Otros aparatos",
  ETIQUETAS_FAMILIA.conductor,
  ETIQUETAS_FAMILIA.barra,
  ETIQUETAS_FAMILIA.carga,
  ETIQUETAS_FAMILIA.sin_ficha_tecnica,
];

function Paleta({
  onIniciarArrastre,
}: {
  onIniciarArrastre: (codigo: string, e: React.MouseEvent) => void;
}) {
  const agregarAlimentador = useEditor((s) => s.agregarAlimentador);
  const modo = useEditor((s) => s.hoja.modo);
  // E64: la barra vive en la librería de fuerza (S00119), pero también
  // hace de riel de comando en multifilar (ver agregarSimbolo en
  // store.ts) — se agrega a mano a la lista de comando en vez de
  // duplicar el símbolo en libreria-simbolos/comando/.
  const libreria =
    modo === "multifilar"
      ? new Map(SIMBOLOS.has("S00119")
          ? [...SIMBOLOS_COMANDO, ["S00119", SIMBOLOS.get("S00119")!] as const]
          : SIMBOLOS_COMANDO)
      : SIMBOLOS;
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

  return (
    <aside className="paleta">
      <h2>Símbolos</h2>
      <p className="paleta-ayuda">Mantené presionado y arrastrá al plano</p>

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
          {items.map((s) => (
            <button
              key={s.codigo_iec}
              type="button"
              className="paleta-item"
              onMouseDown={(e) => onIniciarArrastre(s.codigo_iec, e)}
              title={`${s.metadata.nombre}`}
            >
              <span
                className="paleta-thumb"
                dangerouslySetInnerHTML={{ __html: svgLimpio(s.svgRaw) }}
              />
              <span className="paleta-nombre">{s.metadata.nombre}</span>
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}

export default Paleta;
