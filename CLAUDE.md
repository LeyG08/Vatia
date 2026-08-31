# CLAUDE.md

Las instrucciones de este proyecto viven en **[AGENTS.md](./AGENTS.md)**.
Leelo completo antes de empezar cualquier tarea.

Este archivo existe solo para que Claude Code encuentre el puntero. No dupliques
contenido acá: cualquier instrucción nueva va en `AGENTS.md`, para que siga
sirviendo si se cambia de herramienta de IA.

---

## Bitácora

La bitácora del proyecto es **`HISTORIAL.md`**, en la raíz. Es la única: no hay
devlog por sesión. La regla de cuándo y cómo actualizarla está en `AGENTS.md`.

---

## Activación de skills

Al inicio de cada sesión de trabajo orientada a tareas, cargá el skill
**task-observer** para que registre observaciones y correcciones durante la
sesión.

Al cerrar la sesión, verificá que `HISTORIAL.md` refleje lo hecho y evaluá si
alguna observación registrada merece convertirse en un skill propio.
