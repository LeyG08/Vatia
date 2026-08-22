#!/usr/bin/env python3
"""Convierte elementos .elmt de QElectroTech en pares simbolo.svg + metadata.json de Vatia.

Uso:
  python convertir_qet.py --elmt RUTA.elmt --codigo S00110 --familia aparato \
      --repo-raiz C:\\...\\qet-elements --salida-dir E:\\Vatia\\libreria-simbolos\\simbolos \
      [--schema E:\\Vatia\\libreria-simbolos\\schemas\\metadata.schema.json] [--nombre-es "..."]

Convención de ejes: QET define los elementos con Y creciendo hacia abajo,
igual que SVG, por lo que las coordenadas se transfieren sin transformación.
Los arcos usan la convención Qt/QET: 0 grados = este, barrido positivo =
antihorario visual; se muestrean como polilíneas para evitar ambigüedades
de banderas de arco SVG.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

STROKE_DEFAULT = "#000000"
ARC_STEP_DEG = 2.0


def slug(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9]+", "_", texto)
    return texto.strip("_")[:48] or "simbolo"


def extraer_nombres(raiz: ET.Element) -> dict[str, str]:
    nombres = {}
    contenedor = raiz.find("names")
    if contenedor is not None:
        for elem in list(contenedor):
            if elem.tag == "name" and elem.get("lang"):
                nombres[elem.get("lang")] = (elem.text or "").strip()
    return nombres


def elegir_nombre(nombres: dict[str, str], defecto: str) -> str:
    for lang in ("es", "en", "pt_BR", "fr", "it"):
        if nombres.get(lang):
            return nombres[lang]
    return defecto


def parsear_estilo(style: str | None) -> dict:
    props = {}
    if style:
        for parte in style.split(";"):
            if ":" in parte:
                k, v = parte.split(":", 1)
                props[k.strip()] = v.strip()
    return props


def estilo_a_svg(props: dict) -> dict:
    out = {}
    color = props.get("color", "black")
    mapa_colores = {"black": STROKE_DEFAULT, "white": "#ffffff", "red": "#ff0000",
                    "green": "#00ff00", "blue": "#0000ff", "yellow": "#ffff00"}
    out["stroke"] = mapa_colores.get(color, color if color.startswith("#") else STROKE_DEFAULT)
    filling = props.get("filling", "none")
    if filling == "none":
        out["fill"] = "none"
    elif filling == "white":
        out["fill"] = "#ffffff"
    elif filling == "black":
        out["fill"] = STROKE_DEFAULT
    else:
        out["fill"] = mapa_colores.get(filling, filling)
    peso = props.get("line-weight", "normal")
    out["stroke-width"] = {"none": "1", "thin": "0.5", "normal": "1", "high": "1.6", "eleve": "1.6"}.get(peso, "1")
    if props.get("line-style") in ("dashed", "dash", "dotted"):
        out["stroke-dasharray"] = "3,2" if props["line-style"] == "dashed" else "1,2"
    return out


def atributos_svg(estilo: dict, base: dict) -> str:
    partes = []
    for k, v in estilo.items():
        if base.get(k) != v:
            partes.append(f'{k}="{v}"')
    return (" " + " ".join(partes)) if partes else ""


class BBox:
    def __init__(self):
        self.xmin = self.ymin = math.inf
        self.xmax = self.ymax = -math.inf

    def punto(self, x, y):
        self.xmin = min(self.xmin, x)
        self.ymin = min(self.ymin, y)
        self.xmax = max(self.xmax, x)
        self.ymax = max(self.ymax, y)

    def valido(self):
        return self.xmin != math.inf

    def viewBox(self, margen=3.0):
        return (round(self.xmin - margen, 2), round(self.ymin - margen, 2),
                round(self.xmax - self.xmin + 2 * margen, 2),
                round(self.ymax - self.ymin + 2 * margen, 2))


def punto_arco(cx, cy, rx, ry, ang_deg):
    rad = math.radians(ang_deg)
    return (cx + rx * math.cos(rad), cy - ry * math.sin(rad))


def fmt_num(v: float) -> str:
    v = round(v, 2)
    return str(v + 0.0)


def polilinea_de_arco(x, y, w, h, start, sweep):
    cx, cy = x + w / 2.0, y + h / 2.0
    rx, ry = abs(w) / 2.0, abs(h) / 2.0
    pasos = max(2, int(abs(sweep) / ARC_STEP_DEG))
    pts = [punto_arco(cx, cy, rx, ry, start + sweep * i / pasos) for i in range(pasos + 1)]
    return [(px, py) for px, py in pts]


ROL_POR_PREFIJO = (("in", "entrada"), ("out", "salida"), ("pe", "tierra"), ("n", "auxiliar"))
ROL_POR_ORIENTACION = {"n": "entrada", "o": "entrada", "s": "salida", "e": "salida"}


def rol_terminal(nombre: str, orientacion: str) -> str:
    pref = (nombre or "").lower().split(".")[0].strip("_- ")
    for prefijo, rol in ROL_POR_PREFIJO:
        if pref.startswith(prefijo):
            return rol
    return ROL_POR_ORIENTACION.get((orientacion or "").lower(), "auxiliar")


def convertir(elmt_path: Path, codigo: str, familia: str, salida_dir: Path,
              repo_raiz: Path | None, commit_qet: str | None, version_libreria: str,
              nombre_override: str | None) -> dict:
    arbol = ET.parse(elmt_path)
    raiz = arbol.getroot()
    nombres = extraer_nombres(raiz)
    nombre = nombre_override or elegir_nombre(nombres, elmt_path.stem)

    desc = raiz.find("description")
    if desc is None:
        raise ValueError("el .elmt no tiene <description>")

    bbox = BBox()
    fragmentos = []
    omitidos = {"texto": 0, "otro": 0}
    terminales = []

    base_estilo = {"stroke": STROKE_DEFAULT, "fill": "none", "stroke-width": "1"}

    for elem in desc:
        tag = elem.tag.lower()
        props = parsear_estilo(elem.get("style"))
        est = estilo_a_svg(props)
        attrs_extra = atributos_svg(est, base_estilo)
        try:
            if tag == "line":
                x1, y1, x2, y2 = (float(elem.get(k)) for k in ("x1", "y1", "x2", "y2"))
                bbox.punto(x1, y1); bbox.punto(x2, y2)
                fragmentos.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"{attrs_extra}/>')
            elif tag == "rect":
                x, y = float(elem.get("x")), float(elem.get("y"))
                w, h = float(elem.get("width")), float(elem.get("height"))
                bbox.punto(x, y); bbox.punto(x + w, y + h)
                rx = f' rx="{elem.get("rx")}"' if elem.get("rx") else ""
                ry = f' ry="{elem.get("ry")}"' if elem.get("ry") else ""
                fragmentos.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}"{rx}{ry}{attrs_extra}/>')
            elif tag in ("circle", "ellipse"):
                if elem.get("r") is not None:
                    cx, cy, rx, ry = float(elem.get("x")), float(elem.get("y")), float(elem.get("r")), float(elem.get("r"))
                else:
                    cx = float(elem.get("x")) + (float(elem.get("width")) / 2 if elem.get("width") else 0)
                    cy = float(elem.get("y")) + (float(elem.get("height")) / 2 if elem.get("height") else 0)
                    rx = float(elem.get("width", 0)) / 2 or float(elem.get("r", 0))
                    ry = float(elem.get("height", 0)) / 2 or rx
                bbox.punto(cx - rx, cy - ry); bbox.punto(cx + rx, cy + ry)
                fragmentos.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"{attrs_extra}/>')
            elif tag == "polygon":
                idxs = sorted({int(re.sub(r"\D", "", k)) for k in elem.keys() if re.fullmatch(r"x\d+", k)})
                pts = []
                for i in idxs:
                    px, py = float(elem.get(f"x{i}")), float(elem.get(f"y{i}"))
                    pts.append((px, py))
                    bbox.punto(px, py)
                cerrado = (elem.get("closed", "false").lower() == "true")
                if cerrado:
                    pts.append(pts[0])
                texto_pts = " ".join(f"{px},{py}" for px, py in pts)
                fragmentos.append(f'<polyline points="{texto_pts}"{attrs_extra}/>')
            elif tag == "arc":
                x, y = float(elem.get("x")), float(elem.get("y"))
                w, h = float(elem.get("width", 0)), float(elem.get("height", 0))
                start, sweep = float(elem.get("start", 0)), float(elem.get("angle", 0))
                pts = polilinea_de_arco(x, y, w, h, start, sweep)
                for px, py in pts:
                    bbox.punto(px, py)
                texto_pts = " ".join(f"{fmt_num(px)},{fmt_num(py)}" for px, py in pts)
                fragmentos.append(f'<polyline points="{texto_pts}"{attrs_extra}/>')
            elif tag == "terminal":
                tx, ty = float(elem.get("x")), float(elem.get("y"))
                tnom = elem.get("name") or f"t{len(terminales) + 1}"
                terminales.append({
                    "id": tnom,
                    "rol": rol_terminal(tnom, elem.get("orientation", "")),
                    "x": tx,
                    "y": ty,
                })
                bbox.punto(tx, ty)
            elif tag in ("text", "dynamic_text", "input"):
                omitidos["texto"] += 1
            else:
                omitidos["otro"] += 1
        except (TypeError, ValueError) as exc:
            omitidos["otro"] += 1
            print(f"  aviso: primitiva '{tag}' omitida ({exc})", file=sys.stderr)

    if not bbox.valido():
        raise ValueError("el símbolo no tiene geometría utilizable")

    vb_x, vb_y, vb_w, vb_h = bbox.viewBox()

    marcas = []
    for t in terminales:
        dentro = (vb_x <= t["x"] <= vb_x + vb_w) and (vb_y <= t["y"] <= vb_y + vb_h)
        if not dentro:
            raise ValueError(f'terminal "{t["id"]}" fuera del viewBox')
        marcas.append(
            f'<circle class="punto-conexion" cx="{t["x"]}" cy="{t["y"]}" r="1.1" '
            f'fill="#e11d48" fill-opacity="0.85" stroke="#e11d48" stroke-width="0.4"/>'
        )

    cuerpo = "\n  ".join(fragmentos + marcas)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb_x} {vb_y} {vb_w} {vb_h}" '
        f'width="{int(vb_w * 6)}" height="{int(vb_h * 6)}">\n'
        f'  <g fill="none" stroke="{STROKE_DEFAULT}" stroke-width="1" '
        f'stroke-linecap="round" stroke-linejoin="round">\n  {cuerpo}\n  </g>\n</svg>\n'
    )
    ET.fromstring(svg)

    rel_fuente = elmt_path.relative_to(repo_raiz).as_posix() if repo_raiz and elmt_path.is_relative_to(repo_raiz) else elmt_path.name
    fuente = f"qelectrotech/qelectrotech-elements@{commit_qet or 'desconocido'}:{rel_fuente}"

    metadata = {
        "codigo_iec": codigo,
        "nombre": nombre,
        "familia_atributos": familia,
        "estado_revision": "pendiente_revision",
        "puntos_conexion": terminales,
        "version_libreria": version_libreria,
        "fuente_qet": fuente,
    }

    carpeta = salida_dir / f"{codigo}_{slug(nombre)}"
    carpeta.mkdir(parents=True, exist_ok=True)
    ruta_svg = carpeta / "simbolo.svg"
    ruta_meta = carpeta / "metadata.json"
    ruta_svg.write_text(svg, encoding="utf-8")
    ruta_meta.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return {
        "codigo": codigo,
        "nombre": nombre,
        "carpeta": carpeta,
        "svg": ruta_svg,
        "metadata": ruta_meta,
        "primitivas": len(fragmentos),
        "terminales": len(terminales),
        "omitidas": omitidos,
        "viewbox": (vb_x, vb_y, vb_w, vb_h),
        "metadata_data": metadata,
    }


def validar_metadata(ruta_meta: Path, schema_path: Path | None) -> list[str]:
    errores = []
    datos = json.loads(ruta_meta.read_text(encoding="utf-8"))
    requeridos = ["codigo_iec", "nombre", "familia_atributos", "estado_revision",
                  "puntos_conexion", "version_libreria"]
    for campo in requeridos:
        if campo not in datos:
            errores.append(f"falta campo obligatorio: {campo}")
    if "codigo_iec" in datos and not re.fullmatch(r"S[0-9]{5}", datos["codigo_iec"]):
        errores.append("codigo_iec no coincide con ^S[0-9]{5}$")
    estados_validos = {"pendiente_revision", "verificado_aea", "corregido"}
    if datos.get("estado_revision") not in estados_validos:
        errores.append("estado_revision inválido")
    if schema_path is not None:
        try:
            import jsonschema
            schema = json.loads(schema_path.read_text(encoding="utf-8"))
            jsonschema.validate(datos, schema)
        except ImportError:
            errores.append("jsonschema no instalado: validación contra schema omitida")
        except Exception as exc:
            errores.append(f"schema: {exc}")
    return errores


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--elmt", required=True, type=Path)
    parser.add_argument("--codigo", required=True)
    parser.add_argument("--familia", required=True, choices=("aparato", "conductor", "barra"))
    parser.add_argument("--nombre-es", dest="nombre_es")
    parser.add_argument("--repo-raiz", type=Path, default=None)
    parser.add_argument("--commit-qet", dest="commit_qet", default=None)
    parser.add_argument("--salida-dir", type=Path, required=True)
    parser.add_argument("--schema", type=Path, default=None)
    parser.add_argument("--version-libreria", default="0.1.0")
    args = parser.parse_args()

    resultado = convertir(args.elmt, args.codigo, args.familia, args.salida_dir,
                          args.repo_raiz, args.commit_qet, args.version_libreria, args.nombre_es)

    errores = validar_metadata(resultado["metadata"], args.schema)

    vx, vy, vw, vh = resultado["viewbox"]
    print(f'OK {resultado["codigo"]} · {resultado["nombre"]}')
    print(f'  carpeta:      {resultado["carpeta"]}')
    print(f'  primitivas:   {resultado["primitivas"]} · terminales: {resultado["terminales"]} · omitidas: {resultado["omitidas"]}')
    print(f'  viewBox:      {vx} {vy} {vw} {vh}')
    for t in resultado["metadata_data"]["puntos_conexion"]:
        print(f'  terminal:     id={t["id"]} rol={t["rol"]} ({t["x"]},{t["y"]})')
    if errores:
        print("ERRORES DE VALIDACIÓN:")
        for e in errores:
            print(f"  ✗ {e}")
        return 1
    print("  validación:   metadata OK" + (", schema OK" if args.schema else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
