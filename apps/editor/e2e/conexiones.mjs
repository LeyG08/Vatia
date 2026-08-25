/* Arnés E2E de conexiones (C14, ampliado en C19/C22/C27/C28): abre el
 * editor, carga un proyecto de prueba, verifica que TODO extremo de
 * cable caiga EXACTO sobre su handle (gap < 2,5 px), conecta desde
 * abajo con el mouse, cruza elementos por encima/debajo de la barra,
 * vuelve a cruzarlos, RECONECTA una punta destino y una punta FUENTE
 * entre handles de la barra (C28: la fuente era imposible por el par
 * a/b superpuesto) y comprueba que ESCRIBIR en «Desde» del alimentador
 * NO mueva ni un píxel el símbolo, que ROTAR la barra (R) gire también
 * su trazo, que la punta de reconexión sea ALCANZABLE y que la salida
 * del alimentador caiga EXACTA en el mapa de puntos.
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
    // C22: la punta tiene que ser ALCANZABLE con un clic real — la
    // caja de la barra ya no tapa al updater (pointer-events:none).
    const queHay = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return "";
      return el.getAttribute?.("class") ?? String(el.className.baseVal ?? "");
    }, { x: ux, y: uy });
    if (!String(queHay).includes("edgeupdater")) {
      marcarFalla(
        `la punta de reconexión está TAPADA por ${String(queHay).slice(0, 40)}`,
      );
    }
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

/* C28: RECONEXIÓN de la punta FUENTE sobre la barra — arrastro el
 * updater source de c1 (sale de n1.190a) hasta el slot 210a. Con los
 * handles a/b superpuestos, React Flow resolvía el apuntado SIEMPRE
 * con elementFromPoint a favor del último renderizado ('b', tipo
 * destino) y la suelta de una punta fuente se descartaba en silencio.
 * Ahora, mientras se arrastra, los handles del tipo incompatible
 * quedan fuera del hit-testing (.conectando-* + pointer-events). */
{
  const upd = page.locator(
    '.react-flow__edge[data-id="c1"] .react-flow__edgeupdater-source',
  );
  const bbU = await upd.boundingBox().catch(() => null);
  const bbH = await page
    .locator('.react-flow__handle[data-nodeid="n1"][data-handleid="210a"]')
    .boundingBox();
  if (!bbU || !bbH) {
    marcarFalla("no encontré el updater source de c1 o el handle 210a");
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
    const filaF = r.filas?.find((f) => f.edge === "c1" && f.ext === "ini");
    if (!filaF || !filaF.hacia.startsWith("n1.210")) {
      marcarFalla(
        `la punta fuente de c1 quedó en ${filaF?.hacia ?? "?"} (esperaba n1.210a/b)`,
      );
    } else {
      console.log(`[punta fuente] c1/ini → ${filaF.hacia}`);
    }
  }
}

