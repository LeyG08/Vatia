# Normativa aplicable

Acá van **extractos y notas propias** sobre los criterios normativos que Vatia
implementa: qué exige la reglamentación AEA en cuanto a atributos por elemento,
qué establece IEC 60617-11 para cada símbolo, y cómo se traduce eso al modelo de
datos.

## Qué va y qué no

**Sí:** notas propias, tablas de valores que el programa usa, mapeo entre
artículo normativo e implementación, referencias con número de artículo o tabla.

**No:** copias completas de las normas. Son documentos con derechos de autor y
no corresponde versionarlas en el repositorio. Se referencian, no se reproducen.

## Formato de una nota

Cada archivo debería dejar claro:

1. Qué exige la norma, en tus palabras.
2. Referencia exacta (norma, versión, artículo o tabla).
3. Dónde está implementado eso en el código.
4. Qué queda sin cubrir todavía.

Ese punto 3 es el que evita que una regla normativa quede implementada en un
rincón del código sin que nadie sepa que está ahí.

## Pendiente

- Nota sobre exigencias AEA de atributos técnicos por elemento (base del modelo
  de dominio).
- Mapeo de símbolos IEC 60617-11 implementados vs. pendientes.
