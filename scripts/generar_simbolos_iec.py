#!/usr/bin/env python3
"""Genera simbolos de la libreria trazandolos desde la norma IEC 60617.

Por que existe este script
--------------------------
Los simbolos S00121..S00130 se rehicieron tres veces a mano y una cuarta
importando de QElectroTech, y ninguna version conformo: la coleccion de QET
mezcla dibujos hechos bajo otras normas. Aca la geometria se deriva
DIRECTAMENTE de la lamina de la norma, y cada simbolo declara en su codigo el
numero normativo del que sale, de modo que la decision de diseno quede
auditable y no dependa de la memoria de nadie.

Escala
------
La norma dibuja sobre una reticula modular de 2,5 mm. En este proyecto
**1 modulo = 5 unidades de viewBox** (MODULO abajo). Esa equivalencia es la
que mantiene puntos de conexion y origenes de viewBox sobre multiplos de 5,
que es lo que exige scripts/lint_simbolos.py.

Construccion
------------
Casi todos los aparatos de maniobra se arman igual: un CONTACTO DE CORTE
(cuchilla que pivota sobre el borne inferior) mas un SIMBOLO CALIFICADOR
encima que dice que clase de aparato es:

    07-70-01  semicirculo       funcion del contactor
    07-70-02  aspa              funcion del interruptor automatico
    07-70-03  barra corta       funcion del seccionador (aislador)
    07-70-04  circulo + barra   funcion del interruptor-seccionador
    07-70-05  cuadrado relleno  disparo automatico por rele de medida o
                                disparador incorporado

Uso:  python scripts/generar_simbolos_iec.py [--raiz RUTA]
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

MODULO = 5.0  # unidades de viewBox por modulo de la norma

CABECERA = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
    'width="{w}" height="{h}">\n'
    '  <g fill="none" stroke="#000000" stroke-width="1" '
    'stroke-linecap="round" stroke-linejoin="round">\n'
)
PIE = "  </g>\n</svg>\n"


def n(v: float) -> str:
    """Numero formateado corto y estable (evita -0.0 y colas de float)."""
    v = round(v + 0.0, 3)
    if v == int(v):
        return f"{int(v)}.0"
    return f"{v:g}"


def linea(x1, y1, x2, y2):
    return f'  <line x1="{n(x1)}" y1="{n(y1)}" x2="{n(x2)}" y2="{n(y2)}"/>\n'


def polilinea(pts, extra=""):
    p = " ".join(f"{n(x)},{n(y)}" for x, y in pts)
    return f'  <polyline points="{p}"{extra}/>\n'


def poligono(pts, extra=""):
    p = " ".join(f"{n(x)},{n(y)}" for x, y in pts)
    return f'  <polygon points="{p}"{extra}/>\n'


def circulo(cx, cy, r, extra=""):
    return f'  <circle cx="{n(cx)}" cy="{n(cy)}" r="{n(r)}"{extra}/>\n'


def elipse(cx, cy, rx, ry):
    return f'  <ellipse cx="{n(cx)}" cy="{n(cy)}" rx="{n(rx)}" ry="{n(ry)}"/>\n'


def rectangulo(x, y, w, h):
    return f'  <rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}"/>\n'


def texto(x, y, s, tam=6):
    return (
        f'  <text x="{n(x)}" y="{n(y)}" font-family="Liberation Sans, sans-serif" '
        f'font-size="{n(tam)}" text-anchor="middle" dominant-baseline="central" '
        f'fill="#000000" stroke="none">{s}</text>\n'
    )


def terminal(x, y):
    return (
        f'  <circle class="punto-conexion" cx="{n(x)}" cy="{n(y)}" r="1.1" '
        'fill="#e11d48" fill-opacity="0.85" stroke="#e11d48" stroke-width="0.4"/>\n'
    )


def rect_sobre_recta(p0, p1, t, largo, ancho, corrimiento=0.0, relleno=False):
    """Rectangulo apoyado sobre el segmento p0->p1, orientado como el.

    Es lo que la norma dibuja sobre la cuchilla: el cuadrado de disparo
    (07-70-05) y el cartucho del fusible (07-75-08) van girados con la
    cuchilla, no alineados a los ejes.
    """
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    largo_seg = math.hypot(dx, dy)
    ux, uy = dx / largo_seg, dy / largo_seg   # a lo largo
    px, py = -uy, ux                          # perpendicular
    cx = p0[0] + dx * t + px * corrimiento
    cy = p0[1] + dy * t + py * corrimiento
    a, b = largo / 2.0, ancho / 2.0
    pts = [
        (cx + ux * a + px * b, cy + uy * a + py * b),
        (cx + ux * a - px * b, cy + uy * a - py * b),
        (cx - ux * a - px * b, cy - uy * a - py * b),
        (cx - ux * a + px * b, cy - uy * a + py * b),
    ]
    return poligono(pts, ' fill="#000000"' if relleno else "")


def efecto_termico(cx, cy, alto=10.0):
    """03-30-37 Efecto termico: el PULSO CUADRADO.

    Es una linea vertical con un salto RECTANGULAR hacia la derecha en el
    medio, que vuelve al mismo eje. Medido sobre la lamina: el salto ocupa
    1 modulo de ancho y 0,76 de alto, y el glifo entero 2 modulos.

    Forma pareja con efecto_electromagnetico(): mismo trazo, salto cuadrado
    contra salto redondo. Esa es justamente la diferencia que distingue la
    actuacion termica de la magnetica.
    """
    a = alto / 2.0
    bh = alto * 0.19          # media altura del salto
    bw = alto * 0.50          # ancho del salto
    return polilinea([
        (cx, cy - a), (cx, cy - bh), (cx + bw, cy - bh),
        (cx + bw, cy + bh), (cx, cy + bh), (cx, cy + a),
    ])


def efecto_electromagnetico(cx, cy, alto=10.0):
    """03-30-38 Efecto electromagnetico: el salto SEMICIRCULAR.

    Misma linea vertical que el efecto termico, pero el salto del medio es
    una semicircunferencia hacia la derecha de radio 1/4 del alto. Es una
    espira vista de canto.
    """
    import math as _m
    a = alto / 2.0
    r = alto * 0.25
    pts = [(cx, cy - a)]
    pasos = 12
    for i in range(pasos + 1):
        ang = -_m.pi / 2 + _m.pi * i / pasos
        pts.append((cx + r * _m.cos(ang), cy + r * _m.sin(ang)))
    pts.append((cx, cy + a))
    return polilinea(pts)


# ---------------------------------------------------------------------------
# Definicion de cada simbolo.
# Cada funcion devuelve (viewBox, cuerpo_svg, nombre, referencia normativa).
# La cuchilla estandar del contacto de corte pivota en el borne inferior y su
# punta queda separada del contacto fijo (posicion abierta).
# ---------------------------------------------------------------------------

def s00121():
    """MCCB - 07-72-25 interruptor-seccionador con corte iniciado por un rele
    de medicion o un desenganche incorporados. El cuadrado negro sobre la
    cuchilla ES el disparador incorporado (07-70-05); no va ninguna caja
    encerrando el mecanismo."""
    hoja = "-10.0 -35.0 20.0 60.0"
    p0, p1 = (0.0, 0.0), (-5.0, -13.0)
    c = ""
    c += linea(0, -30, 0, -15)                 # contacto fijo
    c += linea(-3, -15, 3, -15)                # barra   (07-70-04)
    c += circulo(0, -12, 3)                    # circulo (07-70-04)
    c += linea(p0[0], p0[1], p1[0], p1[1])     # cuchilla
    c += linea(0, 0, 0, 20)                    # salida
    c += rect_sobre_recta(p0, p1, 0.5, 6.0, 6.0, corrimiento=-2.6, relleno=True)
    return hoja, c, "Interruptor automático en caja moldeada (MCCB)", "IEC 60617 07-72-25"


def s00122():
    """Guardamotor TERMOMAGNETICO - interruptor automatico (contacto de corte
    con aspa 07-70-02) mas DOS cajas de disparador: actuacion termica
    (03-30-37) y actuacion magnetica (03-30-38).

    La linea de potencia LLEGA a cada caja y sale de ella, pero no la
    atraviesa: dentro de la caja lo unico que se dibuja es el glifo de la
    actuacion. Es criterio explicito del usuario.
    """
    hoja = "-10.0 -35.0 20.0 60.0"
    p0, p1 = (0.0, -12.0), (-5.0, -22.0)
    c = ""
    c += linea(0, -30, 0, -22)                 # contacto fijo
    c += linea(-2, -28, 2, -24)                # aspa 07-70-02
    c += linea(2, -28, -2, -24)
    c += linea(p0[0], p0[1], p1[0], p1[1])     # cuchilla
    c += linea(0, -12, 0, -10)                 # baja hasta la primera caja
    c += rectangulo(-5, -10, 10, 10)           # disparador termico
    c += efecto_termico(0, -5, 6.0)
    c += linea(0, 0, 0, 2)                     # entre cajas
    c += rectangulo(-5, 2, 10, 10)             # disparador magnetico
    c += efecto_electromagnetico(0, 7, 6.0)
    c += linea(0, 12, 0, 20)                   # salida
    return hoja, c, "Guardamotor termomagnético", "IEC 60617 07-72-21 + 03-30-37 + 03-30-38"


def s00133():
    """Guardamotor MAGNETICO - el mismo interruptor con UNA sola caja de
    disparador, la de actuacion magnetica (03-30-38): protege solo contra
    cortocircuito, no contra sobrecarga."""
    hoja = "-10.0 -35.0 20.0 60.0"
    p0, p1 = (0.0, -12.0), (-5.0, -22.0)
    c = ""
    c += linea(0, -30, 0, -22)
    c += linea(-2, -28, 2, -24)
    c += linea(2, -28, -2, -24)
    c += linea(p0[0], p0[1], p1[0], p1[1])
    c += linea(0, -12, 0, -5)
    c += rectangulo(-5, -5, 10, 10)            # unica caja: actuacion magnetica
    c += efecto_electromagnetico(0, 0, 6.0)
    c += linea(0, 5, 0, 20)
    return hoja, c, "Guardamotor magnético", "IEC 60617 07-72-21 + 03-30-38"


def s00123():
    """Rele termico (RT) - caja de rele con el simbolo de efecto termico
    (03-30-37) adentro: el pulso cuadrado.

    La linea llega a la caja y sale de ella, sin atravesarla.
    """
    hoja = "-10.0 -35.0 20.0 60.0"
    c = ""
    c += linea(0, -30, 0, -6)
    c += rectangulo(-6, -6, 12, 12)
    c += efecto_termico(0, 0, 7.0)
    c += linea(0, 6, 0, 20)
    return hoja, c, "Relé térmico (RT)", "IEC 60617 07-76-01 + 03-30-37"


def s00127():
    """Seccionador fusible - 07-75-08 fusible-seccionador (aislador de
    fusibles): barra de seccionador arriba (07-70-03) y el cartucho del
    fusible montado SOBRE la cuchilla."""
    hoja = "-10.0 -25.0 20.0 50.0"
    p0, p1 = (0.0, 8.0), (-4.0, -11.0)
    c = ""
    c += linea(0, -20, 0, -12)
    c += linea(-3, -12, 3, -12)                # barra 07-70-03
    c += linea(p0[0], p0[1], p1[0], p1[1])     # cuchilla
    c += rect_sobre_recta(p0, p1, 0.5, 9.0, 3.5)   # cartucho del fusible
    c += linea(0, 8, 0, 20)
    return hoja, c, "Seccionador fusible", "IEC 60617 07-75-08"


def s00128():
    """Interruptor diferencial - 07-72-17. Contacto de corte con aspa de
    interruptor automatico, el toroide sumador atravesado por el conductor, y
    el enlace mecanico punteado que va del toroide al disparo."""
    hoja = "-10.0 -25.0 20.0 50.0"
    p0, p1 = (0.0, -2.0), (-5.0, -12.0)
    punteado = ' stroke-dasharray="1.5,1.5"'
    c = ""
    c += linea(0, -20, 0, -12)
    c += linea(-2, -17, 2, -13)                # aspa 07-70-02
    c += linea(2, -17, -2, -13)
    c += linea(p0[0], p0[1], p1[0], p1[1])
    c += linea(0, -2, 0, 20)
    c += elipse(0, 5, 7, 2.5)                  # toroide sumador
    c += polilinea([(-7, 5), (-7, -7), (-3.5, -7)], punteado)
    return hoja, c, "Interruptor diferencial (ID/RCD)", "IEC 60617 07-72-17"


def s00129():
    """Rele de proteccion de tension - 07-73-18, rele de minima tension. Es un
    rele de medicion: caja rectangular con la magnitud vigilada adentro. Se
    rotula U<> por cubrir minima y maxima."""
    hoja = "-15.0 -25.0 30.0 50.0"
    c = ""
    c += linea(0, -20, 0, -7.5)
    c += rectangulo(-7.5, -7.5, 15, 15)
    c += texto(0, 0, "U&lt;&gt;", 6)
    c += linea(0, 7.5, 0, 20)
    return hoja, c, "Relé de protección de tensión", "IEC 60617 07-73-18"


def s00130():
    """Rele/contactor auxiliar - 07-76-01, dispositivo de maniobra / bobina de
    rele, simbolo general: el rectangulo liso."""
    hoja = "-10.0 -25.0 20.0 50.0"
    c = ""
    c += linea(0, -20, 0, -7.5)
    c += rectangulo(-5, -7.5, 10, 15)
    c += linea(0, 7.5, 0, 20)
    return hoja, c, "Relé/contactor auxiliar", "IEC 60617 07-76-01"


SIMBOLOS = {
    "S00121": s00121, "S00122": s00122, "S00123": s00123, "S00127": s00127,
    "S00128": s00128, "S00129": s00129, "S00130": s00130, "S00133": s00133,
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raiz", type=Path, default=Path(__file__).resolve().parent.parent)
    args = ap.parse_args()
    base = args.raiz / "libreria-simbolos" / "simbolos"

    for codigo, fn in SIMBOLOS.items():
        carpeta = next(c for c in base.iterdir() if c.name.startswith(codigo + "_"))
        meta = json.loads((carpeta / "metadata.json").read_text(encoding="utf-8"))
        vb, cuerpo, nombre, norma = fn()

        _minx, _miny, ancho_vb, alto_vb = (float(v) for v in vb.split())
        svg = CABECERA.format(vb=vb, w=int(ancho_vb * 10), h=int(alto_vb * 10))
        svg += cuerpo
        for p in meta["puntos_conexion"]:
            svg += terminal(float(p["x"]), float(p["y"]))
        svg += PIE
        (carpeta / "simbolo.svg").write_text(svg, encoding="utf-8")

        meta["nombre"] = nombre
        meta.pop("fuente_qet", None)
        meta["fuente_norma"] = norma
        (carpeta / "metadata.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"  {codigo}  {norma:<32}  {nombre}")

    print(f"\n{len(SIMBOLOS)} simbolos generados desde la norma")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
