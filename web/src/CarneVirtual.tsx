import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ScanLine as IconoEscaneo,
  X as IconoCerrar,
  BadgeCheck as IconoIdentidad,
} from "lucide-react";
import { consultar, type Carne, type Confirmacion } from "./servicio";
import { AvatarPersona, ConfirmacionMarcado } from "./ConfirmacionMarcado";
import { lazy, Suspense } from "react";
const LectorCamara = lazy(() =>
  import("./LectorCamara").then((modulo) => ({ default: modulo.LectorCamara })),
);
import { SonidoAsistencia } from "./SonidoAsistencia";
export function CarneVirtual() {
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    const renovar = () => establecerRevision((valor) => valor + 1);
    window.addEventListener("fym-sesion-renovada", renovar);
    return () => window.removeEventListener("fym-sesion-renovada", renovar);
  }, []);
  const [carne, establecerCarne] = useState<Carne | null>(null);
  const [error, establecerError] = useState("");
  const [escaneando, establecerEscaneando] = useState(false);
  const [evento, establecerEvento] = useState<Confirmacion | null>(null);
  const ocupado = useRef(false);
  const tiempo = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    let cancelado = false;
    establecerError("");
    consultar("/api/carne")
      .then((datos) => {
        if (!cancelado) establecerCarne(datos);
      })
      .catch((problema) => {
        if (!cancelado) establecerError(problema.message);
      });
    return () => {
      cancelado = true;
      clearTimeout(tiempo.current);
    };
  }, [revision]);
  async function marcar(contenido: string) {
    if (ocupado.current) return;
    ocupado.current = true;
    establecerError("");
    try {
      const datos: Confirmacion = await consultar("/api/carne/marcar", {
        method: "POST",
        body: JSON.stringify({
          contenido,
          identificador_evento: crypto.randomUUID(),
        }),
      });
      establecerEvento(
        datos.repetido
          ? { ...datos, resultado: "La asistencia ya fue marcada" }
          : datos,
      );
      tiempo.current = setTimeout(() => {
        establecerEvento(null);
        establecerEscaneando(false);
        ocupado.current = false;
      }, 3000);
    } catch (problema) {
      establecerError((problema as Error).message);
      ocupado.current = false;
    }
  }
  return (
    <section
      className={`panel zona-carne ${escaneando ? "escaneando" : ""}`}
      aria-label="Mi carnet"
    >
      <div className="titulo-carne">
        <p>Muéstralo en la entrada o escanea el QR del puesto.</p>
      </div>
      {error && (
        <p role="alert" className="aviso error">
          {error}
        </p>
      )}
      {carne ? (
        <>
          <button
            className="escanear-movil"
            aria-expanded={escaneando}
            aria-controls="camara-carne"
            onClick={() => {
              establecerEscaneando(!escaneando);
              establecerError("");
            }}
          >
            {escaneando ? (
              <IconoCerrar size={20} aria-hidden="true" />
            ) : (
              <IconoEscaneo size={20} aria-hidden="true" />
            )}
            {escaneando ? "Cerrar cámara" : "Escanear QR del instituto"}
          </button>
          <div className="carne">
            <div className="identidad-carne">
              <AvatarPersona persona={carne} />
              <h3>{carne.nombre}</h3>
              <p>
                {carne.rol} · {carne.codigo}
              </p>
            </div>
            <div className="talon-carne">
              <div className="qr-carne">
                <QRCodeSVG
                  value={carne.qr}
                  size={240}
                  level="M"
                  marginSize={4}
                  title="QR de mi carnet virtual"
                />
              </div>
              <span className="detalle-carne">
                <IconoIdentidad size={16} aria-hidden="true" />
                Identificación institucional
              </span>
              <small>Presenta este código en la cámara del puesto.</small>
            </div>
          </div>

          {escaneando && (
            <div id="camara-carne" className="camara-carne">
              <Suspense fallback={<p role="status">Cargando cámara…</p>}>
                <LectorCamara
                  habilitada={escaneando}
                  bloqueada={Boolean(evento)}
                  alLeer={(valor) => void marcar(valor)}
                />
              </Suspense>
            </div>
          )}
        </>
      ) : (
        !error && (
          <p className="carga" role="status">
            Cargando carnet…
          </p>
        )
      )}
      <SonidoAsistencia evento={evento} />
      {evento && (
        <div className="confirmacion-puesto">
          <ConfirmacionMarcado evento={evento} />
        </div>
      )}
    </section>
  );
}
