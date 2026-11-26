import { useEffect, useRef } from "react";
import type { Confirmacion } from "./servicio";
import { clasificarSonido, emitirSonido, prepararSonido } from "./sonidos";

export function SonidoAsistencia({ evento }: { evento: Confirmacion | null }) {
  const ultimo = useRef<Confirmacion | null>(null);
  useEffect(() => {
    if (navigator.userActivation?.hasBeenActive)
      void prepararSonido().catch(() => {});
  }, []);
  useEffect(() => {
    if (!evento || evento === ultimo.current) return;
    ultimo.current = evento;
    let cancelado = false;
    const inicio = Date.now();
    void prepararSonido()
      .then((contexto) => {
        if (
          !cancelado &&
          contexto.state === "running" &&
          Date.now() - inicio < 2000
        ) {
          emitirSonido(contexto, clasificarSonido(evento));
        }
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [evento]);
  return null;
}
