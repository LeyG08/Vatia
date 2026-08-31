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
import xml.etree.ElementTree as ET
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


# ---------------------------------------------------------------------------
# Integridad del SVG
#
# El lint de grilla valida el viewBox y el metadata, pero no miraba el dibujo.
# Por eso un guardado defectuoso del editor de símbolos pudo escribir dentro de
# simbolo.svg las coordenadas de canvas de Fabric, dejar el archivo con XML
# inválido y filtrar los marcadores del editor, y aun así pasar el hook
# pre-commit (caso S00110, commit f5d901e). Estas comprobaciones cierran ese
# hueco: el archivo tiene que ser XML válido, no contener rastros del editor y
# dibujar dentro de su propio viewBox.
# ---------------------------------------------------------------------------

# Margen en unidades de viewBox: media pincelada de trazo grueso más redondeo.
TOLERANCIA_VIEWBOX = 1.0

RASTROS_EDITOR = (
    ("Created with Fabric.js", "quedó el <desc> del editor Fabric.js"),
    ("visibility: hidden", "quedaron elementos ocultos del editor"),
    ("visibility:hidden", "quedaron elementos ocultos del editor"),
    ("(entrada)", "quedó el rótulo 'in (entrada)' del editor"),
    ("(salida)", "quedó el rótulo 'out (salida)' del editor"),
)

_NUM = re.compile(r"-?\d+\.?\d*(?:[eE][-+]?\d+)?")
_NS = re.compile(r"\{.*?\}")

IDENTIDAD = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def _componer(m, n):
    """Producto de dos matrices afines SVG (a, b, c, d, e, f)."""
    a, b, c, d, e, f = m
    return (
        a * n[0] + c * n[1],
        b * n[0] + d * n[1],
        a * n[2] + c * n[3],
        b * n[2] + d * n[3],
        a * n[4] + c * n[5] + e,
        b * n[4] + d * n[5] + f,
    )


def _matriz(transform: str):
    """Matriz local de un atributo transform.

    Soporta matrix(), translate() y scale(), que es lo que emiten tanto
    convertir_qet.py como Fabric.js.
    """
    m = IDENTIDAD
    for nombre, args in re.findall(r"(matrix|translate|scale)\s*\(([^)]*)\)", transform or ""):
        v = [float(n) for n in _NUM.findall(args)]
        if nombre == "matrix" and len(v) == 6:
            local = tuple(v)
        elif nombre == "translate" and v:
            local = (1.0, 0.0, 0.0, 1.0, v[0], v[1] if len(v) > 1 else 0.0)
        elif nombre == "scale" and v:
            sx = v[0]
            sy = v[1] if len(v) > 1 else sx
            local = (sx, 0.0, 0.0, sy, 0.0, 0.0)
        else:
            continue
        m = _componer(m, local)
    return m


def _extremos_de(el, m):
    """Puntos extremos que dibuja un elemento, ya transformados."""
    tag = _NS.sub("", el.tag)

    def num(clave, defecto=0.0):
        try:
            return float(el.attrib.get(clave, defecto))
        except (TypeError, ValueError):
            return defecto

    if tag == "line":
        crudos = [(num("x1"), num("y1")), (num("x2"), num("y2"))]
    elif tag in ("polyline", "polygon"):
        v = [float(n) for n in _NUM.findall(el.attrib.get("points", ""))]
        crudos = list(zip(v[0::2], v[1::2]))
    elif tag == "circle":
        cx, cy, r = num("cx"), num("cy"), num("r")
        crudos = [(cx - r, cy - r), (cx + r, cy + r)]
    elif tag == "ellipse":
        cx, cy, rx, ry = num("cx"), num("cy"), num("rx"), num("ry")
        crudos = [(cx - rx, cy - ry), (cx + rx, cy + ry)]
    elif tag == "rect":
        x, y = num("x"), num("y")
        crudos = [(x, y), (x + num("width"), y + num("height"))]
    else:
        return []

    a, b, c, d, e, f = m
    return [(a * x + c * y + e, b * x + d * y + f) for x, y in crudos]


def _recorrer(el, m, acumulador):
    m = _componer(m, _matriz(el.attrib.get("transform", "")))
    acumulador.extend(_extremos_de(el, m))
    for hijo in el:
        _recorrer(hijo, m, acumulador)


def validar_integridad(nombre: str, svg: str) -> tuple[list[str], object]:
    """Errores de integridad del archivo + raíz XML parseada (None si falla)."""
    errores: list[str] = []

    try:
        raiz = ET.fromstring(svg)
    except ET.ParseError as exc:
        return [f"{nombre}: simbolo.svg no es XML válido ({exc})"], None

    # El prólogo XML y el DOCTYPE solo son válidos ANTES de la raíz. Fabric.js
    # los emite en su serialización y un guardado ingenuo los pega adentro.
    cuerpo = svg[svg.find("<svg") + 1:] if "<svg" in svg else svg
    if "<?xml" in cuerpo:
        errores.append(f"{nombre}: hay un prólogo <?xml?> después de la etiqueta <svg>")
    if "<!DOCTYPE" in cuerpo:
        errores.append(f"{nombre}: hay un <!DOCTYPE> después de la etiqueta <svg>")

    for marca, explicacion in RASTROS_EDITOR:
        if marca in svg:
            errores.append(f"{nombre}: rastro del editor en el archivo — {explicacion}")
            break

    # Ojo: NO se rechaza <text> en general. Varios símbolos llevan letras que
    # son parte de la norma IEC 60617 y no anotación del editor: "V" en el
    # voltímetro (S00132), "U<>" en el relé de tensión (S00129) y "M 3~" en el
    # motor (S00115). Los rótulos que sí sobran son los del editor, y esos ya
    # los detecta RASTROS_EDITOR por su contenido.

    return errores, raiz


def validar_geometria(nombre: str, raiz, vb) -> list[str]:
    """Comprueba que todo lo dibujado caiga dentro del viewBox."""
    vx, vy, vw, vh = vb
    puntos: list[tuple[float, float]] = []
    _recorrer(raiz, IDENTIDAD, puntos)

    if not puntos:
        return [f"{nombre}: el SVG no dibuja ninguna primitiva reconocible"]

    xs = [p[0] for p in puntos]
    ys = [p[1] for p in puntos]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    t = TOLERANCIA_VIEWBOX

    if x0 < vx - t or x1 > vx + vw + t or y0 < vy - t or y1 > vy + vh + t:
        return [
            f"{nombre}: la geometría se sale del viewBox — dibuja "
            f"({x0:g},{y0:g})–({x1:g},{y1:g}) y el viewBox es "
            f"({vx:g},{vy:g})–({vx + vw:g},{vy + vh:g}). "
            f"Suele ser un guardado del editor con coordenadas de canvas."
        ]
    return []


def lintear_carpeta(carpeta: Path, escala: int) -> list[str]:
    """Devuelve la lista de errores de alineación de un símbolo."""
    errores: list[str] = []
    ruta_svg = carpeta / "simbolo.svg"
    ruta_meta = carpeta / "metadata.json"
    if not ruta_svg.is_file() or not ruta_meta.is_file():
        return [f"{carpeta.name}: falta simbolo.svg o metadata.json"]

    svg = ruta_svg.read_text(encoding="utf-8")

    errores_integridad, raiz_xml = validar_integridad(carpeta.name, svg)
    if raiz_xml is None:
        # Sin XML válido no se puede seguir: todo lo demás daría ruido.
        return errores_integridad
    errores.extend(errores_integridad)

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

    errores.extend(validar_geometria(carpeta.name, raiz_xml, (vx, vy, vw, vh)))

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
