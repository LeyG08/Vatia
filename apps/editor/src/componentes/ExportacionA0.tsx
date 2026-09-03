import { useCallback, useEffect, useState } from "react";
import { useEditor } from "../lib/store";
import { medidasPaginaMm } from "../lib/impresion";
import type { Hoja } from "../lib/tipos";
import { HojaCanvas } from "./ExportacionProyecto";

/** Tamaño real de una hoja A0 apaisada — la orientación más natural
 * para acomodar varios unifilares uno al lado del otro. */
const A0_ANCHO_MM = 1189;
const A0_ALTO_MM = 841;
/** Separación entre hojas combinadas, para que no queden pegadas. */
const GAP_MM = 15;

interface CeldaA0 {
  hoja: Hoja;
  xMm: number;
  yMm: number;
}
interface PaginaA0 {
  celdas: CeldaA0[];
}

/**
 * Orden de exportación respetando la jerarquía (E46): cada alimentador
 * principal (hoja raíz) seguido INMEDIATAMENTE por sus hojas hijas
 * (tableros seccionales que cuelgan de él), recorrido en profundidad —
 * en vez del orden arbitrario de las pestañas. No dibuja líneas de
 * conexión entre hojas (eso sería rehacer el diagrama, no combinar lo
 * que ya existe); el orden de lectura ya deja ver la familia.
 */
function ordenJerarquico(hojas: Hoja[]): Hoja[] {
  const porId = new Map(hojas.map((h) => [h.id, h] as const));
  const hijosDe = new Map<string, Hoja[]>();
  const raices: Hoja[] = [];
  for (const h of hojas) {
    if (h.hojaPadreId && porId.has(h.hojaPadreId)) {
      const lista = hijosDe.get(h.hojaPadreId) ?? [];
      lista.push(h);
      hijosDe.set(h.hojaPadreId, lista);
    } else {
      raices.push(h);
    }
  }
  const resultado: Hoja[] = [];
  function visitar(h: Hoja) {
    resultado.push(h);
    for (const hijo of hijosDe.get(h.id) ?? []) visitar(hijo);
  }
  for (const r of raices) visitar(r);
  return resultado;
}

/**
 * Empaqueta las hojas (ya en orden jerárquico) en tantas páginas A0
 * como haga falta: acomoda una al lado de la otra en filas (a escala
 * real — nunca se achica nada para que "entre"), pasa a una fila
 * nueva cuando no cabe más a lo ancho, y a una página nueva cuando no
 * cabe más a lo alto. Con `maxPaginas: 1` no parte nada — si no entra
 * todo en una sola hoja A0, corta ahí (lo usa el llamador para avisar
 * en vez de forzarlo).
 */
function empacarEnPaginasA0(
  hojas: Hoja[],
  maxPaginas: number,
): { paginas: PaginaA0[]; sobran: number } {
  const medidas = hojas.map((h) => ({ hoja: h, ...medidasPaginaMm(h) }));
  const paginas: PaginaA0[] = [];
  let indice = 0;
  while (indice < medidas.length && paginas.length < maxPaginas) {
    const celdas: CeldaA0[] = [];
    let filaY = 0;
    let filaAlturaMax = 0;
    let filaAnchoActual = 0;
    while (indice < medidas.length) {
      const m = medidas[indice];
      const x = filaAnchoActual === 0 ? 0 : filaAnchoActual + GAP_MM;
      const anchoNecesario = x + m.anchoMm;
      if (anchoNecesario > A0_ANCHO_MM && filaAnchoActual > 0) {
        // No entra más en esta fila — ¿entra otra fila en esta página?
        const yNuevaFila = filaY + filaAlturaMax + GAP_MM;
        if (yNuevaFila + m.altoMm > A0_ALTO_MM) break; // pasa a la próxima página
        filaY = yNuevaFila;
        filaAnchoActual = 0;
        filaAlturaMax = 0;
        continue; // recalcula x/anchoNecesario para la fila nueva
      }
      if (filaY + m.altoMm > A0_ALTO_MM && filaAnchoActual === 0) {
        // Ni siquiera entra sola en una fila nueva de esta página
        break;
      }
      celdas.push({ hoja: m.hoja, xMm: x, yMm: filaY });
      filaAnchoActual = x + m.anchoMm;
      filaAlturaMax = Math.max(filaAlturaMax, m.altoMm);
      indice += 1;
    }
    if (celdas.length === 0) break; // ni una hoja entra — evita loop infinito
    paginas.push({ celdas });
  }
  return { paginas, sobran: medidas.length - indice };
}

