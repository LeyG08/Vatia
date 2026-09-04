import { useState } from "react";

/**
 * `<select>` con una salida a texto libre ("Otra…") — mismo patrón para
 * dos casos del formulario que necesitan "elegir de una lista real, pero
 * sin encerrar al usuario": la referencia de una pieza accesorio (E53,
 * vincular con un aparato existente) y la sección de un conductor (E54,
 * elegir entre los valores normados en vez de tipear cualquier número).
 * Si el valor actual no está en `opciones`, arranca directo en modo
 * texto libre — no lo pisa con la primera opción de la lista.
 */
export default function SelectorConEscape({
  valor,
  opciones,
  onChange,
  placeholder,
  etiquetaLibre = "Otra… (escribir)",
  etiquetaVolver = "Elegir de la lista",
  etiquetaVacio = "— sin elegir —",
}: {
  valor: string;
  opciones: { valor: string; etiqueta: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  etiquetaLibre?: string;
  etiquetaVolver?: string;
  etiquetaVacio?: string;
}) {
  const LIBRE = "__libre__";
  const coincide = opciones.some((o) => o.valor === valor);
  const [modoLibre, setModoLibre] = useState(!coincide && valor !== "");

  if (modoLibre) {
    return (
      <span className="selector-referencia">
        <input
          type="text"
          value={valor}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {opciones.length > 0 && (
          <button
            type="button"
            className="selector-referencia-volver"
            onClick={() => setModoLibre(false)}
          >
            {etiquetaVolver}
          </button>
        )}
      </span>
    );
  }

  return (
    <select
      value={coincide ? valor : ""}
      onChange={(e) => {
        if (e.target.value === LIBRE) {
          setModoLibre(true);
          return;
        }
        onChange(e.target.value);
      }}
    >
      <option value="">{etiquetaVacio}</option>
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
      <option value={LIBRE}>{etiquetaLibre}</option>
    </select>
  );
}
