import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { prepararAplicacionInstalable } from "./pwa";

export default defineConfig({
  build: {
    sourcemap: false,
    minify: "esbuild",
  },
  preview: {
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  plugins: [react(), tailwindcss(), prepararAplicacionInstalable()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": process.env.FYM_API_URL || "http://127.0.0.1:8000" },
  },
});
