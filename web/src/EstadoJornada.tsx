import { useEffect, useState } from "react";
import { consultar } from "./servicio";

export function EstadoJornada({ revision }: { revision: number }) {
  const [ahora, establecerAhora] = useState(() => new Date());
  const [estado, establecerEstado] = useState<
    "consultando" | "abierto" | "cerrado" | "desconocido"
  >("consultando");
  useEffect(() => {
    let cancelado = false,
      enCurso = false;
    const control = new AbortController();
    async function actualizar() {
      if (cancelado || enCurso || document.hidden) return;
      enCurso = true;
      establecerAhora(new Date());
      try {
        const punto = await consultar("/api/asistencia/punto", {
          signal: AbortSignal.any([control.signal, AbortSignal.timeout(10000)]),
          cache: "no-store",
        });
        if (!cancelado) establecerEstado(punto.activo ? "abierto" : "cerrado");
      } catch {
        if (!cancelado) establecerEstado("desconocido");
      } finally {
        enCurso = false;
      }
    }
    const reanudar = () => {
      void actualizar();
    };
    void actualizar();
    const intervalo = setInterval(reanudar, 15000);
    window.addEventListener("focus", reanudar);
    window.addEventListener("fym-puesto-actualizado", reanudar);
    document.addEventListener("visibilitychange", reanudar);
    return () => {
      cancelado = true;
      control.abort();
      clearInterval(intervalo);
      window.removeEventListener("focus", reanudar);
      window.removeEventListener("fym-puesto-actualizado", reanudar);
      document.removeEventListener("visibilitychange", reanudar);
    };
  }, [revision]);
  const opciones = {
    timeZone: "America/Lima",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  } as const;
  const fecha = new Intl.DateTimeFormat("es-PE", opciones).format(ahora);
  const fechaCorta = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(ahora);
  const etiqueta = {
    consultando: "Consultando puesto…",
    abierto: "Puesto abierto",
    cerrado: "Puesto cerrado",
    desconocido: "Estado sin confirmar",
  }[estado];
  return (
    <div className="estado-jornada">
      <time
        dateTime={new Intl.DateTimeFormat("sv-SE", {
          timeZone: "America/Lima",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(ahora)}
      >
        <span className="fecha-completa">{fecha}</span>
        <span className="fecha-compacta">{fechaCorta}</span>
      </time>
      <span className="estado-puesto-barra" data-estado={estado} role="status">
        <span aria-hidden="true" />
        {etiqueta}
      </span>
    </div>
  );
}
