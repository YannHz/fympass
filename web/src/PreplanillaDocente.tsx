import { useEffect, useState } from "react";
import {
  Download,
  Search,
  Clock3,
  Users,
  CalendarClock,
  FileCheck2,
} from "lucide-react";
import {
  Dialogo,
  Estado,
  Insignia,
  Tabla,
  useDatos,
  type Registro,
} from "./componentesGestion";
import { SelectorFecha } from "./SelectorFecha";
import { SelectorFiltro } from "./SelectorFiltro";
import { horaLocal } from "./servicio";
import "./PreplanillaDocente.css";

const moneda = (valor: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    valor,
  );
const iconosResumen = [Users, Clock3, CalendarClock, FileCheck2];
const tonosResumen = ["marca", "tardanza", "tardanza", "revision"];
const normalizar = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const pendiente = (fila: Registro) =>
  fila.minutos_tardanza > 0 || fila.faltas > 0 || fila.dias_incompletos > 0;
function DetalleDocente({
  docente,
  desde,
  hasta,
  revision,
  cerrar,
}: {
  docente: Registro;
  desde: string;
  hasta: string;
  revision: number;
  cerrar: () => void;
}) {
  const { datos, error, cargando } = useDatos(
    `/api/gestion/personas/${docente.persona_id}/expediente?desde=${desde}&hasta=${hasta}`,
    revision,
  );
  return (
    <Dialogo
      titulo={docente.nombre}
      cerrar={cerrar}
      clase="expediente preplanilla-detalle"
    >
      <p className="nota">
        Del {desde.split("-").reverse().join("/")} al{" "}
        {hasta.split("-").reverse().join("/")}
      </p>
      <div className="resumen-tardanza">
        <Clock3 aria-hidden="true" />
        <div>
          <strong>{docente.minutos_tardanza} minutos de tardanza</strong>
          <p>
            {docente.dias_tardanza ?? "—"} días con tardanza · {docente.faltas}{" "}
            inasistencias · {docente.dias_incompletos} sin salida
          </p>
        </div>
      </div>
      <Estado error={error} cargando={cargando} />
      {datos && (
        <Tabla
          titulo="Detalle de la preplanilla docente"
          filas={datos.calendario}
          clave="fecha"
          columnas={[
            {
              titulo: "Fecha",
              mostrar: (fila) => fila.fecha.split("-").reverse().join("/"),
            },
            {
              titulo: "Entrada",
              mostrar: (fila) => (fila.entrada ? horaLocal(fila.entrada) : "—"),
            },
            {
              titulo: "Salida",
              mostrar: (fila) => (fila.salida ? horaLocal(fila.salida) : "—"),
            },
            {
              titulo: "Tardanza",
              mostrar: (fila) => `${fila.minutos_tardanza} min`,
            },
            {
              titulo: "Estado",
              mostrar: (fila) => <Insignia texto={fila.estado} />,
            },
          ]}
        />
      )}
      <p className="nota">
        El total suma los días con estado Tardanza. Los minutos de días
        justificados se conservan en el detalle, pero se excluyen del total.
      </p>
      <details className="estimacion-docente">
        <summary>Estimación referencial</summary>
        <p>
          Horas programadas: {docente.horas_programadas} h · Permanencia
          registrada: {docente.horas_permanencia} h.
        </p>
        {docente.tarifa_configurada ? (
          <>
            <p>
              Tarifa por hora: {moneda(docente.tarifa_hora)} · Importe estimado:{" "}
              {moneda(docente.importe_estimado)}.
            </p>
            <p>
              Equivalente referencial de tardanza:{" "}
              {moneda(docente.descuento_referencial)}.
            </p>
          </>
        ) : (
          <p>Sin tarifa configurada. Puedes definirla en Personas y carnets.</p>
        )}
        <p className="nota">
          El importe se calcula con la permanencia registrada. No confirma horas
          de clase ni aplica descuentos.
        </p>
      </details>
    </Dialogo>
  );
}
export function PreplanillaDocente({
  filas,
  desde,
  hasta,
  cambiarDesde,
  cambiarHasta,
  cargando,
  error,
  revision,
  exportando,
  exportar,
}: {
  filas: Registro[];
  desde: string;
  hasta: string;
  cambiarDesde: (valor: string) => void;
  cambiarHasta: (valor: string) => void;
  cargando: boolean;
  error: string;
  revision: number;
  exportando: boolean;
  exportar: () => void;
}) {
  const [modo, cambiarModo] = useState("mes"),
    [buscar, cambiarBuscar] = useState(""),
    [filtro, cambiarFiltro] = useState(""),
    [docente, cambiarDocente] = useState<Registro | null>(null);
  function seleccionarMes(mes: string) {
    const [anio, numero] = mes.split("-").map(Number);
    cambiarDesde(`${mes}-01`);
    cambiarHasta(
      new Date(Date.UTC(anio, numero, 0)).toISOString().slice(0, 10),
    );
  }
  useEffect(() => {
    seleccionarMes(desde.slice(0, 7));
  }, []);
  const visibles = filas
    .filter(
      (fila) =>
        normalizar(fila.nombre).includes(normalizar(buscar)) &&
        (!filtro || pendiente(fila)),
    )
    .sort(
      (a, b) =>
        b.minutos_tardanza - a.minutos_tardanza ||
        a.nombre.localeCompare(b.nombre),
    );
  const total = (campo: string) =>
    filas.reduce((suma, fila) => suma + Number(fila[campo] || 0), 0);
  return (
    <div className="preplanilla-docente">
      <section className="panel">
        <div className="cabecera">
          <div>
            <h2>Asistencia y tardanzas</h2>
            <p>Elige el periodo y consulta el detalle de cada docente.</p>
          </div>
          <button
            className="secundario"
            disabled={exportando || cargando || Boolean(error) || desde > hasta}
            onClick={exportar}
          >
            <Download size={16} />
            {exportando ? "Exportando…" : "Exportar periodo"}
          </button>
        </div>
        <div className="periodo-preplanilla">
          <div className="filtro-etiquetado">
            <span>Consultar por</span>
            <SelectorFiltro
              etiqueta="Tipo de periodo"
              valor={modo}
              alCambiar={(valor) => {
                cambiarModo(valor);
                if (valor === "mes") seleccionarMes(desde.slice(0, 7));
              }}
              opciones={[
                { valor: "mes", texto: "Mes" },
                { valor: "rango", texto: "Rango personalizado" },
              ]}
            />
          </div>
          {modo === "mes" ? (
            <SelectorFecha
              etiqueta="Mes de consulta"
              modo="mes"
              valor={desde.slice(0, 7)}
              alCambiar={seleccionarMes}
            />
          ) : (
            <>
              <SelectorFecha
                etiqueta="Desde"
                valor={desde}
                alCambiar={cambiarDesde}
              />
              <SelectorFecha
                etiqueta="Hasta"
                valor={hasta}
                alCambiar={cambiarHasta}
              />
            </>
          )}
        </div>
        {desde > hasta && (
          <p role="alert" className="error">
            La fecha inicial no puede ser posterior a la final.
          </p>
        )}
      </section>
      <div
        className="metricas resumen-preplanilla"
        aria-label="Resumen del periodo"
        aria-busy={cargando}
      >
        {[
          ["Docentes", filas.length],
          ["Tardanza acumulada", `${total("minutos_tardanza")} min`],
          ["Días con tardanza", total("dias_tardanza")],
          ["Docentes con observaciones", filas.filter(pendiente).length],
        ].map(([titulo, valor], indice) => {
          const Icono = iconosResumen[indice];
          return (
            <article key={titulo} data-tono={tonosResumen[indice]}>
              <span className="titulo-indicador-docente">
                <Icono size={18} aria-hidden="true" />
                {titulo}
              </span>
              <strong>{cargando ? "—" : valor}</strong>
            </article>
          );
        })}
      </div>
      <section className="panel">
        <div className="cabecera">
          <h2>Detalle por docente</h2>
          <span className="nota">Ordenado por minutos de tardanza</span>
        </div>
        <div className="filtros">
          <label className="buscador">
            <Search size={18} />
            <input
              aria-label="Buscar docente"
              placeholder="Buscar docente"
              value={buscar}
              onChange={(evento) => cambiarBuscar(evento.target.value)}
            />
          </label>
          <SelectorFiltro
            etiqueta="Observaciones de docentes"
            valor={filtro}
            alCambiar={cambiarFiltro}
            opciones={[
              { valor: "", texto: "Todos los docentes" },
              { valor: "pendientes", texto: "Con observaciones" },
            ]}
          />
        </div>
        {!cargando && !error && (
          <Tabla
            titulo="Resumen de preplanilla por docente"
            filas={visibles}
            clave="persona_id"
            columnas={[
              {
                titulo: "Docente",
                mostrar: (fila) => (
                  <button
                    className="enlace"
                    onClick={() => cambiarDocente(fila)}
                  >
                    {fila.nombre}
                    <small>Ver detalle del periodo</small>
                  </button>
                ),
              },
              {
                titulo: "Tardanza",
                mostrar: (fila) => (
                  <span
                    className={`minutos-docente ${fila.minutos_tardanza ? "con-tardanza" : "sin-tardanza"}`}
                  >
                    {fila.minutos_tardanza} min
                  </span>
                ),
              },
              {
                titulo: "Días tarde",
                mostrar: (fila) => fila.dias_tardanza ?? "—",
              },
              {
                titulo: "Observaciones",
                mostrar: (fila) => (
                  <>
                    {fila.faltas > 0 && (
                      <span className="observacion-docente falta-docente">
                        {fila.faltas} inasistencias
                      </span>
                    )}
                    {fila.dias_incompletos > 0 && (
                      <span className="observacion-docente salida-docente">
                        {fila.dias_incompletos} sin salida
                      </span>
                    )}
                    {!pendiente(fila)
                      ? "Sin observaciones"
                      : fila.faltas === 0 && fila.dias_incompletos === 0
                        ? "Tardanzas"
                        : null}
                  </>
                ),
              },
              {
                titulo: "Programadas / registradas",
                mostrar: (fila) =>
                  `${fila.horas_programadas} h / ${fila.horas_permanencia} h`,
              },
            ]}
          />
        )}
        <p className="nota">
          Las justificaciones aprobadas se reflejan en los resultados. Las
          estimaciones se consultan en el detalle; no se aplican descuentos
          automáticos. La exportación incluye a todos los docentes del periodo.
        </p>
      </section>
      {docente && (
        <DetalleDocente
          docente={docente}
          desde={desde}
          hasta={hasta}
          revision={revision}
          cerrar={() => cambiarDocente(null)}
        />
      )}
    </div>
  );
}
