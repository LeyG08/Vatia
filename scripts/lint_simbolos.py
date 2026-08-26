#!/usr/bin/env python3
"""Lint de grilla para la librería de símbolos de Vatia.

Un símbolo se considera ALINEADO A GRILLA si, al colocarlo en el editor
con la posición snapeada a múltiplos de 10 px, sus puntos de conexión y
sus trazos caen exactos sobre la grilla (sin medios píxeles ni líneas
borrosas por antialiasing). Eso exige:

  1. viewBox con ancho y alto ENTEROS PARES.
  2. Cada punto_conexion: x*ESCALA e y*ESCALA múltiplos enteros de 10.
  3. Cada punto_conexion respecto del origen del viewBox:
     (x-minX)*ESCALA y (y-minY)*ESCALA también múltiplos de 10.
     (Esta es la que gobierna dónde cae el handle en el canvas.)
  4. Los puntos dentro del viewBox.

Uso:
  python scripts/lint_simbolos.py [--raiz E:\\Vatia] [--escala 4] [--symbol S00110]

La ESCALA se lee automáticamente de apps/editor/src/lib/store.ts; el
parámetro --escala la fuerza a mano. Con --symbol se valida un solo
símbolo (útil para validación antes de guardar desde el editor).
Exit code 1 si hay errores.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

MULTIPLO = 10.0


def escala_desde_store(raiz: Path) -> int | None:
    fuente = raiz / "apps" / "editor" / "src" / "lib" / "store.ts"
    if not fuente.is_file():
        return None
    m = re.search(r"const\s+ESCALA\s*=\s*(\d+)", fuente.read_text(encoding="utf-8"))
    return int(m.group(1)) if m else None


def es_multiplo(valor: float, escala: int) -> bool:
    producto = valor * escala
    return abs(producto / MULTIPLO - round(producto / MULTIPLO)) < 1e-6


def lintear_carpeta(carpeta: Path, escala: int) -> list[str]:
    """Devuelve la lista de errores de alineación de un símbolo."""
    errores: list[str] = []
    ruta_svg = carpeta / "simbolo.svg"
    ruta_meta = carpeta / "metadata.json"
    if not ruta_svg.is_file() or not ruta_meta.is_file():
        return [f"{carpeta.name}: falta simbolo.svg o metadata.json"]

    svg = ruta_svg.read_text(encoding="utf-8")
    m = re.search(r'viewBox\s*=\s*"([^"]+)"', svg)
    if not m:
        return [f"{carpeta.name}: simbolo.svg sin viewBox"]
    vb = [float(v) for v in m.group(1).split()]
    if len(vb) != 4:
        return [f"{carpeta.name}: viewBox no tiene 4 números"]
    vx, vy, vw, vh = vb

    if vw != int(vw) or vh != int(vh):
        errores.append(f"{carpeta.name}: viewBox ancho/alto no enteros ({vw}x{vh})")
    elif int(vw) % 2 != 0 or int(vh) % 2 != 0:
        errores.append(f"{carpeta.name}: viewBox ancho/alto impar ({int(vw)}x{int(vh)})")

    datos = json.loads(ruta_meta.read_text(encoding="utf-8"))
    for pc in datos.get("puntos_conexion", []):
        px, py, pid = float(pc["x"]), float(pc["y"]), pc["id"]

        if not es_multiplo(px, escala):
            errores.append(
                f"{carpeta.name}: punto '{pid}' x={px} → {px}*{escala}={px * escala} "
                f"no es múltiplo de {MULTIPLO:.0f}"
            )
        if not es_multiplo(py, escala):
            errores.append(
                f"{carpeta.name}: punto '{pid}' y={py} → {py}*{escala}={py * escala} "
                f"no es múltiplo de {MULTIPLO:.0f}"
            )

        dx, dy = px - vx, py - vy
        if not es_multiplo(dx, escala):
            errores.append(
                f"{carpeta.name}: punto '{pid}' delta x ({dx} desde minX={vx}) → "
                f"{dx}*{escala}={dx * escala} no es múltiplo de {MULTIPLO:.0f} "
                f"(el handle quedaría fuera de grilla)"
            )
        if not es_multiplo(dy, escala):
            errores.append(
                f"{carpeta.name}: punto '{pid}' delta y ({dy} desde minY={vy}) → "
                f"{dy}*{escala}={dy * escala} no es múltiplo de {MULTIPLO:.0f} "
                f"(el handle quedaría fuera de grilla)"
            )

        # Al rotar 180° el punto se espeja dentro de la caja: la dimensión
        # menos el delta también debe caer en retícula. Con deltas en
        # retícula, esto equivale a exigir dimensiones múltiplos de 10.
        if vw - dx != round(vw - dx) or not es_multiplo(vw - dx, escala):
            errores.append(
                f"{carpeta.name}: punto '{pid}' con rotación 180/270° cae fuera de "
                f"grilla: ancho {vw} - delta {dx} = {vw - dx} no cumple retícula "
                f"(usar ancho múltiplo de 10)"
            )
        if vh - dy != round(vh - dy) or not es_multiplo(vh - dy, escala):
            errores.append(
                f"{carpeta.name}: punto '{pid}' con rotación 180/270° cae fuera de "
                f"grilla: alto {vh} - delta {dy} = {vh - dy} no cumple retícula "
                f"(usar alto múltiplo de 10)"
            )

        if not (vx <= px <= vx + vw and vy <= py <= vy + vh):
            errores.append(f"{carpeta.name}: punto '{pid}' fuera del viewBox")

    return errores


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    raiz_script = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raiz", type=Path, default=raiz_script)
    parser.add_argument("--escala", type=int, default=None,
                        help="fuerza la ESCALA (por defecto se lee de store.ts)")
    parser.add_argument("--symbol", type=str, default=None,
                        help="valida un solo símbolo (ej. S00110)")
    args = parser.parse_args()

    escala = args.escala or escala_desde_store(args.raiz)
    if escala is None:
        print("aviso: no pude leer ESCALA de store.ts; uso 2", file=sys.stderr)
        escala = 2

    libreria = args.raiz / "libreria-simbolos" / "simbolos"
    carpetas = sorted(c for c in libreria.iterdir() if c.is_dir()) if libreria.is_dir() else []

    if args.symbol:
        carpetas = [c for c in carpetas if c.name.startswith(args.symbol + "_")]
        if not carpetas:
            print(f"error: símbolo {args.symbol} no encontrado en {libreria}")
            return 1

    if not carpetas:
        print(f"error: no encontré símbolos en {libreria}")
        return 1

    print(f"Lint de grilla · ESCALA={escala} · grilla {MULTIPLO:.0f}px · {len(carpetas)} símbolos\n")
    total_errores = 0
    for carpeta in carpetas:
        errores = lintear_carpeta(carpeta, escala)
        if errores:
            total_errores += len(errores)
            for e in errores:
                print(f"  ✗ {e}")
        else:
            meta = json.loads((carpeta / "metadata.json").read_text(encoding="utf-8"))
            print(f"  ✓ {carpeta.name} ({len(meta.get('puntos_conexion', []))} puntos)")

    print()
    if total_errores:
        print(f"FALLA: {total_errores} errores de alineación")
        return 1
    print("OK: todos los símbolos alineados a grilla")
    return 0


if __name__ == "__main__":
    sys.exit(main())
