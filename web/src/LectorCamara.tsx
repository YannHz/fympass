import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

export function LectorCamara({
  habilitada,
  bloqueada,
  alLeer,
  orientacion = "environment",
}: {
  habilitada: boolean;
  bloqueada: boolean;
  alLeer: (valor: string) => void;
  orientacion?: "environment" | "user";
}) {
  const video = useRef<HTMLVideoElement>(null);
  const controles = useRef<IScannerControls | null>(null);
  const leer = useRef(alLeer);
  const bloqueado = useRef(bloqueada);
  const ultima = useRef({ contenido: "", vista: 0 });
  const [solicitada, establecerSolicitada] = useState(false);
  const [error, establecerError] = useState("");
  const [lista, establecerLista] = useState(false);
  leer.current = alLeer;
  bloqueado.current = bloqueada;
  useEffect(() => {
    if (!habilitada || !solicitada || !video.current) return;
    let cancelado = false;
    establecerError("");
    establecerLista(false);
    const lector = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 250,
    });
    lector
      .decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: orientacion },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        video.current,
        (resultado) => {
          if (cancelado) return;
          const ahora = Date.now();
          if (!resultado) {
            if (ahora - ultima.current.vista > 1500)
              ultima.current.contenido = "";
            return;
          }
          if (bloqueado.current) return;
          const contenido = resultado.getText();
          const repetida = contenido === ultima.current.contenido;
          ultima.current = { contenido, vista: ahora };
          if (repetida) return;
          leer.current(contenido);
        },
      )
      .then((control) => {
        if (cancelado) control.stop();
        else {
          controles.current = control;
          const flujo = video.current?.srcObject as MediaStream | null;
          const pista = flujo?.getVideoTracks()[0];
          const capacidades = pista?.getCapabilities?.() as
            | (MediaTrackCapabilities & { focusMode?: string[] })
            | undefined;
          if (pista && capacidades?.focusMode?.includes("continuous")) {
            void pista
              .applyConstraints({
                advanced: [
                  { focusMode: "continuous" } as MediaTrackConstraintSet,
                ],
              })
              .catch(() => {});
          }
          establecerLista(true);
        }
      })
      .catch(() => {
        if (!cancelado)
          establecerError(
            "No se pudo abrir la cámara. Revisa el permiso, la conexión HTTPS y que otra aplicación no la esté usando.",
          );
      });
    return () => {
      cancelado = true;
      controles.current?.stop();
      controles.current = null;
      establecerLista(false);
    };
  }, [habilitada, solicitada, orientacion]);
  return (
    <div className="lector">
      <div className="visor">
        <video
          ref={video}
          style={{
            transform: orientacion === "user" ? "scaleX(-1)" : undefined,
          }}
          muted
          playsInline
          aria-label="Vista de la cámara para leer códigos QR"
        />
        {lista && (
          <div className="marco-qr">
            <span>Centra tu QR aquí</span>
          </div>
        )}
        {!lista && (
          <div className="camara-vacia">
            <span aria-hidden="true">▣</span>
            <p>
              {error ||
                "La cámara se usa para leer el QR. No se graban imágenes."}
            </p>
            <button
              onClick={() => {
                establecerSolicitada(false);
                window.setTimeout(() => establecerSolicitada(true), 0);
              }}
            >
              {solicitada && !error
                ? "Solicitar cámara nuevamente"
                : error
                  ? "Reintentar cámara"
                  : "Activar cámara"}
            </button>
          </div>
        )}
      </div>
      <p className="nota">
        Mantén el QR completo dentro del marco, con buena luz y sin reflejos. Si
        está borroso, aléjalo un poco.
      </p>
    </div>
  );
}
