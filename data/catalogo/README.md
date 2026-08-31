# Catálogo de dispositivos

> **Fase 2.** Esta carpeta está preparada pero todavía sin datos.

## Principio

El catálogo se versiona como **archivos planos en el repositorio**, un archivo
por fabricante. La base de datos se construye desde acá con un script de seed —
nunca al revés.

Razones:

1. El catálogo va a ser el trabajo más laborioso del proyecto. Si vive solo
   dentro de la base de datos, un dump corrupto o un cambio de motor cuesta
   meses de recarga.
2. Con los datos en git hay historial: se puede saber quién cambió qué parámetro
   de qué dispositivo y cuándo. En un proyecto donde esos parámetros alimentan
   verificaciones normativas, eso importa.
3. Un CSV se revisa en un pull request. Una fila de base de datos no.

## Estructura

```
data/catalogo/
├── <fabricante>/
│   ├── termomagneticas.csv
│   ├── diferenciales.csv
│   └── FUENTES.md
```

`FUENTES.md` registra de qué documento del fabricante salió cada tabla, con
versión y fecha. Sin fuente declarada, el dato no entra.

## Regla sobre datos

Los parámetros eléctricos deben provenir de documentación del fabricante.
Un valor que no se pudo verificar se carga con la columna `verificado` en
`false` y **no debe usarse en cálculos** hasta confirmarse.

Ningún agente de IA debe completar valores de catálogo por inferencia o
plausibilidad. Un poder de corte inventado es peor que un campo vacío.
