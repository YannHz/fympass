import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

export function usarPanelFlotante(
  abierto: boolean,
  boton: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
  cerrar: () => void,
  {
    ancho,
    minimo = 200,
    altoMaximo = 320,
    permitirSolapar = false,
  }: {
    ancho?: number;
    minimo?: number;
    altoMaximo?: number;
    permitirSolapar?: boolean;
  } = {},
) {
  const cierre = useRef(cerrar);
  cierre.current = cerrar;
  const [posicion, establecerPosicion] = useState<CSSProperties>({
    visibility: "hidden",
  });
  useLayoutEffect(() => {
    if (!abierto || !boton.current || !panel.current) return;
    const control = boton.current,
      elemento = panel.current;
    const dialogo = control.closest("dialog");
    const flotante = typeof elemento.showPopover === "function";
    if (flotante && !elemento.matches(":popover-open")) elemento.showPopover();
    function colocar() {
      if (!elemento.isConnected) return;
      const limite = control.getBoundingClientRect();
      const marco =
        !flotante && dialogo
          ? dialogo.getBoundingClientRect()
          : {
              left: 0,
              top: 0,
              right: window.innerWidth,
              bottom: window.innerHeight,
            };
      const anchoPanel = Math.min(
        ancho || Math.max(minimo, limite.width),
        marco.right - marco.left - 24,
      );
      const debajo = marco.bottom - limite.bottom - 20,
        encima = limite.top - marco.top - 20;
      const altura = Math.min(elemento.scrollHeight || altoMaximo, altoMaximo);
      const arriba = debajo < altura && encima > debajo;
      const maximo = Math.max(
        44,
        Math.min(
          altoMaximo,
          permitirSolapar
            ? marco.bottom - marco.top - 24
            : arriba
              ? encima
              : debajo,
          marco.bottom - marco.top - 24,
        ),
      );
      const izquierda = Math.max(
        marco.left + 12,
        Math.min(limite.left, marco.right - anchoPanel - 12),
      );
      const altoReal = Math.min(altura, maximo);
      const superior = Math.max(
        marco.top + 12,
        Math.min(
          arriba ? limite.top - altoReal - 8 : limite.bottom + 8,
          marco.bottom - altoReal - 12,
        ),
      );
      establecerPosicion({
        position: "fixed",
        width: anchoPanel,
        maxHeight: maximo,
        left:
          izquierda -
          (!flotante && dialogo ? marco.left + dialogo.clientLeft : 0),
        top:
          superior - (!flotante && dialogo ? marco.top + dialogo.clientTop : 0),
        visibility: "visible",
      });
    }
    colocar();
    const observador = new ResizeObserver(colocar);
    observador.observe(elemento);
    function fuera(evento: Event) {
      if (
        !elemento.contains(evento.target as Node) &&
        !control.contains(evento.target as Node)
      )
        cierre.current();
    }
    function desplazar(evento: Event) {
      if (!elemento.contains(evento.target as Node)) cierre.current();
    }
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("focusin", fuera);
    window.addEventListener("scroll", desplazar, true);
    window.addEventListener("resize", colocar);
    return () => {
      observador.disconnect();
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("focusin", fuera);
      window.removeEventListener("scroll", desplazar, true);
      window.removeEventListener("resize", colocar);
      if (flotante && elemento.matches(":popover-open")) elemento.hidePopover();
    };
  }, [abierto, boton, panel, ancho, minimo, altoMaximo, permitirSolapar]);
  return {
    posicion,
    contenedor: boton.current?.closest("dialog") || document.body,
  };
}
