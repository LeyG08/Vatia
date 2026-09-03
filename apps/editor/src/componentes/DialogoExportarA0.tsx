import { useState } from "react";

interface Props {
  onCancelar: () => void;
  onConfirmar: (permitirVariasPaginas: boolean) => void;
}

/**
 * Confirmación antes de combinar todos los unifilares en hoja(s) A0
 * (E46). La opción de partir en varias páginas es explícita — el
 * usuario la tiene que activar a propósito, no es un fallback
 * automático ("esto debe ser una opción para el que lo quiera así").
 */
export default function DialogoExportarA0({ onCancelar, onConfirmar }: Props) {
  const [permitirVarias, setPermitirVarias] = useState(false);

  return (
    <>
      <div className="modal-fondo" onClick={onCancelar} />
      <section
        className="dialogo-caja"
        role="dialog"
        aria-label="Exportar unifilares combinados en A0"
      >
        <h2>Exportar unifilares combinados (A0)</h2>
        <p className="dialogo-aviso">
          Combina todos los unifilares del proyecto en una sola hoja A0, a
          escala real (sin achicar nada), respetando la jerarquía de
          tableros. Si no entran todos, hace falta activar la opción de
          abajo — si no, se avisa y no se exporta nada.
        </p>
        <label className="dialogo-exportar-check">
          <input
            type="checkbox"
            checked={permitirVarias}
            onChange={(e) => setPermitirVarias(e.target.checked)}
          />
          <span>Permitir varias hojas A0 si no entra en una sola</span>
        </label>
        <footer className="dialogo-pie">
          <button type="button" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="primario"
            onClick={() => onConfirmar(permitirVarias)}
          >
            🖨️ Exportar
          </button>
        </footer>
      </section>
    </>
  );
}
