# Estado de revisión AEA — librería de símbolos

Tabla de control de verificación manual contra la norma AEA (Asociación
Electrotécnica Argentina) e IEC 60617-11. El usuario ingeniero revisa cada
símbolo visualmente (galería: `libreria-simbolos/simbolos/index.html`) y marca
el estado. Un símbolo recién está "cerrado" cuando su estado es
`verificado_aea` o `corregido`.

Estados posibles (`estado_revision` en metadata.json):
`pendiente_revision` → `verificado_aea` | `corregido`

## Tabla de símbolos

| Código | Nombre | Fuente QET (.elmt) | Familia | Estado | Fecha revisión | Notas |
|--------|--------|--------------------|---------|--------|----------------|-------|
| S00110 | Interruptor termomagnético 1P (unifilar) | 10_electric/10_allpole/200_fuses_protective_gears/11_circuit_breakers/disjonct-m_1f.elmt @ b9e1020 | aparato | pendiente_revision | — | Piloto del pipeline · 7 primitivas · terminales IN.1 (entrada) / OUT.2 (salida) |
| S00111 | Interruptor termomagnético 3P+N (unifilar) | …/11_circuit_breakers/disjonct-m_3fn.elmt @ b9e1020 | aparato | pendiente_revision | — | 25 primitivas · 8 terminales IN/OUT |
| S00112 | Contactor de potencia (polo NA) | …/310_relays_contactors_contacts/02_contacts_cross_referencing/02_power_contacts/com_puiss1.elmt @ b9e1020 | aparato | pendiente_revision | — | Terminales sin nombre en origen → t1/t2 por orientación |
| S00113 | Fusible 1P (unifilar) | …/200_fuses_protective_gears/10_fuses/pojistka1p.elmt @ b9e1020 | aparato | pendiente_revision | — | Sin nombre es en origen → override |
| S00114 | Transformador dos bobinados (unifilar) | …/330_transformers_power_supplies/10_transformers/transformator_1f_2.elmt @ b9e1020 | aparato | pendiente_revision | — | 4 terminales (prim/sec) |
| S00115 | Motor trifásico | …/391_consumers_actuators/10_engines/moteur_tri.elmt @ b9e1020 | aparato | pendiente_revision | — | U1/V1/W1 + PE detectado como tierra ✓ |
| S00116 | Tomacorriente 2P+T (unifilar) | …/140_connectors_plugs/20_socket_outlets/pc_mono.elmt @ b9e1020 | aparato | pendiente_revision | — | Revisar roles: t1/t2 entrada arriba, t3 salida abajo |
| S00117 | Lámpara de filamento | …/391_consumers_actuators/60_lightings/lamp.elmt @ b9e1020 | aparato | pendiente_revision | — | ⚠ Ambas terminales abajo y rol salida — verificar contra fuente |
| S00118 | Toma a tierra (PE) | …/110_network_supplies/terre.elmt @ b9e1020 | aparato | pendiente_revision | — | Terminal PE rol tierra ✓ |
| S00119 | Barra (unifilar) | dibujo directo conforme IEC 60617 | barra | pendiente_revision | — | Fallback planificado: no existe .elmt unifilar de barra en QET |

> Los códigos siguen el patrón `S00xxx` (estilo base de datos IEC 60617).
> La asignación es interna de Vatia y queda registrada en `metadata.json`.

## Procedimiento de cierre

1. Abrir `index.html`, comparar cada símbolo con la lámina AEA / IEC 60617.
2. Corregir lo que corresponda (por ahora editando SVG a mano; en Fase E con
   el editor embebido Fabric.js).
3. Actualizar `estado_revision` en `metadata.json` y esta tabla.
4. Rama `simbolo/<codigo>-<fecha>` + commit con diff descriptivo (AGENTS.md).

---

## Licencia y atribución

Los símbolos derivan de la colección oficial
[qelectrotech/qelectrotech-elements](https://github.com/qelectrotech/qelectrotech-elements)
(ELEMENTS.LICENSE, GPL-2.0). Cada `metadata.json` conserva la trazabilidad en
el campo `fuente_qet`.
