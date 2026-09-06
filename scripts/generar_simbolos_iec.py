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


def linea(x1, y1, x2, y2, extra=""):
    return f'  <line x1="{n(x1)}" y1="{n(y1)}" x2="{n(x2)}" y2="{n(y2)}"{extra}/>\n'


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
    """MCCB - interruptor automatico rodeado por el ENVOLVENTE MOLDEADO.

    La norma no tiene simbolo propio del interruptor en caja moldeada, porque
    no distingue aparatos por la construccion del envolvente. Criterio elegido
    por el usuario: dibujar el interruptor automatico (contacto de corte con
    aspa 07-70-02) dentro de una caja que representa el moldeado, y declarar el
    TIPO DE DISPARO en la ficha (campo tipo_disparo del schema), que es lo que
    habilita los campos de ajuste correspondientes. Asi un solo simbolo cubre
    el termomagnetico, el magnetico y el electronico.
    """
    hoja = "-10.0 -35.0 20.0 60.0"
    c = ""
    c += linea(0, -30, 0, -24)                 # entrada, hasta el envolvente
    c += rectangulo(-8, -24, 16, 38)           # envolvente moldeado
    c += linea(0, -24, 0, -16)                 # contacto fijo, dentro
    c += linea(-2, -21, 2, -17)                # aspa 07-70-02
    c += linea(2, -21, -2, -17)
    c += linea(0, -6, -5, -16)                 # cuchilla
    c += linea(0, -6, 0, 14)                   # sale del envolvente
    c += linea(0, 14, 0, 20)                   # salida
    return hoja, c, "Interruptor automático en caja moldeada (MCCB)", "IEC 60617 07-72-21 en envolvente"


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
    """Rele de proteccion de tension - 07-73-18, rele de minima tension.

    Correccion del usuario: NO es un aparato de paso. Es un rele de MEDICION:
    no lleva la corriente de carga, sino que toma tension de la linea y actua
    sobre el interruptor que dispara. Por eso tiene una sola toma de medicion
    (arriba) y un enlace mecanico punteado que sale hacia el interruptor, en
    vez de entrada y salida en serie.
    """
    hoja = "-15.0 -25.0 30.0 50.0"
    punteado = ' stroke-dasharray="1.5,1.5"'
    c = ""
    c += linea(0, -20, 0, -7.5)                # toma de medicion
    c += rectangulo(-7.5, -7.5, 15, 15)
    c += texto(0, 0, "U&lt;&gt;", 6)
    c += polilinea([(7.5, 0), (13, 0), (13, -18)], punteado)   # enlace al interruptor
    return hoja, c, "Relé de protección de tensión", "IEC 60617 07-73-18"


SIMBOLOS_FUERZA = {
    "S00121": s00121, "S00122": s00122, "S00123": s00123, "S00127": s00127,
    "S00128": s00128, "S00129": s00129, "S00133": s00133,
}


# ---------------------------------------------------------------------------
# COMANDO (Paso 1 del rediseno del editor, C42): lote piloto de 8 simbolos
# para validar el nivel visual antes de escalar al resto de la libreria de
# mando. Section 7 "071 Contactos" y "072 Dispositivos de Maniobra" de la
# norma; el general de lampara sale de la Section 8 "080".
#
# Composicion: el contacto NA/NC es el mismo bloque "cuchilla" que ya usa la
# libreria de fuerza (07-71-01/02), pivotando sobre el borne inferior. Los
# aparatos accionados a mano (pulsador, selector, seta) le agregan un
# ACTUADOR a la izquierda, unido por un enlace mecanico punteado (03-31-01) -
# composicion HORIZONTAL, a diferencia de los calificadores de fuerza
# (07-70-xx) que van ARRIBA de la cuchilla.
# ---------------------------------------------------------------------------

PUNTEADO = ' stroke-dasharray="1.5,1.5"'


def contacto_na(cx=0.0, y_arriba=-20.0, y_abajo=20.0):
    """07-71-01 Forma 1: contacto NA, abierto en reposo.

    Borne fijo arriba, cuchilla pivotando desde el borne movil (abajo) hasta
    una punta que queda separada del borne fijo (hueco visible = abierto).
    """
    c = linea(cx, y_arriba, cx, -8)
    c += linea(cx, 8, cx - 6, -8)
    c += linea(cx, 8, cx, y_abajo)
    return c


