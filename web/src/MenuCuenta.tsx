import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { usarPanelFlotante } from "./usarPanelFlotante";

export function MenuCuenta({
  children,
  texto = "Cuenta",
}: {
  children: ReactNode;
  texto?: string;
}) {
  const [abierto, establecerAbierto] = useState(false);
  const identificador = useId();
  const boton = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const { posicion, contenedor } = usarPanelFlotante(
    abierto,
    boton,
    panel,
    () => establecerAbierto(false),
    { ancho: 280, altoMaximo: 440 },
  );
  function cerrar() {
    establecerAbierto(false);
    boton.current?.focus();
  }
  useEffect(() => {
    if (abierto)
      panel.current
        ?.querySelector<HTMLElement>("a, button")
        ?.focus({ preventScroll: true });
  }, [abierto]);
  return (
    <>
      <button
        ref={boton}
        className="secundario control-cuenta"
        type="button"
        aria-label="Opciones de mi cuenta"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={abierto ? identificador : undefined}
        onClick={() => establecerAbierto(!abierto)}
      >
        {texto}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {abierto &&
        createPortal(
          <div
            ref={panel}
            popover="manual"
            id={identificador}
            className="panel-cuenta panel-flotante"
            role="dialog"
            aria-label="Opciones de mi cuenta"
            style={posicion}
            onKeyDown={(evento) => {
              if (evento.key === "Escape") {
                evento.preventDefault();
                evento.stopPropagation();
                cerrar();
              }
            }}
          >
            <button className="boton-texto" onClick={() => { cerrar(); window.dispatchEvent(new Event("fym-abrir-seguridad")); }}>Seguridad de mi cuenta</button>
            {children}
          </div>,
          contenedor,
        )}
    </>
  );
}
