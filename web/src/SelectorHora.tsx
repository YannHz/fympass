import { SelectorFiltro } from "./SelectorFiltro";

export function formatearHora(valor: string) {
  const [hora, minuto] = valor.split(":").map(Number);
  return `${hora % 12 || 12}:${String(minuto).padStart(2, "0")} ${hora >= 12 ? "p. m." : "a. m."}`;
}

export function SelectorHora({
  valor,
  alCambiar,
  etiqueta,
}: {
  valor: string;
  alCambiar: (valor: string) => void;
  etiqueta: string;
}) {
  const [hora, minuto] = (valor || "08:00").split(":").map(Number);
  const periodo = hora >= 12 ? "PM" : "AM";
  function actualizar(
    nuevaHora: number,
    nuevoMinuto: number,
    nuevoPeriodo: string,
  ) {
    const horas = (nuevaHora % 12) + (nuevoPeriodo === "PM" ? 12 : 0);
    alCambiar(
      `${String(horas).padStart(2, "0")}:${String(nuevoMinuto).padStart(2, "0")}`,
    );
  }
  return (
    <div className="selector-hora" role="group" aria-label={etiqueta}>
      <SelectorFiltro
        etiqueta={`${etiqueta}, hora`}
        enFormulario
        compacto
        valor={valor ? String(hora % 12 || 12) : ""}
        alCambiar={(valor) => {
          if (valor) actualizar(Number(valor), minuto, periodo);
        }}
        opciones={[
          ...(!valor ? [{ valor: "", texto: "—" }] : []),
          ...Array.from({ length: 12 }, (_, indice) => ({
            valor: String(indice + 1),
            texto: String(indice + 1),
          })),
        ]}
      />
      <span aria-hidden="true">:</span>
      <SelectorFiltro
        etiqueta={`${etiqueta}, minutos`}
        enFormulario
        compacto
        valor={valor ? String(minuto) : ""}
        alCambiar={(valor) => {
          if (valor) actualizar(hora, Number(valor), periodo);
        }}
        opciones={[
          ...(!valor ? [{ valor: "", texto: "—" }] : []),
          ...Array.from({ length: 60 }, (_, indice) => ({
            valor: String(indice),
            texto: String(indice).padStart(2, "0"),
          })),
        ]}
      />
      <SelectorFiltro
        etiqueta={`${etiqueta}, período`}
        enFormulario
        compacto
        valor={periodo}
        alCambiar={(valor) => actualizar(hora, minuto, valor)}
        opciones={[
          { valor: "AM", texto: "AM" },
          { valor: "PM", texto: "PM" },
        ]}
      />
    </div>
  );
}
