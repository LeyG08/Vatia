import { SIMBOLOS, svgLimpio } from "../lib/libreria";
import { useEditor } from "../lib/store";
import type { SimboloDef } from "../lib/tipos";

function Paleta({
  onIniciarArrastre,
}: {
  onIniciarArrastre: (codigo: string, e: React.MouseEvent) => void;
}) {
  const agregarAlimentador = useEditor((s) => s.agregarAlimentador);
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

      <div className="paleta-grupo">
        <h3>Alimentación</h3>
        <button
          type="button"
          className="paleta-item paleta-alim"
          onClick={() => agregarAlimentador()}
          title="Agrega un alimentador «Desde …» arriba del marco, con nodo de salida para conectar a los aparatos"
        >
          <span className="paleta-nombre">+ Alimentador «Desde …»</span>
        </button>
        <p className="paleta-ayuda">
          Se agrega junto al encabezado; elegí la referencia del conductor
          (líneas / neutro / tierra o cantidad n) en su menú desplegable.
        </p>
      </div>

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
