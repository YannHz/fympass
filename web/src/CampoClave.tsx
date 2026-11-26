import { useState } from "react";

type Propiedades = {
  id: string;
  nombre: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  autocompletar: "current-password" | "new-password";
  deshabilitado?: boolean;
  longitudMinima?: number;
  enfocar?: boolean;
};

export function CampoClave({
  id, nombre, etiqueta, valor, alCambiar, autocompletar,
  deshabilitado = false, longitudMinima, enfocar = false,
}: Propiedades) {
  const [visible, establecerVisible] = useState(false);

  return <div className="campo-clave">
    <input
      id={id}
      name={nombre}
      type={visible ? "text" : "password"}
      autoComplete={autocompletar}
      required
      minLength={longitudMinima}
      maxLength={256}
      value={valor}
      onChange={evento => alCambiar(evento.target.value)}
      disabled={deshabilitado}
      autoFocus={enfocar}
    />
    <button
      type="button"
      className="boton-texto"
      aria-pressed={visible}
      aria-label={`${visible ? "Ocultar" : "Mostrar"} ${etiqueta}`}
      onClick={() => establecerVisible(actual => !actual)}
      disabled={deshabilitado}
    >
      {visible ? "Ocultar" : "Mostrar"}
    </button>
  </div>;
}
