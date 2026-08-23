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
| F5 | Notas de gabinete fijas + ajustes finos del cajetín | PR abierto (#9), espera aprobación | 23/08/2026 (actual) |

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

**Verificación:** `npm run build` ✓ · `npm run lint` ✓ ·
`node scripts/verificar_alineacion.mjs` ✓ · `python scripts/lint_simbolos.py` ✓.

**Estado:** PR #9 abierto (`proyecto/notas-fijas-cajetin-v3-20260823`,
commits `f685a14`, `6f8d7d1`, `4cca487`, `d9babac`, `b3f3d4c`,
`0748941`, `16f3c9d` + 7ª vuelta) esperando aprobación del usuario.

---

## Registro de reversiones y cambios de rumbo

| Qué | Cuándo | Motivo | Efecto |
|-----|--------|--------|--------|
| Cajetín IRAM v1 (PR #4) → formato "planos reales" sin cajetín (PR #6) | 01:08 | decisión del usuario ante pregunta | reemplazo de RotuloConfig por EncabezadoConfig |
| Formato "sin cajetín" (PR #6) → rótulo IRAM 4508 CONFORME (PR #7) | 01:10–01:38 | corrección del usuario: el rótulo debe existir y cumplir la norma | se restaura RotuloConfig ampliado + geometría figura 1 |
| Política auto-merge de AGENTS.md (dc03f8e) → aprobación previa del usuario | F4 (actual) | pedido explícito del usuario | los PR quedan abiertos hasta orden expreso de merge |

---

## Estado al cierre de esta entrada

- `main` local = `00556bb` (PR #8 mergeado): AGENTS.md con política de
  aprobación previa + HISTORIAL.md activo.
- Pendiente: aprobar PR #9 (F5: notas fijas + ajustes del cajetín).
- Próximos pasos funcionales sugeridos: exportar PDF de la hoja,
  atributos de conductores en conexiones, más símbolos IEC.