def contacto_nc(cx=0.0, y_arriba=-20.0, y_abajo=20.0):
    """07-71-02: contacto NC, cerrado en reposo.

    El borne fijo baja y dobla en codo hacia la izquierda; la cuchilla sale
    de ese codo YA TOCANDO el borne movil (cerrado) -- eso solo (cerrado
    vs. el hueco abierto de contacto_na) es lo que distingue NC de NA.

    Sin marca de corte: cuatro rondas de correccion sobre esa marca (gancho
    corto, cruz a angulo raro, cruz a 90 grados corta, cruz a 90 grados mas
    larga) y seguia sin convencer. Decision del usuario: sacarla en vez de
    seguir iterando sobre un detalle que no estaba saliendo bien.
    """
    codo = (cx - 6, -8.0)
    pivote = (cx, 8.0)

    c = linea(cx, y_arriba, cx, -8)
    c += linea(cx, -8, codo[0], codo[1])
    c += linea(codo[0], codo[1], pivote[0], pivote[1])
    c += linea(cx, 8, cx, y_abajo)
    return c


def actuador_pulsador(cx, cy):
    """07-72-02: cabeza de pulsador, corchete a la izquierda del contacto."""
    c = linea(cx, cy - 4, cx, cy + 4)
    c += linea(cx, cy - 4, cx + 3, cy - 4)
    c += linea(cx, cy + 4, cx + 3, cy + 4)
    return c


def actuador_rotativo(cx, cy):
    """07-72-04: botón giratorio (selector), letra "F"."""
    c = linea(cx, cy - 5, cx, cy + 5)
    c += linea(cx, cy - 5, cx + 3, cy - 5)
    c += linea(cx, cy, cx + 3, cy)
    return c


def s00124():
    hoja = "-10.0 -25.0 20.0 50.0"
    return hoja, contacto_na(), "Contacto auxiliar NA", "IEC 60617 07-71-01 Forma 1"


def s00134():
    hoja = "-10.0 -25.0 20.0 50.0"
    return hoja, contacto_nc(), "Contacto auxiliar NC", "IEC 60617 07-71-02"


def s00135():
    """Pulsador NA - 07-72-02: corchete de pulsador + enlace punteado hasta
    la MITAD de la cuchilla del contacto NA. Corrección del usuario: el
    enlace no va al extremo/codo, va al medio del recorrido de la cuchilla
    (punto medio entre el pivote (0,8) y la punta abierta (-6,-8): (-3,0)).
    Corrección del usuario (ronda siguiente): mover SOLO la punta del
    enlace no alcanzaba, quedaba una diagonal que se metía a cruzar la
    cuchilla y confundía toda la lectura del símbolo. Se bajó el corchete
    completo a la altura (-3,0) del medio, igual que quedó aprobado en el
    selector (S00137): enlace HORIZONTAL limpio, sin diagonales."""
    hoja = "-20.0 -25.0 30.0 50.0"
    c = actuador_pulsador(-15, 0)
    c += linea(-15, 0, -3, 0, PUNTEADO)
    c += contacto_na()
    return hoja, c, "Pulsador NA", "IEC 60617 07-72-02"


def s00136():
    """Pulsador NC - mismo corchete, mismo enlace horizontal a la mitad de
    la cuchilla del contacto NC (mismo punto medio (-3,0) que el NA: ambas
    cuchillas van entre los mismos dos puntos, cerrada o abierta)."""
    hoja = "-20.0 -25.0 30.0 50.0"
    c = actuador_pulsador(-15, 0)
    c += linea(-15, 0, -3, 0, PUNTEADO)
    c += contacto_nc()
    return hoja, c, "Pulsador NC", "IEC 60617 07-72-02 + 07-71-02"


def s00137():
    """Selector 2 posiciones - contacto conmutador de 3 bornes (07-71-03),
    no el contacto simple de 07-72-04 (corrección del usuario: 2 bornes solo
    alcanzan para un pulsador con una posición abierta). Común abajo,
    posición 1 cerrada en reposo y posición 2 abierta a los costados.

    El actuador va como el pulsador — a la IZQUIERDA, a la altura media de
    la cuchilla activa, enlace horizontal limpio al punto medio entre pos1
    y el común. Sin marca de corte en pos1: mismo criterio que
    contacto_nc(), sacada tras el pedido del usuario ("sácale la cruz...
    también al selector biestado")."""
    hoja = "-20.0 -25.0 40.0 50.0"
    comun = (0.0, 8.0)
    pos1 = (-10.0, -8.0)  # borne fijo, cerrado en reposo
    pos2 = (10.0, -8.0)   # borne fijo, abierto en reposo (no toca la cuchilla)
    c = actuador_rotativo(-17, 0)
    c += linea(-14, 0, -5, 0, PUNTEADO)
    c += linea(pos1[0], -20, pos1[0], pos1[1])
    c += linea(pos1[0], pos1[1], comun[0], comun[1])
    c += linea(pos2[0], -20, pos2[0], pos2[1] - 4)
    c += linea(comun[0], comun[1], comun[0], 20)
    return hoja, c, "Selector 2 posiciones", "IEC 60617 07-71-03 + 07-72-04"


