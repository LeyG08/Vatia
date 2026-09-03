import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, construirEstadoHoja, BARRA_CODIGO } from "../lib/store";
import { obtenerSimbolo } from "../lib/libreria";
import { anotacionNodo } from "../lib/anotaciones";
import { medidasPaginaMm, ZOOM_IMPRESION } from "../lib/impresion";
import { dimensionesHoja, type FamiliaAtributos, type Hoja } from "../lib/tipos";
import { nodeTypes, edgeTypes, crearNodoHoja } from "../lib/tiposFlow";

interface FilaBom {
  codigo: string;
  nombre: string;
  descripcion: string;
  marca: string;
  modelo: string;
  cantidad: number;
}

/**
 * Lista de materiales de UNA hoja: una fila por (código, marca, modelo),
 * agrupando cantidades repetidas. Los alimentadores no son un ítem físico
 * (representan "acá entra la alimentación", no un aparato) y quedan
 * afuera; las barras sí cuentan (juego de barras es un ítem real).
 *
 * `descripcion` reutiliza la MISMA anotación técnica que ya se imprime
 * al lado del símbolo en el plano (`anotacionNodo`) — así la lista no
 * es solo "qué hay", sino también sus datos de chapa relevantes (polos,
 * corriente, tensión…), sin inventar un resumen aparte.
 *
 * Se suman también los accesorios cargados a mano por hoja (PanelHoja —
 * terminales, peines de conexión, bornera de distribución…): no tienen
 * símbolo en el plano, así que no hay forma de detectarlos solos.
 */
