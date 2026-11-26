import { useRef, useState, type FormEvent } from "react";
import { Plus, Check, Clock3 } from "lucide-react";
import { Dialogo, type Registro } from "./componentesGestion";
import { diasHorario, type Tramo } from "./EditorHorario";
import { SelectorHora, formatearHora } from "./SelectorHora";
import { SelectorFiltro } from "./SelectorFiltro";
import { SelectorFecha } from "./SelectorFecha";
import { consultar } from "./servicio";
import "./SemanaLaboral.css";

const turnos = { manana: "Mañana", tarde: "Tarde", noche: "Noche", completo: "Jornada completa" };
const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(new Date());
const tramosIniciales = (): Tramo[] => [0, 1, 2, 3, 4].map(dia => ({ dia_semana: dia, hora_entrada: "08:00", hora_salida: "13:00" }));

export function SemanaLaboral({ tipo, catalogo, administrador, guardado, alModificar }: {
  tipo: string; catalogo: Registro; administrador: boolean;
  guardado: (mensaje: string) => void; alModificar: (valor: boolean) => void;
}) {
  const horarios: Registro[] = catalogo.horarios.filter((h: Registro) => h.activo && h.tipo_personal === tipo);
  const inicial = horarios[0];
  const [identificador, cambiarIdentificador] = useState<number | null>(inicial?.id ?? null);
  const [carrera, cambiarCarrera] = useState(inicial?.carrera || "");
  const [turno, cambiarTurno] = useState(inicial?.turno || "manana");
  const [tramos, cambiarTramos] = useState<Tramo[]>(inicial?.tramos || tramosIniciales());
  const [dias, cambiarDias] = useState<number[]>([]);
  const [entrada, cambiarEntrada] = useState("08:00");
  const [salida, cambiarSalida] = useState("13:00");
  const [fecha, cambiarFecha] = useState(hoy);
  const personas: Registro[] = catalogo.personas.filter((p: Registro) => p.activa && p.rol_codigo === tipo);
  const [seleccion, cambiarSeleccion] = useState<number[]>(personas.filter(p => p.horario_id === inicial?.id).map(p => p.id));
  const [busqueda, cambiarBusqueda] = useState("");
  const [modificado, cambiarModificado] = useState(false);
  const [ocupado, cambiarOcupado] = useState(false);
  const [error, cambiarError] = useState("");
  const [editarDatos, cambiarEditarDatos] = useState(!inicial);
  const [horarioPendiente, cambiarHorarioPendiente] = useState<string | null>(null);
  const enviando = useRef(false);
  const visibles = personas.filter(p => `${p.nombre} ${p.codigo}`.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase()));
  function modificar() { cambiarModificado(true); alModificar(true); cambiarError(""); }
  function cargar(valor: string) {
    if (modificado) {
      cambiarHorarioPendiente(valor);
      return;
    }
    cargarHorario(valor);
  }
  function cargarHorario(valor: string) {
    const horario = horarios.find(h => h.id === Number(valor));
    cambiarIdentificador(horario?.id ?? null);
    cambiarCarrera(horario?.carrera || ""); cambiarTurno(horario?.turno || "manana");
    cambiarTramos(horario?.tramos || tramosIniciales()); cambiarDias([]);
    cambiarSeleccion(personas.filter(p => p.horario_id === horario?.id).map(p => p.id));
    cambiarModificado(false); alModificar(false); cambiarError("");
    cambiarEditarDatos(!horario);
  }
  function elegirDia(indice: number) {
    const tramo = tramos.find(t => t.dia_semana === indice);
    if (!dias.length && tramo) { cambiarEntrada(tramo.hora_entrada.slice(0, 5)); cambiarSalida(tramo.hora_salida?.slice(0, 5) || "13:00"); }
    cambiarDias(actual => actual.includes(indice) ? actual.filter(d => d !== indice) : [...actual, indice]);
  }
  function aplicar(descanso = false) {
    if (!dias.length) return;
    if (!descanso && (!entrada || !salida || salida <= entrada)) { cambiarError("La salida debe ser posterior a la entrada."); return; }
    cambiarTramos(actual => [...actual.filter(t => !dias.includes(t.dia_semana)),
      ...(descanso ? [] : dias.map(d => ({ dia_semana: d, hora_entrada: entrada, hora_salida: salida })))
    ].sort((a, b) => a.dia_semana - b.dia_semana));
    cambiarDias([]); modificar();
  }
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando.current || !administrador) return;
    if (tipo === "docente" && !carrera.trim()) {
      cambiarEditarDatos(true); cambiarError("Indica la carrera de este horario."); return;
    }
    if (dias.length) { cambiarError("Aplica las horas o marca descanso para los días seleccionados antes de guardar."); return; }
    if (!tramos.length || tramos.some(t => !t.hora_salida || t.hora_salida <= t.hora_entrada)) { cambiarError("Configura al menos un día con entrada y salida válidas."); return; }
    enviando.current = true; cambiarOcupado(true); cambiarError("");
    try {
      const respuesta = await consultar("/api/gestion/horarios/semana", { method: "POST", body: JSON.stringify({
        horario_id: identificador, nombre: `${tipo === "docente" ? carrera.trim() : "Administración"} · ${turnos[turno as keyof typeof turnos]}`.slice(0, 100),
        tipo_personal: tipo, carrera: tipo === "docente" ? carrera.trim() : null, turno, tramos,
        persona_ids: seleccion, vigente_desde: fecha,
      }) });
      cambiarIdentificador(respuesta.id); cambiarModificado(false); cambiarEditarDatos(false); alModificar(false); guardado(respuesta.mensaje);
    } catch (problema) { cambiarError((problema as Error).message); }
    finally { enviando.current = false; cambiarOcupado(false); }
  }
  const actual = horarios.find(h => h.id === identificador);
  const titulo = identificador === null ? "Nuevo horario" : tipo === "docente" ? carrera || actual?.nombre || "Horario docente" : "Administración";
  return <>
    <form className="semana-visual" onSubmit={evento => void guardar(evento)}>
    <nav className="lista-horarios-visual" aria-label="Horarios disponibles">
      <h2>Horarios</h2>
      {horarios.map(h => <button key={h.id} type="button" disabled={ocupado} aria-pressed={h.id === identificador}
        onClick={() => cargar(String(h.id))}>
        <span><strong>{tipo === "docente" ? h.carrera || h.nombre : "Administración"}</strong>
          <small>{turnos[h.turno as keyof typeof turnos]} · {personas.filter(p => p.horario_id === h.id).length} personas</small></span>
        {h.id === identificador && <Check size={18} aria-hidden="true" />}
      </button>)}
      {!horarios.length && <p className="nota">Aún no hay horarios.</p>}
      {administrador && <button type="button" className="nuevo-horario-visual" disabled={ocupado} aria-pressed={identificador === null} onClick={() => cargar("nuevo")}><Plus size={16} />Nuevo horario</button>}
    </nav>
    <div className="editor-semana-visual">
    <header className="cabecera"><div><h2>{titulo}</h2><span className="turno-horario">{turnos[turno as keyof typeof turnos]}</span></div>
      {administrador && identificador !== null && <button type="button" className="boton-texto" disabled={ocupado} aria-expanded={editarDatos} onClick={() => cambiarEditarDatos(!editarDatos)}>{editarDatos ? "Cerrar datos" : "Editar datos"}</button>}
    </header>
    {editarDatos && <fieldset disabled={ocupado || !administrador} className="filtros-semana">
      {tipo === "docente" && <label>Carrera<input required maxLength={120} value={carrera} readOnly={!administrador} placeholder="Ej. Computación" onChange={e => { cambiarCarrera(e.target.value); modificar(); }} /></label>}
      <div className="filtro-etiquetado"><span>Turno</span>{administrador ? <SelectorFiltro etiqueta="Turno" valor={turno} alCambiar={v => { cambiarTurno(v); modificar(); }} opciones={Object.entries(turnos).map(([valor, texto]) => ({ valor, texto }))} /> : <strong>{turnos[turno as keyof typeof turnos]}</strong>}</div>
    </fieldset>}
    <div className="semana-dias" role="group" aria-label="Semana laboral">
      {diasHorario.map((dia, indice) => {
        const tramo = tramos.find(t => t.dia_semana === indice);
        return <button type="button" key={dia} disabled={!administrador || ocupado} aria-pressed={dias.includes(indice)}
          className="dia-semana-visual" data-laboral={Boolean(tramo)} onClick={() => elegirDia(indice)}>
          <span className="nombre-dia">{dia.slice(0, 3)} {dias.includes(indice) && <Check size={15} />}</span>
          {tramo ? <><Clock3 size={18} /><strong>{formatearHora(tramo.hora_entrada)}</strong><span>a {formatearHora(tramo.hora_salida || "")}</span></> : <span className="descanso-semana">Descanso</span>}
        </button>;
      })}
    </div>
    {administrador && <fieldset disabled={ocupado} className="ajuste-semana">
      <div className="cabecera-ajuste"><span>{dias.length ? dias.slice().sort((a,b) => a-b).map(d => diasHorario[d].slice(0,3)).join(", ") : "Toca un día para editarlo"}</span>
        <button type="button" className="boton-texto" onClick={() => cambiarDias([0, 1, 2, 3, 4])}>Lunes a viernes</button>
        {dias.length > 0 && <button type="button" className="boton-texto" onClick={() => cambiarDias([])}>Quitar selección</button>}
      </div>
      {dias.length > 0 && <div className="horas-semana">
        <div><span>Entrada</span><SelectorHora etiqueta="Entrada de los días seleccionados" valor={entrada} alCambiar={cambiarEntrada} /></div>
        <div><span>Salida</span><SelectorHora etiqueta="Salida de los días seleccionados" valor={salida} alCambiar={cambiarSalida} /></div>
        <button type="button" onClick={() => aplicar()}>Aplicar horas</button>
        <button type="button" className="secundario" onClick={() => aplicar(true)}>Marcar descanso</button>
      </div>}
    </fieldset>}
    <details className="personal-semana"><summary>{administrador ? `Aplicar a ${seleccion.length} personas` : "Personal asignado"}</summary>
      {administrador ? <>
        <p className="nota">Solo se actualizarán las personas marcadas.</p>
        <fieldset disabled={ocupado} className="filtros-personal-semana">
          <label>Buscar personal<input type="search" value={busqueda} placeholder="Nombre o ID" onChange={e => cambiarBusqueda(e.target.value)} /></label>
        </fieldset>
        <div className="cabecera-ajuste"><button type="button" className="boton-texto" disabled={ocupado || !visibles.length} onClick={() => {
          cambiarSeleccion(actual => visibles.every(p => actual.includes(p.id)) ? actual.filter(id => !visibles.some(p => p.id === id)) : [...new Set([...actual, ...visibles.map(p => p.id)])]); modificar();
        }}>Seleccionar o quitar visibles</button></div>
        <fieldset disabled={ocupado} className="personas-semana">{visibles.map(p => <label key={p.id} data-seleccionado={seleccion.includes(p.id)}>
          <input type="checkbox" checked={seleccion.includes(p.id)} onChange={() => { cambiarSeleccion(actual => actual.includes(p.id) ? actual.filter(id => id !== p.id) : [...actual, p.id]); modificar(); }} />
          <span><strong>{p.nombre}</strong><small>{p.codigo} · {p.horario_id === identificador ? "Horario actual" : "Otro horario o sin asignar"}</small></span>
        </label>)}</fieldset>
        {!visibles.length && <p className="nota">No hay personas para esta búsqueda.</p>}
      </> : <ul>{personas.filter(p => p.horario_id === identificador).map(p => <li key={p.id}>{p.nombre}</li>)}</ul>}
    </details>
    {error && <p role="alert" className="aviso error">{error}</p>}
    {administrador && (modificado || identificador === null) && <footer className="guardar-semana">
      <SelectorFecha etiqueta="Aplicar desde" minimo={hoy()} valor={fecha} alCambiar={v => { cambiarFecha(v); modificar(); }} />
      <span>{seleccion.length ? `${seleccion.length} personas recibirán los cambios` : "Sin personas seleccionadas"}</span>
      <button disabled={ocupado || !modificado && identificador !== null}>{ocupado ? "Guardando…" : "Guardar cambios"}</button></footer>}
    </div>
    </form>
    {horarioPendiente !== null && <Dialogo titulo="Descartar cambios sin guardar" cerrar={() => cambiarHorarioPendiente(null)}>
      <div className="formulario-gestion">
        <p>Los cambios de este horario se perderán si continúas.</p>
        <footer className="acciones-dialogo">
          <button type="button" className="secundario" autoFocus onClick={() => cambiarHorarioPendiente(null)}>Conservar cambios</button>
          <button type="button" onClick={() => {
            cargarHorario(horarioPendiente);
            cambiarHorarioPendiente(null);
          }}>Descartar cambios</button>
        </footer>
      </div>
    </Dialogo>}
  </>;
}
