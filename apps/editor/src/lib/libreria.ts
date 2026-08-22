import type { ProblemaCarga, SimboloDef } from "./tipos";
import { validarMetadata } from "./validadorMetadata";

const metasRaw = import.meta.glob("../../../../libreria-simbolos/simbolos/*/metadata.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const svgsRaw = import.meta.glob("../../../../libreria-simbolos/simbolos/*/simbolo.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function carpetaDe(ruta: string): string | null {
  const m = ruta.match(/[\\/]simbolos[\\/]([^\\/]+)[\\/][^\\/]+$/);
  return m ? m[1] : null;
}

function parsearViewBox(svg: string): SimboloDef["viewBox"] {
  const m = svg.match(/viewBox\s*=\s*"([^"]+)"/);
  if (m) {
    const v = m[1].trim().split(/[\s,]+/).map(Number);
    if (v.length === 4 && v.every((n) => Number.isFinite(n))) {
      return { minX: v[0], minY: v[1], ancho: v[2], alto: v[3] };
    }
  }
  return { minX: 0, minY: 0, ancho: 100, alto: 100 };
}

function construir(): { simbolos: Map<string, SimboloDef>; problemas: ProblemaCarga[] } {
  const simbolos = new Map<string, SimboloDef>();
  const problemas: ProblemaCarga[] = [];

  for (const [ruta, texto] of Object.entries(metasRaw)) {
    const carpeta = carpetaDe(ruta);
    if (!carpeta) continue;

    let datos: unknown;
    try {
      datos = JSON.parse(texto);
    } catch (e) {
      problemas.push({
        nivel: "error",
        mensaje: `${carpeta}: metadata.json no parsea como JSON (${String(e)})`,
      });
      continue;
    }

    const errores = validarMetadata(datos);
    if (errores.length > 0) {
      problemas.push({
        nivel: "error",
        mensaje: `${carpeta}: metadata inválido — ${errores.join("; ")}`,
      });
      continue;
    }

    const svgRuta = Object.keys(svgsRaw).find(
      (r) => carpetaDe(r) === carpeta,
    );
    if (!svgRuta) {
      problemas.push({
        nivel: "error",
        mensaje: `${carpeta}: falta simbolo.svg`,
      });
      continue;
    }

    const meta = datos as SimboloDef["metadata"];
    if (simbolos.has(meta.codigo_iec)) {
      problemas.push({
        nivel: "aviso",
        mensaje: `${carpeta}: código duplicado ${meta.codigo_iec} (se ignora esta copia)`,
      });
      continue;
    }

    simbolos.set(meta.codigo_iec, {
      codigo_iec: meta.codigo_iec,
      metadata: meta,
      svgRaw: svgsRaw[svgRuta],
      viewBox: parsearViewBox(svgsRaw[svgRuta]),
    });
  }

  for (const [ruta] of Object.entries(svgsRaw)) {
    const carpeta = carpetaDe(ruta);
    if (carpeta && !Object.keys(metasRaw).some((r) => carpetaDe(r) === carpeta)) {
      problemas.push({
        nivel: "aviso",
        mensaje: `${carpeta}: tiene simbolo.svg pero falta metadata.json`,
      });
    }
  }

  return { simbolos, problemas };
}

export const LIBRERIA = construir();
export const SIMBOLOS = LIBRERIA.simbolos;
export const PROBLEMAS_LIBRERIA = LIBRERIA.problemas;

export function obtenerSimbolo(codigo: string): SimboloDef | null {
  return SIMBOLOS.get(codigo) ?? null;
}

export function svgLimpio(svg: string): string {
  return svg.replace(/<\?xml[\s\S]*?\?>/g, "").trim();
}
