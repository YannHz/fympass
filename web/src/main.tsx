import { iniciarSonido } from "./sonidos";
import { iniciarTema } from "./SelectorTema";
import { iniciarInstalacionPwa } from "./instalacionPwa";
import { PuestoAsistencia } from "./PuestoAsistencia";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Aplicacion } from "./App";
import "./index.css";
import "./controles.css";
import "./AvisoActualizacion.css";
import "./Formularios.css";

iniciarTema();
iniciarSonido();
iniciarInstalacionPwa();

if (
  import.meta.env.PROD &&
  "serviceWorker" in navigator &&
  window.isSecureContext
) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .catch(() => {});
  });
  // aviso de version nueva: el usuario decide, no se recarga en medio de un guardado
  let preparada = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!navigator.serviceWorker.controller || preparada) return;
    preparada = true;
    const aviso = document.createElement("div");
    aviso.className = "aviso-actualizacion";
    aviso.setAttribute("role", "status");
    const texto = document.createElement("span");
    texto.textContent = "FyM Pass se actualizó.";
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = "Recargar ahora";
    boton.addEventListener("click", () => location.reload());
    aviso.replaceChildren(texto, boton);
    document.body.append(aviso);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname === "/puesto" ? (
      <PuestoAsistencia />
    ) : (
      <Aplicacion />
    )}
  </StrictMode>,
);
