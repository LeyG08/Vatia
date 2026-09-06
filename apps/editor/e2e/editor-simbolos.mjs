/**
 * E2E del editor de símbolos (modo admin).
 *
 * Existe por una razón concreta: entre C37 y C40 hubo cuatro iteraciones
 * seguidas sobre cómo cargar el SVG en Fabric, todas dadas por buenas con
 * "build passes, TS clean", y ninguna renderizaba bien. El símbolo salía
 * cortado o partido en dos y nadie se enteraba hasta abrirlo a mano. Este
 * arnés mira los píxeles y falla si eso vuelve a pasar.
 *
 * Comprueba, para CADA símbolo de la librería:
 *   1. que se dibuje algo,
 *   2. que el dibujo no toque los bordes del canvas (síntoma de recorte),
 *   3. que los marcadores de punto de conexión caigan sobre los extremos
 *      de la geometría — que es lo que detecta un desfase de origen.
 *
 * Requiere el dev server en http://localhost:5173 (npm run dev).
 * Uso: node e2e/editor-simbolos.mjs
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const URL = process.env.VATIA_URL ?? "http://localhost:5173/";
// Distancia mínima al borde del canvas. El encuadre reserva 60 px (30 por
// lado), así que una tinta más cerca que esto significa que el símbolo se
// escapó del área visible: es el síntoma exacto del render roto de C37–C40.
const MARGEN_MINIMO_PX = 20;

// Tolerancia entre el centro de un marcador y la caja de tinta. Necesita holgura
// porque el círculo rojo del terminal TAPA el extremo negro de la línea (la tinta
// "empieza" un par de unidades más adentro) y porque la etiqueta del punto corre
// el centroide del marcador. Los desfases que este arnés busca son de cientos de
// píxeles, así que 40 sigue siendo holgado sin dejar de ser útil.
const TOLERANCIA_PX = 40;

const fallos = [];
const consola = [];

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1400, height: 900 } });
pagina.on("console", (m) => { if (m.type() === "error") consola.push(m.text()); });
pagina.on("pageerror", (e) => consola.push("PAGEERROR: " + e.message));

await pagina.goto(URL, { waitUntil: "networkidle" });
await pagina.evaluate(() => localStorage.setItem("vatia-admin", "true"));
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForTimeout(1200);

const codigos = await pagina.evaluate(() =>
  [...document.querySelectorAll("*")]
    .map((e) => e.textContent?.trim() ?? "")
    .filter((t) => /^S\d{5}$/.test(t))
    .filter((t, i, a) => a.indexOf(t) === i)
    .sort(),
);

if (codigos.length === 0) {
  console.error("✗ no encontré ningún símbolo en la lista del editor");
  await navegador.close();
  process.exit(1);
}
console.log(`Editor de símbolos · ${codigos.length} símbolos\n`);

/** Separa el dibujo (tinta oscura) de los marcadores (rojo/azul/verde). */
function analizar() {
  const c = document.querySelector("canvas");
  const ctx = c?.getContext("2d");
  if (!ctx || !c.width) return null;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const caja = (n) => (n.max === -1 ? null : n);
  const tinta = { minX: 1e9, minY: 1e9, maxX: -1, maxY: -1, n: 0 };
  const marcas = [];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
      if (a < 40) continue;
      const oscuro = r < 110 && g < 110 && b < 110;
      const rojo = r > 150 && g < 110 && b < 130;
      const azul = b > 150 && r < 110;
      const verde = g > 120 && r < 110 && b < 110;
      if (oscuro) {
        tinta.n++;
        if (x < tinta.minX) tinta.minX = x;
        if (x > tinta.maxX) tinta.maxX = x;
        if (y < tinta.minY) tinta.minY = y;
        if (y > tinta.maxY) tinta.maxY = y;
      } else if (rojo || azul || verde) {
        marcas.push([x, y]);
      }
    }
  }
  // Agrupar los píxeles de marcador en centros (los marcadores están lejos entre sí)
  const centros = [];
  for (const [x, y] of marcas) {
    const cerca = centros.find((c2) => Math.abs(c2.sx / c2.n - x) < 30 && Math.abs(c2.sy / c2.n - y) < 30);
    if (cerca) { cerca.sx += x; cerca.sy += y; cerca.n++; }
    else centros.push({ sx: x, sy: y, n: 1 });
  }
  return {
    w: c.width, h: c.height,
    tinta: caja({ ...tinta, max: tinta.maxX }),
    centros: centros.filter((c2) => c2.n > 20).map((c2) => [Math.round(c2.sx / c2.n), Math.round(c2.sy / c2.n)]),
  };
}

