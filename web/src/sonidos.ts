import type { Confirmacion } from "./servicio";

export type TipoSonido = "entrada" | "salida" | "repetido" | "rechazado";

export function clasificarSonido(evento: Confirmacion): TipoSonido {
  if (evento.repetido || /ya est[áa].*registrad/i.test(evento.resultado))
    return "repetido";
  if (!evento.aceptado) return "rechazado";
  return evento.tipo === "salida" ? "salida" : "entrada";
}

export function emitirSonido(contexto: AudioContext, tipo: TipoSonido) {
  const notas: Record<TipoSonido, number[]> = {
    entrada: [880, 1174.66],
    salida: [1174.66, 880],
    repetido: [660, 660],
    rechazado: [392, 330],
  };
  notas[tipo].forEach((frecuencia, indice) => {
    const inicio = contexto.currentTime + indice * 0.14;
    const oscilador = contexto.createOscillator();
    const volumen = contexto.createGain();
    oscilador.type = "sine";
    oscilador.frequency.value = frecuencia;
    volumen.gain.setValueAtTime(0, inicio);
    volumen.gain.linearRampToValueAtTime(0.12, inicio + 0.012);
    volumen.gain.exponentialRampToValueAtTime(0.001, inicio + 0.22);
    oscilador.connect(volumen);
    volumen.connect(contexto.destination);
    oscilador.onended = () => {
      oscilador.disconnect();
      volumen.disconnect();
    };
    oscilador.start(inicio);
    oscilador.stop(inicio + 0.24);
  });
}

let contextoCompartido: AudioContext | null = null;

export async function prepararSonido() {
  if (!contextoCompartido || contextoCompartido.state === "closed")
    contextoCompartido = new AudioContext();
  if (contextoCompartido.state !== "running") await contextoCompartido.resume();
  return contextoCompartido;
}

export function iniciarSonido() {
  const preparar = () => {
    void prepararSonido().catch(() => {});
  };
  document.addEventListener("pointerdown", preparar, {
    capture: true,
    passive: true,
  });
  document.addEventListener("touchend", preparar, {
    capture: true,
    passive: true,
  });
  document.addEventListener("keydown", preparar, { capture: true });
}
