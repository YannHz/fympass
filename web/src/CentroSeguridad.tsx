import { useEffect, useState } from "react";
import { consultar } from "./servicio";
import { CambiarClaveInicial } from "./CambiarClaveInicial";
import { Dialogo } from "./componentesGestion";
import "./Seguridad.css";

type Datos = Record<string, any>;
export function CentroSeguridad({
  alVolver,
  alActualizar,
  alCerrar,
}: {
  alVolver: () => void;
  alActualizar: (datos: any) => void;
  alCerrar: () => void;
}) {
  const [estado, cambiarEstado] = useState<Datos | null>(null);
  const [actual, cambiarActual] = useState("");
  const [sesiones, cambiarSesiones] = useState<Datos[]>([]);
  const [eventos, cambiarEventos] = useState<Datos[]>([]);
  const [alertas, cambiarAlertas] = useState<Datos[]>([]);
  const [personas, cambiarPersonas] = useState<Datos[]>([]);
  const [persona, cambiarPersona] = useState("");
  const [mensaje, cambiarMensaje] = useState(""),
    [error, cambiarError] = useState("");
  const [ocupado, cambiarOcupado] = useState(false);
  const [cambiarClave, mostrarClave] = useState(false);
  const [temporal, cambiarTemporal] = useState<Datos | null>(null);
  const [confirmacion, cambiarConfirmacion] = useState<{
    accion: "restablecer" | "renovar";
    persona: string;
  } | null>(null);
  async function cargar() {
    const datos = await consultar("/api/seguridad/estado");
    cambiarEstado(datos);
    cambiarSesiones(await consultar("/api/seguridad/sesiones"));
    if (datos.administrador) {
      cambiarEventos(await consultar("/api/seguridad/auditoria"));
      cambiarAlertas(await consultar("/api/seguridad/alertas-qr"));
      cambiarPersonas((await consultar("/api/gestion/catalogo")).personas);
    }
  }
  useEffect(() => {
    void cargar().catch((e) => cambiarError(e.message));
  }, []);
  async function accion(ruta: string, cuerpo: Datos = { actual }) {
    if (ocupado) return;
    cambiarOcupado(true);
    cambiarError("");
    cambiarMensaje("");
    cambiarTemporal(null);
    try {
      const respuesta = await consultar(ruta, {
        method: "POST",
        body: JSON.stringify(cuerpo),
      });
      cambiarMensaje(respuesta.mensaje || "Operación completada.");
      cambiarActual("");
      if (respuesta.clave_temporal) cambiarTemporal(respuesta);
      await cargar();
    } catch (e) {
      cambiarError((e as Error).message);
    } finally {
      cambiarOcupado(false);
    }
  }
  if (cambiarClave)
    return (
      <CambiarClaveInicial
        requiereActual
        alCambiar={(datos) => {
          mostrarClave(false);
          alActualizar(datos);
          void cargar();
        }}
        alCerrar={alCerrar}
      />
    );
  return (
    <>
      <main className="centro-seguridad">
        <header>
          <div>
            <h1>Seguridad de mi cuenta</h1>
            <p>Gestiona tus accesos, contraseñas y sesiones.</p>
          </div>
          <button className="secundario" onClick={alVolver}>
            Volver
          </button>
          <button className="boton-texto" onClick={alCerrar}>
            Cerrar sesión
          </button>
        </header>
        {error && (
          <p className="aviso error" role="alert">
            {error}
          </p>
        )}
        {mensaje && (
          <p className="aviso" role="status">
            {mensaje}
          </p>
        )}
        {estado && (
          <>
            <section className="panel">
              <h2>Contraseña y sesiones</h2>
              <p>Para operaciones sensibles confirma tu contraseña actual.</p>
              <div className="formulario-seguridad">
                <label>
                  Contraseña actual
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={actual}
                    maxLength={256}
                    onChange={(e) => cambiarActual(e.target.value)}
                  />
                </label>
              </div>
              <div className="acciones-seguridad">
                <button onClick={() => mostrarClave(true)}>
                  Cambiar mi contraseña
                </button>
                <button
                  className="secundario"
                  disabled={ocupado || !actual}
                  onClick={() =>
                    void accion("/api/seguridad/sesiones/cerrar-otras")
                  }
                >
                  Cerrar otras sesiones
                </button>
              </div>
              <ul className="lista-sesiones">
                {sesiones.map((s) => (
                  <li key={s.id}>
                    <strong>{s.actual ? "Esta sesión" : "Otra sesión"}</strong>{" "}
                    · Inicio: {new Date(s.creada).toLocaleString("es-PE")} ·
                    Última actividad:{" "}
                    {new Date(s.actividad).toLocaleString("es-PE")}
                  </li>
                ))}
              </ul>
            </section>
            {estado.administrador && (
              <section className="panel">
                <h2>Protección de cuentas y carnés</h2>
                <label>
                  Persona
                  <select
                    value={persona}
                    onChange={(e) => {
                      cambiarPersona(e.target.value);
                      cambiarTemporal(null);
                    }}
                  >
                    <option value="">Selecciona una persona</option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} · {p.codigo}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Usa la contraseña actual indicada arriba. El restablecimiento
                  cierra las sesiones de la cuenta. Renovar el carné invalida el
                  QR anterior inmediatamente.
                </p>
                <div className="acciones-seguridad">
                  <button
                    disabled={ocupado || !persona || !actual}
                    onClick={() => {
                      cambiarConfirmacion({ accion: "restablecer", persona });
                    }}
                  >
                    Restablecer acceso inicial
                  </button>
                  <button
                    className="secundario"
                    disabled={ocupado || !persona || !actual}
                    onClick={() => {
                      cambiarConfirmacion({ accion: "renovar", persona });
                    }}
                  >
                    Revocar y renovar carné
                  </button>
                </div>
                {temporal && (
                  <aside className="aviso" role="status">
                    <strong>Entrega personal · se muestra una sola vez</strong>
                    <p>
                      Usuario: <code>{temporal.usuario}</code>
                    </p>
                    <p>
                      Contraseña temporal:{" "}
                      <code>{temporal.clave_temporal}</code>
                    </p>
                    <p>
                      Vence: {new Date(temporal.vence).toLocaleString("es-PE")}
                    </p>
                    <button onClick={() => cambiarTemporal(null)}>
                      Ya entregué el acceso
                    </button>
                  </aside>
                )}
              </section>
            )}
            {estado.administrador && (
              <section className="panel">
                <h2>Auditoría de seguridad</h2>
                {!!alertas.length && (
                  <aside className="aviso error" role="status">
                    <strong>Revisar intentos QR repetidos</strong>
                    <p>
                      Cinco o más rechazos similares durante los últimos 15
                      minutos. Son señales para revisión, no prueba de fraude.
                    </p>
                    <ul>
                      {alertas.map((a, i) => (
                        <li key={i}>
                          {a.intentos} intentos · {a.detalle}
                        </li>
                      ))}
                    </ul>
                  </aside>
                )}
                <button
                  className="boton-texto"
                  disabled={ocupado}
                  onClick={() =>
                    void cargar().catch((e) => cambiarError(e.message))
                  }
                >
                  Actualizar eventos y alertas
                </button>
                <p>Eventos recientes. No se guardan contraseñas ni QR.</p>
                <ul className="lista-auditoria">
                  {eventos.map((e) => (
                    <li key={e.id}>
                      <strong>{e.accion.replaceAll("_", " ")}</strong>
                      <small>
                        {new Date(e.fecha).toLocaleString("es-PE")} · Cuenta{" "}
                        {e.usuario_id || "no identificada"}
                      </small>
                      <p>{e.detalle}</p>
                    </li>
                  ))}
                </ul>
                {eventos.length >= 50 && (
                  <button
                    className="secundario"
                    onClick={async () => {
                      const mas = await consultar(
                        `/api/seguridad/auditoria?antes=${eventos.at(-1)?.id}`,
                      );
                      cambiarEventos([...eventos, ...mas]);
                    }}
                  >
                    Cargar eventos anteriores
                  </button>
                )}
              </section>
            )}
          </>
        )}
      </main>
      {confirmacion && (
        <Dialogo
          titulo={
            confirmacion.accion === "restablecer"
              ? "Restablecer acceso inicial"
              : "Revocar y renovar carné"
          }
          cerrar={() => cambiarConfirmacion(null)}
        >
          <div className="formulario-gestion">
            <p>
              {confirmacion.accion === "restablecer"
                ? "Se cerrarán las sesiones de esta persona y se generará un acceso temporal."
                : "El carné actual quedará invalidado de inmediato y se emitirá uno nuevo."}
            </p>
            <footer className="acciones-dialogo">
              <button
                type="button"
                className="secundario"
                autoFocus
                onClick={() => cambiarConfirmacion(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  const ruta =
                    confirmacion.accion === "restablecer"
                      ? "restablecer"
                      : "renovar-carne";
                  const personaConfirmada = confirmacion.persona;
                  cambiarConfirmacion(null);
                  void accion(
                    `/api/seguridad/personas/${personaConfirmada}/${ruta}`,
                  );
                }}
              >
                {confirmacion.accion === "restablecer"
                  ? "Restablecer acceso"
                  : "Revocar y renovar"}
              </button>
            </footer>
          </div>
        </Dialogo>
      )}
    </>
  );
}
