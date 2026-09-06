# Estado de revisión AEA — librería de símbolos

Tabla de control de verificación manual contra la norma AEA (Asociación
Electrotécnica Argentina) e IEC 60617-11. El usuario ingeniero revisa cada
símbolo visualmente (galería: `libreria-simbolos/simbolos/index.html`) y marca
el estado. Un símbolo recién está "cerrado" cuando su estado es
`verificado` o `corregido`.

Estados posibles (`estado_revision` en metadata.json):
`pendiente_revision` → `verificado` | `corregido`

## Convención unifilar (regla general del lote)

Todo símbolo de esta librería representa el circuito con **trazo único**: la
geometría **no repite** polos ni fases, ni existen símbolos derivados por
cantidad de polos (el termomagnético es **un único símbolo**: la cantidad de
polos se define por instancia en `cantidad_polos` de la ficha técnica). La
multiplicidad se expresa por los campos técnicos (`cantidad_polos`,
`cantidad_fases`) o por anotación de instancia ("M 3~"), nunca dibujando cada
polo por separado. Los elementos multifilares quedan en `pendiente-multifilar/`
para una etapa posterior.

| Símbolo | Veredicto auditoría |
|---|---|
| S00110 · S00113 · S00118 · S00119 | ✓ conformes de origen |
| S00112 | rediseñado: bobina + polo NA en un solo símbolo, enlazados por línea mecánica punteada |
| S00114 | normalizado a un trazo por devanado, círculos superpuestos |
| S00115 | redibujado como círculo M·3~ con alimentación de trazo único |
| S00111 | eliminado: era una variante 3P+N del mismo aparato; la cantidad de polos vive en la ficha técnica |

## Tabla de símbolos

> Esta tabla se regenera desde los `metadata.json` reales. Se desfasó dos
> veces por mantenerse a mano (documentaba 7 de 20 símbolos): si volvés a
> tocar la librería, regenerala en vez de editarla renglón por renglón.

| Código | Nombre | Fuente | Familia | Estado | Fecha revisión | Notas |
|--------|--------|--------|---------|--------|----------------|-------|
| S00110 | Interruptor termomagnético | QET `disjonct-m_1f.elmt` | aparato | verificado | 01/09/2026 | Símbolo único y genérico: la cantidad de polos se define por instancia en `cantidad_polos`. |
| S00112 | Contactor de potencia | QET `A2 de la bobina no se exponen porque pertenecen al circuito de comando, fuera del unifilar de fuerza` | aparato | verificado | 01/09/2026 | A1/A2 no expuestos: la bobina pertenece a comando, fuera del unifilar de fuerza. |
| S00113 | Fusible 1P | QET `pojistka1p.elmt` | aparato | verificado | 01/09/2026 | Sin nombre `es` en origen → override. |
| S00114 | Transformador dos bobinados | QET `transformator_1f_2.elmt (simplificado a trazo único por devanado con círculos superpuestos conforme IEC 60617; la geometría original con dos conductores por devanado se descartó)` | aparato | verificado | 01/09/2026 | Normalizado: un trazo por devanado, círculos superpuestos. |
| S00115 | Motor trifásico | QET `PE separados se descartó por no cumplir la convención unifilar)` | aparato | verificado | 01/09/2026 | Círculo M·3~, alimentación única · `atributos_base: cantidad_fases=3`. |
| S00118 | Toma a tierra (PE) | QET `terre.elmt` | sin_ficha_tecnica | verificado | 01/09/2026 | Terminal PE con rol tierra. |
| S00119 | Barra | `dibujo directo conforme IEC 60617 (sin fuente .elmt en la colección unifilar de QET)` | barra | verificado | 01/09/2026 | Dibujo directo: no existe `.elmt` unifilar de barra en QET. |
| S00120 | Carga de circuito | `autoria manual Vatia · flecha de destino de circuito (IUG/TUG/ACU/seccional) según planos PPS` | carga | verificado | 01/09/2026 | Flecha de destino IUG/TUG/ACU/seccional según los planos del PPS. |
| S00121 | Interruptor automático en caja moldeada (MCCB) | `IEC 60617 07-72-21 en envolvente` | aparato | verificado | 01/09/2026 | Redibujado desde la norma (E7). No hay símbolo IEC propio del MCCB: la norma no distingue por envolvente. Se dibuja el interruptor automático dentro del rectángulo moldeado y el tipo de disparo se declara en la ficha (`tipo_disparo`). |
| S00122 | Guardamotor termomagnético | `IEC 60617 07-72-21 + 03-30-37 + 03-30-38` | aparato | verificado | 01/09/2026 | Redibujado desde la norma (E6). Interruptor + **dos** cajas de disparador: actuación térmica y magnética. |
| S00123 | Relé térmico (RT) | `IEC 60617 07-76-01 + 03-30-37` | aparato | verificado | 01/09/2026 | Redibujado desde la norma (E6). Caja de relé con el pulso cuadrado del efecto térmico adentro; la línea no atraviesa la caja. |
| S00125 | Transformador de corriente (TI) | `manual - IEC 60617` | aparato | verificado | 01/09/2026 | — |
| S00126 | Banco de capacitores | `manual - IEC 60617` | aparato | verificado | 01/09/2026 | — |
| S00127 | Seccionador fusible | `IEC 60617 07-75-08` | aparato | verificado | 01/09/2026 | Redibujado desde la norma (E4). Barra de seccionador arriba y cartucho del fusible montado sobre la cuchilla. |
| S00128 | Interruptor diferencial (ID/RCD) | `IEC 60617 07-72-17` | aparato | verificado | 01/09/2026 | Redibujado desde la norma (E4). Aspa + toroide sumador atravesado por el conductor + enlace mecánico punteado. |
| S00129 | Relé de protección de tensión | `IEC 60617 07-73-18` | aparato | verificado | 01/09/2026 | Redibujado desde la norma (E7). Es un relé de **medición**, no un aparato de paso: una sola toma de medición y enlace punteado al interruptor sobre el que actúa. |
| S00131 | Sirena / alarma sonora | QET `avertisseur.elmt` | aparato | verificado | 01/09/2026 | — |
| S00132 | Instrumento de medición (voltímetro) | QET `voltmetre-v.elmt (polo único)` | aparato | verificado | 01/09/2026 | — |
| S00133 | Guardamotor magnético | `IEC 60617 07-72-21 + 03-30-38` | aparato | verificado | 01/09/2026 | **Nuevo** (E6). Interruptor + **una** caja de disparador, la magnética: protege solo contra cortocircuito. |

