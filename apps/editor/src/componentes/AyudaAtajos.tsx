interface Atajo {
  teclas: string[];
  descripcion: string;
}

const GRUPOS: { titulo: string; atajos: Atajo[] }[] = [
  {
    titulo: "Edición",
    atajos: [
      { teclas: ["Ctrl", "Z"], descripcion: "Deshacer" },
      { teclas: ["Ctrl", "Shift", "Z"], descripcion: "Rehacer" },
      { teclas: ["Ctrl", "C"], descripcion: "Copiar la selección" },
      { teclas: ["Ctrl", "V"], descripcion: "Pegar" },
      { teclas: ["R"], descripcion: "Rotar la selección 90°" },
      { teclas: ["Supr"], descripcion: "Borrar la selección" },
    ],
  },
  {
    titulo: "Selección",
    atajos: [
      { teclas: ["Clic", "arrastrar"], descripcion: "Seleccionar por recuadro" },
      { teclas: ["Ctrl", "clic"], descripcion: "Sumar a la selección" },
      { teclas: ["Ctrl", "A"], descripcion: "Seleccionar todo" },
      { teclas: ["Esc"], descripcion: "Deseleccionar / cerrar el panel activo" },
    ],
  },
  {
    titulo: "Vista",
    atajos: [
      { teclas: ["Rueda"], descripcion: "Desplazar el lienzo" },
      { teclas: ["Ctrl", "Rueda"], descripcion: "Zoom" },
      { teclas: ["?"], descripcion: "Mostrar / ocultar esta ayuda" },
    ],
  },
  {
    titulo: "Proyecto",
    atajos: [{ teclas: ["Ctrl", "S"], descripcion: "Guardar proyecto (JSON)" }],
  },
];

export default function AyudaAtajos({ onCerrar }: { onCerrar: () => void }) {
  return (
    <>
      <div className="modal-fondo" onClick={onCerrar} />
      <section
        className="ayuda-atajos"
        role="dialog"
        aria-label="Atajos de teclado"
      >
        <header>
          <h2>Atajos de teclado</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar ayuda">
            ✕
          </button>
        </header>
        <div className="ayuda-atajos-grupos">
          {GRUPOS.map((g) => (
            <div key={g.titulo} className="ayuda-atajos-grupo">
              <h3>{g.titulo}</h3>
              {g.atajos.map((a, i) => (
                <div key={i} className="ayuda-atajos-fila">
                  <span className="ayuda-atajos-teclas">
                    {a.teclas.map((t, j) => (
                      <kbd key={j}>{t}</kbd>
                    ))}
                  </span>
                  <span>{a.descripcion}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
