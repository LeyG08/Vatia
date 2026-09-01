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

| Código | Nombre | Fuente QET (.elmt) | Familia | Estado | Fecha revisión | Notas |
|--------|--------|--------------------|---------|--------|----------------|-------|
| S00110 | Interruptor termomagnético (unifilar) | 10_electric/10_allpole/200_fuses_protective_gears/11_circuit_breakers/disjonct-m_1f.elmt @ b9e1020 | aparato | pendiente_revision | — | Símbolo único y genérico: la cantidad de polos se define por instancia en `cantidad_polos` de la ficha técnica · terminales IN.1 (entrada) / OUT.2 (salida) |
| S00112 | Contactor de potencia (bobina + polo NA) | …/02_power_contacts/com_puiss1.elmt @ b9e1020 + bobina dibujo directo IEC | aparato | pendiente_revision | — | A1/A2 no expuestos: la bobina pertenece a comando, fuera del unifilar de fuerza |
| S00113 | Fusible 1P (unifilar) | …/200_fuses_protective_gears/10_fuses/pojistka1p.elmt @ b9e1020 | aparato | pendiente_revision | — | Sin nombre es en origen → override |
| S00114 | Transformador dos bobinados (unifilar) | transformator_1f_2.elmt simplificado @ b9e1020 | aparato | pendiente_revision | — | Normalizado: un trazo por devanado, círculos superpuestos |
| S00115 | Motor trifásico (unifilar) | moteur_tri.elmt simplificado @ b9e1020 | aparato | pendiente_revision | — | Círculo M·3~, alimentación única · atributos_base: cantidad_fases=3 |
| S00118 | Toma a tierra (PE) | …/110_network_supplies/terre.elmt @ b9e1020 | sin_ficha_tecnica | pendiente_revision | — | Terminal PE rol tierra ✓ · familia corregida en esta entrada (decía "aparato", el metadata.json real dice `sin_ficha_tecnica`) |
| S00119 | Barra (unifilar) | dibujo directo conforme IEC 60617 | barra | pendiente_revision | — | Fallback planificado: no existe .elmt unifilar de barra en QET |
| S00120 | Carga de circuito (flecha) | autoría manual Vatia, sin fuente QET | carga | pendiente_revision | — | Flecha de destino IUG/TUG/ACU/seccional según planos PPS |
| S00121 | Interruptor automático en caja moldeada (MCCB) | …/11_circuit_breakers/disjonct-m_1f.elmt + rectángulo de …/12_magneto_thermal_circuit_breakers/disjoncteur_magneto-thermique.elmt @ b9e1020 | aparato | pendiente_revision | 31/08/2026 | **Corregido** (rediseño E7): la caja moldeada ahora ENCIERRA el mecanismo de seccionamiento, en vez de flotar aparte como en el 3er intento de C32. Esperando aprobación visual del usuario |
| S00122 | Guardamotor termomagnético | …/11_circuit_breakers/disjonct-m_1f.elmt + …/12_magneto_thermal_circuit_breakers/gv2p.elmt @ b9e1020 | aparato | pendiente_revision | 31/08/2026 | **Corregido** (rediseño E7): se agregó la cruz de apertura que faltaba y una flecha de ajustabilidad (IEC 60617-2, 07-01-02) para distinguirlo del MCCB de ajuste fijo. Esperando aprobación visual |
| S00123 | Relé térmico (RT) | …/30_thermal_relays/relais_therm4.elmt @ b9e1020 | aparato | pendiente_revision | 31/08/2026 | **Corregido** (rediseño E7): reemplaza la caja+diagonal sin fuente del 3er intento de C32 por el gancho bimetálico real de la fuente QET. Esperando aprobación visual |
| S00124 | Contacto auxiliar (NA/NC) | …/02_contacts_cross_referencing/01_auxiliary_contacts/con_simple.elmt @ b9e1020 | aparato | verificado | 25/08/2026 | `atributos_base.tipo_aparato` agregado en esta entrada (faltaba pese a estar "verificado": al instanciarlo no mostraba ningún campo del formulario) |
| S00125 | Transformador de corriente (TI) | manual - IEC 60617 | aparato | verificado | 25/08/2026 | Idem: `atributos_base.tipo_aparato` agregado en esta entrada |
| S00126 | Banco de capacitores | manual - IEC 60617 | aparato | verificado | 25/08/2026 | Idem: `atributos_base.tipo_aparato` agregado en esta entrada |
| S00127 | Seccionador fusible (portafusible) | …/10_fuses/sectionneur_fusible_bi.elmt @ b9e1020 | aparato | pendiente_revision | 31/08/2026 | **Corregido** (rediseño E7): brazo de seccionamiento articulado + fusible con las mismas proporciones que S00113, en vez del rectángulo sin relación de la versión anterior. Esperando aprobación visual |
| S00128 | Interruptor diferencial (ID/RCD) | …/50_residual_current_circuit_breaker/int_diff_1f-1.elmt @ b9e1020 (referencia de proporción) | aparato | pendiente_revision | 31/08/2026 | **Corregido** (rediseño E7): el conductor ahora pasa por el centro del toroide punteado; antes quedaba corrido. Esperando aprobación visual |
| S00129 | Relé de protección de tensión | manual - IEC 60617, geometría del contacto tomada de S00112 | aparato | pendiente_revision | 31/08/2026 | **Corregido** (rediseño E7): el contacto NA no seguía la misma convención probada que S00112 (le faltaba el arco de resorte). Esperando aprobación visual |
| S00130 | Relé/contactor auxiliar | manual - IEC 60617, geometría del contacto tomada de S00112 | aparato | pendiente_revision | 31/08/2026 | **Corregido** (rediseño E7): idem S00129 |
| S00131 | Sirena / alarma sonora | …/380_signaling_operating/12_acoustic_signaling/avertisseur.elmt @ b9e1020 | aparato | verificado | 25/08/2026 | `atributos_base.tipo_aparato` agregado en esta entrada |
| S00132 | Instrumento de medición (voltímetro) | …/390_sensors_instruments/70_meters_measuring_indicators/voltmetre-v.elmt @ b9e1020 | aparato | pendiente_revision | — | — |

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

1. **Icu/Ics del guardamotor futuro.** El subtipo
   `interruptor_termomagnetico` actual es IEC 60898-1: solo declara
   `pdcc_kA` (Icn). Cuando la fase de simbología ampliada agregue el
   subtipo `guardamotor_termomagnetico` (IEC 60947-2), ese schema
   necesitará campos propios `Icu_kA` e `Ics_kA`. Anotado también como
   `$comment` en `aparato.schema.json`. NO reutilizar el subtipo actual.

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

   Estos 7 símbolos **siguen en `pendiente_revision`**: la corrección es
   una propuesta con fuente real detrás, no un cierre — falta la
   aprobación visual del usuario, como corresponde al procedimiento de
   cierre de este documento.

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
