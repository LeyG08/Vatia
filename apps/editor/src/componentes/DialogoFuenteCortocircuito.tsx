import { useState } from "react";
import { useEditor } from "../lib/store";

/**
 * Se abre solo (E39) apenas se coloca el primer alimentador de una hoja
 * raíz sin fuente de cortocircuito cargada — es el momento en que ese
 * dato "se le asigna al alimentador". Guarda en la hoja activa (la misma
 * para la que se disparó el prompt, porque se abre en el acto) usando
 * `actualizarHoja`, igual que cualquier otro campo de Configuración de
 * hoja; "Omitir por ahora" simplemente cierra sin guardar — el dato
 * sigue disponible más tarde en la pestaña "Fuente de cortocircuito".
 */
export default function DialogoFuenteCortocircuito() {
  const hojaId = useEditor((s) => s.promptCortocircuitoHojaId);
  const cerrar = useEditor((s) => s.cerrarPromptCortocircuito);
  const actualizarHoja = useEditor((s) => s.actualizarHoja);
  const [sccMva, setSccMva] = useState("");
  const [iccKa, setIccKa] = useState("");

  if (hojaId === null) return null;

  function guardar() {
    actualizarHoja({
      fuente_cortocircuito: {
        scc_mva: sccMva === "" ? undefined : Number.parseFloat(sccMva),
        icc_ka: iccKa === "" ? undefined : Number.parseFloat(iccKa),
      },
    });
    cerrar();
  }

  return (
    <>
      <div className="modal-fondo" onClick={cerrar} />
      <section
        className="dialogo-caja"
        role="dialog"
        aria-label="Fuente de cortocircuito del alimentador"
      >
        <h2>Fuente de cortocircuito</h2>
        <p className="dialogo-aviso">
          Dato de la red que alimenta este tablero, para verificar Icc
          aguas abajo. Se puede completar ahora o más tarde desde
          Hoja… → Fuente de cortocircuito.
        </p>
        <div className="panel-hoja-dos-col">
          <label className="panel-hoja-campo">
            <span>Potencia de cortocircuito Scc (MVA)</span>
            <input
              type="number"
              min={0}
              autoFocus
              value={sccMva}
              onChange={(e) => setSccMva(e.target.value)}
            />
          </label>
          <label className="panel-hoja-campo">
            <span>Corriente de cortocircuito Icc (kA)</span>
            <input
              type="number"
              min={0}
              value={iccKa}
              onChange={(e) => setIccKa(e.target.value)}
            />
          </label>
        </div>
        <footer className="dialogo-pie">
          <button type="button" onClick={cerrar}>
            Omitir por ahora
          </button>
          <button type="button" className="primario" onClick={guardar}>
            Guardar
          </button>
        </footer>
      </section>
    </>
  );
}
