import { useState, type FormEvent } from "react";
import { Search, FileCheck2, Clock3, UserRoundX, Send } from "lucide-react";
import {
  Dialogo,
  Estado,
  Insignia,
  Tabla,
  Vacio,
  useDatos,
  type Registro,
} from "./componentesGestion";
import { SelectorFecha } from "./SelectorFecha";
import { SelectorFiltro } from "./SelectorFiltro";
import { consultar, horaLocal } from "./servicio";
import "./Justificaciones.css";
const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const fechaBreve = (fecha: string) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(fecha + "T12:00:00Z"));
const estados: Record<string, string> = {
  sin_justificar: "Sin justificar",
  pendiente: "Pendiente de revisión",
  aprobada: "Aprobada",
  observada: "Observada",
};
function JustificarIncidencia({
  fila,
  administrador,
  cerrar,
  guardado,
}: {
  fila: Registro;
  administrador: boolean;
  cerrar: () => void;
  guardado: (mensaje: string) => void;
}) {
  const solicitud = fila.solicitud;
  const [motivo, cambiarMotivo] = useState(""),
    [referencia, cambiarReferencia] = useState(""),
    [decision, cambiarDecision] = useState("aprobada"),
    [observacion, cambiarObservacion] = useState("");
  const [ocupado, cambiarOcupado] = useState(false),
    [error, cambiarError] = useState("");
  const registrar = administrador && (!solicitud || solicitud.estado === "observada");
  const revisar = solicitud?.estado === "pendiente" && administrador;
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    cambiarOcupado(true);
    cambiarError("");
    try {
      const ruta = revisar
        ? `/api/gestion/justificaciones/${solicitud.id}/resolver`
        : "/api/gestion/justificaciones";
      const datos = revisar
        ? { estado: decision, observacion: observacion.trim() }
        : {
            persona_id: fila.persona_id,
            fecha: fila.fecha,
            tipo: fila.tipo,
            motivo: motivo.trim(),
            referencia: referencia.trim() || null,
          };
      const respuesta = await consultar(ruta, {
        method: "POST",
        body: JSON.stringify(datos),
      });
      guardado(respuesta.mensaje);
      cerrar();
    } catch (problema) {
      cambiarError((problema as Error).message);
    } finally {
      cambiarOcupado(false);
    }
  }
  return (
    <Dialogo
      titulo={
        registrar ? "Justificar incidencia" : "Detalle de la justificación"
      }
      cerrar={cerrar}
      bloqueado={ocupado}
      clase="dialogo-justificacion"
    >
      <form className="formulario-justificacion" onSubmit={guardar}>
        <div className="contexto-incidencia">
          <strong>{fila.nombre}</strong>
          <span>
            {fila.codigo} · {fila.rol}
          </span>
          <div>
            <Insignia texto={fila.tipo === "tardanza" ? "Tardanza" : "Falta"} />
            <span>
              {fechaBreve(fila.fecha)}
              {fila.tipo === "tardanza"
                ? ` · ${fila.minutos_tardanza} min`
                : ""}
            </span>
          </div>
        </div>
        {solicitud && (
          <div className="sustento-incidencia">
            <Insignia texto={estados[solicitud.estado]} />
            <h3>Motivo registrado</h3>
            <p>{solicitud.motivo}</p>
            {solicitud.referencia && <p>Documento: {solicitud.referencia}</p>}
            {solicitud.observacion && <p>Revisión: {solicitud.observacion}</p>}
          </div>
        )}
        <fieldset disabled={ocupado}>
          {registrar && (
            <>
              <label>
                Motivo de la justificación
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={4}
                  value={motivo}
                  onChange={(evento) => cambiarMotivo(evento.target.value)}
                  placeholder="Describe el motivo de la tardanza o inasistencia."
                />
              </label>
              <label>
                Documento de sustento <span className="nota">(opcional)</span>
                <input
                  maxLength={200}
                  value={referencia}
                  onChange={(evento) => cambiarReferencia(evento.target.value)}
                  placeholder="Número de constancia, expediente o documento"
                />
              </label>
              <p className="nota">Al guardar, la incidencia quedará justificada directamente.</p>
            </>
          )}
          {revisar && (
            <>
              <div className="filtro-etiquetado">
                <span>Decisión</span>
                <SelectorFiltro
                  etiqueta="Decisión de la justificación"
                  valor={decision}
                  alCambiar={cambiarDecision}
                  opciones={[
                    { valor: "aprobada", texto: "Aprobar" },
                    { valor: "observada", texto: "Observar" },
                  ]}
                />
              </div>
              <label>
                Motivo de la revisión
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  value={observacion}
                  onChange={(evento) => cambiarObservacion(evento.target.value)}
                />
              </label>
            </>
          )}
        </fieldset>
        {solicitud?.estado === "pendiente" && !administrador && (
          <p className="nota">La revisión corresponde a un administrador.</p>
        )}
        {error && (
          <p className="aviso error" role="alert">
            {error}
          </p>
        )}
        <footer className="acciones-dialogo">
          <button
            type="button"
            className="secundario"
            disabled={ocupado}
            onClick={cerrar}
          >
            {registrar || revisar ? "Cancelar" : "Cerrar"}
          </button>
          {(registrar || revisar) && (
            <button disabled={ocupado}>
              <Send size={16} />
              {ocupado ? "Guardando…" : revisar ? "Guardar revisión" : "Justificar incidencia"}
            </button>
          )}
        </footer>
      </form>
    </Dialogo>
  );
}
export function Justificaciones({
  administrador,
  revision,
  guardado,
}: {
  administrador: boolean;
  revision: number;
  guardado: (mensaje: string) => void;
}) {
  const hoy = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Lima",
  }).format(new Date());
  const [desde, cambiarDesde] = useState(hoy.slice(0, 7) + "-01"),
    [hasta, cambiarHasta] = useState(hoy);
  const [buscar, cambiarBuscar] = useState(""),
    [estado, cambiarEstado] = useState(""),
    [tipo, cambiarTipo] = useState(""),
    [seleccion, cambiarSeleccion] = useState<Registro | null>(null);
  const valido =
    desde <= hasta && (Date.parse(hasta) - Date.parse(desde)) / 86400000 <= 61;
  const { datos, error, cargando } = useDatos(
    valido ? `/api/gestion/incidencias?desde=${desde}&hasta=${hasta}` : null,
    revision,
    30000,
    !seleccion,
  );
  const filas: Registro[] = Array.isArray(datos) ? datos : [];
  const visibles = filas.filter(
    (fila) =>
      (!buscar ||
        normalizar(`${fila.nombre} ${fila.codigo}`).includes(
          normalizar(buscar),
        )) &&
      (!estado || fila.estado_justificacion === estado) &&
      (!tipo || fila.tipo === tipo),
  );
  const resumen = [
    [
      "Sin justificar",
      filas.filter((fila) => fila.estado_justificacion === "sin_justificar")
        .length,
      Clock3,
    ],
    [
      "Pendientes de revisión",
      filas.filter((fila) => fila.estado_justificacion === "pendiente").length,
      FileCheck2,
    ],
    [
      "Inasistencias",
      filas.filter((fila) => fila.tipo === "falta").length,
      UserRoundX,
    ],
  ] as const;
  return (
    <div className="justificaciones">
      <section className="panel">
        <div className="cabecera">
          <div>
            <h2>Incidencias de asistencia</h2>
            <p>
              Las tardanzas y faltas aparecen automáticamente según el horario y
              las reglas de ingreso.
            </p>
          </div>
        </div>
        <div className="periodo-incidencias">
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
        </div>
        {!valido && (
          <p role="alert" className="error">
            Selecciona un intervalo válido de hasta 62 días.
          </p>
        )}
        <div className="filtros">
          <label className="buscador">
            <Search size={18} />
            <input
              aria-label="Buscar incidencia por nombre o ID"
              placeholder="Buscar por nombre o ID"
              value={buscar}
              onChange={(evento) => cambiarBuscar(evento.target.value)}
            />
          </label>
          <SelectorFiltro
            etiqueta="Tipo de incidencia"
            valor={tipo}
            alCambiar={cambiarTipo}
            opciones={[
              { valor: "", texto: "Todos los tipos" },
              { valor: "tardanza", texto: "Tardanzas" },
              { valor: "falta", texto: "Inasistencias" },
            ]}
          />
          <SelectorFiltro
            etiqueta="Estado de la justificación"
            valor={estado}
            alCambiar={cambiarEstado}
            opciones={[
              { valor: "", texto: "Todos los estados" },
              ...Object.entries(estados).map(([valor, texto]) => ({
                valor,
                texto,
              })),
            ]}
          />
          {(buscar || estado || tipo) && (
            <button
              className="boton-texto"
              onClick={() => {
                cambiarBuscar("");
                cambiarEstado("");
                cambiarTipo("");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <Estado error={error} cargando={cargando} />
      </section>
      <div className="resumen-incidencias">
        {resumen.map(([titulo, cantidad, Icono]) => (
          <article key={titulo}>
            <Icono size={21} aria-hidden="true" />
            <div>
              <span>{titulo}</span>
              <strong>{cargando || error || !valido ? "—" : cantidad}</strong>
            </div>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="cabecera">
          <h2>Registros del periodo</h2>
          <span className="nota">{visibles.length} incidencias</span>
        </div>
        {!cargando &&
          !error &&
          valido &&
          (visibles.length ? (
            <Tabla
              titulo="Incidencias del periodo"
              filas={visibles.map((fila) => ({
                ...fila,
                clave: `${fila.persona_id}-${fila.fecha}-${fila.tipo}`,
              }))}
              clave="clave"
              columnas={[
                {
                  titulo: "Persona",
                  mostrar: (fila) => (
                    <button
                      className="enlace"
                      onClick={() => cambiarSeleccion(fila)}
                    >
                      {fila.nombre}
                      <small>
                        {fila.codigo} · {fila.rol}
                      </small>
                    </button>
                  ),
                },
                { titulo: "Fecha", mostrar: (fila) => fechaBreve(fila.fecha) },
                {
                  titulo: "Incidencia",
                  mostrar: (fila) => (
                    <>
                      <Insignia
                        texto={fila.tipo === "falta" ? "Falta" : "Tardanza"}
                      />
                      {fila.tipo === "tardanza" && (
                        <small>
                          {fila.minutos_tardanza} min · Entrada{" "}
                          {fila.entrada ? horaLocal(fila.entrada) : "—"}
                        </small>
                      )}
                    </>
                  ),
                },
                {
                  titulo: "Justificación",
                  mostrar: (fila) => (
                    <Insignia texto={estados[fila.estado_justificacion]} />
                  ),
                },
                {
                  titulo: "Acción",
                  mostrar: (fila) => administrador || fila.solicitud ? (
                    <button
                      className="boton-texto"
                      onClick={() => cambiarSeleccion(fila)}
                    >
                      {administrador && (!fila.solicitud || fila.solicitud.estado === "observada")
                        ? "Justificar"
                        : fila.solicitud?.estado === "pendiente" && administrador
                          ? "Revisar"
                          : "Ver detalle"}
                    </button>
                  ) : "—",
                },
              ]}
            />
          ) : (
            <Vacio
              titulo="No hay incidencias para esta consulta."
              detalle="Las tardanzas requieren un horario asignado. Las faltas aparecen al superar el límite sin registrar entrada. Puedes cambiar el periodo o limpiar los filtros."
            />
          ))}
        <p className="nota">
          {administrador
            ? "Selecciona una persona para justificar ese día. Una vez vencido el plazo de ingreso, el QR no registra una entrada tardía. Solo las justificaciones aprobadas modifican el resultado del reporte."
            : "Consulta las tardanzas, faltas y justificaciones registradas. Solo administración puede justificarlas."}
        </p>
      </section>
      {seleccion && (
        <JustificarIncidencia
          fila={seleccion}
          administrador={administrador}
          cerrar={() => cambiarSeleccion(null)}
          guardado={guardado}
        />
      )}
    </div>
  );
}