/** Una página A0 con varias hojas posicionadas a su tamaño real. */
function PaginaA0Combinada({
  pagina,
  pageName,
  marcarListo,
}: {
  pagina: PaginaA0;
  pageName: string;
  marcarListo: (id: string) => void;
}) {
  return (
    <div
      className={`pagina-impresion pagina-${pageName}`}
      style={{ width: `${A0_ANCHO_MM}mm`, height: `${A0_ALTO_MM}mm`, position: "relative" }}
    >
      {pagina.celdas.map(({ hoja, xMm, yMm }) => (
        <div
          key={hoja.id}
          style={{ position: "absolute", left: `${xMm}mm`, top: `${yMm}mm` }}
        >
          <HojaCanvas hoja={hoja} marcarListo={marcarListo} />
        </div>
      ))}
    </div>
  );
}

/**
 * Combina todos los unifilares del proyecto en una o varias hojas A0
 * (E46), respetando el mismo mecanismo de la exportación normal:
 * mide antes de imprimir, `@page` con nombre por página, fuera de
 * pantalla mientras mide. Ver `ExportacionProyecto.tsx` para el porqué
 * de cada una de esas partes — acá se reutilizan tal cual.
 */
export default function ExportacionA0() {
  const exportando = useEditor((s) => s.exportandoA0);
  const permitirVarias = useEditor((s) => s.permitirVariasPaginasA0);
  const hojas = useEditor((s) => s.proyecto.hojas);
  const finalizarExportacionA0 = useEditor((s) => s.finalizarExportacionA0);
  const mostrarAlerta = useEditor((s) => s.mostrarAlerta);
  const [listas, setListas] = useState<Set<string>>(new Set());
  const [exportandoPrevio, setExportandoPrevio] = useState(exportando);

  if (exportando !== exportandoPrevio) {
    setExportandoPrevio(exportando);
    if (exportando) setListas(new Set());
  }

  const marcarListo = useCallback((id: string) => {
    setListas((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const unifilares = ordenJerarquico(hojas.filter((h) => h.modo === "unifilar"));
  const { paginas, sobran } = empacarEnPaginasA0(unifilares, permitirVarias ? 20 : 1);
  const totalHojasEnPaginas = paginas.reduce((t, p) => t + p.celdas.length, 0);

  // Si no entra todo en una sola A0 y no se permitieron varias páginas,
  // se avisa y no se exporta nada — mejor eso que forzar un recorte o
  // achicar los planos (rompería la escala real 1:1 de todo el editor).
  // Corta acá SIN llamar a `window.print()`: por eso saca a mano la
  // clase `exportando-todo` que puso `BarraSuperior` antes de montar
  // este componente — si no, `window.print()` nunca dispara el
  // `afterprint` que normalmente la saca, y quedaba pegada para
  // siempre (bug real, encontrado revisando este mismo camino).
  useEffect(() => {
    if (!exportando) return;
    if (sobran > 0 && !permitirVarias) {
      mostrarAlerta(
        `El diagrama combinado no entra en una sola hoja A0 (entran ${totalHojasEnPaginas} de ${unifilares.length} hojas unifilares a escala real). Activá "permitir varias hojas A0" para exportarlo en más de una página.`,
      );
      finalizarExportacionA0();
      document.body.classList.remove("exportando-todo");
    }
  }, [
    exportando,
    sobran,
    permitirVarias,
    totalHojasEnPaginas,
    unifilares.length,
    mostrarAlerta,
    finalizarExportacionA0,
  ]);

  useEffect(() => {
    if (!exportando || sobran > 0) return;
    if (unifilares.length === 0) {
      mostrarAlerta("El proyecto no tiene hojas unifilares para combinar.");
      finalizarExportacionA0();
      document.body.classList.remove("exportando-todo");
      return;
    }
    if (listas.size < totalHojasEnPaginas) return;
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }, [
    exportando,
    sobran,
    listas,
    totalHojasEnPaginas,
    unifilares.length,
    mostrarAlerta,
    finalizarExportacionA0,
  ]);

  if (!exportando || sobran > 0 || unifilares.length === 0) return null;

  const reglasPagina = paginas
    .map(
      (_, i) =>
        `@page hojaA0-${i} { size: ${A0_ANCHO_MM}mm ${A0_ALTO_MM}mm; margin: 0; } .pagina-hojaA0-${i} { page: hojaA0-${i}; }`,
    )
    .join("\n");

  return (
    <div className="exportacion-proyecto exportacion-a0">
      <style>{reglasPagina}</style>
      {paginas.map((pagina, i) => (
        <PaginaA0Combinada
          key={i}
          pagina={pagina}
          pageName={`hojaA0-${i}`}
          marcarListo={marcarListo}
        />
      ))}
    </div>
  );
}