def s00130():
    """Bobina de contactor/relé, símbolo general - 07-76-01 Forma 1: un
    rectángulo con un borne saliendo de cada lado corto."""
    hoja = "-10.0 -25.0 20.0 50.0"
    c = linea(0, -20, 0, -7.5)
    c += rectangulo(-5, -7.5, 10, 15)
    c += linea(0, 7.5, 0, 20)
    return hoja, c, "Bobina de contactor/relé", "IEC 60617 07-76-01 Forma 1"


def s00139():
    """Lámpara piloto, símbolo general - 08-80-44: círculo con una cruz
    adentro."""
    hoja = "-10.0 -25.0 20.0 50.0"
    c = linea(0, -20, 0, -7)
    c += circulo(0, 0, 7)
    c += linea(-4.95, -4.95, 4.95, 4.95)
    c += linea(-4.95, 4.95, 4.95, -4.95)
    c += linea(0, 7, 0, 20)
    return hoja, c, "Lámpara piloto", "IEC 60617 08-80-44"


# ---------------------------------------------------------------------------
# Paso 2 de la librería de comando (C43): contactos/bobina de temporizador,
# interruptor de posición, selector de 3 posiciones. Reutilizan
# contacto_na()/contacto_nc()/actuador_rotativo() del piloto ya aprobado.
# ---------------------------------------------------------------------------

def qualif_posicion(cx, cy, ancho=4.0, alto=2.6):
    """07-70-06: triángulo sólido apuntando hacia abajo, calificador de
    "contacto de posición" — se agrega a un contacto simple para marcarlo
    como interruptor de posición (fin de carrera) sin tener que dibujar un
    símbolo distinto para cada variante NA/NC."""
    return poligono(
        [(cx - ancho / 2, cy - alto / 2), (cx + ancho / 2, cy - alto / 2), (cx, cy + alto / 2)],
        ' fill="#000000"',
    )


def retardo_horizontal(punto, largo=4.5, sep=1.0, r=2.6):
    """03-31-05 "acción retardada" (mismo "efecto paracaídas" que ya
    describe la norma en 07-71-15/17): doble línea horizontal + arco que
    se abre hacia la cuchilla, extendiendo el extremo abierto/codo del
    contacto (mismo punto (cx-6,-8) que ya usan contacto_na/contacto_nc)
    hacia la izquierda. El arco es la misma polilínea que ya funcionó bien
    para la cabeza de seta retirada — sin comandos de arco SVG."""
    x0, y0 = punto
    x1 = x0 - largo
    c = linea(x0, y0 - sep / 2, x1, y0 - sep / 2)
    c += linea(x0, y0 + sep / 2, x1, y0 + sep / 2)
    pts = [
        (x1 + r * math.cos(math.pi / 2 + i * math.pi / 8), y0 + r * math.sin(math.pi / 2 + i * math.pi / 8))
        for i in range(9)
    ]
    c += polilinea(pts)
    return c


def retardo_horizontal_invertido(punto, largo=4.5, sep=1.0, r=2.6):
    """E66. Mismo calificador de "acción retardada" que retardo_horizontal(),
    pero ESPEJADO sobre el eje de la doble línea: la norma (lámina 07-71,
    página 51) distingue "retarda al activar" (07-71-15/17 — panza del
    arco lejos de la cuchilla, hacia la izquierda) de "retarda al
    desactivar" (07-71-16/18 — panza del arco hacia la cuchilla, a la
    derecha). Se logra invirtiendo el signo del coseno: las puntas del
    arco quedan ancladas en el mismo eje (x1, y0±r), solo cambia hacia
    qué lado bombea la curva."""
    x0, y0 = punto
    x1 = x0 - largo
    c = linea(x0, y0 - sep / 2, x1, y0 - sep / 2)
    c += linea(x0, y0 + sep / 2, x1, y0 + sep / 2)
    pts = [
        (x1 - r * math.cos(math.pi / 2 + i * math.pi / 8), y0 + r * math.sin(math.pi / 2 + i * math.pi / 8))
        for i in range(9)
    ]
    c += polilinea(pts)
    return c


def s00140():
    """Interruptor de posición, contacto de cierre - 07-72-07: contacto NA
    con el calificador de posición (07-70-06) al costado, para que no se
    confunda con un contacto auxiliar común (07-72-07 no lo trae en la
    norma porque ya está bajo el encabezado "Interruptor de Posición" de
    la tabla; un símbolo suelto en la librería sí lo necesita)."""
    hoja = "-15.0 -25.0 30.0 50.0"
    c = contacto_na()
    c += qualif_posicion(6, 0)
    return hoja, c, "Interruptor de posición NA", "IEC 60617 07-72-07 + 07-70-06"


