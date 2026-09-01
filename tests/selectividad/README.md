# Casos de prueba — selectividad, filiación y dimensionamiento

> **Fase 3.** Estructura preparada, sin casos cargados todavía.

## Por qué esto existe ahora y no en Fase 3

Estos tests son la forma en que el conocimiento normativo del proyecto queda
**verificable y no degradable**. Documentación en prosa no impide que un
refactor rompa una regla de cálculo; un caso golden sí.

Es especialmente importante porque el desarrollo se hace con asistencia de IA y
puede cambiar de proveedor. Ninguna IA nueva va a "entender" la norma leyendo el
código, pero cualquiera va a saber que rompió algo si un caso falla.

## Formato de un caso

Cada caso es un par entrada/resultado esperado, con la referencia normativa que
lo justifica:

```
casos/
├── selectividad/
│   └── <aguas-arriba>_<aguas-abajo>.json
├── filiacion/
└── corriente-admisible/
```

Cada archivo declara, como mínimo:

- La configuración de entrada (dispositivos, conductores, condiciones).
- El resultado que la norma establece.
- **La referencia normativa concreta** (AEA o IEC, con número de tabla o
  artículo) que respalda ese resultado esperado.

Un caso sin referencia normativa no es un caso de prueba, es una opinión.

## Categorías previstas

- **Selectividad** — pares de protecciones aguas arriba / aguas abajo con el
  comportamiento esperado ante falta.
- **Filiación** — combinaciones respaldadas por el fabricante, incluyendo
  poder de corte reforzado.
- **Corriente admisible** — tabla de sección / material / aislante / método de
  instalación con el valor admisible esperado.
- **Caída de tensión** — casos de longitud y carga con el porcentaje resultante.

## Regla

Cuando el motor de Fase 3 dé un resultado distinto al de un caso, la presunción
es que **el motor está mal**, no el caso. Cambiar un valor esperado requiere
justificación normativa explícita y queda registrado en un ADR.
