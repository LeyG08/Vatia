import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, construirEstadoHoja, BARRA_CODIGO } from "../lib/store";
import { obtenerSimbolo } from "../lib/libreria";
import { anotacionNodo } from "../lib/anotaciones";
import { medidasPaginaMm, ZOOM_IMPRESION } from "../lib/impresion";
import { dimensionesHoja, type FamiliaAtributos, type Hoja } from "../lib/tipos";
import { nodeTypes, edgeTypes, crearNodoHoja } from "../lib/tiposFlow";
import { descargarPlanosPdf, descargarListaDeMaterialesPdf } from "../lib/exportarPdf";

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

/**
 * El `<ReactFlow>` de UNA hoja, sizeado a su propio tamaño real. Se monta
 * fuera de pantalla (ver `.exportacion-offscreen` en estilos.css) y avisa
 * por `marcarListo` cuando terminó de medir sus nodos — recién ahí se
 * puede capturar con html2canvas sin que salga en blanco.
 *
 * `marcarListo`: React Flow mide los nodos de forma ASÍNCRONA
 * (ResizeObserver) antes de mostrarlos — quedan en `visibility:hidden`
 * hasta esa primera medición. Como esta es una instancia de `<ReactFlow>`
 * NUEVA (no la del lienzo interactivo, que ya está medida de antes), no
 * se puede capturar enseguida de montar: salía con la hoja en blanco
 * (encontrado en vivo, en la época de `window.print()` — el problema es
 * el mismo con html2canvas).
 *
 * El hook oficial de la librería para esto (`useNodesInitialized`) NO
 * sirve acá: solo se recalcula cuando el prop `nodes` vuelve a cambiar
 * (dispara `setNodes()` internamente), y estos nodos son estáticos — no
 * hay ningún cambio posterior que lo dispare, así que queda pegado en
 * `false` para siempre aunque los nodos ya estén visibles (confirmado
 * leyendo la fuente de la librería y viéndolo en vivo). Se verifica el
 * DOM directamente en su lugar: mientras quede algún `.react-flow__node`
 * con `visibility: hidden` todavía no terminó de medir. Tope de
 * seguridad a los ~3s por si algún nodo nunca llega a medirse — mejor un
 * PDF raro que uno que nunca se genera.
 */
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

