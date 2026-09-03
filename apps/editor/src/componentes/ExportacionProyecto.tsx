import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { useEditor, construirEstadoHoja, BARRA_CODIGO } from "../lib/store";
import { obtenerSimbolo } from "../lib/libreria";
import { medidasPaginaMm, ZOOM_IMPRESION } from "../lib/impresion";
import { dimensionesHoja, type Hoja } from "../lib/tipos";
import { nodeTypes, edgeTypes, crearNodoHoja } from "../lib/tiposFlow";

interface FilaBom {
  hoja: string;
  codigo: string;
  nombre: string;
  marca: string;
  modelo: string;
  cantidad: number;
}

/**
 * Lista de materiales: una fila por (hoja, código, marca, modelo),
 * agrupando cantidades repetidas. Los alimentadores no son un ítem físico
 * (representan "acá entra la alimentación", no un aparato) y quedan
 * afuera; las barras sí cuentan (juego de barras es un ítem real).
 *
 * Se suman también los accesorios cargados a mano por hoja (PanelHoja —
 * terminales, peines de conexión, bornera de distribución…): no tienen
 * símbolo en el plano, así que no hay forma de detectarlos solos.
 */
function construirBom(hojas: Hoja[]): FilaBom[] {
  const filas = new Map<string, FilaBom>();
  for (const hoja of hojas) {
    for (const n of hoja.nodos ?? []) {
      if (n.tipo === "alimentador") continue;
      const codigo = n.codigo_iec ?? (n.tipo === "barra" ? BARRA_CODIGO : undefined);
      if (!codigo) continue;
      const nombre = obtenerSimbolo(codigo)?.metadata.nombre ?? codigo;
      const marca = typeof n.atributos?.marca === "string" ? n.atributos.marca : "";
      const modelo = typeof n.atributos?.modelo === "string" ? n.atributos.modelo : "";
      const clave = `${hoja.nombre}|${codigo}|${marca}|${modelo}`;
      const existente = filas.get(clave);
      if (existente) existente.cantidad += 1;
      else filas.set(clave, { hoja: hoja.nombre, codigo, nombre, marca, modelo, cantidad: 1 });
    }
    for (const a of hoja.accesorios ?? []) {
      if (a.descripcion.trim() === "") continue;
      filas.set(`${hoja.nombre}|accesorio|${a.id}`, {
        hoja: hoja.nombre,
        codigo: "—",
        nombre: a.descripcion,
        marca: a.marca ?? "",
        modelo: a.modelo ?? "",
        cantidad: a.cantidad,
      });
    }
  }
  return [...filas.values()].sort(
    (a, b) => a.hoja.localeCompare(b.hoja) || a.codigo.localeCompare(b.codigo),
  );
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
 * `ExportacionProyecto` en un único `<style>` (ver ahí por qué). */
function PaginaHoja({ hoja, pageName }: { hoja: Hoja; pageName: string }) {
  const estado = construirEstadoHoja(hoja);
  const { anchoMm, altoMm } = medidasPaginaMm(estado.cfg);
  const { pxW, pxH } = dimensionesHoja(estado.cfg);
  return (
    <div
      className={`pagina-impresion pagina-${pageName}`}
      style={{ width: `${anchoMm}mm`, height: `${altoMm}mm` }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={[crearNodoHoja(hoja.id), ...estado.nodos]}
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
 * necesita heredar el formato de ninguna hoja. */
function PaginaListaDeMateriales({ hojas }: { hojas: Hoja[] }) {
  const filas = construirBom(hojas);
  return (
    <div
      className="pagina-impresion pagina-bom"
      style={{ width: "210mm", height: "297mm" }}
    >
      <h1>Lista de materiales</h1>
      <table>
        <thead>
          <tr>
            <th>Hoja</th>
            <th>Código</th>
            <th>Símbolo</th>
            <th>Marca</th>
            <th>Modelo</th>
            <th>Cant.</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              <td>{f.hoja}</td>
              <td>{f.codigo}</td>
              <td>{f.nombre}</td>
              <td>{f.marca || "—"}</td>
              <td>{f.modelo || "—"}</td>
              <td>{f.cantidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
        <PaginaHoja key={h.id} hoja={h} pageName={`hoja-${i}`} />
      ))}
      {incluirBom && <PaginaListaDeMateriales hojas={hojas} />}
    </div>
  );
}
