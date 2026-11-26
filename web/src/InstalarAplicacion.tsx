import { useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { obtenerInstalacion, observarInstalacion, solicitarInstalacion } from "./instalacionPwa";

export function InstalarAplicacion() {
  const { disponible, instalada, ocupada, aviso } = useSyncExternalStore(
    observarInstalacion, obtenerInstalacion,
  );
  if (instalada) return null;
  if (disponible || ocupada) {
    return (
      <div className="instalar-aplicacion">
        <button type="button" className="boton-instalar" disabled={ocupada}
          onClick={() => void solicitarInstalacion()}>
          <Download size={18} aria-hidden="true" />
          {ocupada ? "Abriendo instalación…" : "Instalar FyM Pass"}
        </button>
      </div>
    );
  }
  const esApple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const esAndroid = /Android/i.test(navigator.userAgent);
  return (
    <details className="instalar-aplicacion" open={aviso ? true : undefined}>
      <summary><Download size={18} aria-hidden="true" /> Cómo instalar FyM Pass</summary>
      <div>
        {aviso && <p role="status">{aviso}</p>}
        <p>Abre tu carnet o el panel desde un icono en tu dispositivo.</p>
        {!window.isSecureContext ? (
          <p>Abre la app mediante su dirección HTTPS para habilitar la instalación en este dispositivo.</p>
        ) : esApple ? (
          <p>En Safari, toca <strong>Compartir</strong>, elige <strong>Añadir a pantalla de inicio</strong> y confirma en <strong>Añadir</strong>.</p>
        ) : esAndroid ? (
          <p>Abre el menú del navegador y elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>. Confirma la instalación.</p>
        ) : (
          <p>En Chrome o Edge, abre el menú y busca la opción de instalar esta página como aplicación. Si el navegador habilita la instalación directa, aquí aparecerá el botón para instalar.</p>
        )}
        <small>Necesitas conexión para iniciar sesión, consultar el carnet y registrar asistencia.</small>
      </div>
    </details>
  );
}
