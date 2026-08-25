/* Arnés E2E de conexiones (C14, ampliado en C19): abre el editor,
 * carga un proyecto de prueba, verifica que TODO extremo de cable
 * caiga EXACTO sobre su handle (gap < 2,5 px), conecta desde abajo con
 * el mouse, cruza elementos por encima/debajo de la barra, vuelve a
 * cruzarlos, RECONECTA una punta arrastrándola a otro handle de la
 * barra y comprueba que ESCRIBIR en «Desde» del alimentador NO mueva
 * ni un píxel el símbolo y que ROTAR la barra (R) gire también su
 * trazo.
 *
 * Uso:  npm run build && npm run preview &  → luego  npm run e2e
 * (requiere `npx playwright install chromium` una sola vez).
 * Sale con código 1 si algo falla (gaps, sin paths, reconexión mala,
 * símbolo corrido). */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const SERVIDOR = process.env.URL ?? "http://localhost:4173/";
const ARCHIVO =
  process.env.PROYECTO ??
  fileURLToPath(
    new URL("../ejemplos/regresion-barra.json", import.meta.url),
  );
const CON_ALIMENTADOR = fileURLToPath(
  new URL("../ejemplos/regresion-alimentador.json", import.meta.url),
);
const UMBRAL = 2.5;

let fallos = 0;
function marcarFalla(msj) {
  fallos++;
  console.log(`  ✗ ${msj}`);
}

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
    marcarFalla(`[${etiqueta}] SIN PATHS (barra/conexiones perdidas?)`);
    return;
  }
  const malas = r.filas.filter((f) => f.gap > UMBRAL);
  console.log(
    `[${etiqueta}] ${r.filas.length} extremos — ` +
      (malas.length
        ? "GAP: " + malas.map((f) => `${f.edge}/${f.ext}=${f.gap}`).join(", ")
        : "ok"),
  );
  if (malas.length) fallos += malas.length;
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

/* C19: RECONEXIÓN de punta — arrastro el updater target de c4 desde
 * su handle actual (390b) hasta otro de la misma barra (410b). El
 * updater queda DEBAJO del nodo de la barra (las capas de RF ponen
 * los nodos encima), así que el mousedown se despacha DIRECTO al
 * elemento; el arrastre y la suelta son eventos reales de mouse. */
{
  const upd = page.locator(
    '.react-flow__edge[data-id="c4"] .react-flow__edgeupdater-target',
  );
  const bbU = await upd.boundingBox().catch(() => null);
  const bbH = await page
    .locator('.react-flow__handle[data-nodeid="n1"][data-handleid="410b"]')
    .boundingBox();
  if (!bbU || !bbH) {
    marcarFalla("no encontré el updater target de c4 o el handle 410b");
  } else {
    const ux = bbU.x + bbU.width / 2;
    const uy = bbU.y + bbU.height / 2;
    const hx = bbH.x + bbH.width / 2;
    const hy = bbH.y + bbH.height / 2;
    await upd.dispatchEvent("mousedown", {
      clientX: ux,
      clientY: uy,
      button: 0,
      buttons: 1,
      bubbles: true,
      cancelable: true,
    });
    await page.mouse.move(ux, uy);
    for (let i = 1; i <= 10; i++)
      await page.mouse.move(ux + ((hx - ux) * i) / 10, uy + ((hy - uy) * i) / 10);
    await page.mouse.up();
    await page.waitForTimeout(250);
    const r = await medir(page);
    resumen("punta de c4 reconectada 390b→410b", r);
    // El slot tiene DOS handles superpuestos (410a fuente / 410b
    // destino): cualquiera de los dos cuenta — es el mismo punto.
    const fila = r.filas?.find((f) => f.edge === "c4" && f.ext === "fin");
    if (!fila || !fila.hacia.startsWith("n1.410")) {
      marcarFalla(
        `la punta de c4 quedó en ${fila?.hacia ?? "?"} (esperaba n1.410a/b)`,
      );
    }
  }
}

/* C21: BARRA VERTICAL — roto la barra con R y verifico que el trazo
 * (.barra-eje) TAMBIÉN gira (antes quedaba horizontal) y que los
 * cables siguen anclando exacto sobre los handles reproyectados. */
{
  await page.click('.react-flow__node[data-id="n1"] .nodo-barra');
  const antes = await page
    .locator('.react-flow__node[data-id="n1"] .barra-eje')
    .boundingBox();
  await page.keyboard.press("r");
  await page.waitForTimeout(250);
  const despues = await page
    .locator('.react-flow__node[data-id="n1"] .barra-eje')
    .boundingBox();
  if (!antes || !despues) {
    marcarFalla("no encontré el eje de la barra");
  } else {
    console.log(
      `[rotar barra] eje ${antes.width.toFixed(0)}x${antes.height.toFixed(0)}` +
        ` → ${despues.width.toFixed(0)}x${despues.height.toFixed(0)}`,
    );
    // Comparación RELATIVA (el zoom del viewport infla los px): antes
    // horizontal (ancho ≫ alto), después vertical (alto ≫ ancho).
    const horizontalOk = antes.width >= 3 * antes.height;
    const verticalOk = despues.height >= 3 * despues.width;
    if (!horizontalOk || !verticalOk) {
      marcarFalla("el trazo de la barra no gira al rotar");
    }
  }
  resumen("cables tras rotar la barra", await medir(page));
}

/* C19: ESCRIBIR en «Desde» NO mueve el símbolo — proyecto con
 * alimentador, mido su handle en pantalla, tipeo un texto largo y
 * vuelvo a medir: tiene que quedar idéntico (antes el input crecía
 * con el texto y empujaba todo). */
await page.setInputFiles('input[type="file"]', CON_ALIMENTADOR);
await page.waitForSelector(".nodo-alimentador", { timeout: 10000 });
await page.waitForTimeout(400);
{
  const h = page.locator(".nodo-alimentador .react-flow__handle");
  const antes = await h.boundingBox();
  await page.click(".alim-origen");
  await page.keyboard.type("Tablero TS-G1");
  await page.waitForTimeout(250);
  const despues = await h.boundingBox();
  const d = Math.hypot(
    despues.x + despues.width / 2 - (antes.x + antes.width / 2),
    despues.y + despues.height / 2 - (antes.y + antes.height / 2),
  );
  console.log(`[escribiendo en Desde] desplazamiento del handle=${d.toFixed(2)} px`);
  if (d > 0.5) marcarFalla("el alimentador se movió al escribir");
  resumen("alimentador tras escribir", await medir(page));
}

await browser.close();
if (fallos > 0) {
  console.log(`E2E FALLÓ: ${fallos} problema(s)`);
  process.exitCode = 1;
} else {
  console.log("E2E OK");
}