function construirBomDeHoja(
  hoja: Hoja,
  tensionFaseV: number,
  tensionLineaV: number,
): FilaBom[] {
  const filas = new Map<string, FilaBom>();
  for (const n of hoja.nodos ?? []) {
    if (n.tipo === "alimentador") continue;
    const codigo = n.codigo_iec ?? (n.tipo === "barra" ? BARRA_CODIGO : undefined);
    if (!codigo) continue;
    const simbolo = obtenerSimbolo(codigo);
    const nombre = simbolo?.metadata.nombre ?? codigo;
    const familia = simbolo?.metadata.familia_atributos as FamiliaAtributos | undefined;
    const atributos = n.atributos ?? {};
    const descripcion = familia
      ? anotacionNodo(
          familia,
          { codigo_iec: codigo, rotacion: 0, atributos },
          tensionFaseV,
          tensionLineaV,
        )
          .map((l) => l.texto)
          .join(" · ")
      : "";
    const marca = typeof atributos.marca === "string" ? atributos.marca : "";
    const modelo = typeof atributos.modelo === "string" ? atributos.modelo : "";
    const clave = `${codigo}|${marca}|${modelo}`;
    const existente = filas.get(clave);
    if (existente) existente.cantidad += 1;
    else filas.set(clave, { codigo, nombre, descripcion, marca, modelo, cantidad: 1 });
  }
  for (const a of hoja.accesorios ?? []) {
    if (a.descripcion.trim() === "") continue;
    filas.set(`accesorio|${a.id}`, {
      codigo: "—",
      nombre: a.descripcion,
      descripcion: "",
      marca: a.marca ?? "",
      modelo: a.modelo ?? "",
      cantidad: a.cantidad,
    });
  }
  return [...filas.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

/** Una página de impresión por hoja: su propio <ReactFlow> aislado (no
 * comparte provider con el lienzo interactivo), fijo en la escala física
 * de impresión — ver lib/impresion.ts.
 *
 * `pageName` identifica una página CSS con nombre (Paged Media): cada
 * hoja puede tener su propio formato (A3, A1…), y `window.print()`
 * arma UN solo trabajo de impresión con TODAS — sin esto, "Exportar
 * proyecto" salía siempre con el tamaño de página por defecto del
 * navegador (A4/Carta), sin importar el formato real configurado, y el
 * contenido quedaba recortado o mal escalado. `exportarPdf()` (una
 * sola hoja) no tiene este problema porque inyecta un único `@page`
 * global — acá hace falta uno DISTINTO por página del mismo trabajo.
 *
 * La propiedad `page` se asigna por CLASE, no por `style` inline:
 * Chromium no la respeta puesta inline (probado en vivo generando PDFs
 * reales — con `style={{page: ...}}` aparecía una página extra en
 * blanco, con tamaño por defecto del navegador, antes de la primera
 * hoja real; con una regla de hoja de estilos como `.pagina-hoja-0 {
 * page: hoja-0 }` pagina correctamente). La regla la arma
 * `ExportacionProyecto` en un único `<style>` (ver ahí por qué).
 *
 * `marcarListo`: React Flow mide los nodos de forma ASÍNCRONA
 * (ResizeObserver) antes de mostrarlos — quedan en `visibility:hidden`
 * hasta esa primera medición. Como esta es una instancia de
 * `<ReactFlow>` NUEVA (no la del lienzo interactivo, que ya está
 * medida de antes), `window.print()` no puede llamarse enseguida de
 * montar: salía con la hoja en blanco (encontrado en vivo).
 *
 * El hook oficial de la librería para esto (`useNodesInitialized`) NO
 * sirve acá: solo se recalcula cuando el prop `nodes` vuelve a
 * cambiar (dispara `setNodes()` internamente), y estos nodos son
 * estáticos — no hay ningún cambio posterior que lo dispare, así que
 * queda pegado en `false` para siempre aunque los nodos ya estén
 * visibles (confirmado leyendo la fuente de la librería y viéndolo en
 * vivo). Se verifica el DOM directamente en su lugar: mientras quede
 * algún `.react-flow__node` con `visibility: hidden` todavía no
 * terminó de medir. Tope de seguridad a los ~3s por si algún nodo
 * nunca llega a medirse — mejor una hoja rara que un export que nunca
 * imprime. */
function PaginaHoja({
  hoja,
  pageName,
  marcarListo,
}: {
  hoja: Hoja;
  pageName: string;
  marcarListo: (id: string) => void;
}) {
  const { anchoMm, altoMm } = medidasPaginaMm(hoja);
  return (
    <div
      className={`pagina-impresion pagina-${pageName}`}
      style={{ width: `${anchoMm}mm`, height: `${altoMm}mm` }}
    >
      <HojaCanvas hoja={hoja} marcarListo={marcarListo} />
    </div>
  );
}

/**
 * El `<ReactFlow>` de UNA hoja, sizeado a su propio tamaño real —
 * compartido entre `PaginaHoja` (una hoja = una página completa) y
 * `ExportacionA0` (varias hojas posicionadas dentro de una misma
 * página A0, ver ese archivo). Separado de `PaginaHoja` para no
 * duplicar la lógica de espera de medición entre los dos usos. */
export function HojaCanvas({
  hoja,
  marcarListo,
}: {
  hoja: Hoja;
  marcarListo: (id: string) => void;
}) {
  const estado = useMemo(() => construirEstadoHoja(hoja), [hoja]);
  const { anchoMm, altoMm } = medidasPaginaMm(estado.cfg);
  const { pxW, pxH } = dimensionesHoja(estado.cfg);
  const nodes = useMemo(
    // `hoja` como override (E43): esta página tiene que mostrar SU
    // PROPIO rótulo/tablero, no el de la hoja activa en el lienzo
    // interactivo — ver crearNodoHoja() y HojaNode.
    () => [crearNodoHoja(hoja.id, hoja), ...estado.nodos],
    [hoja, estado.nodos],
  );
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    let intentos = 0;
    function chequear() {
      if (cancelado) return;
      const ocultos = contenedorRef.current?.querySelector(
        '.react-flow__node[style*="visibility: hidden"]',
      );
      intentos += 1;
      if (!ocultos || intentos > 180) {
        marcarListo(hoja.id);
        return;
      }
      requestAnimationFrame(chequear);
    }
    requestAnimationFrame(chequear);
    return () => {
      cancelado = true;
    };
  }, [hoja.id, marcarListo]);

  return (
    <div
      ref={contenedorRef}
      style={{ width: `${anchoMm}mm`, height: `${altoMm}mm` }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={estado.conexiones}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: ZOOM_IMPRESION }}
          minZoom={ZOOM_IMPRESION}
          maxZoom={ZOOM_IMPRESION}
          translateExtent={[
            [0, 0],
            [pxW, pxH],
          ]}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        />
      </ReactFlowProvider>
    </div>
  );
}

/** Tamaño fijo A4 vertical: es una tabla, no un plano a escala — no
 * necesita heredar el formato de ninguna hoja.
 *
 * Agrupada por hoja (un subtítulo + su propia tabla, en vez de una
 * columna "Hoja" repetida en cada fila) y con encabezado de documento
 * (proyecto, fecha, total de ítems) — pedido explícito del usuario:
 * "más descriptivo… que tenga título y se vea mejor". */
