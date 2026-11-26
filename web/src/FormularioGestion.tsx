import { SelectorFecha } from "./SelectorFecha";
import { ConfiguradorIngreso } from "./ConfiguradorIngreso";
import { SelectorFiltro } from "./SelectorFiltro";
import { EditorHorario, type Tramo } from "./EditorHorario";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Dialogo, type Registro } from "./componentesGestion";
import { consultar, ErrorSolicitud } from "./servicio";
export type Campo = {
  nombre: string;
  etiqueta: string;
  tipo?: string;
  opciones?: {
    valor: string | number;
    texto: string;
  }[];
  opcionesSegunDatos?: (datos: Registro) => { valor: string | number; texto: string }[];
  soloLectura?: boolean;
  modoEntrada?: "numeric" | "text";
  ayudaSegunDatos?: (datos: Registro) => string;
  requerido?: boolean;
  numerico?: boolean;
  ayuda?: string;
  minimo?: number;
  maximo?: number;
  paso?: number;
  longitudMinima?: number;
  longitudMaxima?: number;
  patron?: string;
  avanzado?: boolean;
  visible?: (datos: Registro) => boolean;
};
export type Formulario = {
  titulo: string;
  ruta: string;
  accion?: string;
  metodo?: "POST" | "PUT";
  aviso?: string;
  requiereSalida?: boolean;
  campos: Campo[];
  datos: Registro;
  preparar?: (datos: Registro) => Registro;
  alGuardar?: (respuesta: Registro, datos: Registro) => void;
  actualizar?: (datos: Registro) => Registro;
};
export function FormularioGestion({
  formulario,
  cerrar,
  guardado,
}: {
  formulario: Formulario;
  cerrar: () => void;
  guardado: (mensaje: string) => void;
}) {
  const [datos, establecerDatos] = useState<Registro>(() => formulario.actualizar
    ? formulario.actualizar({ ...formulario.datos }) : { ...formulario.datos });
  const [accesoTemporal, cambiarAccesoTemporal] = useState<Registro | null>(null);
  const [errores, establecerErrores] = useState<Record<string, string>>({});
  const [error, establecerError] = useState(""),
    [ocupado, establecerOcupado] = useState(false);
  useEffect(() => {
    const renovar = () => establecerError("");
    window.addEventListener("fym-sesion-renovada", renovar);
    return () => window.removeEventListener("fym-sesion-renovada", renovar);
  }, []);
  const referencia = useRef<HTMLFormElement>(null);
  const visibles = formulario.campos.filter(
    (campo) => !campo.visible || campo.visible(datos),
  );
  function cambiar(campo: Campo, valor: unknown) {
    establecerDatos((anterior) => {
      const nuevos = {
      ...anterior,
      [campo.nombre]: campo.numerico && valor !== "" ? Number(valor) : valor,
      };
      return formulario.actualizar ? formulario.actualizar(nuevos) : nuevos;
    });
    establecerErrores((anterior) => ({ ...anterior, [campo.nombre]: "" }));
  }
  function errorCampo(nombre: string) {
    return (
      errores[nombre] ||
      Object.entries(errores).find(([clave]) =>
        clave.startsWith(nombre + "."),
      )?.[1]
    );
  }
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    const fallos: Record<string, string> = {};
    if (formulario.ruta.endsWith("/personas") &&
      ((!datos.id && !datos.documento) || datos.documento && !/^[0-9]{8}$/.test(datos.documento))) {
      fallos.documento = "El DNI debe tener exactamente 8 dígitos.";
    }
    for (const campo of visibles) {
      if (
        campo.requerido &&
        ["select", "date"].includes(campo.tipo || "") &&
        (datos[campo.nombre] === "" || datos[campo.nombre] == null)
      )
        fallos[campo.nombre] = "Selecciona una opción.";
    }
    if (datos.nombre_usuario && !datos.id && !datos.clave)
      fallos.clave = "Introduce la contraseña para crear la cuenta.";
    if (
      datos.clave &&
      !datos.nombre_usuario &&
      formulario.ruta.endsWith("/personas")
    )
      fallos.nombre_usuario = "Introduce el usuario de esta cuenta.";
    if (Array.isArray(datos.tramos)) {
      if (!datos.tramos.length) fallos.tramos = "Añade al menos un tramo.";
      const repetidos = new Set<string>();
      for (const tramo of datos.tramos as Tramo[]) {
        const clave = `${tramo.dia_semana}-${tramo.hora_entrada}`;
        if (repetidos.has(clave))
          fallos.tramos = "No repitas la misma entrada en un día.";
        repetidos.add(clave);
        if (formulario.requiereSalida && !tramo.hora_salida)
          fallos.tramos =
            "Cada día del horario laboral necesita entrada y salida.";
        if (tramo.hora_salida && tramo.hora_salida <= tramo.hora_entrada)
          fallos.tramos = "Cada salida debe ser posterior a su entrada.";
      }
    }
    if (
      "alerta_porcentaje" in datos &&
      Number(datos.alerta_porcentaje) <= Number(datos.observacion_porcentaje)
    )
      fallos.alerta_porcentaje =
        "La alerta debe superar el porcentaje de observación.";
    establecerErrores(fallos);
    if (Object.keys(fallos).length) {
      establecerError("Revisa los campos indicados.");
      return;
    }
    establecerOcupado(true);
    establecerError("");
    try {
      const salida = formulario.preparar ? formulario.preparar(datos) : datos;
      const respuesta = await consultar(formulario.ruta, {
        method: formulario.metodo || "POST",
        body: JSON.stringify(salida),
      });
      guardado(respuesta.mensaje || "Cambios guardados.");
      formulario.alGuardar?.(respuesta, datos);
      if (respuesta.clave_temporal) cambiarAccesoTemporal(respuesta);
      else cerrar();
    } catch (problema) {
      establecerError((problema as Error).message);
      if (problema instanceof ErrorSolicitud) {
        establecerErrores(problema.campos);
        const primero = Object.keys(problema.campos)[0]?.split(".")[0];
        referencia.current
          ?.querySelector<HTMLElement>(`[name="${primero}"]`)
          ?.focus();
      }
    } finally {
      establecerOcupado(false);
    }
  }
  function presentar(campo: Campo) {
    const ayuda = campo.ayudaSegunDatos?.(datos) || campo.ayuda;
    const identificador = `campo-${campo.nombre}`,
      aviso = errorCampo(campo.nombre);
    const descripcion =
      [
        ayuda ? `${identificador}-ayuda` : "",
        aviso ? `${identificador}-error` : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined;
    const maximos: Record<string, number> = {
      codigo: 30,
      nombres: 100,
      apellidos: 100,
      documento: 20,
      nombre: formulario.ruta.endsWith("/carreras") ? 120 : 100,
      ciclo: 30,
      turno: 30,
      referencia: 200,
      motivo: formulario.ruta.endsWith("/justificaciones")
        ? 1000
        : formulario.ruta.endsWith("/dias-no-lectivos")
          ? 200
          : 500,
      observacion: 500,
      modelo: 80,
    };
    const comunes = {
      id: identificador,
      name: campo.nombre,
      required: campo.requerido,
      "aria-describedby": descripcion,
      "aria-invalid": Boolean(aviso),
    };
    return (
      <div
        className={`campo ${campo.tipo === "booleano" ? "campo-booleano" : ""} ${["textarea", "dias", "tramos", "horario-directo"].includes(campo.tipo || "") ? "ancho" : ""}`}
        key={campo.nombre}
      >
        {campo.tipo === "booleano" ? (
          <label className="opcion">
            <input
              type="checkbox"
              checked={Boolean(datos[campo.nombre])}
              onChange={(evento) => cambiar(campo, evento.target.checked)}
            />
            {campo.etiqueta}
          </label>
        ) : campo.tipo === "horario-directo" ? (
          <fieldset><legend>{campo.etiqueta}</legend>
            <ConfiguradorIngreso tramos={datos[campo.nombre] || []} cambiar={valor => cambiar(campo, valor)} />
          </fieldset>
        ) : campo.tipo === "tramos" ? (
          <fieldset aria-describedby={descripcion}>
            <legend>{campo.etiqueta}</legend>
            <EditorHorario
              salidaObligatoria={formulario.requiereSalida}
              tramos={datos[campo.nombre] || []}
              cambiar={(valor) => cambiar(campo, valor)}
            />
          </fieldset>
        ) : (
          <>
            <label htmlFor={identificador}>
              {campo.etiqueta}
              {campo.requerido && <span aria-hidden="true"> *</span>}
            </label>
            {campo.tipo === "select" ? (
              <SelectorFiltro
                id={identificador}
                etiqueta={campo.etiqueta}
                descripcion={descripcion}
                invalido={Boolean(aviso)}
                enFormulario
                valor={String(datos[campo.nombre] ?? "")}
                alCambiar={(valor) => cambiar(campo, valor)}
                opciones={(campo.opcionesSegunDatos?.(datos) || campo.opciones || []).map((opcion) => ({
                  valor: String(opcion.valor),
                  texto: opcion.texto,
                }))}
              />
            ) : campo.tipo === "date" ? (
              <SelectorFecha
                etiqueta={campo.etiqueta}
                ocultarEtiqueta
                id={identificador}
                descripcion={descripcion}
                invalido={Boolean(aviso)}
                valor={datos[campo.nombre] || ""}
                alCambiar={(valor) => cambiar(campo, valor)}
              />
            ) : campo.tipo === "textarea" ? (
              <textarea
                {...comunes}
                value={datos[campo.nombre] ?? ""}
                rows={3}
                minLength={3}
                maxLength={campo.longitudMaxima ?? maximos[campo.nombre]}
                onChange={(evento) => cambiar(campo, evento.target.value)}
              />
            ) : (
              <input
                {...comunes}
                type={campo.tipo || "text"}
                value={datos[campo.nombre] ?? ""}
                min={campo.minimo}
                max={
                  campo.maximo ??
                  (campo.nombre.includes("minutos") ||
                  campo.nombre.startsWith("rol_")
                    ? 1440
                    : undefined)
                }
                step={campo.tipo === "number" ? (campo.paso ?? 1) : undefined}
                minLength={campo.longitudMinima}
                maxLength={campo.longitudMaxima ?? maximos[campo.nombre]}
                pattern={campo.patron}
                readOnly={campo.soloLectura}
                inputMode={campo.modoEntrada}
                title={campo.patron ? ayuda : undefined}
                onBlur={() => {
                  if (campo.nombre === "documento" && formulario.ruta.endsWith("/personas")) {
                    const valor = String(datos.documento || "");
                    establecerErrores(actual => ({ ...actual, documento:
                      valor && !/^[0-9]{8}$/.test(valor) || !datos.id && !valor
                        ? "El DNI debe tener exactamente 8 dígitos." : "" }));
                  }
                }}
                onChange={(evento) => cambiar(campo, evento.target.value)}
                autoComplete={
                  campo.tipo === "password" ? "new-password" : undefined
                }
              />
            )}
          </>
        )}
        {ayuda && (
          <small id={`${identificador}-ayuda`}>{ayuda}</small>
        )}
        {aviso && (
          <small className="error-campo" id={`${identificador}-error`}>
            {aviso}
          </small>
        )}
      </div>
    );
  }
  if (accesoTemporal) return <Dialogo titulo="Entrega el acceso temporal" cerrar={cerrar}>
    <div className="formulario-gestion"><p>La contraseña inicial usa el primer nombre y las iniciales de los apellidos, en minúsculas y sin tildes. Entrégala personalmente; vence en 48 horas y exige cambio de contraseña.</p>
      <p>Usuario: <code>{accesoTemporal.usuario}</code></p>
      <p>Contraseña temporal: <code>{accesoTemporal.clave_temporal}</code></p>
      <p>Vence: {new Date(accesoTemporal.vence).toLocaleString("es-PE")}</p>
      <button onClick={cerrar}>Ya entregué el acceso</button>
    </div></Dialogo>;
  return (
    <Dialogo
      titulo={formulario.titulo}
      cerrar={cerrar}
      bloqueado={ocupado}
      clase={
        formulario.campos.some((campo) => campo.tipo === "horario-directo")
          ? "dialogo-horario dialogo-horario-directo"
          :
        formulario.campos.some((campo) => ["tramos", "horario-directo"].includes(campo.tipo || ""))
          ? "dialogo-horario"
          : ""
      }
    >
      <form
        ref={referencia}
        onSubmit={guardar}
        className="formulario-gestion"
        aria-busy={ocupado}
      >
        {formulario.aviso && (
          <p className="aviso informativo">{formulario.aviso}</p>
        )}
        <fieldset disabled={ocupado}>
          <div className="campos-formulario">
            {visibles.filter((campo) => !campo.avanzado).map(presentar)}
          </div>
          {visibles.some((campo) => campo.avanzado) && (
            <details className="configuracion-avanzada">
              <summary>Configuración avanzada</summary>
              {visibles.filter((campo) => campo.avanzado).map(presentar)}
            </details>
          )}
        </fieldset>
        {error && (
          <div className="aviso error" role="alert">
            {error}
          </div>
        )}
        <footer className="acciones-dialogo">
          <button
            type="button"
            className="secundario"
            onClick={cerrar}
            disabled={ocupado}
          >
            Cancelar
          </button>
          <button disabled={ocupado}>
            {ocupado
              ? "Guardando…"
              : formulario.accion ||
                (datos.id ? "Guardar cambios" : "Registrar")}
          </button>
        </footer>
      </form>
    </Dialogo>
  );
}
