import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, MODOS_TRABAJO, type DatosSimbolo, type ModoTrabajo } from "../lib/store";
import { SIMBOLOS, svgLimpio } from "../lib/libreria";
import { SIMBOLOS_COMANDO } from "../lib/libreriaComando";

/**
 * PROTOTIPO E81 — buscador de comandos y símbolos (dirección 7 del set de
 * disposiciones).
 *
 * Con 75 símbolos en la librería, encontrar "seccionador fusible
 * tetrapolar" recorriendo una lista con el mouse es el paso más lento del
 * dibujo. Acá se escribe el nombre y entra al plano. El mismo buscador
 * resuelve tres cosas distintas con una sola tecla:
 *
 *  - símbolos → los coloca en el centro de la vista,
 *  - aparatos ya dibujados → salta a ellos por su referencia (KM1, Q3…),
 *  - comandos → cambia de modo de trabajo o abre un panel.
 *
 * No reemplaza a la librería visible: la paleta sigue estando para quien
 * no sabe todavía cómo se llama lo que busca. Es el atajo del que ya lo
 * sabe.
 */

type Resultado =
  | { clase: "simbolo"; id: string; titulo: string; detalle: string; svg: string }
  | { clase: "aparato"; id: string; titulo: string; detalle: string }
  | { clase: "comando"; id: string; titulo: string; detalle: string; correr: () => void };

/** Coincidencia laxa: sin acentos, sin distinguir mayúsculas, y por
 * palabras sueltas — "term trip" encuentra "Interruptor termomagnético
 * tripolar". */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function coincide(texto: string, consulta: string): boolean {
  const t = normalizar(texto);
  return normalizar(consulta)
    .split(/\s+/)
    .filter(Boolean)
    .every((p) => t.includes(p));
}

/** Envoltorio: solo escucha Ctrl+K y monta el diálogo. El estado del
 * buscador (consulta, ítem resaltado) vive en `Dialogo`, que se monta
 * recién al abrirse — así nace limpio en cada apertura, sin un efecto
 * que lo resetee. */
function PaletaComandos() {
  const abierta = useEditor((s) => s.comandosAbiertos);
  const setAbierta = useEditor((s) => s.setComandosAbiertos);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierta(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setAbierta]);

  if (!abierta) return null;
  return <Dialogo />;
}

