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
  }
  return [...filas.values()].sort(
    (a, b) => a.hoja.localeCompare(b.hoja) || a.codigo.localeCompare(b.codigo),
  );
}

/** Una página de impresión por hoja: su propio <ReactFlow> aislado (no
 * comparte provider con el lienzo interactivo), fijo en la escala física
 * de impresión — ver lib/impresion.ts. */
function PaginaHoja({ hoja }: { hoja: Hoja }) {
  const estado = construirEstadoHoja(hoja);
  const { anchoMm, altoMm } = medidasPaginaMm(estado.cfg);
  const { pxW, pxH } = dimensionesHoja(estado.cfg);
  return (
    <div
      className="pagina-impresion"
      style={{ width: `${anchoMm}mm`, height: `${altoMm}mm` }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={[crearNodoHoja(), ...estado.nodos]}
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

function PaginaListaDeMateriales({ hojas }: { hojas: Hoja[] }) {
  const filas = construirBom(hojas);
  return (
    <div className="pagina-impresion pagina-bom">
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
  const hojas = useEditor((s) => s.proyecto.hojas);

  if (!exportando) return null;

  return (
    <div className="exportacion-proyecto">
      {hojas.map((h) => (
        <PaginaHoja key={h.id} hoja={h} />
      ))}
      <PaginaListaDeMateriales hojas={hojas} />
    </div>
  );
}
