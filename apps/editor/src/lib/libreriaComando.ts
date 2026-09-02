import type { ProblemaCarga, SimboloDef } from "./tipos";
import { validarMetadata } from "./validadorMetadata";

/**
 * Librería de comando/control (Paso 3): misma mecánica que libreria.ts,
 * apuntando a libreria-simbolos/comando/ en vez de simbolos/. Sin los
 * hooks de HMR de edición en caliente de libreria.ts — esos símbolos
 * todavía no se editan desde EditorSimbolos (vite.config.ts solo vigila
 * la carpeta "simbolos"), así que un cambio en comando/ dispara un
 * reload normal de Vite en vez de un hot-swap.
 */
const metasRaw = import.meta.glob("../../../../libreria-simbolos/comando/*/metadata.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const svgsRaw = import.meta.glob("../../../../libreria-simbolos/comando/*/simbolo.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function carpetaDe(ruta: string): string | null {
  const m = ruta.match(/[\\/]comando[\\/]([^\\/]+)[\\/][^\\/]+$/);
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

  return { simbolos, problemas };
}

export const LIBRERIA_COMANDO = construir();
export const SIMBOLOS_COMANDO = LIBRERIA_COMANDO.simbolos;
export const PROBLEMAS_LIBRERIA_COMANDO = LIBRERIA_COMANDO.problemas;

export function obtenerSimboloComando(codigo: string): SimboloDef | null {
  return SIMBOLOS_COMANDO.get(codigo) ?? null;
}
