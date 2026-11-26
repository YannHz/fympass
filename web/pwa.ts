import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { Plugin } from "vite";

export function prepararAplicacionInstalable(): Plugin {
  let salida = "";
  let carpeta = "";
  return {
    name: "fym-aplicacion-instalable",
    apply: "build",
    configResolved(configuracion) {
      carpeta = configuracion.root;
      salida = resolve(carpeta, configuracion.build.outDir);
    },
    closeBundle() {
      const archivos = readdirSync(salida, {
        recursive: true,
        withFileTypes: true,
      })
        .filter((entrada) => entrada.isFile())
        .map(
          (entrada) =>
            "/" +
            relative(
              salida,
              resolve(entrada.parentPath, entrada.name),
            ).replaceAll("\\", "/"),
        )
        .filter(
          (nombre) =>
            nombre.startsWith("/assets/") ||
            nombre.startsWith("/iconos/") ||
            nombre === "/sin-conexion.html" ||
            nombre === "/manifest.webmanifest",
        )
        .sort();
      const huella = createHash("sha256");
      for (const nombre of archivos)
        huella
          .update(nombre)
          .update(readFileSync(resolve(salida, "." + nombre)));
      const plantilla = readFileSync(
        resolve(carpeta, "service-worker.js"),
        "utf8",
      );
      const version = huella.update(plantilla).digest("hex").slice(0, 16);
      writeFileSync(
        resolve(salida, "service-worker.js"),
        plantilla
          .replace("__VERSION__", version)
          .replace("__ARCHIVOS__", JSON.stringify(archivos)),
      );
    },
  };
}