> **S00124 se mudó a `libreria-simbolos/comando/`** (E15) — dejó de ser
> parte de esta tabla, que documenta solo la librería de fuerza
> (`simbolos/`). La librería de comando/control (36 símbolos, S00124 +
> S00130 + S00134–S00168, 28 verificados + 8 pendientes de revisión:
> S00161–168, guardamotores multipolares, E71) tiene su propia galería
> (`libreria-simbolos/comando/index.html`) y su historial de revisión en
> `HISTORIAL.md` E15–E15.6 (lote piloto), E16–E16.1 (segundo lote),
> E66–E66.1 (retardo a la desconexión), E67–E67.1 (sensores de
> proximidad), E68–E68.1 (termostato), E69–E69.1 (interruptor
> multipolar), E70–E70.2 (contactor multipolar, verificado de punta a
> punta) y E71 (guardamotores multipolares). No
> se duplica la tabla acá para no repetir
> el desfasaje que ya sufrió esta misma tabla dos veces por mantenerse a
> mano.

## Fuera de alcance — pendiente-multifilar/

Elementos de circuitos de comando/utilización, ajenos al unifilar de
fuerza/protecciones. Se conserva el trabajo convertido por si una etapa
posterior los retoma:

| Código | Nombre | Ubicación |
|---|---|---|
| S00116 | Tomacorriente 2P+T (unifilar) | libreria-simbolos/pendiente-multifilar/S00116_tomacorriente_2p_t_unifilar/ |
| S00117 | Lámpara de filamento | libreria-simbolos/pendiente-multifilar/S00117_lampara_de_filamento/ |

> Los códigos siguen el patrón `S00xxx` (estilo base de datos IEC 60617).
> La asignación es interna de Vatia y queda registrada en `metadata.json`.

## Procedimiento de cierre

1. Abrir `index.html`, comparar cada símbolo con la lámina AEA / IEC 60617.
2. Corregir lo que corresponda (por ahora editando SVG a mano; en Fase E con
   el editor embebido Fabric.js).
3. Actualizar `estado_revision` en `metadata.json` y esta tabla.
4. Rama `simbolo/<codigo>-<fecha>` + commit con diff descriptivo (AGENTS.md).

---

## Notas pendientes de la Fase C (formularios de atributos)

Registro de decisiones diferidas para que no se pierdan entre pasos:

