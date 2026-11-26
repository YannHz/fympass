import { useEffect, useRef, useState, type ReactNode } from "react";
import { FileCheck2, RefreshCw, X } from "lucide-react";
import { consultar } from "./servicio";
export type Registro = Record<string, any>;
export function useDatos(
  ruta: string | null,
  revision: number,
  intervaloMs = 0,
  enVivo = false,
) {
  const claveConsulta = `${ruta}|${revision}`;
  const [resuelta, establecerResuelta] = useState("");
  const [datos, establecerDatos] = useState<any>(null);
  const [error, establecerError] = useState("");
  const [cargando, establecerCargando] = useState(false);
  const [actualizadoEn, establecerActualizadoEn] = useState<number | null>(
    null,
  );
  useEffect(() => {
    let cancelado = false,
      enCurso = false,
      pendiente = false;
    let control: AbortController | null = null;
    establecerDatos(null);
    establecerError("");
    establecerActualizadoEn(null);
    if (!ruta) {
      establecerCargando(false);
      establecerResuelta(claveConsulta);
      return;
    }
    establecerCargando(true);
    async function actualizar(inicial = false) {
      if (cancelado || (!inicial && document.hidden)) return;
      if (enCurso) {
        pendiente = true;
        return;
      }
      enCurso = true;
      control = new AbortController();
      try {
        const respuesta = await consultar(ruta!, {
          signal: AbortSignal.any([control.signal, AbortSignal.timeout(15000)]),
        });
        if (!cancelado) {
          establecerDatos(respuesta);
          establecerResuelta(claveConsulta);
          establecerError("");
          establecerActualizadoEn(Date.now());
        }
      } catch (problema) {
        if (!cancelado) establecerError((problema as Error).message);
      } finally {
        enCurso = false;
        if (!cancelado) {
          establecerCargando(false);
          if (pendiente) {
            pendiente = false;
            void actualizar();
          }
        }
      }
    }
    const controlAvisos = new AbortController();
    let demora: ReturnType<typeof setTimeout> | undefined;
    let despertarDemora: (() => void) | undefined;
    async function escuchar() {
      let version = "";
      while (!cancelado) {
        try {
          const respuesta = await consultar(
            `/api/asistencia/cambios?version=${encodeURIComponent(version)}`,
            {
              signal: AbortSignal.any([
                controlAvisos.signal,
                AbortSignal.timeout(30000),
              ]),
            },
          );
          if (cancelado) return;
          if (respuesta.version !== version) {
            version = respuesta.version;
            void actualizar();
          }
        } catch {
          if (cancelado) return;
          void actualizar();
          await new Promise<void>((resolver) => {
            despertarDemora = resolver;
            demora = setTimeout(resolver, 3000);
          });
        }
      }
    }
    void actualizar(true);
    if (enVivo) void escuchar();
    const reanudar = () => {
      if (!document.hidden) void actualizar();
    };
    const intervalo =
      intervaloMs > 0
        ? setInterval(() => void actualizar(), intervaloMs)
        : undefined;
    if (intervaloMs > 0 || enVivo) {
      document.addEventListener("visibilitychange", reanudar);
      window.addEventListener("focus", reanudar);
    }
    return () => {
      cancelado = true;
      control?.abort();
      controlAvisos.abort();
      clearTimeout(demora);
      despertarDemora?.();
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", reanudar);
      window.removeEventListener("focus", reanudar);
    };
  }, [ruta, revision, intervaloMs, enVivo]);
  return {
    datos: resuelta === claveConsulta ? datos : null,
    error,
    actualizadoEn,
    cargando:
      Boolean(ruta) &&
      (cargando || Boolean(resuelta !== claveConsulta && !error)),
  };
}
export function Estado({
  cargando,
  error,
}: {
  cargando?: boolean;
  error?: string;
}) {
  return error ? (
    <div className="aviso error" role="alert">
      {error}
    </div>
  ) : cargando ? (
    <div className="carga" role="status">
      <RefreshCw size={18} className="girando" aria-hidden="true" /> Consultando
      los registros…
    </div>
  ) : null;
}
export function Insignia({ texto }: { texto: string }) {
  const clase = /Tardanza|Observación|pendiente/i.test(texto)
    ? "atencion"
    : /Falta|Alerta|observada|Desactiv/i.test(texto)
      ? "alerta"
      : /Puntual|Regular|Justificado|aprobada|Activ[oa]/i.test(texto)
        ? "bien"
        : "neutral";
  return <span className={`insignia ${clase}`}>{texto}</span>;
}
export function Vacio({
  titulo = "Todavía no hay registros.",
  detalle,
  accion,
}: {
  titulo?: string;
  detalle?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="vacio">
      <span className="simbolo-vacio">
        <FileCheck2 size={26} />
      </span>
      <h3>{titulo}</h3>
      {detalle && <p>{detalle}</p>}
      {accion}
    </div>
  );
}
export function Tabla({
  columnas,
  filas,
  clave = "id",
  paginacionInterna = true,
  titulo = "Resultados",
}: {
  columnas: {
    titulo: string;
    mostrar: (fila: Registro) => ReactNode;
  }[];
  filas: Registro[];
  clave?: string;
  paginacionInterna?: boolean;
  titulo?: string;
}) {
  const [pagina, establecerPagina] = useState(1);
  const firma = filas
    .map((fila) => String(fila[clave]) + String(fila.fecha || ""))
    .join("|");
  useEffect(() => establecerPagina(1), [firma]);
  const paginas = paginacionInterna ? Math.max(1, Math.ceil(filas.length / 12)) : 1,
    actual = Math.min(pagina, paginas);
  if (!filas.length)
    return (
      <Vacio detalle="Los datos aparecerán aquí cuando registres información o cambies los filtros." />
    );
  return (
    <>
      <div className="tabla-contenedor" role="region" aria-label={titulo} tabIndex={0}>
        <table>
          <caption className="solo-lector">{titulo}</caption>
          <thead>
            <tr>
              {columnas.map((columna) => (
                <th scope="col" key={columna.titulo}>
                  {columna.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.slice((actual - 1) * 12, actual * 12).map((fila, indice) => (
              <tr
                key={String(fila[clave] ?? indice) + String(fila.fecha || "")}
              >
                {columnas.map((columna) => (
                  <td key={columna.titulo}>
                    <span className="etiqueta-celda">{columna.titulo}</span>
                    <div className="valor-celda">{columna.mostrar(fila)}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginacionInterna && filas.length > 12 && (
        <div className="paginacion">
          <span>
            {filas.length} registros · Página {actual} de {paginas}
          </span>
          <div>
            <button
              className="secundario"
              disabled={actual === 1}
              onClick={() => establecerPagina(actual - 1)}
            >
              Anterior
            </button>
            <button
              className="secundario"
              disabled={actual === paginas}
              onClick={() => establecerPagina(actual + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export function Dialogo({
  titulo,
  cerrar,
  children,
  clase = "",
  bloqueado = false,
}: {
  titulo: string;
  cerrar: () => void;
  children: ReactNode;
  clase?: string;
  bloqueado?: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const animacion = useRef<Animation | null>(null);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    dialogo.current?.showModal();
    return () => {
      montado.current = false;
      animacion.current?.cancel();
      dialogo.current?.close();
    };
  }, []);
  function cerrarAnimado() {
    if (bloqueado) return;
    const elemento = dialogo.current;
    if (
      !elemento?.animate ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      cerrar();
      return;
    }
    if (animacion.current) return;
    animacion.current = elemento.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(16px)" },
      ],
      { duration: 160, easing: "ease-in", fill: "forwards" },
    );
    void animacion.current.finished
      .catch(() => {})
      .then(() => {
        if (montado.current) cerrar();
      });
  }
  return (
    <dialog
      ref={dialogo}
      className={`dialogo ${clase}`}
      onCancel={(evento) => {
        evento.preventDefault();
        cerrarAnimado();
      }}
      aria-label={titulo}
    >
      <div className="titulo-dialogo">
        <h2>{titulo}</h2>
        <button
          className="icono-boton"
          type="button"
          onClick={cerrarAnimado}
          disabled={bloqueado}
          aria-label="Cerrar ventana"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      {clase.split(" ").includes("expediente") ? (
        <div className="cuerpo-expediente">{children}</div>
      ) : (
        children
      )}
    </dialog>
  );
}
