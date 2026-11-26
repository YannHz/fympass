import { Justificaciones } from "./Justificaciones";
import { HorariosLaborales } from "./HorariosLaborales";
import { PersonasCarnets } from "./PersonasCarnets";
import { ToleranciasReglas } from "./ToleranciasReglas";
import { ReportesAsistencia } from "./ReportesAsistencia";
import { PreplanillaDocente } from "./PreplanillaDocente";
import { MenuCuenta } from "./MenuCuenta";
import { RegistroManual } from "./RegistroManual";
import { SelectorFecha } from "./SelectorFecha";
import { SelectorFiltro } from "./SelectorFiltro";
import { EstadoJornada } from "./EstadoJornada";
import { LogoInstitucional } from "./LogoInstitucional";
import {
  Estado,
  Insignia,
  Tabla,
  Dialogo,
  Vacio,
  useDatos,
  type Registro,
} from "./componentesGestion";
import { FormularioGestion, type Formulario } from "./FormularioGestion";
import { solicitar } from "./servicio";
import { InstalarAplicacion } from "./InstalarAplicacion";
import { DiagnosticoConexion } from "./DiagnosticoConexion";
import { SelectorTema } from "./SelectorTema";
import { cambiarConTransicion } from "./transiciones";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  QrCode,
  CalendarDays,
  PenLine,
  BarChart3,
  BadgeDollarSign,
  FileCheck2,
  Users,
  Settings2,
  LogOut,
  X,
  Search,
  Download,
  ChevronRight,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { horaLocal } from "./servicio";
import { ControlAsistencia } from "./ControlAsistencia";
import { AvatarPersona } from "./ConfirmacionMarcado";
type Sesion = {
  nombre: string;
  iniciales: string;
  usuario: string;
  permiso: string;
  sede: string;
};
type Seccion =
  | "inicio"
  | "dispositivos"
  | "diario"
  | "manual"
  | "reportes"
  | "preplanilla"
  | "justificaciones"
  | "personas"
  | "horarios"
  | "reglas";