def s00141():
    """Interruptor de posición, contacto de apertura - 07-72-08: igual,
    sobre el contacto NC."""
    hoja = "-15.0 -25.0 30.0 50.0"
    c = contacto_nc()
    c += qualif_posicion(6, 0)
    return hoja, c, "Interruptor de posición NC", "IEC 60617 07-72-08 + 07-70-06"


def s00142():
    """Selector 3 posiciones - misma estructura que el selector de 2
    (S00137, ya aprobado): conmutador con común abajo, posición 1 cerrada
    en reposo, y ahora DOS posiciones abiertas a los costados en vez de
    una. Mismo patrón de actuador a la izquierda con enlace horizontal al
    punto medio de la cuchilla activa."""
    hoja = "-20.0 -25.0 40.0 50.0"
    comun = (0.0, 8.0)
    pos1 = (-15.0, -8.0)  # cerrada en reposo
    pos2 = (0.0, -8.0)    # abierta
    pos3 = (15.0, -8.0)   # abierta
    c = actuador_rotativo(-18, 0)
    c += linea(-15, 0, -7.5, 0, PUNTEADO)
    c += linea(pos1[0], -20, pos1[0], pos1[1])
    c += linea(pos1[0], pos1[1], comun[0], comun[1])
    c += linea(pos2[0], -20, pos2[0], pos2[1] - 4)
    c += linea(pos3[0], -20, pos3[0], pos3[1] - 4)
    c += linea(comun[0], comun[1], comun[0], 20)
    return hoja, c, "Selector 3 posiciones", "IEC 60617 07-71-03 + 07-72-04"


def s00143():
    """Bobina de temporizador, retardo a la conexión - 07-76-08: mismo
    rectángulo que la bobina general (S00130/07-76-01), con el tercio
    izquierdo separado y cruzado en X."""
    hoja = "-10.0 -25.0 20.0 50.0"
    c = linea(0, -20, 0, -7.5)
    c += rectangulo(-5, -7.5, 10, 15)
    c += linea(-1.7, -7.5, -1.7, 7.5)
    c += linea(-5, -7.5, -1.7, 7.5)
    c += linea(-1.7, -7.5, -5, 7.5)
    c += linea(0, 7.5, 0, 20)
    return hoja, c, "Bobina de temporizador (retardo a la conexión)", "IEC 60617 07-76-08"


def s00144():
    """Contacto NA temporizado, retardo a la conexión - 07-71-15: la
    cuchilla abierta de contacto_na() con el calificador de acción
    retardada extendiendo su extremo hacia la izquierda."""
    hoja = "-20.0 -25.0 30.0 50.0"
    c = contacto_na()
    c += retardo_horizontal((-6, -8))
    return hoja, c, "Contacto NA temporizado (retardo a la conexión)", "IEC 60617 07-71-15"


def s00145():
    """Contacto NC temporizado, retardo a la conexión - 07-71-17: mismo
    calificador de retardo, sobre contacto_nc()."""
    hoja = "-20.0 -25.0 30.0 50.0"
    c = contacto_nc()
    c += retardo_horizontal((-6, -8))
    return hoja, c, "Contacto NC temporizado (retardo a la conexión)", "IEC 60617 07-71-17"


# ---------------------------------------------------------------------------
# E66 (pedido del usuario: "todos los elementos existentes"): variante de
# retardo a la DESCONEXIÓN de la familia temporizador, deliberadamente
# dejada afuera en el Paso 2 (C43) por falta de un caso de uso concreto.
# Verificado contra la lámina 07-76 (bobina, página 64) y 07-71 (contactos,
# página 51) del PDF de la norma.
# ---------------------------------------------------------------------------

def s00146():
    """Bobina de temporizador, retardo a la desconexión - 07-76-07: mismo
    rectángulo que la bobina general (S00130/07-76-01) y que el retardo a
    la conexión (S00143/07-76-08), pero el tercio izquierdo va RELLENO
    NEGRO en vez de cruzado en X — así distingue la norma "retarda al
    activar" (X) de "retarda al desactivar" (relleno)."""
    hoja = "-10.0 -25.0 20.0 50.0"
    c = linea(0, -20, 0, -7.5)
    c += rectangulo(-5, -7.5, 10, 15)
    c += linea(-1.7, -7.5, -1.7, 7.5)
    c += poligono([(-5, -7.5), (-1.7, -7.5), (-1.7, 7.5), (-5, 7.5)], ' fill="#000000"')
    c += linea(0, 7.5, 0, 20)
    return hoja, c, "Bobina de temporizador (retardo a la desconexión)", "IEC 60617 07-76-07"


def s00147():
    """Contacto NA temporizado, retardo a la desconexión - 07-71-16: la
    cuchilla abierta de contacto_na() con el calificador de retardo
    ESPEJADO (retardo_horizontal_invertido) respecto del de S00144."""
    hoja = "-20.0 -25.0 30.0 50.0"
    c = contacto_na()
    c += retardo_horizontal_invertido((-6, -8))
    return hoja, c, "Contacto NA temporizado (retardo a la desconexión)", "IEC 60617 07-71-16"


