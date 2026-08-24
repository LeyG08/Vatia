/* Arnés E2E de conexiones (C14): abre el editor, carga un proyecto de
 * prueba, verifica que TODO extremo de cable caiga EXACTO sobre su
 * handle (gap < 2,5 px), conecta desde abajo con el mouse, cruza
 * elementos por encima/debajo de la barra y vuelve a cruzarlos.
 *
 * Uso:  npm run build && npm run preview &  → luego  npm run e2e
 * (requiere `npx playwright install chromium` una sola vez).
 * ARCHIVO apunta a un proyecto de muestra; ajustalo si hace falta. */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const SERVIDOR = process.env.URL ?? "http://localhost:4173/";
const ARCHIVO =
  process.env.PROYECTO ??
  fileURLToPath(
    new URL("../ejemplos/regresion-barra.json", import.meta.url),
  );
const UMBRAL = 2.5;

async function medir(page) {
  return page.evaluate(() => {
    const paths = [...document.querySelectorAll(".react-flow__edge-path")];
    const handles = [...document.querySelectorAll(".react-flow__handle")];
    if (!paths.length || !handles.length) return { vacio: true, filas: [] };
    const esvg = paths[0].ownerSVGElement;
    const inv = esvg.getScreenCTM().inverse();
    const hs = handles.map((h) => {
      const r = h.getBoundingClientRect();
      const pt = new DOMPoint(r.x + r.width / 2, r.y + r.height / 2)
        .matrixTransform(inv);
      return {
        n: h.getAttribute("data-nodeid"),
        h: h.getAttribute("data-handleid"),
        x: pt.x,
        y: pt.y,
      };
    });
    const filas = [];
    for (const p of paths) {
      const d = p.getAttribute("d") ?? "";
      const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      if (nums.length < 4) continue;
      const id = p.closest("[data-id]")?.getAttribute("data-id") ?? "?";
      for (const [nombre, x, y] of [
        ["ini", nums[0], nums[1]],
        ["fin", nums[nums.length - 2], nums[nums.length - 1]],
      ]) {
        let mejor = null;
        for (const h of hs) {
          const dd = Math.hypot(h.x - x, h.y - y);
          if (!mejor || dd < mejor.d) mejor = { d: dd, h };
        }
        filas.push({
          edge: id,
          ext: nombre,
          gap: +mejor.d.toFixed(2),
          hacia: `${mejor.h.n}.${mejor.h.h}`,
        });
      }
    }
    return { vacio: false, filas };
  });
}

function resumen(etiqueta, r) {
  if (r.vacio) {
    console.log(`[${etiqueta}] SIN PATHS (barra/conexiones perdidas?)`);
    return;
  }
  const malas = r.filas.filter((f) => f.gap > UMBRAL);
  console.log(
    `[${etiqueta}] ${r.filas.length} extremos — ` +
      (malas.length
        ? "GAP: " + malas.map((f) => `${f.edge}/${f.ext}=${f.gap}`).join(", ")
        : "ok"),
  );
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
await page.goto(SERVIDOR);
await page.setInputFiles('input[type="file"]', ARCHIVO);
await page.waitForSelector('.react-flow__node[data-id="n1"]', { timeout: 10000 });
await page.waitForTimeout(400);

const escala = await page.evaluate(() => {
  const t = document.querySelector(".react-flow__viewport").style.transform;
  const m = t.match(/scale\(([\d.]+)\)/);
  return m ? parseFloat(m[1]) : 1;
});

resumen("archivo cargado", await medir(page));

/* Conexión fresca desde abajo: n5.2 → barra 430b */
{
  const bbA = await page
    .locator('.react-flow__handle[data-nodeid="n5"][data-handleid="2"]')
    .boundingBox();
  const bbB = await page
    .locator('.react-flow__handle[data-nodeid="n1"][data-handleid="430b"]')
    .boundingBox();
  const ax = bbA.x + bbA.width / 2;
  const ay = bbA.y + bbA.height / 2;
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(
      ax + ((bbB.x - ax) * i) / 10,
      ay + ((bbB.y - ay) * i) / 10,
    );
  await page.mouse.up();
  await page.waitForTimeout(200);
  resumen("nueva conexión n5.2→430b (abajo)", await medir(page));
}

async function arrastrar(nodeId, dxF, dyF, pasos = 16) {
  const loc = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  const bb = await loc.boundingBox();
  const x0 = bb.x + bb.width / 2;
  const y0 = bb.y + bb.height / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= pasos; i++) {
    await page.mouse.move(x0 + (dxF * escala * i) / pasos, y0 + (dyF * escala * i) / pasos);
    if (i === 8 || i === pasos)
      resumen(`${nodeId} cruzando ${i}/${pasos}`, await medir(page));
  }
  await page.mouse.up();
  await page.waitForTimeout(250);
  resumen(`${nodeId} SUELTO`, await medir(page));
}

await arrastrar("n5", 0, -170); // abajo → arriba
await arrastrar("n5", 0, 170);  // arriba → abajo (viceversa)
await arrastrar("n3", 0, -170); // el que cuelga por c2 (fuente=barra)

await browser.close();
