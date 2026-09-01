#!/usr/bin/env python3
"""Genera los tipos TypeScript de las fichas tecnicas desde los JSON Schemas.

Por que existe
--------------
Los atributos electricos viajan por todo el editor como
`Record<string, unknown>`: la ficha entera es una bolsa sin tipo, validada solo
en runtime contra el schema. Eso obliga a un `typeof x === "number"` defensivo
en cada uso y, sobre todo, deja al futuro motor de calculo sin ninguna red: un
`a.in_a` mal escrito no falla, devuelve undefined.

Este script deriva los tipos del MISMO schema que ya gobierna los formularios,
de modo que no puedan desincronizarse. La salida se commitea (para que el editor
compile sin correr Python) y la CI verifica que este al dia.

Todos los campos salen OPCIONALES salvo el discriminante `tipo_aparato`. No es
descuido: en el editor la ficha se completa de a poco, asi que un aparato recien
puesto en el plano tiene los atributos vacios. La obligatoriedad la sigue
llevando `x-obligatorio`, que el Checklist AEA reporta sin bloquear.

Uso:  python scripts/generar_tipos_atributos.py [--raiz RUTA] [--verificar]

Con --verificar no escribe: falla si el archivo generado difiere del que
corresponde a los schemas actuales. Es lo que corre la CI.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

CABECERA = """// ARCHIVO GENERADO por scripts/generar_tipos_atributos.py — NO editar a mano.
// Se deriva de libreria-simbolos/schemas/*.json. Para cambiar un campo, tocá
// el schema y volvé a correr el script; la CI verifica que estén sincronizados.
//
// Todos los campos son opcionales salvo el discriminante `tipo_aparato`: en el
// editor la ficha se completa de a poco, así que un aparato recién puesto en el
// plano tiene los atributos vacíos. La obligatoriedad la lleva `x-obligatorio`,
// que el Checklist AEA reporta sin bloquear.

"""


def pascal(nombre: str) -> str:
    return "".join(p.capitalize() for p in nombre.split("_"))


def tipo_ts(campo: dict) -> str:
    if "const" in campo:
        return json.dumps(campo["const"])
    if "enum" in campo:
        return " | ".join(json.dumps(v) for v in campo["enum"])
    t = campo.get("type")
    if t in ("number", "integer"):
        return "number"
    if t == "boolean":
        return "boolean"
    if t == "string":
        return "string"
    return "unknown"


def propiedades_de(raiz: dict, definicion: dict) -> dict:
    """Resuelve allOf/$ref igual que lib/esquemas.ts, para no divergir."""
    props: dict = {}
    for rama in definicion.get("allOf", []):
        ref = rama.get("$ref")
        if not ref:
            continue
        props.update(propiedades_de(raiz, raiz["$defs"][ref.replace("#/$defs/", "")]))
    props.update(definicion.get("properties", {}))
    return props


def bloque(nombre_ts: str, props: dict, doc: str | None, discriminante: str | None) -> str:
    lineas = []
    if doc:
        lineas.append(f"/** {doc.strip()} */")
    lineas.append(f"export interface {nombre_ts} {{")
    for campo, esquema in props.items():
        titulo = esquema.get("title")
        if titulo:
            lineas.append(f"  /** {titulo} */")
        obligatorio = campo == discriminante
        lineas.append(f"  {campo}{'' if obligatorio else '?'}: {tipo_ts(esquema)};")
    lineas.append("}")
    return "\n".join(lineas)


def generar(raiz: Path) -> str:
    esquemas = raiz / "libreria-simbolos" / "schemas"
    aparato = json.loads((esquemas / "aparato.schema.json").read_text(encoding="utf-8"))

    partes = [CABECERA.rstrip("\n"), ""]

    subtipos = [k for k in aparato["$defs"] if k != "base_comun"]
    partes.append("/** Discriminante de la familia `aparato`. */")
    partes.append("export type TipoAparato =\n  | "
                  + "\n  | ".join(json.dumps(s) for s in sorted(subtipos))
                  + ";")
    partes.append("")

    nombres = []
    for sub in sorted(subtipos):
        definicion = aparato["$defs"][sub]
        props = propiedades_de(aparato, definicion)
        nombre_ts = "Aparato" + pascal(sub)
        nombres.append(nombre_ts)
        partes.append(bloque(nombre_ts, props, definicion.get("description"), "tipo_aparato"))
        partes.append("")

    partes.append("/** Ficha de un aparato, discriminada por `tipo_aparato`. */")
    partes.append("export type AtributosAparato =\n  | " + "\n  | ".join(nombres) + ";")
    partes.append("")

    for archivo, nombre_ts in (
        ("conductor.schema.json", "AtributosConductor"),
        ("barra.schema.json", "AtributosBarra"),
        ("carga.schema.json", "AtributosCarga"),
    ):
        esquema = json.loads((esquemas / archivo).read_text(encoding="utf-8"))
        partes.append(bloque(nombre_ts, esquema.get("properties", {}),
                             esquema.get("description"), None))
        partes.append("")

    partes.append("/** Cualquier ficha técnica de la librería. */")
    partes.append("export type AtributosFicha =\n  | AtributosAparato\n"
                  "  | AtributosConductor\n  | AtributosBarra\n  | AtributosCarga;")
    partes.append("")
    return "\n".join(partes)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raiz", type=Path, default=Path(__file__).resolve().parent.parent)
    ap.add_argument("--verificar", action="store_true",
                    help="no escribe; falla si el archivo generado esta desactualizado")
    args = ap.parse_args()

    destino = args.raiz / "apps" / "editor" / "src" / "lib" / "tiposAtributos.ts"
    contenido = generar(args.raiz)

    if args.verificar:
        actual = destino.read_text(encoding="utf-8") if destino.is_file() else ""
        if actual != contenido:
            print("FALLA: tiposAtributos.ts esta desactualizado respecto de los schemas.")
            print("Corre: python scripts/generar_tipos_atributos.py")
            return 1
        print("OK: tiposAtributos.ts sincronizado con los schemas")
        return 0

    destino.write_text(contenido, encoding="utf-8")
    n = contenido.count("export interface")
    print(f"{destino.relative_to(args.raiz)}: {n} interfaces generadas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