def s00148():
    """Contacto NC temporizado, retardo a la desconexión - 07-71-18: mismo
    calificador espejado, sobre contacto_nc()."""
    hoja = "-20.0 -25.0 30.0 50.0"
    c = contacto_nc()
    c += retardo_horizontal_invertido((-6, -8))
    return hoja, c, "Contacto NC temporizado (retardo a la desconexión)", "IEC 60617 07-71-18"


# ---------------------------------------------------------------------------
# E67 (pedido del usuario: "con lo demás símbolos"): sensores de proximidad,
# Sección 074 "Dispositivos de Proximidad y Sensibles al Toque" (página 60
# del PDF de la norma) — dispositivos casi universales en un tablero de
# automatismo real (inductivos, capacitivos, fotoeléctricos) que hoy no
# tenían ningún símbolo en la librería.
# ---------------------------------------------------------------------------

def sensor_proximidad(cx, cy, ancho=5.0, alto=4.0):
    """07-74-01: rombo con línea divisoria vertical (dos triángulos) —
    acostado de lado para hacer de actuador de un contacto, mismo patrón
    de composición que actuador_pulsador()/actuador_rotativo()."""
    a, h = ancho / 2.0, alto / 2.0
    c = poligono([(cx - a, cy), (cx, cy - h), (cx + a, cy), (cx, cy + h)])
    c += linea(cx, cy - h, cx, cy + h)
    return c


def s00149():
    """Contacto NA sensible a proximidad - 07-74-06: mismo patrón de
    actuador a la izquierda + enlace horizontal punteado a la mitad de la
    cuchilla que ya usan pulsador (S00135) y selector (S00137), con el
    rombo de sensor de proximidad (07-74-01) en vez de corchete o botón
    giratorio."""
    hoja = "-20.0 -25.0 30.0 50.0"
    c = sensor_proximidad(-15, 0)
    c += linea(-15, 0, -3, 0, PUNTEADO)
    c += contacto_na()
    return hoja, c, "Contacto NA sensible a proximidad", "IEC 60617 07-74-06"


def s00150():
    """Contacto NC sensible a proximidad - por analogía composicional
    (la norma solo lamina la variante NA, 07-74-06): mismo patrón de
    S00149 sobre contacto_nc()."""
    hoja = "-20.0 -25.0 30.0 50.0"
    c = sensor_proximidad(-15, 0)
    c += linea(-15, 0, -3, 0, PUNTEADO)
    c += contacto_nc()
    return hoja, c, "Contacto NC sensible a proximidad", "IEC 60617 07-74-06 (análogo sobre contacto NC)"


# ---------------------------------------------------------------------------
# E68 (continuación de "con lo demás símbolos"): termostato, Sección 072
# "Seccionadores sensibles a la temperatura" (página 54 del PDF) — sensor
# de temperatura sobre un contacto común, mismo criterio de simulación que
# interruptor de posición y sensor de proximidad.
# ---------------------------------------------------------------------------

def qualif_temperatura(cx, cy, rx=2.6, ry=3.4):
    """07-72-11/12: "θ" dentro de un óvalo — calificador de temperatura
    de operación, distingue un contacto sensible a la temperatura
    (termostato) de un contacto auxiliar común. Mismo patrón que
    qualif_posicion(): un glifo chico al costado del contacto, sin
    enlace ni línea de conexión (a diferencia de pulsador/selector/
    sensor de proximidad, que SÍ llevan un actuador con enlace)."""
    c = elipse(cx, cy, rx, ry)
    c += texto(cx, cy, "&#952;", 5)
    return c


def s00151():
    """Termostato, contacto de cierre - 07-72-11: contacto NA con el
    calificador de temperatura al costado, mismo patrón que interruptor
    de posición (S00140)."""
    hoja = "-15.0 -25.0 30.0 50.0"
    c = contacto_na()
    c += qualif_temperatura(6, 0)
    return hoja, c, "Termostato NA", "IEC 60617 07-72-11"


def s00152():
    """Termostato, contacto de apertura - 07-72-12: mismo calificador,
    sobre contacto_nc()."""
    hoja = "-15.0 -25.0 30.0 50.0"
    c = contacto_nc()
    c += qualif_temperatura(6, 0)
    return hoja, c, "Termostato NC", "IEC 60617 07-72-12"


