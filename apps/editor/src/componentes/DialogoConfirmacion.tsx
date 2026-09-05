import { useEditor } from "../lib/store";

/**
 * Reemplaza `window.confirm()` / `window.alert()` (E41) — el usuario
 * los señaló explícitamente: no quiere ver popups del navegador, todo
 * tiene que quedar integrado a la página. `onConfirmar` ausente =
 * alerta simple (solo "Aceptar"); presente = confirmación con
 * "Cancelar" / "Confirmar".
 */
export default function DialogoConfirmacion() {
  const estado = useEditor((s) => s.confirmacion);
  const cerrar = useEditor((s) => s.cerrarConfirmacion);

  if (!estado) return null;
  const esAlerta = !estado.onConfirmar;

  function confirmar() {
    estado?.onConfirmar?.();
    cerrar();
  }

  return (
    <>
      <div className="modal-fondo" onClick={cerrar} />
      <section
        className="dialogo-caja"
        role="alertdialog"
        aria-label={esAlerta ? "Aviso" : "Confirmación"}
      >
        <p className="dialogo-mensaje">{estado.mensaje}</p>
        <footer className="dialogo-pie">
          {!esAlerta && (
            <button type="button" onClick={cerrar}>
              Cancelar
            </button>
          )}
          <button type="button" className="primario" onClick={esAlerta ? cerrar : confirmar}>
            {esAlerta ? "Aceptar" : "Confirmar"}
          </button>
        </footer>
      </section>
    </>
  );
}
