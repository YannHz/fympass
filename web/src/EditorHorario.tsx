import { SelectorHora, formatearHora } from "./SelectorHora";
import { SelectorFiltro } from "./SelectorFiltro";
import { useState } from "react";

export type Tramo = {
  dia_semana: number;
  hora_entrada: string;
  hora_salida: string | null;
};
export const diasHorario = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export function resumenHorario(tramos: Tramo[] = []) {
  const bloques = new Map<string, number[]>();
  for (const tramo of tramos) {
    const horas = `${formatearHora(tramo.hora_entrada)}${tramo.hora_salida ? "–" + formatearHora(tramo.hora_salida) : ""}`;
    bloques.set(horas, [...(bloques.get(horas) || []), tramo.dia_semana]);
  }
  return (
    [...bloques]
      .map(([horas, dias]) => {
        const ordenados = [...new Set(dias)].sort((a, b) => a - b);
        const consecutivos =
          ordenados.length > 2 &&
          ordenados.every((dia, i) => !i || dia === ordenados[i - 1] + 1);
        const texto = consecutivos
          ? `${diasHorario[ordenados[0]].slice(0, 3)}–${diasHorario[ordenados.at(-1)!].slice(0, 3)}`
          : ordenados.map((dia) => diasHorario[dia].slice(0, 3)).join(", ");
        return `${texto} · ${horas}`;
      })
      .join(" / ") || "Sin días configurados"
  );
}

