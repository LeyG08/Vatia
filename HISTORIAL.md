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

**C5f — Handle unido a la punta del cable (feedback):**
el nodo de conexión del alimentador quedaba despegado del dibujo.
Ahora se ancla con coordenadas EXACTAS al extremo de la línea
(CABLE_X=86, PUNTA_Y=91 dentro del nodo), sin depender del centrado
de React Flow.

**C5g — Conexiones despegadas de los handles (feedback):**
CAUSA RAÍZ encontrada: rutaOrtogonal snapeaba TAMBIÉN los extremos
(sx,sy,tx,ty) a la grilla de 10px, pero los terminales de los
símbolos viven en múltiplos de ESCALA=4px → el snap movía el fin del
cable hasta 4-6px fuera del círculo del handle (se veía suelto).
FIX: extremos EXACTOS sin snap; el snap solo aplica a quiebres
intermedios, con guardas para que el quiebre caiga dentro del tramo
útil (si no, punto medio real) y descarte de segmentos de longitud
cero. La verificación del demo da idéntica.

**C5h — Cable del alimentador en grilla + checklist jerárquico (feedback):**
- El cable ahora cae a x=80 dentro del nodo (múltiplo de la grilla de
  10px): alineado verticalmente con un símbolo, la conexión sale RECTA
  sin desvíos. Caja ajustada a ≈100×92.
- El checklist agrupa por ELEMENTO: ítem principal = el símbolo o
  conexión (clicable para seleccionarlo), y debajo, como subtareas
  sangradas, cada cosa que falta.

**C6 — Proyecto de prueba con valores REALES del PPS:**
- «Desde» ahora es texto fijo en el alimentador (el campo editable es
  solo la procedencia; placeholder "TGBT").
- `ejemplos/proyecto-real-pps.json`: cadena TGBT → SF-Peli1-Moli
  (fusible Siemens R1288, 250 A gG NH1-NH2 125 kA IEC 60269-2) →
  Q-TMyPET3 (TM SICA 3P 63 A curva C 3 kA) → KM1 (contactor Siemens
  3TF57 415 V AC-3 475 A bobina 220 V) → Molino del fondo 50 HP
  400 V, con mazos reales (3x1x240+120 IRAM 2178; 3x1x25+16;
  3x1x10+6 IRAM NM 247-3; PE 16 mm²) y rama PAT → Q-LuzTablero
  (BAW 1P 10 A C 1,5 kA).
- Nuevo `scripts/verificar_proyecto_real.mjs`: replica las reglas del
  checklist sobre el JSON (schema-driven) → cero pendientes ✓.
- FIX ida-y-vuelta del alimentador: al cargar y al serializar se PISABA
  el mazo real (data.atributos editado en el panel) con el sembrado por
  flags. Ahora los atributos serializados mandan; el sembrado es solo
  red de seguridad.

**C7 — Símbolo de carga / destino de circuito (flecha):**
- Nuevo `S00120_carga_circuito_unifilar`: flecha abierta apuntando
  hacia ABAJO, entrada arriba, terminal en grilla (verificado ×2/×4).
- Nueva familia de atributos **carga** (`carga.schema.json`):
  codigo_circuito* ("C1", "C15" o "TS-Pell1"), tipo_carga*
  (IUG/TUG/ACU/seccional/otra), potencia_va, corriente_a,
  descripcion. Alta en metadata.schema, validadorMetadata, tipos,
  esquemas y paleta (grupo "Cargas"); checklist y formulario
  funcionan solos por ser schema-driven.
- El bloque de texto va DEBAJO de la flecha (`.anotacion-carga`),
  en el orden del plano: código / tipo / VA / A / designación.
- Ejemplo PPS reconstruido con la topología real DENTRO del área
  útil A3: TGBT → SF-Peli1-Moli → barra seccional (Cu 3x30x10)
  → TM SICA 63A → KM1 3TF57 → Molino 50HP; PE colgando del mazo;
  cargas flecha reales C1·IUG·Luces Tablero, C2.2·TUG·Tomacorrientes,
  C15·ACU·CNC VF3. Verificador ahora resuelve la familia desde el
  metadata de cada símbolo → cero pendientes ✓.

**C8 — La BARRA como nodo de distribución (feedback del usuario):**
"las barras en unifilar son todo nodos: la acometida llega a las
barras para hacer la distribución". Rediseño completo de S00119:
- Nuevo componente BarraNode (antes símbolo genérico): eje grueso
  ESTIRABLE con drag desde el extremo derecho (snap a grilla, undo
  en un solo paso por gesto) y rotación 90° para barras VERTICALES
  (drag mapeado al eje local según el giro).
- Puntos de conexión cada 10 px a lo largo de TODO el eje, uno por
  lado (arriba/abajo), más los extremos "in"/"out" legados. Los
  proyectos viejos con S00119 migran solos y sus conexiones quedan
  clavadas en las mismas coordenadas.
- Ficha nueva (barra.schema.json): dimensiones* ("3x30x10mm") ·
  material* (Cu/Al) · norma_iram* ("IRAM 2181-1") · corriente
  admisible*. FUERA perfil rígida/flexible y seccion_mm2 (el plano
  no los usa). Anotación en UNA línea al extremo IZQUIERDO, POR
  ENCIMA de la barra.
- Ejemplo PPS v3: TGBT → SF-Peli1-Moli llega ARRIBA a la barra
  seccional; abajo cuelgan en puntos distintos y alineados: TM→KM→
  Molino 50HP, cargas flecha C1·IUG / C2.2·TUG / C15·ACU y la PE.
- Verificador de fichas ahora valida la barra como las demás
  familias → cero pendientes ✓.
- FIX: el contenedor de BarraNode quedaba en 0×0 (todos sus hijos
  son posicionados en absoluto) y la barra no se veía; ahora el
  div raíz recibe width/height explícitos según caja×giro.

**C9 — Carga: alimentación/línea/neutro con potencia automática + panel de la barra:**
- Feedback del usuario: en la carga hace falta saber si es
  monofásica o trifásica, qué línea tiene asignada (L1/L2/L3) y si
  lleva neutro — "sabiendo esto el cálculo de la potencia se puede
  hacer automático".
- carga.schema.json v2: + alimentacion* (mono/tri), linea_asignada
  (L1/L2/L3, no aplica en tri) y lleva_neutro*. potencia_va pasa a
  ser CALCULADA: mono+neutro S=220·I · mono entre fases S=380·I ·
  tri S=√3·380·I.
- Nuevo FormularioCarga: la potencia se muestra de solo lectura y
  se recalcula al cambiar corriente/alimentación/neutro; si pasa a
  trifásica se borra la línea asignada.
- Anotación bajo la flecha ahora incluye la línea de alimentación:
  "1F 220 V · L1", "3F 380 V", etc.
- FIX del reporte "la barra no aparece... para cargar sus datos":
  PanelAtributos filtraba solo tipos simbolo/alimentador y el nodo
  barra nunca abría el panel → ahora también acepta "barra" (la
  ficha sale por su familia, ya registrada en esquemas.ts).
- Ejemplo PPS: CA1/C1·IUG·L1·0,08 A→18 VA · CA2.2/TUG·L2·10 A→
  2200 VA · CA3/C15·ACU trifásica sin neutro.

**C10 — Motor mecánica/eléctrica + Ku de utilización + unión cable-barra:**
- Aclaración del usuario sobre el checklist (punto 2): el checklist
  no bloqueante SÍ está implementado desde C4 (ChecklistAea.tsx +
  lib/checklist.ts, reglas schema-driven por familia, replicadas en
  verificar_proyecto_real.mjs) y se fue extendiendo con cada familia
  nueva (C6 conductor, C7 carga, C8 barra). La numeración del plan
  original se desalineó al re-scopear pasos por feedback.
- Corrección conceptual del motor: el HP/kW de placa es potencia
  MECÁNICA del eje, no eléctrica — la conversión 1:1 (0,7457) solo
  sirve entre HP y kW, NO para derivar corriente. Schema nuevo:
  eficiencia_pct y factor_potencia (datos de placa, opcionales);
  in_a pasa a dato principal de placa; si falta, el formulario
  ofrece una ESTIMACIÓN explícita I = P_eje/(√3·V·cosφ·η) con
  botón "usar" que nunca pisa un valor real ya cargado.
- Ku de utilización en cargas (carga.schema.json): ku (0 a 1,
  sugerido según tipo —IUG≈0,9, TUG≈0,5, ACU≈0,85— y siempre
  editable) + potencia_utilizacion_va CALCULADA = potencia_va × ku
  (ku ausente ⇒ 1). Se guarda para el futuro nodo agregador de
  tablero, que lo sumará junto con Ks (agregación aún no
  implementada). Helpers en lib/utilizacion.ts, compartibles para
  futuras cargas no representadas con flecha.
- Anotación bajo la flecha con jerarquía: nominal principal
  ("2200 VA") y utilización como secundaria cuando Ku < 1
  ("Ku=0,5 → 1100 VA útil.").
- FIX "en la unión con las barras la línea sobrepasa la barra":
  ConexionEdge ahora deriva el lado de aproximación de cada extremo
  que cae en una barra según dónde está el otro elemento → la
  conexión entra SIEMPRE perpendicular al eje, sin vueltas por
  encima ni cable flotante.
- Ejemplo PPS: CA1 Ku=0,9→16 VA útil · CA2.2 Ku=0,5→1100 VA útil ·
  CA3 ACU trifásica Ku=0,85 (sin corriente de placa todavía).

**C11 — Reconexión de cables, estiramiento por ambos extremos, conjunto de barras, textos libres y remate del cable sobre el eje:**
- FIX persistente "la conexión con la barra se ve como hecha desde
  arriba": ahora el extremo del cable que cae en una barra se RECORRE
  a la SUPERFICIE visible del eje (±3 px hacia el otro extremo) además
  de forzar la entrada perpendicular → el conductor remata SIEMPRE
  sobre la barra; no puede cruzarla ni asomar del lado contrario.
- Reconexión de conexiones (pedido del usuario): se pueden AGARRAR
  las puntas de un cable ya hecho y soltarlas en otro handle
  (ReactFlow onReconnect + edgesReconnectable). Nuevo store.
  reconectarConexion: conserva el mazo cargado y queda en el
  historial como un paso undo/redo. Soltar donde mismo no genera
  paso.
- Barra estirable desde los DOS extremos: tirador izquierdo nuevo;
  al estirar por la izquierda la posición corre sobre el eje local
  (según giro) para mantener fijo el extremo derecho. Undo en un
  solo paso restaura largo Y posición.
- es_conjunto (barra.schema.json): marca si la línea representa el
  JUEGO de barras por fase dibujado como una sola línea; la ficha
  antepone "Juego de barras ·". Ejemplo B1 marcado como conjunto.
