import { useState, type FormEvent } from "react";
import { consultar } from "./servicio";
import { CampoClave } from "./CampoClave";

export function CambiarClaveInicial({ alCambiar, alCerrar, requiereActual = false }: {
  requiereActual?: boolean;
  alCambiar: (datos: any) => void; alCerrar: () => void;
}) {
  const [clave, cambiarClave] = useState("");
  const [confirmacion, cambiarConfirmacion] = useState("");
  const [actual, cambiarActual] = useState("");
  const [ocupado, cambiarOcupado] = useState(false);
  const [error, cambiarError] = useState("");
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    if (clave !== confirmacion) {
      cambiarError("Las contraseñas no coinciden.");
      return;
    }
    cambiarOcupado(true);
    cambiarError("");
    try {
      const datos = await consultar("/api/acceso/cambiar-clave", {
        method: "POST", body: JSON.stringify({ clave, confirmacion, actual }),
      });
      cambiarClave("");
      cambiarConfirmacion("");
      alCambiar(datos);
    } catch (problema) { cambiarError((problema as Error).message); }
    finally { cambiarOcupado(false); }
  }
  return <main className="formulario-acceso">
    <form onSubmit={guardar}>
      <h1>Establece tu contraseña</h1>
      <p>Usa entre 8 y 256 caracteres. Puedes escribir una frase con espacios. Evita tu nombre, usuario y contraseñas comunes.</p>
      {requiereActual && <>
        <label htmlFor="clave-actual">Contraseña actual</label>
        <CampoClave id="clave-actual" nombre="clave-actual" etiqueta="contraseña actual" valor={actual}
          alCambiar={cambiarActual} autocompletar="current-password" deshabilitado={ocupado} />
      </>}
      <label htmlFor="nueva-clave">Nueva contraseña</label>
      <CampoClave id="nueva-clave" nombre="nueva-clave" etiqueta="nueva contraseña" valor={clave}
        alCambiar={cambiarClave} autocompletar="new-password" longitudMinima={8} deshabilitado={ocupado} />
      <label htmlFor="confirmar-clave">Confirma tu nueva contraseña</label>
      <CampoClave id="confirmar-clave" nombre="confirmar-clave" etiqueta="confirmación de contraseña" valor={confirmacion}
        alCambiar={cambiarConfirmacion} autocompletar="new-password" longitudMinima={8} deshabilitado={ocupado} />
      {error && <p role="alert" className="error">{error}</p>}
      <p className="nota" role="status">{clave.length}/8 caracteres mínimos{confirmacion ? clave === confirmacion ? " · Las contraseñas coinciden." : " · Las contraseñas todavía no coinciden." : ""}</p>
      <div className="acciones-clave-inicial">
      <button disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar y continuar"}</button>
      <button type="button" className="boton-texto" disabled={ocupado}
        onClick={alCerrar}>Cerrar sesión</button>
      </div>
    </form>
  </main>;
}