export function EditorHorario({
  tramos,
  cambiar,
  salidaObligatoria = false,
}: {
  tramos: Tramo[];
  cambiar: (tramos: Tramo[]) => void;
  salidaObligatoria?: boolean;
}) {
  const [seleccion, establecerSeleccion] = useState(() =>
    tramos.length
      ? [...new Set(tramos.map((tramo) => tramo.dia_semana))]
      : [0, 1, 2, 3, 4],
  );
  const [entrada, establecerEntrada] = useState(
    tramos[0]?.hora_entrada.slice(0, 5) || "08:00",
  );
  const [salida, establecerSalida] = useState(
    tramos[0]?.hora_salida?.slice(0, 5) || "",
  );
  const [conSalida, establecerConSalida] = useState(
    salidaObligatoria || Boolean(tramos[0]?.hora_salida),
  );
  const [error, establecerError] = useState("");
  function aplicar() {
    if (
      !seleccion.length ||
      !entrada ||
      (conSalida && (!salida || salida <= entrada))
    ) {
      establecerError(
        "Selecciona días y una entrada válida. La salida debe ser posterior a la entrada.",
      );
      return;
    }
    const nuevos = [
      ...tramos.filter((tramo) => !seleccion.includes(tramo.dia_semana)),
      ...seleccion.map((dia) => ({
        dia_semana: dia,
        hora_entrada: entrada,
        hora_salida: conSalida ? salida : null,
      })),
    ];
    if (nuevos.length > 14) {
      establecerError("El horario admite hasta 14 tramos.");
      return;
    }
    cambiar(
      nuevos.sort(
        (a, b) =>
          a.dia_semana - b.dia_semana ||
          a.hora_entrada.localeCompare(b.hora_entrada),
      ),
    );
    establecerError("");
  }
  function editar(indice: number, valores: Partial<Tramo>) {
    cambiar(
      tramos.map((tramo, actual) =>
        actual === indice ? { ...tramo, ...valores } : tramo,
      ),
    );
  }
  return (
    <div className="editor-horario-visual">
      <div className="configurador-semana">
        <span className="etiqueta">1 · Elige los días</span>
        <div
          className="dias-configurables"
          role="group"
          aria-label="Días a configurar"
        >
          {diasHorario.map((dia, indice) => (
            <button
              type="button"
              key={dia}
              aria-label={dia}
              aria-pressed={seleccion.includes(indice)}
              onClick={() =>
                establecerSeleccion((actual) =>
                  actual.includes(indice)
                    ? actual.filter((valor) => valor !== indice)
                    : [...actual, indice],
                )
              }
            >
              {dia.slice(0, 3)}
            </button>
          ))}
        </div>
        <span className="etiqueta">2 · Define la entrada</span>
        <div className="horas-compartidas">
          <div className="campo-hora">
            <span>Entrada</span>
            <SelectorHora
              etiqueta="Entrada compartida"
              valor={entrada}
              alCambiar={establecerEntrada}
            />
          </div>
          {!salidaObligatoria && (
            <label className="opcion">
              <input
                type="checkbox"
                checked={conSalida}
                onChange={(evento) =>
                  establecerConSalida(evento.target.checked)
                }
              />
              Incluir salida
            </label>
          )}
          {conSalida && (
            <div className="campo-hora">
              <span>Salida</span>
              <SelectorHora
                etiqueta="Salida compartida"
                valor={salida}
                alCambiar={establecerSalida}
              />
            </div>
          )}
        </div>
        <button type="button" className="secundario" onClick={aplicar}>
          Aplicar a {seleccion.length} días
        </button>
        <small>
          Reemplaza los tramos de los días elegidos con su entrada y salida.
        </small>
        {error && (
          <p className="error-campo" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="vista-semana" aria-label="Vista previa semanal">
        {diasHorario.map((dia, numero) => (
          <div className="dia-horario" key={dia}>
            <strong>{dia.slice(0, 3)}</strong>
            {tramos
              .filter((tramo) => tramo.dia_semana === numero)
              .map((tramo, indice) => (
                <span key={indice}>
                  {formatearHora(tramo.hora_entrada)}
                  {tramo.hora_salida && (
                    <small>Salida {formatearHora(tramo.hora_salida)}</small>
                  )}
                </span>
              ))}
            {!tramos.some((tramo) => tramo.dia_semana === numero) && (
              <small>Sin ingreso</small>
            )}
          </div>
        ))}
      </div>
      <details className="ajustes-horario">
        <summary>Personalizar días y tramos</summary>
        <div className="editor-tramos">
          {tramos.map((tramo, indice) => (
            <fieldset className="fila-tramo" key={indice}>
              <legend>Tramo {indice + 1}</legend>
              <div className="campo-dia">
                <span>Día</span>
                <SelectorFiltro
                  etiqueta={`Día del tramo ${indice + 1}`}
                  enFormulario
                  valor={String(tramo.dia_semana)}
                  alCambiar={(valor) =>
                    editar(indice, { dia_semana: Number(valor) })
                  }
                  opciones={diasHorario.map((dia, numero) => ({
                    valor: String(numero),
                    texto: dia,
                  }))}
                />
              </div>
              <div className="campo-hora">
                <span>Entrada</span>
                <SelectorHora
                  etiqueta={`Entrada del tramo ${indice + 1}`}
                  valor={tramo.hora_entrada}
                  alCambiar={(hora) => editar(indice, { hora_entrada: hora })}
                />
              </div>
              <div className="campo-hora">
                <span>{salidaObligatoria ? "Salida" : "Salida opcional"}</span>
                <SelectorHora
                  etiqueta={`Salida del tramo ${indice + 1}`}
                  valor={tramo.hora_salida || ""}
                  alCambiar={(hora) => editar(indice, { hora_salida: hora })}
                />
              </div>
              <button
                type="button"
                className="boton-texto"
                aria-label={`Quitar tramo ${indice + 1}`}
                onClick={() =>
                  cambiar(tramos.filter((_, actual) => actual !== indice))
                }
              >
                Quitar
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="secundario"
            disabled={tramos.length >= 14}
            onClick={() =>
              cambiar([
                ...tramos,
                {
                  dia_semana: 0,
                  hora_entrada: "08:00",
                  hora_salida: salidaObligatoria ? "17:00" : null,
                },
              ])
            }
          >
            Añadir tramo
          </button>
        </div>
      </details>
    </div>
  );
}
