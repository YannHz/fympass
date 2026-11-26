import { usarPanelFlotante } from "./usarPanelFlotante";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Opcion = { valor: string; texto: string };

export function SelectorFiltro({
  etiqueta,
  valor,
  opciones,
  alCambiar,
  enFormulario = false,
  id,
  descripcion,
  invalido = false,
  compacto = false,
}: {
  etiqueta: string;
  valor: string;
  opciones: Opcion[];
  alCambiar: (valor: string) => void;
  enFormulario?: boolean;
  id?: string;
  descripcion?: string;
  invalido?: boolean;
  compacto?: boolean;
}) {
  const identificador = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const busqueda = useRef({ texto: "", hora: 0 });
  const [abierto, establecerAbierto] = useState(false);
  const [activo, establecerActivo] = useState(0);
  const { posicion, contenedor } = usarPanelFlotante(
    abierto,
    boton,
    lista,
    () => establecerAbierto(false),
    { minimo: compacto ? 80 : 210 },
  );
  const seleccion = Math.max(
    0,
    opciones.findIndex((opcion) => opcion.valor === valor),
  );

  function abrir(indice = seleccion) {
    establecerActivo(indice);
    establecerAbierto(true);
  }
  function elegir(indice: number) {
    if (!opciones[indice]) return;
    alCambiar(opciones[indice].valor);
    establecerAbierto(false);
    boton.current?.focus();
  }
  useEffect(() => {
    const elemento = lista.current,
      opcion = elemento?.children[activo] as HTMLElement | undefined;
    if (!abierto || !elemento || !opcion) return;
    if (opcion.offsetTop < elemento.scrollTop)
      elemento.scrollTop = opcion.offsetTop;
    else if (
      opcion.offsetTop + opcion.offsetHeight >
      elemento.scrollTop + elemento.clientHeight
    )
      elemento.scrollTop =
        opcion.offsetTop + opcion.offsetHeight - elemento.clientHeight;
  }, [activo, abierto]);

  function manejarTecla(evento: KeyboardEvent<HTMLButtonElement>) {
    const tecla = evento.key;
    if (tecla === "Tab" || tecla === "Escape") {
      if (abierto && tecla === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
      }
      establecerAbierto(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(tecla)) {
      evento.preventDefault();
      const indice =
        tecla === "Home"
          ? 0
          : tecla === "End"
            ? opciones.length - 1
            : Math.max(
                0,
                Math.min(
                  opciones.length - 1,
                  activo + (tecla === "ArrowDown" ? 1 : -1),
                ),
              );
      if (!abierto)
        abrir(tecla === "Home" || tecla === "End" ? indice : seleccion);
      else establecerActivo(indice);
    } else if (tecla === "Enter" || tecla === " ") {
      evento.preventDefault();
      if (abierto) elegir(activo);
      else abrir();
    } else if (
      tecla.length === 1 &&
      !evento.ctrlKey &&
      !evento.metaKey &&
      !evento.altKey
    ) {
      evento.preventDefault();
      const ahora = Date.now();
      busqueda.current = {
        texto:
          (ahora - busqueda.current.hora < 700 ? busqueda.current.texto : "") +
          tecla.toLocaleLowerCase("es"),
        hora: ahora,
      };
      const indice = opciones.findIndex((opcion) =>
        opcion.texto.toLocaleLowerCase("es").startsWith(busqueda.current.texto),
      );
      if (indice >= 0) {
        if (abierto) establecerActivo(indice);
        else abrir(indice);
      }
    }
  }
  const contenidoLista = (
    <ul
      ref={lista}
      id={identificador}
      role="listbox"
      aria-label={etiqueta}
      popover="manual"
      className={`selector-filtro-lista panel-flotante ${compacto ? "lista-compacta" : ""}`}
      style={posicion}
      onPointerDown={(evento) => {
        if (evento.pointerType === "mouse") evento.preventDefault();
      }}
    >
      {opciones.map((opcion, indice) => (
        <li
          key={opcion.valor}
          id={`${identificador}-${indice}`}
          role="option"
          aria-selected={opcion.valor === valor}
          data-activo={activo === indice}
          onPointerMove={() => establecerActivo(indice)}
          onClick={() => elegir(indice)}
        >
          <span>{opcion.texto}</span>
          {opcion.valor === valor && <Check size={16} aria-hidden="true" />}
        </li>
      ))}
    </ul>
  );
  return (
    <div
      className={`selector-filtro ${enFormulario ? "selector-formulario" : ""}`}
    >
      <button
        ref={boton}
        id={id}
        title={opciones[seleccion]?.texto}
        type="button"
        className="selector-filtro-control"
        role="combobox"
        aria-describedby={descripcion}
        aria-invalid={invalido}
        aria-label={`${etiqueta}: ${opciones[seleccion]?.texto}`}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        aria-controls={abierto ? identificador : undefined}
        aria-activedescendant={
          abierto ? `${identificador}-${activo}` : undefined
        }
        onKeyDown={manejarTecla}
        onClick={() => (abierto ? establecerAbierto(false) : abrir())}
      >
        <span>{opciones[seleccion]?.texto}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {abierto && createPortal(contenidoLista, contenedor)}
    </div>
  );
}
