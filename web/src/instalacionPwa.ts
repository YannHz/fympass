type SolicitudInstalacion = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let estado = { disponible: false, instalada: false, ocupada: false, aviso: "" };
let solicitud: SolicitudInstalacion | null = null;
let iniciada = false;
const oyentes = new Set<() => void>();

function actualizar(cambios: Partial<typeof estado>) {
  estado = { ...estado, ...cambios };
  oyentes.forEach((oyente) => oyente());
}

export function observarInstalacion(oyente: () => void) {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
}

export function obtenerInstalacion() { return estado; }

export function iniciarInstalacionPwa() {
  if (iniciada) return;
  iniciada = true;
  const modo = window.matchMedia("(display-mode: standalone)");
  actualizar({ instalada: modo.matches || Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  ) });
  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    solicitud = evento as SolicitudInstalacion;
    actualizar({ disponible: true, aviso: "" });
  });
  window.addEventListener("appinstalled", () => {
    solicitud = null;
    actualizar({ instalada: true, disponible: false, aviso: "" });
  });
  modo.addEventListener("change", (evento) => actualizar({ instalada: evento.matches }));
}

export async function solicitarInstalacion() {
  if (!solicitud || estado.ocupada || estado.instalada) return;
  const pendiente = solicitud;
  // cada evento permite una sola solicitud y debe abrirse desde el clic
  solicitud = null;
  actualizar({ disponible: false, ocupada: true, aviso: "" });
  try {
    await pendiente.prompt();
    const resultado = await pendiente.userChoice;
    if (resultado.outcome === "accepted") actualizar({ instalada: true });
    else actualizar({ aviso: "Cancelaste la instalación. Puedes instalarla después desde el menú del navegador." });
  } catch {
    actualizar({ aviso: "No se pudo abrir la instalación. Puedes intentarlo desde el menú del navegador." });
  } finally {
    actualizar({ ocupada: false });
  }
}
