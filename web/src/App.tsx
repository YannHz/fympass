import { MenuCuenta } from "./MenuCuenta";
import { CentroSeguridad } from "./CentroSeguridad";
import { CambiarClaveInicial } from "./CambiarClaveInicial";
import { CampoClave } from "./CampoClave";
import { EspacioPersonal } from "./EspacioPersonal";
import { LogoInstitucional, MarcaInstitucional } from "./LogoInstitucional";
import { InstalarAplicacion } from "./InstalarAplicacion";
import { PanelAdministrativo } from "./PanelAdministrativo";
import { consultar } from "./servicio";
import { Dialogo } from "./componentesGestion";
import {
  ArrowRight as IconoContinuar,
  ShieldCheck as IconoSeguridad,
} from "lucide-react";
import { SelectorTema } from "./SelectorTema";
import { useEffect, useState, type FormEvent } from "react";
type Usuario = {
  id: number;
  nombre: string;
  iniciales: string;
  usuario: string;
  rol: string;
  permiso: string;
  sede: string;
  destino: string;
  debe_cambiar_clave: boolean;
  inactividad_minutos: number;
};
export function Aplicacion() {
  const [usuario, establecerUsuario] = useState<Usuario | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [ocupado, establecerOcupado] = useState(false);
  const [nombre, establecerNombre] = useState("");
  const [clave, establecerClave] = useState("");
  const [error, establecerError] = useState("");
  const [caducada, establecerCaducada] = useState(false);
  const [seguridad, mostrarSeguridad] = useState(false);
  const [avisoInactividad, mostrarAvisoInactividad] = useState(false);
  useEffect(() => {
    const abrir = () => mostrarSeguridad(true);
    window.addEventListener("fym-abrir-seguridad", abrir);
    return () => window.removeEventListener("fym-abrir-seguridad", abrir);
  }, []);
  useEffect(() => {
    if (!usuario || caducada) return;
    let ultima = Date.now(), ultimoEnvio = 0, pendiente = false;
    const actividad = () => { ultima = Date.now(); mostrarAvisoInactividad(false); };
    const enviar = async () => {
      if (pendiente || Date.now() - ultimoEnvio < 60000) return;
      pendiente = true; ultimoEnvio = Date.now();
      try { await consultar("/api/seguridad/actividad", { method: "POST" }); }
      catch { /* la renovacion de sesion se gestiona globalmente */ }
      finally { pendiente = false; }
    };
    const registrar = () => { actividad(); void enviar(); };
    window.addEventListener("pointerdown", registrar);
    window.addEventListener("keydown", registrar);
    const reloj = setInterval(() => {
      const minutos = usuario.inactividad_minutos || 30;
      const restante = minutos * 60000 - (Date.now() - ultima);
      mostrarAvisoInactividad(restante <= 120000);
      if (restante <= 0) {
        establecerCaducada(true); establecerClave("");
      }
    }, 10000);
    return () => { clearInterval(reloj); window.removeEventListener("pointerdown", registrar); window.removeEventListener("keydown", registrar); };
  }, [usuario?.id, caducada]);
  useEffect(() => {
    const cambiar = () => {
      establecerUsuario(actual => actual ? { ...actual, debe_cambiar_clave: true } : actual);
      window.history.replaceState(null, "", "/cambiar-clave");
    };
    window.addEventListener("fym-clave-pendiente", cambiar);
    return () => { window.removeEventListener("fym-clave-pendiente", cambiar); };
  }, []);
  function mostrarDestino(datos: Usuario) {
    establecerUsuario(datos);
    if (window.location.pathname !== "/mi-carne")
      window.history.replaceState(
        null,
        "",
        datos.debe_cambiar_clave ? "/cambiar-clave" : datos.destino + window.location.hash,
      );
  }
  useEffect(() => {
    fetch("/api/acceso/actual", {
      credentials: "same-origin",
      signal: AbortSignal.timeout(10000),
    })
      .then(async (respuesta) => {
        if (respuesta.ok) mostrarDestino(await respuesta.json());
        else if (respuesta.status === 401)
          window.history.replaceState(null, "", "/acceso");
        else
          establecerError(
            "No se pudo recuperar la sesión. Intenta iniciar sesión nuevamente.",
          );
      })
      .catch(() =>
        establecerError(
          "No se pudo conectar con el sistema. Comprueba que el servidor esté iniciado.",
        ),
      )
      .finally(() => establecerCargando(false));
  }, []);
  useEffect(() => {
    const caducar = () => {
      if (caducada) return;
      establecerCaducada(true);
      establecerError("");
      establecerClave("");
    };
    window.addEventListener("fym-sesion-caducada", caducar);
    return () => window.removeEventListener("fym-sesion-caducada", caducar);
  }, [caducada]);
  async function iniciarSesion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    establecerOcupado(true);
    establecerError("");
    try {
      const datos = await consultar("/api/acceso/iniciar", {
        method: "POST",
        body: JSON.stringify({
          usuario: caducada && usuario ? usuario.usuario : nombre,
          clave,
        }),
      });
      establecerClave("");

      if (caducada) {
        establecerUsuario(datos);
        establecerCaducada(false);
        window.dispatchEvent(new Event("fym-sesion-renovada"));
      } else mostrarDestino(datos);
    } catch (problema) {
      establecerError(
        problema instanceof TypeError ||
          (problema instanceof Error && problema.name === "TimeoutError")
          ? "No se pudo conectar. Revisa el servidor e intenta nuevamente."
          : (problema as Error).message,
      );
    } finally {
      establecerOcupado(false);
    }
  }
  async function cerrarSesion() {
    establecerOcupado(true);
    establecerError("");
    try {
      await consultar("/api/acceso/cerrar", { method: "POST" });
      establecerUsuario(null);
      establecerCaducada(false);
      establecerClave("");
      establecerNombre("");
      window.history.replaceState(null, "", "/acceso");
    } catch {
      establecerError(
        "No se pudo cerrar la sesión. Comprueba la conexión y vuelve a intentar.",
      );
    } finally {
      establecerOcupado(false);
    }
  }
  if (cargando)
    return (
      <main className="espera" role="status">
        Preparando FyM Pass…
      </main>
    );
  if (!usuario)
    return (
      <div className="acceso">
        <div className="apariencia-acceso">
          <SelectorTema />
        </div>
        <section className="presentacion">
          <a className="marca" href="/">
            <MarcaInstitucional />
          </a>
          <div className="contenido-presentacion">
            <span className="etiqueta">ISTP FINNEY &amp; MILLER</span>
            <h1>
              Tu ingreso a
              <br />
              <span className="acento-titulo">Finney y Miller.</span>
            </h1>
            <p>
              El sistema de asistencia para docentes y personal
              administrativo.
              <br />
              Usa tu carnet virtual y revisa tus registros.
            </p>
            <div className="vista-pase" aria-hidden="true">
              <div className="cabecera-vista-pase">
                <span>FINNEY &amp; MILLER</span>
                <LogoInstitucional clase="logo-pase" />
              </div>
              <strong>
                Tu ingreso,
                <br />a un escaneo.
              </strong>
              <div className="pie-vista-pase">
                <span>Acceso institucional</span>
                <span>FyM Pass</span>
              </div>
            </div>
          </div>
        </section>
        <main className="formulario-acceso">
          <form onSubmit={iniciarSesion}>
            <span className="simbolo-acceso" aria-hidden="true">
              <LogoInstitucional clase="logo-acceso" />
            </span>
            <span className="etiqueta">ACCESO INSTITUCIONAL</span>
            <h2>Bienvenido de nuevo</h2>
            <p>
              Ingresa con tu cuenta. El sistema te llevará al espacio que te
              corresponde.
            </p>
            <label htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
              name="username"
              autoComplete="username"
              maxLength={80}
              required
              value={nombre}
              onChange={(evento) => establecerNombre(evento.target.value)}
              disabled={ocupado}
            />
            <label htmlFor="clave">Contraseña</label>
            <CampoClave id="clave" nombre="password" etiqueta="contraseña" valor={clave}
              alCambiar={establecerClave} autocompletar="current-password" deshabilitado={ocupado} />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button
              className="ingresar"
              disabled={ocupado || !nombre.trim() || !clave}
            >
              {ocupado ? "Ingresando…" : "Iniciar sesión"}
              <IconoContinuar size={18} aria-hidden="true" />
            </button>
            <div className="seguridad-acceso">
              <IconoSeguridad size={16} aria-hidden="true" />
              Tu cuenta, tu acceso institucional.
            </div>
            <p className="ayuda">
              ¿Necesitas una cuenta? Contacta al encargado del instituto.
            </p>
            <InstalarAplicacion />
          </form>
        </main>
      </div>
    );
  if (usuario.debe_cambiar_clave)
    return <CambiarClaveInicial alCambiar={mostrarDestino} alCerrar={() => void cerrarSesion()} />;
  if (seguridad && !caducada)
    return <CentroSeguridad alVolver={() => {
      mostrarSeguridad(false); void consultar("/api/acceso/actual").then(mostrarDestino);
    }} alActualizar={mostrarDestino} alCerrar={() => void cerrarSesion()} />;
  const administrativo =
    usuario.permiso !== "personal" && window.location.pathname !== "/mi-carne";
  return (
    <>
      {avisoInactividad && !caducada && <div className="aviso-inactividad" role="status">
        Tu sesión está por vencer por inactividad. <button className="secundario" onClick={() => {
          void consultar("/api/seguridad/actividad", { method: "POST" }).then(() => mostrarAvisoInactividad(false));
        }}>Continuar trabajando</button>
      </div>}
      {administrativo ? (
        <PanelAdministrativo
          usuario={usuario}
          alCerrar={() => void cerrarSesion()}
          cerrando={ocupado}
          errorSesion={caducada ? "" : error}
        />
      ) : (
        <div className="acceso-personal">
          <header className="cabecera-personal">
            <a className="marca" href={usuario.destino}>
              <MarcaInstitucional />
            </a>
            <div className="acciones-personales">
              <SelectorTema />
              <MenuCuenta texto="Mi cuenta">
                <strong>{usuario.nombre}</strong>
                <p>{usuario.sede}</p>
                {usuario.permiso !== "personal" && (
                  <a href={usuario.destino}>Volver al panel</a>
                )}
                <InstalarAplicacion />
                <button
                  className="secundario"
                  onClick={() => void cerrarSesion()}
                  disabled={ocupado}
                >
                  {ocupado ? "Cerrando…" : "Cerrar sesión"}
                </button>
              </MenuCuenta>
            </div>
          </header>
          <main className="contenido-personal">
            {!caducada && error && (
              <p className="aviso error" role="alert">
                {error}
              </p>
            )}
            <EspacioPersonal />
          </main>
        </div>
      )}
      {caducada && (
        <Dialogo
          titulo="Tu sesión caducó"
          cerrar={() => {
            establecerUsuario(null);
            establecerCaducada(false);
            establecerError("");
            window.history.replaceState(null, "", "/acceso");
          }}
        >
          <form className="formulario-gestion formulario-renovar-sesion" onSubmit={iniciarSesion}>
            <p>
              Vuelve a entrar como {usuario.usuario} para continuar. Tus cambios
              sin guardar permanecen en esta ventana.
            </p>
            <label htmlFor="clave-renovar">Contraseña</label>
            <CampoClave id="clave-renovar" nombre="password" etiqueta="contraseña" valor={clave}
              alCambiar={establecerClave} autocompletar="current-password" deshabilitado={ocupado} enfocar />
            {error && (
              <p className="aviso error" role="alert">
                {error}
              </p>
            )}
            <footer className="acciones-dialogo">
              <button
                type="button"
                className="secundario"
                onClick={() => {
                  establecerUsuario(null);
                  establecerCaducada(false);
                  establecerError("");
                  window.history.replaceState(null, "", "/acceso");
                }}
              >
                Salir del espacio
              </button>
              <button disabled={ocupado || !clave}>
                {ocupado ? "Ingresando…" : "Continuar sesión"}
              </button>
            </footer>
          </form>
        </Dialogo>
      )}
    </>
  );
}