/** Tamaño fijo A4 de ancho, alto libre: es una tabla, no un plano a
 * escala — lib/exportarPdf.ts la reparte en tantas páginas A4 como haga
 * falta según cuánto crezca.
 *
 * Agrupada por hoja (un subtítulo + su propia tabla, en vez de una
 * columna "Hoja" repetida en cada fila) y con encabezado de documento
 * (proyecto, fecha, total de ítems) — pedido explícito del usuario:
 * "más descriptivo… que tenga título y se vea mejor".
 */
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
    <div className="pagina-bom">
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
 * Motor de exportación a PDF: monta contenido FUERA de pantalla según lo
 * que haya pedido `s.exportacionPdf` (ver store.ts), espera a que esté
 * listo para capturar y dispara la descarga con lib/exportarPdf.ts. Dos
 * modos, pedidos como archivos SEPARADOS por el usuario ("de un lado la
 * lista de materiales… de otro lado el plano"):
 *
 * - `"planos"`: una hoja o TODAS, cada una en su propia página del PDF, a
 *   su tamaño real.
 * - `"bom"`: la lista de materiales de esas hojas, sola, en su propio PDF.
 *
 * Solo se monta contenido mientras hay una exportación pendiente: fuera
 * de eso no vale la pena mantener N instancias de React Flow vivas en
 * memoria por si acaso.
 */
export default function ExportacionProyecto() {
  const solicitud = useEditor((s) => s.exportacionPdf);
  const finalizar = useEditor((s) => s.finalizarExportacionPdf);
  const mostrarAlerta = useEditor((s) => s.mostrarAlerta);
  const nombreProyecto = useEditor((s) => s.nombreProyecto);
  const tensionFaseV = useEditor((s) => s.proyecto.datosProyecto.tension_fase_v);
  const tensionLineaV = useEditor((s) => s.proyecto.datosProyecto.tension_linea_v);
  const [listas, setListas] = useState<Set<string>>(new Set());
  const refsHojas = useRef<Map<string, HTMLDivElement>>(new Map());
  const bomRef = useRef<HTMLDivElement>(null);
  const disparado = useRef(false);
  const [solicitudPrevia, setSolicitudPrevia] = useState(solicitud);

  // Vuelve a cero cada vez que arranca una solicitud nueva — si no, una
  // segunda exportación reusaría el "listo" de la anterior. Ajustar
  // estado durante el RENDER (no en un efecto) es el patrón recomendado
  // por React para esto: evita el repintado extra de un efecto que solo
  // sincroniza estado local con un cambio de prop/store. `refsHojas` NO
  // hace falta vaciarlo acá: las entradas de hojas que ya no forman
  // parte de la solicitud nueva quedan sin leerse (solo se consultan por
  // el id de las hojas de LA solicitud actual), y las que sí se repiten
  // se sobrescriben solas cuando su `ref` vuelve a montar.
  if (solicitud !== solicitudPrevia) {
    setSolicitudPrevia(solicitud);
    setListas(new Set());
  }

  useEffect(() => {
    disparado.current = false;
  }, [solicitud]);

  const marcarListo = useCallback((id: string) => {
    setListas((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  useEffect(() => {
    if (!solicitud || disparado.current) return;
    const totalHojas = solicitud.hojas.length;

    async function generarYDescargar() {
      if (!solicitud) return;
      try {
        if (solicitud.tipo === "planos") {
          const paginas = solicitud.hojas.map((h) => {
            const el = refsHojas.current.get(h.id);
            const { anchoMm, altoMm } = medidasPaginaMm(h);
            return el ? { anchoMm, altoMm, el } : null;
          });
          if (paginas.some((p) => p === null)) return;
          const base = nombreProyecto || "proyecto";
          const nombreArchivo =
            solicitud.hojas.length > 1
              ? `${base}-planos.pdf`
              : `${base}-${solicitud.hojas[0].nombre}.pdf`;
          await descargarPlanosPdf(
            paginas as { anchoMm: number; altoMm: number; el: HTMLElement }[],
            nombreArchivo,
          );
        } else {
          if (!bomRef.current) return;
          await descargarListaDeMaterialesPdf(
            bomRef.current,
            `${nombreProyecto || "proyecto"}-lista-de-materiales.pdf`,
          );
        }
      } catch (err) {
        mostrarAlerta(`No se pudo generar el PDF: ${String(err)}`);
      } finally {
        finalizar();
      }
    }

    if (solicitud.tipo === "bom") {
      // Contenido HTML puro: no hay medición asíncrona de React Flow, el
      // layout ya está listo apenas monta. `setTimeout` y no
      // `requestAnimationFrame`: html2canvas se CUELGA (nunca resuelve
      // ni rechaza, sin error) cuando se lo llama desde DENTRO de un
      // callback de rAF — confirmado en vivo comparando la misma
      // llamada, con los mismos parámetros, disparada por rAF (se
      // cuelga siempre) contra disparada por setTimeout/evaluate directo
      // (resuelve en <1s). html2canvas no necesita esperar una pintura
      // real: lee estilos computados del DOM, no el framebuffer.
      disparado.current = true;
      setTimeout(generarYDescargar, 0);
      return;
    }

    if (listas.size < totalHojas) return;
    disparado.current = true;
    setTimeout(generarYDescargar, 0);
  }, [solicitud, listas, nombreProyecto, mostrarAlerta, finalizar]);

  if (!solicitud) return null;

  return (
    <div className="exportacion-offscreen">
      {solicitud.tipo === "planos" &&
        solicitud.hojas.map((h) => (
          <div
            key={h.id}
            ref={(el) => {
              if (el) refsHojas.current.set(h.id, el);
            }}
          >
            <HojaCanvas hoja={h} marcarListo={marcarListo} />
          </div>
        ))}
      {solicitud.tipo === "bom" && (
        <div ref={bomRef}>
          <PaginaListaDeMateriales
            hojas={solicitud.hojas}
            nombreProyecto={nombreProyecto}
            tensionFaseV={tensionFaseV}
            tensionLineaV={tensionLineaV}
          />
        </div>
      )}
    </div>
  );
}
