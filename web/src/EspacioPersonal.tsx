import { useEffect, useState } from "react";
import { CalendarDays, QrCode } from "lucide-react";
import { CarneVirtual } from "./CarneVirtual";
import { MisAsistencias } from "./MisAsistencias";

export function EspacioPersonal() {
  const [seccion, establecerSeccion] = useState(() =>
    location.hash === "#asistencias" ? "asistencias" : "carne",
  );
  useEffect(() => {
    const sincronizar = () =>
      establecerSeccion(
        location.hash === "#asistencias" ? "asistencias" : "carne",
      );
    window.addEventListener("hashchange", sincronizar);
    return () => window.removeEventListener("hashchange", sincronizar);
  }, []);
  return (
    <>
      <nav className="navegacion-personal" aria-label="Mi espacio">
        <a
          href="#carne"
          aria-current={seccion === "carne" ? "page" : undefined}
        >
          <QrCode size={18} aria-hidden="true" />
          Mi carnet
        </a>
        <a
          href="#asistencias"
          aria-current={seccion === "asistencias" ? "page" : undefined}
        >
          <CalendarDays size={18} aria-hidden="true" />
          Mis asistencias
        </a>
      </nav>
      {seccion === "carne" ? <CarneVirtual /> : <MisAsistencias />}
    </>
  );
}