1. ~~**Icu/Ics del guardamotor futuro.**~~ **RESUELTO**: el subtipo
   `guardamotor_termomagnetico` (IEC 60947-2) ya existe con `icu_kA` +
   `ics_kA` propios, separado de `interruptor_termomagnetico` (IEC 60898-1,
   `pdcc_kA`). E20 (02/09/2026) extendió el mismo criterio a
   `mccb_caja_moldeada`, que declaraba `pdcc_kA` pero no `ics_kA` — ahora
   tiene los dos, necesarios para verificar filiación entre protecciones.

2. ~~**Checklist AEA para conductores: validar por MAZO, no por rol.**~~
   **RESUELTO en C5:** `apps/editor/src/lib/checklist.ts` valida las
   conexiones por los atributos del mazo — cantidad/secciones,
   material/aislación/norma_iram, y coherencia llaves ↔ secciones
   (neutro/tierra apagados con sección cargada, secciones mayores que
   la de fase). Panel `ChecklistAea.tsx`, no bloqueante.

3. **Rediseño E7 (31/08/2026) — S00121, S00122, S00123, S00127, S00128,
   S00129, S00130.** El usuario marcó estos 7 símbolos como incorrectos:
   eran el 3er intento de rediseño de C32, que HISTORIAL.md ya registraba
   como "nunca aprobado por el usuario". Auditoría puntual:
   - S00121 (MCCB): la caja moldeada quedaba flotando debajo del
     mecanismo de seccionamiento, sin encerrarlo — no es la convención
     real (ver `disjoncteur_magneto-thermique.elmt` de QET, donde el
     rectángulo se solapa con la hoja).
   - S00122 (guardamotor): le faltaba la cruz de apertura por completo —
     no se leía que el aparato secciona el circuito.
   - S00123 (relé térmico): caja + diagonal sin fuente real, casi
     ilegible como indicación de elemento bimetálico.
   - S00127 (portafusible): proporciones sin relación con el fusible
     simple (S00113) ya aprobado.
   - S00128 (diferencial): el toroide punteado y el conductor no
     compartían centro — el conductor quedaba corrido hacia la izquierda.
   - S00129/S00130 (relés): el contacto NA no seguía la misma convención
     probada de S00112 (le faltaba el arco de resorte de retorno).

   Corrección: en vez de redibujar a mano de nuevo (el método que ya
   falló 3 veces en C32), se clonó la colección QET al mismo commit
   citado en los símbolos existentes (`b9e1020`) y se buscó la fuente
   real de cada dispositivo (`12_magneto_thermal_circuit_breakers/`,
   `30_thermal_relays/`, `10_fuses/sectionneur_fusible_bi.elmt`,
   `50_residual_current_circuit_breaker/`). Ningún `.elmt` de la
   colección tiene una variante reducida a un solo polo para estos
   dispositivos (a diferencia de `disjonct-m_1f.elmt`, usado para
   S00110) — la reducción a trazo único se hizo a mano, pero basada en
   la geometría y las proporciones reales del elemento, no
   inventada. El detalle de cada fuente queda en `fuente_qet` de cada
   `metadata.json` y en la tabla de arriba.

   **Actualización**: los 7 quedaron aprobados por el usuario y su
   `estado_revision` pasó a `verificado` (S00130, además, se mudó
   después a `libreria-simbolos/comando/` — ver la nota sobre S00124 más
   arriba).

4. **`atributos_base.tipo_aparato` faltante en 4 símbolos "verificados".**
   S00124, S00125, S00126 y S00131 tenían `estado_revision: "verificado"`
   pero **sin `atributos_base`** — al instanciarlos en un proyecto, el
   formulario no mostraba ningún campo (`problemasFicha()` solo pedía
   "elegí el tipo de aparato"). Corregido en la misma entrada E7,
   agregando el `tipo_aparato` correcto a cada uno; no afecta su
   geometría ni su estado de revisión.

---

## Exportación PDF (futura)

La exportación a PDF debe forzar **tema claro** sin importar cómo esté
configurada la interfaz en ese momento. El modo oscuro es solo para la
edición en pantalla (comodidad visual nocturna, como AutoCAD/KiCad); el
documento impreso/exportado es siempre fondo blanco con tinta negra.
Verificar que la función de exportación aplique `data-theme=""` (vacío)
antes de capturar y lo restaure al terminar.

---

## Licencia y atribución

Los símbolos derivan de la colección oficial
[qelectrotech/qelectrotech-elements](https://github.com/qelectrotech/qelectrotech-elements)
(ELEMENTS.LICENSE, GPL-2.0). Cada `metadata.json` conserva la trazabilidad en
el campo `fuente_qet`.
