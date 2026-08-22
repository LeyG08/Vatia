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
| S00111 | Interruptor termomagnético 3P+N (unifilar) | (pendiente selección) | aparato | pendiente_revision | — | Lote tras aprobación piloto |
| S00112 | Contactor de potencia (unifilar) | 10_allpole/310_relays_contactors_contacts/* | aparato | pendiente_revision | — | — |
| S00113 | Fusible (unifilar) | 10_allpole/200_fuses_protective_gears/* | aparato | pendiente_revision | — | — |
| S00114 | Transformador 2 devanados (unifilar) | 10_allpole/330_transformers_power_supplies/* | aparato | pendiente_revision | — | — |
| S00115 | Motor trifásico | 10_allpole/391_consumers_actuators/* | aparato | pendiente_revision | — | — |
| S00116 | Tomacorriente | 10_allpole/500_home_installation/* | aparato | pendiente_revision | — | — |
| S00117 | Lámpara | 10_allpole/380_signaling_operating/* | aparato | pendiente_revision | — | — |
| S00118 | Toma a tierra | 10_allpole/98_graphics o equivalente | aparato | pendiente_revision | — | Si no hay .elmt adecuado se dibuja conforme IEC |
| S00119 | Barra | 10_allpole/120_cables_wiring o dibujo directo | barra | pendiente_revision | — | Idem anterior |

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
