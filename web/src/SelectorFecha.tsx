import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { usarPanelFlotante } from "./usarPanelFlotante";

const meses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
function fechaActual() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function convertir(valor: string) {
  return new Date(valor + "T12:00:00Z");
}
function codigo(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

export function SelectorFecha({
  etiqueta,
  valor,
  alCambiar,
  minimo = "1900-01-01",
  maximo = "2100-12-31",
  modo = "fecha",
  ocultarEtiqueta = false,
  id,
  descripcion,
  invalido = false,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  minimo?: string;
  maximo?: string;
  modo?: "fecha" | "mes";
  ocultarEtiqueta?: boolean;
  id?: string;
  descripcion?: string;
  invalido?: boolean;
}) {
  const identificador = useId();
  const boton = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const [abierto, establecerAbierto] = useState(false);
  const hoy = fechaActual();
  const limiteInferior = modo === "mes" ? minimo.slice(0, 7) + "-01" : minimo;
  const limiteSuperior =
    modo === "mes"
      ? codigo(
          new Date(
            Date.UTC(
              Number(maximo.slice(0, 4)),
              Number(maximo.slice(5, 7)),
              0,
              12,
            ),
          ),
        )
      : maximo;
  const referencia = valor
    ? modo === "mes"
      ? valor + "-01"
      : valor
    : hoy < limiteInferior
      ? limiteInferior
      : hoy > limiteSuperior
        ? limiteSuperior
        : hoy;
  const [mes, establecerMes] = useState(referencia.slice(0, 7));
  const [enfocada, establecerEnfocada] = useState(referencia);
  const [elegirMes, establecerElegirMes] = useState(modo === "mes");
  const [anoEscrito, establecerAnoEscrito] = useState(referencia.slice(0, 4));
  const [ano, numeroMes] = mes.split("-").map(Number);
  const { posicion, contenedor } = usarPanelFlotante(
    abierto,
    boton,
    panel,
    () => establecerAbierto(false),
    { ancho: 360, altoMaximo: 520, permitirSolapar: true },
  );
  const cantidad = new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate();
  const inicio =
    (new Date(Date.UTC(ano, numeroMes - 1, 1)).getUTCDay() + 6) % 7;
  const texto = valor
    ? new Intl.DateTimeFormat(
        "es-PE",
        modo === "mes"
          ? { timeZone: "UTC", month: "long", year: "numeric" }
          : {
              timeZone: "UTC",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            },
      ).format(convertir(referencia))
    : "Seleccionar fecha";
  function abrir() {
    establecerMes(referencia.slice(0, 7));
    establecerEnfocada(referencia);
    establecerElegirMes(modo === "mes");
    establecerAnoEscrito(referencia.slice(0, 4));
    establecerAbierto(true);
  }
  function cerrar() {
    establecerAbierto(false);
    boton.current?.focus();
  }
  function elegir(fecha: string) {
    if (fecha < limiteInferior || fecha > limiteSuperior) return;
    alCambiar(modo === "mes" ? fecha.slice(0, 7) : fecha);
    cerrar();
  }
  function fijarMes(nuevo: string) {
    const destino =
      nuevo < limiteInferior.slice(0, 7)
        ? limiteInferior.slice(0, 7)
        : nuevo > limiteSuperior.slice(0, 7)
          ? limiteSuperior.slice(0, 7)
          : nuevo;
    establecerMes(destino);
    establecerAnoEscrito(destino.slice(0, 4));
    establecerEnfocada(
      destino + "-01" < limiteInferior ? limiteInferior : destino + "-01",
    );
  }
  function cambiarMes(paso: number) {
    fijarMes(
      codigo(new Date(Date.UTC(ano, numeroMes - 1 + paso, 1, 12))).slice(0, 7),
    );
  }
  useEffect(() => {
    if (abierto && !elegirMes)
      panel.current
        ?.querySelector<HTMLButtonElement>(`[data-fecha="${enfocada}"]`)
        ?.focus({ preventScroll: true });
  }, [abierto, enfocada, elegirMes]);
  function navegar(evento: KeyboardEvent, fecha: string) {
    const movimientos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (
      !(evento.key in movimientos) &&
      !["Home", "End", "PageUp", "PageDown"].includes(evento.key)
    )
      return;
    evento.preventDefault();
    if (evento.key === "PageUp" || evento.key === "PageDown") {
      cambiarMes(evento.key === "PageDown" ? 1 : -1);
      return;
    }
    const nueva = convertir(fecha),
      columna = (nueva.getUTCDay() + 6) % 7;
    nueva.setUTCDate(
      nueva.getUTCDate() +
        (evento.key === "Home"
          ? -columna
          : evento.key === "End"
            ? 6 - columna
            : movimientos[evento.key]),
    );
    const destino = codigo(nueva);
    if (destino >= limiteInferior && destino <= limiteSuperior) {
      establecerMes(destino.slice(0, 7));
      establecerEnfocada(destino);
    }
  }
  const periodo = modo === "mes" ? "año" : "mes";
  return (
    <div
      className={`selector-fecha ${ocultarEtiqueta ? "fecha-sin-etiqueta" : ""}`}
    >
      {!ocultarEtiqueta && <span className="etiqueta-fecha">{etiqueta}</span>}
      <button
        ref={boton}
        id={id}
        type="button"
        className="selector-fecha-control"
        aria-label={`${etiqueta}: ${texto}`}
        aria-describedby={descripcion}
        aria-invalid={invalido}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={abierto ? identificador : undefined}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={(evento) => {
          if (evento.key === "ArrowDown") {
            evento.preventDefault();
            abrir();
          }
        }}
      >
        <span>{texto}</span>
        {modo === "mes" ? (
          <ChevronDown size={17} aria-hidden="true" />
        ) : (
          <CalendarDays size={17} aria-hidden="true" />
        )}
      </button>
      {abierto &&
        createPortal(
          <div
            ref={panel}
            popover="manual"
            id={identificador}
            className="calendario-fecha panel-flotante"
            role="dialog"
            aria-label={`Seleccionar ${modo === "mes" ? "mes y año" : "fecha"}: ${etiqueta}`}
            style={posicion}
            onKeyDown={(evento) => {
              if (evento.key === "Escape") {
                evento.preventDefault();
                evento.stopPropagation();
                cerrar();
              }
            }}
          >
            <header>
              <button
                type="button"
                className="secundario mes-fecha"
                onClick={() => {
                  establecerAnoEscrito(String(ano));
                  establecerElegirMes(modo === "mes" || !elegirMes);
                  if (modo === "mes")
                    panel.current
                      ?.querySelector<HTMLInputElement>("input")
                      ?.focus();
                }}
                aria-expanded={elegirMes}
                aria-label={modo === "mes" ? "Elegir año" : "Elegir mes y año"}
              >
                {modo === "mes" ? ano : `${meses[numeroMes - 1]} de ${ano}`}
              </button>
              <button
                type="button"
                className="icono-boton"
                disabled={
                  modo === "mes"
                    ? ano <= Number(limiteInferior.slice(0, 4))
                    : mes <= limiteInferior.slice(0, 7)
                }
                aria-label={`${periodo === "año" ? "Año" : "Mes"} anterior`}
                onClick={() => cambiarMes(modo === "mes" ? -12 : -1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="icono-boton"
                disabled={
                  modo === "mes"
                    ? ano >= Number(limiteSuperior.slice(0, 4))
                    : mes >= limiteSuperior.slice(0, 7)
                }
                aria-label={`${periodo === "año" ? "Año" : "Mes"} siguiente`}
                onClick={() => cambiarMes(modo === "mes" ? 12 : 1)}
              >
                <ChevronRight size={18} />
              </button>
            </header>
            {elegirMes ? (
              <>
                <label className="ano-fecha">
                  Año
                  <input
                    type="number"
                    inputMode="numeric"
                    min={Number(limiteInferior.slice(0, 4))}
                    max={Number(limiteSuperior.slice(0, 4))}
                    value={anoEscrito}
                    onChange={(evento) => {
                      const nuevo = evento.target.value;
                      establecerAnoEscrito(nuevo);
                      if (
                        /^\d{4}$/.test(nuevo) &&
                        Number(nuevo) >= Number(limiteInferior.slice(0, 4)) &&
                        Number(nuevo) <= Number(limiteSuperior.slice(0, 4))
                      )
                        fijarMes(
                          `${nuevo}-${String(numeroMes).padStart(2, "0")}`,
                        );
                    }}
                  />
                </label>
                <div className="meses-fecha">
                  {meses.map((nombre, indice) => {
                    const nuevo = `${ano}-${String(indice + 1).padStart(2, "0")}`;
                    return (
                      <button
                        key={nombre}
                        type="button"
                        disabled={
                          nuevo < limiteInferior.slice(0, 7) ||
                          nuevo > limiteSuperior.slice(0, 7)
                        }
                        aria-pressed={nuevo === (modo === "mes" ? valor : mes)}
                        onClick={() =>
                          modo === "mes"
                            ? elegir(nuevo + "-01")
                            : (fijarMes(nuevo), establecerElegirMes(false))
                        }
                      >
                        {nombre.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="dias-fecha" aria-hidden="true">
                  {diasSemana.map((dia) => (
                    <span key={dia}>{dia}</span>
                  ))}
                </div>
                <div
                  className="rejilla-fecha"
                  role="group"
                  aria-label={`${meses[numeroMes - 1]} de ${ano}`}
                >
                  {Array.from({ length: cantidad }, (_, indice) => {
                    const fecha = `${mes}-${String(indice + 1).padStart(2, "0")}`;
                    return (
                      <button
                        key={fecha}
                        type="button"
                        data-fecha={fecha}
                        disabled={
                          fecha < limiteInferior || fecha > limiteSuperior
                        }
                        style={
                          indice === 0
                            ? { gridColumnStart: inicio + 1 }
                            : undefined
                        }
                        tabIndex={fecha === enfocada ? 0 : -1}
                        aria-label={new Intl.DateTimeFormat("es-PE", {
                          timeZone: "UTC",
                          dateStyle: "full",
                        }).format(convertir(fecha))}
                        aria-pressed={fecha === valor}
                        aria-current={fecha === hoy ? "date" : undefined}
                        onKeyDown={(evento) => navegar(evento, fecha)}
                        onClick={() => elegir(fecha)}
                      >
                        {indice + 1}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <footer>
              <button type="button" className="boton-texto" onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="button"
                className="secundario"
                disabled={hoy < limiteInferior || hoy > limiteSuperior}
                onClick={() =>
                  elegir(modo === "mes" ? hoy.slice(0, 7) + "-01" : hoy)
                }
              >
                {modo === "mes" ? "Mes actual" : "Hoy"}
              </button>
            </footer>
          </div>,
          contenedor,
        )}
    </div>
  );
}
