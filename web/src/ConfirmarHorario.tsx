import { SelectorFecha } from "./SelectorFecha";
import { useRef, useState } from "react";
import { Dialogo, type Registro } from "./componentesGestion";
import { consultar } from "./servicio";
import { resumenHorario } from "./EditorHorario";

export function ConfirmarHorario({
  horario,
  personas,
  cerrar,
  guardado,
}: {
  horario: Registro;
  personas: Registro[];
  cerrar: () => void;
  guardado: (mensaje: string) => void;
}) {
  const hoy = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [fecha, establecerFecha] = useState(hoy);
  const [seleccion, establecerSeleccion] = useState<number[]>([]);
  const [busqueda, establecerBusqueda] = useState("");
  const [revisando, establecerRevisando] = useState(false);
  const [ocupado, establecerOcupado] = useState(false);
  const [error, establecerError] = useState("");
  const enviando = useRef(false);
  const visibles = personas.filter((persona) =>
    `${persona.nombre} ${persona.codigo}`
      .toLocaleLowerCase()
      .includes(busqueda.toLocaleLowerCase()),
  );
  const elegidas = personas.filter((persona) => seleccion.includes(persona.id));
  async function guardar() {
    if (enviando.current || !seleccion.length) return;
    enviando.current = true;
    establecerOcupado(true);
    establecerError("");
    try {
      const respuesta = await consultar(
        "/api/gestion/horarios/asignar-personal",
        {
          method: "POST",
          body: JSON.stringify({
            persona_ids: seleccion,
            vigente_desde: fecha,
            horario_id: horario.id,
          }),
        },
      );
      guardado(respuesta.mensaje);
      cerrar();
    } catch (problema) {
      establecerError((problema as Error).message);
    } finally {
      enviando.current = false;
      establecerOcupado(false);
    }
  }
  return (
    <Dialogo
      titulo="Asignar horario laboral"
      cerrar={cerrar}
      bloqueado={ocupado}
      clase="dialogo-asignacion-laboral"
    >
      <div className="revision-excepciones">
        <p className="identidad-horario-asignacion">
          <strong>
            {horario.nombre}
          </strong>
        </p>
        <p className="resumen-grupo">{resumenHorario(horario.tramos)}</p>
        {!revisando ? (
          <>
            <SelectorFecha
              etiqueta="Aplicar desde"
              minimo={hoy}
              valor={fecha}
              alCambiar={establecerFecha}
            />
            <label>
              Buscar por nombre o ID
              <input
                type="search"
                value={busqueda}
                onChange={(evento) => establecerBusqueda(evento.target.value)}
              />
            </label>
            <button
              type="button"
              className="boton-texto"
              onClick={() =>
                establecerSeleccion((actual) =>
                  visibles.every((persona) => actual.includes(persona.id))
                    ? actual.filter(
                        (id) => !visibles.some((persona) => persona.id === id),
                      )
                    : [
                        ...new Set([
                          ...actual,
                          ...visibles.map((persona) => persona.id),
                        ]),
                      ],
                )
              }
            >
              Seleccionar o quitar los visibles
            </button>
            <div className="lista-excepciones">
              {visibles.map((persona) => (
                <label key={persona.id} data-seleccionado={seleccion.includes(persona.id)}>
                  <input
                    type="checkbox"
                    checked={seleccion.includes(persona.id)}
                    onChange={() =>
                      establecerSeleccion((actual) =>
                        actual.includes(persona.id)
                          ? actual.filter((id) => id !== persona.id)
                          : [...actual, persona.id],
                      )
                    }
                  />
                  <span>
                    <strong>{persona.nombre}</strong>
                    <small>
                      {persona.codigo} ·{" "}
                      {persona.asignaciones?.some(
                        (valor: Registro) =>
                          valor.horario_id === horario.id &&
                          valor.desde <= fecha &&
                          (!valor.hasta || valor.hasta >= fecha),
                      )
                        ? "Horario ya asignado en esta fecha"
                        : "Por confirmar"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            {!visibles.length && (
              <p className="nota">
                No hay personas disponibles con esta búsqueda.
              </p>
            )}
          </>
        ) : (
          <>
            <h3>Revisa antes de confirmar</h3>
            <p>
              {elegidas.length} personas · Desde {fecha}
            </p>
            <ul className="personas-confirmacion">
              {elegidas.map((persona) => (
                <li key={persona.id}>
                  {persona.nombre}
                  <small>{persona.codigo}</small>
                </li>
              ))}
            </ul>
            <p className="nota">
              Se conservarán los horarios anteriores a esa fecha. Se reemplazará
              cualquier asignación programada desde esa fecha para las personas
              seleccionadas. Si ya hay marcados ese día, elige el siguiente.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="aviso error">
            {error}
          </p>
        )}
        <footer className="acciones-dialogo">
          <button
            type="button"
            className="secundario"
            disabled={ocupado}
            onClick={() => (revisando ? establecerRevisando(false) : cerrar())}
          >
            {revisando ? "Volver" : "Cancelar"}
          </button>
          <button
            type="button"
            disabled={ocupado || !seleccion.length || !fecha || fecha < hoy}
            onClick={() =>
              revisando ? void guardar() : establecerRevisando(true)
            }
          >
            {ocupado
              ? "Guardando…"
              : revisando
                ? "Confirmar asignación"
                : `Revisar selección (${seleccion.length})`}
          </button>
        </footer>
      </div>
    </Dialogo>
  );
}