for (const codigo of codigos) {
  await pagina.locator(`text=${codigo}`).first().click();
  await pagina.waitForTimeout(500);
  const r = await pagina.evaluate(analizar);
  const problemas = [];

  if (!r || !r.tinta || r.tinta.n === 0) {
    problemas.push("no se dibujó nada");
  } else {
    const { minX, minY, maxX, maxY } = r.tinta;
    // 2) el dibujo tiene que quedar holgado dentro del canvas
    const margen = Math.min(minX, minY, r.w - 1 - maxX, r.h - 1 - maxY);
    if (margen < MARGEN_MINIMO_PX) {
      problemas.push(
        `el dibujo queda a ${margen} px del borde (mínimo ${MARGEN_MINIMO_PX}): ` +
        `(${minX},${minY})-(${maxX},${maxY}) en ${r.w}x${r.h}`,
      );
    }
    // 3) los marcadores deben caer sobre la geometría
    for (const [mx, my] of r.centros) {
      const dentro =
        mx >= minX - TOLERANCIA_PX && mx <= maxX + TOLERANCIA_PX &&
        my >= minY - TOLERANCIA_PX && my <= maxY + TOLERANCIA_PX;
      if (!dentro) {
        problemas.push(`marcador en (${mx},${my}) fuera de la geometría (${minX},${minY})-(${maxX},${maxY})`);
      }
    }
  }

  if (problemas.length) {
    fallos.push(codigo);
    for (const p of problemas) console.log(`  ✗ ${codigo}: ${p}`);
  } else {
    console.log(`  ✓ ${codigo} (${r.tinta.n} px de tinta, ${r.centros.length} marcadores)`);
  }
}

/**
 * Prueba de guardado real (E3): entre C37 y C40 nadie ejerció esta ruta.
 * Un guardado corrupto pasaba el "build" y hasta el render en modo vista
 * sin que nada lo notara — así se corrompió S00110 en el commit f5d901e.
 * Se prueba contra el endpoint real, y como el endpoint commitea sobre la
 * rama activa cuando no es main, se deja el repo EXACTO como estaba: si el
 * guardado generó un commit, se deshace al final (git reset --soft +
 * checkout desde el HEAD anterior), sin importar si la prueba pasó o no.
 */