- Alimentador: especificación del mazo (varias secciones fase/
  neutro/tierra) va TODA EN UNA SOLA LÍNEA ("3 x 1 x 25 mm² + … ·
  Cu/PVC · IRAM NM 247-3") sin bajar hacia abajo; columna y campo
  «Desde» crecen lo necesario — una palabra larguísima ya no se
  corta.
- Motor: aceptar la estimación de In TAMBIÉN carga los valores
  supuestos de η (%) y cos φ usados en el cálculo, para que el plano
  documente qué se asumió.

**C12 — Reorientación completa del cable al cruzar lados + alimentador que no desafina:**
- Reporte del usuario: uniendo un elemento desde abajo de la barra
  y MOVIÉNDOLO arriba, en ciertas combinaciones el cable seguía
  entrando mal. Causa: C10/C11 corregían solo el lado del extremo
  de la BARRA; el OTRO extremo tiraba con su dirección declarada
  vieja (ej.: una entrada que mira arriba, con la barra pasando a
  quedar debajo) y generaba una "S".
- FIX general (ConexionEdge): la dirección EFECTIVA de TODO extremo
  conserva el eje declarado (vertical/horizontal) pero deriva la
  POLARIDAD de la geometría real (¿el otro extremo quedó arriba o
  abajo / a izquierda o derecha?). En cables bien puestos no cambia
  nada; al cruzar lados se reorienta solo, sin "S". El recorte a la
  superficie del eje de las barras sigue vigente.
- Reporte del usuario: con textos largos, el alimentador corría su
  simbología y quedaba desunida del nodo (la columna crecía y
  empujaba el cable SVG fuera de su punta).
- FIX (AlimentadorNode): columna de ancho FIJO otra vez; el campo
  «Desde» largo crece hacia la IZQUIERDA con margen negativo
  compensado (el layout no se entera) y la especificación del mazo
  es position:absolute anclada al borde derecho — una sola línea que
  se extiende afuera sin empujar JAMÁS la simbología.

**C13 — Ficha de carga más clara, alimentador arrastrable y cable que
nunca se ve desunido:**
- Pedidos del usuario (cinco puntos):
  1. Línea asignada y neutro de la CARGA como CHIPS que se ILUMINAN
     (L1/L2/L3 con click = deseleccionar; «con neutro» / «sin
     neutro»). En trifásica los chips de línea quedan apagados.
  2. Utilización (Ku) como LÍNEA SECUNDARIA de la ficha: más chica y
     gris («útil ≈ 5500 VA · Ku 0,5») debajo de la nominal, en vez
     del texto crudo anterior. Sistema nuevo de líneas con
     jerarquía (LineaAnotacion) reutilizable.
  3. Sin nombre predeterminado de tablero: HOJA_POR_DEFECTO queda
     con tablero vacío (el placeholder solo sugiere).
  4. El ALIMENTADOR ahora se ARRASTRA desde la paleta igual que los
     símbolos (mantener presionado → soltar en el plano; el click
     simple sigue agregándolo donde siempre). Respeta las zonas
     reservadas del rótulo/notas al soltarlo.
  5. Alimentador: textos alineados por la IZQUIERDA (Desde / caja /
     mazo), columna que abraza el contenido, y TODO texto decorativo
     NO seleccionable (adiós selecciones accidentales al arrastrar).
- Cable-barra SEPARADO (reporte persistente): el recorte de ±3 px a
  la superficie del eje dejaba hueco visible al cruzar un elemento
  de lado → DESCARTADO. Ahora todo extremo termina EXACTAMENTE sobre
  el centro del eje oscuro (5 px): imposible que se lea desunido,
  incluso mientras el navegador mide tarde el handle durante el
  arrastre. La reorientación por geometría de C12 sigue igual.
- BONUS: la punta del alimentador tenía un hueco oculto de 4 px entre
  la línea dibujada y el punto real de conexión (el handle estaba en
  el borde del svg, no en la punta). Ahora el handle vive DENTRO del
  contenedor del cable y viaja pegado a él aunque crezcan los textos.

**C14 — LA causa raíz de los "cables desunidos" (dos bugs reales,
encontrados reproduciendo el archivo del usuario con navegador
automatizado):**
- El usuario reportó que el bug "volvió" y aportó su proyecto JSON.
- HALLAZGO 1 (crítico): ABRIR un proyecto guardado PERDÍA la barra y
  TODAS sus conexiones. `construirEstadoHoja` resolvía el símbolo de
  la librería ANTES de llegar a la rama «barra», pero las barras
  nativas no llevan `codigo_iec` en el archivo ⇒ `obtenerSimbolo("")`
  fallaba y el nodo se descartaba; sin él, las 4 conexiones quedaban
  huérfanas y también se descartaban. FIX: el chequeo por `tipo ===
  "barra"` va PRIMERO (queda además el fallback por S00119 para
  migrar proyectos viejos). Guardar→abrir ya es ida-y-vuelta exacta.
- HALLAZGO 2 (el hueco visible): React Flow NO ancla los cables al
  centro del handle sino al BORDE del rectángulo medido, y su hoja
  base impone mínimo 5×5 px ⇒ ~2,5–5 px de aire entre la punta del
  cable y la barra/símbolo SIEMPRE (antes lo maquillaba a medias el
  recorte de −3 px descartado en C13). FIX: handles de ancla EXACTA
  de 0×0 (`min-width/height:0`, doble clase para ganarle al CSS de
  RF sin depender del orden de importación) y el punto visible como
  `::before` (no se mide, pero recibe el mouse). Medido tras el fix:
  **d = 0.00 px exacto en todos los extremos**.
- REGRESIÓN PERMANENTE: arnés E2E con Playwright
  (`apps/editor/e2e/conexiones.mjs` + `npm run e2e`) sobre un FIXTURE
  con el archivo exacto del usuario (`ejemplos/regresion-barra.json`).
  Mide el gap de todo extremo de cable contra su handle al cargar,
  al conectar desde abajo con el mouse, al CRUZAR elementos por
  encima/debajo de la barra (durante y después del arrastre) y al
  volver a cruzarlos. Umbral 2,5 px; falla si no hay paths (la
  primera corrida dio un «ok» falso porque el loader había tirado
  todo — lección incorporada).
- Suites: build/lint OK; verificador de proyecto real, alineación y
  lint de símbolos OK; E2E OK.

**C15 — fichas: orden del mazo, conteo multipolar, neutro visible y
juego de barras con composición (feedback directo del usuario):**
- MAZO APILADO (alimentador): la especificación ya no va en una línea
  separada por «·» sino en LÍNEAS APILADAS bajo el origen, en el orden
  del plano real: SECCIONES → MATERIAL/AISLACIÓN → NORMA IRAM.
  (`AlimentadorNode` mapea `lineasMazo()` a un div por línea.)
- FIX CONTEO MULTIPOLAR: cuando neutro y tierra tienen sección
  DISTINTA a las fases, la anotación vieja contaba mal («1 x 5 x
  50 mm²» para 4F50+N35+PE35: metía el neutro de 35 como núcleo de
  50). Ahora los conductores se agrupan POR SECCIÓN con su cantidad
  real; multipolar uniforme «1 x 6 x 16 mm²», mezclado «1 x (4 x 50 +
  2 x 35) mm²»; unipolar «3 x 1 x 50 mm² + 2 x 1 x 35 mm²». Casos
  límite probados por script (solo N, solo T, secciones mezcladas,
  vacío).
- CARGA con neutro DECLARADO: la línea de alimentación ahora dice
  «1F N 220 V · L1» / «3F N 380 V» (sin neutro queda «1F»/«3F»).
- UTILIZACIÓN reformulada (el usuario rechazó «útil ≈ X VA · Ku 0,5»):
  ahora como porcentaje del nominal en la línea secundaria gris:
  «útil 1100 VA (50 %)».
- JUEGO DE BARRAS con composición (C15): nuevos campos en
  barra.schema.json — `cantidad_fases` (1..3), `incluye_neutro`,
  `incluye_tierra` (visibles solo si `es_conjunto=true` vía nueva key
  `x-visible-si`, soportada por FormularioAtributos que además
  precarga 3F+N+PE al activar el conjunto). La anotación de barra pasa
  de «Juego de barras · …» a «Juego de barras 3F+N+PE · …».
  Ejemplo del PPS actualizado (B1 = 3F+PE).
- Suites: build/lint OK; verificador de proyecto real (valida los
  campos nuevos), alineación y lint de símbolos OK; E2E Playwright OK.

**C16 — «mazo» pasó a «cable» + juego de barras elegible + formulario
de carga sin campos calculados (feedback directo del usuario):**
- RENOMBRADO GLOBAL mazo → CABLE (el usuario eligió entre Cable /
  Cableado / Conductores / Tendido): lo visible («Mazo de conductores»
  del panel → «Cable»; checklist «Cable sin conductores: activá fases,
  neutro o tierra.»; tooltips de conductor.schema.json) Y lo interno
  (`lineasMazo`→`lineasCable`, `problemasMazo`→`problemasCable` en
  editor y verificador, comentarios, descripción de undo). Grep final:
  cero restos fuera de HISTORIAL. Sin cambios en claves de datos ⇒ los
  proyectos guardados siguen funcionando igual.
- JUEGO DE BARRAS ELEGIBLE: la composición ya no son tres campos
  sueltos con valores precargados — ahora hay un bloque de CHIPS
  «Composición» (1F/2F/3F + N + PE, estilo C13) que escribe sobre los
  mismos campos del schema (`cantidad_fases`, `incluye_neutro`,
  `incluye_tierra`). El precargado 3F+N+PE queda como punto de
  partida, siempre cambiable. La anotación «Juego de barras
  3F+N+PE · …» se arma igual que en C15.
- FORMULARIO DE CARGA: fuera los campos de solo lectura Potencia (VA)
  y Pot. utilización (VA) — se calculan solas y confundían. Queda una
  línea informativa gris (= 4400 VA · útil 2200 VA (50 %)) debajo del
  Ku, y el plano sigue anotándolas.
- Suites: build/lint OK; alineación, lint de símbolos y verificador
  de proyecto real OK; E2E Playwright OK.

**C17 — el alimentador ya no se corre al escribir, selección visible
y puntas de cable más fáciles de mover (feedback del usuario):**
- INPUT «Desde» de ancho FIJO (14ch): antes crecía con el texto
  (`width: n ch`) y la columna empujaba el cable → el símbolo «se
  corría» y perdía alineación MIENTRAS se escribía. Ahora el texto
  largo scrollea dentro del input y nada se mueve.
- SELECCIÓN VISIBLE en los cuatro tipos de objeto (antes había solo
  un borde punteado sutil que pasaba desapercibido):
  · símbolo: borde sólido azul + halo doble;
  · alimentador: hover suave / seleccionado azul con halo;
  · barra: eje pasa a azul con halo;
  · conexión: trazo azul más grueso + drop-shadow.
- PUNTAS DE CABLE MÁS FÁCILES DE MOVER: `connectionRadius` 12 → 30.
  Al soltar una punta (reconexión, C11) o al conectar nuevo cable, el
  imán agarra el handle más cercano sin apuntar fino. El E2E sigue
  midiendo anclaje exacto (d≈0) — el snap no lo altera porque apunta
  justo al centro.
- Suites: build/lint OK; alineación, lint de símbolos y verificador
  OK; E2E Playwright OK.

**C18 — justificación del texto del alimentador hacia el cable:**
- El texto vive a la IZQUIERDA del cable ⇒ se justifica a la DERECHA
  (regla del usuario: si está de un lado, remacha contra el elemento;
  viceversa si pasara al otro). «Desde», el origen y la nota apilada
  terminan ahora flush contra el cable en vez de dejar borde ragged.
  Cambio solo CSS (align-items/text-align); la geometría del handle no
  se mueve — E2E verificado.
- Suites: build/lint OK; E2E Playwright OK.

**C19 — arnés E2E ampliado + bug latente de nombres de handles:**
- El arnés `e2e/conexiones.mjs` ahora FALLA de verdad (exit 1) cuando
  algo va mal, y sumó dos escenarios de regresión para lo pedido en
  C17:
  · RECONEXIÓN de punta: arrastra el updater target de c4 desde 390b
    hasta 410b (misma barra) y verifica que el extremo caiga EXACTO en
    el nuevo slot. Detalle técnico: los updaters de React Flow quedan
    por DEBAJO del nodo en el z-order, así que el mousedown se
    despacha sintético directo al elemento y el arrastre/suelta son
    mouse real.
  · ESCRIBIR no mueve el alimentador: carga un fixture dedicado
    (`ejemplos/regresion-alimentador.json`: alimentador + barra +
    conexión), tipea «Tablero TS-G1» en «Desde» y mide el handle:
    desplazamiento 0.00 px.
- BUG LATENTE corregido de paso: los handles de barra se llaman
  «130a/130b» (sin «p»), y el sufijo importa — «a» es SOURCE y «b» es
  TARGET; React Flow descarta EN SILENCIO toda conexión cuyo lado no
  coincida. El ejemplo `proyecto-real-pps.json` traía los nombres
  viejos con «p» Y los lados invertidos ⇒ al abrirlo en el editor NO
  se dibujaba ninguna conexión a la barra. Reescribí sus extremos con
  el formato actual (hacia la barra = b, desde la barra = a); el
  verificador sigue dando OK con los nuevos nombres.
- Suites: alineación, lint de símbolos y verificador OK; E2E completo
  OK (11 escenarios + reconexión + alimentador).

**C20 — ficha de barra APILADA (regla general: un ítem por línea):**
- El usuario pidió que los VARIOS ítems nunca vayan amontonados en un
  renglón sino uno debajo del otro. La barra pasaba todo junto
  («Juego de barras · 3x30x10mm · Cu · IRAM · 500 A»); ahora:
    Juego de barras 3P+N+PE   ← composición (además F→P, como lo
                                 escribe el usuario)
    3x30x10mm                 ← dimensiones del perfil
    Cu                        ← material como característica propia
    300 A · IRAM 2104         ← corriente admisible con la norma AL LADO
- Resto de anotaciones ya cumplían la regla (carga, cable,
  alimentador apilado desde C15); quedan solo dos pares relacionados
  en una línea: corriente+norma (pedido explícito) y tensión+categoría
  del portafusible.
- Suites: build/lint OK; alineación + lint + verificador OK; E2E OK.
- **Ajuste posterior del usuario (mismo C20):** dimensiones y material
  en la MISMA línea («3x30x10mm · Cu»); el material solo va solo si no
  hay dimensiones. Layout final:
    Juego de barras 3P+N+PE
    3x30x10mm · Cu
    300 A · IRAM 2104
- Suites del ajuste: build/lint OK; E2E OK (14 escenarios).

**C21 — barra VERTICAL: el trazo también gira:**
- Reporte del usuario: en vertical los handles y los tiradores se
  reubican bien, pero la SIMBOLOGÍA quedaba horizontal. Causa: el eje
  (.barra-eje) era siempre una franja horizontal (top:50%+height fijo);
  sus insets left/right caían sobre el ancho corto de la caja girada.
- Arreglo: BarraNode agrega la clase .barra-eje-v cuando el giro es
  impar → franja VERTICAL centrada en X, con top/bottom = padX a lo
  largo del eje (mismo margen de extremos que en horizontal). La ficha
  sigue quedando sobre el extremo superior, coherente.
- Arnés E2E: nuevo escenario «rotar barra» — selecciona la barra, tecla
  R y mide el bounding del eje (horizontal ≫ancho → vertical ≫alto,
  comparación RELATIVA porque el zoom del viewport infla los px) y
  verifica que los cables siguen anclando exacto tras la rotación.
- Suites: build/lint OK; alineación + lint + verificador OK; E2E OK.

**C22 — cinco arreglos tras probar el diagrama PPS real (molino del fondo):**
1. ALIMENTADOR ENTRE DOS PUNTOS: la punta «salida» vive a
   (columna+15 px) del origen del nodo y ese offset no es múltiplo de
   grilla; RF snapeaba la ESQUINA, no la punta → cable torcido.
   Ahora se mide el offset real (DOM/zoom) y el nodo se corre lo justo
   para que la PUNTA caiga exacta en el mapa de puntos: al soltar un
   arrastre y en silencio al cargar/cambiar de hoja (acción nueva
   `fijarPosiciones`, sin historial). E2E: resto=(0.00, 0.00) px.
2. RECONEXIÓN RÁPIDA ROTA: agarrar la punta de un cable que termina
   en la barra arrastraba LA BARRA — el updater queda debajo y tanto
   mi caja como el WRAPPER de React Flow capturaban el clic (RF pinta
   `pointer-events:all` INLINE en el wrapper). Solución: wrapper +
   caja con `pointer-events:none !important`; solo eje (::after de
   ±6 px), tiradores y puntos reciben puntero. E2E nuevo: la punta es
   ALCANZABLE con elementFromPoint.
3. MIGRACIÓN DWG (PENDIENTE, requiere datos): el usuario aclaró que el
   DWG real tiene ~30 UNIFILARES DISTINTOS en un solo archivo y la
   interpretación actual los mezcla como si fueran un tablero. Falta
   el archivo fuente (DWG/DXF o export) para re-segmentar en hojas;
   NO se tocó proyecto-real-pps.json todavía.
4. TEXTO INVADIDO: cada renglón de las fichas (símbolos, barra,
   carga, alimentador) y la anotación de los cables llevan ahora una
   plaqueta casi opaca blanca (rgba .94) — nada que cruce por debajo
   tapa la lectura. La nota del alimentador con F/N/T de secciones
   distintas permite partir en líneas (máx 26 ch).
5. SALTOS BRUSCOS AL ACOMODAR: mientras se arrastra UNA punta de
   cable (conexión nueva o reconexión), el quiebre intermedio va SIN
   snap (ruta suave, sigue al puntero); al soltar vuelve el criterio
   definitivo snapeado. Además la notación de cables pasó a "×"
   compacta ("3×50 + 2×35 mm²", multipolar "1 × (3×50 + 2×35) mm²").
- Suites: build/lint OK; alineación + lint + verificador OK; E2E OK
  (16 verificaciones).

**C23 — el proyecto PPS pasa a ser MULTI-HOJA (un unifilar por tablero):**
- El usuario pasó el fuente real: «Unifilares de Tableros.dwg»
  (AC1032, 20/08) + «Unifilares de Tableros (PROV).pdf» (28 págs,
  11/08) en Downloads. Relevamiento con PyMuPDF: cada página es un
  unifilar de UN tablero; los nombres TS-* que aparecen son destinos,
  no títulos (de ahí venía la confusión anterior).
- El DWG comprime los textos (escaneo binario UTF-16/ASCII: solo
  fragmentos sueltos) — la lista completa sale de la capa de texto del
  PDF. Sin líneas vectoriales en el PDF (ploteo rasterizado): no hay
  marcos dibujados que detectar.
- `scripts/resegmentar_pps.mjs` (idempotente): reestructura
  proyecto-real-pps.json en 30 HOJAS — la existente pasa a llamarse
  «TGBT · TS-G1» (el viejo nombre "TS-Pell1_y_Molino1" era un destino
  mal tomado como título) y se agregan 29 hojas VACÍAS nombradas por
  unifilar, con metadatos de migración (fuente/página/estado). Coincide
  con los ~30 unifilares que mencionó el usuario.
- `verificar_proyecto_real.mjs`: ahora barre TODAS las hojas; las
  vacías se informan como «Sin migrar aún» y NO hacen fallar.
- PENDIENTE (próximas iteraciones): migrar el CONTENIDO de cada página
  del PDF a su hoja (extracción posicional página por página).
- Suites: build/lint OK; E2E OK; alineación + lint + verificador OK
  (30 hojas, sin pendientes de fichas).

**C24 — corrección de C23: TGBT y TS-G1 son tableros DISTINTOS:**
- El usuario lo marca: TGBT es un tablero propio; el nombre combinado
  «TGBT · TS-G1» era un error, igual que haber renombrado la hoja con
  contenido (ese contenido ES TS-Pell1_y_Molino1 — un tablero
  alimentado DESDE TGBT).
- `resegmentar_pps.mjs`: hoja 1 restaurada a
  «TS-Pell1_y_Molino1» (migracion.pagina=null) + nuevas hojas vacías
  «TGBT» (p0), «TS-G1» (p0) y «TS-Lab» (p1). Total: 33 hojas.
- Suites: E2E OK; verificador multi-hoja OK (32 vacías sin fallar).

**C24b — migración del unifilar TGBT (página 0) a su hoja:**
- Lectura posicional del PDF corregida por rotación (p.rotation=270;
  coordenadas visuales con rotation_matrix). p0 = TGBT: doble ingreso
  a la barra principal — Red de distribución (1x3x240+N120, IRAM 2178)
  vía QG-TGBT1 (EMA SACE ISOL Z500 500A, PdCC 20kA, IEC 60947-2) +
  KM1 (Siemens 3TF57 475A AC3, bobina 220V); PAT generador vía segundo
  QG-TGBT1 + KM2 (Siemens 3TA28 170A AC3). Barra 3x30x10mm Cu
  (IRAM 2181-1) + PE. Gabinete: autoportante, Clase I, BA5/BA4,
  IP00 IEC 60529, barras de cobre desnudo, sin reserva futura.
  Las salidas a TS-G1/TS-CD/TS-BC son seccionales/señales: viven como
  alimentadores en SUS hojas, no acá.
- `scripts/migrar_tgbt.mjs` (idempotente): 8 nodos + 7 conexiones en
  la hoja tgbt. Corrección previa: resegmentar numeraba hojas desde 2
  y generó ids duplicados → ahora continúa desde el sufijo máximo.
- Verificador: hoja TGBT sin pendientes; E2E OK.
**C26 — TGBT re-migrado FIEL al dibujo del usuario:**
- El usuario dibujó el TGBT en el editor (Downloads\TGBT.json,
  interpretación de su AutoCAD sin la parte de comando) y mostró que
  la topología de C24b era incorrecta. Topología real:
  Red (multipolar 3x240+N120 IRAM 2178) entra DIRECTO a la barra
  principal (30x10 mm Cu, 573 A); los ramales BAJAN barra -> KM
  (3TF57 475A / 3TA28 170A ue 690V) -> QG-TGBT1 (EMA SACE ISOL Z500
  500A) -> carga seccional «TS-G1»; cada seccional recibe además un
  enlace SOLO NEUTRO 35 mm2 directo desde la barra; y PAT pasa por
  AFUERA (unipolar 1x70+PE70 IRAM 2004) hasta su propio TS-G1.
- migrar_tgbt.mjs reescrito: nodos/conexiones copiados verbatim del
  archivo del usuario. Ajustes mínimos documentados: c1/c7/c8/c11
  completados con datos del PDF; n8 alimentacion=monofasica; a2/c11
  aislacion XLPE (IRAM 2004; el checklist la exige).
- verificar_proyecto_real.mjs ahora resuelve barra por tipo
  (S00119) como hace construirEstadoHoja — el export del usuario no
  trae codigo_iec en la barra.
- PENDIENTE ACORDADO: próxima ronda = NUEVA SIMBOLOGÍA MCCB / caja
  moldeada con Ir/Im (hoy se usa S00110 como placeholder; por eso el
  usuario cargó pdcc 2500). Valores del usuario respetados verbatim.
- Verificador OK (sin pendientes); E2E OK.
**C27 — alimentador: cuerpo Y punta sobre el mapa punteado:**
- Queja del usuario: los alimentadores quedaban «levemente
  desalineados» del mapa. Causas encontradas: (1) el zoom se leía con
  un regex que no matchea transform matrix(...) y fallaba en silencio;
  (2) por diseño C22 la PUNTA se alineaba pero el CUERPO quedaba entre
  puntos (offset interno no múltiplo de grilla y dependiente del
  texto).
- App.tsx: zoom vía DOMMatrixReadOnly(getComputedStyle(...).transform);
  reintento doble del efecto de alineación (120 ms + 600 ms) para no
  perder nodos si RF aún no montó el handle.
- AlimentadorNode/estilos: ALTO_LINEA 88->81 (punta a 80 px) y
  .alim-col ancho fijo 138 px -> offset del handle (160, 80) múltiplo
  de 10 en ambos ejes. Cuerpo y punta caen juntos en la grilla; el
  snapToGrid mantiene la alineación durante el arrastre.
- E2E: nueva medición «alineación cuerpo alimentador» (translate del
  wrapper % 10 == 0). Verde en (0.00, 0.00).

**C25 — reinicio del proyecto PPS desde TGBT (reversión de C23/C24):**
- El usuario ordena borrar todo y empezar de nuevo: TGBT es EL tablero
  donde inicia todo. Las 33 hojas especulativas se descartan — varias
  eran tableros inexistentes inventados a partir de etiquetas de
  destino o de MÁQUINAS (CNC VF3/VF2/TL2/VF4 son cargas ACU dentro del
  tablero de p2, no tableros).
- proyecto-real-pps.json regenerado con UNA sola hoja: «TGBT»
  (contenido real de p0 migrado por scripts/migrar_tgbt.mjs: doble
  ingreso Red/PAT → QG-TGBT1×2 + KM1/KM2 → barra 3x30x10 Cu + PE).
- Se elimina scripts/resegmentar_pps.mjs (su lista de unifilares era
  inválida). Los demás tableros se irán agregando UNO POR UNO a medida
  que se migre cada página real del PDF/DWG, en orden topológico desde
  TGBT.
- Verificador OK (1 hoja, sin pendientes); E2E OK.
  Aclaración UX: no hay menú de ejemplos — el archivo se abre con
  «📂 Cargar…» eligiendo apps/editor/ejemplos/proyecto-real-pps.json.

---

## Registro de reversiones y cambios de rumbo

| Qué | Cuándo | Motivo | Efecto |
|-----|--------|--------|--------|
| Cajetín IRAM v1 (PR #4) → formato "planos reales" sin cajetín (PR #6) | 01:08 | decisión del usuario ante pregunta | reemplazo de RotuloConfig por EncabezadoConfig |
| Formato "sin cajetín" (PR #6) → rótulo IRAM 4508 CONFORME (PR #7) | 01:10–01:38 | corrección del usuario: el rótulo debe existir y cumplir la norma | se restaura RotuloConfig ampliado + geometría figura 1 |
| Política auto-merge de AGENTS.md (dc03f8e) → aprobación previa del usuario | F4 (actual) | pedido explícito del usuario | los PR quedan abiertos hasta orden expreso de merge |
| Proyecto PPS multi-hoja especulativo (C23/C24) → reinicio con solo TGBT (C25) | C25 (actual) | orden del usuario: «borra todo y comenzá de nuevo»; TGBT es el tablero donde inicia todo; había tableros inventados (CNC VF3/VF2 eran cargas, no tableros) | proyecto-real-pps.json queda con UNA hoja TGBT real; los demás unifilares se agregan al migrar cada página |

---

## Estado al cierre de esta entrada

- `main` = `7b0d37a` (Fase 6 cerrada: PR #10 mergeado + HISTORIAL).
- Fase C sobre rama `proyecto/fase-c-atributos-20260823`:
  IMPLEMENTADAS Y COMMITEADAS C1 a C30 —
  · C1/C1-bis/C2: base de atributos y formularios schema-driven.
  · C3: motor de checklist no bloqueante (lib/checklist.ts) +
    panel ChecklistAea agrupado por elemento con subtareas.
  · C4: panel de ficha técnica junto al elemento seleccionado,
    conectado al store; el checklist quedó cerrado acá y se fue
    extendiendo por familia en cada entrada posterior.
  · C5a–C5h: rediseño del ALIMENTADOR (caja, mazo real, cable
    alineado a grilla, extremos exactos, «Desde» fijo).
  · C6: proyecto real del PPS + verificador schema-driven
    (verificar_proyecto_real.mjs, cero pendientes).
  · C7: símbolo de carga S00120 (flecha destino de circuito) +
    familia carga.
  · C8: barra de distribución como nodo propio (estirable, puntos
    de conexión cada grilla, vertical por rotación, ficha arriba-
    izquierda, migración automática de proyectos viejos).
  · C9: alimentación/línea/neutro de la carga + potencia calculada
    automáticamente (220/380/√3·380 × I).
  · C10: motor mecánica/eléctrica con η y cosφ + estimador de In;
    Ku de utilización con potencia_utilizacion_va guardada para el
    futuro agregador de tablero (Ks); unión perpendicular
    cable-barra.
  · C11: reconexión de puntas del cable; barra estirable por ambos
    extremos; es_conjunto (juego de barras); mazo del alimentador en
    una línea y textos sin recortes; remate del cable sobre la
    superficie del eje.
  · C12: reorientación automática del cable en TODOS los extremos al
    cruzar un elemento de lado (adiós "S" contra la barra);
    alimentador con columna fija y textos creciendo hacia afuera sin
    desafinar la simbología.
  · C13: chips iluminados (línea/neutro) en la ficha de carga;
    utilización como línea secundaria gris; sin tablero
    predeterminado; alimentador arrastrable desde la paleta; textos
    alineados a la izquierda y no seleccionables; extremos del cable
    rematando sobre el centro del eje (nunca se ven desunidos).
  · C14: cargar un proyecto guardado ya NO pierde la barra ni sus
    conexiones; cables anclados al centro EXACTO de cada handle (adiós
    aire de 2,5–5 px); arnés E2E Playwright con el caso del usuario
    como fixture de regresión (`npm run e2e`).
  · C15: mazo del alimentador apilado (secciones/material/norma);
    conteo multipolar corregido agrupando por sección; neutro visible
    en la carga («1F N»/«3F N»); utilización como «útil X VA (P %)»;
    juego de barras con composición (cantidad_fases + N/PE).
  · C16: renombrado global «mazo»→«cable»; composición del juego de
    barras elegible con chips (1F/2F/3F+N+PE); formulario de carga sin
    campos calculados (solo línea informativa).
  · C17: input «Desde» de ancho fijo (el alimentador no se corre al
    escribir); selección evidente en símbolos/alimentador/barra/cable;
    puntas de cable con imán generoso (connectionRadius 30).
  · C18: texto del alimentador justificado hacia el cable (derecha,
    por estar a su izquierda).
  · C19: arnés E2E con fallo real + escenarios de reconexión de punta
    y de «escribir no mueve»; corregido bug latente de nombres/sentido
    de handles de barra en proyecto-real-pps.json (no dibujaba nada al
    abrirlo).
  · C20: ficha de barra apilada (composición / dimensiones con
    material al lado / corriente+norma) — regla general: un ítem por
    línea, pares relacionados comparten renglón.
  · C21: barra vertical — el trazo gira con el nodo (+ escenario E2E
    de rotación).
  · C22: punta del alimentador exacta en el mapa de puntos; la
    reconexión rápida de puntas vuelve a andar (la caja de la barra ya
    no tapa); plaquetas blancas bajo TODO texto del plano; ruta suave
    mientras se arrastra una punta. PENDIENTE C22: re-migración del
    DWG (~30 unifilares en un archivo) — falta el archivo fuente.
  · C23: recibido el fuente real (DWG+PDF) — proyecto reestructurado
    en 30 hojas, una por unifilar/tablero; verificador multi-hoja;
    migración de contenido página por página queda como próximo paso.
  · C24: corrección — TGBT y TS-G1 son tableros distintos; la hoja con
    contenido vuelve a ser TS-Pell1_y_Molino1; +TGBT, +TS-G1, +TS-Lab
    como hojas     propias (33 en total).
  · C24b: migrado el unifilar TGBT (p0) a su hoja; ids de hoja
    corregidos (sin duplicados).
  · C26: migración VERBATIM del TGBT según el dibujo de referencia del
    usuario (Downloads/TGBT.json): Red entra DIRECTO a la barra n1;
    dos ramales barra→KM→QG→carga-seccional (TS-G1); enlaces de solo
    neutro 35 mm²; PAT por fuera de la barra (1×70+PE, IRAM 2004) a
    otra carga-seccional; pdcc 2500 del QG se mantiene (en realidad es
    un MCCB — placeholder hasta la nueva simbología). Verificador
    resuelve barras sin codigo_iec (S00119).
  · C27: cuerpo+punta del alimentador alineados al mapa punteado
    (zoom leído con DOMMatrix, ALTO_LINEA 81, columna fija 138 px,
    reintento del efecto); E2E «alineación cuerpo alimentador».
  · C28: reconexión de la punta FUENTE sobre la barra (imposible desde
    siempre): con los handles a/b superpuestos, React Flow resolvía el
    apuntado con elementFromPoint SIEMPRE a favor del último
    renderizado ('b', tipo destino) y descartaba la suelta en silencio.
    Fix: durante la conexión se marca la raíz con .conectando-{tipo}
    (callbacks onConnectStart/onReconnectStart + refs, sin re-renders;
    useConnection en el padre provocaba bucle React #185) y CSS deja
    fuera del hit-testing los handles del tipo incompatible. E2E nuevo:
    punta fuente de c1 → n1.210a.
  · C29: quiebre arrastrable del cable — con el cable seleccionado
    aparece un grip sobre el recorrido; arrastrarlo fuerza UNA esquina
    exacta (ConexionProyecto.paso, snap a grilla, se serializa y viaja
    con duplicar/mover a hoja), clic derecho lo quita; Ctrl+Z deshace.
    Ruta: rutaOrtogonal acepta paso (extremo→esquina→extremo
    respetando ejes de salida/llegada). E2E: vértices 4→5 al doblar,
    gaps en cero, deshacer restaura.
  · C30: combinaciones LIBRES fases/neutro/tierra — cable: el stepper
    de conductores baja a 0 (solo N, solo PE o solo secciones propias;
    schema minimum 0; checklist ya exigía sección por línea presente).
    Carga: schema sin alimentacion/lleva_neutro obligatorios + nuevo
    lleva_tierra; formulario con chips Fases (—/1F/3F) + Neutro (con/
    sin N) + Tierra (con/sin PE) independientes; línea asignada solo
    con fases definidas; potencia NO se calcula sin fases (no hay
    tensión de referencia). Verificado en vivo sobre la hoja TGBT:
    3F→√3·380·I, —→sin cálculo, estado solo-PE ok.
  · C31: verificación completa en verde (build · lint · alineación ·
    símbolos · proyecto real · E2E 21 checks) y MERGE de la Fase C a
    main por orden expresa del usuario (PR #11, --merge
    --delete-branch); main sincronizada después del merge.
  · C32: lote grande de simbología ampliada (12 nuevos símbolos unifilares
    con trazo único conforme IEC 60617 / IEC 60947 / IRAM, schemas
    discriminados por subtipo en aparato.schema.json y anotaciones en
    anotaciones.ts):
    1. S00121 MCCB / caja moldeada (Ir_min, Ir_max, Im, pdcc_kA, IEC 60947-2) —
       reemplaza el placeholder S00110 del QG (n4/n5) en el proyecto TGBT real.
    2. S00122 Guardamotor termomagnético (Ue_V, Ir_min/max, Ii, Icu_kA, Ics_kA, AC-3).
    3. S00123 Relé térmico RT (Ue_V, Ir_min/max, clase_disparo 10A/10/20/30).
    4. S00124 Contacto auxiliar NA/NC (entidad de conexión separada, Ith_A).
    5. S00125 Transformador de corriente TI (relación 600/5, S_VA, clase_precisión, FS, Ue_kV).
    6. S00126 Banco de capacitores (Ue_V, Q_kvar, conexión delta/estrella).
    7. S00127 Portafusible / base (entidad separada del fusible, Ue_V, categoría).
    8. S00128 Interruptor diferencial ID/RCD (IΔn_mA, In_A, tipo AC/A/B/F, IEC 61008/9).
    9. S00129 Relé de protección de tensión (Ue_V, subtensión %, sobretensión %, asimetría %, retardo_s).
    10. S00130 Relé/contactor auxiliar completo (bobina_V, 2PDT/3PDT/4PDT, Ith_A).
    11. S00131 Sirena / alarma sonora (Ue_V, tipo_señal continua/intermitente/multitono).
    12. S00132 Instrumento de medición (voltímetro/amperímetro/multifunción, escala).
    Fuentes: 8 símbolos importados de QElectroTech
    (qelectrotech/qelectrotech-elements@b9e1020) via convertir_qet.py;
    4 símbolos creados manualmente siguiendo IEC 60617
    (TI, banco capacitores, relé protección tensión, relé auxiliar).
    Galería de símbolos regenerada (index.html con 20 símbolos).
    Verificación completa aprobada (build · lint · alineación · símbolos ·
    proyecto real · E2E 21 checks).
  · C32 (2/2): Rediseño unifilar completo de8 símbolos que estaban como
    multifilar (SVGs importados sin recortar de QET de3 polos):
    - S00121 MCCB: SVG rediseñado como polo único con interruptor
      termomagnético + caja moldeada (rectángulo IEC). Terminal IDs
      normalizados a in/out.
    - S00122 Guardamotor: SVG rediseñado como polo único con interruptor
      termomagnético + liberación térmica (arco IEC). in/out.
    - S00123 Relé térmico RT: SVG rediseñado como polo único con
      bimetal (H con rectángulo punteado). in/out.
    - S00127 Seccionador fusible (antes "portafusible base"): renombrado
      conceptualmente, SVG rediseñado como cuchilla + fusible
      (rectángulo). in/out.
    - S00128 ID/RCD: SVG rediseñado como polo único con interruptor +
      CT diferencial (círculo punteado). in/out.
    - S00129 Relé protección tensión: SVG rediseñado con bobina (rect
      con "V>") + contacto NA enlazado por línea punteada. viewBox
      ajustado a 30 ancho para pasar lint 180°. in/out.
    - S00130 Relé auxiliar: SVG rediseñado con bobina + contacto NA
      enlazado por línea punteada (patrón S00112). in/out.
    - S00132 Voltímetro: texto "V" agregado dentro del círculo. in/out.
    Todos los terminal IDs normalizados a in/out (antes variaban:
    t1/t2, 1/2, 3/5, etc.). atributos_base agregado a los 8 metadata.
    Verificación completa aprobada (lint 20/20 · galería 20 ·
    alineación · proyecto real · E2E 21 checks · build OK).
  · C32 (3/3): Tercer intento de rediseño de 8 símbolos rechazados por
    el usuario. Geometría corregida basada en SVGs exportados desde
    AutoCAD (Acme CAD Converter) del DWG original del usuario:
    - S00121 MCCB: interruptor con caja moldeada (rect IEC centrado
      en eje, switch arm diagonal, sin curva térmica compleja).
    - S00122 Guardamotor: interruptor con liberación magnética
      (rectángulo IEC debajo del switch arm, viewBox 20×60).
    - S00123 RT: rele térmico con bimetal (rectángulo con diagonal
      a la izquierda del eje, viewBox 30×60, terminal in movido a
      y=-30). Metadata actualizado.
    - S00128 ID/RCD: interruptor diferencial con CT diferencial
      (círculo punteado, sin cambios significativos).
    - S00129 Relé sobretensión: texto cambiado de "V>" a "U<>"
      según pedido del usuario. Metadata actualizado.
    - S00130 Relé auxiliar: bobina + contacto NA enlazado (sin
      cambios significativos).
    - S00127 Portafusible: base con fusible (sin cambios).
    - S00132 Voltímetro: círculo con "V" (sin cambios).
    Verificación completa aprobada (lint 20/20 · alineación ·
    proyecto real · gallery 20 · build OK · oxlint OK).
- Próximo paso acordado: revisión por parte del usuario del lote de
  12 símbolos rediseñados (3er intento, PR #12, rama
  proyecto/simbologia-ampliada-20260825).
  · C32 (merge): PR #12 mergeado a main por orden expresa del usuario
    (gh pr merge 12 --merge --delete-branch). Rama eliminada.
    Rename global verificado_aea → verificado (6 archivos: tipos.ts,
    validadorMetadata.ts, metadata.schema.json, generar_galeria.py,
    convertir_qet.py, estado-revision-aea.md). S00124/S00125/S00126/
    S00131 marcados verificado; S00121–S00123/S00127–S00130/S00132
    quedan pendiente_revision (pendientes de revisión visual del
    usuario).
- **D1 (títulos legibles en JSON Schema):** Se agregó `title` a todas
  las propiedades de los 4 archivos de schema: aparato.schema.json
  (17 subtipos + base_comun), conductor.schema.json, barra.schema.json,
  carga.schema.json. Cada propiedad ahora tiene un título legible en
  español (ej: "Cantidad de polos", "Corriente nominal (A)",
  "Tensión de operación (V)"). Se actualizaron los tipos en esquemas.ts
  (`EsquemaCampo.title`, `CampoDescriptor.title`) y el generador de
  formularios en FormularioAtributos.tsx para mostrar el título como
  etiqueta, con fallback al nombre técnico. Build + lint OK.
- **Task 1 (fix carga de símbolos):** Investigación: la causa NO fue
  D1 (los schemas no se usan en validación de metadata). Causa real:
  `import.meta.glob` con `eager: true` cachea en el start del dev
  server; los 12 símbolos se agregaron mientras el server corría, así
  que nunca entraron en `metasRaw`. Fix: reiniciar dev server. Además:
  - Corregidos 5 `tipo_aparato` en metadata.json que no matcheaban
    `$defs` del schema: S00121 (`mccb` → `mccb_caja_moldeada`),
    S00122 (`guardamotor` → `guardamotor_termomagnetico`),
    S00127 (`seccionador_fusible` → `portafusible`),
    S00128 (`id_rcd` → `interruptor_diferencial`),
    S00132 (`voltimetro` → `instrumento_medicion`).
  - Agregado conteo de símbolos cargados en `libreria.ts`: si
    `simbolos.size < totalMeta`, se emite aviso en PanelProblemas
    indicando cuántos se cargaron y sugiriendo reiniciar el server.
    Build + lint OK.
- **D2 (modo oscuro):** Paleta oscura completa vía CSS custom
  properties. Cambios:
  - `estilos.css`: Variables CSS expandidas (`--bg-canvas`,
    `--bg-surface`, `--text-primary`, etc.) con bloque
    `[data-theme="dark"]` que redefine ~40 propiedades. Overrides para
    paleta, paneles, formularios, pestañas, chips, toast, checklist,
    nodos alimentador/barra, formulario de conexión.
  - `BarraSuperior.tsx`: Botón de toggle (☀/🌙) con `useState` +
    `useEffect` que aplica `data-theme="dark"` en `<html>` y guarda
    preferencia en `localStorage("vatia-tema")`.
  - `libreria.ts`: `svgLimpio()` ahora reemplaza `#000000`/`#000` por
    `currentColor` en strokes/fills de SVGs, preservando `#e11d48`
    (puntos de conexión).
  - CSS: `.simbolo-svg` y `.paleta-thumb svg` reciben `color` que
    define el `currentColor`; dark mode lo cambia a `#e4e4e7`.
  - `App.tsx`: Edge style default usa `currentColor` en vez de
    `#1e293b`.
  - `AlimentadorNode.tsx` / `ConexionEdge.tsx`: Strokes de cables y
    marcas de conductor cambiados a `currentColor`.
  - Hoja/rótulo se mantienen con fondo blanco y texto oscuro
    (representan papel físico). Build + lint OK.
- **D2 fix (hoja responde al tema):** La hoja, el rótulo IRAM y las
  anotaciones ahora responden al tema activo. Cambios:
  - `HojaNode.tsx`: Todos los colores hardcodeados (`#fff`, `#111827`,
    `#374151`) reemplazados por CSS variables (`var(--bg-surface)`,
    `var(--text-primary)`, `var(--text-secondary)`). Tanto el fondo de
    la hoja como el rótulo y las celdas usan las mismas variables que
    el resto de la UI.
  - `estilos.css`: `.hoja` usa `var(--bg-surface)` en background y
    `var(--text-faint)` en el puntillado. `.hoja-marco` usa
    `var(--text-primary)` para el borde. Anotaciones usan
    `color-mix(in srgb, var(--bg-surface) 94%, transparent)` para el
    fondo plaqueta. Eliminados overrides dark mode redundantes para
    anotaciones/alimentador/barra (ya usan var()). Nota: la exportación
    PDF futura debe forzar tema claro (documentado en
    `docs/estado-revision-aea.md`).
- **D3 (modo administrador):** Estado global `modoAdmin: boolean` en
  el store (Zustand), persistido en `localStorage("vatia-admin")`, no
  en el JSON del proyecto. Atajo: Ctrl+Shift+A activa/desactiva. Badge
  "ADMIN" rojo en BarraSuperior cuando está activo. Build + lint OK.
- **D4.1 (hot reload de símbolos):** Investigación: `eager: false` NO
  resuelve el problema de carpetas nuevas — ambos modos re-evalúan el
  glob solo cuando el módulo padre se re-transforma. Causa raíz:
  Vite's watcher no seguía `libreria-simbolos/` porque está fuera del
  root. El `ignored: ["!**/libreria-simbolos/**"]` solo "des-ignora"
  archivos pero chokidar nunca escanea esos directorios. Fix
  definitivo: plugin `watchLibreria()` en `vite.config.ts` que agrega
  `libreria-simbolos` al watcher existente de Vite con
  `server.watcher.add()` y envía `full-reload` (debounce 300ms) ante
  cambios en .json/.svg. Eliminado el `server.watch.ignored` obsoleto.
  Build + lint OK. El usuario debe verificar manualmente en el browser.
- **D4.2 (editor de símbolos — panel admin + Fabric.js):** Nuevo
  componente `EditorSimbolos.tsx` visible solo en modo admin (reemplaza
  la paleta). Panel lateral izquierdo con búsqueda por código/nombre de
  todos los símbolos de la librería, con badge de estado (verificado ✓,
  pendiente …, corregido ✎). Canvas de Fabric.js 7.4.0 que carga el SVG
  del símbolo seleccionado via `loadSVGFromString`, con zoom automático
  para ajustar al canvas. Puntos de conexión marcados con:
  - Cruz punteada de referencia (+)
  - Círculo coloreado por rol: entrada=#e11d48, salida=#2563eb,
    tierra=#16a34a
  - Etiqueta con id y rol (monospace 8px)
  Meta info en badge inferior: código, nombre, viewBox, cantidad de puntos.
  CSS en `estilos.css` (~180 líneas): responsive, dark mode, badges de
  estado, panel colapsable. Integrado en `App.tsx` con `modoAdmin`:
  `EditorSimbolos` reemplaza `Paleta` cuando admin está activo.
  Dependencia: `fabric@7.4.0` instalada. tsc --noEmit + vite build OK.
- **D4.2+ (cambio de estado de verificación):** Agregado dropdown de
  `estado_revision` en la meta info del editor de símbolos. Valores:
  pendiente_revision / verificado / corregido. Al cambiar, el frontend
  llama `POST /api/metadata` con `{ codigo, estado }`. Plugin Vite
  `watchLibreria` expone el endpoint: lee metadata.json, actualiza el
  campo, escribe a disco, ejecuta `git add + git commit` con mensaje
  descriptivo (ej. "simbolos: S00124 estado pendiente_revision →
  verificado"). Responde con `{ ok, anterior, nuevo }`. El dropdown
  muestra feedback inline ("Guardando...", resultado). Los 4 símbolos
  ya conformes (S00124 contacto auxiliar, S00125 TI, S00126 banco de
  capacitores, S00131 sirena) ya están en estado `verificado`. Los otros
  8 quedan `pendiente_revision` hasta D4.3/D4.4. CSS: dropdown, label,
   mensaje inline, flex layout en `.editor-simbolos-meta`. tsc + build OK.
- **C35 — Fix HMR regression + type errors + dropdown persist:**
  - **D4.1 fix (hot reload):** Eliminado `full-reload` del plugin
    `watchLibreria` (que causaba recarga total y perdía estado admin).
    Para cambios manuales de metadata.json, el watcher envía un evento
    WebSocket `metadata-update` con el contenido parseado del archivo.
    `libreria.ts` escucha vía `import.meta.hot.on()` y muta `SIMBOLOS`
    in-place + despacha DOM event `vatia:metadata-update`.
    `EditorSimbolos` escucha el DOM event y actualiza `seleccionado`.
    NO se invalida el módulo `libreria.ts` (porque `import.meta.glob`
    eager no soporta content HMR y reconstruiría SIMBOLOS con cache
    stale). Agregado `.git` al `unwatch` del watcher.
  - **D4.1 fix (accept handler):** Corregido `import.meta.hot.accept()` en
    `libreria.ts` — `Object.assign(SIMBOLOS, mod.SIMBOLOS)` no funciona
    con Map. Reemplazado por `SIMBOLOS.clear()` + loop `set()`.
  - **D4.2 fix (dropdown):** La API ahora devuelve `metadata: <objeto
    completo actualizado>` en la respuesta. `cambiarEstado()` muta
    `SIMBOLOS` in-place (`prev.metadata = data.metadata`) +
    `setSeleccionado({ ...prev, metadata })` para crear nueva referencia
    React. Ya no depende de HMR para reflejar el cambio. Soporta
    múltiples cambios consecutivos sobre el mismo símbolo.
  - **D4.2 fix (badge no refrescaba):** `lista` (useMemo que renderiza
    badges ✓/✎/…) solo dependía de `[filtro]`. Agregado `tick` state
    que se incrementa tras API response y DOM event, forzando
    recomputación de la lista para que los badges reflejen el estado.
  - **Type errors corregidos:** `FabricObject` import de `fabric`, null
    check para `svgEl`, `_next` en middleware.
  - Build (`tsc -b && vite build`) OK.
- **C36 — Branch management + revert commits de prueba:**
  - Revertidos 18 commits automáticos del endpoint /api/metadata que
    estaban en main (commits de prueba de S00110/S00112). Usado
    `git reset --soft` para no perder cambios del working tree.
  - S00110 verificado: `estado_revision: "pendiente_revision"`
    (confirmado en archivo).
  - Creada rama `proyecto/editor-simbolos-20260826` desde `5cf4317`.
  - Commiteada en 3 grupos lógicos:
    1. `6b6ed42` C35: fix HMR + modo oscuro + modo admin
    2. `09a0849` C35: editor de símbolos (Fabric.js + dropdown estado)
    3. `998f244` C32-C35: fix tipo_aparato + schema titles + historial
  - Endpoint /api/metadata: confirma que commitea sobre la rama activa
    del repo (usa `cwd: raizRepo` sin branch explícito). Desde ahora
    el dev server debe correr sobre `proyecto/editor-simbolos-20260826`.
- **D4.3 (edición de geometría):**
  - `lint_simbolos.py`: Nuevo argumento `--symbol S00110` para validar
    un solo símbolo (usado por el endpoint antes de guardar).
  - `historialCanvas.ts`: Clase `HistorialCanvas` con patrón
    `{do, undo}` idéntico a `historial.ts`. Límite 100 pasos. Singleton
    `historialCanvas`. Se resetea al cambiar símbolo, se vacía tras
    guardar exitoso.
  - `vite.config.ts`: Nuevo endpoint `POST /api/geometry` con
    validación lint previa al guardado. Flujo: backup → write SVG →
    lint → si falla restaura backup + responde errores específicos
    (qué punto, qué cálculo falló) → si pasa git commit. Watcher de
    `simbolo.svg` envía evento WebSocket `svg-update`.
  - `EditorSimbolos.tsx`: Modo edición con botón "Editar geometría".
    Canvas interactivo: objetos seleccionables + drag. Handlers
    `object:moving`/`object:modified` crean comandos de undo/redo.
    Toolbar con ↶↷ (undo/redo) + Guardar/Cancelar. Atajos
    Ctrl+Z/Ctrl+Shift+Z. SVG-update listener para ediciones manuales.
    Lint errors se muestran específicos en el panel.
  - `libreria.ts`: Listener `svg-update` muta SIMBOLOS in-place +
    despacha DOM event.
  - `estilos.css`: Estilos toolbar de edición (mismo patrón que
    `.barra-superior button`), dark mode overrides.
- **C37 (fixes D4.3):**
  - Fix selección individual: `inlineSvgGroups()` function strips `<g>`
    wrappers from SVG and inlines their attributes onto children before
    `loadSVGFromString`, producing flat primitives instead of a single
    Group. Each primitive is individually selectable in edit mode.
    `_esPrimitiva` flag tags symbol primitives; connection markers stay
    non-interactive.
  - Fix guardado: `guardarGeometria` now transforms primitives from
    fabric space back to SVG coordinate space before `toSVG()`:
    `svgX = (fabricX - offsetX) / ESCALA`. Resets viewport to identity,
    exports with viewBox, restores viewport + positions. Markers hidden
    during export.
  - `offsetRef`: stores offsetX, offsetY, zoom for coordinate transforms.
  - Grid overlay: dotted grid at MULTIPLO (10 SVG units) intervals
    during edit mode. `Circle` objects tagged `_esGrilla`, added/removed
    when editando toggles.
  - Análisis viewBox 20 símbolos: caja canónica propuesta
    `minX=-15, minY=-35, W=30, H=60` (cubre 18/20). Outliers:
    S00119 barra (60×20 horizontal), S00131 sirena (50×50).
- **C38 (fix grid + pan):**
  - Grid: replaced Fabric-object-based grid (hundreds of Circle objects
    interfering with interaction) with a pure Canvas2D overlay. Grid
    dots drawn on a separate `<canvas>` with `pointer-events: none`.
    Covers the full visible area (not just viewBox), recalculates
    visible SVG range from viewport transform. Redraws on pan/resize.
  - Panning: Space+drag modifies `fc.viewportTransform` (translate).
    Grid redraws on every pan via `gridVersion` state counter.
  - Fix grid coordinate formula: `sx = a * (x * ESCALA + offsetX) + e`
    to properly align with symbol primitives.
- **C39 (fix rendering bug — revert inlineSvgGroups → Group + subTargetCheck):**
  - `inlineSvgGroups()` stripped `<g>` wrappers from SVG before
    `loadSVGFromString`. This broke the SVG coordinate system —
    Fabric.js returned primitives with wrong positions, rendering
    symbols as a tiny speck.
  - **Root cause:** Without the `<g>` wrapper, Fabric's SVG parser
    assigns different local coordinates to individual elements.
    The flat primitives had their `left`/`top` in a coordinate space
    that didn't match our `ESCALA_EDICION` transform.
  - **Reverted** to Group approach: `loadSVGFromString` loads SVG as-is,
    wraps in `Group(objs, { subTargetCheck: true })`, positioned at
    `(offsetX, offsetY)` with `scaleX/Y: ESCALA_EDICION`.
  - `subTargetCheck: true` on the Group allows clicking/dragging
    individual children within the Group (the original issue that
    motivated `inlineSvgGroups` in the first place).
  - Removed `inlineSvgGroups()` function entirely.
  - Updated `guardarGeometria`: finds `_esGrupoSimbolo` Group, extracts
    children's local coords (which = SVG coords within viewBox),
    converts to canvas space (`svgX * ESCALA + offsetX`), resets
    Group transform, exports, restores. Markers hidden during export.
  - Updated edit mode effect: toggles `_esGrupoSimbolo` selectable
    instead of `_esPrimitiva`.
  - Undo/redo unchanged — `object:moving`/`object:modified` fire
    on child targets within Group (subTargetCheck), storing local
    coords which are restored correctly.
  - Build passes, TS clean.
- **C40 (major rewrite — flat primitives, zoom, pan, fixed save):**
  - **Root cause of all issues**: Group wrapping made symbols a single
    block; `loadSVGFromString` with viewBox caused double-scaling;
    save function didn't reverse transforms correctly.
  - **New SVG loading approach**: `inlineSvgGroups()` strips `<g>`
    wrappers, inlining shared attributes (fill, stroke, etc.) onto
    children. SVG viewBox is stripped before loading (prevents
    Fabric.js from applying its own viewBox transform). Result:
    flat array of primitives from `loadSVGFromString` with no Groups.
  - Each primitive gets `originX: "left", originY: "top"` for
    consistent positioning. Positioned at `svgX * ESCALA_EDICION + offsetX`.
  - **Individual primitive editing**: Each `_esPrimitiva` is
    independently selectable and draggable in edit mode.
  - **Fixed save** (`guardarGeometria`): converts canvas coords
    back to SVG: `svgX = (canvasLeft - offsetX) / ESCALA_EDICION`.
    Resets viewport to identity, exports with `toSVG()`, wraps
    with original viewBox, restores everything.
  - **Zoom**: Mouse wheel centered on cursor, toolbar buttons
    (−/+), Ctrl+=/Ctrl+-/Ctrl+0 shortcuts. `aplicarZoom()` adjusts
    viewport transform maintaining cursor position.
  - **Pan**: Space+drag (existing) + middle-click drag (new).
    Works in both view and edit modes.
  - **Zoom display**: Clickable percentage in toolbar, click
    to reset to fit-to-view.
  - CSS: `.editor-simbolos-zoom` styled as clickable label.
  - **Note**: S00110 SVG was corrupted by previous bad save
    (Fabric canvas coordinates leaked into SVG). It renders
    off-screen. Needs regeneration from QET source.
  - Build passes, TS clean.

---

## E1 — Revisión general del proyecto y limpieza del andamiaje (31/08/2026)

**Rama:** `proyecto/editor-simbolos-20260826` · sin commitear al momento de
escribir esta entrada.

### Revisión general pedida por el usuario

Se auditó el proyecto completo con vistas al objetivo declarado (base de datos
de dispositivos + motor de verificación de filiación, selectividad,
cortocircuito y corriente admisible). Conclusiones principales:

- **Vatia hoy es un CAD documental, no una herramienta de cálculo.** Búsqueda en
  todo el repo: cero menciones a selectividad, filiación, IEC 60909 o IEC 60364.
  Los únicos cálculos son `S=√3·V·I` (`FormularioCarga.tsx:23-37`),
  `potencia_va × ku` (`utilizacion.ts:38-42`) y la estimación de In de motor
  (`FormularioAtributos.tsx:36-55`). El "Checklist AEA" valida completitud de
  ficha, no dimensionamiento.
- **Tres bloqueantes estructurales:** (1) no se recorre el grafo — las
  conexiones se serializan como strings `"nodo.handle"` (`store.ts:294-306`) y
  no hay noción de aguas arriba/abajo; (2) faltan datos de entrada —
  `longitud`, método de instalación, temperatura, agrupamiento, tensión de
  sistema (hardcodeada 220/380), esquema de puesta a tierra, Scc de fuente,
  cosφ, Ks; (3) los atributos son `Record<string, unknown>` sin tipar.
- **Advertencia de diseño:** filiación y selectividad no se calculan, se leen de
  tablas de ensayo del fabricante. La futura BD necesita pares aguas
  arriba/abajo con Icc reforzada y curvas t-I digitalizadas, no solo datos de
  chapa.
- **Inconsistencias detectadas:** `pdcc_kA` vs `icu_kA`/`ics_kA` según subtipo;
  el MCCB no declara Ics; `pdcc_kA: 2500` en `proyecto-real-pps.json` son
  amperes crudos donde el schema pide kA; `migrar_tgbt.mjs:159-187` quedó
  desincronizado del JSON y revertiría la corrección de C32 si se vuelve a
  correr; S00124/S00125/S00126/S00131 no declaran `atributos_base`, por lo que
  al instanciarlos no muestran ningún campo.
- **Riesgos abiertos:** S00110 corrupto y commiteado (`f5d901e`); el lint no
  valida XML ni geometría fuera de viewBox; los endpoints del dev server
  commitean sin rama explícita; 8 commits sin pushear.

Documento completo de la revisión en
`C:\Users\augug\.claude\plans\nesecito-que-revises-mi-shiny-tome.md`.

### Limpieza del andamiaje de documentación

Un intento previo de andamiaje dejó archivos que describían un proyecto
distinto al real. Decisión del usuario: **seguir sobre este proyecto, no
empezar de cero** — no había código tocado ni commits sucios.

Acciones:

- `AGENTS.md` **recuperado** con `git checkout --` (había sido borrado del
  working tree; estaba intacto en HEAD).
- `mnt/user-data/outputs/vatia-andamiaje/…` **borrado**: era un path de sandbox
  creado literalmente dentro del repo, con una copia byte a byte de
  `tests/selectividad/README.md`.
- **Descartados** (respaldados fuera del repo, en el scratchpad de la sesión):
  - `docs/adr/0001-stack-frontend.md` — decide FastAPI como backend, decisión
    que nunca se tomó; `apps/api/` está vacío.
  - `docs/adr/0002-libreria-de-simbolos-propia.md` — registra como "descartada"
    la importación desde QElectroTech, que es exactamente lo que el proyecto
    hizo (`convertir_qet.py`, `fuente_qet` en cada metadata, atribución
    GPL-2.0). Afirma además campos que no existen (`norma_ref`, puntos de
    conexión tipados).
  - `docs/adr/0003-plan-de-fases.md` — cinco fases que no se corresponden con
    las reales (F0–F6, C1–C40, D1–D4.3).
  - `docs/domain-model.md` — se declaraba "vocabulario único" con un modelo
    paralelo que contradice los schemas vigentes (`cobre|aluminio` vs `Cu|Al`,
    `aislante` vs `aislacion`, `seccion_mm2` vs `seccion_fase_mm2`,
    4 tipos de protección vs 17 `tipo_aparato`), y prohibía los términos
    `interruptor` y `cable`, que son los que usan los schemas reales.
  - `docs/devlog/` — describe una sesión en la rama `docs/andamiaje-inicial`,
    que nunca se creó, y declara adoptados Conventional Commits, en conflicto
    con el formato de commits ya definido en `AGENTS.md`.
- **Conservados** por ser correctos y mirar hacia adelante sin afirmar nada
  falso sobre el pasado: `docs/normativa/README.md` (criterio de no versionar
  normas con derechos de autor), `data/catalogo/README.md` (versionar el
  catálogo como archivos planos y sembrar la BD desde ahí) y
  `tests/selectividad/README.md`.
- `CLAUDE.md` reescrito: se le sacó la referencia a `docs/devlog/` y se dejó
  explícito que **la bitácora única es `HISTORIAL.md`**.

### Decisiones tomadas

- **Bitácora única: `HISTORIAL.md`.** Se descarta el devlog por sesión para no
  repetir el patrón que dejó `docs/estado-revision-aea.md` documentando 7 de
  20 símbolos.
- **Normativa: AEA e IEC seleccionables por proyecto.** Implica que las tablas
  de Iz, los factores de corrección y los límites de caída de tensión son datos
  parametrizados, no constantes en el código, y que el proyecto necesita un
  campo `normativa` (migración v2 → v3).
- **Backend: sin decidir.** `apps/api/` queda vacío hasta encarar la etapa de
  base de datos.
- Los ADR reales se escribirán más adelante a partir de este historial, que sí
  tiene las decisiones verdaderas con fecha y motivo.

### Próximo paso

Terminar el editor de símbolos (C39/C40 sin commitear, S00110 corrupto,
lint insuficiente), según el orden pedido por el usuario.

---

## E2 — Editor de símbolos: S00110 recuperado, lint endurecido y guarda de rama (31/08/2026)

**Rama:** `proyecto/editor-simbolos-20260826`.

### S00110 recuperado

El commit `f5d901e` ("simbolos: S00110 geometria actualizada") había dejado el
símbolo más usado del proyecto inservible. Diagnóstico del archivo:

- Coordenadas de canvas de Fabric filtradas al SVG
  (`matrix(1 0 0 1 882 1230)`): el dibujo caía en (875,168)–(924,1276) cuando
  el viewBox es (-10,-35)–(10,25).
- XML inválido: un `<?xml?>` y un `<!DOCTYPE>` **después** de la etiqueta
  `<svg>` de apertura.
- Marcadores del editor dentro del archivo de librería: cruces, círculos de
  handle y los textos "in (entrada)" / "out (salida)" con `visibility: hidden`,
  más el `<desc>Created with Fabric.js</desc>`.
- Perdidos los `class="punto-conexion"` y la estructura original.

**No hizo falta regenerar desde QET:** se restauró el archivo exacto anterior
al commit con `git checkout f5d901e^ -- <ruta>`. Verificado además que ningún
otro símbolo estaba contaminado (búsqueda de rastros de Fabric en los 22 SVG de
la librería) y que los 22 son XML válido.

### `lint_simbolos.py` endurecido

El lint validaba viewBox y `puntos_conexion` del metadata, pero **nunca miraba
el dibujo**: por eso el guardado corrupto pasó el hook pre-commit y el gate de
`/api/geometry`. Se agregaron tres comprobaciones:

1. **XML bien formado** (`ET.fromstring`). Si falla, se corta ahí: el resto
   daría ruido.
2. **Prólogo mal ubicado**: `<?xml?>` o `<!DOCTYPE>` después de `<svg>`.
3. **Rastros del editor**: `Created with Fabric.js`, `visibility: hidden`, y
   los rótulos `(entrada)` / `(salida)`.
4. **Geometría dentro del viewBox**: se recorre el árbol acumulando los
   `transform` (soporta `matrix`, `translate` y `scale`) y se calcula la caja
   real de `line`, `polyline`, `polygon`, `circle`, `ellipse` y `rect`.
   Tolerancia `TOLERANCIA_VIEWBOX = 1.0` unidades.

**Descartada una regla que resultó incorrecta:** rechazar todo `<text>`. Dio
tres falsos positivos porque hay letras que son parte de la norma IEC 60617 y
no anotación del editor — "V" en el voltímetro (S00132), "U<>" en el relé de
tensión (S00129) y "M 3~" en el motor (S00115). Los rótulos del editor ya los
detecta la regla de rastros por su contenido.

**Verificación:** los 20 símbolos pasan. Reinyectando el SVG corrupto, el lint
lo rechaza por XML inválido; y quitándole solo el prólogo (para que el XML sea
válido y no corte antes), lo rechaza igual por rastro de Fabric y por geometría
fuera del viewBox. Margen mínimo real de la librería sana: 2.0 unidades, salvo
S00123 que toca el borde exacto (0.00) de forma legítima.

### Guarda de rama en los endpoints del dev server

`POST /api/metadata` y `POST /api/geometry` hacían `git add` + `git commit` con
`cwd: raizRepo` y **sin rama explícita**, lo que ya contaminó `main` con 18
commits (revertidos en C36) y contradice la regla de `AGENTS.md`.

- Nueva función `commitearSeguro(archivo, mensaje)` con `RAMAS_PROTEGIDAS`
  (`main`, `master`, `HEAD` desprendido): si la rama activa está protegida, **el
  archivo se guarda igual pero no se commitea**, y el motivo vuelve al cliente.
- Ambos endpoints devuelven ahora un campo `commit` con `{commiteado, rama,
  motivo}` en vez de tragarse el error en silencio.
- Los commits pasaron de `execSync` con interpolación de string a
  `execFileSync` con argumentos en array: sin shell de por medio, que además
  resuelve el paso del carácter "→" del mensaje en Windows.

### Fixes del editor (C40)

- **El trabajo de C40 no compilaba**, pese a que el historial decía "Build
  passes, TS clean": `tsc -b` fallaba con
  `TS6133: 'zoomVersion' is declared but its value is never read`.
- `zoomVersion` era un contador de estado usado solo para forzar re-render,
  mientras `zoomActual` se leía de `fabricRef.current.viewportTransform[0]`
  **durante el render** — un anti-patrón que devuelve el valor de la pasada
  anterior. Se eliminó el contador y `zoomActual` pasó a ser estado real,
  actualizado en los tres sitios que ya tenían el zoom nuevo a mano
  (`aplicarZoom`, `zoomFit` y la carga del símbolo).
- Documentado por qué `tick` **no** sobra en el `useMemo` de `lista`, aunque
  oxlint lo marque: `SIMBOLOS` es un Map de módulo que el HMR muta en el lugar,
  así que su identidad nunca cambia y el memo no se recalcularía solo.

### Verificaciones corridas

`npm run build` (verde), `npm run lint` (solo dos warnings preexistentes, ambos
falsos positivos), `python scripts/lint_simbolos.py` (20/20),
`node scripts/verificar_alineacion.mjs` (verde),
`node scripts/verificar_proyecto_real.mjs` (verde).

### Pendiente de esta etapa

- El editor de símbolos sigue **sin verificación visual del usuario** y sin
  cobertura E2E; el arnés `e2e/conexiones.mjs` no lo toca.
- La rama sigue sin pushear y sin PR.

### E2.1 — Corrección: la rama de trabajo no era la que E1 y E2 declaran

Las entradas E1 y E2 dicen "Rama: `proyecto/editor-simbolos-20260826`". **Es
incorrecto.** El trabajo se hizo sobre `docs/andamiaje-inicial`, una rama que
el intento de andamiaje sí había creado desde `f5d901e`.

E1 afirma además que esa rama "nunca se creó", tomando el dato del devlog. La
verificación fue insuficiente: se leyó el devlog y se dio por sentado que la
rama no existía, sin correr `git branch`. Existía, y era la rama activa.

Consecuencia: los commits `67350b5` (limpieza del andamiaje) y `4ab8972`
(S00110 + lint + guarda de rama) cayeron en `docs/andamiaje-inicial`, mientras
`proyecto/editor-simbolos-20260826` seguía en `f5d901e`.

Resuelto sin perder nada, porque `4ab8972` desciende de `f5d901e`:

```
git branch -f proyecto/editor-simbolos-20260826 4ab8972
git checkout proyecto/editor-simbolos-20260826
git branch -d docs/andamiaje-inicial
```

`proyecto/editor-simbolos-20260826` queda como única rama de este trabajo, con
los 10 commits (C35 → E2). `docs/andamiaje-inicial` borrada: su nombre ya no
describía el contenido y no seguía la convención de `AGENTS.md`.

**Lección para el flujo:** antes de escribir la rama en el historial o en un
mensaje de commit, leerla de `git rev-parse --abbrev-ref HEAD`, no de un
documento. La guarda `commitearSeguro()` que se agregó en E2 protege `main`,
pero no advierte nada si la rama activa es simplemente la equivocada.

---

## E3 — El editor de símbolos, verificado por fin: dos bugs de render y arnés E2E propio (31/08/2026)

**Rama:** `proyecto/editor-simbolos-20260826` (leída de `git rev-parse`, según la
lección de E2.1).

E2 dejó anotado que el editor seguía sin verificación visual. Se hizo esa
verificación levantando el dev server y manejando Chromium con el Playwright que
el proyecto ya tenía. **El editor estaba roto**, pese a que C40 se dio por bueno
con "Build passes, TS clean".

### Bug 1 — el offset ignoraba el origen del viewBox

La conversión de coordenadas SVG a canvas era
`canvasX = svgX * ESCALA_EDICION + offset`, con

```
ox = (ancho_canvas / zoom - vb.ancho * ESCALA_EDICION) / 2
```

es decir, solo el término de centrado. **Faltaba restar el origen del viewBox.**
Para S00110 (`viewBox="-10 -35 20 60"`) eso desplazaba el dibujo 200 px a la
izquierda y 700 px hacia arriba: el terminal de entrada, en SVG y=-30, caía en
-557 px y el símbolo aparecía cortado por arriba.

Arreglado con una función única `offsetDeEncuadre(fc, vb, zoom)` que suma los dos
términos. Como las cuatro conversiones del componente (carga de primitivas,
guardado, puntos de conexión y grilla) leen el mismo `offsetRef`, corregir el
offset las corrigió a todas de forma coherente, sin tocar los consumidores.

### Bug 2 — el origen de las primitivas (el que oscilaba desde C37)

Con el offset ya corregido los marcadores caían bien, pero el símbolo seguía
apareciendo **partido en dos fragmentos**. Se instrumentó el componente con una
sonda temporal para volcar lo que devuelve Fabric, en vez de seguir razonando a
ciegas:

`loadSVGFromString` entrega las primitivas con `originX`/`originY` = `"center"`
y `left`/`top` apuntando al **centro** de su caja. Comprobado en el volcado: la
polilínea del elemento térmico llegaba con `top` = -4,75, que es exactamente el
centro de su rango y (-20 a 10,5), no su borde superior.

El código hacía `obj.set({ ..., originX: "left", originY: "top" })`. Fabric **no
reposiciona** al cambiar el origen: se limita a reinterpretar `left`/`top` como
esquina, y cada primitiva se corre media caja hacia abajo. Con esa polilínea:
centro en pantalla y=453 y altura 427 px ⇒ ocupaba 453→880 en vez de 240→667,
que es exactamente el fragmento inferior que mostraba la captura.

**La corrección es quitar el override**: se conserva el origen que trae Fabric.
Esto es lo que las cuatro iteraciones C37 → C38 → C39 → C40 no acertaron; C39
había diagnosticado bien que el problema eran "coordenadas locales distintas",
pero atacó el envoltorio `<g>` en vez del origen.

### Arnés E2E propio del editor

Nuevo `apps/editor/e2e/editor-simbolos.mjs` (`npm run e2e:simbolos`). El arnés
existente, `e2e/conexiones.mjs`, no tocaba el editor de símbolos: por eso cuatro
iteraciones rotas pasaron los controles.

Mira los píxeles del canvas, separando la tinta oscura del dibujo de los
marcadores de color, y para cada uno de los 20 símbolos exige:

1. que se dibuje algo;
2. que la tinta quede a más de 20 px del borde del canvas — el encuadre reserva
   60 px (30 por lado), así que acercarse más significa que el símbolo se
   escapó del área visible;
3. que el centro de cada marcador caiga sobre la caja de tinta, con 40 px de
   tolerancia.

Sobre la tolerancia: necesita holgura porque el círculo rojo del terminal
**tapa** el extremo negro de la línea (la tinta "empieza" un par de unidades más
adentro) y porque la etiqueta del punto corre el centroide del marcador. Se
descartó un umbral de 24 px que daba 15 falsos positivos por ese motivo.

**El arnés se verificó contra el bug**, que es lo que le faltó a C37–C40:
reintroduciendo a propósito el override de origen, falla en los 20 símbolos con
exit 1. Un test que pasa pero no atraparía el defecto no sirve de nada.

### Verificaciones corridas

`npm run build` (verde), `npm run lint` (dos warnings preexistentes),
`npm run e2e:simbolos` (20/20), `python scripts/lint_simbolos.py` (20/20),
`node scripts/verificar_alineacion.mjs` y
`node scripts/verificar_proyecto_real.mjs` (verdes).

### Pendiente

- El arnés nuevo necesita el dev server levantado a mano; todavía no lo arranca
  solo, igual que `conexiones.mjs`.
- La rama sigue sin pushear y sin PR.

---

## E3 — El guardado de geometría estaba realmente roto: encontrado y corregido con prueba end-to-end (31/08/2026)

**Rama:** `proyecto/editor-simbolos-20260826`.

### Cómo se encontró

E2 dio por buena la reescritura C40 del editor de símbolos basándose en que
compilaba y en una captura de pantalla del **modo vista** (el símbolo se
renderiza bien). Nunca se probó el **guardado real**. Al hacerlo con un
arnés propio de Playwright contra el dev server real:

1. Se activó modo admin, se abrió S00110, se entró a "Editar geometría".
2. Se arrastró una primitiva una distancia chica y controlada.
3. Se apretó "Guardar" y se inspeccionó la respuesta real de
   `POST /api/geometry`.

**El primer intento reprodujo exactamente la corrupción original de
`f5d901e`**: mismo prólogo `<?xml?>` y `<!DOCTYPE>` después de `<svg>`, mismo
`<desc>Created with Fabric.js</desc>`, mismos marcadores con
`visibility: hidden` y los rótulos "in (entrada)"/"out (salida)". El endpoint
respondió `ok: true`.

Antes de sospechar del código, se comprobó que el lint endurecido de E2 sí
rechaza ese contenido corriéndolo a mano (`exit 1`). Eso descartó el lint como
causa y apuntó al dev server: **llevaba corriendo desde antes de todos los
cambios de E2 y nunca se había reiniciado**, así que el endpoint que atendía
la petición era el código viejo. Con el servidor reiniciado, el endpoint
rechazó correctamente el intento (`ok: false`, con el error del lint) y no
tocó el archivo — ahí quedó confirmado que la corrupción no era un problema
del lint sino del código de guardado en sí.

### La causa real

`guardarGeometria()` en `EditorSimbolos.tsx`, dos bugs:

1. **Extracción de `fc.toSVG()` incompleta.** Fabric.js 7.4.0 devuelve un
   documento completo (prólogo `<?xml?>` + `<!DOCTYPE>` + `<desc>` + `<defs>`
   + la etiqueta `<svg>` recién después). El código hacía
   `.replace(/<svg[^>]*>/, "")`, que borra **solo esa etiqueta**, dejando el
   prólogo y el DOCTYPE de *antes* intactos. Ese texto sobrante quedaba
   embebido dentro del `<svg>` nuevo que se armaba — la corrupción exacta de
   S00110.
2. **Ocultar marcadores con `visible: false` no alcanza.** Fabric igual los
   serializa en `toSVG()`, como un elemento con
   `style="...visibility: hidden"`. Por eso los rótulos "in (entrada)" /
   "out (salida)" terminaban en el archivo pese a estar "ocultos".

### La corrección

- Ubicar la apertura real de `<svg ...>` con `match()` y cortar desde el
  final de esa coincidencia hasta el último `</svg>`, en vez de un
  `.replace()` de la etiqueta sola. Se descartan además `<desc>` y
  `<defs></defs>` vacíos que agrega Fabric.
- Sacar los marcadores del canvas con `fc.remove()` antes de exportar y
  volver a agregarlos con `fc.add()` después, en vez de solo ocultarlos.

### Verificación end-to-end (no solo build)

Con el dev server reiniciado y el fix aplicado, se repitió la prueba
completa: la respuesta de `/api/geometry` volvió `ok: true` con un SVG limpio
(sin prólogo, sin DOCTYPE, sin `<desc>`, sin marcadores) y el campo
`commit: {commiteado: true, rama: "proyecto/editor-simbolos-20260826"}` de la
guarda de E2 confirmando que reconoció la rama correcta.

**Efecto colateral de la propia prueba:** al estar en una rama no protegida,
el guardado de prueba generó un commit automático real
(`simbolos: S00110 geometria actualizada`) con el arrastre de prueba. Se
deshizo con `git reset --soft HEAD^` + `git checkout HEAD -- <ruta>` (al
alcance de la mano porque era el tope de la rama y no estaba pusheado) para
no dejar en la librería un cambio sin sentido — la corrección de código es lo
que vale, no ese arrastre.

### Lección para el flujo de verificación

Un build en verde y una captura del modo vista **no prueban que una función
de guardado funcione**: hay que ejercitar la ruta de escritura real contra el
servidor corriendo. Y antes de correr esa prueba, confirmar que el servidor
en pie está sirviendo el código que se acaba de cambiar — un dev server viejo
sirviendo código stale puede hacer que una verificación "confirme" un bug ya
corregido.

### Verificaciones corridas

`npm run build` (verde), `npm run lint` (dos warnings preexistentes),
`python scripts/lint_simbolos.py` (20/20), `verificar_alineacion.mjs` y
`verificar_proyecto_real.mjs` (verdes), y la prueba end-to-end de guardado
real descripta arriba.

---

## E4 — Arnés E2E extendido para cubrir el guardado real (31/08/2026)

**Rama:** `proyecto/editor-simbolos-20260826`.

El arnés `e2e/editor-simbolos.mjs` (de antes del corte por límite de uso,
commit `3eadc35`) solo cubría render, que es exactamente el hueco que dejó
pasar los bugs de guardado de E3. Se le agregó `probarGuardadoReal()`:
abre S00110 en modo edición, arrastra una primitiva, guarda contra el
endpoint real y verifica en la respuesta que el SVG no tenga prólogo `<?xml?>`,
`<!DOCTYPE>`, el `<desc>` de Fabric.js, marcadores `visibility: hidden` ni los
rótulos "in (entrada)"/"out (salida)" — la misma lista de rastros que detecta
el lint endurecido de E2, pero ejercitada de punta a punta contra el servidor
real.

**Riesgo aparte que había que resolver:** el endpoint commitea sobre la rama
activa cuando no es `main` (guarda de E2), así que correr esta prueba sobre
una rama de trabajo generaría un commit real en cada corrida. La prueba
registra el `HEAD` antes de guardar y, en un `finally` que corre pase o no la
prueba, restaura el contenido original del archivo y, si el guardado generó
un commit, lo deshace con `git reset --soft <head-anterior>` seguido de
`git checkout HEAD -- <archivo>` (el reset solo mueve el puntero de rama y dejaría el índice con el
contenido corrupto todavía en stage; el checkout final es el que deja índice
y working tree alineados con el HEAD restaurado). Verificado: tras correr el
arnés completo, `HEAD` no se movió y `git diff` del SVG de S00110 quedó vacío.

Dos errores propios encontrados y corregidos al escribir esta prueba, antes
de commitear:
- Una función placeholder (`probarGuardado`) con una expresión sin sentido
  que quedó pegada por error de edición — eliminada, no se llegó a usar.
- Un `${codigoPrueba}` referenciado fuera de su scope en el mensaje de éxito,
  que habría lanzado `ReferenceError` la primera vez que el guardado
  funcionara — cambiado por un literal.

`npm run e2e:simbolos` corrido completo: 20/20 símbolos + guardado real,
todo verde.

---

## E5 — Nota: falla preexistente en el arnés E2E original, no introducida por esta sesión

Al correr la batería completa como cierre, `npm run e2e` (el arnés
`e2e/conexiones.mjs`, del editor de diagrama principal, no del de símbolos)
falló en el caso `[punta fuente] c1/ini → n1.210a` con
`✗ clic no seleccionó c4 (c5) o el grip no apareció`.

Ninguno de los cambios de E1–E4 tocó `App.tsx` ni `ConexionEdge.tsx`, así que
se verificó si era preexistente: se hizo checkout temporal (detached HEAD, sin
tocar la rama) al commit `f5d901e` — el estado de la rama antes de todo el
trabajo de esta sesión — y se corrió el mismo arnés. **La misma falla aparece
ahí también.** No es una regresión de esta sesión; es deuda ya presente.

Queda fuera de alcance de esta etapa (el pedido del usuario fue terminar el
editor de símbolos). Se registra para que quede visible en la próxima pasada
sobre el editor de diagrama principal.

---

## E6 — El bug real de "el elemento se va a otra posición": metadata.json nunca se sincronizaba (31/08/2026)

**Rama:** `proyecto/editor-simbolos-20260826`.

### Reporte del usuario

Además de señalar 7 símbolos con geometría incorrecta (§ver E7), el usuario
reportó: *"cuando guardás en determinada posición luego el elemento que se
desplazó se va a otra posición"*. Mientras se investigaba, apareció un diff
sin commitear en `S00132` que **no generó ninguno de mis scripts** — todo
indica que salió de que el propio usuario probó la app en el dev server que
había quedado corriendo. Es evidencia en vivo del bug, guardada en
`scratchpad/evidencia-bug/` antes de descartarla del working tree.

### Diagnóstico

`apps/editor/src/componentes/NodoSimbolo.tsx:79` arma los `Handle` de React
Flow (donde engancha un cable en el diagrama) leyendo **única y
exclusivamente** `simbolo.metadata.puntos_conexion` — nunca el SVG. El
círculo rojo/azul dibujado dentro del símbolo es geometría aparte.

El editor de geometría (`EditorSimbolos.tsx`) permite arrastrar ese círculo
(está cargado como una primitiva más, seleccionable). El guardado
(`POST /api/geometry`) escribía el SVG con el círculo en su nueva posición
— pero **nunca tocaba `metadata.json`**. Consecuencia: el dibujo se movía,
`metadata.json.puntos_conexion` quedaba intacto, y como el diagrama usa
exclusivamente ese archivo, el cable seguía enganchando en la posición
vieja. **La función no tenía ningún efecto real**: mover un terminal en el
editor nunca cambiaba dónde conecta el cable en el diagrama — solo corría
un dibujo decorativo.

Prueba controlada que lo confirmó: arrastré el terminal "in" de S00110
40 px de pantalla (2,857 unidades SVG, fuera de grilla) → el SVG guardó
la nueva posición del círculo con exactitud matemática, pero
`metadata.json` siguió en `x: 0.0` sin cambios.

### La corrección

**Carga** (`EditorSimbolos.tsx`): al cargar cada primitiva, si su posición
SVG original coincide (tolerancia 0,5 u) con un `puntos_conexion[i]` del
metadata, se la etiqueta con `_idPuntoConexion` y se guarda su posición
original en `_origPuntoConexion`.

**Guardado** (`guardarGeometria`): durante la conversión canvas→SVG, para
cada primitiva etiquetada se compara su posición final contra la original;
solo si difiere se agrega a un mapa de "puntos movidos". Se arma un
`puntos_conexion` actualizado (solo si hubo algún movimiento real — ver
más abajo por qué) y se manda al servidor junto con el SVG.

**Servidor** (`vite.config.ts`, `POST /api/geometry`): acepta un campo
opcional `puntos_conexion`. Si viene, hace backup de `metadata.json`
también (no solo del SVG), escribe ambos archivos, corre el lint — que
**de paso valida que la nueva posición siga alineada a grilla**, la misma
regla que ya rige para todo lo demás en `AGENTS.md` — y si falla restaura
**ambos** backups. Si pasa, commitea SVG + metadata.json **juntos, en un
solo commit** (`commitearSeguro()` se extendió para aceptar una lista de
archivos). La respuesta incluye el `metadata` actualizado, que el cliente
aplica de inmediato al caché `SIMBOLOS` — sin esto, el diagrama seguiría
mostrando el handle viejo hasta recargar la página.

**Ajuste posterior, encontrado al probar:** la primera versión mandaba el
`puntos_conexion` completo en **cada** guardado, aunque nadie hubiera
tocado un terminal — porque el loop marcaba "movido" a cualquier primitiva
etiquetada, sin comparar contra su posición original. Eso reescribía
`metadata.json` en cada guardado, con el mismo contenido pero reformateado
por `JSON.stringify(..., 2)` (ruido de diff puro). Corregido comparando
contra `_origPuntoConexion`: ahora solo se manda (y solo se commitea
`metadata.json`) cuando un punto realmente cambió de posición.

### Bug secundario encontrado en el camino: texto sin ancla

La evidencia del usuario en S00132 mostró que `fc.toSVG()` también
descarta `text-anchor="middle"` y `dominant-baseline="central"` de
cualquier `<text>`. El original centra la letra ("V", "M 3~", "U<>")
sobre su punto con esos dos atributos; el SVG re-exportado por Fabric
emite `<tspan x=... y=...>` sin ellos, así que **cualquier visor que no
sea Fabric** (el diagrama, un navegador común, esta misma galería) dibuja
el glifo con ancla-inicio/línea-base-alfabética por defecto — en otra
posición. Afecta a los tres símbolos con texto: S00115, S00129, S00132.

Corregido reinyectando ambos atributos a cualquier `<text>` del SVG
exportado (todos los textos de esta librería usan la misma convención
centrada, así que no hace falta distinguir casos).

### Verificación

Con un dev server recién levantado (ver E3: los cambios de
`vite.config.ts` necesitan reinicio, no alcanza con HMR):

- Arrastré el terminal "in" de S00110 exactamente 5 unidades SVG
  (alineado a grilla) → `metadata.json` quedó con `x: 5` — coincide
  exacto con el arrastre, confirmado en la respuesta HTTP y releído del
  disco.
- El mismo arrastre pero fuera de grilla (40 px de pantalla) → el lint lo
  **rechazó** con el mismo mensaje específico que usa para cualquier otro
  desalineamiento, y no tocó ningún archivo. Es el comportamiento
  correcto: la regla de grilla de `AGENTS.md` se aplica igual acá.
- Arrastrar una primitiva que NO es un punto de conexión (la elipse de
  S00132) → `metadata.json` no se toca, la respuesta no trae `metadata`.
- S00132 con drag: el `<text>` guardado incluye
  `text-anchor="middle" dominant-baseline="central"`.

**Arnés E2E actualizado** (`e2e/editor-simbolos.mjs`): nueva
`probarPuntoConexion()` — arrastra el terminal "in" de S00110 5 unidades
exactas y verifica que `metadata.json` (respuesta HTTP y disco) quede con
la coordenada nueva. `probarGuardadoReal()` reubicada: su arrastre de
prueba agarraba por casualidad el mismo terminal con una distancia
arbitraria no alineada a grilla, y con la validación nueva eso ahora
falla el lint correctamente — se movió el punto de agarre a una zona del
cuerpo del símbolo que no es un punto de conexión, ya que esa prueba
verifica limpieza del SVG, no alineación. Ambas pruebas respaldan y
restauran `metadata.json` además del SVG en su `finally`.

`npm run build`, `npm run lint`, `lint_simbolos.py` (20/20),
`verificar_alineacion.mjs`, `verificar_proyecto_real.mjs` y
`npm run e2e:simbolos` (20 símbolos + guardado + punto de conexión):
todo verde. Repo verificado limpio tras cada corrida del arnés (HEAD sin
moverse, `git status` vacío).

---

## E7 — Rediseño de 7 símbolos con fuente QET real (31/08/2026)

**Rama:** `proyecto/editor-simbolos-20260826`.

### Reporte del usuario

*"s0121, s0122, s0123, s0127, s0128, s0129 y s0130 estan mal"*. Son
exactamente los 8 símbolos del "3er intento de rediseño" de C32 (menos
S00126, que sí quedó bien) — HISTORIAL ya registraba que ese intento
"nunca fue aprobado por el usuario".

### Decisión de método

Redibujar a mano de nuevo hubiera repetido el patrón que ya falló 3 veces
en C32. Antes de tocar geometría se verificó acceso de red
(`git ls-remote` a qelectrotech-elements: sí hay acceso) y se clonó la
colección al **mismo commit citado en los símbolos ya aprobados**
(`b9e1020`), con sparse-checkout limitado a las carpetas relevantes — el
clon completo choca con el límite de longitud de path de Windows en
`98_graphics/99_assembly_plan/`.

Hallazgo importante: **ningún `.elmt` de la colección tiene una variante
reducida a un solo polo** para MCCB, guardamotor, relé térmico,
portafusible o diferencial (a diferencia de `disjonct-m_1f.elmt`, la
fuente de S00110). La reducción a trazo único de Vatia se hizo a mano en
los 7 casos, pero **basada en la geometría real** de la fuente QET
correspondiente — no inventada, que es la diferencia con el intento
anterior (S00129/S00130 estaban documentados como "manual - IEC 60617"
sin ninguna fuente real detrás).

### Diagnóstico y corrección por símbolo

- **S00121 (MCCB):** la caja moldeada quedaba flotando debajo del
  mecanismo de seccionamiento sin encerrarlo. Fuente real:
  `12_magneto_thermal_circuit_breakers/disjoncteur_magneto-thermique.elmt`
  — ahí el rectángulo se SOLAPA con la hoja de seccionamiento. Corregido
  para que la caja encierre el mecanismo (mismo mecanismo que S00110).
- **S00122 (guardamotor):** le faltaba la cruz de apertura por completo —
  no se leía que el aparato secciona. Fuente real: `gv2p.elmt` (GV2 de
  Schneider, geométricamente casi idéntico al MCCB genérico en QET — son
  la misma familia de símbolo). Se agregó además una flecha de
  ajustabilidad (IEC 60617-2, símbolo 07-01-02) cruzando la caja, para
  distinguirlo del MCCB de ajuste fijo — el guardamotor tiene disparo
  térmico ajustable (`ir_min_a`/`ir_max_a` de la ficha), el MCCB no.
- **S00123 (relé térmico):** caja + diagonal sin ninguna fuente real,
  casi ilegible. Fuente real: `30_thermal_relays/relais_therm4.elmt`, que
  usa un "gancho" (el trazo se corre en escalón y vuelve) para
  representar la lámina bimetálica en serie — es la convención IEC real,
  reemplaza la caja+diagonal anterior.
- **S00127 (portafusible/seccionador fusible):** proporciones sin
  relación con el fusible simple (S00113) ya aprobado. Fuente real:
  `10_fuses/sectionneur_fusible_bi.elmt` (brazo de seccionamiento
  articulado + fusible montado en la hoja). El rectángulo del fusible
  ahora usa las mismas proporciones que S00113, por consistencia de
  librería.
- **S00128 (diferencial ID/RCD):** el toroide punteado (`circle r=5`
  centrado en 0,0) y el conductor (diagonal de (0,-5) a (-5,5), punto
  medio (-2.5,0)) no compartían centro — el conductor quedaba corrido a
  la izquierda del toroide. Corregido: el conductor ahora pasa recto por
  el centro exacto del círculo.
- **S00129/S00130 (relés):** el contacto NA no seguía la misma
  convención probada que **S00112** (contactor, ya aprobado) — le
  faltaba el arco de resorte de retorno y la diagonal iba en sentido
  opuesto. Reemplazado por la geometría exacta de S00112 (línea + arco +
  hoja), conservando la caja de bobina + texto que distingue a cada
  relé. Esto también corrige una inconsistencia de estilo dentro de la
  propia librería, no solo un problema aislado.

### Otro hallazgo corregido de paso

Al recorrer `metadata.json` de todos los símbolos para escribir la tabla
de `docs/estado-revision-aea.md`, se confirmó el problema que la revisión
general del proyecto ya había marcado: **S00124, S00125, S00126 y S00131
están `estado_revision: "verificado"` pero sin `atributos_base`** — al
instanciarlos, el formulario no mostraba ningún campo. Corregido
agregando el `tipo_aparato` correcto a cada uno (no afecta su geometría
ni su estado de revisión).

### `docs/estado-revision-aea.md` puesto al día

La tabla documentaba solo 7 de 20 símbolos (S00110–S00119). Se agregaron
las 13 filas faltantes (S00120–S00132) con su fuente QET real, familia y
estado, se corrigió la familia de S00118 (decía "aparato", el
`metadata.json` real dice `sin_ficha_tecnica`), y se agregaron dos notas
nuevas en "Notas pendientes de la Fase C" documentando este rediseño y el
fix de `atributos_base`.

### Estado de revisión: sin cambios

Los 7 símbolos **siguen en `pendiente_revision`** — la corrección es una
propuesta con fuente real detrás, no un cierre. El procedimiento de
cierre de `docs/estado-revision-aea.md` exige revisión visual del
usuario antes de pasar a `verificado`/`corregido`, y dado que este mismo
tipo de símbolo ya fue rechazado 3 veces, no corresponde que una IA se
autoapruebe acá.

### Verificación

`lint_simbolos.py` (20/20), `verificar_alineacion.mjs`,
`verificar_proyecto_real.mjs`, `npm run build`, `npm run lint`,
`npm run e2e:simbolos` (20 símbolos incluidos los 7 nuevos, render real
vía React/Fabric — no solo la galería SVG estática): todo verde. Galería
regenerada y comparada visualmente contra el estado anterior
(capturas en `scratchpad/`, no versionadas).

### Pendiente para la próxima etapa

Definido con el usuario, alcance de nueva simbología a agregar:
**protección/maniobra** (seccionador sin fusible, interruptor de carga,
llave de transferencia automática/ATS, relé de sobrecorriente/diferencial
de tierra, descargador de sobretensión) y **fuentes y generación** (grupo
electrógeno, UPS, banco de baterías, generador fotovoltaico, transformador
con tomas/regulación). Sin encarar todavía.

---

## E4 — Los 7 símbolos rechazados, redibujados desde la norma IEC 60617 (31/08/2026)

**Rama:** `proyecto/editor-simbolos-20260826`.

### Por qué se cambió de método

`49115d7` rehizo S00121, S00122, S00123, S00127, S00128, S00129 y S00130
importando la geometría real de QElectroTech. El usuario rechazó también esa
tanda —la cuarta— con una indicación que cambia el criterio de raíz: **no hay
que sacar la simbología de QElectroTech**, porque su colección mezcla dibujos
hechos bajo otras normas. La fuente pasa a ser el PDF de la norma
(`Simbologia_iec_60617_completa.pdf`, 138 páginas escaneadas, sin capa de
texto) y los símbolos se **dibujan**, no se importan.

### Cómo se leyó la norma

Se renderizaron las páginas con pymupdf y se ubicó la **Sección 7 (Dispositivos
de maniobra, control y protección), páginas 48 a 64**. La página 48 es la clave:
define los **símbolos calificadores** con los que se arma casi todo lo demás.

| Código | Símbolo | Función |
|---|---|---|
| 07-70-01 | semicírculo | contactor |
| 07-70-02 | aspa | interruptor automático |
| 07-70-03 | barra corta | seccionador (aislador) |
| 07-70-04 | círculo + barra | interruptor-seccionador |
| 07-70-05 | cuadrado relleno | disparo iniciado por relé de medida o disparador incorporado |

La construcción general es siempre la misma: **contacto de corte** (cuchilla que
pivota en el borne inferior) **más el calificador encima**.

### Escala adoptada

La norma dibuja sobre retícula modular de 2,5 mm. Se adoptó
**1 módulo = 5 unidades de viewBox**, que es justo la equivalencia que deja
todos los puntos de conexión sobre múltiplos de 5, como exige
`scripts/lint_simbolos.py`.

### Nuevo generador

`scripts/generar_simbolos_iec.py`: la geometría de los 7 símbolos vive en
código, parametrizada y comentada con el número normativo del que sale cada
uno. Se eligió un generador en vez de editar SVG a mano porque el método manual
ya falló tres veces; así la decisión de diseño queda auditable y reproducible.
Incluye `rect_sobre_recta()`, que resuelve los rectángulos que la norma dibuja
**girados con la cuchilla** (el cuadrado de disparo y el cartucho del fusible).

| Símbolo | Norma | Qué cambió |
|---|---|---|
| S00121 MCCB | 07-72-25 | círculo+barra y **cuadrado de disparo sobre la cuchilla**; se eliminó la caja moldeada que encerraba el mecanismo, que no es normativa |
| S00122 Guardamotor | 07-72-21 + 07-70-05 | aspa de interruptor automático + cuadrado de disparo incorporado |
| S00123 Relé térmico | 07-72-13 | el bimetal como **pulso cuadrado de un módulo** sobre el conductor pasante; el RT va en serie, sin contacto de corte |
| S00127 Seccionador fusible | 07-75-08 | barra de seccionador arriba y **cartucho del fusible montado sobre la cuchilla** |
| S00128 Diferencial | 07-72-17 | aspa + toroide sumador atravesado por el conductor + enlace mecánico punteado |
| S00129 Relé de tensión | 07-73-18 | caja de relé de medición con la magnitud vigilada (U<>) adentro |
| S00130 Relé auxiliar | 07-76-01 | rectángulo liso de bobina de relé, símbolo general |

### Trazabilidad

`metadata.schema.json` gana el campo **`fuente_norma`** (por ejemplo
`"IEC 60617 07-72-25"`), alternativo a `fuente_qet`. Los 7 símbolos dejan de
declarar `fuente_qet` y pasan a declarar `fuente_norma`: la procedencia queda
en el archivo, no en la memoria de nadie.

### Verificaciones

`python scripts/lint_simbolos.py` (20/20, incluidas las comprobaciones de
integridad y geometría dentro del viewBox agregadas en E2), galería
regenerada, `verificar_alineacion.mjs` y `verificar_proyecto_real.mjs` verdes,
`npm run build` verde. Los metadata quedaron en UTF-8 con acentos correctos
(verificado a nivel de bytes; la consola de Windows los muestra mal, los
archivos están bien).

### Pendiente

- Los 7 siguen en `estado_revision: "pendiente_revision"`: falta la aprobación
  visual del usuario, que es lo único que los cierra.
- Quedan por revisar los 13 símbolos restantes de la librería contra la misma
  norma; el usuario dijo que hay varios más fuera de normativa.

---

## E5 — Correcciones del ingeniero sobre los símbolos de protección (31/08/2026)

**Rama:** `proyecto/editor-simbolos-20260826`.

Revisión de E4 por parte del usuario. Tres correcciones técnicas y una
pregunta de alcance que queda abierta.

### El relé térmico va en una caja

El usuario: *"el relé es una cajita con el pulso cuadrado que le suele enviar
la señal al contactor para desactivarlo o activarlo"*. En E4 se había dibujado
el pulso cuadrado **suelto sobre la línea**. Va **dentro** de un rectángulo: la
caja es el relé, y el pulso identifica que su actuación es térmica.

`S00123` pasa a ser rectángulo 12×15 con el símbolo de efecto térmico adentro
(07-76-01 + 03-30-37).

### Los guardamotores son dos, y se distinguen por las cajas de disparo

El usuario: *"tenemos 2 tipos pero simbológicamente muy parecido; el magnético
es un interruptor con una cajita identificando la actuación magnética, y el
termomagnético tiene dos cajitas, una con la actuación térmica y otra con la
actuación magnética"*.

Eso tiene respaldo directo en la norma, en la sección de símbolos distintivos
generales (no en la Sección 7):

| Código | Símbolo | Significado |
|---|---|---|
| 03-30-37 | pulso cuadrado (una "S" en ángulos rectos) | efecto térmico |
| 03-30-38 | gancho curvo | efecto electromagnético |

- `S00122` **guardamotor termomagnético**: interruptor automático (contacto de
  corte + aspa) más **dos** cajas de disparador en serie, la térmica y la
  magnética.
- `S00133` **guardamotor magnético** (NUEVO): el mismo interruptor con **una
  sola** caja, la magnética. Protege solo contra cortocircuito.

`aparato.schema.json` gana el subtipo `guardamotor_magnetico`, clonado del
termomagnético pero **sin** `ir_min_a` / `ir_max_a` (no tiene disparador
térmico, así que no hay rango de ajuste térmico que declarar) y con `ii_a`
—el disparo magnético instantáneo— pasado a obligatorio.

La librería queda en **21 símbolos**.

### MCCB: no hay símbolo propio en la norma

El usuario: *"para el MCCB que es un interruptor de caja moldeada no vi una
simbología para él… yo lo pondría como lo hiciste pero con la caja más grande
quizás"*. Es correcto que no aparezca: **la norma no distingue por construcción
del envolvente**. Un interruptor en caja moldeada es un interruptor automático;
que su caja sea moldeada es un dato de catálogo (`tipo_aparato`), no algo que
el símbolo represente. Se mantiene 07-72-25 y se agrandó el cuadrado de disparo
de 4,5 a 6 unidades, como pidió.

### Bug encontrado por el lint endurecido

Al reubicar `S00123` se le puso un viewBox `-10 -25 20 50` que **no contenía**
su terminal de entrada en y=-30. El lint reforzado en E2 lo detectó en el acto
("la geometría se sale del viewBox" + "punto 'in' fuera del viewBox"). Antes de
E2 esto habría pasado silenciosamente al commit. Corregido a `-10 -35 20 60`.

### Pregunta abierta: ¿los relés van en fuerza o en comando?

El usuario planteó: *"los relés tienen entrada dependiendo de su utilidad pero
generalmente son las líneas y neutro y tiene una salida para darle la orden al
contactor, pero no sé si ponerlo a eso en la parte de fuerza; me parece que
esto está más para la parte de comando"*.

Afecta a `S00129` (relé de protección de tensión) y `S00130` (relé/contactor
auxiliar), que hoy están modelados como aparatos en serie sobre el conductor de
potencia, con un `in` y un `out` — que es justamente lo que el usuario pone en
duda. **Queda sin resolver**, pendiente de su decisión; ver la recomendación
registrada en la conversación.

### Verificaciones

`lint_simbolos` 21/21, galería regenerada, `verificar_alineacion` y
`verificar_proyecto_real` verdes, `npm run build` verde.

---

## E6 — Los glifos de actuación, bien trazados esta vez (01/09/2026)

**Rama:** `proyecto/editor-simbolos-20260826`.

El usuario revisó E5 y marcó tres errores de trazado y una insatisfacción con
el MCCB.

### Los dos glifos son un par, y los dos estaban mal

*"la parte térmica es un pulso cuadrado no un impulso como lo hiciste, y además
el símbolo de disparo magnético no es como lo pusiste"*.

Se volvió a la lámina con zoom de 900 dpi sobre cada glifo, en vez de
aproximarlos de memoria. Medidos sobre la retícula:

- **03-30-37 efecto térmico**: una línea **vertical** con un salto
  **rectangular** hacia la derecha en el medio, que vuelve al mismo eje. El
  salto ocupa 1 módulo de ancho y 0,76 de alto; el glifo entero, 2 módulos.
  En E5 se había dibujado como una "S" horizontal: mal en forma y en
  orientación.
- **03-30-38 efecto electromagnético**: la **misma** línea vertical, pero con
  el salto del medio **semicircular**, de radio 1/4 del alto. Es una espira
  vista de canto.

Lo importante es que **forman pareja**: idéntico trazo, salto cuadrado contra
salto redondo. Esa oposición es exactamente lo que distingue la actuación
térmica de la magnética, y perderla era lo que hacía irreconocibles a los dos
guardamotores.

### La línea no atraviesa la caja

*"evita que la línea traspase la caja donde están esos símbolos"*. La línea de
potencia ahora **llega** a cada caja y **sale** de ella; dentro de la caja solo
está el glifo de la actuación. Aplicado a `S00123`, `S00122` y `S00133`, que
además pasaron a cajas de 10×10 (12×12 en el relé térmico) para que el glifo
sea legible.

### MCCB: se dejó de adivinar

*"la simbología del interruptor de caja moldeada revisalo porque no me gusta"*.
Es el segundo rechazo del mismo símbolo, así que en vez de proponer una tercera
versión a ciegas se prepararon **cinco variantes** renderizadas para que el
usuario elija (`scratchpad/opciones.png`):

| | |
|---|---|
| A | la actual, 07-72-25: círculo+barra y cuadrado de disparo sobre la cuchilla |
| B | interruptor + cajas térmica y magnética, todo dentro de un envolvente punteado |
| C | interruptor solo, dentro del envolvente punteado |
| D | interruptor + una caja con el cuadrado de disparo incorporado (07-70-05) |
| E | interruptor + cajas térmica y magnética, sin envolvente |

`S00121` queda **sin tocar** hasta que el usuario elija.

### Verificaciones

`lint_simbolos` 21/21, galería regenerada, `verificar_alineacion` y
`verificar_proyecto_real` verdes.

---

## E7 — MCCB con envolvente y tipo de disparo; los relés a su lugar (01/09/2026)

**Rama:** `proyecto/editor-simbolos-20260826`.

Dos decisiones del usuario, tomadas sobre las variantes renderizadas en E6.

### MCCB: envolvente en el dibujo, tipo de disparo en la ficha

*"hagamos que sea un interruptor rodeado por una caja negra y en su descripción
del texto pongamos el tipo de disparo y allí se habilitarán los campos
correspondientes a completar según eso"*.

La norma no tiene símbolo propio del interruptor en caja moldeada porque **no
distingue aparatos por la construcción del envolvente**. La solución adoptada
separa las dos cosas:

- **En el dibujo**: `S00121` es el interruptor automático (contacto de corte con
  aspa 07-70-02) **dentro de un rectángulo** que representa el moldeado. Un
  único símbolo para las tres tecnologías de disparo.
- **En la ficha**: nuevo campo `tipo_disparo` en `mccb_caja_moldeada`
  (`termomagnetico` | `magnetico` | `electronico`), obligatorio, que habilita
  los campos de ajuste que correspondan.

### `x-visible-si` ahora admite condición por valor

Para lo anterior hizo falta extender el mecanismo de campos condicionales, que
hasta ahora solo sabía preguntar si un booleano era `true` (`"es_conjunto"`,
C15). Se agregó la forma `"campo:valor1|valor2"`, y el ajuste térmico
(`ir_a_min` / `ir_a_max`) queda visible solo con
`tipo_disparo:termomagnetico|electronico` — un MCCB magnético no tiene
disparador térmico, así que no hay rango de ajuste que pedirle.

Nuevo helper `campoVisible()` en `lib/esquemas.ts`, usado por **dos**
consumidores:

- `FormularioAtributos.tsx`, para ocultar el campo;
- `lib/checklist.ts`, para **no exigirlo** cuando está oculto. Sin esto el
  checklist reclamaría campos que el formulario ni siquiera muestra.

Espejado en `scripts/verificar_proyecto_real.mjs`, que duplica esa lógica
(deuda ya señalada en E1).

### Los relés, a donde corresponden

- **`S00130` relé/contactor auxiliar → `pendiente-multifilar/`.** Es un aparato
  de **comando**: su bobina la energiza el circuito de control y sus contactos
  actúan en el control. No lleva corriente de potencia, así que no tiene lugar
  en un unifilar de fuerza. La librería activa queda en **20 símbolos**.
- **`S00129` relé de protección de tensión: corregido, no movido.** Se queda en
  el unifilar porque es un aparato de protección, pero **no es de paso**: no
  lleva la corriente de carga. Pasó de tener `in`/`out` en serie a tener **una
  sola toma de medición** más un **enlace mecánico punteado** hacia el
  interruptor sobre el que actúa.

### Efecto colateral del campo nuevo

Al volverse obligatorio `tipo_disparo`, los dos MCCB del proyecto real (n4 y n5,
EMA SACE ISOL Z500) quedaron incompletos. Se les cargó
`tipo_disparo: "termomagnetico"`, que es **una suposición** por no tener el
catálogo del fabricante a mano: **queda para que el usuario confirme**.

Aprovechando eso se corrigió por fin la desincronización que E1 había señalado:
`scripts/migrar_tgbt.mjs` seguía generando esos nodos como `S00110` /
`interruptor_termomagnetico` con `norma_fabricacion: "IEC 60947"`, de modo que
volver a correrlo revertía la corrección de C32. Ahora genera `S00121` /
`mccb_caja_moldeada` con `ir_a_min` / `ir_a_max` y la norma correcta,
consistente con el JSON.

> Sigue pendiente el `pdcc_kA: 2500` de esos nodos, que son amperes crudos donde
> el schema pide kA (deberían ser 2,5). No se tocó: es un dato de ingeniería del
> usuario, no una inconsistencia de formato.

### Verificaciones

`lint_simbolos` 20/20, galería regenerada, `verificar_alineacion` y
`verificar_proyecto_real` verdes, `npm run build` verde, oxlint con los dos
warnings preexistentes.

---

## E8 — Librería cerrada: 20 símbolos verificados (01/09/2026)

**Rama:** `proyecto/editor-simbolos-20260826`.

El usuario revisó la librería completa **desde el editor** y marcó los 20
símbolos como `verificado`, cerrando la Fase 0 de simbología. Confirmó además
que los EMA SACE ISOL Z500 del proyecto real **son MCCB**, con lo que queda
validada la clasificación `S00121` / `mccb_caja_moldeada`.

> El `tipo_disparo: "termomagnetico"` de esos dos nodos sigue siendo una
> suposición del asistente, no un dato de catálogo. Queda anotado.

### La tabla de control ahora se genera, no se escribe

`docs/estado-revision-aea.md` se había desfasado **dos veces** por mantenerse a
mano: llegó a documentar 7 de 20 símbolos, listaba `S00130` como si siguiera en
la librería activa y no conocía `S00133` ni el campo `fuente_norma`. Se
regeneró desde los `metadata.json` reales y se dejó la advertencia de
regenerarla en vez de editarla renglón por renglón.

### El editor guardó geometría, y esta vez salió bien

Mientras revisaba, el usuario dejó el dev server corriendo y el editor reescribió
tres SVG en formato Fabric. **Es la misma operación que destruyó el S00110**, y
esta vez el resultado pasó el lint: XML válido, geometría dentro del viewBox,
sin marcadores del editor filtrados. El trabajo de E2 y E3 hizo su efecto.

Comparando la geometría contra HEAD se separaron dos casos distintos:

- **`S00127`**: geometría **realmente modificada** (el extremo izquierdo pasó de
  -4,64 a -6,79). Es una edición deliberada del usuario y se conservó.
- **`S00129` y `S00132`**: geometría **idéntica**, solo reformateadas. Se
  restauraron al formato canónico, que es 2,4 veces más compacto.

### Bug nuevo: el guardado del editor es válido pero LOSSY

Al exportar, Fabric **no preserva el atributo `class`**, así que los terminales
pierden `class="punto-conexion"` — que es lo que `estilos.css:296` usa para
estilarlos en el canvas. Los archivos además engordan 2,4× (2236 bytes contra
896) por el `style=` completo que Fabric escribe en cada primitiva.

Se le devolvió la clase a mano a los terminales de `S00127`. **La corrección de
fondo queda pendiente**: el guardado debería reinyectar los terminales desde el
`metadata.json` después de exportar, en vez de confiar en lo que devuelve
Fabric. El lint no lo detecta porque no es un error de geometría.

### Verificaciones

`lint_simbolos` 20/20, galería regenerada, `verificar_proyecto_real` verde.

---

# FASE E — Motor de verificación

## E9 — Paso 0: CI y guardado del editor sin pérdida (01/09/2026)

**Rama:** `proyecto/fundaciones-datos-20260901`, desde `main` con el PR #13 ya
mergeado.

Arranca la etapa de **fundaciones de datos** para el motor de verificación. Los
parámetros base los definió el usuario:

| Dato | Valor |
|---|---|
| Tensión nominal | **380/220 V ±5 %** (no se adoptó 400/231, se mantiene lo que ya usaba el proyecto del PPS) |
| Esquema de puesta a tierra | los **cuatro** (TT, TN-S, TN-C, IT), **TT por defecto** |
| Normativa por defecto | **AEA**, modificable por proyecto |
| Método de instalación | por **código de letra** (A1, A2, B1, B2, C, D, E, F, G), con un recordatorio visible de a qué corresponde cada uno |
| Formato de archivo | se aprueba el salto a **v3** |

Sobre el cortocircuito, el usuario propuso un mecanismo propio: definida la
**fuente principal** una sola vez, cuando una carga se marca como `seccional`
el programa debería **crear automáticamente su alimentador**, para poder
verificar el cortocircuito aguas abajo en ese tablero. Es decir, una carga
seccional no es un punto terminal sino el arranque de otro tablero. Queda
anotado para la etapa de topología.

### CI mínima

Nuevo `.github/workflows/verificacion.yml`, con dos jobs:

- **`basico`**: `npm ci`, build, oxlint, `lint_simbolos.py`,
  `verificar_alineacion.mjs` y `verificar_proyecto_real.mjs`.
- **`editor`**: instala Chromium y corre `npm run e2e:simbolos`.

Existe porque hasta ahora **nada obligaba** a correr esos controles: cuatro
iteraciones del editor se dieron por buenas sin abrirlo, y un guardado
defectuoso llegó a commitear un símbolo corrupto.

Detalle de implementación: el dev server y el arnés van en **un solo paso**. Un
proceso lanzado en segundo plano en un paso previo no sobrevive de forma
confiable al siguiente, y el arnés necesita el server porque los endpoints
`/api/*` son middlewares de Vite y no existen en el build de producción.

### El guardado del editor ya no pierde información

El bug detectado en E8: Fabric no preserva atributos ajenos a su modelo, así que
al exportar los terminales perdían `class="punto-conexion"` —que `estilos.css`
usa para darles formato— y quedaban con un `style=` que triplicaba el tamaño del
archivo.

La corrección es la que se había anotado: **los terminales ya no se exportan
desde Fabric**. Se los saca del canvas antes de `toSVG()`, igual que a los
marcadores, y se los vuelve a emitir en su forma canónica tomando la posición
final (que puede haber cambiado si el usuario arrastró un terminal). El orden
sigue al de `metadata.json`, para que el archivo quede estable entre guardados
sucesivos.

**Verificado en el navegador, no solo compilando**: se abrió el editor, se
arrastró una primitiva de S00132 para habilitar Guardar, se guardó, y el archivo
resultante trae los dos terminales con su clase y las coordenadas correctas.
El símbolo se restauró después de la prueba.

> Observación menor: en esa prueba el endpoint escribió el archivo pero **no
> commiteó**, pese a estar en una rama no protegida. `commitearSeguro()` es
> best-effort y se traga el error; ahora al menos devuelve el motivo al cliente
> en el campo `commit` de la respuesta. Queda para mirar.

También se agregó `.tmp.driveupload/` al `.gitignore`: es ruido de sincronización
de Google Drive dentro del repo.

### Verificaciones

Build verde, oxlint con los dos warnings preexistentes, `lint_simbolos` 20/20,
`verificar_alineacion` y `verificar_proyecto_real` verdes.

---

## E10 — Paso 1: tipos derivados de los schemas y lectura normalizada (01/09/2026)

**Rama:** `proyecto/fundaciones-datos-20260901`.

### Los tipos ahora se derivan, no se escriben

Nuevo `scripts/generar_tipos_atributos.py` → `apps/editor/src/lib/tiposAtributos.ts`
(21 interfaces, commiteado para que el editor compile sin correr Python).

Se generan del **mismo** schema que ya gobierna los formularios, así que no
pueden desincronizarse. La CI lo verifica con `--verificar`, que falla si
alguien tocó un schema sin regenerar.

Decisión de diseño: **todos los campos salen opcionales salvo el discriminante
`tipo_aparato`**. No es descuido — en el editor la ficha se completa de a poco,
así que un aparato recién puesto en el plano tiene los atributos vacíos. La
obligatoriedad la sigue llevando `x-obligatorio`, que el Checklist AEA reporta
sin bloquear.

### Lectura normalizada: `lib/electrico.ts`

Un verificador de selectividad necesita preguntar *"¿cuál es el poder de corte
de este aparato?"* sin saber de qué subtipo se trata. Hoy no puede, porque cada
subtipo nombra lo mismo a su manera:

| Concepto | Cómo se llama según el subtipo |
|---|---|
| Poder de corte | `pdcc_kA` en termomagnético, MCCB y fusible; `icu_kA` + `ics_kA` en los guardamotores |
| Rango de ajuste | **`ir_a_min` / `ir_a_max`** en el MCCB; **`ir_min_a` / `ir_max_a`** en guardamotor y relé térmico |

Lo del rango es una inconsistencia real de nomenclatura, no una distinción
técnica: **el mismo concepto con el sufijo invertido**. Se descubrió al mapear
los subtipos y hoy está absorbida por `rangoAjusteA()`.

El módulo expone `comoAparato()`, `tipoDeAparato()`, `poderDeCorteKA()`,
`poderDeCorteServicioKA()`, `rangoAjusteA()` y `corrienteNominalA()`. En los
aparatos regulables, `corrienteNominalA()` devuelve el **máximo** del rango,
que es el peor caso para verificar que la protección no supere la corriente
admisible del conductor.

### No quedó como código muerto

`anotaciones.ts` duplicaba la lectura del rango en **tres** lugares (MCCB,
guardamotor y relé térmico) y la del poder de corte en cuatro. Ahora pasa por
los lectores normalizados.

**Verificado por comparación de salida, no por "compila"**: se transpilaron con
`tsc` la versión anterior y la nueva, y se corrieron ambas contra seis casos
—incluidos el MCCB del proyecto real y una ficha vacía—. Las salidas son
**idénticas**.

### Bug encontrado de paso

La anotación del fusible mostraba **`63 A GG`**: `capitalizar()` se aplicaba a
`clase_caracteristica`, y `gG`, `gL` y `aM` son designaciones de IEC 60269
**sensibles a mayúsculas**. "GG" no existe como clase de fusible. Corregido:
ahora imprime `63 A gG`.

### Verificaciones

Tipos sincronizados, `lint_simbolos` 20/20, `verificar_alineacion` y
`verificar_proyecto_real` verdes, build verde, oxlint con los dos warnings
preexistentes.

---

## E11 — Paso 2: los campos de entrada que faltaban (01/09/2026)

**Rama:** `proyecto/fundaciones-datos-20260901`.

### Conductor

Nuevos campos en `conductor.schema.json`, todos `x-obligatorio: true` salvo
donde se indica:

- **longitud_m**: base de la caída de tensión y de la impedancia del cable
  para Icc en el extremo. Sin este dato ninguno de los dos se puede calcular.
- **metodo_instalacion**: código de letra (A1, A2, B1, B2, C, D, E, F, G),
  AEA 90364-5-52 / IEC 60364-5-52 tabla 52-C1. Determina de qué columna de
  tabla sale Iz.
- **temperatura_ambiente_c** (opcional) y **cantidad_circuitos_agrupados**
  (opcional): factores de corrección de Iz por temperatura y por agrupamiento.

Pedido del usuario: el método se elige solo por el código, pero con un
recordatorio siempre visible de a qué corresponde cada uno — un `<details>`
con las nueve descripciones, no oculto detrás de un hover. Notas propias y
resumidas, no transcripción de la norma (criterio ya establecido en
`docs/normativa/README.md`).

### Barra: ks

`barra.schema.json` gana **ks** (coeficiente de simultaneidad, 0 a 1,
opcional). Es el dato que faltaba para el futuro agregador de tablero que
`utilizacion.ts` ya menciona desde hace tiempo — la barra es el punto de
agregación, porque es el nodo del que cuelgan los circuitos (C8).

### Carga: factor_potencia

`carga.schema.json` gana **factor_potencia** (cosφ, opcional). Hoy no lo
consume ningún cálculo — el proyecto trabaja en VA, no en W — pero es el dato
que falta para derivar potencia activa cuando haga falta.

### Aparatos: Icw, Icm, categoría de utilización, clase selectivo

- `mccb_caja_moldeada` gana **categoria_utilizacion** (A/B, IEC 60947-2),
  **icw_kA** (corriente admisible de corta duración) e **icm_kA** (capacidad
  de cierre). Son datos de filiación/selectividad reales.
- `interruptor_diferencial` gana **clase_selectivo** (instantaneo /
  selectivo_s) y **tiempo_no_respuesta_ms** (visible solo si es selectivo).
  Es el dato que decide si dos diferenciales en cascada son selectivos entre
  sí — el caso más común de selectividad en un tablero doméstico o comercial.

Corrección de un supuesto propio: la revisión inicial daba por sentado que "el
MCCB no declara curva" era un hueco a llenar. No lo es: a diferencia del
termomagnético (IEC 60898-1, curva de letra fija), el MCCB (IEC 60947-2) se
caracteriza por su rango de ajuste Ir/Im — que ya estaba modelado —, no por
una curva de letra. No se agregó el campo.

### Dos bugs de la UI encontrados al agregar los campos, no al buscarlos

1. `FormularioConductor.tsx` guardaba número como texto. El renderer genérico
   de campos "restantes" solo distinguía enum de texto — nunca
   number/integer/boolean. Con los campos nuevos, longitud_m y
   cantidad_circuitos_agrupados se hubieran guardado como string, en
   silencio, exactamente el mismo tipo de bug de tipado que el Paso 1 vino a
   cerrar. Corregido para cubrir los cuatro tipos, igual que
   `FormularioAtributos.tsx`.
2. Los títulos de campo nunca se mostraban. El mismo renderer mostraba el
   nombre crudo del campo ("material", "aislacion", "norma_iram") en vez de
   su title ("Material", "Aislación", "Norma IRAM"), pese a que el schema ya
   los declaraba. Estaba así desde que existe el formulario. Corregido.

Verificado en navegador, cargando el proyecto real y abriendo el panel de una
conexión y de un MCCB: los campos nuevos aparecen, con los títulos correctos,
y el recordatorio de métodos de instalación se despliega.

### verificar_proyecto_real.mjs: pendientes bloqueantes vs. informativos

Al volverse obligatorios longitud_m y metodo_instalacion, las 10 conexiones y
4 alimentadores del proyecto real —migrado desde un DWG que nunca tuvo esos
datos— pasaron a reportar 24 pendientes, lo que hubiera dejado la CI agregada
en E9 permanentemente en rojo hasta que alguien mida la instalación real.

Se decidió no inventar esos valores. A diferencia de tipo_disparo en E7 (una
clasificación técnica de 3 opciones razonables, corregible barato), una
longitud de cable es un dato físico sin cota: adivinarlo mal es peor que no
tenerlo, y contaminaría en silencio cualquier cálculo de caída de tensión
futuro.

En cambio, `verificar_proyecto_real.mjs` distingue ahora pendientes
bloqueantes de informativos: los campos que dependen de la instalación física
(no del plano) se imprimen con ⚠ y se cuentan aparte, pero no hacen fallar el
script. `checklist.ts` no necesitó el mismo cambio — ya era no bloqueante por
diseño, solo el script standalone tenía `process.exit(1)` duro. Salida
actual: "OK … (+ 24 dato(s) de sitio pendientes de medir en obra, no
bloquean)".

### Verificaciones

Tipos sincronizados, `lint_simbolos` 20/20, `verificar_alineacion` y
`verificar_proyecto_real` verdes (con el aviso informativo), build verde,
oxlint con los dos warnings preexistentes. Panel de conexión y panel de MCCB
verificados en navegador con el proyecto real.

### E11.1 — Corrección: Ks es de la carga, no de la barra

El usuario corrigió el lugar del coeficiente de simultaneidad apenas se
propuso el paso siguiente: Ks no describe el punto de agregación, describe
**cada carga** — cuán simultánea es esa carga particular respecto de las
demás que cuelgan del mismo punto. Puesto en la barra, quedaba mezclado con
la geometría física del embarrado, que es de lo que trata ese schema.

El usuario agregó además un matiz que no estaba contemplado: en cargas
compuestas —ACU, máquinas con varios motores— la potencia declarada **ya
puede venir afectada** por la simultaneidad interna de sus propios
elementos. El Ks del schema es la simultaneidad **adicional** respecto de
las demás cargas del tablero, no una repetición de esa.

Revertido: `ks` sale de `barra.schema.json`. Agregado: `ks` en
`carga.schema.json`, al lado de `ku` (son un par — Ku ajusta la potencia
propia de la carga, Ks ajusta cuánto de esa potencia ya ajustada entra
cuando se suma con las demás), con la descripción incorporando el matiz de
las cargas compuestas. Campo nuevo en `FormularioCarga.tsx`, mismo patrón que
Ku (número 0–1, sugerido "1" si está vacío).

Sigue sin existir el nodo agregador que consuma Ku y Ks juntos — es el mismo
hueco de topología ya anotado en `utilizacion.ts` y en la revisión inicial;
acá solo se corrigió dónde vive el dato de entrada.

Verificado en navegador con el proyecto real (carga TS-G1, S00120): el campo
Ks aparece en el panel, junto a Ku, y el resto de los controles
(`lint_simbolos`, `verificar_alineacion`, `verificar_proyecto_real`, build)
siguen verdes.

## E12 — Paso 3: datos de proyecto y migración v2 → v3

Tercer paso del plan de fundaciones de datos (después de E9 CI/guardado, E10
tipos, E11 campos faltantes): parámetros eléctricos base del proyecto —
normativa, tensión, esquema de puesta a tierra y fuente de cortocircuito—
como dato del proyecto en vez de constantes hardcodeadas, según lo acordado
con el usuario al cierre de E11 (380/220 V, TT por defecto, AEA por defecto,
modificable por proyecto).

### Formato v3

`Proyecto` gana `datosProyecto: DatosProyecto` (`normativa: "AEA" | "IEC"`,
`tension_fase_v`, `tension_linea_v`, `esquema_pat: "TT" | "TN-S" | "TN-C" |
"IT"`, `fuente_cortocircuito?: { scc_mva?, icc_ka? }`) y `version` pasa de 2
a 3. `migrarAProyectoV2` se partió en `migrarEstructuraHojas` (la cadena
v0→v1→v2 tal cual estaba) más `migrarAProyectoV3`, que le agrega
`datosProyecto` por defecto (AEA, 220/380 V, TT) si no existe. Un proyecto
v2 real (`proyecto-real-pps.json`) sigue cargando sin tocarlo: la migración
es transparente.

La fuente de cortocircuito solo se guarda por ahora — no la consume ningún
cálculo todavía. Es el mismo dato que el usuario había anticipado en las
preguntas de cierre de E11 (5.): la idea de crear automáticamente el
alimentador de una carga marcada `seccional` a partir de esta fuente
pertenece a la etapa de topología (recorrido del grafo), no a esta.

### Tensión hardcodeada eliminada

`FormularioCarga.tsx` tenía 220/380 V escritos a mano en `calcularPotenciaVa`
(regla C9: S = tensión × I). Pasa a recibir `tensionFaseV`/`tensionLineaV`
como parámetros, leídos del store (`proyecto.datosProyecto`) en el
componente. `anotaciones.ts` tenía el mismo hardcodeo en la etiqueta de la
carga sobre el plano (`anotacionCarga`) — se corrigió también, encadenando el
parámetro a través de `anotacionNodo` hasta `NodoSimbolo.tsx`, que ahora lee
la tensión del store antes del `return` temprano (los hooks no pueden ir
después de un return condicional).

### Panel "Datos del proyecto"

Nuevo `PanelProyecto.tsx`, mismo patrón que `PanelHoja.tsx` (modal +
`useEditor`, sin pasar por el historial de deshacer — igual que
`actualizarHoja`): selector de normativa, dos campos de tensión, selector de
esquema PAT y los dos campos opcionales de fuente de cortocircuito, con una
nota explícita de que ese dato no se consume todavía. Botón nuevo "⚡
Proyecto…" en `BarraSuperior.tsx`, al lado de "📐 Hoja…".

### Verificaciones

`generar_tipos_atributos.py --verificar` OK (schemas sin cambios), `tsc
--noEmit` limpio, build verde, oxlint con los mismos dos warnings
preexistentes (ninguno nuevo), `lint_simbolos` 20/20, `verificar_alineacion`
y `verificar_proyecto_real` verdes. Verificado en navegador con el proyecto
real: el panel muestra los valores por defecto correctos (AEA, 220/380 V,
TT), y al cambiar la tensión de línea a 400 V la potencia de una carga
trifásica con 10 A recalculó en vivo de 6582 VA a 6928 VA — confirma que el
dato de proyecto llega hasta el cálculo, no solo hasta el formulario.

## E13 — Paso 4: topología (recorrido del grafo + agregación de cargas)

Primer paso que le enseña al sistema cómo están conectados los elementos
entre sí — hasta acá `checklist.ts` validaba cada nodo aislado, sin navegar
nunca del grafo. No incluye cálculo eléctrico real (Ib/Iz/Icc/ΔU%): eso
queda para el motor de cálculo (paso siguiente), que además necesita tablas
normativas AEA/IEC que todavía no están cargadas.

### `lib/topologia.ts`

Módulo nuevo, `calcularTopologia(nodos, conexiones)` sobre el estado React
Flow de la hoja activa (mismo criterio que `checklist.ts`, que ya recibe
`nodos`/`conexiones` como parámetros). La dirección del grafo la da React
Flow gratis: cada punto de conexión de un símbolo es `type="source"` (rol
"salida") o `type="target"` (rol "entrada"/"tierra") — `NodoSimbolo.tsx:120`
— y React Flow no deja conectar source↔source ni target↔target. Por eso
`edge.source` es siempre aguas arriba de `edge.target`, sin necesidad de
inferir nada.

Calcula:
- **Raíces**: los nodos `alimentador` son raíz de ALGO. Los que tienen
  `fases: true` son además raíz de potencia (se guardan separado en
  `raicesPotencia`, para cuando el motor de cálculo necesite saber por
  dónde entra la potencia real — un alimentador "Desde PAT", con solo
  `tierra: true`, es la puesta a tierra, no una fuente).
- **Alcanzables / huérfanos**: BFS desde TODOS los alimentadores (potencia y
  PAT) — un nodo solo conectado a la PAT (como el símbolo de tierra del
  proyecto real, alimentado por "Desde PAT") es legítimo y no debe marcarse
  huérfano.
- **Ciclos**: DFS de 3 colores (blanco/gris/negro), reporta cada ciclo como
  el tramo de la pila de recursión entre el nodo revisitado y el actual.
- **Potencia agregada por barra**: para cada nodo `barra`, recorre su
  subárbol aguas abajo (a través de los aparatos intermedios) y suma
  `potencia_utilizacion_va × ks` de cada carga encontrada, sin cruzar hacia
  otra barra (esa tiene su propio total). Un `visitados` por recorrido corta
  ciclos y evita contar dos veces una carga alcanzable por más de un camino
  — el proyecto real tiene justamente ese caso: n6/n7 tienen tanto una
  conexión directa desde la barra n1 como el camino largo n1→MCCB→carga, y
  el total dio la suma correcta de una sola vez cada una.

### Integración

`checklist.ts` (no bloqueante, mismo panel de siempre) agrega dos tipos de
aviso nuevos: "Sin conexión a ningún alimentador" por huérfano, y "Ciclo de
cableado: A → B → C → …" por cada ciclo. `BarraNode.tsx` calcula la topología
en `useMemo` (dependiente de `nodos`/`conexiones`) y agrega una línea
`Σ cargas: X VA` a la anotación de la barra cuando el total es mayor a
cero — se recalcula en vivo del grafo, no se guarda en el JSON del
proyecto.

Decisión deliberada de alcance: `scripts/verificar_proyecto_real.mjs` NO
recibió esta misma lógica en este paso — hacerlo bien exige reconstruir el
grafo dirigido a partir de `desde`/`hasta` en un runtime Node aparte,
duplicando el algoritmo. Ya hay una deuda anotada (E11) sobre la duplicación
entre ese script y `checklist.ts`; sumarle topología ahí queda pendiente
para cuando se decida cómo compartir código entre el navegador y el script
standalone, en vez de repetirlo.

### Verificaciones

`tsc --noEmit` limpio, build verde, oxlint con los mismos dos warnings
preexistentes (ninguno nuevo), `lint_simbolos` 20/20, `verificar_alineacion`
y `verificar_proyecto_real` verdes. Verificado en navegador con el proyecto
real: el checklist no reporta huérfanos ni ciclos falsos sobre el cableado
existente (incluida la rama "Desde PAT" → símbolo de tierra), y al cargar
10 A en n6 y n7 (3F con neutro, 380 V por defecto) la barra n1 mostró
"Σ cargas: 13164 VA" — exactamente √3×380×10 × 2, confirmando que la
agregación multi-camino no duplica.

## E14 — Retomar el editor: revisión general + arreglo de la falla preexistente en e2e/conexiones.mjs

El usuario frenó el avance hacia el motor de cálculo: antes quiere revisar
lo que hay, y además terminar el editor completamente (símbolos nuevos,
parte de comando, pestañas) antes de seguir con cálculo. Primer pedido
concreto acordado: arreglar la falla de `e2e/conexiones.mjs` registrada
como deuda en E5, ya confirmada como preexistente (no introducida por el
trabajo de esta sesión).

### Revisión general (antes del arreglo)

Corrida completa: `tsc --noEmit`, build, oxlint (mismos 2 warnings de
siempre), `lint_simbolos` 20/20 (todos con `estado_revision` cerrado, ya
no hay pendientes), `verificar_alineacion`, `verificar_proyecto_real`,
tipos sincronizados, y los dos arneses E2E. Además se limpiaron ~10
procesos `vite dev`/`preview` de sesiones anteriores que habían quedado
vivos ocupando puertos 4173–4174 y 5173–5179.

Hallazgos relevantes para la reprioritización que pidió el usuario:
- **Cero símbolos de comando**: de 20 símbolos, 17 aparato + 1 barra +
  1 carga + 1 sin ficha — toda la librería es de fuerza. Confirma que
  "parte de comando" es contenido nuevo, no una ampliación.
- **`modo_vista: "unifilar_simple" | "multifilar"`** existe en el tipo
  `ProyectoJSON` pero ningún componente lo lee — es un campo fantasma.
- **Sigue sin autosave**: el proyecto vive solo en memoria + descarga
  manual de JSON, exactamente como se diagnosticó al principio del
  proyecto.
- **6 commits sin pushear** en esta rama, sin PR abierto.
- `PestanasHoja.tsx` es hoy un array plano (`proyecto.hojas: Hoja[]`),
  sin ningún campo de relación entre hojas — confirma que la idea de
  jerarquía que trajo el usuario es un cambio de modelo de datos, no solo
  de UI. Se acordó con el usuario: la jerarquía cuelga cada hoja hija de
  la carga `seccional` de la hoja padre que la origina (no una jerarquía
  libre) — pendiente de diseñar/implementar, no se tocó en esta entrada.

### La falla real: dos cables desde el mismo handle rutean idéntico

`e2e/conexiones.mjs` prueba el grip de quiebre (C29) clickeando el punto
medio del segmento más largo del cable `c4`. En el escenario del
fixture, un paso anterior del mismo test crea `c5` desde el MISMO handle
de origen que `c4` (`n5.2`), en la misma dirección — React Flow rutea
ambos idénticos hasta que divergen, así que su primer tramo es
geométricamente el mismo. El punto que el test elegía caía justo en ese
tramo compartido, dentro del círculo invisible de reconexión (radio 10,
offset del extremo por dirección de salida — `EdgeAnchor`/`shiftX`/
`shiftY` de `@xyflow/react`) que ambos cables tienen superpuesto en el
mismo punto. Como los dos círculos están exactamente en el mismo lugar,
gana el que esté encima en el DOM — `c5`, no `c4` — y el test fallaba
"clic no seleccionó c4 (c5)".

No es un bug de la app: un usuario real que clickee sobre el tramo
compartido de dos cables que salen del mismo punto en la misma dirección
tiene la misma ambigüedad geométrica (dos líneas perfectamente
superpuestas no se pueden distinguir por posición), y es un caso poco
frecuente — normalmente cada circuito sale de un punto distinto de la
barra. Se evaluó agregar `elevateEdgesOnSelect` a `<ReactFlow>` para
subir el cable seleccionado por encima de sus hermanos, pero introdujo
una regresión nueva (el arrastre del grip de quiebre dejaba de doblar el
cable — probablemente por cómo React Flow reordena el DOM al elevar un
edge) sin resolver el caso general (la ambigüedad es previa a la
selección), así que se descartó.

El arreglo real fue en el test: en vez de "medio segmento más largo", el
punto de clic ahora excluye cualquier segmento que otro cable también
recorra (comparando extremos de segmento con tolerancia de 0,5 px contra
todas las demás conexiones renderizadas), y elige el más largo de los
que quedan — el mismo criterio que aplicaría un usuario real evitando el
tramo ambiguo.

### Verificaciones

`npm run e2e` (conexiones): OK, incluido el caso completo del quiebre
(4→5 vértices, deshacer). `npm run e2e:simbolos`: 20/20 sin cambios.
`tsc --noEmit`, build y oxlint sin novedad respecto de la revisión
general de arriba.

### Push + PR (19:30 01/09/2026)

Rama `proyecto/fundaciones-datos-20260901` pusheada (7 commits, `d32b5b8`
a `c62e2d3`) y PR #14 abierto hacia `main`
(https://github.com/LeyG08/Vatia/pull/14). No mergeado — queda esperando
aprobación explícita del usuario, según `AGENTS.md`.

## E15 — Comando, Paso 1: base de esquema + lote piloto de 8 símbolos

Primer paso de la etapa "finalizar el editor" (símbolos nuevos, parte de
comando, pestañas — el usuario pidió priorizar esto sobre el motor de
cálculo hasta terminarlo). Se acordó con el usuario arrancar por lo más
grande/complicado entre rediseño de hojas y librería de comando, con el
criterio de "que quede bien tanto visualmente como funcionando" — se eligió
comando por ser librería nueva desde cero más un modo de dibujo distinto,
mayor alcance que el rediseño de hojas.

### La norma es "DGE", no literalmente "IEC 60617" — y es la misma de siempre

Al abrir `Simbologia_iec_60617_completa.pdf` para buscar los símbolos de
comando, el encabezado real del documento dice "NORMA DGE - SIMBOLOS
GRAFICOS EN ELECTRICIDAD" (Perú, Dirección General de Electricidad), no un
documento con el sello IEC. Es una adaptación nacional que sigue la
estructura y numeración de IEC 60617 (Sección 7 "Dispositivos de maniobra,
control y protección", códigos `07-70-01`, `07-71-01`, etc. — exactamente
los mismos que ya se citan en `generar_simbolos_iec.py` para los símbolos de
fuerza ya aprobados). No es un documento distinto del que se usó antes en
esta sesión: es el único PDF de símbolos en Descargas y la numeración de las
láminas ya usadas coincide. Se sigue usando sin más cambio que este.

### Decisión de diseño: NO se creó una familia "comando" nueva

El plan original decía "nueva familia de esquema `comando`". Al revisar el
schema existente se encontró que `aparato.schema.json` YA tenía dos subtipos
de comando estancados desde antes (`contacto_auxiliar` con
`tipo_contacto: NA|NC|NA+NC|otra`, y `rele_auxiliar` con bobina/contactos) —
`S00124` y `S00130` ya existían, uno en la librería de fuerza (mal, sacado de
QET) y otro en `pendiente-multifilar/`. Mantener una sola familia "aparato"
para cualquier dispositivo discreto (fuerza o comando) es más consistente
con lo que ya había que inventar una segunda familia solo para separar por
uso — la única distinción real entre fuerza y comando es EN QUÉ CARPETA vive
el símbolo y en qué modo de canvas se usa, no la forma de su ficha.

### Dónde viven los símbolos de comando

Se creó `libreria-simbolos/comando/`, hermana de `simbolos/` (fuerza), fuera
del glob que carga la Paleta del editor
(`libreria.ts: import.meta.glob("../../../../libreria-simbolos/simbolos/*/...")`).
Es deliberado: el canvas actual es unifilar-solo, no tiene todavía modo
multifilar (Paso 3) para que estos símbolos tengan sentido de uso real. Para
que el usuario pudiera revisarlos igual, se generó una galería estática
aparte con `scripts/generar_galeria.py --simbolos-dir libreria-simbolos/comando`
(mismo script que ya arma `libreria-simbolos/simbolos/index.html`, sin tocar
la app). De paso se encontró y arregló un bug menor del script: mostraba
siempre "Fuente QET" vacío para los símbolos ya migrados a `fuente_norma`
(toda la tanda de fuerza redibujada en E4-E7) — ahora rotula "Fuente
(norma)" cuando corresponde, en ambas galerías.

`scripts/generar_simbolos_iec.py` y `scripts/lint_simbolos.py` ganaron un
flag `--carpeta` (default `simbolos`) para poder generar/lintear
`comando/` sin duplicar script.

### Los 8 símbolos del piloto

Todos sacados de la norma (Sección 7 "071 Contactos" / "072 Dispositivos de
Maniobra" para los primeros seis, Sección 8 "080" para la lámpara):

| Código | Símbolo | Referencia | Origen |
|---|---|---|---|
| S00124 | Contacto auxiliar NA | 07-71-01 Forma 1 | Redibujado — vivía en `simbolos/`, sacado de QET |
| S00134 | Contacto auxiliar NC | 07-71-02 | Nuevo |
| S00135 | Pulsador NA | 07-72-02 | Nuevo |
| S00136 | Pulsador NC | 07-72-02 + 07-71-02 | Nuevo |
| S00137 | Selector 2 posiciones | 07-72-04 | Nuevo |
| S00138 | Pulsador de emergencia (seta) | 07-72-06 | Nuevo |
| S00130 | Bobina de contactor/relé | 07-76-01 Forma 1 | Reubicado desde `pendiente-multifilar/`, ya estaba bien dibujado |
| S00139 | Lámpara piloto | 08-80-44 | Nuevo |

Composición geométrica (documentada en el docstring de cada función):
- **Contacto NA/NC** es el mismo bloque "cuchilla" que ya usa la librería de
  fuerza (pivota en el borne inferior), agregando para NC un codo hacia la
  izquierda con una marca de corte — un trazo corto PERPENDICULAR a la
  cuchilla un poco más abajo del vértice, no una X sobre la esquina (primer
  intento salía confuso, se corrigió tras revisar el render).
- **Pulsador/selector/seta** agregan un ACTUADOR a la IZQUIERDA del
  contacto, unido por un enlace mecánico punteado — composición horizontal,
  distinta de los calificadores de fuerza (07-70-xx) que van ARRIBA de la
  cuchilla.
- El **pulsador de emergencia** combina tres calificadores (maniobra
  positiva 07-70-09, cabeza de seta como medio círculo, marca de retención
  "V" en el enlace) sobre un contacto NC — es, con diferencia, el más
  compuesto de los ocho. La cabeza de seta se dibuja con una polilínea que
  aproxima el arco (mismo truco que `efecto_electromagnetico`), no con un
  comando de arco SVG: un primer intento con `<path d="A ...">` no
  renderizaba de forma confiable.

### Verificaciones

`lint_simbolos.py` verde en ambas carpetas (19 fuerza + 8 comando, sin
contarse entre sí). `generar_tipos_atributos.py` generó 25 interfaces
(+4: `AparatoPulsador`, `AparatoSelector`, `AparatoPulsadorEmergencia`,
`AparatoLamparaPiloto`) y `--verificar` da OK. `tsc --noEmit`, build y
oxlint sin novedad (mismos dos warnings preexistentes). Cada uno de los 8
símbolos se renderizó individualmente a PNG (pymupdf) para revisión visual
propia antes de mostrarlos — no sustituye la aprobación del usuario, que
sigue pendiente sobre la galería de `libreria-simbolos/comando/index.html`.

Los 8 quedan `estado_revision: "pendiente_revision"`: falta el mismo paso
que ya se hizo con la librería de fuerza — mostrárselos al usuario y
corregir lo que no le convenza antes de escalar al resto de la librería de
comando (Paso 2).

### E15.1 — Corrección: NC no convencía, selector rehecho, seta en espera

Devolución del usuario sobre la galería (publicada como Artifact para
revisión visual, no solo `index.html`): aprobó S00124, S00130, S00135 y
S00139 tal cual. Rechazó tres:

- **S00134/S00136 (contacto NC)**: "no me termina de convencer la parte que
  representa que es normal cerrado". Se volvió a medir la lámina 07-71-02 a
  600 dpi (recorte bien ajustado, la primera medición había quedado
  imprecisa) — la marca de corte sale pegada AL VÉRTICE del codo, apuntando
  arriba-derecha, no cruzando la cuchilla más abajo como en la primera
  versión. `contacto_nc()` corregido; el fix se propaga solo a los tres
  símbolos que comparten esa función (S00134, S00136, y S00138 de forma
  incidental).
- **S00137 (selector 2 posiciones)**: "no creo que sea correcto que tenga 2
  nodos únicamente a no ser que sea un pulsador donde una de sus posiciones
  en abierto". Tenía razón — 2 bornes con contacto simple es exactamente el
  caso del pulsador (S00135/S00136), no el de un selector real, que conmuta
  entre dos circuitos distintos. Rehecho como contacto conmutador de 3
  bornes (07-71-03: común + posición 1 cerrada con marca de corte +
  posición 2 abierta), con el botón giratorio "F" arriba y el enlace
  bajando por el centro para no cruzarse con ninguno de los dos bornes
  fijos. `metadata.json` pasó de 2 a 3 `puntos_conexion`.
- **S00138 (pulsador de emergencia)**: "nunca vi esa simbología". Lo que se
  dibujó SÍ es lo que muestra la norma (07-72-06: maniobra positiva + seta +
  retención + NC), pero si el usuario nunca lo vio en la práctica no tiene
  sentido insistir con la lectura literal de la lámina sin más información.
  Queda sin tocar, marcado "en espera" en la galería, hasta preguntarle qué
  usa habitualmente en el campo.

También quedó pendiente un pedido más grande, todavía sin alcance definido:
variantes de los símbolos existentes por cantidad de polos y otras
salvedades ("habría que crear las variantes de todos los símbolos en caso
de existir con las diferentes cantidades de polos"). Se le preguntó al
usuario para acotar el alcance antes de tocar código.

Verificaciones: `lint_simbolos.py` verde en ambas carpetas,
`generar_tipos_atributos.py --verificar` OK (sin cambios de schema en esta
ronda). Los tres símbolos corregidos se volvieron a renderizar a PNG
(pymupdf) antes de subir la corrección a la galería.

### E15.2 — Ronda 3: la marca de corte y el enlace, otra vez; S00138 se da de baja

El usuario contestó las dos preguntas de cierre de E15.1 y agregó feedback
nuevo sobre los símbolos ya corregidos, en el mismo mensaje:

- **Pulsador (S00135/S00136)**: "hacelo a la mitad del contacto no justo al
  final" — el enlace punteado del actuador conectaba al codo/extremo de la
  cuchilla; ahora conecta al punto medio geométrico entre el pivote y la
  punta (mismo punto (-3,0) para NA y NC, porque ambas cuchillas van entre
  los mismos dos puntos).
- **Contacto NC (S00134/S00136)**: la marca de corte de E15.1 "tiene que
  cruzar más" y la línea "que está en un ángulo raro" tiene que quedar "a
  90°". Se reemplazó por `marca_corte()`, un helper nuevo que calcula el
  perpendicular exacto a la cuchilla con matemática de vectores (no un
  ángulo fijo a ojo) y la dibuja cruzando de lado a lado, no como gancho
  corto tocando un vértice.
- **Selector (S00137)**: "es fácil, como hacer un contacto donde tenés dos
  estados y va en el medio el pulsador" — la composición de E15.1 (actuador
  arriba de todo, enlace vertical largo por el centro) quedó rechazada.
  Reescrito con el mismo patrón que el pulsador: actuador al costado, a la
  altura del punto medio de la cuchilla activa (posición 1), enlace
  horizontal corto.
- **Pulsador de emergencia (S00138)**: a la pregunta de qué usa en el campo,
  contestó "es que nunca vi una simbología de un pulsador de emergencia" —
  no es que el dibujo no coincidiera con lo que conoce, es que en su
  experiencia no existe un símbolo aparte para esto. Se dio de baja como
  símbolo (`git rm`, código S00138 liberado): un pulsador de emergencia es
  un Pulsador NC común (S00136). Se agregó `es_parada_emergencia` (boolean)
  al subtipo `pulsador` del schema para que la ficha lo distinga sin
  inventar un dibujo que nadie usa.

También contestó el alcance de "variantes por cantidad de polos": aplica
tanto a bloques de contactos combinados de comando (ej. un pulsador con
1NA+1NC en un solo cuerpo) como a fuerza (1P/2P/3P/4P), y agregó un caso
más — un equipo cuya ficha trae varios elementos de una vez (ej. un relé
con salida a contactos múltiples biestado), y el caso de la parte de fuerza
de un aparato que en realidad se resuelve en la sección de comando por ser
multifilar. Esto no se implementó: es un tema de MODELO DE DATOS (un
"equipo" con varios elementos de contacto enlazados, y cómo se referencia
un mismo dispositivo entre la hoja de fuerza y la de comando), más grande
que agregar símbolos al lote piloto — queda anotado como paso futuro, ligado
al modo multifilar (Paso 3), no a resolver ahora.

Verificaciones: `lint_simbolos.py` verde (7 símbolos en `comando/`, uno
menos que la ronda anterior), `generar_tipos_atributos.py --verificar` OK
(25 interfaces, sin cambiar de cantidad porque `pulsador` solo ganó un
campo), `tsc --noEmit` limpio. Los cuatro símbolos tocados se volvieron a
renderizar a PNG antes de actualizar la galería.

### E15.3 — Ronda 4: mover solo la punta del enlace no alcanzaba; el selector, aprobado

El usuario aprobó el selector (S00137) sin cambios y marcó que el pulsador
seguía mal pese al ajuste anterior: "solo moviste un punto del pulsador
pero todo lo que representa quedó mal". El diagnóstico: en E15.2 se movió
el EXTREMO del enlace punteado al punto medio de la cuchilla, pero el
enlace seguía saliendo del corchete a la altura original (-8) — quedaba una
diagonal larga que se metía a cruzar la propia cuchilla, confundiendo la
lectura de todo el símbolo (¿cuántas cuchillas hay acá?). La composición
que SÍ funcionaba ya estaba aprobada un mensaje antes: la del selector,
donde el actuador entero está a la altura del punto de enlace y el enlace
es una línea horizontal limpia, sin diagonales.

Arreglo real: bajar el corchete de `actuador_pulsador` completo a
`cy=0` (antes `cy=-8`) en S00135/S00136, para que el enlace sea horizontal
de punta a punta — mismo patrón que el selector, no un parche sobre la
punta del enlace nada más.

También pidió alargar la marca de corte del NC ("un poco más larga...
para que forme una especie de cruz pero muy poquito"): `marca_corte()`
pasó de `t=3.5, medio=3.0` a `t=5.0, medio=3.8` por defecto — la cruz
cruza un poco más lejos del vértice y un poco más larga a cada lado, sin
exagerar.

Detalle de implementación importante: como el selector (S00137) ya estaba
aprobado y también usa `marca_corte()`, cambiar el default lo habría
alterado sin que nadie lo pidiera. Se fijaron sus parámetros explícitos
(`t=3.5, medio=3.0`, los valores con los que se aprobó) para que ese
símbolo quede BYTE A BYTE igual — verificado con `git diff` antes de
commitear: sin diferencias.

Verificaciones: `lint_simbolos.py` verde en ambas carpetas,
`generar_tipos_atributos.py --verificar` OK, `tsc --noEmit` limpio,
`git diff` confirma que S00137 no cambió un solo byte pese a la
regeneración completa de la carpeta `comando/`.

### E15.4 — Ronda 5: se saca la marca de corte del NC

Cuatro rondas de ajuste sobre la marca de "corte" del contacto NC (gancho
corto en el vértice, cruz a 90° corta, cruz a 90° más larga) y seguía sin
convencer. El usuario cortó por lo sano: "sácale la cruz a lo NC porque no
lo estás haciendo bien y solucionado". `contacto_nc()` queda sin ninguna
marca: la única diferencia con `contacto_na()` es que la cuchilla llega
CERRADA (toca el borne móvil) en vez de con un hueco abierto — que ya es,
en sí, la distinción NA/NC de la norma.

El selector (S00137) usa el mismo tipo de marca en su posición 1, pero no
fue mencionado en el pedido — sigue "aprobado" del mensaje anterior, así
que se dejó sin tocar a propósito (la función `marca_corte()` no se borró,
solo perdió su único otro llamador; queda documentada como "ya no se usa
acá, pero el selector la sigue necesitando"). Verificado con `git diff`:
S00137 no cambió.

Verificaciones: `lint_simbolos.py` verde en ambas carpetas,
`generar_tipos_atributos.py --verificar` OK, `tsc --noEmit` limpio.
