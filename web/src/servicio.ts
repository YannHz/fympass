export type Persona = {
  nombre: string;
  rol: string;
  iniciales: string;
  codigo: string;
};
export type Confirmacion = {
  id: number;
  persona: Persona | null;
  tipo: string | null;
  hora: string;
  resultado: string;
  aceptado: boolean;
  repetido: boolean;
};
export type Carne = Persona & {
  sede: string;
  qr: string;
};
export class ErrorSolicitud extends Error {
  constructor(
    mensaje: string,
    public codigo: number,
    public campos: Record<string, string> = {},
  ) {
    super(mensaje);
    this.name = "ErrorSolicitud";
  }
}
export async function solicitar(ruta: string, opciones: RequestInit = {}) {
  const escritura = !["GET", "HEAD"].includes(opciones.method || "GET");
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      ...opciones,
      credentials: "same-origin",
      signal: opciones.signal || AbortSignal.timeout(15000),
      headers: {
        ...(opciones.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        "X-Fym-Peticion": "1",
        ...opciones.headers,
      },
    });
  } catch {
    throw new ErrorSolicitud(
      escritura
        ? "No se pudo confirmar la operación. Comprueba los registros antes de repetirla."
        : "No se pudo conectar con el servidor. Comprueba la conexión y vuelve a intentar.",
      0,
    );
  }
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    if (respuesta.status === 403 && datos.detail === "Establece tu nueva contraseña para continuar.")
      window.dispatchEvent(new Event("fym-clave-pendiente"));
    const campos: Record<string, string> = {};
    if (Array.isArray(datos.detail))
      for (const error of datos.detail) {
        const campo = (error.loc || [])
          .filter((parte: unknown) => parte !== "body")
          .join(".");
        campos[campo] =
          error.type === "string_too_short"
            ? `Escribe al menos ${error.ctx?.min_length} caracteres.`
            : error.type === "string_too_long"
              ? `Usa como máximo ${error.ctx?.max_length} caracteres.`
              : error.type === "int_parsing" || error.type === "int_from_float"
                ? "Introduce un número entero."
                : "Revisa este valor y sus límites.";
      }
    if (
      respuesta.status === 401 &&
      !ruta.startsWith("/api/puesto/") &&
      !ruta.startsWith("/api/acceso/")
    )
      window.dispatchEvent(new Event("fym-sesion-caducada"));
    throw new ErrorSolicitud(
      typeof datos.detail === "string"
        ? datos.detail
        : Object.keys(campos).length
          ? "Revisa los campos indicados."
          : "El servidor no pudo completar la solicitud.",
      respuesta.status,
      campos,
    );
  }
  return respuesta;
}
export async function consultar(ruta: string, opciones?: RequestInit) {
  return (await solicitar(ruta, opciones)).json();
}
export function horaLocal(valor: string) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(valor));
}
