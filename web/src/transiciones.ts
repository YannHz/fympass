import { flushSync } from "react-dom";

type Transicion = {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition: () => void;
};
type DocumentoConTransicion = Document & {
  startViewTransition?: (cambio: () => void) => Transicion;
};
let transicionActual: Transicion | undefined;

export function cambiarConTransicion(cambio: () => void) {
  const documento = document as DocumentoConTransicion;
  const reducirMovimiento = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (!documento.startViewTransition || reducirMovimiento) {
    transicionActual?.skipTransition();
    cambio();
    return;
  }
  transicionActual?.skipTransition();
  const transicion = documento.startViewTransition(() => flushSync(cambio));
  transicionActual = transicion;
  void transicion.ready.catch(() => {});
  void transicion.finished
    .catch(() => {})
    .then(() => {
      if (transicionActual === transicion) transicionActual = undefined;
    });
}
