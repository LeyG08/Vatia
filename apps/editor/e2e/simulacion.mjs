/* Verificación de E78 contra el motor real (lib/simulacion.ts servido por
 * Vite en dev): llave selectora que elige entre dos bobinas de contactor,
 * y lámpara piloto que ya no enciende con un solo cable a la fase. */
import { chromium } from "playwright";

const URL_DEV = process.env.URL ?? "http://localhost:5173/";
let fallos = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const mal = (m) => { fallos++; console.log(`  ✗ ${m}`); };

const navegador = await chromium.launch();
const page = await navegador.newPage();
await page.goto(URL_DEV, { waitUntil: "networkidle" });

const salida = await page.evaluate(async () => {
  const { simular } = await import("/src/lib/simulacion.ts");

  const nodo = (id, atributos, tipo = "simbolo") => ({
    id, tipo, posicion: { x: 0, y: 0 }, atributos,
  });
  const cable = (id, desde, hasta) => ({ id, desde, hasta });

  // Hoja de comando: L ── selector(com) ─┬ pos1 → bobina KM1 → N
  //                                      └ pos2 → bobina KM2 → N
  // Además: lámpara piloto H1 con UN solo cable a L (no debe encender)
  // y lámpara H2 bien cableada entre L y N (debe encender).
  const hoja = {
    id: "h1", nombre: "Comando", nodos: [], conexiones: [],
  };
  hoja.nodos = [
    nodo("L", { funcion_riel: "fase_viva" }, "barra"),
    nodo("N", { funcion_riel: "neutro" }, "barra"),
    nodo("SA1", { tipo_aparato: "selector", referencia: "S1" }),
    nodo("K1", { tipo_aparato: "rele_auxiliar", referencia: "KM1" }),
    nodo("K2", { tipo_aparato: "rele_auxiliar", referencia: "KM2" }),
    nodo("H1", { tipo_aparato: "lampara_piloto", referencia: "H1" }),
    nodo("H2", { tipo_aparato: "lampara_piloto", referencia: "H2" }),
  ];
  hoja.conexiones = [
    cable("c1", "L.a1", "SA1.com"),
    cable("c2", "SA1.pos1", "K1.in"),
    cable("c3", "K1.out", "N.b1"),
    cable("c4", "SA1.pos2", "K2.in"),
    cable("c5", "K2.out", "N.b2"),
    cable("c6", "L.a2", "H1.t1"),          // solo fase: no debe encender
    cable("c7", "L.a3", "H2.t1"),
    cable("c8", "H2.t2", "N.b3"),
  ];

  // Hoja de fuerza: el contactor KM1 con sus polos (debe cerrar cuando
  // se energiza la bobina KM1 de la hoja de comando).
  const fuerza = {
    id: "h2", nombre: "Fuerza",
    nodos: [
      nodo("A", {}, "alimentador"),
      nodo("KM1p", { tipo_aparato: "contactor", referencia: "KM1" }),
      nodo("M1", { tipo_aparato: "motor_trifasico", referencia: "M1" }),
    ],
    conexiones: [
      cable("f1", "A.out", "KM1p.in1"),
      cable("f2", "KM1p.out1", "M1.t1"),
    ],
  };

  const proyecto = { hojas: [hoja, fuerza], datosProyecto: {} };

  const leer = (r) => ({
    KM1: r.aparatos.get("h1:K1"),
    KM2: r.aparatos.get("h1:K2"),
    H1: r.aparatos.get("h1:H1"),
    H2: r.aparatos.get("h1:H2"),
    poloKM1: r.aparatos.get("h2:KM1p"),
    motor: r.aparatos.get("h2:M1"),
    bobinas: [...r.bobinasEnergizadas],
    estable: r.estable,
  });

  const pos1 = simular(proyecto, new Set(), new Set(), new Map());
  const r1 = leer(pos1);
  const pos2 = simular(proyecto, new Set(), pos1.bobinasEnergizadas, new Map([["h1:SA1", 2]]));
  const r2 = leer(pos2);
  const vuelta1 = leer(simular(proyecto, new Set(), pos2.bobinasEnergizadas, new Map([["h1:SA1", 1]])));
  return { r1, r2, vuelta1 };
});

console.log("Posición 1:", JSON.stringify(salida.r1));
console.log("Posición 2:", JSON.stringify(salida.r2));
console.log("Vuelta a 1:", JSON.stringify(salida.vuelta1));

const { r1, r2, vuelta1 } = salida;
function comprobar(condicion, bien, mal_) {
  if (condicion) ok(bien);
  else mal(mal_);
}

comprobar(r1.KM1 === true, "pos 1: bobina KM1 energizada", "pos 1: KM1 debería estar energizada");
comprobar(r1.KM2 === false, "pos 1: bobina KM2 apagada", "pos 1: KM2 no debería energizarse");
comprobar(r1.poloKM1 === true, "pos 1: el polo del contactor KM1 (hoja fuerza) cierra", "pos 1: el polo de KM1 debería cerrar");
comprobar(r1.motor === true, "pos 1: el motor recibe tensión", "pos 1: el motor debería recibir tensión");
comprobar(r2.KM2 === true, "pos 2: bobina KM2 energizada", "pos 2: KM2 debería estar energizada");
comprobar(r2.KM1 === false, "pos 2: bobina KM1 se apaga", "pos 2: KM1 debería apagarse");
comprobar(r2.poloKM1 === false, "pos 2: el polo de KM1 abre", "pos 2: el polo de KM1 debería abrir");
comprobar(vuelta1.KM1 === true && vuelta1.KM2 === false, "vuelve a la posición 1 correctamente", "volver a pos 1 no restauró KM1");
comprobar(r1.H1 === false, "lámpara con un solo cable a la fase: apagada", "H1 no debería encender con un solo cable");
comprobar(r1.H2 === true, "lámpara entre fase y neutro: encendida", "H2 debería encender");
comprobar(r1.estable === true, "punto fijo estable", "la simulación no convergió");

await navegador.close();
console.log(fallos === 0 ? "\nTodo OK" : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