# ---------------------------------------------------------------------------
# E69 (corrección del usuario: "no pusiste en el multifilar la parte de
# fuerza... debe haber unipolar, bipolar, tripolar y tetrapolar"). En un
# diagrama MULTIFILAR cada polo se dibuja como una línea propia — al
# contrario del unifilar (una sola línea para todas las fases), que es
# donde vive S00110/S00121/etc. Estos símbolos son la versión multipolar,
# para usar en comando/, del interruptor automático (07-72-21): un polo
# repetido N veces, unidos por el enlace mecánico punteado que ya usa la
# norma para grupos de contactos que operan juntos.
#
# PILOTO: solo interruptor_termomagnetico, en las 4 variantes de polo.
# El resto de los aparatos multipolares (contactor, guardamotores, MCCB,
# diferencial, fusible, portafusible, relé térmico) esperan a que el
# usuario apruebe el criterio de composición antes de escalarlo.
# ---------------------------------------------------------------------------

ESPACIADO_POLO = 10.0  # múltiplo de 5: los centros de cada polo son puntos_conexion, tienen que caer en la grilla (lint_simbolos.py)


def interruptor_automatico_polo(cx=0.0, y_arriba=-30.0, y_abajo=20.0):
    """07-72-21: aspa + cuchilla de UN polo, sin envolvente — mismo
    trazo que ya usa S00121 (MCCB), listo para repetir en variantes
    multipolares."""
    c = linea(cx, y_arriba, cx, -16)
    c += linea(cx - 2, -21, cx + 2, -17)
    c += linea(cx + 2, -21, cx - 2, -17)
    c += linea(cx, -6, cx - 5, -16)
    c += linea(cx, -6, cx, y_abajo)
    return c


def xs_polos(n_polos, espaciado=ESPACIADO_POLO):
    """Centros X de cada polo, centrados en 0."""
    ancho_total = (n_polos - 1) * espaciado
    x0 = -ancho_total / 2.0
    return [x0 + i * espaciado for i in range(n_polos)]


def repetir_polos(dibujar_polo, n_polos, y_link, hoja_min_y, hoja_alto):
    """Generaliza interruptor_multipolar()/contactor_multipolar(): repite
    `dibujar_polo(cx)` (una función que dibuja UN polo centrado en cx)
    `n_polos` veces, agregando el enlace mecánico punteado a la altura
    `y_link` — mismo criterio de composición para cualquier aparato
    multipolar de fuerza dibujado en multifilar (E69/E70/E71...)."""
    xs = xs_polos(n_polos)
    c = ""
    for cx in xs:
        c += dibujar_polo(cx)
    if n_polos > 1:
        c += linea(xs[0], y_link, xs[-1], y_link, PUNTEADO)
    ancho_vb = (xs[-1] - xs[0]) + 20.0 if n_polos > 1 else 20.0
    hoja = f"{xs[0] - 10.0} {hoja_min_y} {ancho_vb} {hoja_alto}"
    return hoja, c


def interruptor_multipolar(n_polos):
    """N polos de interruptor_automatico_polo(), unidos por una línea
    punteada vertical a la altura del aspa — representación normal de
    un interruptor multipolar en un diagrama multifilar: cada polo
    conduce por su cuenta, el enlace punteado indica que abren/cierran
    juntos (mismo mecanismo)."""
    xs = xs_polos(n_polos)
    c = ""
    for cx in xs:
        c += interruptor_automatico_polo(cx)
    if n_polos > 1:
        c += linea(xs[0], -19, xs[-1], -19, PUNTEADO)
    ancho_vb = (xs[-1] - xs[0]) + 20.0 if n_polos > 1 else 20.0
    hoja = f"{xs[0] - 10.0} -35.0 {ancho_vb} 60.0"
    return hoja, c


def s00153():
    return (*interruptor_multipolar(1), "Interruptor termomagnético unipolar (multifilar)", "IEC 60617 07-72-21")


def s00154():
    return (*interruptor_multipolar(2), "Interruptor termomagnético bipolar (multifilar)", "IEC 60617 07-72-21")


def s00155():
    return (*interruptor_multipolar(3), "Interruptor termomagnético tripolar (multifilar)", "IEC 60617 07-72-21")


def s00156():
    return (*interruptor_multipolar(4), "Interruptor termomagnético tetrapolar (multifilar)", "IEC 60617 07-72-21")


# ---------------------------------------------------------------------------
# E70 (continúa el escalado de E69, ya aprobado): contactor multipolar.
# Mismo criterio de composición, pero el trazo de UN polo es el "contacto
# principal de contactor" (07-70-01, semicírculo) que ya usa S00112 —
# SIN la bobina: la bobina vive aparte, como símbolo de comando (S00130),
# vinculada por `referencia` (mismo mecanismo que ya usan E62/64/65).
# ---------------------------------------------------------------------------

