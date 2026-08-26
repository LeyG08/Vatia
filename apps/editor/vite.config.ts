import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
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
      const onFileChange = (file: string) => {
        if (
          file.includes("libreria-simbolos") &&
          file.endsWith("metadata.json")
        ) {
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
