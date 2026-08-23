# HISTORIAL.md — Registro cronológico del desarrollo

> **Propósito.** Registro cronológico de todo lo hecho en el proyecto
> (cambios, deshagos, reversiones, decisiones y verificaciones),
> organizado en fases. Sirve para retomar contexto rápido y como fuente
> de consulta para otras IA.
>
> **Regla de mantenimiento (obligatoria, ver AGENTS.md).** Se actualiza
> en CADA interacción donde se haga algo: cambios nuevos,
> modificaciones, cosas deshechas/revertidas, decisiones del usuario,
> verificaciones y PRs (número + hash + hora). Las reversiones se
> registran sin borrar el registro original: este archivo es un apéndice
> cronológico, no una reescritura.

---

## Contexto rápido del proyecto (para cualquier IA que lea esto)

- **Proyecto:** Vatia — editor web de diagramas unifilares eléctricos
  para tableros (contexto PPS real: planos de tableros TS-G1, TS-G2,
  TGBT, etc., estilo Vatia/industrial argentino, normas IRAM/AEA/IEC).
- **Stack:** React 19 + TypeScript + Vite 8; grafo con `@xyflow/react`;
  estado con zustand; lint con oxlint.
- **Rutas clave** (`E:\Vatia`):
  - `apps/editor/src/lib/tipos.ts` — tipos base (HojaConfig,
    RotuloConfig, AlimentadorConfig, NodoProyecto, PX_POR_MM=4,
    márgenes IRAM 4504).
  - `apps/editor/src/lib/store.ts` — estado global (nodos, conexiones,
    hoja, historial undo/redo, ESCALA=2 px/unidad viewBox).
  - `apps/editor/src/componentes/` — HojaNode (plantilla+cajetín),
    NodoSimbolo, AlimentadorNode, PanelHoja, Paleta.
  - `libreria-simbolos/simbolos/` — SVGs + metadata JSON de símbolos
    IEC (S00110…S00119).
  - `scripts/` — verificar_alineacion.mjs, lint_simbolos.py,
    convertir_qet.py, generar_galeria.py.
- **Verificación estándar antes de commitear:** `npm run build`,
  `npm run lint`, `node scripts/verificar_alineacion.mjs`,
  `python scripts/lint_simbolos.py`.
- **Quirk de entorno:** `gh` no está en PATH de pwsh; usar
  `"C:\Program Files\GitHub CLI\gh.exe"`. Python a veces da MemoryError
  con pymupdf sobre PDFs pesados: reintentar tras `Start-Sleep`; los
  scripts Python deben hacer
  `sys.stdout.reconfigure(encoding='utf-8', errors='replace')`.

---

## Índice de fases