function PaginaListaDeMateriales({
  hojas,
  nombreProyecto,
  tensionFaseV,
  tensionLineaV,
}: {
  hojas: Hoja[];
  nombreProyecto: string;
  tensionFaseV: number;
  tensionLineaV: number;
}) {
  const grupos = hojas
    .map((h) => ({ hoja: h, filas: construirBomDeHoja(h, tensionFaseV, tensionLineaV) }))
    .filter((g) => g.filas.length > 0);
  const totalItems = grupos.reduce(
    (acc, g) => acc + g.filas.reduce((t, f) => t + f.cantidad, 0),
    0,
  );
  const fecha = new Date().toLocaleDateString("es-AR");

  return (
    <div
      className="pagina-impresion pagina-bom"
      style={{ width: "210mm", height: "297mm" }}
    >
      <header className="pagina-bom-header">
        <h1>Lista de materiales</h1>
        <dl className="pagina-bom-meta">
          <div>
            <dt>Proyecto</dt>
            <dd>{nombreProyecto || "—"}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{fecha}</dd>
          </div>
          <div>
            <dt>Ítems</dt>
            <dd>{totalItems}</dd>
          </div>
        </dl>
      </header>
      {grupos.length === 0 ? (
        <p className="pagina-bom-vacio">
          Ninguna hoja tiene símbolos con ficha técnica cargada.
        </p>
      ) : (
        grupos.map(({ hoja, filas }) => (
          <section key={hoja.id} className="pagina-bom-grupo">
            <h2>{hoja.nombre}</h2>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Símbolo</th>
                  <th>Descripción</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Cant.</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i}>
                    <td>{f.codigo}</td>
                    <td>{f.nombre}</td>
                    <td>{f.descripcion || "—"}</td>
                    <td>{f.marca || "—"}</td>
                    <td>{f.modelo || "—"}</td>
                    <td>{f.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}

/**
 * Vista de impresión de TODO el proyecto (todas las hojas + lista de
 * materiales), un PDF multipágina con `window.print()` — ver
 * BarraSuperior.exportarProyectoCompletoPdf().
 *
 * Solo se monta contenido mientras `exportandoTodo` está activo: fuera de
 * eso no vale la pena mantener N instancias de React Flow (una por hoja)
 * vivas en memoria todo el tiempo por si acaso se exporta.
 */
export default function ExportacionProyecto() {
  const exportando = useEditor((s) => s.exportandoTodo);
  const incluirBom = useEditor((s) => s.incluirBomEnExportacion);
  const hojas = useEditor((s) => s.proyecto.hojas);
  const nombreProyecto = useEditor((s) => s.nombreProyecto);
  const tensionFaseV = useEditor((s) => s.proyecto.datosProyecto.tension_fase_v);
  const tensionLineaV = useEditor((s) => s.proyecto.datosProyecto.tension_linea_v);
  const [listas, setListas] = useState<Set<string>>(new Set());
  const [exportandoPrevio, setExportandoPrevio] = useState(exportando);

  // Vuelve a cero cada vez que arranca un export nuevo — si no, un
  // segundo export reusaría el "listo" del anterior y podría imprimir
  // antes de que las hojas NUEVAS terminen de medirse. Ajustar estado
  // en base a un cambio de prop/store DURANTE el render (no en un
  // efecto) es el patrón recomendado por React para esto: evita el
  // repintado extra de un efecto que solo sincroniza estado local.
  if (exportando !== exportandoPrevio) {
    setExportandoPrevio(exportando);
    if (exportando) setListas(new Set());
  }

  const marcarListo = useCallback((id: string) => {
    setListas((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  useEffect(() => {
    if (!exportando || listas.size < hojas.length) return;
    // Todas las páginas de hoja terminaron de medir sus nodos recién
    // acá — antes de esto, imprimir salía con hojas en blanco (ver
    // PaginaHoja/AvisoListo). Dos frames más para que el navegador
    // termine de pintar el último cambio antes de abrir el diálogo.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }, [exportando, listas, hojas.length]);

  if (!exportando) return null;

  /* Las reglas @page de TODAS las hojas van en una única hoja de
   * estilos, declarada ANTES de la primera .pagina-impresion — con una
   * <style> por página (repartidas dentro de cada una) Chromium armaba
   * una primera página fantasma en blanco con el tamaño por defecto del
   * navegador, antes de llegar a la primera hoja real (encontrado en
   * vivo generando un PDF real de más de una hoja). Cada regla trae
   * también el `page: <nombre>` que asigna esa página al elemento — por
   * CLASE (`.pagina-hoja-0`), no por `style` inline (ver el porqué en
   * PaginaHoja más arriba). */
  const reglasPagina = hojas
    .map((h, i) => {
      const { anchoMm, altoMm } = medidasPaginaMm(h);
      return `@page hoja-${i} { size: ${anchoMm}mm ${altoMm}mm; margin: 0; } .pagina-hoja-${i} { page: hoja-${i}; }`;
    })
    .concat(
      incluirBom
        ? ["@page bom { size: 210mm 297mm; margin: 0; } .pagina-bom { page: bom; }"]
        : [],
    )
    .join("\n");

  return (
    <div className="exportacion-proyecto">
      <style>{reglasPagina}</style>
      {hojas.map((h, i) => (
        <PaginaHoja
          key={h.id}
          hoja={h}
          pageName={`hoja-${i}`}
          marcarListo={marcarListo}
        />
      ))}
      {incluirBom && (
        <PaginaListaDeMateriales
          hojas={hojas}
          nombreProyecto={nombreProyecto}
          tensionFaseV={tensionFaseV}
          tensionLineaV={tensionLineaV}
        />
      )}
    </div>
  );
}
