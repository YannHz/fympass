import { useState } from "react";
import { Presentation, BriefcaseBusiness } from "lucide-react";
import { Dialogo, type Registro } from "./componentesGestion";
import { SemanaLaboral } from "./SemanaLaboral";
import "./HorariosLaborales.css";

export function HorariosLaborales({
  catalogo,
  administrador,
  guardado,
}: {
  catalogo: Registro;
  administrador: boolean;
  guardado: (mensaje: string) => void;
}) {
  const [tipo, cambiarTipo] = useState("docente");
  const [pendiente, cambiarPendiente] = useState(false);
  const [tipoPendiente, cambiarTipoPendiente] = useState<string | null>(null);
  function elegirTipo(valor: string) {
    if (valor === tipo) return;
    if (pendiente) {
      cambiarTipoPendiente(valor);
      return;
    }
    cambiarPendiente(false);
    cambiarTipo(valor);
  }
  return (
    <>
      <section className="panel horarios-laborales">
        <div
          className="separador-personal"
          role="group"
          aria-label="Tipo de personal"
        >
          <button
            className="secundario"
            aria-pressed={tipo === "docente"}
            onClick={() => elegirTipo("docente")}
          >
            <Presentation size={20} />
            Docentes
          </button>
          <button
            className="secundario"
            aria-pressed={tipo === "administrativo"}
            onClick={() => elegirTipo("administrativo")}
          >
            <BriefcaseBusiness size={20} />
            Personal administrativo
          </button>
        </div>
        <SemanaLaboral
          key={tipo}
          tipo={tipo}
          catalogo={catalogo}
          administrador={administrador}
          guardado={guardado}
          alModificar={cambiarPendiente}
        />
      </section>
      {tipoPendiente && (
        <Dialogo
          titulo="Descartar cambios sin guardar"
          cerrar={() => cambiarTipoPendiente(null)}
        >
          <div className="formulario-gestion">
            <p>
              Los cambios del horario actual se perderán si cambias de tipo de
              personal.
            </p>
            <footer className="acciones-dialogo">
              <button
                type="button"
                className="secundario"
                autoFocus
                onClick={() => cambiarTipoPendiente(null)}
              >
                Conservar cambios
              </button>
              <button
                type="button"
                onClick={() => {
                  cambiarPendiente(false);
                  cambiarTipo(tipoPendiente);
                  cambiarTipoPendiente(null);
                }}
              >
                Descartar y cambiar
              </button>
            </footer>
          </div>
        </Dialogo>
      )}
    </>
  );
}
