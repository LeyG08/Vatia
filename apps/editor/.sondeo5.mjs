import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) console.log(`[consola:${m.type()}]`, m.text().slice(0, 200));
});
await page.goto(process.env.URL ?? "http://localhost:4173/");
await page.setInputFiles('input[type="file"]', "E:/Vatia/apps/editor/ejemplos/proyecto-real-pps.json");
await page.waitForSelector('.react-flow__node[data-id="n1"]', { timeout: 10000 });
await page.waitForTimeout(800);
const s = await page.evaluate(() => ({
  nodos: document.querySelectorAll(".react-flow__node").length,
  edges: document.querySelectorAll(".react-flow__edge").length,
  paths: document.querySelectorAll(".react-flow__edge-path").length,
  handles: document.querySelectorAll(".react-flow__handle").length,
  h410a: !!document.querySelector('.react-flow__handle[data-nodeid="n1"][data-handleid="410a"]'),
  transform: document.querySelector(".react-flow__viewport")?.getAttribute("style"),
  clasesRaiz: document.querySelector(".react-flow")?.getAttribute("class"),
}));
console.log(JSON.stringify(s, null, 1));
await browser.close();
