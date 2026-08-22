import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raizEditor = path.dirname(fileURLToPath(import.meta.url));
const raizRepo = path.resolve(raizEditor, "../..");

export default defineConfig({
  plugins: [react()],
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
