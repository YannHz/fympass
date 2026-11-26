import { SelectorFecha } from "./SelectorFecha";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Estado, Insignia, useDatos } from "./componentesGestion";

type Dia = {
  fecha: string;
  entrada: string | null;
  salida: string | null;
  estado: string;
};
type Historial = {
  mes: string;
  hasta: string;
  zona_horaria: string;
  requiere_salida: boolean;
  dias: Dia[];
};

export function MisAsistencias() {
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const mesActual = `${hoy.find((parte) => parte.type === "year")?.value}-${hoy.find((parte) => parte.type === "month")?.value}`;
  const [mes, establecerMes] = useState(mesActual);
  const [revision, establecerRevision] = useState(0);
  const [seleccion, establecerSeleccion] = useState("");
  const [direccion, establecerDireccion] = useState(0);
  const [desplazamiento, establecerDesplazamiento] = useState(0);
  const gesto = useRef<{
    x: number;
    y: number;
    id: number;
    arrastrando: boolean;
  } | null>(null);
  const ultimoDeslizamiento = useRef(0);
  const mesMinimo = "2000-01";
  function elegirMes(valor: string) {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ||
      valor < mesMinimo ||
      valor > mesActual ||
      valor === mes
    )
      return;
    establecerDireccion(valor > mes ? 1 : -1);
    establecerMes(valor);
    establecerSeleccion("");
  }
  function cambiarMes(paso: number) {
    const [anio, numero] = mes.split("-").map(Number);
    const destino = new Date(Date.UTC(anio, numero - 1 + paso, 1));
    elegirMes(
      `${destino.getUTCFullYear()}-${String(destino.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  function empezarGesto(evento: PointerEvent<HTMLDivElement>) {
    if (!evento.isPrimary || evento.button !== 0) return;
    gesto.current = {
      x: evento.clientX,
      y: evento.clientY,
      id: evento.pointerId,
      arrastrando: false,
    };
  }
  function moverGesto(evento: PointerEvent<HTMLDivElement>) {
    const inicio = gesto.current;
    if (!inicio || evento.pointerId !== inicio.id) return;
    const x = evento.clientX - inicio.x,
      y = evento.clientY - inicio.y;
    if (!inicio.arrastrando && Math.abs(y) > 20 && Math.abs(y) > Math.abs(x)) {
      gesto.current = null;
      return;
    }
    if (Math.abs(x) > 18 && Math.abs(x) > Math.abs(y) * 1.4) {
      inicio.arrastrando = true;
      evento.currentTarget.setPointerCapture(evento.pointerId);
      const permitido = x > 0 ? mes > mesMinimo : mes < mesActual;
      establecerDesplazamiento(
        permitido ? Math.max(-44, Math.min(44, x / 3)) : 0,
      );
    }
  }
  function terminarGesto(evento: PointerEvent<HTMLDivElement>) {
    const inicio = gesto.current;
    gesto.current = null;
    establecerDesplazamiento(0);
    if (!inicio || evento.pointerId !== inicio.id) return;
    const x = evento.clientX - inicio.x,
      y = evento.clientY - inicio.y;
    if (inicio.arrastrando) ultimoDeslizamiento.current = Date.now();
    if (Math.abs(x) >= 60 && Math.abs(x) > Math.abs(y) * 1.4)
      cambiarMes(x < 0 ? 1 : -1);
  }
  const { datos, cargando, error } = useDatos(
    `/api/mi-asistencia?mes=${mes}`,
    revision,
    20000,
  );
  const historial = datos as Historial | null;
  useEffect(() => {
    const renovar = () => establecerRevision((valor) => valor + 1);
    window.addEventListener("fym-sesion-renovada", renovar);
    return () => window.removeEventListener("fym-sesion-renovada", renovar);
  }, []);
  const dias = historial?.dias || [];
  const elegido = dias.find((dia) => dia.fecha === seleccion) || dias[0];
  const [anio, numeroMes] = mes.split("-").map(Number);
  const inicioSemana =
    (new Date(Date.UTC(anio, numeroMes - 1, 1)).getUTCDay() + 6) % 7;
  const cantidad = new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate();
  const celdas = Array.from(
    { length: Math.ceil((inicioSemana + cantidad) / 7) * 7 },
    (_, indice) => {
      const numero = indice - inicioSemana + 1;
      return numero > 0 && numero <= cantidad
        ? `${mes}-${String(numero).padStart(2, "0")}`
        : null;
    },
  );
  const semanas = Array.from({ length: celdas.length / 7 }, (_, indice) =>
    celdas.slice(indice * 7, indice * 7 + 7),
  );
  function indicador(dia: Dia | undefined) {
    if (!dia) return { clase: "futuro", simbolo: "", texto: "Sin evaluar" };
    if (dia.estado === "Justificado")
      return { clase: "justificado", simbolo: "J", texto: dia.estado };
    if (dia.estado === "Falta")
      return { clase: "falta", simbolo: "F", texto: "Inasistencia" };
    if (dia.estado === "Tardanza")
      return { clase: "tardanza", simbolo: "T", texto: dia.estado };
    if (dia.entrada)
      return { clase: "presente", simbolo: "✓", texto: dia.estado };
    return { clase: "neutral", simbolo: "—", texto: dia.estado };
  }
  const hora = (valor: string | null) =>
    valor
      ? new Intl.DateTimeFormat("es-PE", {
          timeZone: historial?.zona_horaria || "America/Lima",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(valor))
      : "—";
  const fecha = (valor: string) =>
    new Intl.DateTimeFormat("es-PE", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(valor + "T12:00:00Z"));
  return (
    <section
      className="mis-asistencias"
      aria-labelledby="titulo-mis-asistencias"
    >
      <header className="titulo-historial">
        <h1 id="titulo-mis-asistencias" className="titulo-consulta-asistencias">
          Consulta tus registros de asistencia
        </h1>
      </header>
      <Estado cargando={cargando} error={error} />
      <div className="resumen-asistencias" aria-label="Resumen del mes">
        <div>
          <strong>
            {historial ? dias.filter((dia) => dia.entrada).length : "—"}
          </strong>
          <span>Ingresos</span>
        </div>
        <div>
          <strong>
            {historial
              ? dias.filter((dia) => dia.estado === "Tardanza").length
              : "—"}
          </strong>
          <span>Tardanzas</span>
        </div>
        <div>
          <strong>
            {historial
              ? dias.filter((dia) => dia.estado === "Falta").length
              : "—"}
          </strong>
          <span>Inasistencias</span>
        </div>
      </div>
      <div className="calendario-personal">
        <div className="cabecera-calendario">
          <div className="selector-mes-calendario">
            <SelectorFecha
              modo="mes"
              etiqueta="Elegir mes y año"
              ocultarEtiqueta
              valor={mes}
              minimo={mesMinimo}
              maximo={mesActual}
              alCambiar={elegirMes}
            />
          </div>
          <div className="flechas-calendario">
            <button
              type="button"
              className="icono-boton"
              aria-label="Mes anterior"
              disabled={mes <= mesMinimo}
              onClick={() => cambiarMes(-1)}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icono-boton"
              aria-label="Mes siguiente"
              disabled={mes >= mesActual}
              onClick={() => cambiarMes(1)}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="solo-lector" id="ayuda-calendario">
          Desliza a izquierda o derecha para cambiar de mes, usa las flechas o
          pulsa el título para elegir mes y año.
        </p>
        <div
          className="superficie-calendario"
          onPointerDown={empezarGesto}
          onPointerMove={moverGesto}
          onPointerUp={terminarGesto}
          onPointerCancel={() => {
            gesto.current = null;
            establecerDesplazamiento(0);
          }}
          onClickCapture={(evento) => {
            if (Date.now() - ultimoDeslizamiento.current < 350) {
              evento.preventDefault();
              evento.stopPropagation();
            }
          }}
        >
          <table
            key={mes}
            className={`hoja-calendario ${direccion > 0 ? "mes-siguiente" : direccion < 0 ? "mes-anterior" : ""}`}
            aria-labelledby="nombre-mes-calendario"
            aria-describedby="ayuda-calendario"
            aria-busy={cargando}
            style={{ transform: `translateX(${desplazamiento}px)` }}
          >
            <thead>
              <tr>
                {[
                  "Lunes",
                  "Martes",
                  "Miércoles",
                  "Jueves",
                  "Viernes",
                  "Sábado",
                  "Domingo",
                ].map((dia) => (
                  <th key={dia} scope="col">
                    <abbr title={dia}>
                      {dia === "Miércoles" ? "X" : dia.slice(0, 1)}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semanas.map((semana, indice) => (
                <tr key={indice}>
                  {semana.map((valor, columna) => {
                    if (!valor) return <td key={`vacio-${columna}`} />;
                    const dia = dias.find((dato) => dato.fecha === valor);
                    const estado = indicador(dia);
                    return (
                      <td key={valor}>
                        <button
                          type="button"
                          className={`fecha-asistencia ${estado.clase}`}
                          disabled={cargando || !dia}
                          aria-label={`${fecha(valor)}: ${estado.texto}`}
                          aria-pressed={Boolean(
                            dia && elegido?.fecha === valor,
                          )}
                          aria-controls="detalle-asistencia"
                          onClick={() => establecerSeleccion(valor)}
                        >
                          <strong>{Number(valor.slice(-2))}</strong>
                          <span aria-hidden="true">{estado.simbolo}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ul className="leyenda-asistencias" aria-label="Leyenda del calendario">
        <li>
          <span className="presente">✓</span>Ingreso
        </li>
        <li>
          <span className="tardanza">T</span>Tardanza
        </li>
        <li>
          <span className="falta">F</span>Inasistencia
        </li>
        <li>
          <span className="justificado">J</span>Justificado
        </li>
        <li>
          <span>—</span>No programado o pendiente
        </li>
      </ul>
      {!cargando && !error && historial && (
        <section
          className="detalle-asistencia"
          id="detalle-asistencia"
          aria-live="polite"
          aria-atomic="true"
        >
          {elegido ? (
            <>
              <div className="cabecera-dia">
                <h2>{fecha(elegido.fecha)}</h2>
                <Insignia texto={elegido.estado} />
              </div>
              <dl>
                <div>
                  <dt>Entrada</dt>
                  <dd>{hora(elegido.entrada)}</dd>
                </div>
                {historial.requiere_salida && (
                  <div>
                    <dt>Salida</dt>
                    <dd>{hora(elegido.salida)}</dd>
                  </div>
                )}
              </dl>
              {!elegido.entrada && (
                <p className="nota">
                  No hay un ingreso registrado para este día.
                </p>
              )}
            </>
          ) : (
            <p>Selecciona un día para consultar su asistencia.</p>
          )}
        </section>
      )}
      <p className="nota">
        Las horas se muestran en la zona de tu sede. Si detectas un error,
        comunícate con administración.
      </p>
    </section>
  );
}
