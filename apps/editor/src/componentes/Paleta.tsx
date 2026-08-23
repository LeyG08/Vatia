import { SIMBOLOS, svgLimpio } from "../lib/libreria";
import type { SimboloDef } from "../lib/tipos";

function Paleta({
  onIniciarArrastre,
}: {
  onIniciarArrastre: (codigo: string, e: React.MouseEvent) => void;
}) {
  const simbolos = [...SIMBOLOS.values()].sort((a, b) =>
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
      {[...grupos.entries()].map(([familia, items]) => (
        <div key={familia} className="paleta-grupo">
          <h3>{familia}</h3>
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
