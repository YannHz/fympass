import { useState } from "react";
import { Download, Search } from "lucide-react";
import {
  Estado,
  Insignia,
  Tabla,
  Vacio,
  useDatos,
  type Registro,
} from "./componentesGestion";
import { SelectorFecha } from "./SelectorFecha";
import { SelectorFiltro } from "./SelectorFiltro";
import { solicitar, horaLocal } from "./servicio";
import "./ReportesAsistencia.css";

function hoyLima() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(
    new Date(),
  );
}
function inicioSemana(hoy: string) {
  const fecha = new Date(hoy + "T12:00:00Z");
  fecha.setUTCDate(fecha.getUTCDate() - ((fecha.getUTCDay() + 6) % 7));
  return fecha.toISOString().slice(0, 10);
}
function fechaBreve(fecha: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(fecha + "T12:00:00Z"));
}
export function ReportesAsistencia({
  catalogo,
  revision,
  abrirExpediente,
}: {
  catalogo: Registro;
  revision: number;
  abrirExpediente: (
    fila: Registro,
    periodo: { desde: string; hasta: string },
  ) => void;
}) {
  const hoy = hoyLima();
  const [desde, cambiarDesde] = useState(hoy.slice(0, 7) + "-01"),
    [hasta, cambiarHasta] = useState(hoy),
    [periodo, cambiarPeriodo] = useState("mes");
  const [buscar, cambiarBuscar] = useState(""),
    [rol, cambiarRol] = useState(""),
    [estado, cambiarEstado] = useState(""),
    [incluir, cambiarIncluir] = useState(false);
  const [exportando, cambiarExportando] = useState(false),
    [errorExportacion, cambiarErrorExportacion] = useState(""),
    [aviso, cambiarAviso] = useState("");
  const intervaloValido =
    desde <= hasta && (Date.parse(hasta) - Date.parse(desde)) / 86400000 <= 61;
  const { datos, error, cargando } = useDatos(
    intervaloValido
      ? `/api/gestion/diario?desde=${desde}&hasta=${hasta}`
      : null,
    revision,
  );
  const filas: Registro[] = Array.isArray(datos) ? datos : [];
  const visibles = filas
    .filter(
      (fila) =>
        (incluir || fila.estado !== "No programado") &&
        (!buscar ||
          `${fila.nombre} ${fila.codigo}`
            .toLowerCase()
            .includes(buscar.toLowerCase())) &&
        (!rol || fila.rol_codigo === rol) &&
        (!estado || fila.estado === estado),
    )
    .sort(
      (a, b) =>
        b.fecha.localeCompare(a.fecha) ||
        (b.entrada || "").localeCompare(a.entrada || "") ||
        b.persona_id - a.persona_id,
    );
  function seleccionarPeriodo(valor: string) {
    cambiarPeriodo(valor);
    if (valor !== "rango") {
      cambiarHasta(hoy);
      cambiarDesde(
        valor === "hoy"
          ? hoy
          : valor === "semana"
            ? inicioSemana(hoy)
            : hoy.slice(0, 7) + "-01",
      );
    }
  }
  function limpiar() {
    cambiarBuscar("");
    cambiarRol("");
    cambiarEstado("");
    cambiarIncluir(false);
  }
  async function exportar() {
    if (exportando || !intervaloValido) return;
    cambiarExportando(true);
    cambiarErrorExportacion("");
    cambiarAviso("");
    try {
      const parametros = new URLSearchParams({
        desde,
        hasta,
        tipo: "asistencia",
        buscar,
        rol,
        estado,
        incluir_no_programados: String(incluir),
      });
      const respuesta = await solicitar("/api/gestion/exportar?" + parametros, {
        signal: AbortSignal.timeout(60000),
      });
      const url = URL.createObjectURL(await respuesta.blob()),
        enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `FyM_Reportes_${desde}_${hasta}.xlsx`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      cambiarAviso("Excel preparado con todos los resultados filtrados.");
    } catch (problema) {
      cambiarErrorExportacion((problema as Error).message);
    } finally {
      cambiarExportando(false);
    }
  }
  const indicadores = [
    [
      "Ingresos registrados",
      visibles.filter((fila) => fila.entrada).length,
      "Presentes",
    ],
    [
      "Tardanzas",
      visibles.filter((fila) => fila.estado === "Tardanza").length,
      "Tardanzas",
    ],
    [
      "Inasistencias",
      visibles.filter((fila) => fila.estado === "Falta").length,
      "Inasistencias",
    ],
    [
      "Justificaciones",
      visibles.filter((fila) => fila.estado === "Justificado").length,
      "Por revisar",
    ],
  ];
  return (
    <div className="reportes-asistencia">
      <section className="panel">
        <div className="cabecera">
          <div>
            <h2>Consulta de asistencia</h2>
            <p>Historial de ingreso al instituto.</p>
          </div>
          <button
            className="secundario"
            onClick={() => void exportar()}
            disabled={
              exportando ||
              cargando ||
              Boolean(error) ||
              !intervaloValido ||
              !visibles.length
            }
          >
            <Download size={16} />
            {exportando
              ? "Exportando…"
              : `Exportar resultados (${visibles.length})`}
          </button>
        </div>
        <div className="periodos-reportes" aria-label="Periodo de consulta">
          {[
            ["hoy", "Hoy"],
            ["semana", "Esta semana"],
            ["mes", "Este mes"],
            ["rango", "Rango personalizado"],
          ].map(([valor, texto]) => (
            <button
              key={valor}
              className="secundario"
              aria-pressed={periodo === valor}
              onClick={() => seleccionarPeriodo(valor)}
            >
              {texto}
            </button>
          ))}
        </div>
        <div className="fechas-reportes">
          <SelectorFecha
            etiqueta="Desde"
            valor={desde}
            alCambiar={(valor) => {
              cambiarDesde(valor);
              cambiarPeriodo("rango");
            }}
          />
          <SelectorFecha
            etiqueta="Hasta"
            valor={hasta}
            alCambiar={(valor) => {
              cambiarHasta(valor);
              cambiarPeriodo("rango");
            }}
          />
        </div>
        {!intervaloValido && (
          <p role="alert" className="error">
            Selecciona un intervalo válido de hasta 62 días.
          </p>
        )}
        <div className="filtros filtros-reportes">
          <label className="buscador">
            <Search size={18} />
            <input
              aria-label="Buscar persona en reportes"
              placeholder="Buscar por nombre o ID"
              value={buscar}
              onChange={(evento) => cambiarBuscar(evento.target.value)}
            />
          </label>
          <SelectorFiltro
            etiqueta="Rol de la persona"
            valor={rol}
            alCambiar={(valor) => {
              cambiarRol(valor);
            }}
            opciones={[
              { valor: "", texto: "Todos los roles" },
              ...catalogo.roles.map((dato: Registro) => ({
                valor: dato.codigo,
                texto: dato.nombre,
              })),
            ]}
          />
          <SelectorFiltro
            etiqueta="Estado de asistencia"
            valor={estado}
            alCambiar={(valor) => {
              cambiarEstado(valor);
              if (valor === "No programado") cambiarIncluir(true);
            }}
            opciones={[
              { valor: "", texto: "Todos los estados" },
              ...[
                "Puntual",
                "Tardanza",
                "Falta",
                "Pendiente",
                "Justificado",
                ...(incluir ? ["No programado"] : []),
              ].map((valor) => ({ valor, texto: valor })),
            ]}
          />
        </div>
        <div className="opciones-reportes">
          <label>
            <input
              type="checkbox"
              checked={incluir}
              onChange={(evento) => {
                cambiarIncluir(evento.target.checked);
                if (!evento.target.checked && estado === "No programado")
                  cambiarEstado("");
              }}
            />
            Incluir días no programados
          </label>
          {(buscar ||
            rol ||
            estado ||
            incluir) && (
            <button className="boton-texto" onClick={limpiar}>
              Limpiar filtros
            </button>
          )}
        </div>
        <Estado error={error || errorExportacion} cargando={cargando} />
        {aviso && (
          <p role="status" className="nota">
            {aviso}
          </p>
        )}
      </section>
      <div
        className="metricas resumen-reportes"
        aria-label="Resumen de registros filtrados"
      >
        {indicadores.map(([titulo, valor, indicador]) => (
          <article key={titulo} data-indicador={indicador}>
            <span>{titulo}</span>
            <strong>
              {cargando || !intervaloValido || error ? "—" : valor}
            </strong>
            <small>Registros del periodo</small>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="cabecera">
          <h2>Resultados</h2>
          <span className="nota">
            {visibles.length} registros · Más recientes primero
          </span>
        </div>
        {!cargando &&
          !error &&
          intervaloValido &&
          (visibles.length ? (
            <Tabla
              titulo="Resultados del reporte de asistencia"
              filas={visibles}
              clave="persona_id"
              columnas={[
                {
                  titulo: "Persona",
                  mostrar: (fila) => (
                    <button
                      className="enlace"
                      onClick={() => abrirExpediente(fila, { desde, hasta })}
                    >
                      {fila.nombre}
                      <small>{fila.codigo}</small>
                    </button>
                  ),
                },
                {
                  titulo: "Rol",
                  mostrar: (fila) => (
                    fila.rol
                  ),
                },
                { titulo: "Fecha", mostrar: (fila) => fechaBreve(fila.fecha) },
                {
                  titulo: "Entrada",
                  mostrar: (fila) =>
                    fila.entrada ? horaLocal(fila.entrada) : "—",
                },
                {
                  titulo: "Salida",
                  mostrar: (fila) =>
                    fila.requiere_salida
                      ? fila.salida
                        ? horaLocal(fila.salida)
                        : "—"
                      : "No aplica",
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
          ) : (
            <Vacio
              titulo="No hay resultados para esta consulta."
              detalle="Cambia el periodo o limpia los filtros para consultar otros registros."
            />
          ))}
        <p className="nota">
          El resumen cuenta registros por persona y día, no personas únicas. Las
          ausencias se calculan cuando existe horario y termina el margen
          configurado. Los días no lectivos no generan faltas.
        </p>
      </section>
    </div>
  );
}