def contactor_polo(cx=0.0, y_arriba=-20.0, y_abajo=20.0):
    """07-70-01: semicírculo (calificador de contactor) + cuchilla —
    UN polo del contacto principal, mismo trazo que S00112 (unifilar)
    sin el rectángulo de bobina."""
    c = linea(cx, y_arriba, cx, y_arriba + 10.0)
    c += polilinea([(cx - 5.0, y_arriba + 10.0), (cx, y_arriba + 30.0), (cx, y_abajo)])
    c += f'  <path d="M {n(cx)},{n(y_arriba + 5.5)} A 2.5,2.5 0 0 0 {n(cx)},{n(y_arriba + 10.5)}"/>\n'
    return c


def contactor_multipolar(n_polos):
    """N polos de contactor_polo(), unidos por el mismo enlace mecánico
    punteado que interruptor_multipolar() — a la altura del semicírculo
    calificador."""
    xs = xs_polos(n_polos)
    c = ""
    for cx in xs:
        c += contactor_polo(cx)
    if n_polos > 1:
        c += linea(xs[0], -12.0, xs[-1], -12.0, PUNTEADO)
    ancho_vb = (xs[-1] - xs[0]) + 20.0 if n_polos > 1 else 20.0
    hoja = f"{xs[0] - 10.0} -25.0 {ancho_vb} 50.0"
    return hoja, c


def s00157():
    return (*contactor_multipolar(1), "Contactor unipolar (multifilar)", "IEC 60617 07-70-01")


def s00158():
    return (*contactor_multipolar(2), "Contactor bipolar (multifilar)", "IEC 60617 07-70-01")


def s00159():
    return (*contactor_multipolar(3), "Contactor tripolar (multifilar)", "IEC 60617 07-70-01")


def s00160():
    return (*contactor_multipolar(4), "Contactor tetrapolar (multifilar)", "IEC 60617 07-70-01")


# ---------------------------------------------------------------------------
# E71 (continúa el escalado de E69/E70): guardamotores multipolares.
# Mismo criterio: un polo repetido N veces + enlace mecánico punteado, a
# la altura del aspa (igual que interruptor_multipolar). El trazo de un
# polo es el que ya usan S00122 (termomagnético, dos cajas de disparo) y
# S00133 (magnético, una sola caja) en la librería de fuerza.
# ---------------------------------------------------------------------------

def guardamotor_termomagnetico_polo(cx=0.0):
    """Aspa + cuchilla + caja de disparo térmico + caja de disparo
    magnético — mismo trazo que S00122, UN polo."""
    p0, p1 = (cx, -12.0), (cx - 5.0, -22.0)
    c = linea(cx, -30, cx, -22)
    c += linea(cx - 2, -28, cx + 2, -24)
    c += linea(cx + 2, -28, cx - 2, -24)
    c += linea(p0[0], p0[1], p1[0], p1[1])
    c += linea(cx, -12, cx, -10)
    c += rectangulo(cx - 5, -10, 10, 10)
    c += efecto_termico(cx, -5, 6.0)
    c += linea(cx, 0, cx, 2)
    c += rectangulo(cx - 5, 2, 10, 10)
    c += efecto_electromagnetico(cx, 7, 6.0)
    c += linea(cx, 12, cx, 20)
    return c


def guardamotor_magnetico_polo(cx=0.0):
    """Aspa + cuchilla + una sola caja de disparo magnético — mismo
    trazo que S00133, UN polo."""
    p0, p1 = (cx, -12.0), (cx - 5.0, -22.0)
    c = linea(cx, -30, cx, -22)
    c += linea(cx - 2, -28, cx + 2, -24)
    c += linea(cx + 2, -28, cx - 2, -24)
    c += linea(p0[0], p0[1], p1[0], p1[1])
    c += linea(cx, -12, cx, -5)
    c += rectangulo(cx - 5, -5, 10, 10)
    c += efecto_electromagnetico(cx, 0, 6.0)
    c += linea(cx, 5, cx, 20)
    return c


def s00161():
    return (*repetir_polos(guardamotor_termomagnetico_polo, 1, -26.0, -35.0, 60.0), "Guardamotor termomagnético unipolar (multifilar)", "IEC 60617 07-72-21 + 03-30-37 + 03-30-38")


def s00162():
    return (*repetir_polos(guardamotor_termomagnetico_polo, 2, -26.0, -35.0, 60.0), "Guardamotor termomagnético bipolar (multifilar)", "IEC 60617 07-72-21 + 03-30-37 + 03-30-38")


def s00163():
    return (*repetir_polos(guardamotor_termomagnetico_polo, 3, -26.0, -35.0, 60.0), "Guardamotor termomagnético tripolar (multifilar)", "IEC 60617 07-72-21 + 03-30-37 + 03-30-38")


def s00164():
    return (*repetir_polos(guardamotor_termomagnetico_polo, 4, -26.0, -35.0, 60.0), "Guardamotor termomagnético tetrapolar (multifilar)", "IEC 60617 07-72-21 + 03-30-37 + 03-30-38")


