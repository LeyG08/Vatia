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

  const totalMeta = Object.keys(metasRaw).length;
  const totalSvg = Object.keys(svgsRaw).length;
  if (simbolos.size < totalMeta) {
    problemas.push({
      nivel: "aviso",
      mensaje: `Carga: ${simbolos.size}/${totalMeta} metadata leídos, ${totalSvg} SVGs. Si faltan símbolos, reiniciá el dev server (import.meta.glob eager cache).`,
    });
  }

  return { simbolos, problemas };
}

export const LIBRERIA = construir();
export const SIMBOLOS = LIBRERIA.simbolos;
export const PROBLEMAS_LIBRERIA = LIBRERIA.problemas;

/* HMR: cuando Vite detecta create/delete de archivos que matchean los
 * globs (metadata.json / simbolo.svg), re-transforma este módulo.
 * El accept() actualiza los exports en caliente sin full page reload. */
if (import.meta.hot) {
  import.meta.hot.on("metadata-update", ({ codigo, metadata }: { codigo: string; metadata: any }) => {
    const prev = SIMBOLOS.get(codigo);
    if (prev) prev.metadata = metadata;
    window.dispatchEvent(
      new CustomEvent("vatia:metadata-update", { detail: { codigo, metadata } }),
    );
  });
  import.meta.hot.accept((mod) => {
    if (mod) {
      SIMBOLOS.clear();
      for (const [k, v] of mod.SIMBOLOS) SIMBOLOS.set(k, v);
      PROBLEMAS_LIBRERIA.length = 0;
      PROBLEMAS_LIBRERIA.push(...mod.PROBLEMAS_LIBRERIA);
    }
  });
}

export function obtenerSimbolo(codigo: string): SimboloDef | null {
  return SIMBOLOS.get(codigo) ?? null;
}

export function svgLimpio(svg: string): string {
  let s = svg.replace(/<\?xml[\s\S]*?\?>/g, "").trim();
  /* Reemplazar negro hardcodeado por currentColor para que los símbolos
   * se adapten al tema (claro/oscuro). Los fill/stroke de los puntos
   * de conexión (#e11d48) se preservan. */
  s = s.replace(/stroke="#000000"/g, 'stroke="currentColor"');
  s = s.replace(/fill="#000000"/g, 'fill="currentColor"');
  s = s.replace(/stroke="#000"/g, 'stroke="currentColor"');
  s = s.replace(/fill="#000"/g, 'fill="currentColor"');
  return s;
}
