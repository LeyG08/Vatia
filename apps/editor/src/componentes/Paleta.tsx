import { SIMBOLOS, svgLimpio } from "../lib/libreria";
import { SIMBOLOS_COMANDO } from "../lib/libreriaComando";
import { useEditor } from "../lib/store";
import type { FamiliaAtributos, SimboloDef } from "../lib/tipos";

const ETIQUETAS_FAMILIA: Record<FamiliaAtributos, string> = {
  aparato: "Aparatos",
  conductor: "Conductores",
  barra: "Barras",
  carga: "Cargas",
  sin_ficha_tecnica: "Auxiliares",
};

function Paleta({
  onIniciarArrastre,
}: {
  onIniciarArrastre: (codigo: string, e: React.MouseEvent) => void;
}) {
  const agregarAlimentador = useEditor((s) => s.agregarAlimentador);
  const modo = useEditor((s) => s.hoja.modo);
  const libreria = modo === "multifilar" ? SIMBOLOS_COMANDO : SIMBOLOS;
  const simbolos = [...libreria.values()].sort((a, b) =>
    a.codigo_iec.localeCompare(b.codigo_iec),
  );

  const grupos = new Map<string, SimboloDef[]>();
  for (const s of simbolos) {
    const fam = s.metadata.familia_atributos;
    if (!grupos.has(fam)) grupos.set(fam, []);
    grupos.get(fam)!.push(s);
  }

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

      {[...grupos.entries()].map(([familia, items]) => (
        <div key={familia} className="paleta-grupo">
          <h3>{ETIQUETAS_FAMILIA[familia as FamiliaAtributos] ?? familia}</h3>
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
