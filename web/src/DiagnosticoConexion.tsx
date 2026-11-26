import { useEffect, useRef, useState } from "react";
import { Copy, RefreshCw, Server, Database, Smartphone } from "lucide-react";
type Resultado = {
  estado?: string;
  motor?: string;
  restringido?: boolean;
};
async function comprobar(ruta: string): Promise<Resultado | null> {
  try {
    const respuesta = await fetch(ruta, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(5000),
    });
    if (respuesta.status === 401 || respuesta.status === 403)
      return { restringido: true };
    if (!respuesta.ok) return null;
    return await respuesta.json();
  } catch {
    return null;
  }
}
export function DiagnosticoConexion() {
  const [api, establecerApi] = useState<boolean | null>(null);
  const [base, establecerBase] = useState<Resultado | null>(null);
  const [ocupado, establecerOcupado] = useState(false);
  const [hora, establecerHora] = useState("");
  const [aviso, establecerAviso] = useState("");
  const montado = useRef(false),
    consultando = useRef(false),
    version = useRef(0);
  async function actualizar() {
    if (consultando.current) return;
    consultando.current = true;
    const actual = version.current;
    establecerOcupado(true);
    const [salud, datos] = await Promise.all([
      comprobar("/api/salud"),
      comprobar("/api/salud/base-datos"),
    ]);
    if (montado.current && actual === version.current) {
      establecerApi(salud?.estado === "disponible");
      establecerBase(datos);
      establecerHora(
        new Intl.DateTimeFormat("es-PE", {
          timeZone: "America/Lima",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date()),
      );
      establecerOcupado(false);
    }
    if (actual === version.current) consultando.current = false;
  }
  useEffect(() => {
    montado.current = true;
    void actualizar();
    const intervalo = setInterval(() => void actualizar(), 30000);
    return () => {
      montado.current = false;
      version.current++;
      consultando.current = false;
      clearInterval(intervalo);
    };
  }, []);
  const disponible = base?.estado === "disponible";
  return (
    <details
      className="diagnostico-conexion"
      aria-label="Diagnóstico de conexión"
    >
      <summary>
        <span>Conexión del sistema</span>
        <span
          className={`insignia ${api === null ? "neutral" : api && disponible ? "bien" : "alerta"}`}
        >
          {api === null
            ? "Comprobando…"
            : api && disponible
              ? "Disponible"
              : "Requiere atención"}
        </span>
      </summary>
      <div className="cabecera">
        <div>
          <h2>Conexión del sistema</h2>
          <p>Comprueba el servidor antes de abrir la jornada.</p>
        </div>
        <button
          className="secundario"
          disabled={ocupado}
          onClick={() => void actualizar()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {ocupado ? "Comprobando…" : "Comprobar conexión"}
        </button>
      </div>
      <div className="estados-conexion" aria-live="polite">
        <div>
          <Server size={20} aria-hidden="true" />
          <strong>API</strong>
          <span
            className={`insignia ${api === null ? "neutral" : api ? "bien" : "alerta"}`}
          >
            {api === null
              ? "Sin comprobar"
              : api
                ? "Disponible"
                : "Sin conexión"}
          </span>
        </div>
        <div>
          <Database size={20} aria-hidden="true" />
          <strong>{base?.motor || "MySQL / MariaDB"}</strong>
          <span
            className={`insignia ${!hora ? "neutral" : disponible ? "bien" : "alerta"}`}
          >
            {!hora
              ? "Sin comprobar"
              : base?.restringido
                ? "Acceso restringido"
              : disponible
                ? "Disponible"
                : api
                  ? "Sin conexión"
                  : "No se pudo comprobar"}
          </span>
        </div>
      </div>
      {api === false && (
        <p>
          Comprueba la conexión a internet y el estado del servidor. Los
          marcados requieren conexión.
        </p>
      )}
      {api && hora && base?.restringido && (
        <p>Completa el cambio de contraseña o vuelve a iniciar sesión para comprobar la base de datos.</p>
      )}
      {api && hora && !disponible && !base?.restringido && (
        <p>
          La API responde, pero la base no está disponible. Revisa el servicio
          de base de datos y la configuración del servidor.
        </p>
      )}
      <div className="conexion-movil">
        <Smartphone size={20} aria-hidden="true" />
        <div>
          <strong>Acceso desde otro dispositivo</strong>
          {["127.0.0.1", "localhost", "[::1]"].includes(
            window.location.hostname,
          ) ? (
            <p>
              Esta dirección es local a esta computadora. Para entrar desde un
              teléfono se necesita una dirección accesible por red y HTTPS
              válido; copiar localhost no permite conectarse.
            </p>
          ) : (
            <>
              <code>{window.location.origin}</code>
              <p>
                Abre esta dirección en el navegador. La cámara y la instalación
                requieren HTTPS.
              </p>
              <button
                className="boton-texto"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.origin);
                    establecerAviso("Dirección copiada.");
                  } catch {
                    establecerAviso("No se pudo copiar la dirección.");
                  }
                }}
              >
                <Copy size={16} aria-hidden="true" />
                Copiar dirección
              </button>
            </>
          )}
        </div>
      </div>
      <small>
        {hora
          ? `Última comprobación: ${hora} · Lima. Se actualiza cada 30 segundos.`
          : "Preparando diagnóstico…"}
      </small>
      {aviso && <p role="status">{aviso}</p>}
    </details>
  );
}