/* C29: QUIEBRE arrastrable — selecciono el cable c4 clickeando el
 * PUNTO MEDIO de su tramo más largo (el centro del bbox puede caer
 * fuera del trazo en rutas en L), aparece el grip, al arrastrarlo el
 * cable dobla por esa esquina exacta (más vértices) y Ctrl+Z restaura. */
{
  const pathC4 = page
    .locator('.react-flow__edge[data-id="c4"] .react-flow__edge-path')
    .first();
  const d0 = await pathC4.getAttribute("d");
  const v0 = (d0?.match(/-?\d+(?:\.\d+)?/g)?.length ?? 0) / 2;
  // punto sobre la línea: mitad del segmento más largo, a coords pantalla
  const punto = await pathC4.evaluate((p) => {
    const nums = (p.getAttribute("d") ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    let mejor = [pts[0], pts[1]], largo = -1;
    for (let i = 0; i + 1 < pts.length; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (l > largo) { largo = l; mejor = [pts[i], pts[i + 1]]; }
    }
    const pt = new DOMPoint(
      (mejor[0][0] + mejor[1][0]) / 2,
      (mejor[0][1] + mejor[1][1]) / 2,
    ).matrixTransform(p.ownerSVGElement.getScreenCTM());
    return { x: pt.x, y: pt.y };
  });
  await page.mouse.click(punto.x, punto.y);
  await page.waitForTimeout(200);
  const elegido = await page.evaluate(
    () => document.querySelector(".react-flow__edge.selected")?.getAttribute("data-id") ?? "(ninguno)",
  );
  const grip = page.locator('.paso-grip[data-edge="c4"]');
  await grip.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
  const bbG = await grip.boundingBox().catch(() => null);
  if (elegido !== "c4" || !bbG) {
    marcarFalla(`clic no seleccionó c4 (${elegido}) o el grip no apareció`);
  } else {
    const gx = bbG.x + bbG.width / 2;
    const gy = bbG.y + bbG.height / 2;
    await page.mouse.move(gx, gy);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(gx + (36 * i) / 8, gy + (18 * i) / 8);
    await page.mouse.up();
    await page.waitForTimeout(250);
    const d1 = await pathC4.getAttribute("d");
    const v1 = (d1?.match(/-?\d+(?:\.\d+)?/g)?.length ?? 0) / 2;
    if (v1 <= v0) {
      marcarFalla(`el quiebre no dobló el cable (vértices ${v0} → ${v1})`);
    } else {
      console.log(`[quiebre] vértices ${v0} → ${v1}`);
      resumen("cable con quiebre", await medir(page));
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(250);
      const d2 = await pathC4.getAttribute("d");
      const v2 = (d2?.match(/-?\d+(?:\.\d+)?/g)?.length ?? 0) / 2;
      if (v2 !== v0) {
        marcarFalla(`Ctrl+Z no restauró la ruta (vértices ${v2}, esperaba ${v0})`);
      } else {
        console.log("[quiebre] deshacer OK");
      }
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

/* C22: la PUNTA del alimentador cae EXACTA en el mapa de puntos —
 * resto a la grilla de 10 px (en coords de flujo, sin zoom) ≈ 0.
 * C27: y también el CUERPO del nodo (posición del nodo múltiplo de
 * 10 px) — cuerpo y punta juntos sobre el mapa punteado. */
{
  const punta = await page.evaluate(() => {
    const svg = document.querySelector(".react-flow__edge-path")
      ?.ownerSVGElement;
    const inv = svg?.getScreenCTM()?.inverse();
    const h = document.querySelector(
      ".nodo-alimentador .react-flow__handle",
    );
    if (!inv || !h) return null;
    const r = h.getBoundingClientRect();
    const p = new DOMPoint(r.x + r.width / 2, r.y + r.height / 2)
      .matrixTransform(inv);
    return { fx: p.x, fy: p.y };
  });
  if (!punta) {
    marcarFalla("no pude medir la punta del alimentador");
  } else {
    const dx = Math.abs(punta.fx - Math.round(punta.fx / 10) * 10);
    const dy = Math.abs(punta.fy - Math.round(punta.fy / 10) * 10);
    console.log(
      `[alineación punta alimentador] resto=(${dx.toFixed(2)}, ${dy.toFixed(2)}) px`,
    );
    if (dx > 0.6 || dy > 0.6)
      marcarFalla("la punta quedó ENTRE DOS puntos del mapa");
  }
  /* C27: posición del NODO (origen de la caja) también en grilla.
   * RF pinta la posición como translate(x, y) en el wrapper. */
  const cuerpo = await page.evaluate(() => {
    const h = document.querySelector(".nodo-alimentador");
    const w = h?.closest(".react-flow__node");
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(
      w?.style.transform ?? "",
    );
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
  });
  if (!cuerpo) {
    marcarFalla("no pude medir el cuerpo del alimentador");
  } else {
    const bx = Math.abs(cuerpo.x - Math.round(cuerpo.x / 10) * 10);
    const by = Math.abs(cuerpo.y - Math.round(cuerpo.y / 10) * 10);
    console.log(`[alineación cuerpo alimentador] resto=(${bx.toFixed(2)}, ${by.toFixed(2)}) px`);
    if (bx > 0.6 || by > 0.6)
      marcarFalla("el CUERPO del alimentador quedó entre dos puntos del mapa");
  }
}

await browser.close();
if (fallos > 0) {
  console.log(`E2E FALLÓ: ${fallos} problema(s)`);
  process.exitCode = 1;
} else {
  console.log("E2E OK");
}