const navegacion: {
  id: Seccion;
  titulo: string;
  icono: typeof Users;
  grupo: string;
  administrador?: boolean;
  descripcion: string;
}[] = [
  {
    id: "horarios",
    titulo: "Horarios laborales",
    icono: CalendarDays,
    grupo: "Instituto",
    descripcion: "Organiza la entrada y salida del personal.",
  },
  {
    id: "inicio",
    titulo: "Resumen",
    icono: LayoutDashboard,
    grupo: "Jornada",
    descripcion: "Una mirada a la asistencia de tu sede.",
  },
  {
    id: "dispositivos",
    titulo: "Puesto de asistencia",
    icono: QrCode,
    grupo: "Jornada",
    descripcion: "Abre el punto de ingreso y configura el marcado QR.",
  },
  {
    id: "diario",
    titulo: "Asistencia diaria",
    icono: CalendarDays,
    grupo: "Jornada",
    descripcion:
      "Ingresos y salidas registrados en la jornada, actualizados automáticamente.",
  },
  {
    id: "manual",
    titulo: "Registro manual",
    icono: PenLine,
    grupo: "Jornada",
    descripcion:
      "Registra el ingreso del personal cuando no puede utilizar su QR.",
  },
  {
    id: "reportes",
    titulo: "Reportes",
    icono: BarChart3,
    grupo: "Gestión",
    descripcion: "Consulta periodos y exporta los resultados.",
  },
  {
    id: "preplanilla",
    titulo: "Preplanilla docente",
    icono: BadgeDollarSign,
    grupo: "Gestión",
    administrador: true,
    descripcion:
      "Revisa las tardanzas y la asistencia de los docentes por periodo.",
  },
  {
    id: "justificaciones",
    titulo: "Justificaciones",
    icono: FileCheck2,
    grupo: "Gestión",
    descripcion: "Busca tardanzas e inasistencias y registra su justificación.",
  },
  {
    id: "personas",
    titulo: "Personas y carnets",
    icono: Users,
    grupo: "Instituto",
    descripcion: "Docentes y personal administrativo de la institución.",
  },
  {
    id: "reglas",
    titulo: "Tolerancias y reglas",
    icono: Settings2,
    grupo: "Instituto",
    administrador: true,
    descripcion: "Tolerancias por rol y calendario institucional.",
  },
];
const dias = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
function hoyLima() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((tipo) => partes.find((parte) => parte.type === tipo)?.value)
    .join("-");
}
function fechaCorta(fecha: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Lima",
  }).format(new Date(fecha + "T12:00:00-05:00"));
}
function Expediente({
  persona,
  fecha,
  revision,
  cerrar,
  justificar,
  administrador,
  periodoConsulta,
  vistaInicial = "calendario",
}: {
  persona: Registro;
  vistaInicial?: string;
  periodoConsulta?: { desde: string; hasta: string };
  fecha: string;
  revision: number;
  cerrar: () => void;
  justificar: (fecha: string, tipo: string) => void;
  administrador: boolean;
}) {
  const [pestana, establecerPestana] = useState(vistaInicial),
    [seleccion, establecerSeleccion] = useState<Registro | null>(null);
  const inicio = periodoConsulta?.desde || fecha.slice(0, 7) + "-01",
    fin =
      periodoConsulta?.hasta ||
      new Date(
        Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)), 0),
      )
        .toISOString()
        .slice(0, 10);
  const { datos, error, cargando } = useDatos(
    `/api/gestion/personas/${persona.id}/expediente?desde=${inicio}&hasta=${fin}`,
    revision,
  );
  return (
    <Dialogo
      titulo={`Expediente de ${persona.nombre}`}
      cerrar={cerrar}
      clase="expediente"
    >
      <Estado error={error} cargando={cargando} />
      {datos && (
        <>
          <div className="resumen-persona">
            <AvatarPersona persona={datos.persona} />
            <div>
              <h3>{datos.persona.nombre}</h3>
              <p>
                {datos.persona.rol} · {datos.persona.codigo}
              </p>
              <Insignia
                texto={`${datos.alerta} · ${datos.porcentaje_faltas}% de faltas`}
              />
            </div>
          </div>
          <div
            className="pestanas"
            role="tablist"
            aria-label="Secciones del expediente"
          >
            {["calendario", "carne", "horario"].map(
              (opcion, indice, opciones) => (
                <button
                  key={opcion}
                  role="tab"
                  id={`pestana-${opcion}`}
                  aria-controls={`panel-${opcion}`}
                  aria-selected={pestana === opcion}
                  tabIndex={pestana === opcion ? 0 : -1}
                  onKeyDown={(evento) => {
                    if (["ArrowRight", "ArrowLeft"].includes(evento.key)) {
                      evento.preventDefault();
                      const siguiente =
                        opciones[
                          (indice +
                            (evento.key === "ArrowRight"
                              ? 1
                              : opciones.length - 1)) %
                            opciones.length
                        ];
                      establecerPestana(siguiente);
                      (
                        evento.currentTarget.parentElement?.children[
                          opciones.indexOf(siguiente)
                        ] as HTMLElement
                      ).focus();
                    }
                  }}
                  onClick={() => establecerPestana(opcion)}
                >
                  {opcion === "carne"
                    ? "Carnet virtual"
                    : opcion === "calendario"
                      ? "Calendario"
                      : "Horario"}
                </button>
              ),
            )}
          </div>
          <div
            className="contenido-expediente"
            role="tabpanel"
            id={`panel-${pestana}`}
            aria-labelledby={`pestana-${pestana}`}
            key={pestana}
          >
            {pestana === "calendario" && periodoConsulta && (
              <>
                <p className="nota">
                  Periodo consultado: {fechaCorta(inicio)} al {fechaCorta(fin)}
                </p>
                <Tabla
                  titulo="Asistencia de la persona"
                  filas={datos.calendario}
                  clave="fecha"
                  columnas={[
                    {
                      titulo: "Fecha",
                      mostrar: (fila) => fechaCorta(fila.fecha),
                    },
                    {
                      titulo: "Entrada",
                      mostrar: (fila) =>
                        fila.entrada ? horaLocal(fila.entrada) : "—",
                    },
                    {
                      titulo: "Salida",
                      mostrar: (fila) =>
                        fila.salida ? horaLocal(fila.salida) : "—",
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
              </>
            )}
            {pestana === "calendario" && !periodoConsulta && (
              <>
                <p className="nota">
                  Asistencia de ingreso al instituto. Los indicadores no
                  determinan asistencia a clases ni sanciones académicas.
                </p>
                {seleccion && (
                  <div className="detalle-dia">
                    <h3>{fechaCorta(seleccion.fecha)}</h3>
                    <p>
                      {seleccion.estado} · Entrada{" "}
                      {seleccion.entrada ? horaLocal(seleccion.entrada) : "—"} ·
                      Salida{" "}
                      {seleccion.salida ? horaLocal(seleccion.salida) : "—"}
                    </p>
                    {administrador && (
                      <button
                        className="secundario"
                        onClick={() =>
                          justificar(
                            seleccion.fecha,
                            seleccion.estado === "Tardanza"
                              ? "tardanza"
                              : "falta",
                          )
                        }
                      >
                        Registrar justificación
                      </button>
                    )}
                  </div>
                )}
                <div className="calendario">
                  {dias.map((dia) => (
                    <span className="dia-semana" key={dia}>
                      {dia.slice(0, 3)}
                    </span>
                  ))}
                  {datos.calendario.map((fila: Registro, indice: number) => (
                    <button
                      key={fila.fecha}
                      className={`dia-calendario ${fila.estado === "Falta" ? "falta" : fila.estado === "Tardanza" ? "tarde" : fila.entrada ? "presente" : ""}`}
                      style={
                        indice === 0
                          ? {
                              gridColumnStart:
                                ((new Date(
                                  fila.fecha + "T12:00:00Z",
                                ).getUTCDay() +
                                  6) %
                                  7) +
                                1,
                            }
                          : undefined
                      }
                      onClick={() => establecerSeleccion(fila)}
                    >
                      <strong>{Number(fila.fecha.slice(-2))}</strong>
                      <span>{fila.estado}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {pestana === "carne" && (
              <div className="carne">
                <div className="cabecera-carne">
                  <span className="marca-carne">
                    <LogoInstitucional decorativo />
                    <strong>FyM Pass</strong>
                  </span>
                  <span>{datos.persona.sede}</span>
                </div>
                <AvatarPersona persona={datos.persona} />
                <h3>{datos.persona.nombre}</h3>
                <p>
                  {datos.persona.rol} · {datos.persona.codigo}
                </p>
                <div className="qr-carne">
                  <QRCodeSVG
                    value={datos.persona.qr}
                    size={230}
                    marginSize={4}
                  />
                </div>
                <small>Identificación institucional</small>
              </div>
            )}
            {pestana === "horario" && (
              <Tabla
                titulo="Horario de la persona"
                filas={datos.tramos}
                columnas={[
                  { titulo: "Día", mostrar: (fila) => dias[fila.dia_semana] },
                  {
                    titulo: "Entrada",
                    mostrar: (fila) => fila.hora_entrada.slice(0, 5),
                  },
                  {
                    titulo: "Salida",
                    mostrar: (fila) => fila.hora_salida?.slice(0, 5) || "—",
                  },
                ]}
              />
            )}
          </div>
        </>
      )}
    </Dialogo>
  );
}
export function PanelAdministrativo({
  usuario,
  alCerrar,
  cerrando,
  errorSesion,
}: {
  usuario: Sesion;
  alCerrar: () => void;
  cerrando: boolean;
  errorSesion?: string;
}) {
  const administrador = usuario.permiso === "administrador";
  const opciones = navegacion.filter(
    (opcion) => !opcion.administrador || administrador,
  );
  const [seccion, establecerSeccion] = useState<Seccion>(
    () =>
      opciones.find((opcion) => opcion.id === location.hash.slice(1))?.id ||
      "inicio",
  );
  const [fecha, establecerFecha] = useState(hoyLima()),
    [desde, establecerDesde] = useState(hoyLima().slice(0, 7) + "-01"),
    [hasta, establecerHasta] = useState(hoyLima());
  const jornadaActual = useRef(hoyLima());
  useEffect(() => {
    const comprobarJornada = () => {
      const nueva = hoyLima(),
        anterior = jornadaActual.current;
      if (nueva === anterior) return;
      jornadaActual.current = nueva;
      establecerFecha((valor) => (valor === anterior ? nueva : valor));
    };
    const intervalo = setInterval(comprobarJornada, 1000);
    window.addEventListener("focus", comprobarJornada);
    document.addEventListener("visibilitychange", comprobarJornada);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("focus", comprobarJornada);
      document.removeEventListener("visibilitychange", comprobarJornada);
    };
  }, []);
  const [vistaExpediente, establecerVistaExpediente] = useState("calendario");
  const [periodoExpediente, establecerPeriodoExpediente] = useState<
    { desde: string; hasta: string } | undefined
  >();
  const [grupoAbierto, establecerGrupoAbierto] = useState<string | null>(null);
  const [exportando, establecerExportando] = useState(false);
  const [revision, establecerRevision] = useState(0),
    [formulario, establecerFormulario] = useState<Formulario | null>(null),
    [expediente, establecerExpediente] = useState<Registro | null>(null);
  const [buscar, establecerBuscar] = useState(""),
    [rol, establecerRol] = useState(""),
    [estado, establecerEstado] = useState(""),
    [aviso, establecerAviso] = useState(""),
    [errorAccion, establecerErrorAccion] = useState("");
  useEffect(() => {
    const renovar = () => {
      establecerRevision((valor) => valor + 1);
      establecerErrorAccion("");
    };
    window.addEventListener("fym-sesion-renovada", renovar);
    return () => window.removeEventListener("fym-sesion-renovada", renovar);
  }, []);
  const {
    datos: catalogo,
    error: errorCatalogo,
    cargando: cargandoCatalogo,
  } = useDatos("/api/gestion/catalogo", revision);
  const ruta =
    seccion === "inicio"
      ? `/api/gestion/resumen?fecha=${fecha}`
      : seccion === "diario"
        ? `/api/gestion/diario?desde=${fecha}&hasta=${fecha}&solo_marcados=true`
        : seccion === "preplanilla"
          ? `/api/gestion/preplanilla?desde=${desde}&hasta=${hasta}`
          : null;
  const { datos, error, cargando } = useDatos(
    ruta,
    revision,
    0,
    ["diario", "inicio"].includes(seccion) && !grupoAbierto,
  );
  const encabezado =
    opciones.find((opcion) => opcion.id === seccion) || opciones[0];
  useEffect(() => {
    const sincronizar = () => {
      const destino = decodeURIComponent(location.hash.slice(1));
      const grupo = destino.startsWith("grupo-") ? destino.slice(6) : null;
      if (grupo && ["Jornada", "Gestión", "Instituto"].includes(grupo))
        establecerGrupoAbierto(grupo);
      else {
        establecerGrupoAbierto(null);
        establecerSeccion(
          opciones.find((valor) => valor.id === destino)?.id || "inicio",
        );
      }
      establecerBuscar("");
      establecerRol("");
      establecerEstado("");
      establecerErrorAccion("");
      establecerAviso("");
    };
    sincronizar();
    window.addEventListener("popstate", sincronizar);
    window.addEventListener("hashchange", sincronizar);
    return () => {
      window.removeEventListener("popstate", sincronizar);
      window.removeEventListener("hashchange", sincronizar);
    };
  }, [usuario.permiso]);
  function navegar(destino: Seccion) {
    cambiarConTransicion(() => {
      establecerGrupoAbierto(null);
      establecerSeccion(destino);
      window.scrollTo(0, 0);
      if (location.hash !== "#" + destino)
        window.history.pushState(
          null,
          "",
          `${window.location.pathname}#${destino}`,
        );
      establecerBuscar("");
      establecerRol("");
      establecerEstado("");

      establecerAviso("");
      establecerErrorAccion("");
    });
  }
  function abrirGrupo(grupo: string) {
    cambiarConTransicion(() => {
      establecerGrupoAbierto(grupo);
      if (decodeURIComponent(location.hash.slice(1)) !== "grupo-" + grupo)
        window.history.pushState(
          null,
          "",
          "#grupo-" + encodeURIComponent(grupo),
        );
      window.scrollTo(0, 0);
    });
  }
  const destinoActivo =
    grupoAbierto || (seccion === "inicio" ? "Resumen" : encabezado.grupo);
  const destinosMoviles = [
    { titulo: "Resumen", icono: LayoutDashboard },
    { titulo: "Jornada", icono: CalendarDays },
    { titulo: "Gestión", icono: BarChart3 },
    { titulo: "Instituto", icono: Users },
  ];
  function guardado(mensaje: string) {
    establecerAviso(mensaje);
    establecerRevision((valor) => valor + 1);
  }
  const personas = (catalogo?.personas || []) as Registro[];
  const seleccionPersonas = [
    { valor: "", texto: "Selecciona una persona" },
    ...personas
      .filter((persona) => persona.activa)
      .map((persona) => ({
        valor: persona.id,
        texto: `${persona.nombre} · ${persona.codigo}`,
      })),
  ];
  function nuevaPersona(persona?: Registro) {
    establecerFormulario({
      titulo: persona ? "Editar persona y cuenta" : "Registrar persona",
      accion: persona ? "Guardar cambios" : "Registrar persona",
      ruta: "/api/gestion/personas",
      aviso:
        "El ID y la cuenta se generan automáticamente. La contraseña inicial se cambia en el primer ingreso.",
      actualizar: (valores) => {
        const rol = catalogo.roles.find(
          (r: Registro) => r.id === Number(valores.rol_id),
        );
        return {
          ...valores,
          codigo: /^[0-9]{8}$/.test(valores.documento || "")
            ? `${rol?.codigo === "docente" ? "DOC" : "ADM"}-${valores.documento}`
            : persona?.codigo || "",
          permiso: rol?.codigo === "docente" ? "personal" : valores.permiso,
        };
      },
      datos: {
        codigo: "",
        nombres: "",
        apellidos: "",
        documento: "",
        rol_id: catalogo.roles[0].id,
        grupo_id: null,
        activa: true,
        permiso: "personal",
        tarifa_hora: 0,
        ...persona,
        clave: "",
      },
      campos: [
        {
          nombre: "documento",
          etiqueta: "DNI",
          requerido: !persona,
          longitudMinima: 8,
          longitudMaxima: 8,
          patron: "[0-9]{8}",
          modoEntrada: "numeric",
          ayuda: "8 dígitos, sin letras ni espacios.",
        },
        {
          nombre: "codigo",
          etiqueta: "ID institucional · automático",
          soloLectura: true,
          ayuda: "Se genera con el rol y el DNI.",
        },
        {
          nombre: "actual",
          etiqueta: "Tu contraseña actual",
          tipo: "password",
          avanzado: true,
          ayuda: "Necesaria si cambias los permisos de una cuenta existente.",
          visible: () => Boolean(persona),
        },
        { nombre: "nombres", etiqueta: "Nombres", requerido: true },
        { nombre: "apellidos", etiqueta: "Apellidos", requerido: true },
        {
          nombre: "rol_id",
          etiqueta: "Rol institucional",
          tipo: "select",
          requerido: true,
          numerico: true,
          opciones: catalogo.roles.map((valor: Registro) => ({
            valor: valor.id,
            texto: valor.nombre,
          })),
        },
        {
          nombre: "permiso",
          etiqueta: "Acceso al sistema",
          tipo: "select",
          ayudaSegunDatos: (valores) =>
            ({
              personal:
                "Solo su carnet y asistencia. Sin acceso al panel de gestión.",
              operador:
                "Gestiona la jornada y consulta incidencias. Las justificaciones corresponden a administración.",
              administrador:
                "Administra personas, horarios, reglas y permisos; aprueba justificaciones y consulta preplanilla.",
            })[valores.permiso as string] || "Selecciona el nivel de acceso.",
          opcionesSegunDatos: (valores) =>
            catalogo.roles.find(
              (r: Registro) => r.id === Number(valores.rol_id),
            )?.codigo === "docente"
              ? [{ valor: "personal", texto: "Personal · carnet y asistencia" }]
              : [
                  {
                    valor: "personal",
                    texto: "Personal · carnet y asistencia",
                  },
                  { valor: "operador", texto: "Operador de asistencia" },
                  { valor: "administrador", texto: "Administrador" },
                ],
          opciones: [
            { valor: "personal", texto: "Acceso personal" },
            { valor: "operador", texto: "Operador de asistencia" },
            { valor: "administrador", texto: "Administrador" },
          ],
        },
        {
          nombre: "tarifa_hora",
          visible: (valores) =>
            catalogo.roles.find(
              (rol: Registro) => rol.id === Number(valores.rol_id),
            )?.codigo === "docente",
          paso: 0.01,
          maximo: 100000,
          etiqueta: "Tarifa docente por hora (S/)",
          tipo: "number",
          numerico: true,
          minimo: 0,
          ayuda: "Se utiliza solo para docentes en la preplanilla estimada.",
        },
        { nombre: "activa", etiqueta: "Persona activa", tipo: "booleano" },
      ],
      preparar: (valores) => ({
        ...valores,
        documento: valores.documento || null,
        grupo_id: null,
        horario_id: persona?.horario_id || null,
        nombre_usuario: valores.nombre_usuario || null,
        clave: valores.clave || null,
      }),
    });
  }
  function nuevaJustificacion(personaId?: number, dia = fecha, tipo = "falta") {
    if (!administrador) return;
    establecerExpediente(null);
    establecerFormulario({
      titulo: "Registrar justificación",
      ruta: "/api/gestion/justificaciones",
      datos: {
        persona_id: personaId || "",
        fecha: dia,
        tipo,
        motivo: "",
        referencia: "",
      },
      campos: [
        {
          nombre: "persona_id",
          etiqueta: "Persona",
          tipo: "select",
          opciones: seleccionPersonas,
          requerido: true,
          numerico: true,
        },
        { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true },
        {
          nombre: "tipo",
          etiqueta: "Motivo de la regularización",
          tipo: "select",
          opciones: [
            { valor: "falta", texto: "Inasistencia" },
            { valor: "tardanza", texto: "Tardanza" },
          ],
        },
        {
          nombre: "referencia",
          etiqueta: "Expediente / documento de sustento",
        },
        {
          nombre: "motivo",
          etiqueta: "Descripción",
          tipo: "textarea",
          requerido: true,
        },
      ],
    });
  }

  function editarReglas(seccion: "tolerancias" | "marcado" | "seguimiento") {
    const reglas = catalogo.reglas;
    const campos: Formulario["campos"] =
      seccion === "tolerancias"
        ? catalogo.roles.map((dato: Registro) => ({
            nombre: `rol_${dato.id}`,
            etiqueta: `${dato.nombre} (minutos)`,
            tipo: "number",
            numerico: true,
            minimo: 0,
            maximo: 1440,
            ayuda:
              "Margen después del ingreso previsto para considerar la entrada puntual.",
          }))
        : seccion === "marcado"
          ? [
              {
                nombre: "anticipacion_minutos",
                etiqueta: "Anticipación permitida (minutos)",
                tipo: "number",
                numerico: true,
                minimo: 0,
                maximo: 1440,
                ayuda: "0 permite ingresar sin límite de anticipación.",
              },
              {
                nombre: "limite_ausencia_minutos",
                etiqueta: "Evaluar ausencia después de (minutos)",
                tipo: "number",
                numerico: true,
                minimo: 0,
                maximo: 1440,
                ayuda:
                  "Cuenta desde la entrada prevista. Se aplica si no hay marcado; una entrada posterior se registra.",
              },
            ]
          : [
              {
                nombre: "observacion_porcentaje",
                etiqueta: "Observación desde (%)",
                tipo: "number",
                numerico: true,
                minimo: 0,
                maximo: 99,
              },
              {
                nombre: "alerta_porcentaje",
                etiqueta: "Alerta desde (%)",
                tipo: "number",
                numerico: true,
                minimo: 1,
                maximo: 100,
                ayuda:
                  "Debe superar el porcentaje de observación. Son indicadores de seguimiento institucional.",
              },
            ];
    establecerFormulario({
      titulo:
        seccion === "tolerancias"
          ? "Editar tolerancias por rol"
          : seccion === "marcado"
            ? "Editar reglas de marcado"
            : "Editar seguimiento de inasistencias",
      ruta: "/api/gestion/reglas",
      accion: "Guardar cambios",
      datos: {
        ...reglas,
        ...Object.fromEntries(
          catalogo.roles.map((dato: Registro) => [
            `rol_${dato.id}`,
            reglas.tolerancias[dato.id],
          ]),
        ),
      },
      campos,
      preparar: (valores) => ({
        tolerancias: Object.fromEntries(
          catalogo.roles.map((dato: Registro) => [
            dato.id,
            valores[`rol_${dato.id}`],
          ]),
        ),
        anticipacion_minutos: valores.anticipacion_minutos,
        limite_ausencia_minutos: valores.limite_ausencia_minutos,
        observacion_porcentaje: valores.observacion_porcentaje,
        alerta_porcentaje: valores.alerta_porcentaje,
      }),
    });
  }
  function editarDiaNoLectivo(dia?: Registro) {
    establecerFormulario({
      titulo: dia
        ? `Editar motivo · ${fechaCorta(dia.fecha)}`
        : "Añadir día no lectivo",
      ruta: "/api/gestion/dias-no-lectivos",
      accion: dia ? "Guardar motivo" : "Añadir fecha",
      datos: { fecha: dia?.fecha || hoyLima(), motivo: dia?.motivo || "" },
      campos: [
        {
          nombre: "fecha",
          etiqueta: "Fecha",
          tipo: "date",
          requerido: true,
          visible: () => !dia,
        },
        {
          nombre: "motivo",
          etiqueta: "Motivo",
          requerido: true,
          longitudMinima: 3,
          longitudMaxima: 200,
          ayuda:
            "Ejemplo: feriado, aniversario institucional o suspensión de actividades.",
        },
      ],
    });
  }
  async function descargar(tipo = "asistencia") {
    if (exportando) return;
    establecerExportando(true);
    establecerErrorAccion("");
    try {
      const inicio = seccion === "diario" ? fecha : desde,
        fin = seccion === "diario" ? fecha : hasta;
      if (inicio > fin)
        throw new Error("La fecha inicial no puede ser posterior a la final.");
      const parametros = new URLSearchParams({
        desde: inicio,
        hasta: fin,
        tipo,
        rol,
        estado,
        buscar,
      });
      if (seccion === "diario") parametros.set("solo_marcados", "true");
      const respuesta = await solicitar("/api/gestion/exportar?" + parametros, {
        signal: AbortSignal.timeout(60000),
      });
      const enlace = document.createElement("a");
      const url = URL.createObjectURL(await respuesta.blob());
      enlace.href = url;
      enlace.download = `FyM_${tipo}_${inicio}_${fin}.xlsx`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      establecerAviso("Archivo Excel preparado para descargar.");
    } catch (problema) {
      establecerErrorAccion((problema as Error).message);
    } finally {
      establecerExportando(false);
    }
  }
  const columnasDiario = [
    {
      titulo: "Persona",
      mostrar: (fila: Registro) => (
        <button
          className="enlace"
          onClick={() =>
            establecerExpediente(
              personas.find((persona) => persona.id === fila.persona_id) ||
                fila,
            )
          }
        >
          {fila.nombre}
          <small>{fila.codigo}</small>
        </button>
      ),
    },
    {
      titulo: "Rol",
      mostrar: (fila: Registro) => fila.rol,
    },
    { titulo: "Fecha", mostrar: (fila: Registro) => fechaCorta(fila.fecha) },
    {
      titulo: "Entrada",
      mostrar: (fila: Registro) =>
        fila.entrada ? horaLocal(fila.entrada) : "—",
    },
    {
      titulo: "Salida",
      mostrar: (fila: Registro) =>
        fila.requiere_salida
          ? fila.salida
            ? horaLocal(fila.salida)
            : "—"
          : "No aplica",
    },
    {
      titulo: "Estado",
      mostrar: (fila: Registro) => <Insignia texto={fila.estado} />,
    },
  ];
  const filas = Array.isArray(datos) ? datos : [];
  const ultimoMarcado = filas
    .flatMap((fila: Registro) => [
      ...(fila.entrada
        ? [{ nombre: fila.nombre, tipo: "Entrada", hora: fila.entrada }]
        : []),
      ...(fila.salida
        ? [{ nombre: fila.nombre, tipo: "Salida", hora: fila.salida }]
        : []),
    ])
    .sort(
      (primero, segundo) => Date.parse(segundo.hora) - Date.parse(primero.hora),
    )[0];
  const filtradas = filas.filter(
    (fila: Registro) =>
      (!buscar ||
        `${fila.nombre} ${fila.codigo || ""}`
          .toLowerCase()
          .includes(buscar.toLowerCase())) &&
      (!rol || fila.rol_codigo === rol) &&
      (!estado || fila.estado === estado),
  );
  const filtros = (
    <div className="filtros">
      <label className="buscador">
        <Search size={18} />
        <span className="solo-lector">Buscar persona</span>
        <input
          placeholder="Buscar por nombre o ID"
          value={buscar}
          onChange={(evento) => establecerBuscar(evento.target.value)}
        />
      </label>
      <SelectorFiltro
        etiqueta="Filtrar por rol"
        valor={rol}
        alCambiar={establecerRol}
        opciones={[
          { valor: "", texto: "Todos los roles" },
          ...(catalogo?.roles || []).map((dato: Registro) => ({
            valor: dato.codigo,
            texto: dato.nombre,
          })),
        ]}
      />
      <SelectorFiltro
        etiqueta="Filtrar estado"
        valor={estado}
        alCambiar={establecerEstado}
        opciones={[
          { valor: "", texto: "Todos los estados" },
          ...["Puntual", "Tardanza", "Justificado"].map((valor) => ({
            valor,
            texto: valor,
          })),
        ]}
      />
      {(buscar || rol || estado) && (
        <button
          className="boton-texto"
          onClick={() => {
            establecerBuscar("");
            establecerRol("");
            establecerEstado("");
          }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );

  return (
    <div className="administracion">
      <a className="salto-contenido" href="#contenido">
        Ir al contenido
      </a>
      <aside className="barra-lateral">
        <div className="identidad">
          <LogoInstitucional clase="logo-lateral" />
          <div>
            <strong>FyM Pass</strong>
            <span>Finney & Miller</span>
          </div>
        </div>
        <nav aria-label="Módulos administrativos">
          {["Jornada", "Gestión", "Instituto"].map((grupo) => (
            <div className="grupo-menu" key={grupo}>
              <span className="etiqueta-menu">{grupo}</span>
              {opciones
                .filter((opcion) => opcion.grupo === grupo)
                .map((opcion) => (
                  <button
                    key={opcion.id}
                    aria-current={seccion === opcion.id ? "page" : undefined}
                    onClick={() => navegar(opcion.id)}
                  >
                    <opcion.icono size={18} />
                    <span>{opcion.titulo}</span>
                    {seccion === opcion.id && <ChevronRight size={14} />}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="perfil-lateral">
          <div className="inicial-perfil">{usuario.iniciales}</div>
          <div>
            <strong>{usuario.nombre}</strong>
            <span>
              {administrador ? "Administrador" : "Operador de asistencia"}
            </span>
          </div>
          <button
            className="icono-boton"
            onClick={alCerrar}
            disabled={cerrando}
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="area-administrativa">
        <div className="barra-superior">
          <EstadoJornada revision={revision} />
          <div className="acciones-superiores">
            <SelectorTema />
            <button
              className="icono-boton"
              aria-label="Actualizar información"
              onClick={() => establecerRevision((valor) => valor + 1)}
            >
              <RefreshCw size={18} />
            </button>
            <MenuCuenta>
              <strong>{usuario.nombre}</strong>
              <a className="acceso-cuenta-carne" href="/mi-carne"><QrCode size={18} aria-hidden="true" />Mostrar mi carné</a>
              <InstalarAplicacion />
              <button
                className="secundario"
                onClick={alCerrar}
                disabled={cerrando}
              >
                {cerrando ? "Cerrando…" : "Cerrar sesión"}
              </button>
            </MenuCuenta>
          </div>
        </div>
        <main id="contenido" className="contenido-administrativo">
          {grupoAbierto && (
            <section
              className="directorio-modulos"
              aria-label={`Módulos de ${grupoAbierto}`}
            >
              <header className="titulo-pagina">
                <div>
                  <span className="etiqueta">TU ESPACIO DE TRABAJO</span>
                  <h1>{grupoAbierto}</h1>
                  <p>
                    {grupoAbierto === "Jornada"
                      ? "Todo para acompañar el ingreso de hoy."
                      : grupoAbierto === "Gestión"
                        ? "Revisa, consulta y da seguimiento a cada registro."
                        : "Las personas y reglas que dan forma a tu instituto."}
                  </p>
                </div>
              </header>
              <div className="lista-modulos">
                {opciones
                  .filter(
                    (opcion) =>
                      opcion.grupo === grupoAbierto && opcion.id !== "inicio",
                  )
                  .map((opcion) => (
                    <button key={opcion.id} onClick={() => navegar(opcion.id)}>
                      <span className="simbolo-modulo">
                        <opcion.icono size={24} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{opcion.titulo}</strong>
                        <small>{opcion.descripcion}</small>
                      </span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  ))}
              </div>
            </section>
          )}
          <div
            className={`vista-modulo${seccion === "inicio" ? " inicio-administrativo" : ""}`}
            hidden={Boolean(grupoAbierto)}
            key={seccion}
          >
            <header className="titulo-pagina">
              <div>
                <span className="etiqueta">{encabezado.grupo}</span>
                <h1>{encabezado.titulo}</h1>
                <p>{encabezado.descripcion}</p>
              </div>
              {["inicio", "diario"].includes(seccion) && (
                <div className="acciones-cabecera-jornada">
                  {seccion === "inicio" && <a className="acceso-carne-propio" href="/mi-carne">
                    <QrCode size={19} aria-hidden="true" />Mostrar mi carné
                  </a>}
                  <div className="fecha-jornada">
                    <SelectorFecha
                      etiqueta="Fecha de consulta"
                      valor={fecha}
                      alCambiar={establecerFecha}
                    />
                  </div>
                </div>
              )}
            </header>
            {aviso && (
              <div className="aviso exito" role="status">
                <FileCheck2 size={18} />
                {aviso}
                <button
                  className="icono-boton"
                  aria-label="Cerrar aviso"
                  onClick={() => establecerAviso("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <Estado
              error={errorSesion || errorAccion || errorCatalogo || error}
              cargando={cargandoCatalogo || cargando}
            />
            <DiagnosticoConexion />
            {seccion === "inicio" && datos && (
              <>
                <div className="metricas">
                  {[
                    ["Presentes", datos.presentes, "Con entrada registrada"],
                    [
                      "Tardanzas",
                      datos.tardanzas,
                      "Según horario y tolerancia",
                    ],
                    [
                      "Inasistencias",
                      datos.faltas,
                      "Sin entrada al cierre del margen",
                    ],
                    [
                      "Por revisar",
                      datos.pendientes,
                      "Justificaciones pendientes",
                    ],
                  ].map(([titulo, valor, detalle]) => (
                    <article key={titulo} data-indicador={titulo}>
                      <span>{titulo}</span>
                      <strong>{valor}</strong>
                      <small>{detalle}</small>
                      {titulo === "Presentes" && (
                        <button
                          type="button"
                          onClick={() =>
                            navegar(
                              fecha === hoyLima() ? "dispositivos" : "diario",
                            )
                          }
                        >
                          {fecha === hoyLima() ? (
                            <QrCode size={18} aria-hidden="true" />
                          ) : (
                            <ChevronRight size={18} aria-hidden="true" />
                          )}
                          {fecha === hoyLima()
                            ? "Abrir puesto de asistencia"
                            : "Ver diario de asistencia"}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                <div className="rejilla-resumen">
                  <section className="panel">
                    <div className="cabecera">
                      <h2>Últimos siete días</h2>
                      <span className="nota">Entradas registradas</span>
                    </div>
                    <div
                      className="grafico-semana"
                      role="img"
                      aria-label={datos.semana
                        .map(
                          (dia: Registro) =>
                            `${dia.fecha}: ${dia.presentes} presentes`,
                        )
                        .join("; ")}
                    >
                      {datos.semana.map((dia: Registro) => (
                        <div key={dia.fecha}>
                          <strong>{dia.presentes}</strong>
                          <span
                            className="barra-grafico"
                            style={{
                              height: `${12 + (dia.presentes / Math.max(1, ...datos.semana.map((valor: Registro) => valor.presentes))) * 110}px`,
                            }}
                          />
                          <small>
                            {dia.fecha.slice(8)}/{dia.fecha.slice(5, 7)}
                          </small>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="panel accesos-rapidos">
                    <h2>Continúa tu jornada</h2>
                    <button onClick={() => navegar("dispositivos")}>
                      <QrCode />
                      <span>
                        Abrir puesto de asistencia
                        <small>QR dinámico y lectura por cámara</small>
                      </span>
                      <ArrowUpRight />
                    </button>
                    <button onClick={() => navegar("manual")}>
                      <PenLine />
                      <span>
                        Registrar entrada manual
                        <small>Para personal sin teléfono o QR</small>
                      </span>
                      <ArrowUpRight />
                    </button>
                    <button onClick={() => navegar("justificaciones")}>
                      <FileCheck2 />
                      <span>
                        {administrador ? "Revisar justificaciones" : "Consultar incidencias"}
                        <small>{datos.pendientes} solicitudes pendientes</small>
                      </span>
                      <ArrowUpRight />
                    </button>
                  </section>
                </div>
                <section className="panel">
                  <div className="cabecera">
                    <h2>
                      {fecha === hoyLima()
                        ? "La jornada de hoy"
                        : "Jornada del " + fechaCorta(fecha)}
                    </h2>
                    <button
                      className="boton-texto"
                      onClick={() => navegar("diario")}
                    >
                      Ver detalle <ChevronRight size={16} />
                    </button>
                  </div>
                  <Tabla
                    titulo="Jornada de hoy"
                    filas={datos.diario}
                    clave="persona_id"
                    columnas={columnasDiario.filter(
                      (columna) => columna.titulo !== "Fecha",
                    )}
                  />
                </section>
              </>
            )}
            {seccion === "dispositivos" && <ControlAsistencia />}
            {seccion === "diario" && !cargando && !error && (
              <section className="panel">
                <div className="cabecera">
                  <h2>
                    {seccion === "diario"
                      ? "Asistencia de la jornada"
                      : "Consulta de asistencia"}
                  </h2>
                  <button
                    className="secundario"
                    disabled={exportando || cargando || Boolean(error)}
                    onClick={() => void descargar()}
                  >
                    <Download size={16} />{" "}
                    {exportando ? "Exportando…" : "Exportar Excel"}
                  </button>
                </div>
                {filtros}
                {seccion === "diario" && !filtradas.length ? (
                  <Vacio
                    titulo={
                      filas.length
                        ? "No hay asistencias con estos filtros."
                        : "Todavía no hay asistencias en esta fecha."
                    }
                    detalle={
                      filas.length
                        ? "Prueba con otro rol, estado o nombre."
                        : "Los ingresos y salidas aparecerán aquí conforme se registren."
                    }
                  />
                ) : (
                  <Tabla
                    titulo="Diario de asistencia"
                    filas={filtradas}
                    clave="persona_id"
                    columnas={columnasDiario}
                  />
                )}
                <p className="nota">
                  {seccion === "diario"
                    ? ultimoMarcado
                      ? `Último registro: ${ultimoMarcado.nombre} · ${ultimoMarcado.tipo} · ${horaLocal(ultimoMarcado.hora)}`
                      : "Sin registros en esta fecha."
                    : "La ausencia se calcula solo cuando existe horario y terminó el margen configurado. Los días no lectivos no generan faltas."}
                </p>
              </section>
            )}
            {seccion === "reportes" && catalogo && (
              <ReportesAsistencia
                catalogo={catalogo}
                revision={revision}
                abrirExpediente={(fila, periodo) => {
                  establecerPeriodoExpediente(periodo);
                  establecerExpediente(
                    personas.find(
                      (persona) => persona.id === fila.persona_id,
                    ) || { ...fila, id: fila.persona_id },
                  );
                }}
              />
            )}
            {seccion === "manual" && catalogo && (
              <RegistroManual catalogo={catalogo} />
            )}
            {seccion === "preplanilla" && (
              <PreplanillaDocente
                filas={filas}
                desde={desde}
                hasta={hasta}
                cambiarDesde={establecerDesde}
                cambiarHasta={establecerHasta}
                cargando={cargando}
                error={error}
                revision={revision}
                exportando={exportando}
                exportar={() => void descargar("preplanilla")}
              />
            )}
            {seccion === "justificaciones" && (
              <Justificaciones
                administrador={administrador}
                revision={revision}
                guardado={guardado}
              />
            )}
            {seccion === "personas" && catalogo && (
              <PersonasCarnets
                catalogo={catalogo}
                administrador={administrador}
                registrar={() => nuevaPersona()}
                editar={nuevaPersona}
                abrir={(persona, vista) => {
                  establecerVistaExpediente(vista);
                  establecerPeriodoExpediente(undefined);
                  establecerExpediente(persona);
                }}
              />
            )}
            {seccion === "reglas" && catalogo && (
              <ToleranciasReglas
                catalogo={catalogo}
                editar={editarReglas}
                editarDia={editarDiaNoLectivo}
              />
            )}
            {seccion === "horarios" && catalogo && (
              <HorariosLaborales
                catalogo={catalogo}
                administrador={administrador}
                guardado={guardado}
              />
            )}
          </div>
        </main>
        <footer className="pie-aplicacion">
          FyM Pass · Asistencia de ingreso al instituto
          <span>Hora de referencia: Lima</span>
        </footer>
      </div>
      <nav className="navegacion-movil" aria-label="Navegación móvil">
        {destinosMoviles.map((destino) => (
          <button
            key={destino.titulo}
            aria-current={destinoActivo === destino.titulo ? "page" : undefined}
            onClick={() =>
              destino.titulo === "Resumen"
                ? navegar("inicio")
                : abrirGrupo(destino.titulo)
            }
          >
            <destino.icono size={22} aria-hidden="true" />
            <span>{destino.titulo}</span>
          </button>
        ))}
      </nav>
      {formulario && (
        <FormularioGestion
          formulario={formulario}
          cerrar={() => establecerFormulario(null)}
          guardado={guardado}
        />
      )}
      {expediente && (
        <Expediente
          persona={expediente}
          vistaInicial={vistaExpediente}
          fecha={seccion === "personas" ? hoyLima() : fecha}
          periodoConsulta={periodoExpediente}
          revision={revision}
          cerrar={() => {
            establecerExpediente(null);
            establecerPeriodoExpediente(undefined);
            establecerVistaExpediente("calendario");
          }}
          justificar={(dia, tipo) =>
            nuevaJustificacion(expediente.id, dia, tipo)
          }
          administrador={administrador}
        />
      )}
    </div>
  );
}
