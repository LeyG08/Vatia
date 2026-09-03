# Motor de cálculo — hoja de ruta

Plan de trabajo del motor de verificación eléctrica de Vatia: el objetivo
declarado del proyecto (ver `HISTORIAL.md`) de que Vatia no sea solo un CAD
de unifilares sino que también verifique el tablero que dibuja. Este
documento se actualiza a medida que avanzan las etapas — no es una bitácora
(esa es `HISTORIAL.md`, ahí queda el detalle de cada commit), es el mapa de
qué falta y en qué orden.

Parámetros ya decididos por el usuario (no volver a preguntarlos):
tensión 380/220 V ±5 %, los cuatro esquemas de puesta a tierra (TT por
defecto), normativa AEA por defecto e IEC seleccionable por proyecto,
método de instalación por código de letra (A1/A2/B1/B2/C/D/E/F/G).

## Etapas

### Hechas

- **0 — Estabilizar.** CI en cada push, símbolo S00110 regenerado, ramas
  fijadas en los endpoints de guardado. (`fundaciones-datos-20260901`,
  aún sin mergear — ver "Bloqueado" más abajo.)
- **1 — Tipos.** `tiposAtributos.ts` generado desde los schemas
  (`generar_tipos_atributos.py --verificar` en CI). `lib/electrico.ts`
  normaliza la lectura del poder de corte entre subtipos (`pdcc_kA` /
  `icu_kA` se leen con una sola función, `poderDeCorteKA()`) y del rango
  de ajuste (`ir_a_min/max` vs `ir_min/max_a`).
- **2 — Datos de entrada.** Agregados al schema de conductor:
  `longitud_m`, `metodo_instalacion`, `temperatura_ambiente_c`,
  `cantidad_circuitos_agrupados`. Datos de proyecto (`datosProyecto`,
  formato v3): normativa, tensión, esquema PAT, fuente de cortocircuito
  (`scc_mva`/`icc_ka`, todavía sin consumir). `Ks` vive en la carga (no en
  la barra — corrección explícita del usuario: es una propiedad de cada
  carga respecto de las demás, no del punto de agregación).
- **3 — Topología.** `lib/topologia.ts`: recorrido del grafo desde los
  alimentadores, detección de ciclos y de tramos huérfanos, potencia
  agregada por barra (`potenciaBarraVa`, con Ku/Ks aplicados).
- **4a — Ib y ΔU% (informativo).** `lib/calculo.ts` + extensión de
  `topologia.ts` (`potenciaConexionVa`, `esTrifasica`): corriente de
  cálculo y caída de tensión estimada por cable, mostradas en la ficha de
  la conexión. Modelo resistivo puro (sin reactancia); no compara contra
  ninguna tabla todavía. Detalle en `HISTORIAL.md` E26.

### Siguiente (necesita una decisión del usuario antes de empezar)

- **4b — Verificación Ib ≤ In ≤ Iz.** Requiere la tabla real de corriente
  admisible AEA 90364-5-52 / IEC 60364-5-52 por sección × método de
  instalación × aislación, con sus factores de corrección por temperatura
  y agrupamiento. Es un dato normativo con derechos de autor y sensible a
  errores de transcripción: **no conviene que se cargue de memoria del
  modelo sin que el usuario (electricista) lo valide antes de que el
  sistema lo use para decir "este cable está bien"**. Dos caminos
  posibles, a elegir:
  1. El usuario provee o confirma los valores de tabla (aunque sea un
     subconjunto: los métodos/secciones que realmente usa en sus
     proyectos), como dato versionado en el repo (ver el criterio ya
     escrito en `docs/normativa/README.md` sobre no versionar el texto
     completo de la norma, solo los valores numéricos derivados).
  2. Se arma con una fuente pública citable y el usuario la revisa antes
     de darla por buena.
  En cualquier caso, la tabla se carga como **dato parametrizado por
  normativa** (no una constante en el código — ya es la decisión de
  diseño registrada), para que AEA e IEC convivan.
- **4c — Icc en el extremo del tramo (IEC 60909).** Necesita: impedancia
  de la fuente (`fuente_cortocircuito` ya existe en `datosProyecto`, sin
  consumir), impedancia del transformador (`sn_kva` + `impedancia_pct` ya
  se cargan pero solo se imprimen como texto en `anotaciones.ts`) e
  impedancia del cable (derivable de `longitud_m` + `seccion_fase_mm2` +
  `material`, mismo dato que ya usa 4a). Con eso: comparar contra
  `poderDeCorteKA()` de la protección aguas arriba (ya normalizado en la
  etapa 1) — esto es lo más cerca que se puede llegar de "verificar el
  poder de corte" sin entrar todavía en selectividad/filiación real.
- **4d — Protección contra contactos indirectos.** Depende del esquema
  PAT (ya en `datosProyecto`): en TT es un chequeo de tiempo de disparo
  del diferencial × resistencia de puesta a tierra; en TN es un chequeo
  de Icc de defecto contra el tiempo de disparo de la protección. Los
  campos de diferencial (`clase_selectivo`, `tiempo_no_respuesta_ms`) ya
  están en el schema desde la etapa 2.

### Más adelante (bloqueado por datos que no son de cálculo)

- **5 — Filiación y selectividad.** No se calculan desde In/Icu/curva:
  son resultados de ensayo de laboratorio, propietarios de cada
  fabricante (pares aguas-arriba/aguas-abajo → Icc reforzada; límites de
  selectividad por par; curvas t-I digitalizadas, no solo la letra de
  curva). Antes de encarar esto hace falta resolver de dónde salen esos
  datos y la cuestión de licencia — ver punto 6.
- **6 — Base de datos de catálogo.** Un registro de catálogo es,
  esencialmente, una instancia precargada de los mismos schemas de
  `libreria-simbolos/schemas/` (el propio `metadata.schema.json` ya
  describe `atributos_base` como "puente hasta que exista la DB de
  catálogo"). Falta decidir dónde vive, de dónde salen los datos de marca
  real (Schneider, Siemens, ABB, EMA…) y cómo se resuelve la licencia de
  las tablas de filiación del punto 5.

## Bloqueado, no es un problema de diseño

`proyecto/comando-piloto-20260901` (rama activa) nace de
`proyecto/fundaciones-datos-20260901`, cuyo PR #14 sigue abierto. Mientras
no se mergee el #14, un PR nuevo desde esta rama mostraría el diff de los
dos juntos. PR #14 está verde en CI (una corrida de
"E2E del editor de símbolos" dio timeout una vez — reintentada, verde; es
un flake de infraestructura, no una falla real) y sin conflictos contra
`main`. Falta la aprobación explícita del usuario para mergearlo
(`AGENTS.md`: nunca se mergea sola cuenta propia).
