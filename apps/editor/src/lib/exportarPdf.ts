/**
 * Descarga directa de PDF: reemplaza el viejo `window.print()` +
 * `@media print`. Se captura con html2canvas el DOM ya renderizado
 * (una instancia de React Flow por hoja, montada fuera de pantalla —
 * ver ExportacionProyecto.tsx) y se arma el archivo con jsPDF, que lo
 * descarga directo — sin pasar por el diálogo de impresión del
 * navegador, del que dependía toda la cadena de bugs anterior (páginas
 * en blanco, tamaño de página equivocado, colores según el tema).
 *
 * `.captura-pdf-negro` (ver estilos.css) fuerza negro sobre blanco
 * durante la captura, sin importar el tema activo en pantalla.
 */
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/** Resolución de captura: 2x el tamaño real en pantalla — nítido en
 * impresión sin disparar el peso del PDF (probar con 3 en un proyecto
 * grande de varias hojas generaba archivos de decenas de MB). */
const ESCALA_CAPTURA = 2;
const CALIDAD_JPEG = 0.95;

async function esperarUnFrame(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(r));
}

/** Captura un elemento del DOM ya renderizado como canvas, forzando
 * negro sobre blanco durante la captura (ver estilos.css). La clase se
 * saca siempre al terminar, incluso si html2canvas tira una excepción
 * — si no, un fallo a mitad de una exportación de varias hojas deja el
 * lienzo interactivo pisado en blanco y negro. */
async function capturarElemento(el: HTMLElement): Promise<HTMLCanvasElement> {
  el.classList.add("captura-pdf-negro");
  try {
    await esperarUnFrame();
    return await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: ESCALA_CAPTURA,
    });
  } finally {
    el.classList.remove("captura-pdf-negro");
  }
}

/** Un plano por elemento, cada uno en una página de SU propio tamaño
 * real (mm) — el elemento capturado ya está sizeado exacto a esas
 * medidas (ver HojaCanvas), así que la imagen llena la página sin
 * recortar ni escalar. */
export async function descargarPlanosPdf(
  hojas: { anchoMm: number; altoMm: number; el: HTMLElement }[],
  nombreArchivo: string,
): Promise<void> {
  if (hojas.length === 0) return;
  const primera = hojas[0];
  const doc = new jsPDF({
    unit: "mm",
    format: [primera.anchoMm, primera.altoMm],
    orientation: primera.anchoMm >= primera.altoMm ? "landscape" : "portrait",
  });
  for (let i = 0; i < hojas.length; i++) {
    const { anchoMm, altoMm, el } = hojas[i];
    const canvas = await capturarElemento(el);
    if (i > 0) {
      doc.addPage([anchoMm, altoMm], anchoMm >= altoMm ? "landscape" : "portrait");
    }
    doc.addImage(
      canvas.toDataURL("image/jpeg", CALIDAD_JPEG),
      "JPEG",
      0,
      0,
      anchoMm,
      altoMm,
    );
  }
  doc.save(nombreArchivo);
}

/** Lista de materiales: un único elemento HTML de ancho A4 fijo y alto
 * libre (crece con la cantidad de ítems) — se captura entera y se
 * reparte en tantas páginas A4 como haga falta, recortando el canvas
 * capturado en franjas de una página de alto cada una. */
export async function descargarListaDeMaterialesPdf(
  el: HTMLElement,
  nombreArchivo: string,
): Promise<void> {
  const anchoMm = 210;
  const altoMm = 297;
  const canvas = await capturarElemento(el);
  const doc = new jsPDF({ unit: "mm", format: [anchoMm, altoMm] });

  const pxPorMm = canvas.width / anchoMm;
  const altoPaginaPx = Math.round(altoMm * pxPorMm);
  let offsetPx = 0;
  let primera = true;
  while (offsetPx < canvas.height) {
    const altoTrozoPx = Math.min(altoPaginaPx, canvas.height - offsetPx);
    const trozo = document.createElement("canvas");
    trozo.width = canvas.width;
    trozo.height = altoTrozoPx;
    const ctx = trozo.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(
      canvas,
      0,
      offsetPx,
      canvas.width,
      altoTrozoPx,
      0,
      0,
      canvas.width,
      altoTrozoPx,
    );
    if (!primera) doc.addPage([anchoMm, altoMm], "portrait");
    doc.addImage(
      trozo.toDataURL("image/jpeg", CALIDAD_JPEG),
      "JPEG",
      0,
      0,
      anchoMm,
      altoTrozoPx / pxPorMm,
    );
    offsetPx += altoTrozoPx;
    primera = false;
  }
  doc.save(nombreArchivo);
}
