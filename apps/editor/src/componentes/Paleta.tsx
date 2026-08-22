import { SIMBOLOS, svgLimpio } from "../lib/libreria";

function Paleta({ onAgregar }: { onAgregar: (codigo: string) => void }) {
  const simbolos = [...SIMBOLOS.values()].sort((a, b) =>
    a.codigo_iec.localeCompare(b.codigo_iec),
  );

  const grupos = new Map<string, typeof simbolos>();
  for (const s of simbolos) {
    const fam = s.metadata.familia_atributos;
    if (!grupos.has(fam)) grupos.set(fam, []);
    grupos.get(fam)!.push(s);
  }

  return (
    <aside className="paleta">
      <h2>Símbolos</h2>
      {[...grupos.entries()].map(([familia, items]) => (
        <div key={familia} className="paleta-grupo">
          <h3>{familia}</h3>
          {items.map((s) => (
            <button
              key={s.codigo_iec}
              type="button"
              className="paleta-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/vatia-simbolo",
                  s.codigo_iec,
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onDoubleClick={() => onAgregar(s.codigo_iec)}
              title={`${s.metadata.nombre} — arrastrar al lienzo (o doble clic)`}
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
