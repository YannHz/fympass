import { useEffect, useState } from "react";
import { Moon as Luna, Sun as Sol } from "lucide-react";

type Tema = "claro" | "oscuro" | "automatico";
const clave = "fym_tema";
const eventoTema = "fym-cambio-tema";

function leerTema(): Tema {
  try {
    const valor = localStorage.getItem(clave);
    return valor === "claro" || valor === "oscuro" ? valor : "automatico";
  } catch {
    return "automatico";
  }
}

function sistemaOscuro() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function aplicarTema() {
  document.documentElement.dataset.tema = leerTema();
  delete document.documentElement.dataset.transparencia;
}

export function iniciarTema() {
  aplicarTema();
  window.addEventListener("storage", (evento) => {
    if (evento.key === clave || evento.key === null) aplicarTema();
  });
}

export function SelectorTema() {
  const [tema, establecerTema] = useState<Tema>(leerTema);
  const [oscuroSistema, establecerOscuroSistema] = useState(sistemaOscuro);
  useEffect(() => {
    const sincronizar = () => {
      aplicarTema();
      establecerTema(leerTema());
    };
    const sincronizarLocal = () =>
      establecerTema(document.documentElement.dataset.tema as Tema);
    const preferencia = window.matchMedia?.("(prefers-color-scheme: dark)");
    const sincronizarSistema = () => establecerOscuroSistema(sistemaOscuro());
    window.addEventListener("storage", sincronizar);
    window.addEventListener(eventoTema, sincronizarLocal);
    preferencia?.addEventListener("change", sincronizarSistema);
    return () => {
      window.removeEventListener("storage", sincronizar);
      window.removeEventListener(eventoTema, sincronizarLocal);
      preferencia?.removeEventListener("change", sincronizarSistema);
    };
  }, []);

  const oscuro = tema === "oscuro" || (tema === "automatico" && oscuroSistema);
  const etiqueta = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  function alternarTema() {
    const elegido = oscuro ? "claro" : "oscuro";
    establecerTema(elegido);
    document.documentElement.dataset.tema = elegido;
    try {
      localStorage.setItem(clave, elegido);
    } catch {}
    window.dispatchEvent(new Event(eventoTema));
  }

  return (
    <button
      type="button"
      className="icono-boton selector-tema"
      onClick={alternarTema}
      aria-label={etiqueta}
      title={etiqueta}
    >
      <span
        key={oscuro ? "sol" : "luna"}
        className="simbolo-tema"
        aria-hidden="true"
      >
        {oscuro ? <Sol size={20} /> : <Luna size={20} />}
      </span>
    </button>
  );
}