def s00165():
    return (*repetir_polos(guardamotor_magnetico_polo, 1, -26.0, -35.0, 60.0), "Guardamotor magnético unipolar (multifilar)", "IEC 60617 07-72-21 + 03-30-38")


def s00166():
    return (*repetir_polos(guardamotor_magnetico_polo, 2, -26.0, -35.0, 60.0), "Guardamotor magnético bipolar (multifilar)", "IEC 60617 07-72-21 + 03-30-38")


def s00167():
    return (*repetir_polos(guardamotor_magnetico_polo, 3, -26.0, -35.0, 60.0), "Guardamotor magnético tripolar (multifilar)", "IEC 60617 07-72-21 + 03-30-38")


def s00168():
    return (*repetir_polos(guardamotor_magnetico_polo, 4, -26.0, -35.0, 60.0), "Guardamotor magnético tetrapolar (multifilar)", "IEC 60617 07-72-21 + 03-30-38")


# ---------------------------------------------------------------------------
# E73 (continúa el escalado de E69/E70/E71): MCCB multipolar. Usa el mismo
# aspa+cuchilla por polo que interruptor_automatico_polo() (extraído de
# S00121), pero NO se puede usar repetir_polos(): a diferencia de
# interruptor/contactor/guardamotor, el envolvente moldeado del MCCB es UNA
# sola caja física compartida por todos los polos, no una por polo — por
# eso el rectángulo se dibuja una vez, con el ancho de los N polos, en vez
# de repetirse dentro de dibujar_polo().
# ---------------------------------------------------------------------------

def mccb_multipolar(n_polos):
    """N polos de interruptor_automatico_polo() encerrados en UN
    envolvente moldeado compartido (mismo trazo de caja que S00121,
    extendido al ancho de los N polos). Enlace mecánico punteado a la
    altura del aspa, igual que interruptor_multipolar()."""
    xs = xs_polos(n_polos)
    ancho_caja = (xs[-1] - xs[0]) + 16.0
    x_caja = xs[0] - 8.0
    c = rectangulo(x_caja, -24, ancho_caja, 38)
    for cx in xs:
        c += interruptor_automatico_polo(cx)
    if n_polos > 1:
        c += linea(xs[0], -19, xs[-1], -19, PUNTEADO)
    ancho_vb = (xs[-1] - xs[0]) + 20.0 if n_polos > 1 else 20.0
    hoja = f"{xs[0] - 10.0} -35.0 {ancho_vb} 60.0"
    return hoja, c


def s00169():
    return (*mccb_multipolar(1), "Interruptor automático en caja moldeada unipolar (multifilar)", "IEC 60617 07-72-21 en envolvente")


def s00170():
    return (*mccb_multipolar(2), "Interruptor automático en caja moldeada bipolar (multifilar)", "IEC 60617 07-72-21 en envolvente")


def s00171():
    return (*mccb_multipolar(3), "Interruptor automático en caja moldeada tripolar (multifilar)", "IEC 60617 07-72-21 en envolvente")


def s00172():
    return (*mccb_multipolar(4), "Interruptor automático en caja moldeada tetrapolar (multifilar)", "IEC 60617 07-72-21 en envolvente")


SIMBOLOS_COMANDO = {
    "S00124": s00124, "S00130": s00130, "S00134": s00134, "S00135": s00135,
    "S00136": s00136, "S00137": s00137, "S00139": s00139,
    "S00140": s00140, "S00141": s00141, "S00142": s00142, "S00143": s00143,
    "S00144": s00144, "S00145": s00145, "S00146": s00146, "S00147": s00147,
    "S00148": s00148, "S00149": s00149, "S00150": s00150, "S00151": s00151,
    "S00152": s00152, "S00153": s00153, "S00154": s00154, "S00155": s00155,
    "S00156": s00156, "S00157": s00157, "S00158": s00158, "S00159": s00159,
    "S00160": s00160, "S00161": s00161, "S00162": s00162, "S00163": s00163,
    "S00164": s00164, "S00165": s00165, "S00166": s00166, "S00167": s00167,
    "S00168": s00168, "S00169": s00169, "S00170": s00170, "S00171": s00171,
    "S00172": s00172,
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raiz", type=Path, default=Path(__file__).resolve().parent.parent)
    ap.add_argument(
        "--carpeta",
        type=str,
        default="simbolos",
        help="subcarpeta de libreria-simbolos/ a generar (simbolos = fuerza, comando = mando)",
    )
    args = ap.parse_args()
    base = args.raiz / "libreria-simbolos" / args.carpeta
    simbolos = SIMBOLOS_COMANDO if args.carpeta == "comando" else SIMBOLOS_FUERZA

    for codigo, fn in simbolos.items():
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

    print(f"\n{len(simbolos)} simbolos generados desde la norma")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
