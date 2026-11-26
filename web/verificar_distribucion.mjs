import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const carpeta = fileURLToPath(new URL("./dist/", import.meta.url));
const permitidas =
  /\.(?:html|js|css|svg|png|webp|ico|webmanifest|woff2?|txt)$/i;
async function comprobar(directorio) {
  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (
      entrada.name.startsWith(".") ||
      (!entrada.isDirectory() && !permitidas.test(entrada.name))
    ) {
      throw new Error(`Archivo no publicable: ${relative(carpeta, ruta)}`);
    }
    if (entrada.isDirectory()) await comprobar(ruta);
    else if (/\.(?:js|css)$/i.test(entrada.name)) {
      const contenido = await readFile(ruta, "utf8");
      if (/sourceMappingURL\s*=/.test(contenido))
        throw new Error(`Mapa de código fuente: ${relative(carpeta, ruta)}`);
    }
  }
}
await comprobar(carpeta);
console.log(
  "Distribución verificada: sin mapas de código fuente ni archivos de tipos privados.",
);