async function probarGuardadoReal() {
  const fs = await import("node:fs");
  const codigoPrueba = "S00110";
  const headAntes = execFileSync("git", ["rev-parse", "HEAD"], { cwd: raizRepo, encoding: "utf8" }).trim();
  const dirSimbolo = fs.readdirSync(path.join(raizRepo, "libreria-simbolos", "simbolos"))
    .find((d) => d.startsWith(codigoPrueba + "_"));
  const rutaSvg = path.join(raizRepo, "libreria-simbolos", "simbolos", dirSimbolo, "simbolo.svg");
  const rutaMeta = path.join(raizRepo, "libreria-simbolos", "simbolos", dirSimbolo, "metadata.json");
  const svgAntes = fs.readFileSync(rutaSvg, "utf8");
  const metaAntes = fs.readFileSync(rutaMeta, "utf8");

  let resultado = { ok: false, problemas: ["no se pudo ejecutar la prueba"] };
  try {
    await pagina.locator(`text=${codigoPrueba}`).first().click();
    await pagina.waitForTimeout(500);
    await pagina.getByRole("button", { name: "Editar geometría" }).click();
    await pagina.waitForTimeout(500);

    const caja = await pagina.locator("canvas").first().boundingBox();
    // y=400 cae sobre el cuerpo del símbolo (una polyline), lejos de los
    // terminales "in"/"out" — no queremos agarrar un punto de conexión acá:
    // esa alineación a grilla la cubre probarPuntoConexion() más abajo, con
    // un desplazamiento exacto. Esta prueba solo verifica que el SVG
    // guardado quede limpio, sin importar la magnitud del arrastre.
    await pagina.mouse.click(caja.x + caja.width / 2, caja.y + 400);
    await pagina.waitForTimeout(150);
    await pagina.mouse.down();
    await pagina.mouse.move(caja.x + caja.width / 2 + 5, caja.y + 400, { steps: 5 });
    await pagina.mouse.up();
    await pagina.waitForTimeout(200);

    /* El botón se busca DENTRO de la barra del editor de símbolos: la
     * barra superior de la app también tiene un "Guardar" (E79 le sacó
     * el emoji, así que ahora los dos nombres coinciden exactamente y
     * un selector global da strict mode violation). */
    const [respuesta] = await Promise.all([
      pagina.waitForResponse((r) => r.url().includes("/api/geometry")),
      pagina
        .locator(".editor-simbolos-toolbar")
        .getByRole("button", { name: "Guardar", exact: true })
        .click(),
    ]);
    const cuerpo = await respuesta.json();

    const problemas = [];
    if (!cuerpo.ok) {
      problemas.push(`el guardado devolvió ok:false — ${JSON.stringify(cuerpo.errores)}`);
    } else {
      const svg = cuerpo.svg ?? "";
      if (svg.includes("<?xml")) problemas.push("el SVG guardado tiene un prólogo <?xml?>");
      if (svg.includes("<!DOCTYPE")) problemas.push("el SVG guardado tiene un <!DOCTYPE>");
      if (svg.includes("Fabric.js")) problemas.push("el SVG guardado tiene el <desc> de Fabric.js");
      if (svg.includes("visibility: hidden") || svg.includes("visibility:hidden")) {
        problemas.push("el SVG guardado tiene marcadores del editor (visibility: hidden)");
      }
      if (svg.includes("(entrada)") || svg.includes("(salida)")) {
        problemas.push("el SVG guardado tiene los rótulos del editor");
      }
    }
    resultado = { ok: problemas.length === 0, problemas };
  } catch (err) {
    resultado = { ok: false, problemas: [`excepción durante la prueba: ${err.message}`] };
  } finally {
    // Dejar el repo tal cual estaba, haya pasado o no la prueba.
    fs.writeFileSync(rutaSvg, svgAntes, "utf8");
    fs.writeFileSync(rutaMeta, metaAntes, "utf8");
    const headDespues = execFileSync("git", ["rev-parse", "HEAD"], { cwd: raizRepo, encoding: "utf8" }).trim();
    if (headDespues !== headAntes) {
      execFileSync("git", ["reset", "--soft", headAntes], { cwd: raizRepo, stdio: "pipe" });
    }
    try {
      execFileSync("git", ["checkout", "HEAD", "--", rutaSvg, rutaMeta], { cwd: raizRepo, stdio: "pipe" });
    } catch { /* si no estaba trackeado con cambios, no hace falta */ }
  }
  return resultado;
}

/**
 * Prueba del punto de conexion (E6): arrastrar un terminal en el editor
 * de geometria y guardar cambiaba solo el dibujo del SVG. NodoSimbolo.tsx
 * arma los handles del diagrama leyendo UNICAMENTE metadata.json, asi que
 * el cable seguia enganchando en la posicion vieja -- el "salto" reportado.
 * Arrastra el terminal "in" de S00110 una distancia EXACTA y alineada a
 * grilla (5 unidades SVG) y verifica que metadata.json quede con esa
 * coordenada nueva, no con la original.
 */
