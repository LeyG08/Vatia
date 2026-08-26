import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { execSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raizEditor = path.dirname(fileURLToPath(import.meta.url));
const raizRepo = path.resolve(raizEditor, "../..");
const libRoot = path.resolve(raizRepo, "libreria-simbolos", "simbolos");

/**
 * Plugin que extiende el watcher de Vite para cubrir libreria-simbolos/
 * (que queda fuera de la raíz del proyecto). Al detectar cambios en
 * .json o .svg, invalida el módulo libreria.ts para que su HMR
 * self-accept refresque SIMBOLOS sin full-reload.
 * También expone POST /api/metadata para guardar cambios de estado
 * directo al metadata.json + commit de git.
 */
function watchLibreria(): Plugin {
  return {
    name: "watch-libreria",
    configureServer(server) {
      const libPath = path.resolve(raizRepo, "libreria-simbolos");
      server.watcher.add(libPath);

      /* Ignorar cambios en .git/ para que commits no disparen HMR */
      server.watcher.unwatch("**/.git/**");

      let timer: ReturnType<typeof setTimeout> | undefined;
      let svgTimer: ReturnType<typeof setTimeout> | undefined;
      const onFileChange = (file: string) => {
        if (!file.includes("libreria-simbolos")) return;

        if (file.endsWith("metadata.json")) {
          clearTimeout(timer);
          timer = setTimeout(() => {
            try {
              const texto = fs.readFileSync(file, "utf8");
              const meta = JSON.parse(texto);
              if (meta?.codigo_iec) {
                server.ws.send({
                  type: "custom",
                  event: "metadata-update",
                  data: { codigo: meta.codigo_iec, metadata: meta },
                });
              }
            } catch { /* ignore parse errors during write */ }
          }, 150);
        }

        if (file.endsWith("simbolo.svg")) {
          clearTimeout(svgTimer);
          svgTimer = setTimeout(() => {
            try {
              const svg = fs.readFileSync(file, "utf8");
              const vbMatch = svg.match(/viewBox\s*=\s*"([^"]+)"/);
              const dirMatch = file.match(/simbolos[\\/]([A-Za-z0-9]+)_/);
              if (vbMatch && dirMatch) {
                const v = vbMatch[1].trim().split(/[\s,]+/).map(Number);
                if (v.length === 4) {
                  const viewBox = { minX: v[0], minY: v[1], ancho: v[2], alto: v[3] };
                  server.ws.send({
                    type: "custom",
                    event: "svg-update",
                    data: { codigo: dirMatch[1], svg, viewBox },
                  });
                }
              }
            } catch { /* ignore */ }
          }, 150);
        }
      };

      server.watcher.on("change", onFileChange);
      server.watcher.on("add", onFileChange);
      server.watcher.on("unlink", onFileChange);

      // ---- API endpoint: POST /api/metadata ----
      server.middlewares.use("/api/metadata", (req, res, _next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const { codigo, estado } = JSON.parse(body) as {
              codigo: string;
              estado: string;
            };

            if (!codigo || typeof codigo !== "string") {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "codigo requerido" }));
              return;
            }
            const ESTADOS = ["pendiente_revision", "verificado", "corregido"];
            if (!ESTADOS.includes(estado)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: `estado inválido: ${estado}` }));
              return;
            }

            const dirs = fs.readdirSync(libRoot);
            const dir = dirs.find((d) => {
              if (!d.startsWith(codigo + "_")) return false;
              return fs.existsSync(path.join(libRoot, d, "metadata.json"));
            });
            if (!dir) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Símbolo ${codigo} no encontrado` }));
              return;
            }

            const metaPath = path.join(libRoot, dir, "metadata.json");
            const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
            const anterior = meta.estado_revision;
            if (anterior === estado) {
              res.end(JSON.stringify({ ok: true, sin_cambio: true }));
              return;
            }

            meta.estado_revision = estado;
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");

            // Git commit (best-effort)
            try {
              execSync(`git add "${metaPath}"`, { cwd: raizRepo, stdio: "pipe" });
              execSync(
                `git commit -m "simbolos: ${codigo} estado ${anterior} → ${estado}"`,
                { cwd: raizRepo, stdio: "pipe" },
              );
            } catch {
              // git not available or nothing to commit — not fatal
            }

            res.end(JSON.stringify({ ok: true, anterior, nuevo: estado, metadata: meta }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });

      // ---- API endpoint: POST /api/geometry ----
      server.middlewares.use("/api/geometry", (req, res, _next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const { codigo, svg } = JSON.parse(body) as {
              codigo: string;
              svg: string;
            };

            if (!codigo || typeof codigo !== "string") {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "codigo requerido" }));
              return;
            }
            if (!svg || typeof svg !== "string") {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "svg requerido" }));
              return;
            }

            // Find symbol directory
            const dirs = fs.readdirSync(libRoot);
            const dir = dirs.find((d) => {
              if (!d.startsWith(codigo + "_")) return false;
              return fs.existsSync(path.join(libRoot, d, "simbolo.svg"));
            });
            if (!dir) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Símbolo ${codigo} no encontrado` }));
              return;
            }

            const svgPath = path.join(libRoot, dir, "simbolo.svg");
            const backupPath = svgPath + ".bak";

            // Backup original
            fs.copyFileSync(svgPath, backupPath);

            // Write edited SVG
            fs.writeFileSync(svgPath, svg, "utf8");

            // Run lint
            let lintOk = true;
            let lintErrores: string[] = [];
            try {
              const pythonCmd = process.platform === "win32" ? "python" : "python3";
              const stdout = execFileSync(
                pythonCmd,
                ["scripts/lint_simbolos.py", "--symbol", codigo],
                { cwd: raizRepo, encoding: "utf-8", timeout: 30_000 },
              );
              if (stdout.includes("FALLA:")) {
                lintOk = false;
                lintErrores = stdout
                  .split("\n")
                  .filter((l) => l.includes("\u2717"))
                  .map((l) => l.replace(/^\s*\u2717\s*/, ""));
              }
            } catch (err: any) {
              // execFileSync throws on non-zero exit
              if (err.stdout) {
                lintOk = false;
                lintErrores = err.stdout
                  .split("\n")
                  .filter((l: string) => l.includes("\u2717"))
                  .map((l: string) => l.replace(/^\s*\u2717\s*/, ""));
              }
            }

            if (!lintOk) {
              // Restore backup
              fs.copyFileSync(backupPath, svgPath);
              fs.unlinkSync(backupPath);
              res.end(JSON.stringify({ ok: false, errores: lintErrores }));
              return;
            }

            // Parse viewBox from saved SVG
            const vbMatch = svg.match(/viewBox\s*=\s*"([^"]+)"/);
            let viewBox = { minX: 0, minY: 0, ancho: 100, alto: 100 };
            if (vbMatch) {
              const v = vbMatch[1].trim().split(/[\s,]+/).map(Number);
              if (v.length === 4) {
                viewBox = { minX: v[0], minY: v[1], ancho: v[2], alto: v[3] };
              }
            }

            // Git commit
            try {
              execSync(`git add "${svgPath}"`, { cwd: raizRepo, stdio: "pipe" });
              execSync(
                `git commit -m "simbolos: ${codigo} geometria actualizada"`,
                { cwd: raizRepo, stdio: "pipe" },
              );
            } catch {
              // not fatal
            }

            // Cleanup backup
            try { fs.unlinkSync(backupPath); } catch { /* ok */ }

            res.end(JSON.stringify({ ok: true, svg, viewBox }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), watchLibreria()],
  resolve: {
    alias: {
      "@libreria": path.resolve(raizRepo, "libreria-simbolos"),
    },
  },
  server: {
    fs: {
      allow: [raizEditor, raizRepo],
    },
  },
});
