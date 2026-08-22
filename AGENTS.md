# AGENTS.md

## Flujo de Git para este proyecto

- Antes de tocar cualquier símbolo o proyecto, crear una rama:
  - `simbolo/<codigo-iec>-<AAAAMMDD>` si se modifica un símbolo
  - `proyecto/<nombre>-<AAAAMMDD>` si se modifica un unifilar guardado
- Al terminar un cambio, generar el mensaje de commit comparando el JSON
  anterior contra el nuevo: listar qué campos cambiaron, no un mensaje genérico.
  Ejemplo: `fix(S00110): corrige punto de conexión "out" y agrega Ics_kA`
- Nunca hacer commit directo a main.
- Al finalizar la sesión, abrir un Pull Request hacia main con `gh pr create`,
  incluyendo en la descripción el diff de campos modificados.
- No mergear el PR. Eso lo hace el usuario manualmente.
