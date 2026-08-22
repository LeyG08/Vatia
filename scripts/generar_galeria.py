#!/usr/bin/env python3
"""Genera libreria-simbolos/simbolos/index.html con la galería de símbolos convertidos.

Uso:
  python generar_galeria.py --simbolos-dir E:\\Vatia\\libreria-simbolos\\simbolos
"""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

BADGE = {
    "pendiente_revision": ("pendiente de revisión", "#b45309", "#fef3c7"),
    "verificado_aea": ("verificado AEA", "#15803d", "#dcfce7"),
    "corregido": ("corregido", "#1d4ed8", "#dbeafe"),
}


def tarjeta(carpeta: Path) -> str:
    meta_path = carpeta / "metadata.json"
    svg_path = carpeta / "simbolo.svg"
    if not meta_path.exists() or not svg_path.exists():
        return ""
    datos = json.loads(meta_path.read_text(encoding="utf-8"))
    estado = datos.get("estado_revision", "pendiente_revision")
    texto_badge, color_fg, color_bg = BADGE.get(estado, (estado, "#444", "#eee"))
    terminales = "<br>".join(
        f'{html.escape(t["id"])} · {html.escape(t["rol"])} · ({t["x"]:g}, {t["y"]:g})'
        for t in datos.get("puntos_conexion", [])
    ) or "—"
    return f"""
    <article class="tarjeta">
      <header>
        <span class="codigo">{html.escape(datos.get("codigo_iec", "?"))}</span>
        <span class="badge" style="color:{color_fg};background:{color_bg}">{texto_badge}</span>
      </header>
      <div class="lienzo"><img src="{carpeta.name}/simbolo.svg" alt="{html.escape(datos.get('nombre', ''))}"></div>
      <h2>{html.escape(datos.get("nombre", ""))}</h2>
      <dl>
        <dt>Familia</dt><dd>{html.escape(datos.get("familia_atributos", ""))}</dd>
        <dt>Terminales</dt><dd class="mono">{terminales}</dd>
        <dt>Versión librería</dt><dd>{html.escape(datos.get("version_libreria", ""))}</dd>
        <dt>Fuente QET</dt><dd class="mono fuente">{html.escape(datos.get("fuente_qet", ""))}</dd>
      </dl>
    </article>"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--simbolos-dir", required=True, type=Path)
    args = parser.parse_args()

    carpetas = sorted(p for p in args.simbolos_dir.iterdir() if p.is_dir())
    tarjetas = "".join(tarjeta(c) for c in carpetas)

    pagina = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vatia · Galería de símbolos — revisión AEA / IEC 60617</title>
<style>
  :root {{ --borde: #e2e8f0; }}
  body {{ font-family: system-ui, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }}
  header.pagina {{ padding: 24px 32px; border-bottom: 1px solid var(--borde); background: #fff; }}
  header.pagina h1 {{ margin: 0; font-size: 20px; }}
  header.pagina p {{ margin: 4px 0 0; color: #64748b; font-size: 14px; }}
  main {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; padding: 28px 32px; max-width: 1400px; margin: auto; }}
  .tarjeta {{ background: #fff; border: 1px solid var(--borde); border-radius: 10px; padding: 16px; }}
  .tarjeta header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }}
  .codigo {{ font-family: ui-monospace, monospace; font-weight: 600; }}
  .badge {{ font-size: 12px; padding: 2px 10px; border-radius: 999px; }}
  .lienzo {{ height: 220px; display: flex; align-items: center; justify-content: center;
             background:
               linear-gradient(to right, #f1f5f9 1px, transparent 1px),
               linear-gradient(to bottom, #f1f5f9 1px, transparent 1px);
             background-size: 14px 14px; border: 1px dashed var(--borde); border-radius: 8px; }}
  .lienzo img {{ max-height: 200px; max-width: 90%; image-rendering: auto; }}
  h2 {{ font-size: 15px; margin: 12px 0 8px; }}
  dl {{ display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; margin: 0; }}
  dt {{ color: #64748b; }}
  dd {{ margin: 0; overflow-wrap: anywhere; }}
  .mono {{ font-family: ui-monospace, monospace; font-size: 12px; }}
  .fuente {{ color: #64748b; }}
</style>
</head>
<body>
<header class="pagina">
  <h1>Vatia · Galería de símbolos ({len(carpetas)})</h1>
  <p>Revisión manual contra AEA / IEC 60617-11 · puntos en <span style="color:#e11d48">●</span> rojo = puntos_conexion · estado y notas en docs/estado-revision-aea.md</p>
</header>
<main>{tarjetas}
</main>
</body>
</html>
"""
    ruta = args.simbolos_dir / "index.html"
    ruta.write_text(pagina, encoding="utf-8")
    print(f"galería generada: {ruta} ({len(carpetas)} símbolos)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
