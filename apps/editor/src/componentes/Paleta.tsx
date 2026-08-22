import { useRef } from "react";
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
            <ItemSimbolo key={s.codigo_iec} simbolo={s} onAgregar={onAgregar} />
          ))}
        </div>
      ))}
    </aside>
  );
}

function ItemSimbolo({
  simbolo,
  onAgregar,
}: {
  simbolo: (typeof SIMBOLOS extends Map<string, infer V> ? V : never);
  onAgregar: (codigo: string) => void;
}) {
  const thumbRef = useRef<HTMLSpanElement>(null);

  return (
    <button
      type="button"
      className="paleta-item"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/vatia-simbolo",
          simbolo.codigo_iec,
        );
        e.dataTransfer.effectAllowed = "copy";
        const thumb = thumbRef.current;
        if (thumb) {
          e.dataTransfer.setDragImage(
            thumb,
            thumb.offsetWidth / 2,
            thumb.offsetHeight / 2,
          );
        }
      }}
      onDoubleClick={() => onAgregar(simbolo.codigo_iec)}
      title={`${simbolo.metadata.nombre} — arrastrar al lienzo (o doble clic)`}
    >
      <span
        ref={thumbRef}
        className="paleta-thumb"
        dangerouslySetInnerHTML={{ __html: svgLimpio(simbolo.svgRaw) }}
      />
      <span className="paleta-nombre">{simbolo.metadata.nombre}</span>
    </button>
  );
}

export default Paleta;
