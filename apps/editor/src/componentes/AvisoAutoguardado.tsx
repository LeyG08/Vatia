import { useEditor } from "../lib/store";

/** Aviso descartable: se muestra una vez, justo después de recuperar un
 * autoguardado al abrir la app, para que no parezca que apareció
 * trabajo de la nada. */
function AvisoAutoguardado() {
  const visible = useEditor((s) => s.avisoRecuperado);
  const descartar = useEditor((s) => s.descartarAvisoRecuperado);

  if (!visible) return null;

  return (
    <div className="aviso-autoguardado">
      <span>↺ Se recuperó tu último trabajo sin guardar.</span>
      <button type="button" onClick={descartar} title="Descartar aviso">
        ✕
      </button>
    </div>
  );
}

export default AvisoAutoguardado;
