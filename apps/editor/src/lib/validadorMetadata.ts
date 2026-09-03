import type { MetadataSimbolo } from "./tipos";

const FAMILIAS = ["aparato", "conductor", "barra", "carga", "sin_ficha_tecnica"];
const ESTADOS = ["pendiente_revision", "verificado", "corregido"];
const ROLES = ["entrada", "salida", "tierra", "auxiliar"];

export function validarMetadata(d: unknown): string[] {
  const errores: string[] = [];
  if (typeof d !== "object" || d === null) {
    return ["el metadata no es un objeto JSON válido"];
  }
  const m = d as Record<string, unknown>;

  if (
    typeof m.codigo_iec !== "string" ||
    !/^S[0-9]{5}$/.test(m.codigo_iec)
  ) {
    errores.push(`codigo_iec inválido: ${JSON.stringify(m.codigo_iec)}`);
  }
  if (typeof m.nombre !== "string" || m.nombre.trim() === "") {
    errores.push("nombre ausente o vacío");
  }
  if (!FAMILIAS.includes(m.familia_atributos as string)) {
    errores.push(
      `familia_atributos inválida: ${JSON.stringify(m.familia_atributos)}`,
    );
  }
  if (!ESTADOS.includes(m.estado_revision as string)) {
    errores.push(
      `estado_revision inválido: ${JSON.stringify(m.estado_revision)}`,
    );
  }
  if (!Array.isArray(m.puntos_conexion) || m.puntos_conexion.length === 0) {
    errores.push("puntos_conexion ausente o vacío");
  } else {
    m.puntos_conexion.forEach((p, i) => {
      const pc = p as Record<string, unknown>;
      if (typeof pc.id !== "string" || pc.id === "") {
        errores.push(`puntos_conexion[${i}].id inválido`);
      }
      if (!ROLES.includes(pc.rol as string)) {
        errores.push(`puntos_conexion[${i}].rol inválido: ${String(pc.rol)}`);
      }
      if (typeof pc.x !== "number" || !Number.isFinite(pc.x)) {
        errores.push(`puntos_conexion[${i}].x no es numérico`);
      }
      if (typeof pc.y !== "number" || !Number.isFinite(pc.y)) {
        errores.push(`puntos_conexion[${i}].y no es numérico`);
      }
    });
  }
  return errores;
}

export function esMetadataValida(d: unknown): d is MetadataSimbolo {
  return validarMetadata(d).length === 0;
}