async function probarPuntoConexion() {
  const fs = await import("node:fs");
  const codigoPrueba = "S00110";
  const headAntes = execFileSync("git", ["rev-parse", "HEAD"], { cwd: raizRepo, encoding: "utf8" }).trim();
  const dirSimbolo = fs.readdirSync(path.join(raizRepo, "libreria-simbolos", "simbolos"))
    .find((d) => d.startsWith(codigoPrueba + "_"));
  const rutaSvg = path.join(raizRepo, "libreria-simbolos", "simbolos", dirSimbolo, "simbolo.svg");
  const rutaMeta = path.join(raizRepo, "libreria-simbolos", "simbolos", dirSimbolo, "metadata.json");
  const svgAntes = fs.readFileSync(rutaSvg, "utf8");
  const metaAntes = fs.readFileSync(rutaMeta, "utf8");
  const xOriginal = JSON.parse(metaAntes).puntos_conexion.find((p) => p.id === "in").x;

  let resultado = { ok: false, problemas: ["no se pudo ejecutar la prueba"] };
  try {
    await pagina.locator(`text=${codigoPrueba}`).first().click();
    await pagina.waitForTimeout(500);
    await pagina.getByRole("button", { name: "Editar geometría" }).click();
    await pagina.waitForTimeout(500);

    const zoomTexto = await pagina.locator("text=/%$/").first().textContent();
    const zoom = parseFloat(zoomTexto) / 100;
    const ESCALA_EDICION = 20;
    const DELTA_SVG_UNITS = 5; // alineado a grilla: x*2 debe ser multiplo de 10
    const deltaPx = Math.round(DELTA_SVG_UNITS * ESCALA_EDICION * zoom);

    const caja = await pagina.locator("canvas").first().boundingBox();
    // El terminal "in" de S00110 queda cerca de y=95 en pantalla al zoom
    // por defecto (ver captura de referencia en scratchpad/evidencia-bug).
    const origen = { x: caja.x + caja.width / 2, y: caja.y + 95 };
    await pagina.mouse.move(origen.x, origen.y);
    await pagina.mouse.down();
    await pagina.mouse.move(origen.x + deltaPx, origen.y, { steps: 10 });
    await pagina.mouse.up();
    await pagina.waitForTimeout(200);

    /* El botón se busca DENTRO de la barra del editor de símbolos: la
     * barra superior de la app también tiene un "Guardar" (E79 le sacó
     * el emoji, así que ahora los dos nombres coinciden exactamente y
     * un selector global da strict mode violation). */
    const [respuesta] = await Promise.all([
      pagina.waitForResponse((r) => r.url().includes("/api/geometry")),
      pagina
        .locator(".editor-simbolos-toolbar")
        .getByRole("button", { name: "Guardar", exact: true })
        .click(),
    ]);
    const cuerpo = await respuesta.json();

    const problemas = [];
    if (!cuerpo.ok) {
      problemas.push(`el guardado devolvió ok:false — ${JSON.stringify(cuerpo.errores)}`);
    } else if (!cuerpo.metadata) {
      problemas.push("arrastré el terminal pero la respuesta no trae metadata actualizada");
    } else {
      const puntoIn = cuerpo.metadata.puntos_conexion.find((pt) => pt.id === "in");
      const xEsperado = xOriginal + DELTA_SVG_UNITS;
      if (!puntoIn || Math.abs(puntoIn.x - xEsperado) > 1e-6) {
        problemas.push(
          `metadata.json quedó con x=${puntoIn?.x} para el terminal "in", ` +
          `esperaba ${xEsperado} (original ${xOriginal} + arrastre ${DELTA_SVG_UNITS})`,
        );
      }
      // Confirmar tambien en disco, no solo en la respuesta HTTP.
      const metaDisco = JSON.parse(fs.readFileSync(rutaMeta, "utf8"));
      const puntoDisco = metaDisco.puntos_conexion.find((pt) => pt.id === "in");
      if (!puntoDisco || Math.abs(puntoDisco.x - xEsperado) > 1e-6) {
        problemas.push(`metadata.json en disco no coincide con la respuesta (x=${puntoDisco?.x})`);
      }
    }
    resultado = { ok: problemas.length === 0, problemas };
  } catch (err) {
    resultado = { ok: false, problemas: [`excepción durante la prueba: ${err.message}`] };
  } finally {
    fs.writeFileSync(rutaSvg, svgAntes, "utf8");
    fs.writeFileSync(rutaMeta, metaAntes, "utf8");
    const headDespues = execFileSync("git", ["rev-parse", "HEAD"], { cwd: raizRepo, encoding: "utf8" }).trim();
    if (headDespues !== headAntes) {
      execFileSync("git", ["reset", "--soft", headAntes], { cwd: raizRepo, stdio: "pipe" });
    }
    try {
      execFileSync("git", ["checkout", "HEAD", "--", rutaSvg, rutaMeta], { cwd: raizRepo, stdio: "pipe" });
    } catch { /* si no estaba trackeado con cambios, no hace falta */ }
  }
  return resultado;
}

console.log();
const guardado = await probarGuardadoReal();
if (guardado.ok) {
  console.log("  ✓ guardado real de geometría (S00110): SVG limpio, sin rastros del editor");
} else {
  fallos.push("guardado-geometria");
  for (const p of guardado.problemas) console.log(`  ✗ guardado de geometría: ${p}`);
}

const puntoConexion = await probarPuntoConexion();
if (puntoConexion.ok) {
  console.log("  ✓ arrastrar un terminal actualiza metadata.json (no solo el dibujo)");
} else {
  fallos.push("punto-conexion");
  for (const p of puntoConexion.problemas) console.log(`  ✗ punto de conexión: ${p}`);
}

await navegador.close();

console.log();
if (consola.length) {
  console.log("errores de consola del navegador:");
  for (const e of consola) console.log("  ! " + e);
}
if (fallos.length) {
  console.log(`FALLA: ${fallos.length} símbolos con problemas de render: ${fallos.join(", ")}`);
  process.exit(1);
}
console.log(`OK: ${codigos.length} símbolos renderizan correctamente`);
