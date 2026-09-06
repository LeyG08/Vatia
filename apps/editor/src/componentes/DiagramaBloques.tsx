import { useEditor, construirEstadoHoja } from "../lib/store";
import { armarChecklist } from "../lib/checklist";

/**
 * E82 — diagrama de bloques del legajo.
 *
 * El árbol de la columna izquierda dice de qué tablero cuelga cada hoja,
 * pero leído renglón por renglón; una instalación se entiende de un
 * vistazo cuando se la ve como lo que es: cajas conectadas. Este
 * diagrama es esa vista — un bloque por hoja, una línea por vínculo
 * padre-hijo, el tablero principal arriba de todo.
 *
 * No es un plano: no tiene escala, no se imprime y no reemplaza al
 * unifilar. Es el índice del legajo dibujado, para saber dónde estás
 * parado cuando el proyecto tiene seis tableros. Clic en un bloque y te
 * lleva a esa hoja.
 */

const ANCHO = 190;
const ALTO = 58;
const SEP_X = 26;
const SEP_Y = 46;

interface Bloque {
  id: string;
  nombre: string;
  tablero: string;
  modo: string;
  aparatos: number;
  pendientes: number;
  principal: boolean;
  padre: string | null;
  x: number;
  y: number;
}

function DiagramaBloques({ onCerrar }: { onCerrar: () => void }) {
  const proyecto = useEditor((s) => s.proyecto);
  const hojaActivaId = useEditor((s) => s.hojaActivaId);
  const cambiarHojaActiva = useEditor((s) => s.cambiarHojaActiva);
  const nodosVivos = useEditor((s) => s.nodos);
  const conexionesVivas = useEditor((s) => s.conexiones);
  const nombreProyecto = useEditor((s) => s.nombreProyecto);

  /* Datos de cada hoja. La activa se lee del espejo en vivo: en
   * `proyecto.hojas` su trabajo más reciente todavía no está volcado. */
  const datos = proyecto.hojas.map((h) => {
    const esActiva = h.id === hojaActivaId;
    const estado = esActiva ? null : construirEstadoHoja(h);
    const nodos = esActiva ? nodosVivos : (estado?.nodos ?? []);
    const conexiones = esActiva ? conexionesVivas : (estado?.conexiones ?? []);
    const problemas = armarChecklist(nodos, conexiones, esActiva ? h.modo : estado!.cfg.modo);
    return {
      hoja: h,
      aparatos: nodos.filter(
        (n) => (n.data as { tipo?: string } | undefined)?.tipo === "simbolo",
      ).length,
      pendientes: problemas.reduce((t, p) => t + p.mensajes.length, 0),
    };
  });

  /* Disposición: un nivel por generación, los hijos debajo de su padre.
   * El ancho de cada rama se calcula desde las hojas del árbol hacia
   * arriba, así ningún bloque se superpone con el de al lado. */
  const hijosDe = new Map<string, string[]>();
  const raices: string[] = [];
  const porId = new Map(datos.map((d) => [d.hoja.id, d]));
  for (const d of datos) {
    const padre = d.hoja.hojaPadreId;
    if (padre && porId.has(padre)) {
      if (!hijosDe.has(padre)) hijosDe.set(padre, []);
      hijosDe.get(padre)!.push(d.hoja.id);
    } else {
      raices.push(d.hoja.id);
    }
  }
  raices.sort(
    (a, b) =>
      Number(!!porId.get(b)!.hoja.esTableroPrincipal) -
      Number(!!porId.get(a)!.hoja.esTableroPrincipal),
  );

  const anchoDe = new Map<string, number>();
  const medir = (id: string): number => {
    const hijos = hijosDe.get(id) ?? [];
    if (hijos.length === 0) {
      anchoDe.set(id, ANCHO);
      return ANCHO;
    }
    const total =
      hijos.reduce((t, h) => t + medir(h), 0) + SEP_X * (hijos.length - 1);
    const ancho = Math.max(ANCHO, total);
    anchoDe.set(id, ancho);
    return ancho;
  };
  for (const r of raices) medir(r);

  const bloques: Bloque[] = [];
  const ubicar = (id: string, izquierda: number, nivel: number) => {
    const d = porId.get(id)!;
    const ancho = anchoDe.get(id) ?? ANCHO;
    const x = izquierda + (ancho - ANCHO) / 2;
    bloques.push({
      id,
      nombre: d.hoja.nombre,
      tablero: d.hoja.tablero,
      modo: d.hoja.modo,
      aparatos: d.aparatos,
      pendientes: d.pendientes,
      principal: !!d.hoja.esTableroPrincipal,
      padre: d.hoja.hojaPadreId && porId.has(d.hoja.hojaPadreId) ? d.hoja.hojaPadreId : null,
      x,
      y: nivel * (ALTO + SEP_Y),
    });
    let cursor = izquierda;
    for (const hijo of hijosDe.get(id) ?? []) {
      ubicar(hijo, cursor, nivel + 1);
      cursor += (anchoDe.get(hijo) ?? ANCHO) + SEP_X;
    }
  };
  let cursor = 0;
  for (const r of raices) {
    ubicar(r, cursor, 0);
    cursor += (anchoDe.get(r) ?? ANCHO) + SEP_X * 2;
  }

  const anchoTotal = Math.max(ANCHO, cursor - SEP_X * 2) + 4;
  const altoTotal =
    bloques.reduce((m, b) => Math.max(m, b.y + ALTO), 0) + 4;
  const porIdBloque = new Map(bloques.map((b) => [b.id, b]));

  return (
    <>
      <div className="modal-fondo" onClick={onCerrar} />
      <section className="diagrama" role="dialog" aria-label="Diagrama de bloques del proyecto">
        <header className="diagrama-cabecera">
          <div>
            <h2>Diagrama de bloques</h2>
            <p>
              {nombreProyecto || "Proyecto sin nombre"} · {bloques.length} tablero
              {bloques.length === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div className="diagrama-lienzo">
          <svg
            viewBox={`-2 -2 ${anchoTotal} ${altoTotal}`}
            width={anchoTotal}
            height={altoTotal}
            role="img"
            aria-label="Jerarquía de tableros del proyecto"
          >
            {bloques.map((b) => {
              if (!b.padre) return null;
              const p = porIdBloque.get(b.padre)!;
              const x1 = p.x + ANCHO / 2;
              const y1 = p.y + ALTO;
              const x2 = b.x + ANCHO / 2;
              const y2 = b.y;
              const medio = (y1 + y2) / 2;
              return (
                <path
                  key={`e-${b.id}`}
                  className="diagrama-vinculo"
                  d={`M ${x1} ${y1} V ${medio} H ${x2} V ${y2}`}
                  fill="none"
                />
              );
            })}

            {bloques.map((b) => (
              <g
                key={b.id}
                className={`diagrama-bloque${b.id === hojaActivaId ? " activo" : ""}${
                  b.principal ? " principal" : ""
                }`}
                transform={`translate(${b.x} ${b.y})`}
                onClick={() => {
                  cambiarHojaActiva(b.id);
                  onCerrar();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    cambiarHojaActiva(b.id);
                    onCerrar();
                  }
                }}
              >
                <rect width={ANCHO} height={ALTO} rx={8} />
                <text className="diagrama-nombre" x={12} y={21}>
                  {b.nombre.length > 24 ? `${b.nombre.slice(0, 23)}…` : b.nombre}
                </text>
                <text className="diagrama-meta" x={12} y={38}>
                  {b.modo === "multifilar" ? "Comando" : "Fuerza"} · {b.aparatos} aparato
                  {b.aparatos === 1 ? "" : "s"}
                </text>
                {b.pendientes > 0 && (
                  <text className="diagrama-pendiente" x={12} y={51}>
                    {b.pendientes} sin documentar
                  </text>
                )}
                {b.principal && (
                  <text className="diagrama-principal" x={ANCHO - 12} y={21}>
                    ⌂ principal
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        <footer className="diagrama-pie">
          Clic en un tablero para abrir su hoja. Los vínculos salen de cada
          circuito seccional: para agregar un tablero, cargá un circuito de
          tipo «seccional» en el tablero del que cuelga.
        </footer>
      </section>
    </>
  );
}

export default DiagramaBloques;