| Fase | Tema | Estado | Ventana horaria |
|------|------|--------|-----------------|
| F0 | Análisis de planos reales del PPS | completada | 23/08/2026 ~00:30–01:07 |
| F1 | Hoja finita como único espacio de trabajo | mergeada (PR #5) | 23/08/2026 ~00:39–00:48 |
| F2 | Rótulo "según planos reales" (sin cajetín) | SUPERADA por F3 (PR #6) | 23/08/2026 ~01:00–01:08 |
| F3 | Corrección: rótulo IRAM 4508 conforme + alimentadores conectables | mergeada (PR #7) | 23/08/2026 01:10–01:38 |
| F4 | HISTORIAL.md + reversión política de merge | mergeada (PR #8) | 23/08/2026 ~02:0x |
| F5 | Notas de gabinete fijas + ajustes finos del cajetín | mergeada (PR #9) | 23/08/2026 ~02:xx |
| F6 | Multi-hoja v2 (pestañas, undo por hoja, viewport por hoja) | mergeada (PR #10) | 23/08/2026 |
| FC | Fase C: formularios de atributos técnicos (schemas → panel) | EN CURSO (rama `proyecto/fase-c-atributos-20260823`) | 23/08/2026 |

Trabajo previo a esta sesión (resumen de referencia): creación del
editor mínimo (PR #1/#2, noche 22/08 ~20:16–21:12), símbolos IEC con
lint de grilla y rótulo IRAM inicial (PR #3, 22:02–22:16), primera
versión de cajetín IRAM 4508 (PR #4, 23:41).

---

## Fase 0 — Análisis de los planos reales del PPS

**Ventana:** 23/08/2026, ~00:30–01:07 (continuación de análisis empezado
la noche del 22/08). Artefactos en
`C:\Users\augug\AppData\Local\Temp\opencode\pps\`.

**Objetivo:** determinar cómo identifican las láminas los unifilares
reales del proyecto (¿llevan cajetín IRAM?) para decidir qué plantilla
de hoja imitar.

### Cambios / hallazgos (con hora cuando hay evidencia)

- **~00:30–00:38 — Extracción con pymupdf** de los PDFs reales:
  - PDF provisional "Unifilares de Tableros (PROV).pdf" (6 páginas):
    volcado a PNG+TXT por página (`unifilar_p1..p6.png/.txt`, mtime
    00:38). Hubo MemoryError por presión de pagefiles; se resolvió con
    reintentos pausados (`Start-Sleep` entre corridas).
  - **Hallazgo clave:** la esquina inferior derecha NO tiene cajetín;
    solo pasan segmentos de conductores. Búsqueda de palabras clave de
    cajetín ("empresa", "proyecto", "escala", "fecha", etc.) → **cero
    coincidencias** en ambos PDFs.
- **00:53–00:56 — Scripts de análisis** (`analiza_rotulo.py`,
  `bloques.py`, `cajas.py`):
  - `bloques.py`: búsqueda de bloques/tablas en página completa (bug
    conocido: no aplicaba rotación de página).
  - `cajas.py`: detección de rectángulos cerrados >35×8 mm con texto
    interno → **ningún rectángulo cerrado** (los marcos son trazos
    sueltos).
- **~00:58–01:05 — Origen de los PDFs:** lectura de `plot.log` y
  `Unifilares de Tableros.dsd`: los PDF salieron de AutoCAD
  (`Unifilar Tablero.dwg`) ploteados desde **Model space** a escalas
  extrañas; existen layouts por tablero (TGBT, TS-G1, TS-G2, TS-G3,
  TS-BC, TS-CD) pero casi no se usaron. Escaneo binario del DWG
  (UTF-16LE): cadenas sueltas "PLANO", "REV", "Proyecto" (offset
  165814), sin cajetín estructurado.
- **~01:05–01:07 — PDF de bóveda (28 páginas)** "Unifilares de
  Tableros.pdf": una lámina por tablero con títulos tipo
  `TS-LucesGalpon1`, `TS-TallerManuel`, `TS-Matriceria`, `TS-PET1`,
  `TS-Sopladora*`, tamaños mezclados A3 horizontal / A4 vertical.
- **Geometría del encabezado TS-G1** (página 2): marco trazado bbox
  (33.7,48.7)-(410.2,287.0) mm; título "TS-G1" centrado arriba (x≈182,
  y≈−8 mm relativo al trazo); alimentaciones "Desde TGBT"/"Desde PAT";
  referencias de conductores "3x1x70mm²+1x1x70mm²", "Cu/PVC IRAM 2178";
  notas de gabinete arriba-izquierda (texto exacto capturado: autoportante,
  Clase I, BA4/BA5, IP00, barras Cu desnudo, 0% reserva).
- **Conclusión F0:** los planos reales NO usan cajetín IRAM; usan
  encabezado central (tablero + "Desde …") + notas laterales. Esto
  motivó F1/F2, y luego la corrección del usuario en F3.

---

## Fase 1 — Hoja finita como único espacio de trabajo (PR #5)

**Ventana:** ~00:39–00:48 · commit `f7b6ce6` (00:47:46) · merge
`76875ee` (00:48:11) · rama `proyecto/hoja-finita-20260823`.

**Qué se hizo:**

- La hoja pasó a ser un espacio FINITO: formatos serie A (A4–A0,
  `TAMANIOS_HOJA_MM`), orientación h/v, `PX_POR_MM = 4`.
- Enmarcado según IRAM 4504: margen izquierdo 25 mm (archivado), resto
  10 mm (`rectanguloUtil` define el rectángulo útil en px).
- El viewport no puede escapar de la lámina (`translateExtent`), los
  nodos quedan dentro (`nodeExtent`) y al arrastrar se re-encierran al
  marco útil (`limitarAHoja` con snap a grilla de 10 px).
- Aviso visual "N símbolos fuera del marco útil — pasá el contenido a
  otra hoja" (clase `.nodo-fuera-hoja`, `.aviso-fuera-hoja`).
- Reencuadre automático (`fitView`) al cambiar formato/orientación.
- Panel "Configuración de hoja" (formato, orientación, dimensión leída,
  footer con nota de márgenes).

---

## Fase 2 — Rótulo "según planos reales", sin cajetín (PR #6)

**Ventana:** ~01:00–01:08 · commit `60ed595` (01:08:21) · merge
`9acca50` (01:08:36) · rama `proyecto/rotulo-real-20260823`.

**Decisión del usuario (pregunta explícita):** ante "¿qué hacemos con
el cajetín IRAM?" eligió *"Reemplazarlo por el formato real
(Recomendado)"* → eliminar el cajetín e imitar los planos del PPS.

**Qué se hizo:**

- Se reemplazó `RotuloConfig` por `EncabezadoConfig {tablero,
  alimentadores[]}`; HojaConfig con encabezado central, notas de
  gabinete (6 líneas exactas del plano TS-G1) y nota de seguridad
  operativa al pie.
- `HojaNode.tsx` rediseñado: título del tablero arriba-centro, notas
  izquierda, nota seguridad abajo; todo decorativo (pointer-events
  none). `PanelHoja.tsx` con edición de esos campos + lista de
  alimentadores.
- Error de build corregido durante el desarrollo: paréntesis faltante
  en `bloqueStyle(...)` (TS1005, línea 100).
- Verificaciones en verde (build, oxlint, verificar_alineacion,
  lint_simbolos) antes del push.

> ⚠️ **SUPERADA:** el usuario corrigió después (ver F3): el rótulo IRAM
> 4508 SÍ debía existir, pero conforme a norma. F3 revierte el rumbo de
> F2 (conserva notas/nota-seguridad/título, recupera cajetín).

---

## Fase 3 — Corrección del usuario: rótulo IRAM 4508 conforme + alimentadores conectables (PR #7)

**Ventana:** 01:10–01:38 · commit `a7635b1` (01:37:58) · merge
`d383c93` (01:38:30) · rama `proyecto/rotulo-4508-v2-20260823`.

**Corrección textual del usuario (disparador):**
*"El rótulo va con todas sus características pero estaba mal hecho, no
conforme a la 4508; el encabezado del tablero va un poco más arriba; y
de los alimentadores 'Desde' tiene que salir un conductor con referencias
(3 líneas/neutro/tierra seleccionables o menú desplegable) con nodos para
conectar a los elementos."*

### Investigación normativa (~01:10–01:25)

- Fuentes consultadas: texto OCR de la norma (laguardia.wordpress),
  apuntes UNC/studocu, scribd, manual viejo Villa Constitución, UNSJ
  (binario inútil), anexo escaneado descargado (sin capa de texto,
  inservible para medir: `anexo-rotulo.pdf` + `lee_anexo.py`, 01:15).
- **Confirmado de la norma IRAM 4508:2008:** ancho 175 mm (cláusula
  4.2.2); columnas 26|20|34|40|55 (suma exacta); contorno igual al
  recuadro, internas ≤0,35 mm; 13 campos mínimos; método ISO (E)/(A);
  estructura según figura 2 (tolerancias, responsables ×4, cliente/
  archivo apilados, denominación+logo, escala+ISO(E), nº plano cliente,
  fila final formato/nº/paginación).
- **No conformidad detectada de la versión anterior:** faltaban el
  campo 8 (clave o número de lo representado) y mal tratado el campo 9
  (archivo).
- Alturas de fila no verificables por OCR (fragmentos sugerían
  4×10+20+19) → **se preguntó al usuario**, que aprobó la
  reconstrucción propuesta.

### Decisiones del usuario en esta fase

1. Geometría: *"Usá tu reconstrucción"* → columnas 26/20/34/40/55,
   filas 4×10 + 20 + 19 (alto total 79 mm), 13 campos.
2. Desplegable del alimentador: **todas las combinaciones posibles**
   de líneas/neutro/tierra (incl. solo neutro, solo tierra,
   neutro+tierra) **y además** un modo para declarar **cantidad n de
   conductores**.

### Implementación (~01:25–01:37)

- `tipos.ts`: `AlimentadorConfig {origen, fases, neutro, tierra,
  cantidadN}` + `ALIMENTADOR_POR_DEFECTO()` + `etiquetaConductores()`;
  `ResponsableRotulo`; `RotuloConfig` completa (13 campos);
  `HojaConfig {formato, orientacion, tablero, notasGabinete,
  notaSeguridad, rotulo}`; `NodoProyecto` extendido con
  `tipo?: "simbolo"|"alimentador"` y `datos?`.
- `store.ts`: `DatosSimbolo | DatosAlimentador` (unión tipada),
  `tamanoNodoPx()`, `agregarAlimentador()` (default debajo de notas,
  escalonado), `actualizarDatosAlimentador()` (con undo),
  `fusionarHoja()` valida todo y **migra proyectos viejos**
  (`encabezado.alimentadores` → nodos), copiar/pegar/rotar/serializar/
  cargar adaptados.
- `HojaNode.tsx`: cajetín grid CSS 700×316 px (175×79 mm) pegado al
  vértico inferior derecho del recuadro; **título del tablero subido
  encima del recuadro** (`top: −7 mm`); nota seguridad acotada a
  120 mm para no pisar el cajetín.
- Nuevo `AlimentadorNode.tsx`: tarjeta "Desde ___" con select de
  combinaciones (L/LN/LT/LNT/N/T/NT/—/"n"), input n condicional, tag
  de referencia derivado, Handle source inferior id `salida`.
- `App.tsx`: nodeTypes + guard de tamaño genérico; `Paleta.tsx`:
  sección "Alimentación" con botón "+ Alimentador «Desde …»";
  `PanelHoja.tsx`: fuera lista de alimentadores (ahora son nodos),
  dentro sección "Rótulo IRAM 4508" completa (incl. tabla de
  responsables); `estilos.css`: estilos de tarjeta alimentador, tabla
  responsables, dos-col.
- Bugs corregidos durante el build: `Fragment` importado como type
  (TS1361) ×2; predicados `esDatosAlimentador` pasados a `.filter` de
  nodos en vez de datos (TS2769) ×2; cast sin `tipo` en migración.
- UX: posición default del alimentador movida de y=40 a y=r.y0+170
  para no tapar las notas del gabinete.

**Verificación final (todo verde):** `npm run build` ✓ · `npm run lint`
✓ · `node scripts/verificar_alineacion.mjs` ✓ (incluye round-trip
serializar/cargar) · `python scripts/lint_simbolos.py` ✓.

---

## Fase 4 — HISTORIAL.md + reversión de la política de merge (PR #8, MERGEADO)

**Ventana:** 23/08/2026, inmediatamente después de F3.

**Pedido del usuario:**

1. Crear este historial cronológico por fases y mantenerlo actualizado
   siempre (regla permanente).
2. **Revertir** la política de merge de `AGENTS.md`: volver a que el
   USUARIO apruebe cada PR antes de mergear (pudiendo ordenar el merge
   explícitamente cuando quiera), eliminando el auto-merge post-build.

**Hecho:**

- Investigación del cambio original: la política anterior decía
  *"No mergear el PR. Eso lo hace el usuario manualmente."* y fue
  cambiada a auto-merge en el commit `dc03f8e` (22/08/2026 23:41:24,
  dentro del PR #4).
- `AGENTS.md`: restaurada la aprobación previa del usuario (merge solo
  por orden explícito, con `gh pr merge <n> --merge --delete-branch` +
  sync de main) y agregada la sección "Historial del desarrollo"
  que obliga a actualizar este archivo en cada interacción.
- Creado este `HISTORIAL.md`.
- PR #8 (`docs/historial-y-politica-merge-20260823`, commits `3e6e021`
  y `59467fe`) → **aprobado explícitamente por el usuario** y mergeado
  (merge commit `00556bb`). Primera aplicación de la política: el
  merge se ejecutó solo tras el "Aprobado" del usuario.

---

## Fase 5 — Notas de gabinete fijas + ajustes finos del cajetín (EN CURSO)

**Ventana:** 23/08/2026, inmediatamente después del merge del PR #8.

**Pedido del usuario (correcciones antes de continuar):**

1. Subir unos 5 puntos (≈5 mm) las notas del gabinete.
2. Dejar ESTRUCTURA FIJA para las notas del gabinete: material del
   gabinete, clase de aislación, personal apto para operar, grado de
   protección IP, barras o conductores interiores, y reserva futura.
3. Mover el rótulo medio punto hacia abajo y hacia la derecha.
4. Achicar la cuadrícula inferior del rótulo (formato / nº plano /
   pág.) porque su contenido no es más grande que el tamaño de letra.
5. Con el espacio liberado y achicando también la banda superior
   (escala / nº plano cliente), agregar debajo una franja para la
   **denominación del plano ocupando el ancho completo**.

**Implementación:**

- `tipos.ts`: nueva `NotasGabineteConfig` con los seis campos fijos
  (material, claseAislacion, personalApto, gradoProteccion,
  barrasOConductores, reservaFutura) + `NOTAS_GABINETE_POR_DEFECTO()`
  con los textos estándar de los planos reales; `HojaConfig.notasGabinete`
  pasa de `string[]` a esta estructura.
- `store.ts`: `fusionarHoja()` valida campo a campo (los proyectos que
  guardaban lista libre de strings vuelven a defaults); `actualizarHoja`
  acepta y fusiona parcialmente `notasGabinete`.
- `HojaNode.tsx`:
  - Notas dibujadas desde la estructura fija en orden, subidas de
    `top: mm(16)` a `top: mm(11)` (−5 mm).
  - Rótulo desplazado **medio punto** (interpretado 0,5 mm = 2 px)
    hacia abajo/derecha (`right: −2, bottom: −2`) para fundir su
    contorno con el recuadro.
  - Nueva geometría de filas: `[10,10,10,10,12,10,8]` = **70 mm**
    (antes 4×10+20+19 = 79). Zona derecha de arriba pasa a ser
    logo/empresa; fila escala/nº-cliente reducida a 12 mm; franja
    **"Denominación del plano" a ancho completo** de 10 mm; fila final
    formato/nº-plano/pág. reducida a 8 mm.
- `PanelHoja.tsx`: textarea libre reemplazado por seis campos fijos
  (material, clase de aislación, personal apto, IP, barras/conductores,
  reserva futura).

**Correcciones de revisión del usuario (2ª vuelta, misma fase):**

- **Bug de alineo del rótulo resuelto**: el contenedor grid tenía
  `width/height` exactos a la suma de pistas pero `box-sizing:
  border-box` con borde de 2 px → las pistas desbordaban 4 px el
  content box y las líneas internas no cerraban contra el contorno
  (visible distinto según formato/zoom). Fix: sin width/height fijos,
  la grilla se dimensiona desde sus pistas (content-box) → cierra
  siempre, en cualquier hoja.
- **Notas del gabinete**: subidas otros ~10 px (top pasa de mm(11) a
  `mm(8.5)`) y ahora se imprimen con **etiqueta fija en negrita**
  ("Material: …", "Clase de aislación: …", etc.) para que la estructura
  fija sea visible en el plano; maxWidth ampliado a 105 mm.
- **Letra del rótulo +2 px** (`FUENTE_EXTRA_PX = 2`) en etiquetas y
  valores de todas las celdas; la fila final pasa de 8 a 10 mm para
  que entre la letra más grande (alto total: 72 mm).
- Limpieza de bordes dobles contra el contorno: celdas del borde
  derecho/inferior ya no dibujan su línea interna (`sinDerecha` /
  `sinAbajo` en CeldaRotulo).

**Correcciones de revisión del usuario (3ª vuelta, misma fase):**

- **Puntos de la hoja alineados a la grilla real**: el puntillado
  estaba centrado a 5 px de los múltiplos de 10 (por eso recuadro,
  rótulo y símbolos se veían «corridos» medio punto). Ahora los
  centros de los puntos caen sobre las líneas de la grilla
  (`background-position: -5px -5px`).
- **Recuadro cuadrado con los puntos en cualquier formato**: las
  dimensiones px de la hoja se redondean a múltiplos de 10 (A4
  horizontal: 1188→1190; desvío de aspecto < 0,2 %) y el marco se monta
  1 px hacia afuera para que el eje de su borde de 2 px quede exacto
  sobre la línea de puntos. El rótulo vuelve a `-2/-2` y sus trazas se
  funden píxel a píxel con el recuadro.
- **Título del alimentador a ~16 px** (`.alim-origen`, negrita);
  tarjeta ensanchada 150→172 px (`TAMANO_ALIMENTADOR_PX`) y textos
  internos 11→12 px.
- **Notas del gabinete +2 px** (10→12 px), para lectura cómoda en el
  papel.

**Correcciones de revisión del usuario (4ª vuelta, misma fase):**

- **Rótulo ancho reducido 1 mm** (175→174 mm; última columna 55→54 mm)
  para que en A4 vertical (ancho útil 698 px) no desborde el recuadro.
- **Sangría interna en celdas del rótulo**: padding horizontal 1→1,5 mm
  (4→6 px) para que el texto respire y no quede pegado a las líneas.
- **Notas del gabinete adaptativas**: en orientación *vertical* usan
  columna angosta (80 mm, izquierda) y dejan libre el centro del unifilar;
  en *horizontal* mantienen 105 mm.

**Correcciones de revisión del usuario (5ª vuelta, misma fase):**

- **Rótulo vuelve a 175 mm** (columna final 54→55 mm): en A4
  vertical el ancho útil es exactamente 175 mm; con 174 mm quedaba
  un hueco de 1 mm entre el borde izquierdo del rótulo y el eje del
  recuadro. Ahora el contorno del rótulo funde píxel a píxel con el
  borde interno del recuadro en ambos vértices inferiores.
- **Sangría completa en todas las celdas del rótulo**: padding
  horizontal 1→1,5 mm también en las celdas personalizadas (cliente,
  logo/empresa) para que el texto respire uniforme.
- **Notas del gabinete a la misma distancia del recuadro que la nota
  de seguridad**: `top: mm(4)` (antes 8,5 mm) para simetría vertical
  respecto de `bottom: mm(4)` de la nota inferior.

**Correcciones de revisión del usuario (6ª vuelta, misma fase):**

- **Rótulo ancho 175,5 mm** (columna final 55→55,5 mm = +2 px):
  en A4 vertical el ancho útil es 175 mm (700 px) pero el recuadro
  tiene borde de 2 px centrado en el límite útil → caja de borde 702 px.
  Con 175 mm el lado izquierdo del rótulo quedaba 2 px por dentro.
  Ahora el contorno del rótulo funde píxel a píxel con el recuadro en
  AMBOS vértices inferiores (left:-2 implícito vía ancho + right:-2).
- **Sangrías diferenciadas en todo el rótulo**:
  * Etiquetas fijas (izquierda): 4 mm
  * Valores cargados (izquierda): 6 mm
  * Textos centrados (denominación, nº plano, pág.): 0 mm
  Aplicado a `CeldaRotulo` y a las celdas personalizadas (cliente,
  logo/empresa).
- **Logo/empresa centrado** con su sangría propia.

**Correcciones de revisión del usuario (7ª vuelta, misma fase):**

- **Rótulo ancho 174,5 mm** (columna final 55,5→54,5 mm): en A4
  vertical el recuadro tiene caja de borde 702 px (700 px útil + 2 px
  borde centrado). El rótulo con content-box necesita pistas de
  698 px (174,5 mm) para que su borde exterior (pistas + 4 px) mida
  702 px y funda con `right:-2` en AMBOS vértices. Ahora coincide
  exacto con el encuadernado.
- **Sangrías reducidas y diferenciadas**:
  * Etiquetas fijas (izquierda): 4→**1,5 mm**
  * Valores a completar (izquierda): 6→**3 mm**
  * Textos centrados (denominación, nº plano, pág.): **0 mm**
  Aplicado en `CeldaRotulo` y celdas personalizadas (cliente, logo).
- **Logo/empresa centrado sin sangría** (justificado central).

**Correcciones de revisión del usuario (8ª vuelta, misma fase):**

- **Sangrías en responsables (proyecto/dibujo/revisó/aprobó)**: ahora
  usan la misma regla que el resto del rótulo — rol (etiqueta) 1,5 mm,
  fecha (valor) 3 mm.
- Rótulo 174,5 mm y sangrías 1,5/3/0 mm confirmados.

**Verificación:** `npm run build` ✓ · `npm run lint` ✓ ·
`node scripts/verificar_alineacion.mjs` ✓ · `python scripts/lint_simbolos.py` ✓.

**Estado:** PR #9 abierto (`proyecto/notas-fijas-cajetin-v3-20260823`,
commits `f685a14`, `6f8d7d1`, `4cca487`, `d9babac`, `b3f3d4c`,
`0748941`, `16f3c9d`, `54dcb9b` + 8ª vuelta) esperando aprobación del
usuario.

---

### FASE 6 — PR #9 MERGEADO (2026-08-23)

**Decisión:** Aprobado por usuario → mergeado en `main` (`a6ee324`).

**Resumen consolidado de la Fase 5 (PR #7 → #9):**
- Rótulo IRAM 4508 conforme: 174,5 mm × 72 mm, columnas 26/20/34/40/54,5,
  contorno fundido píxel a píxel con recuadro en cualquier formato.
- AlimentadorNode con selector de combinación (—/L/LN/LT/LNT/N/T/NT/n)
  y modo "n conductores"; Handle `salida` para conectar.
- Notas del gabinete: 6 campos fijos con etiquetas visibles en negrita,
  posición simétrica 4 mm respecto del recuadro (top/bottom).
- Alineación global: puntos de la hoja centrados en la grilla de 10 px,
  dimensiones redondeadas a múltiplos de 10 px, recuadro montado 1 px
  hacia afuera para que su eje caiga sobre los puntos.
- Título del alimentador a 16 px; tarjeta ensanchada 172 px.
- Sangrías en rótulo: etiquetas 1,5 mm, valores 3 mm, centrados 0 mm.

**Próximos pasos:** Fase 6 multi-hoja (entrada siguiente).

---

### FASE 6 — MULTI-HOJA POR PROYECTO (PR #10, EN CURSO) (2026-08-23)

**Alcance aprobado:** cada tablero puede tener varias hojas; cada hoja es
dueña exclusiva de sus nodos y conexiones (coordenadas locales).

**Decisiones de diseño validadas con el usuario:**
- Modelo de datos v2: `Proyecto { version:2, meta, hojas: Hoja[] }`;
  `Hoja { id UUID, nombre, formato, orientacion, rotulo, notasGabinete,
  notaSeguridad, tablero, nodos[], conexiones[], viewport }`.
- Migración automática v0/v1 → v2 al cargar (`migrarAProyectoV2`, acepta
  objeto o string JSON); `alimentadoresLegado` sigue siendo transitorio
  (nunca se serializa).
- Deshacer/rehacer con pilas POR HOJA (`historial.usar(id)` al cambiar
  de pestaña). Regla universal: un comando se registra en la hoja ACTIVA
  al momento de ejecutarse, sin excepciones.
- Movimiento entre hojas = regla "cortar con aviso": las conexiones
  internas viajan, las que cruzan hojas se cortan; TODO el movimiento es
  UN comando compuesto deshacible en la pila del ORIGEN. Sin cambio
  automático de pestaña (opción 2): toast con accesos [Ir a la hoja] /
  cierre; tras saltar de hoja, Ctrl+Z no lo revierte (vive en el origen).
- `eliminarHoja`: barrido defensivo retenido aunque el invariante
  (extremos en la misma hoja) hace imposible huérfanos; no se permite
  borrar la última hoja; al borrar la activa se salta a la vecina.
- `duplicarHoja` remapea ids de nodos/conexiones para unicidad global.

**Implementación:**
- `tipos.ts`: Hoja/Proyecto, `hojaNuevaDesde`, `migrarAProyectoV2`,
  `serializarProyecto`, `calcularPaginacion(valorUsuario, indice, total)`
  y `numeroPlanoConSufijo(base, indice, total)` — con 1 sola hoja se
  muestra tal cual cargó el usuario.
- `historial.ts`: clase con Map<string,PilaHoja>, límite 100 por pila.
- `store.ts`: estado working = hoja activa + espejo `hoja`; acciones
  agregar/eliminar/duplicar/renombrar/reordenar/cambiarHojaActiva (con
  volcado y restauración de viewport), moverSeleccionAHoja (comando
  compuesto), guardarViewport, cargarProyecto (string|objeto), 
  serializarActual():Proyecto, seleccionarNodos (sin historial).
- UI: `PestanasHoja.tsx` (activar/agregar/duplicar/renombrar doble clic/
  eliminar con confirmación), franja bajo la barra superior; toast verde
  post-movimiento con [Ir a la hoja]; botón "Mover a hoja nueva" en el
  aviso de símbolos fuera del marco útil.
- Rótulo: paginación "X / Y" y nº de plano con sufijo -01/-02… calculados.
- Viewport por hoja: `onMoveEnd` persiste continuo; al cambiar pestaña se
  restaura o fitView si nunca hubo encuadre.
- BarraSuperior: guardar usa `meta.nombre`; abrir acepta v1 y v2.
- `verificar_alineacion.mjs`: serializa y valida formato v2 (invariante
  de extremos en la misma hoja incluido) + round-trip del JSON guardado.

**Verificación:** build ✓ · lint ✓ · verificar_alineacion ✓ ·
lint_simbolos ✓.

**Ajuste tras prueba del usuario (mismo PR #10):** el arrastre llegaba
hasta el borde de la LÁMINA y podía invadir el margen. Quedó así:
- `nodeExtent` = rectángulo útil IRAM (`rectanguloUtil`): límite duro
  del recuadro, no de la lámina; `NODO_HOJA` exento con extent propio.
- Rótulo, notas del gabinete y nota de seguridad son ZONAS RESERVADAS
  (decisión explícita del usuario tras probar): un símbolo no puede
  quedar encima. Al soltarlo ahí REBOTA a su posición previa + toast.
- CAUSA RAÍZ del rebote fallido (primera versión): `confirmarArrastre`
  hace `return` sin ejecutar cuando la posición final coincide con el
  snapshot inicial — exactamente el caso del rebote. FIX: la reversión
  se aplica DIRECTO vía `onNodesChange` (cambios type:"position") sin
  depender del guard; los válidos siguen por el comando normal.
- La colocación desde la PALETA también valida las zonas: si el drop
  cae sobre rótulo/notas se rechaza con toast (no se crea el nodo).
- "Mover a hoja nueva" queda como rescate para: achicar formato u
  orientación, cargar proyectos que no entran en la hoja actual.

---

### FASE 6 — MULTI-HOJA: PR #10 MERGEADO (2026-08-23)

**Decisión:** Aprobado por usuario → mergeado en `main` (`4fdf980`),
rama `proyecto/multi-hoja-fase6-20260823` eliminada.

**Estado resultante:** proyecto multi-hoja v2 completo — pestañas,
pilas de deshacer por hoja, viewport por hoja, movimiento entre hojas
con regla cortar-con-aviso, migración automática de archivos viejos,
paginación automática del rótulo, recuadro útil como límite duro y
rótulo/notas como zonas reservadas con rebote.

---

### FASE C — FORMULARIOS DE ATRIBUTOS TÉCNICOS (2026-08-23)

Rama `proyecto/fase-c-atributos-20260823`. Pasos C1→C6, el usuario
prueba y aprueba cada uno antes del siguiente.

**C1 — Schemas reestructurados (aprobado por usuario):**
- `aparato.schema.json`: discriminado por `tipo_aparato` con 5 subtipos
  (`$defs` + if/then): interruptor_termomagnetico, contactor, fusible,
  motor_trifasico, transformador; campos cerrados
  (`additionalProperties:false`) y anotación propia `x-obligatorio`
  para el Checklist AEA (C5). Ajustes del usuario incorporados:
  PdCC normalizado en kA (ambos), portafusible y fusible como productos
  separados, potencia del motor como par kw/hp con auto-cálculo
  (1 HP = 0,7457 kW) declarado en `x-par-automatico` +
  `x-alguno-obligatorio`. Icu/Ics quedan NOTA PENDIENTE para un futuro
  guardamotor_termomagnetico (IEC 60947-2), registrada en
  `$comment` + docs/estado-revision-aea.md.
- `conductor.schema.json` (C1-bis): la conexión representa un MAZO
  ("3x1x70+1x1x50"): cantidad_conductores (fases 1–3),
  seccion_fase_mm2 obligatoria, neutro/tierra opcionales como boolean
  lleva_* + sección propia SOLO si difiere de fase. Salieron `rol` y
  `color_normalizado` (un mazo mezcla roles); consecuencia anotada:
  la regla futura "conductor sin rol" del checklist C5 ya no aplica,
  validar por atributos del mazo (nota junto a la de Icu/Ics).

**C2 — Mapeo aplicado (aprobado por usuario):** los 5 aparatos llevan
`atributos_base: {"tipo_aparato": ...}` en metadata.json (semilla al
instanciar → el formulario sabe qué schema cargar). S00115 pierde su
vieja semilla `cantidad_fases:3` (redundante con el símbolo y hoy
inválida contra el schema cerrado). S00118 (toma a tierra PE) pasa de
familia "aparato" a NUEVA familia `sin_ficha_tecnica` (nombre elegido
por el usuario sobre "ninguna": describe qué es, no qué no es;
extensible a futuros símbolos decorativos). Enum actualizado en
metadata.schema.json.

**C3 — Generador dinámico de formulario (implementado):**
- `src/lib/esquemas.ts`: importa los schemas vía alias `@libreria`
  (ya existía en vite.config.ts; se agregaron resolveJsonModule+paths
  a tsconfig.app.json) y expone helpers puros: camposDeFamilia()
  resuelve base_comun+$ref por subtipo, algunoObligatorio(),
  parAutomatico(), subtiposAparato().
- `src/componentes/FormularioAtributos.tsx`: renderiza cualquier
  familia desde el schema (text/number/integer/select/boolean),
  marca obligatorios con *, muestra aviso de "al menos uno", y aplica
  auto-conversión kw↔hp leyendo x-par-automatico (sin hardcodear el
  caso motor). Familia sin_ficha_tecnica → mensaje, sin formulario.
- Estilos .form-atributos/.campo-atributo en estilos.css.
- Aún SIN montar: C4 (panel lateral al seleccionar nodo/conexión) lo
  conecta con el store; recién ahí será probable probarlo en vivo.

**Verificación:** lint_simbolos.py ✓ (7 símbolos, valida metadata vs
schema nuevo), npm run build ✓, oxlint ✓, verificar_alineacion.mjs ✓.
Fix durante build: TS infería tipos literales del JSON importado
(`"tipo_aparato": true` no entraba en Record<string,EsquemaCampo>) →
cast único `as unknown as EsquemaRaiz`; y baseUrl deprecado en TS6 →
paths relativos sin baseUrl.

**Bug reportado por el usuario tras C2 ("se rompió el modelo de la
tierra"):** el editor tiene su PROPIA lista cerrada de familias —
`FamiliaAtributos` en tipos.ts y `FAMILIAS` en validadorMetadata.ts —
y al pasar S00118 a `sin_ficha_tecnica` el validador rechazaba su
metadata y el cargador (libreria.ts) descartaba el símbolo entero con
problema de nivel error. FIX: agregar la familia nueva en ambos puntos,
más etiquetas legibles de grupo en la Paleta (Auxiliares/Aparatos/…)
para no mostrar el nombre crudo. Verificación verde de nuevo. Lección:
al extender un enum del schema hay que rastrear sus copias en el
editor (tipos.ts + validadorMetadata.ts).

**C4 — Panel de atributos conectado al store (implementado, a prueba
del usuario):**
- Los atributos ahora VIVEN en el estado React Flow: `DatosSimbolo`
  gana `atributos` (semilla = `atributos_base` del metadata al crear
  y también al cargar proyectos viejos, para que `tipo_aparato` esté
  siempre); las conexiones llevan `data.atributosConductor`. Se
  corrigieron TODOS los caminos que antes las descartaban con `{}`:
  rfANodoProyecto/rfAConexionProyecto (serialización), cargar hoja,
  pegar, duplicarHoja y moverSeleccionAHoja — los atributos viajan con
  copiar/pegar, duplicado de hoja y movimiento entre hojas.
- Acciones nuevas `actualizarAtributosNodo` / `actualizarAtributosConexion`
  con snapshot+undo como el resto de comandos; si el objeto no cambió
  no ensucian el historial.
- `PanelAtributos.tsx`: flotante abajo-derecha dentro del lienzo; se
  muestra con EXACTAMENTE un símbolo seleccionado (usa familia/código
  del metadata) o una conexión (familia conductor). Con selección
  múltiple/nula se oculta. Montado en App.tsx.
- Fix de build: `NODO_HOJA` (nodo lámina) necesitaba `atributos: {}`
  tras volver obligatorio el campo en DatosSimbolo.

**Verificación:** npm run build ✓ · oxlint ✓ · verificar_alineacion.mjs ✓
· lint_simbolos.py ✓.

**Bug reportado por el usuario al probar C4 en dev:** Vite 8
(rolldown) NO resolvió el alias `@libreria/schemas/*.json` en el
servidor de desarrollo (import-analysis "Failed to resolve import"),
aunque `vite build` sí lo empaquetaba. FIX: esquemas.ts pasó a imports
relativos `../../../../libreria-simbolos/schemas/*.json` — la MISMA
convención que ya usaba libreria.ts con import.meta.glob — y se sacó
el mapeo `paths` del tsconfig (quedó solo resolveJsonModule). Verificado
además levantando un dev server efímero: HTTP 200 y resolución a
/@fs/ correcta para los tres schemas. Lección: en este repo, rutas
relativas para salir de apps/editor; no confiar en el alias en dev.

**C4b — Ajustes por prueba del usuario (panel + anotaciones en hoja):**
- Quejas: el panel estaba clavado en la esquina y con tamaño malo, y
  "si los datos no salen en la hoja están al pedo". Cambios:
  1. `PanelAtributos` ahora se ANCLA junto al elemento seleccionado
     (a la derecha del símbolo, usando transform del viewport), es más
     ancho (300px) y se ARRASTRA desde su encabezado (pointer capture;
     el arrastre se resetea al cambiar de selección).
  2. Los atributos se DIBUJAN EN LA HOJA: `lib/anotaciones.ts`
     formatea líneas al estilo de los planos reales por subtipo (ej.
     "Siemens 3TF57 / 3P 475A AC-3 / Bobina 220V"; mazo:
     "3x1x70+1x1x50mm² · Cu · PVC · 0,6/1kV · IRAM NM 247-3").
     NodoSimbolo las muestra bajo el símbolo (fuera de la caja, sin
     afectar clamp/zonas); ConexionEdge usa EdgeLabelRenderer para el
     texto sobre la línea. Sin datos mínimos → no anota.
  3. Estética de plano: todo texto generado arranca con MAYÚSCULA
     (`capitalizar()` aplicado a marca/modelo/norma/tamaño/clase/etc.
     solo en el render; los datos guardados no se mutan).

**Verificación:** npm run build ✓ · oxlint ✓.

**C4c — Refinamiento de anotaciones (feedback del usuario):** el texto
debía ir AL COSTADO del elemento y no invadir, y "muchas características
están normalizadas" (no se repiten en el plano). Cambios:
- Anotación del símbolo pasa al costado derecho (centrada en Y), gris,
  sin halo ni marco; la del mazo pierde el borde.
- El texto se reduce a lo ESENCIAL por subtipo: TM "3P · 50A · C",
  contactor "3P · 475A · AC-3", fusible "63A · gL · NH00",
  motor "50HP · 400V", transformador "25kVA · 13000/400",
  barra "Cu · 120mm² · 500A". Salieron marca/modelo, normas IEC,
  poderes de corte, bobina, portafusible, rpm y grupo de conexión:
  quedan SOLO en la ficha del panel (y en el JSON), no en la hoja.

**C4d — Anotación completa apilada (feedback del usuario):** "todos
los datos cargados deben aparecer uno abajo del otro" (revierte el
criterio mínimo de C4c). La anotación al costado del símbolo lista
ahora CADA campo con valor en su propia línea, con etiqueta:
`3P x 10A` / `Curva C` / `PdCC 3000 A` / `Norma IEC 60898-1`, etc.
El PdCC (guardado en kA) se muestra en amperes cuando es < 10 kA,
como lo anota el plano. Fusible muestra bloque Portafusible + fusible.
Barra apila material/perfil/sección/corriente.

**C4e — Fusible sin marca/modelo duplicados (feedback del usuario):**
había TRIPLE par marca/modelo: el de base_comun, portafusible_marca/
modelo y fusible_marca/fusible_modelo. Decisión: los marca/modelo de
base_comun son del PORTAFUSIBLE (el dispositivo dibujado); el cartucho
fusible lleva solo In/clase/tamaño/PdCC/norma. Se eliminaron los 4
campos duplicados del schema (queda $comment con la decisión) y se
actualizó la anotación. La anotación del fusible ahora es:
`Portafusible Siemens 3NP3` / `500 V · AC-20B` / `250 A gL` /
`NH00` / `PdCC 125 kA` / `Norma IEC 60269-2`.

**C4f — Formulario de conexión con barras y llaves (feedback del
usuario):**
- conductor.schema.json revisado: FUERA tension_asignada (innecesaria)
  y la variante "vaina" de tipo_cable. tipo_cable queda unipolar |
  multipolar y DEFINE LA NOTACIÓN: unipolar → "n x 1 x S"
  (conductores sueltos); multipolar → "1 x n x S" donde n cuenta
  fases + neutro (ej. del usuario: "1 x 4 x 25 mm² + 16 mm²" =
  multipolar de 3 fases + neutro con sección distinta).
- NUEVO FormularioConductor.tsx (el panel ya NO usa el generador
  genérico para conexiones): stepper con BARRAS inclinadas que
  representan los conductores de fase (1–3), sección de fase,
  radios Unipolares/Multipolar, LLAVES on/off para neutro y tierra
  que al activarse muestran "↳ Sección distinta" opcional
  (placeholder "= fase"), material/aislación/norma resueltos desde el
  schema, y VISTA PREVIA en vivo de las dos líneas que irán a la hoja.
  Tradeoff documentado: este formulario es UI a medida por pedido del
  usuario; el schema sigue siendo fuente de verdad para validación/C5.
- lineasMazo() reemplaza a textoMazo(): devuelve DOS líneas — notación
  del mazo y "Cu/PVC · IRAM 2178" (material/aislación con "/" y al
  lado la norma). Neutro/tierra con misma sección no agregan sufijo
  en multipolar; en unipolar se listan explícitos ("+ 1x1x16 mm²").
  ConexionEdge apila las líneas.

**Verificación:** npm run build ✓ · oxlint ✓ · verificar_alineacion ✓ ·
lint_simbolos ✓.

**C4g — Marcas de conductor SOBRE la conexión (feedback del usuario):**
las barras no iban en el formulario sino en la propia conexión según
normativa. Cambios:
- FormularioConductor: el stepper pasa a mostrar solo el NÚMERO
  (− 3 +), sin barras.
- ConexionEdge: dibuja TRAZOS OBLICUOS cruzando la línea — uno por
  conductor de línea (fases) — centrados en el segmento más largo del
  recorrido ortogonal (IEC 60617, single-line). Se recalculan con el
  path, así siguen las esquinas al mover los símbolos.

**C4h — Marcas normadas completas (feedback del usuario):**
- SIN límite de fases (schema deja de tener maximum:3; el stepper ya
  no topea).
- Trazos inclinados ~45° respecto de la línea y MÁS JUNTOS (separación
  6px, adaptativa si el tramo es corto), según IEC 60617.
- Marcas distintivas en el orden fases → neutro → tierra: el neutro es
  un trazo con CÍRCULO en su punta; la tierra, un trazo CORTADO por
  una línea corta perpendicular cerca de su punta. La marca se dibuja
  sobre el segmento más largo del recorrido y sigue las esquinas.

**C4i — Notación agrupada, marcas más visibles (feedback del usuario):**
- Trazos más GRANDES (15px) y el texto del mazo ahora queda AL COSTADO
  de las marcas (desplazado perpendicular al tramo), no encima.
- Si TODOS los conductores comparten la misma sección (fases + neutro
  + tierra), la notación se agrupa en un solo término: 3F+N+PE de
  16 mm² unipolares → "5 x 1 x 16 mm²". Con secciones distintas se
  mantiene el desglose con "+".
- El texto quiebra hacia abajo si supera ~130px (no queda una línea
  larguísima).
- BUG corregido: sin conductores de fase no desaparece la anotación —
  una conexión SOLO neutro o solo tierra se representa igualmente
  ("1 x 1 x S mm²").

**C4j — Ajuste fino de marcas y texto (feedback del usuario):**
- Separación entre marcas sube a 8px: el corte de la TIERRA se veía
  apretado contra las marcas vecinas.
- El texto del mazo ya NO flota sobre la conexión: queda AL COSTADO
  DERECHO de las marcas, centrado en altura, igual que las anotaciones
  de los aparatos.

**C5 — Checklist AEA no bloqueante:**
- `lib/checklist.ts`: reglas puras. Símbolos aparato/barra → campos
  x-obligatorio del schema vacíos + x-alguno-obligatorio (potencia kW
  o HP). Conexiones → validación POR MAZO (nunca por rol): mazo
  vacío, sección de fase, material/aislación/norma IRAM, coherencia
  llaves ↔ secciones (neutro/tierra apagados con sección cargada;
  secciones mayores que la de fase; solo-neutro/solo-tierra exigen su
  propia sección).
- `ChecklistAea.tsx`: panel ámbar en la esquina inferior izquierda
  (columna compartida con PanelProblemas vía .paneles-flotantes),
  colapsable, con contador; clic en el nombre de un símbolo lo
  selecciona para corregirlo desde el panel de atributos. NO bloquea
  ninguna acción.
- Nota pendiente N°2 de docs/estado-revision-aea.md marcada RESUELTA.

**C5b — Alimentador con la MISMA forma que las conexiones (feedback):**
- El panel ya no dice "Checklist AEA": ahora es «Faltan completar
  campos obligatorios (N)» / «✓ Campos obligatorios completos».
- El alimentador adopta el lenguaje visual y de formulario de las
  conexiones: mismo formulario (stepper de conductores, tipo
  unipolar/multipolar, llaves N/PE con sección distinta, material/
  aislación/norma, vista previa) con un campo extra ARRIBA: «Desde»
  (de dónde viene). En la hoja: caja "Desde X" + las mismas marcas
  oblicuas (círculo = neutro, corte = tierra) + notación al costado.
  Los combos viejos ("3 líneas + neutro", modo n…) quedaron afuera.
- DatosAlimentador lleva `atributos` (schema conductor); los proyectos
  viejos se siembran desde fases/neutro/tierra/cantidadN. Serializa en
  datos.atributos.
- Checklist: valida también alimentadores — falta origen + reglas de
  mazo.

**C5c — Conexiones múltiples, notas vacías, alimentador-cable (feedback con proyecto real):**
- PROYECTO DE PRUEBA: fusible con 3 conexiones desde el MISMO handle
  apilaba marcas y textos en el corredor compartido. FIX: las
  conexiones hermanas (mismo origen) escalonan sus marcas + texto a lo
  largo del recorrido (fracciones 1/(n+1)… n/(n+1) del largo total de
  cada trayectoria), con fallback al centro del tramo más largo.
- Notas del gabinete: SIN valores precargados (todo vacío por
  defecto).
- Alimentador rediseñado: ya no es un cuadrado, es UN CONDUCTOR
  VINIENTE — línea horizontal con etiqueta «Desde …» arriba (editable),
  marcas normadas sobre la línea y notación abajo; enganche a la
  derecha. TAMANO_ALIMENTADOR_PX ajustado (150×52).

**C5d — Alimentador vertical + limpieza de textos (feedback):**
- Alimentador girado: ahora es un cable VERTICAL que baja desde
  arriba — «Desde …» a la izquierda del cable, marcas normadas sobre
  la línea, notación a la derecha, enganche en el extremo inferior.
- Textos descriptivos de más ELIMINADOS: párrafo de ayuda del
  alimentador en la paleta; en Configuración de hoja quitaron los
  avisos «Los alimentadores se agregan…», «Estructura fija…»,
  «Enmarcado: margen izquierdo…», el detalle px/mm y se simplificaron
  etiquetas; tooltip de «Nueva hoja» corto.

**C5e — Alimentador compacto + fecha del rótulo (feedback):**
- La caja del alimentador ahora abraza al contenido (≈106×92): la
  notación pasó DEBAJO de la etiqueta «Desde …» y el handle quedó
  EXACTAMENTE en la punta inferior del cable (posición fija por
  estilo, no centrado de RF).
- Fechas del rótulo con MÁSCARA dd/mm/aaaa: solo dígitos, barras
  automáticas al escribir, placeholder actualizado y borde rojo si lo
  escrito no es una fecha real (ej.: 32/13/2026).

---

## Registro de reversiones y cambios de rumbo

| Qué | Cuándo | Motivo | Efecto |
|-----|--------|--------|--------|
| Cajetín IRAM v1 (PR #4) → formato "planos reales" sin cajetín (PR #6) | 01:08 | decisión del usuario ante pregunta | reemplazo de RotuloConfig por EncabezadoConfig |
| Formato "sin cajetín" (PR #6) → rótulo IRAM 4508 CONFORME (PR #7) | 01:10–01:38 | corrección del usuario: el rótulo debe existir y cumplir la norma | se restaura RotuloConfig ampliado + geometría figura 1 |
| Política auto-merge de AGENTS.md (dc03f8e) → aprobación previa del usuario | F4 (actual) | pedido explícito del usuario | los PR quedan abiertos hasta orden expreso de merge |

---

## Estado al cierre de esta entrada

- `main` = `7b0d37a` (Fase 6 cerrada: PR #10 mergeado + HISTORIAL).
- Fase C en curso sobre rama `proyecto/fase-c-atributos-20260823`:
  C1+C1-bis y C2 aplicadas, C3 implementada (sin montar), falta
  aprobación de cada paso por el usuario. PR todavía NO abierto.
- Pendiente: C4 (panel lateral conectado al store) → prueba del
  usuario → C5 (checklist AEA no bloqueante) → C6 (E2E con valores
  reales de los PDFs del PPS).