function Dialogo() {
  const setAbierta = useEditor((s) => s.setComandosAbiertos);
  const modo = useEditor((s) => s.hoja.modo);
  const nodos = useEditor((s) => s.nodos);
  const agregarSimbolo = useEditor((s) => s.agregarSimbolo);
  const seleccionarNodos = useEditor((s) => s.seleccionarNodos);
  const setModoTrabajo = useEditor((s) => s.setModoTrabajo);
  const alternarPanelHoja = useEditor((s) => s.alternarPanelHoja);
  const alternarPanelProyecto = useEditor((s) => s.alternarPanelProyecto);
  const setColumnaIzquierda = useEditor((s) => s.setColumnaIzquierda);

  const [consulta, setConsulta] = useState("");
  const [indice, setIndice] = useState(0);
  const campoRef = useRef<HTMLInputElement>(null);

  // El foco entra al campo apenas se monta el diálogo.
  useEffect(() => {
    campoRef.current?.focus();
  }, []);

  const resultados = useMemo<Resultado[]>(() => {
    const q = consulta.trim();
    const salida: Resultado[] = [];

    const comandos: { titulo: string; detalle: string; correr: () => void }[] = [
      ...MODOS_TRABAJO.map((m) => ({
        titulo: `Modo ${m.nombre}`,
        detalle: m.ayuda,
        correr: () => setModoTrabajo(m.id as ModoTrabajo),
      })),
      {
        titulo: "Configuración de hoja",
        detalle: "Formato, orientación y rótulo",
        correr: () => alternarPanelHoja(),
      },
      {
        titulo: "Datos del proyecto",
        detalle: "Normativa, tensiones y esquema de puesta a tierra",
        correr: () => alternarPanelProyecto(),
      },
      {
        titulo: "Ver el legajo",
        detalle: "Árbol de hojas y aparatos en la columna izquierda",
        correr: () => setColumnaIzquierda("proyecto"),
      },
      {
        titulo: "Ver la librería",
        detalle: "Símbolos para arrastrar al plano",
        correr: () => setColumnaIzquierda("simbolos"),
      },
    ];
    for (const c of comandos) {
      if (!q || coincide(c.titulo + " " + c.detalle, q)) {
        salida.push({ clase: "comando", id: c.titulo, ...c });
      }
    }

    if (q) {
      // Aparatos ya dibujados, por referencia o por nombre.
      for (const n of nodos) {
        const data = n.data as unknown as DatosSimbolo;
        if (data?.tipo !== "simbolo") continue;
        const ref = data.atributos?.referencia;
        const tipo = data.atributos?.tipo_aparato;
        const texto = `${typeof ref === "string" ? ref : ""} ${typeof tipo === "string" ? tipo : ""}`;
        if (!coincide(texto, q)) continue;
        salida.push({
          clase: "aparato",
          id: n.id,
          titulo: typeof ref === "string" && ref.trim() !== "" ? ref : "Sin referencia",
          detalle: typeof tipo === "string" ? tipo.replace(/_/g, " ") : "aparato de esta hoja",
        });
        if (salida.length > 40) break;
      }

      // Símbolos de la librería que corresponde a esta hoja.
      const libreria =
        modo === "multifilar" ? new Map([...SIMBOLOS, ...SIMBOLOS_COMANDO]) : SIMBOLOS;
      for (const s of libreria.values()) {
        if (!coincide(s.metadata.nombre, q)) continue;
        salida.push({
          clase: "simbolo",
          id: s.codigo_iec,
          titulo: s.metadata.nombre,
          detalle: s.codigo_iec,
          svg: s.svgRaw,
        });
        if (salida.length > 60) break;
      }
    }

    return salida.slice(0, 40);
  }, [
    consulta,
    nodos,
    modo,
    setModoTrabajo,
    alternarPanelHoja,
    alternarPanelProyecto,
    setColumnaIzquierda,
  ]);

  function ejecutar(r: Resultado) {
    if (r.clase === "comando") r.correr();
    if (r.clase === "aparato") seleccionarNodos([r.id]);
    if (r.clase === "simbolo") {
      // El símbolo entra en un punto fijo y cómodo de la lámina; el
      // usuario lo arrastra desde ahí. Colocar bajo el puntero exigiría
      // conocer la posición del mouse, que en un flujo de teclado no
      // significa nada.
      agregarSimbolo(r.id, 320, 240);
    }
    setAbierta(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setAbierta(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, resultados.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const r = resultados[indice];
      if (r) ejecutar(r);
    }
  }

  const ETIQUETA_CLASE: Record<Resultado["clase"], string> = {
    simbolo: "Colocar",
    aparato: "Ir a",
    comando: "Comando",
  };

  return (
    <div
      className="comandos-fondo"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setAbierta(false);
      }}
    >
      <div className="comandos" role="dialog" aria-modal="true" aria-label="Buscar">
        <input
          ref={campoRef}
          className="comandos-campo"
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value);
            setIndice(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Buscá un símbolo, una referencia (KM1) o un comando…"
          aria-label="Buscar un símbolo, una referencia o un comando"
        />
        <ul className="comandos-lista">
          {resultados.length === 0 && (
            <li className="comandos-vacio">Nada coincide con «{consulta}»</li>
          )}
          {resultados.map((r, i) => (
            <li key={`${r.clase}-${r.id}`}>
              <button
                type="button"
                className={`comandos-item${i === indice ? " activo" : ""}`}
                onMouseEnter={() => setIndice(i)}
                onClick={() => ejecutar(r)}
              >
                {r.clase === "simbolo" ? (
                  <span
                    className="comandos-thumb"
                    dangerouslySetInnerHTML={{ __html: svgLimpio(r.svg) }}
                  />
                ) : (
                  <span className={`comandos-marca marca-${r.clase}`} aria-hidden="true" />
                )}
                <span className="comandos-texto">
                  <span className="comandos-titulo">{r.titulo}</span>
                  <span className="comandos-detalle">{r.detalle}</span>
                </span>
                <span className="comandos-accion">{ETIQUETA_CLASE[r.clase]}</span>
              </button>
            </li>
          ))}
        </ul>
        <footer className="comandos-pie">
          <kbd>↑</kbd><kbd>↓</kbd> moverse · <kbd>Enter</kbd> ejecutar ·{" "}
          <kbd>Esc</kbd> cerrar
        </footer>
      </div>
    </div>
  );
}

export default PaletaComandos;
