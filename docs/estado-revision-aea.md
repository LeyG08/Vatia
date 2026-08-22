# Estado de revisión AEA — librería de símbolos

Tabla de control de verificación manual contra la norma AEA (Asociación
Electrotécnica Argentina) e IEC 60617-11. El usuario ingeniero revisa cada
símbolo visualmente (galería: `libreria-simbolos/simbolos/index.html`) y marca
el estado. Un símbolo recién está "cerrado" cuando su estado es
`verificado_aea` o `corregido`.

Estados posibles (`estado_revision` en metadata.json):
`pendiente_revision` → `verificado_aea` | `corregido`

## Convención unifilar (regla general del lote)

Todo símbolo de esta librería representa el circuito con **trazo único**: la
geometría **no repite** polos ni fases. La multiplicidad se expresa por
anotación (ej. barras de polaridad + "3P+N" en S00111, "M 3~" en S00115) y por
los campos técnicos de la ficha (`cantidad_polos`, `cantidad_fases`), nunca
dibujando cada polo por separado. Los elementos multifilares quedan en
`pendiente-multifilar/` para una etapa posterior.

| Símbolo | Veredicto auditoría |
|---|---|
| S00110 · S00113 · S00118 · S00119 | ✓ conformes de origen |
| S00111 | redibujado (original con 4 polos repetidos → anotación 3P+N sobre geometría unipolar) |
| S00112 | rediseñado: bobina + polo NA en un solo símbolo, enlazados por línea mecánica punteada |
| S00114 | normalizado a un trazo por devanado |
| S00115 | redibujado como círculo M·3~ con alimentación de trazo único |

## Tabla de símbolos

| Código | Nombre | Fuente QET (.elmt) | Familia | Estado | Fecha revisión | Notas |
|--------|--------|--------------------|---------|--------|----------------|-------|
| S00110 | Interruptor termomagnético 1P (unifilar) | 10_electric/10_allpole/200_fuses_protective_gears/11_circuit_breakers/disjonct-m_1f.elmt @ b9e1020 | aparato | pendiente_revision | — | Piloto del pipeline · 7 primitivas · terminales IN.1 (entrada) / OUT.2 (salida) |
| S00111 | Interruptor termomagnético 3P+N (unifilar) | geometría de disjonct-m_1f.elmt + anotación 3P+N @ b9e1020 | aparato | pendiente_revision | — | Redibujado bajo convención unifilar · atributos_base: cantidad_polos=4 |
| S00112 | Contactor de potencia (bobina + polo NA) | …/02_power_contacts/com_puiss1.elmt @ b9e1020 + bobina dibujo directo IEC | aparato | pendiente_revision | — | A1/A2 no expuestos: la bobina pertenece a comando, fuera del unifilar de fuerza |
| S00113 | Fusible 1P (unifilar) | …/200_fuses_protective_gears/10_fuses/pojistka1p.elmt @ b9e1020 | aparato | pendiente_revision | — | Sin nombre es en origen → override |
| S00114 | Transformador dos bobinados (unifilar) | transformator_1f_2.elmt simplificado @ b9e1020 | aparato | pendiente_revision | — | Normalizado: un trazo por devanado |
| S00115 | Motor trifásico (unifilar) | moteur_tri.elmt simplificado @ b9e1020 | aparato | pendiente_revision | — | Círculo M·3~, alimentación única · atributos_base: cantidad_fases=3 |
| S00118 | Toma a tierra (PE) | …/110_network_supplies/terre.elmt @ b9e1020 | aparato | pendiente_revision | — | Terminal PE rol tierra ✓ |
| S00119 | Barra (unifilar) | dibujo directo conforme IEC 60617 | barra | pendiente_revision | — | Fallback planificado: no existe .elmt unifilar de barra en QET |

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

## Licencia y atribución

Los símbolos derivan de la colección oficial
[qelectrotech/qelectrotech-elements](https://github.com/qelectrotech/qelectrotech-elements)
(ELEMENTS.LICENSE, GPL-2.0). Cada `metadata.json` conserva la trazabilidad en
el campo `fuente_qet`.
