import { useState } from "react";

interface Props {
  totalPendientes: number;
  onCancelar: () => void;
  onConfirmar: (incluirBom: boolean) => void;
}

/**
 * Reemplaza los dos `window.confirm()` que tenía antes "Exportar
 * proyecto" — el usuario los señaló como "nada estético" (son el diálogo
 * nativo del navegador, sin ningún control sobre el estilo). Un solo
 * paso: avisa si hay pendientes y deja elegir si va la lista de
 * materiales, sin dos ventanas nativas seguidas.
 */
export default function DialogoExportarProyecto({
  totalPendientes,
  onCancelar,
  onConfirmar,
}: Props) {
  const [incluirBom, setIncluirBom] = useState(true);

  return (
    <>
      <div className="modal-fondo" onClick={onCancelar} />
      <section
        className="dialogo-exportar"
        role="dialog"
        aria-label="Exportar proyecto a PDF"
      >
        <h2>Exportar proyecto a PDF</h2>

        {totalPendientes > 0 && (
          <p className="dialogo-exportar-aviso">
            El proyecto tiene {totalPendientes} pendiente
            {totalPendientes === 1 ? "" : "s"} de ficha técnica (Checklist
            AEA, todas las hojas). No bloquea la exportación.
          </p>
        )}

        <label className="dialogo-exportar-check">
          <input
            type="checkbox"
            checked={incluirBom}
            onChange={(e) => setIncluirBom(e.target.checked)}
          />
          <span>Incluir lista de materiales como última página</span>
        </label>

        <footer className="dialogo-exportar-pie">
          <button type="button" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="primario"
            onClick={() => onConfirmar(incluirBom)}
          >
            🖨️ Exportar
          </button>
        </footer>
      </section>
    </>
  );
}
