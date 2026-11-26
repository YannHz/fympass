import { useState } from "react";
import {
  Presentation,
  BriefcaseBusiness,
  Clock3,
  LogIn,
  UserRoundX,
  Settings2,
  Plus,
  CalendarDays,
  Search,
  Pencil,
  ChartNoAxesCombined,
} from "lucide-react";
import { Tabla, Vacio, type Registro } from "./componentesGestion";
import { SelectorFiltro } from "./SelectorFiltro";
import "./ToleranciasReglas.css";

const iconosRol: Record<string, typeof Presentation> = {
  docente: Presentation,
  administrativo: BriefcaseBusiness,
};
function fechaLarga(fecha: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(fecha + "T12:00:00Z"));
}
export function ToleranciasReglas({
  catalogo,
  editar,
  editarDia,
}: {
  catalogo: Registro;
  editar: (seccion: "tolerancias" | "marcado" | "seguimiento") => void;
  editarDia: (dia?: Registro) => void;
}) {
  const reglas = catalogo.reglas;
  const hoy = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Lima",
  }).format(new Date());
  const [buscar, cambiarBuscar] = useState(""),
    [periodo, cambiarPeriodo] = useState("proximos");
  const dias = catalogo.dias_no_lectivos
    .filter(
      (dia: Registro) =>
        (periodo !== "proximos" || dia.fecha >= hoy) &&
        (!buscar ||
          `${dia.motivo} ${dia.fecha}`
            .toLowerCase()
            .includes(buscar.toLowerCase())),
    )
    .sort((a: Registro, b: Registro) => a.fecha.localeCompare(b.fecha));
  const proximo = [...catalogo.dias_no_lectivos]
    .filter((dia: Registro) => dia.fecha >= hoy)
    .sort((a: Registro, b: Registro) => a.fecha.localeCompare(b.fecha))[0];
  return (
    <div className="tolerancias-reglas">
      <section className="panel">
        <div className="cabecera">
          <div>
            <h2>Tolerancias por rol</h2>
            <p>
              Margen después de la hora de entrada para considerar el ingreso
              puntual.
            </p>
          </div>
          <button className="secundario" onClick={() => editar("tolerancias")}>
            <Settings2 size={16} />
            Editar tolerancias
          </button>
        </div>
        <div className="tarjetas-tolerancia">
          {catalogo.roles.map((rol: Registro) => {
            const Icono = iconosRol[rol.codigo] || BriefcaseBusiness;
            return (
              <article key={rol.id}>
                <span className="icono-regla">
                  <Icono size={22} aria-hidden="true" />
                </span>
                <h3>{rol.nombre}</h3>
                <p className="valor-tolerancia">
                  {reglas.tolerancias[rol.id]}
                  <span>minutos</span>
                </p>
                <p className="nota">
                  {reglas.tolerancias[rol.id] === 0
                    ? "Sin margen de tolerancia."
                    : "Superado el margen, se registra tardanza."}
                </p>
              </article>
            );
          })}
        </div>
        <p className="nota nota-vigencia">
          <Clock3 size={16} aria-hidden="true" />
          Las tolerancias se aplican desde hoy. Los marcados anteriores
          conservan su resultado.
        </p>
      </section>
      <div className="rejilla-reglas">
        <section className="panel">
          <div className="cabecera">
            <div>
              <h2>Reglas de marcado</h2>
              <p>Cuándo se permite ingresar y se evalúa una ausencia.</p>
            </div>
            <button className="boton-texto" onClick={() => editar("marcado")}>
              <Pencil size={16} />
              Editar
            </button>
          </div>
          <div className="detalle-regla">
            <span className="icono-regla">
              <LogIn size={21} aria-hidden="true" />
            </span>
            <div>
              <h3>Ingreso anticipado</h3>
              <strong>
                {reglas.anticipacion_minutos
                  ? `${reglas.anticipacion_minutos} minutos antes`
                  : "Sin límite de anticipación"}
              </strong>
              <p>
                {reglas.anticipacion_minutos
                  ? "Antes de este margen, el marcado de ingreso no está permitido."
                  : "El ingreso puede registrarse antes de la hora prevista."}
              </p>
            </div>
          </div>
          <div className="detalle-regla">
            <span className="icono-regla icono-regla-atencion">
              <UserRoundX size={21} aria-hidden="true" />
            </span>
            <div>
              <h3>Evaluación de inasistencia</h3>
              <strong>{reglas.limite_ausencia_minutos} minutos después</strong>
              <p>
                Desde la entrada prevista, si hay horario y aún no existe un
                marcado. Una entrada posterior sigue registrándose.
              </p>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="cabecera">
            <div>
              <h2>Seguimiento de inasistencias</h2>
              <p>Indicadores que aparecen en el expediente personal.</p>
            </div>
            <button
              className="boton-texto"
              onClick={() => editar("seguimiento")}
            >
              <Pencil size={16} />
              Editar
            </button>
          </div>
          <div className="umbrales-reglas">
            <div className="umbral-observacion">
              <span>Observación</span>
              <strong>Desde {reglas.observacion_porcentaje}%</strong>
            </div>
            <div className="umbral-alerta">
              <span>Alerta</span>
              <strong>Desde {reglas.alerta_porcentaje}%</strong>
            </div>
          </div>
          <p className="nota nota-vigencia">
            <ChartNoAxesCombined size={18} aria-hidden="true" />
            Se calculan sobre las inasistencias del periodo consultado. No
            aplican sanciones ni descuentos.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="cabecera">
          <div>
            <h2>Días no lectivos</h2>
            <p>Fechas institucionales que no generan inasistencias.</p>
          </div>
          <button onClick={() => editarDia()}>
            <Plus size={16} />
            Añadir fecha
          </button>
        </div>
        {proximo && (
          <div className="proximo-no-lectivo">
            <CalendarDays size={22} aria-hidden="true" />
            <div>
              <span>Próxima fecha · {fechaLarga(proximo.fecha)}</span>
              <strong>{proximo.motivo}</strong>
            </div>
          </div>
        )}
        <div className="filtros">
          <label className="buscador">
            <Search size={18} />
            <input
              aria-label="Buscar día no lectivo"
              placeholder="Buscar por motivo o fecha"
              value={buscar}
              onChange={(evento) => cambiarBuscar(evento.target.value)}
            />
          </label>
          <SelectorFiltro
            etiqueta="Fechas no lectivas"
            valor={periodo}
            alCambiar={cambiarPeriodo}
            opciones={[
              { valor: "proximos", texto: "Desde hoy" },
              { valor: "todos", texto: "Todas las fechas" },
            ]}
          />
          {(buscar || periodo !== "proximos") && (
            <button
              className="boton-texto"
              onClick={() => {
                cambiarBuscar("");
                cambiarPeriodo("proximos");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
        {dias.length ? (
          <Tabla
            titulo="Días no lectivos"
            filas={dias}
            clave="fecha"
            columnas={[
              { titulo: "Fecha", mostrar: (dia) => fechaLarga(dia.fecha) },
              { titulo: "Motivo", mostrar: (dia) => dia.motivo },
              {
                titulo: "Acción",
                mostrar: (dia) => (
                  <button
                    className="boton-texto"
                    onClick={() => editarDia(dia)}
                  >
                    <Pencil size={15} />
                    Editar motivo
                  </button>
                ),
              },
            ]}
          />
        ) : (
          <Vacio
            titulo={
              buscar
                ? "No hay fechas con ese criterio."
                : periodo === "proximos"
                  ? "No hay días no lectivos próximos."
                  : "No hay días no lectivos registrados."
            }
            detalle="Añade una fecha para incluir feriados o suspensiones de actividades en el calendario institucional."
          />
        )}
      </section>
    </div>
  );
}
