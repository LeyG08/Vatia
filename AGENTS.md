# AGENTS.md

## Flujo de Git para este proyecto

- Antes de tocar cualquier símbolo o proyecto, crear una rama:
  - `simbolo/<codigo-iec>-<AAAAMMDD>` si se modifica un símbolo
  - `proyecto/<nombre>-<AAAAMMDD>` si se modifica un unifilar guardado
- Al terminar un cambio, generar el mensaje de commit comparando el JSON
  anterior contra el nuevo: listar qué campos cambiaron, no un mensaje genérico.
  Ejemplo: `fix(S00110): corrige punto de conexión "out" y agrega Ics_kA`
- Nunca hacer commit directo a main.
- Al finalizar la sesión, abrir un Pull Request hacia main con `gh pr create`,
  incluyendo en la descripción el diff de campos modificados.
- NO mergear el PR por cuenta propia, ni siquiera con build/lint/scripts
  en verde: mostrar el resultado al usuario y esperar su aprobación.
  Solo mergear cuando el usuario lo ordene de forma explícita
  ("aprobado", "mergeá el PR N", etc.), usando
  `gh pr merge <n> --merge --delete-branch` y sincronizando main local
  después. En ese caso, dejar el PR abierto como registro pendiente.

## Historial del desarrollo (HISTORIAL.md)

- El archivo `HISTORIAL.md` en la raíz registra cronológicamente todo
  el trabajo del proyecto, organizado en fases (F0, F1, F2, ...) con
  fecha y hora de cada cambio.
- ACTUALIZARLO EN CADA INTERACCIÓN donde se haga algo: cambios nuevos,
  modificaciones sobre lo anterior, cosas deshechas o revertidas,
  decisiones del usuario, verificaciones corridas y PRs abiertos o
  mergeados (número, hash, hora).
- Si algo queda deshecho o cambia de rumbo, registrar la reversión sin
  borrar el registro original: el historial es un apéndice cronológico,
  no una reescritura.
- Debe poder usarse para retomar contexto rápido y para consultar a
  otras IA: incluir horas, archivos tocados, cómo se hizo y qué
  verificaciones pasaron.

## Regla de alineación a grilla (símbolos)

- Todo símbolo de `libreria-simbolos/simbolos/` debe pasar
  `python scripts/lint_simbolos.py` ANTES de commitear. El hook
  pre-commit lo corre automáticamente cuando el commit toca la librería
  activa y bloquea si falla.
- El lint exige: viewBox con ancho/alto enteros pares; cada
  `puntos_conexion.x/y` tal que coordenada × ESCALA sea múltiplo de 10;
  y lo mismo para las coordenadas relativas al origen del viewBox
  (es lo que determina dónde cae el handle en el canvas del editor).
- En la práctica: mantener todos los puntos de conexión y orígenes de
  viewBox en múltiplos de 5 unidades. Al dibujar a mano, elegir viewBox
  con origen múltiplo de 5; `convertir_qet.py` ya alinea solo la salida
  (traslada geometría y recentra el viewBox) y falla si los terminales
  de origen son incongruentes entre sí.

## Formato de mensajes de commit

- Primera línea (asunto): máximo ~72 caracteres, formato
  `tipo(alcance): resumen corto de una sola acción`.
- Línea en blanco.
- Cuerpo: lista de qué cambió y por qué, con el detalle que haga falta
  (por ejemplo, qué símbolos se vieron afectados y la justificación
  de cada cambio conforme AEA/IEC).

Ejemplo de cómo debería quedar un commit a partir de ahora:

```
fix(S00110,S00114): unifica termomagnético y ajusta superposición transformador

- S00111 (variante 3P+N) eliminado: la cantidad de polos se define
  por instancia en cantidad_polos de la ficha técnica, no con
  símbolos derivados.
- S00114 pasa de círculos tangentes a superpuestos, conforme IEC 60617.
- Galería regenerada con 7 símbolos.
```
