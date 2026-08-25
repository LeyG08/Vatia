#!/usr/bin/env node
/**
 * C22 — Re-segmentación del proyecto PPS real en UN HOJA POR UNIFILAR.
 * El DWG/PDF "Unifilares de Tableros" trae ~30 unifilares distintos
 * (uno por tablero); el JSON anterior los mezclaba como si fueran uno.
 *
 * - La hoja existente conserva su contenido y pasa a ser la hoja 1.
 * - Se agregan las hojas de los demás unifilares detectados en el PDF
 *   (páginas 1–28, encabezados/destinos), VACÍAS y con su nombre, a la
 *   espera de su migración página por página.
 * - Idempotente: si la hoja ya existe (por id o nombre), no se duplica.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = join(
  raiz,
  "apps/editor/ejemplos/proyecto-real-pps.json",
);
const proyecto = JSON.parse(readFileSync(ruta, "utf8"));

/** Unifilar → página del PDF (relevamiento C22). null = sin página asignada aún. */
const UNIFILARES = [
  ["tgbt-g1", "TGBT · TS-G1", "p0"],
  ["ts-g2", "TS-G2", "p2"],
  ["ts-g3", "TS-G3", "p3"],
  ["ts-bc", "TS-BC", "p4"],
  ["ts-cd", "TS-CD", "p5"],
  ["ts-engel", "TS-Engel", "p7"],
  ["ts-nb", "TS-NB", "p8"],
  ["ts-luces-galpon1", "TS-LucesGalpon1", "p9"],
  ["ts-taller-manuel", "TS-TallerManuel", "p10"],
  ["ts-taller-manuel-adentro", "TS-TallerManuelAdentro", "p11"],
  ["ts-matriceria", "TS-Matriceria", "p12"],
  ["ts-tomas-matriceria-1", "TS-TomasMatriceria1", "p13"],
  ["ts-tomas-matriceria-2", "TS-TomasMatriceria2", "p14"],
  ["ts-luces-matriceria", "TS-LucesMatriceria", "p15"],
  ["ts-pet1", "TS-PET1", "p16"],
  ["ts-pet2y3", "TS-PET2y3", "p17"],
  ["ts-sala-maquinas", "TS-SalaMaquinas (frío)", null],
  ["ts-agr", "TS-AGR", "p2"],
  ["ts-pell2-y-inyec2", "TS-Pell2_y_Inyec2", "p2"],
  ["ts-molino-repaso-sopladoras", "TS-MolinoRepasoSopladoras", "p18"],
  ["ts-molinos-repaso45", "TS-MolinosRepaso45", "p19"],
  ["ts-molino-repaso4", "TS-MolinoRepaso4", "p20"],
  ["ts-sopladora1", "TS-Sopladora1", "p21"],
  ["ts-sopladora23", "TS-Sopladora2y3", "p22"],
  ["ts-vf3", "TS-VF3", "p2"],
  ["ts-tg2", "TS-TG2", "p2"],
  ["ts-taller-h", "TS-TallerH", "p2"],
  ["ts-horno", "TS-Horno", "p2"],
  ["ts-taller-s", "TS-TallerS", "p2"],
  ["sf-alimentacion-cd", "SF-AlimentacionCD", "p5"],
];

let numeracion = 2;
const nuevas = [];
for (const [id, nombre, pagina] of UNIFILARES) {
  if (id === "tgbt-g1") continue; // es la hoja existente
  if (proyecto.hojas.some((h) => h.tablero === id || h.nombre === nombre)) {
    continue;
  }
  const seq = String(numeracion++).padStart(4, "0");
  nuevas.push({
    id: `pps-hoja-${seq}`,
    nombre,
    formato: "A3",
    orientacion: "horizontal",
    tablero: id,
    notasGabinete: {
      material: "",
      claseAislacion: "",
      personalApto: "",
      gradoProteccion: "",
      barrasOConductores: "",
      reservaFutura: "",
    },
    notaSeguridad: "",
    rotulo: {
      empresa: "",
      logoTexto: "",
      cliente: "",
      localidad: "",
      denominacion: "",
      claveRepresentado: "",
      nombreArchivo: "",
      toleranciasGenerales: "",
      escala: "",
      metodoIso: "(E)",
      responsables: [
        { rol: "Proyectó", fecha: "", nombre: "" },
        { rol: "Dibujó", fecha: "", nombre: "" },
        { rol: "Revisó", fecha: "", nombre: "" },
        { rol: "Aprobó", fecha: "", nombre: "" },
      ],
    },
    migracion: { fuente: "Unifilares de Tableros.dwg", pagina, estado: pagina ? "pendiente" : "pendiente-sin-pagina" },
    nodos: [],
    conexiones: [],
    viewport: { x: -300, y: -40, zoom: 1.5 },
  });
}

// La hoja existente se marca con su fuente de migración
if (!proyecto.hojas[0].migracion) {
  proyecto.hojas[0].migracion = {
    fuente: "Unifilares de Tableros.dwg",
    pagina: "p0",
    estado: "parcial",
  };
}
// C22: la primera hoja era TGBT/TS-G1 — el nombre viejo
// "TS-Pell1_y_Molino1" venía de tomar un DESTINO como si fuera el título.
if (
  !proyecto.hojas[0].tablero ||
  proyecto.hojas[0].tablero === "TS-Pell1_y_Molino1"
) {
  proyecto.hojas[0].tablero = "tgbt-g1";
  proyecto.hojas[0].nombre = "TGBT · TS-G1";
}

proyecto.hojas.push(...nuevas);
proyecto.meta.ultimaModificacion = new Date().toISOString();

writeFileSync(ruta, JSON.stringify(proyecto, null, 2) + "\n");
console.log(
  `OK: ${proyecto.hojas.length} hojas (${nuevas.length} nuevas vacías por unifilar)` ,
);
for (const h of proyecto.hojas) {
  console.log(
    `  ${h.tablero.padEnd(26)} ${h.nodos.length} nodos · ${
      h.migracion?.estado ?? "-"
    }`,
  );
}
