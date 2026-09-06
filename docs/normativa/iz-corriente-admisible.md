# Corriente admisible (Iz) — AEA 90364-5-52 / IEC 60364-5-52

## Qué exige la norma

El conductor de un circuito tiene que soportar, en régimen permanente, la
corriente de cálculo del circuito (Ib) sin superar la temperatura máxima de
su aislación. La norma no da una fórmula: da **tablas** de corriente
admisible (Iz) por sección, material, tipo de aislación y método de
instalación, más factores de corrección cuando la temperatura ambiente o el
agrupamiento con otros circuitos se apartan de las condiciones de
referencia de la tabla.

La verificación completa es: **Ib ≤ In ≤ Iz**, con Iz = Iz(tabla) ×
factor de temperatura × factor de agrupamiento (× factor de resistividad
térmica del terreno, si el método es D1/D2).

## Referencia exacta

AEA 90364-5-52, Edición 2006, Capítulo 52 "Canalizaciones, cables y
conductores", Anexo B — páginas 52-91 a 52-111. Cada tabla se declara
textualmente idéntica a su equivalente IEC 60364-5-52 (pie de página de
cada tabla: "Origen: Tabla B52-X IEC 60364-5-52"), así que la misma tabla
sirve para las dos normativas que soporta Vatia.

Fuente local usada: `D:\Drive\Normativas\AEA 90364\AEA-90364-5-2006.pdf`
(no se versiona acá — ver la política de este directorio en `README.md`).

Tablas cargadas hasta ahora:

| Tabla | Contenido |
|---|---|
| B52-1 | Resumen de métodos de referencia → qué columna de qué tabla usar |
| B52-2 | Iz, PVC, 2 conductores cargados (Cu y Al) |
| B52-3 | Iz, XLPE/EPR, 2 conductores cargados (Cu y Al) |
| B52-4 | Iz, PVC, 3 conductores cargados (Cu y Al) |
| B52-5 | Iz, XLPE/EPR, 3 conductores cargados (Cu y Al) |
| B52-10 | Iz, PVC/LSOH, métodos E/F/G, conductores de Cu |
| B52-11 | Iz, PVC/LSOH, métodos E/F/G, conductores de Al |
| B52-12 | Iz, XLPE/EPR, métodos E/F/G, conductores de Cu |
| B52-13 | Iz, XLPE/EPR, métodos E/F/G, conductores de Al |
| B52-14 | Corrección por temperatura ambiente (cables al aire, incluye E/F/G) |
| B52-15 | Corrección por temperatura del terreno (cables enterrados) |
| B52-16 | Corrección por resistividad térmica del terreno (D1/D2) |
| B52-17 | Corrección por agrupamiento (ítem 1: métodos A1-C, E y F, al aire) |

**Simplificación de diseño (métodos F y G):** la Tabla B52-1 distingue,
dentro de F, tres disposiciones físicas de cables unipolares (en contacto
2 cargados; en trébol/cuadrete 3 cargados; en contacto-en-plano 3
cargados) y, dentro de G, dos planos (horizontal/vertical) — el modelo de
Vatia solo separa 2 vs 3 conductores cargados, sin un campo para la
disposición. Se resolvió tomando, en cada caso de ambigüedad (3 cargados),
la disposición con el valor de Iz más bajo de las tabuladas —"trébol/
cuadrete" para F, "plano vertical" para G—, conservador por diseño: nunca
sobrestima. Con 2 conductores cargados, el método G directamente no tiene
valor tabulado en la norma (no es un dato faltante de Vatia: la Tabla B52-1
no lo define), así que `corrienteAdmisibleBaseA()` devuelve `null` en ese
caso. El método G tampoco lleva el factor de agrupamiento de B52-17 (la
tabla marca esa columna con "-" para G) — ver el comentario en
`calcularIzA()` (`apps/editor/src/lib/calculo.ts`). Detalle completo en el
comentario que precede a `TABLAS` en `tablaIzAea90364552.mjs`.

**Hallazgo, no una decisión de diseño:** la norma separa el método D
(enterrado) en **D1** (dentro de caño/conducto) y **D2** (directamente
enterrado, sin caño) — con valores de Iz distintos entre sí. El schema de
Vatia tenía un único código `"D"` genérico. Se corrigió el enum de
`metodo_instalacion` (`libreria-simbolos/schemas/conductor.schema.json`) a
`D1`/`D2`; no hacía falta migración porque ningún proyecto real tenía el
campo cargado todavía (`grep` contra `apps/editor/ejemplos/*.json`, cero
resultados).

## Dónde está implementado

- `libreria-simbolos/normativa/tablaIzAea90364552.mjs`: las tablas en sí
  (`corrienteAdmisibleBaseA()`) y los factores de corrección
  (`FACTOR_TEMPERATURA_AIRE`, `FACTOR_TEMPERATURA_ENTERRADO`,
  `FACTOR_RESISTIVIDAD_TERRENO`, `FACTOR_AGRUPAMIENTO_AIRE`). JS plano,
  mismo criterio que `libreria-simbolos/verificacion/reglasFicha.mjs`:
  lo importan tanto el editor (Vite/TS) como un futuro script Node sin
  transpilador.
- `apps/editor/src/lib/calculo.ts`: usa la tabla para comparar Ib/In
  contra Iz — ver ese archivo para el detalle de cómo se combina con Ib
  y ΔU% (etapa 4a del motor de cálculo, ya en producción).

## Qué queda sin cubrir todavía

- **Aislación mineral** (B52-6, B52-7, B52-8, B52-9) — poco frecuente,
  baja prioridad; consistente con no haberla cargado tampoco para los
  métodos A-D.
- **Tablas de agrupamiento adicionales** (B52-18 a B52-21): variantes
  para cables enterrados y para más de un cable multipolar por
  canalización — B52-17 ítem 1 ya cubre el caso general A1-C.

Se van a cargar en una próxima etapa, con el mismo criterio de
verificación visual contra el PDF (no solo texto/OCR) que se usó acá.
