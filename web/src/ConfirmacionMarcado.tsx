import type { Confirmacion, Persona } from "./servicio";
import { horaLocal } from "./servicio";
export function AvatarPersona({
  persona,
}: {
  persona: Pick<Persona, "nombre" | "iniciales"> | null;
}) {
  return (
    <div
      className="foto-persona avatar"
      role="img"
      aria-label={
        persona
          ? `Iniciales de ${persona.nombre}`
          : "Identificación no disponible"
      }
    >
      {persona?.iniciales || "?"}
    </div>
  );
}
export function ConfirmacionMarcado({ evento }: { evento: Confirmacion }) {
  const resultado = evento.resultado.toLowerCase();
  const estado = !evento.aceptado
    ? "rechazada"
    : evento.repetido
      ? "informativa"
      : resultado.includes("tardanza")
        ? "tardia"
        : resultado.includes("puntual")
          ? "correcta"
          : "informativa";
  const mensaje = evento.resultado.replace(/[¡!]/g, "").trim().toLocaleUpperCase("es-PE");
  return (
    <div className={`confirmacion ${estado}`} role="status" aria-live="polite">
      <AvatarPersona persona={evento.persona} />
      <span className="etiqueta">
        {evento.persona?.rol || "Identificación no disponible"}
      </span>
      <h2>{evento.persona?.nombre || "QR no reconocido"}</h2>
      <div className="movimiento">
        {!evento.aceptado
          ? "Marcado rechazado"
          : evento.tipo
            ? evento.tipo === "entrada"
              ? "Entrada"
              : "Salida"
            : "Marcado rechazado"}{" "}
        <span>{horaLocal(evento.hora)}</span>
      </div>
      <p className="resultado">
        {mensaje}
      </p>
    </div>
  );
}
