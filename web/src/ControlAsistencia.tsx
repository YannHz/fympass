import { useEffect, useRef, useState } from "react";
import { consultar, horaLocal, type Persona } from "./servicio";
type Punto = {
  nombre: string;
  activo: boolean;
  propio_activo: boolean;
  camara_puesto_habilitada: boolean;
  escaneo_movil_habilitado: boolean;
};
type Marcado = {
  id: number;
  persona: Persona;
  tipo: string;
  hora: string;
  resultado: string;
  modalidad: string;
};
export function ControlAsistencia() {
  const [punto, establecerPunto] = useState<Punto | null>(null);
  const [marcados, establecerMarcados] = useState<Marcado[]>([]);
  const [consultando, establecerConsultando] = useState(true);
  const montado = useRef(false),
    consultandoRef = useRef(false);
  const [error, establecerError] = useState(""),
    [ocupado, establecerOcupado] = useState(false);
  const [camara, establecerCamara] = useState(true),
    [movil, establecerMovil] = useState(true);
  async function actualizar() {
    if (consultandoRef.current) return;
    consultandoRef.current = true;
    try {
      const [datos, registros] = await Promise.all([
        consultar("/api/asistencia/punto"),
        consultar("/api/asistencia/marcados"),
      ]);
      if (montado.current) {
        establecerPunto(datos);
        establecerMarcados(registros);
        establecerError("");
        return datos;
      }
    } finally {
      consultandoRef.current = false;
      if (montado.current) establecerConsultando(false);
    }
  }
  useEffect(() => {
    montado.current = true;
    void actualizar()
      .then((datos) => {
        if (montado.current && datos) {
          establecerCamara(datos.camara_puesto_habilitada);
          establecerMovil(datos.escaneo_movil_habilitado);
        }
      })
      .catch((problema) => {
        if (montado.current) establecerError(problema.message);
      });
    const intervalo = setInterval(
      () =>
        void actualizar().catch((problema) => {
          if (montado.current) establecerError(problema.message);
        }),
      4000,
    );
    return () => {
      montado.current = false;
      clearInterval(intervalo);
    };
  }, []);
  async function abrir() {
    const ventana = window.open(
      "about:blank",
      "fym-puesto",
      "popup,width=1280,height=900",
    );
    if (!ventana) {
      establecerError("Permite las ventanas emergentes para abrir el puesto.");
      return;
    }
    establecerOcupado(true);
    establecerError("");
    try {
      const datos = await consultar("/api/asistencia/abrir", {
        method: "POST",
        body: JSON.stringify({
          camara_puesto_habilitada: camara,
          escaneo_movil_habilitado: movil,
        }),
      });
      ventana.location.replace(
        `/puesto#acceso=${encodeURIComponent(datos.token_puesto)}`,
      );
      ventana.opener = null;
      window.dispatchEvent(new Event("fym-puesto-actualizado"));
      await actualizar();
    } catch (problema) {
      ventana.close();
      establecerError((problema as Error).message);
    } finally {
      establecerOcupado(false);
    }
  }
  async function pausar() {
    establecerOcupado(true);
    establecerError("");
    try {
      await consultar("/api/asistencia/pausar", { method: "POST" });
      window.dispatchEvent(new Event("fym-puesto-actualizado"));
      await actualizar();
    } catch (problema) {
      establecerError((problema as Error).message);
    } finally {
      establecerOcupado(false);
    }
  }
  return (
    <>
      <section className="panel">
        <div className="cabecera">
          <div>
            <h2>Puesto de asistencia</h2>
            <p>
              {punto?.nombre || "Ingreso principal"} · Tu puesto {" "}
              {consultando
                ? "Consultando…"
                : error
                  ? "Sin conexión; estado sin confirmar"
                  : punto?.propio_activo
                    ? "abierto"
                    : "cerrado"}
            </p>
          </div>
          <span className="etiqueta">SEDE PRINCIPAL</span>
        </div>
        <fieldset disabled={ocupado || consultando || Boolean(error)}>
          <legend>Modalidades al abrir el puesto</legend>
          <label className="opcion">
            <input
              type="checkbox"
              checked={movil}
              onChange={(evento) => establecerMovil(evento.target.checked)}
            />{" "}
            QR dinámico para escaneo desde el teléfono
          </label>
          <label className="opcion">
            <input
              type="checkbox"
              checked={camara}
              onChange={(evento) => establecerCamara(evento.target.checked)}
            />{" "}
            Cámara web para leer el carnet virtual
          </label>
        </fieldset>
        <div className="acciones">
          <button
            onClick={() => void abrir()}
            disabled={
              ocupado || consultando || Boolean(error) || (!camara && !movil)
            }
          >
            {ocupado
              ? "Preparando…"
              : punto?.propio_activo
                ? "Reabrir tu puesto con estas opciones"
                : "Iniciar asistencia"}
          </button>
          <button
            className="secundario"
            disabled={ocupado || !punto?.propio_activo}
            onClick={() => void pausar()}
          >
            Pausar mi puesto
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <p className="nota">
          Tu puesto funciona de forma independiente de los puestos abiertos por
          otros encargados. Al reabrirlo, se cierra tu ventana anterior. Permite
          el acceso a la cámara en la nueva ventana si activas esa modalidad.
        </p>
      </section>
      <section className="panel">
        <h2>Últimos marcados</h2>
        <p className="nota">
          Los horarios y tolerancias se consultan según cada persona y su rol.
        </p>
        {consultando ? (
          <p role="status">Consultando los marcados…</p>
        ) : error ? (
          <p>No se pueden consultar los marcados en este momento.</p>
        ) : marcados.length ? (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Rol</th>
                  <th>Movimiento</th>
                  <th>Fecha y hora</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {marcados.map((marcado) => (
                  <tr key={marcado.id}>
                    <td>{marcado.persona.nombre}</td>
                    <td>{marcado.persona.rol}</td>
                    <td>{marcado.tipo === "entrada" ? "Entrada" : "Salida"}</td>
                    <td>
                      {new Intl.DateTimeFormat("es-PE", {
                        timeZone: "America/Lima",
                        day: "2-digit",
                        month: "2-digit",
                      }).format(new Date(marcado.hora))}{" "}
                      · {horaLocal(marcado.hora)}
                    </td>
                    <td>{marcado.resultado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            Todavía no hay marcados. Los registros aparecerán conforme se marque
            la asistencia.
          </p>
        )}
      </section>
    </>
  );
}
