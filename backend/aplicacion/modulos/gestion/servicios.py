from .asignaciones import asignar_desde, hoy_sede, validar_fecha
from ..acceso import proteccion
from ...compartido.credenciales import credenciales_iniciales
from ...compartido.avisos_asistencia import notificar_marcado
from ...compartido.identidad import iniciales_persona
from datetime import date, datetime, timedelta, timezone, time
from decimal import Decimal
from ipaddress import ip_address
import json
from typing import Literal
from zoneinfo import ZoneInfo
from ...models import (
    Persona,
    Usuario,
    Horario,
    TramoHorario,
    AsignacionHorario,
    ToleranciaRol,
    Marcado,
    Justificacion,
    DiaNoLectivo,
    ReglaSede,
    TarifaDocente,
    Dispositivo,
    Auditoria,
    obtener_hora_utc,
)
from ...seguridad import generar_hash_clave
from ...compartido.codigos_qr import firmar
from .repositorio import RepositorioGestion
from ...compartido.errores import ErrorAplicacion, ConflictoPersistencia
from ...compartido.repositorio import datos_objeto
from .esquemas import (
    DatosPersona,
    DatosHorario,
    DatosManual,
    DatosJustificacion,
    ResolverJustificacion,
    DatosReglas,
    DatosDia,
    DatosDispositivo,
)
from ...infraestructura.reportes import construir_excel


def administrador(usuario: Usuario = None):
    if usuario.permiso != "administrador":
        raise ErrorAplicacion(403, "Esta operación requiere permiso de administrador.")
    return usuario


def sede_usuario(repositorio, usuario):
    return repositorio.obtener_persona(usuario.persona_id).sede_id


def comprobar_persona(repositorio, usuario, identificador):
    persona = repositorio.obtener_persona(identificador)
    if not persona or persona.sede_id != sede_usuario(repositorio, usuario):
        raise ErrorAplicacion(404, "Persona no disponible en tu sede.")
    return persona


def comprobar_horario(repositorio, sede, identificador):
    horario = repositorio.obtener_horario(identificador)
    if not horario or horario.sede_id != sede or (not horario.activo):
        raise ErrorAplicacion(422, "El horario no está disponible en esta sede.")
    return horario


def registrar_auditoria(repositorio, usuario, accion, entidad, identificador, detalle):
    repositorio.agregar(
        Auditoria(
            usuario_id=usuario.id,
            accion=accion,
            entidad=entidad,
            entidad_id=identificador,
            detalle=json.dumps(detalle, default=str, ensure_ascii=False),
        )
    )


def confirmar(repositorio):
    try:
        repositorio.confirmar()
    except ConflictoPersistencia:
        repositorio.revertir()
        raise ErrorAplicacion(
            409, "Ya existe un registro con ese código, documento o usuario."
        )


def regla_sede(repositorio, sede):
    regla = repositorio.regla_de_sede(sede)
    return regla or ReglaSede(
        sede_id=sede,
        anticipacion_minutos=0,
        limite_ausencia_minutos=45,
        observacion_porcentaje=15,
        alerta_porcentaje=30,
    )


def tramos_para(repositorio, persona, fecha):
    asignacion = repositorio.asignacion_vigente(fecha, persona)
    horario_id = asignacion.horario_id if asignacion else None
    horario = repositorio.obtener_horario(horario_id) if horario_id else None
    if not horario or not horario.activo:
        return []
    return repositorio.tramos_del_dia(fecha, horario)


def evaluar_manual(repositorio, persona, instante, tipo):
    if tipo == "salida":
        return "Salida registrada"
    local = instante.replace(tzinfo=timezone.utc).astimezone(
        ZoneInfo(repositorio.obtener_sede(persona.sede_id).zona_horaria)
    )
    tramos = tramos_para(repositorio, persona, local.date())
    margen = repositorio.tolerancia_vigente(local, persona)
    if not tramos:
        return "Registrado · horario pendiente"
    limite = datetime.combine(
        local.date(), tramos[0].hora_entrada, local.tzinfo
    ) + timedelta(minutes=margen.minutos if margen else 0)
    return "Puntual" if local <= limite else "Tardanza"


def consultar_catalogo(usuario: Usuario = None, repositorio: RepositorioGestion = None):
    sede = sede_usuario(repositorio, usuario)
    personas = repositorio.personas_ordenadas(sede)
    lista = []
    hoy = (
        obtener_hora_utc()
        .replace(tzinfo=timezone.utc)
        .astimezone(ZoneInfo(repositorio.obtener_sede(sede).zona_horaria))
        .date()
    )
    for persona in personas:
        if repositorio.obtener_rol(persona.rol_id).codigo not in ("docente", "administrativo"):
            continue
        datos = datos_objeto(persona)
        datos.pop("version_carne")
        datos.pop("foto_ruta", None)
        cuenta = repositorio.cuenta_de_persona(persona)
        datos.update(
            nombre=f"{persona.nombres} {persona.apellidos}",
            iniciales=iniciales_persona(persona),
            rol=repositorio.obtener_rol(persona.rol_id).nombre,
            rol_codigo=repositorio.obtener_rol(persona.rol_id).codigo,
            nombre_usuario=cuenta.nombre_usuario if cuenta else None,
            permiso=cuenta.permiso if cuenta else "personal",
        )
        asignacion = repositorio.asignacion_del_catalogo(hoy, persona)
        datos["horario_id"] = asignacion.horario_id if asignacion else None
        datos["horario_desde"] = str(asignacion.vigente_desde) if asignacion else None
        datos["asignaciones"] = [{"horario_id": valor.horario_id, "desde": str(valor.vigente_desde),
            "hasta": str(valor.vigente_hasta) if valor.vigente_hasta else None}
            for valor in repositorio.asignaciones_programadas(hoy, persona)]
        tarifa = repositorio.tarifa_de_persona(persona)
        datos["tarifa_hora"] = (
            float(tarifa.tarifa_hora)
            if tarifa and usuario.permiso == "administrador"
            else 0
        )
        lista.append(datos)
    horarios = repositorio.horarios_de_sede(sede)
    regla = regla_sede(repositorio, sede)
    tolerancias = {}
    roles = [rol for rol in repositorio.roles() if rol.codigo in ("docente", "administrativo")]
    for rol in roles:
        margen = repositorio.tolerancia_del_catalogo(hoy, rol)
        tolerancias[rol.id] = margen.minutos if margen else 0
    return {
        "personas": lista,
        "roles": [datos_objeto(rol) for rol in roles],
        "horarios": [
            {
                **datos_objeto(horario),
                "en_uso": repositorio.horario_tiene_asignaciones(horario.id),
                "asignaciones_individuales": [
                    {"persona_id": persona.id, "nombre": f"{persona.nombres} {persona.apellidos}",
                     "codigo": persona.codigo, "desde": str(asignacion.vigente_desde),
                     "hasta": str(asignacion.vigente_hasta) if asignacion.vigente_hasta else None,
                     "vigente": asignacion.vigente_desde <= hoy and (asignacion.vigente_hasta is None or asignacion.vigente_hasta >= hoy)}
                    for asignacion, persona in repositorio.personas_del_horario(horario.id)
                ],
                "tramos": [
                    datos_objeto(tramo)
                    for tramo in repositorio.tramos_del_horario(horario)
                ],
            }
            for horario in horarios
        ],
        "reglas": {**datos_objeto(regla), "tolerancias": tolerancias},
        "dias_no_lectivos": [
            datos_objeto(dia) for dia in repositorio.dias_no_lectivos(sede)
        ],
        "dispositivos": [
            datos_objeto(dispositivo)
            for dispositivo in repositorio.dispositivos_de_sede(sede)
        ],
    }


def guardar_persona(
    datos: DatosPersona, usuario: Usuario = None, repositorio: RepositorioGestion = None
):
    sede = sede_usuario(repositorio, usuario)
    if datos.id == usuario.persona_id and (
        not datos.activa
        or datos.permiso != "administrador"
        or datos.rol_id != repositorio.obtener_persona(usuario.persona_id).rol_id
    ):
        raise ErrorAplicacion(
            422, "No puedes desactivar ni reducir tu propio acceso administrativo."
        )
    rol = repositorio.obtener_rol(datos.rol_id)
    if not rol or rol.codigo not in ("docente", "administrativo"):
        raise ErrorAplicacion(422, "Selecciona un rol de docente o personal administrativo.")
    if datos.documento:
        datos.codigo = f"{'DOC' if rol.codigo == 'docente' else 'ADM'}-{datos.documento}"
    elif datos.id:
        datos.codigo = comprobar_persona(repositorio, usuario, datos.id).codigo
    if datos.grupo_id:
        raise ErrorAplicacion(422, "Los grupos académicos ya no forman parte del sistema de asistencia.")
    if datos.horario_id:
        comprobar_horario(repositorio, sede, datos.horario_id)
    persona = (
        comprobar_persona(repositorio, usuario, datos.id)
        if datos.id
        else Persona(sede_id=sede)
    )
    cuenta_previa = repositorio.cuenta_de_persona(persona) if datos.id else None
    if cuenta_previa and cuenta_previa.permiso != datos.permiso:
        proteccion.reautenticar(repositorio._base, usuario, datos.actual)
    campos = datos.model_dump(
        exclude={
            "id",
            "horario_id",
            "tarifa_hora",
            "nombre_usuario",
            "clave",
            "permiso",
            "actual",
        }
    )
    for campo, valor in campos.items():
        setattr(
            persona, campo, valor.strip() or None if isinstance(valor, str) else valor
        )
    repositorio.agregar(persona)
    try:
        repositorio.sincronizar()
    except ConflictoPersistencia:
        repositorio.revertir()
        raise ErrorAplicacion(409, "Ya existe una persona con ese DNI o ID institucional.")
    cuenta = repositorio.cuenta_de_persona(persona)
    clave_entrega = None
    if cuenta and cuenta.permiso != datos.permiso:
        proteccion.registrar(repositorio._base, "permiso_modificado", usuario, f"Persona: {persona.id}. Permiso: {datos.permiso}")
        proteccion.revocar(repositorio._base, cuenta)
    if persona.id == usuario.persona_id and (
        not persona.activa or datos.permiso != "administrador"
    ):
        raise ErrorAplicacion(
            422, "No puedes desactivar tu propio acceso administrativo."
        )
    if (
        datos.permiso != "personal"
        and repositorio.obtener_rol(datos.rol_id).codigo != "administrativo"
    ):
        raise ErrorAplicacion(
            422, "Los permisos administrativos requieren el rol administrativo."
        )
    if not cuenta:
        nombre_inicial, clave_inicial = credenciales_iniciales(
            persona.nombres, persona.apellidos, repositorio.usuario_disponible)
        cuenta = Usuario(persona_id=persona.id, nombre_usuario=nombre_inicial,
                         clave_hash=generar_hash_clave(clave_inicial), debe_cambiar_clave=True,
                         clave_temporal_vence=obtener_hora_utc() + timedelta(hours=48))
        clave_entrega = clave_inicial
    cuenta.permiso = datos.permiso
    if cuenta.activo and not datos.activa:
        proteccion.revocar(repositorio._base, cuenta)
        proteccion.registrar(repositorio._base, "cuenta_desactivada", usuario, f"Persona: {persona.id}")
    cuenta.activo = datos.activa
    if datos.clave:
        raise ErrorAplicacion(422, "Utiliza Generar acceso temporal desde Seguridad para restablecer una contraseña.")
    repositorio.agregar(cuenta)
    actual = repositorio.asignacion_vigente(hoy_sede(repositorio, sede), persona)
    if datos.horario_id != (actual.horario_id if actual else None):
        raise ErrorAplicacion(409, "Confirma los cambios de horario desde Horarios laborales. Si el horario cambió mientras editabas, actualiza la página.")
    if repositorio.obtener_rol(datos.rol_id).codigo == "docente":
        tarifa = repositorio.tarifa_de_persona(persona) or TarifaDocente(
            persona_id=persona.id
        )
        tarifa.tarifa_hora = datos.tarifa_hora
        repositorio.agregar(tarifa)
    registrar_auditoria(
        repositorio,
        usuario,
        "guardar_persona",
        "personas",
        persona.id,
        {campo: valor for campo, valor in campos.items() if campo != "documento"},
    )
    confirmar(repositorio)
    return {"id": persona.id, "mensaje": "Persona guardada.",
            **({"usuario": cuenta.nombre_usuario, "clave_temporal": clave_entrega,
                "vence": cuenta.clave_temporal_vence.replace(tzinfo=timezone.utc).isoformat()} if clave_entrega else {})}




def guardar_horario(
    datos: DatosHorario, usuario: Usuario = None, repositorio: RepositorioGestion = None,
    horario_id: int | None = None, confirmar_cambios: bool = True,
):
    carrera = (datos.carrera or "").strip()
    if datos.tipo_personal == "docente" and not carrera:
        raise ErrorAplicacion(422, "Indica la carrera del horario docente.")
    turnos = {"manana": "Mañana", "tarde": "Tarde", "noche": "Noche", "completo": "Jornada completa"}
    vistos = set()
    for tramo in datos.tramos:
        if not tramo.hora_salida:
            raise ErrorAplicacion(422, "Cada día laboral necesita entrada y salida.")
        if tramo.hora_salida and tramo.hora_salida <= tramo.hora_entrada:
            raise ErrorAplicacion(422, "La salida debe ser posterior a la entrada.")
        clave = (tramo.dia_semana, tramo.hora_entrada)
        if clave in vistos:
            raise ErrorAplicacion(422, "Hay tramos repetidos.")
        vistos.add(clave)
    sede = sede_usuario(repositorio, usuario)
    horario = repositorio.bloquear_horario(horario_id) if horario_id is not None else Horario(sede_id=sede)
    if not horario or (horario_id is not None and horario.sede_id != sede):
        raise ErrorAplicacion(404, "Horario no disponible en tu sede.")
    if horario_id is not None:
        if repositorio.horario_tiene_asignaciones(horario.id, bloquear=True):
            horario = Horario(sede_id=sede)
        else:
            repositorio.eliminar_tramos(horario.id)
    horario.tipo_personal = datos.tipo_personal
    horario.carrera = carrera if datos.tipo_personal == "docente" else None
    horario.turno = datos.turno
    horario.nombre = f"{carrera if datos.tipo_personal == 'docente' else 'Administración'} · {turnos[datos.turno]}"[:100]
    repositorio.agregar(horario)
    repositorio.sincronizar()
    for tramo in datos.tramos:
        repositorio.agregar(TramoHorario(horario_id=horario.id, **tramo.model_dump()))
    registrar_auditoria(
        repositorio,
        usuario,
        "editar_horario" if horario_id is not None else "crear_horario",
        "horarios",
        horario.id,
        datos.model_dump(),
    )
    if confirmar_cambios:
        confirmar(repositorio)
    return {"id": horario.id, "mensaje": "Horario actualizado." if horario_id is not None else "Horario creado. Puedes asignarlo a personas."}




def asignar_horario_laboral(datos, usuario=None, repositorio=None, confirmar_cambios=True):
    sede = sede_usuario(repositorio, usuario)
    comprobar_horario(repositorio, sede, datos.horario_id)
    horario = repositorio.obtener_horario(datos.horario_id)
    validar_fecha(repositorio, sede, datos.vigente_desde)
    personas = []
    for identificador in sorted(set(datos.persona_ids)):
        persona = comprobar_persona(repositorio, usuario, identificador)
        persona = repositorio.bloquear_persona(persona)
        if not persona.activa or repositorio.obtener_rol(persona.rol_id).codigo not in ("docente", "administrativo"):
            raise ErrorAplicacion(422, "Selecciona docentes o personal administrativo activos.")
        if repositorio.obtener_rol(persona.rol_id).codigo != horario.tipo_personal:
            raise ErrorAplicacion(422, "El personal seleccionado no corresponde a este tipo de horario.")
        personas.append(persona)
    tramos = repositorio.tramos_del_horario(repositorio.obtener_horario(datos.horario_id))
    if any(not tramo.hora_salida for tramo in tramos):
        raise ErrorAplicacion(422, "El horario laboral debe incluir entrada y salida en cada tramo.")
    for persona in personas:
        asignar_desde(repositorio, persona, datos.horario_id, datos.vigente_desde)
        registrar_auditoria(repositorio, usuario, "asignar_horario_laboral", "personas", persona.id,
            {"horario_id": datos.horario_id, "desde": str(datos.vigente_desde)})
    if confirmar_cambios:
        confirmar(repositorio)
        notificar_marcado(sede)
    return {"mensaje": f"Horario laboral confirmado para {len(personas)} personas."}


def guardar_semana_laboral(datos, usuario, repositorio):
    from .esquemas import DatosAsignacionLaboral
    administrador(usuario)
    if len({tramo.dia_semana for tramo in datos.tramos}) != len(datos.tramos):
        raise ErrorAplicacion(422, "Configura una sola entrada y salida por día.")
    validar_fecha(repositorio, sede_usuario(repositorio, usuario), datos.vigente_desde)
    try:
        resultado = guardar_horario(
            DatosHorario(**datos.model_dump(include=set(DatosHorario.model_fields))),
            usuario, repositorio, horario_id=datos.horario_id, confirmar_cambios=False,
        )
        repositorio.sincronizar()
        if datos.persona_ids:
            asignar_horario_laboral(DatosAsignacionLaboral(
                persona_ids=datos.persona_ids, horario_id=resultado["id"], vigente_desde=datos.vigente_desde,
            ), usuario, repositorio, confirmar_cambios=False)
        confirmar(repositorio)
    except Exception:
        repositorio.revertir()
        raise
    notificar_marcado(sede_usuario(repositorio, usuario))
    return {"id": resultado["id"], "mensaje": f"Semana guardada. Horario aplicado a {len(set(datos.persona_ids))} personas."}


def eliminar_horario(identificador: int, usuario: Usuario = None, repositorio: RepositorioGestion = None):
    horario = repositorio.bloquear_horario(identificador)
    if not horario or horario.sede_id != sede_usuario(repositorio, usuario):
        raise ErrorAplicacion(404, "Horario no disponible en tu sede.")
    if repositorio.horario_tiene_asignaciones(identificador, bloquear=True):
        raise ErrorAplicacion(409, "Este horario tiene asignaciones actuales o históricas. No se puede eliminar.")
    registrar_auditoria(repositorio, usuario, "eliminar_horario", "horarios", identificador, {"nombre": horario.nombre})
    repositorio.eliminar_tramos(identificador)
    repositorio.eliminar(horario)
    confirmar(repositorio)
    return {"mensaje": "Horario eliminado."}


def intervalo(repositorio, usuario, desde, hasta):
    if hasta < desde or (hasta - desde).days > 61:
        raise ErrorAplicacion(422, "Selecciona un intervalo de hasta 62 días.")
    sede = repositorio.obtener_sede(sede_usuario(repositorio, usuario))
    zona = ZoneInfo(sede.zona_horaria)
    inicio = (
        datetime.combine(desde, time.min, zona)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )
    fin = (
        datetime.combine(hasta + timedelta(days=1), time.min, zona)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )
    return (sede, zona, inicio, fin)


def filas_diarias(repositorio, usuario, desde, hasta, persona_id=None, solo_marcados=False):
    sede, zona, inicio, fin = intervalo(repositorio, usuario, desde, hasta)
    personas = (repositorio.personas_con_marcados(sede, inicio, fin)
                if solo_marcados else repositorio.personas_del_diario(sede, persona_id))
    marcas = repositorio.marcados_del_intervalo(fin, inicio, sede, persona_id)
    por_dia = {}
    for marcado in marcas:
        dia = marcado.ocurrido_en.replace(tzinfo=timezone.utc).astimezone(zona).date()
        por_dia.setdefault((marcado.persona_id, dia), []).append(marcado)
    feriados = {
        dia.fecha
        for dia in repositorio.dias_no_lectivos_del_intervalo(desde, hasta, sede)
    }
    justificaciones = {
        (dato.persona_id, dato.fecha): dato
        for dato in repositorio.justificaciones_aprobadas(desde, hasta, sede, persona_id)
    }
    ahora = obtener_hora_utc().replace(tzinfo=timezone.utc).astimezone(zona)
    regla = regla_sede(repositorio, sede.id)
    roles = {}
    grupos = {}
    carreras = {}

    def rol_de(identificador):
        # evita repetir la misma consulta de rol en cada fila
        if identificador not in roles:
            roles[identificador] = repositorio.obtener_rol(identificador)
        return roles[identificador]

    filas = []
    for numero in range((hasta - desde).days + 1):
        fecha = desde + timedelta(days=numero)
        for persona in personas:
            marcas_persona = por_dia.get((persona.id, fecha), [])
            if not persona.activa and (not marcas_persona):
                continue
            rol = rol_de(
                marcas_persona[0].rol_id if marcas_persona else persona.rol_id
            )
            if rol.codigo not in ("docente", "administrativo"):
                continue
            tramos = tramos_para(repositorio, persona, fecha)
            entrada = next(
                (marcado for marcado in marcas_persona if marcado.tipo == "entrada"),
                None,
            )
            salida = next(
                (marcado for marcado in marcas_persona if marcado.tipo == "salida"),
                None,
            )
            estado = (
                entrada.resultado
                or evaluar_manual(repositorio, persona, entrada.ocurrido_en, "entrada")
                if entrada
                else "Pendiente"
            )
            if entrada and estado == "Registrado · horario pendiente":
                estado = evaluar_manual(repositorio, persona, entrada.ocurrido_en, "entrada")
            programadas = sum(
                (
                    (
                        datetime.combine(fecha, tramo.hora_salida)
                        - datetime.combine(fecha, tramo.hora_entrada)
                    ).total_seconds()
                    / 3600
                    for tramo in tramos
                    if tramo.hora_salida
                )
            )
            if fecha in feriados:
                programadas = 0
            minutos = 0
            if entrada and tramos:
                local = entrada.ocurrido_en.replace(tzinfo=timezone.utc).astimezone(
                    zona
                )
                minutos = max(
                    0,
                    int(
                        (
                            local
                            - datetime.combine(fecha, tramos[0].hora_entrada, zona)
                        ).total_seconds()
                        // 60
                    ),
                )
            if not entrada:
                if fecha in feriados or not tramos:
                    estado = "No programado"
                elif ahora > datetime.combine(
                    fecha, tramos[0].hora_entrada, zona
                ) + timedelta(minutes=regla.limite_ausencia_minutos):
                    estado = "Falta"
            justificacion = justificaciones.get((persona.id, fecha))
            if justificacion and (
                justificacion.tipo == "falta"
                and estado == "Falta"
                or (justificacion.tipo == "tardanza" and estado == "Tardanza")
            ):
                estado = "Justificado"
            horas = (
                max(
                    0, (salida.ocurrido_en - entrada.ocurrido_en).total_seconds() / 3600
                )
                if entrada and salida
                else 0
            )
            grupo = None
            if persona.grupo_id:
                # el grupo y la carrera no cambian del dia a la fecha consultada
                grupo = grupos.get(persona.grupo_id, False)
                if grupo is False:
                    grupo = repositorio.obtener_grupo(persona.grupo_id)
                    grupos[persona.grupo_id] = grupo
            carrera = None
            if grupo:
                carrera = carreras.get(grupo.carrera_id, False)
                if carrera is False:
                    carrera = repositorio.obtener_carrera(grupo.carrera_id)
                    carreras[grupo.carrera_id] = carrera
            filas.append(
                {
                    "persona_id": persona.id,
                    "codigo": persona.codigo,
                    "nombre": f"{persona.nombres} {persona.apellidos}",
                    "rol": rol.nombre,
                    "rol_codigo": rol.codigo,
                    "fecha": str(fecha),
                    "entrada": (
                        entrada.ocurrido_en.replace(tzinfo=timezone.utc).isoformat()
                        if entrada
                        else None
                    ),
                    "salida": (
                        salida.ocurrido_en.replace(tzinfo=timezone.utc).isoformat()
                        if salida
                        else None
                    ),
                    "estado": estado,
                    "minutos_tardanza": minutos,
                    "horas_programadas": round(programadas, 2),
                    "horas_permanencia": round(horas, 2),
                    "grupo": grupo.codigo if grupo else "",
                    "ciclo": grupo.ciclo if grupo else "",
                    "turno": grupo.turno if grupo else "",
                    "carrera": carrera.nombre if carrera else "",
                    "modalidad": entrada.modalidad if entrada else "",
                    "requiere_salida": rol.requiere_salida,
                }
            )
    return filas


def filas_marcadas(filas):
    return sorted(
        (fila for fila in filas if fila["entrada"] or fila["salida"]),
        key=lambda fila: (max(fila["entrada"] or "", fila["salida"] or ""), fila["persona_id"]),
        reverse=True,
    )


def consultar_diario(
    desde: date,
    hasta: date,
    usuario: Usuario = None,
    repositorio: RepositorioGestion = None,
    solo_marcados: bool = False,
):
    filas = filas_diarias(repositorio, usuario, desde, hasta, solo_marcados=solo_marcados)
    return filas_marcadas(filas) if solo_marcados else filas


def consultar_resumen(
    fecha: date, usuario: Usuario = None, repositorio: RepositorioGestion = None
):
    diario = filas_diarias(repositorio, usuario, fecha, fecha)
    semana = filas_diarias(repositorio, usuario, fecha - timedelta(days=6), fecha)
    pendientes = repositorio.justificaciones_pendientes(
        sede_usuario(repositorio, usuario)
    )
    return {
        "presentes": sum((fila["entrada"] is not None for fila in diario)),
        "tardanzas": sum((fila["estado"] == "Tardanza" for fila in diario)),
        "faltas": sum((fila["estado"] == "Falta" for fila in diario)),
        "pendientes": len(pendientes),
        "diario": filas_marcadas(diario),
        "semana": [
            {
                "fecha": str(fecha - timedelta(days=6 - numero)),
                "presentes": sum(
                    (
                        fila["entrada"] is not None
                        and fila["fecha"] == str(fecha - timedelta(days=6 - numero))
                        for fila in semana
                    )
                ),
            }
            for numero in range(7)
        ],
    }


def registrar_manual(
    datos: DatosManual, usuario: Usuario = None, repositorio: RepositorioGestion = None
):
    persona = comprobar_persona(repositorio, usuario, datos.persona_id)
    persona = repositorio.bloquear_persona(persona)
    previo = repositorio.marcado_por_evento(datos)
    if previo:
        if previo.persona_id != persona.id or previo.registrado_por_id != usuario.id or previo.modalidad != "manual":
            raise ErrorAplicacion(409, "Ese identificador de registro ya existe.")
        return {"mensaje": "La entrada ya estaba guardada.", "id": previo.id, "nombre": f"{persona.nombres} {persona.apellidos}", "hora": previo.ocurrido_en.replace(tzinfo=timezone.utc).isoformat(), "resultado": previo.resultado, "repetido": True}
    if not persona.activa:
        raise ErrorAplicacion(422, "La persona está desactivada.")
    if repositorio.obtener_rol(persona.rol_id).codigo not in ("docente", "administrativo"):
        raise ErrorAplicacion(422, "Este registro manual es únicamente para docentes y personal administrativo.")
    sede = repositorio.obtener_sede(persona.sede_id)
    instante = obtener_hora_utc()
    local = instante.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(sede.zona_horaria))
    _, _, inicio, fin = intervalo(repositorio, usuario, local.date(), local.date())
    existentes = repositorio.marcados_de_persona(fin, inicio, persona)
    if any(marcado.tipo == "entrada" for marcado in existentes):
        raise ErrorAplicacion(409, "La persona ya tiene una entrada registrada hoy.")
    filas = filas_diarias(repositorio, usuario, local.date(), local.date(), persona_id=persona.id)
    if filas and filas[0]["estado"] in ("Falta", "Justificado"):
        raise ErrorAplicacion(409, "El plazo de ingreso terminó. Acude a administración para revisar la justificación.")
    tramos = tramos_para(repositorio, persona, local.date())
    regla = regla_sede(repositorio, persona.sede_id)
    if regla.anticipacion_minutos and tramos and local < datetime.combine(local.date(), tramos[0].hora_entrada, local.tzinfo) - timedelta(minutes=regla.anticipacion_minutos):
        raise ErrorAplicacion(409, "El ingreso todavía no está habilitado para este horario.")
    from ...models import PuntoAsistencia

    punto = repositorio.primer_punto_de_sede(PuntoAsistencia, persona)
    if not punto or not punto.activo:
        raise ErrorAplicacion(409, "La sede no tiene un punto de asistencia activo.")
    resultado = evaluar_manual(repositorio, persona, instante, "entrada")
    marcado = Marcado(
        persona_id=persona.id,
        punto_id=punto.id,
        rol_id=persona.rol_id,
        tipo="entrada",
        modalidad="manual",
        ocurrido_en=instante,
        registrado_por_id=usuario.id,
        motivo="Ingreso presencial registrado por el encargado",
        identificador_evento=datos.identificador_evento,
        resultado=resultado,
    )
    repositorio.agregar(marcado)
    repositorio.sincronizar()
    registrar_auditoria(repositorio, usuario, "registro_manual", "marcados", marcado.id, {"hora": instante, "persona_id": persona.id, "modalidad": "manual"})
    respuesta = {"mensaje": "Entrada registrada.", "id": marcado.id, "nombre": f"{persona.nombres} {persona.apellidos}", "hora": instante.replace(tzinfo=timezone.utc).isoformat(), "resultado": resultado, "repetido": False}
    sede_id = persona.sede_id
    confirmar(repositorio)
    notificar_marcado(sede_id)
    return respuesta


def consultar_justificaciones(
    usuario: Usuario = None, repositorio: RepositorioGestion = None,
    pagina: int = 1, por_pagina: int = 50,
):
    total, filas = repositorio.pagina_justificaciones(sede_usuario(repositorio, usuario), pagina, por_pagina)
    elementos = [
        {
            **datos_objeto(justificacion),
            "nombre": f"{persona.nombres} {persona.apellidos}",
        }
        for justificacion, persona in filas
    ]
    return {"elementos": elementos, "total": total, "pagina": pagina, "por_pagina": por_pagina}


def consultar_incidencias(desde, hasta, usuario=None, repositorio=None):
    filas = filas_diarias(repositorio, usuario, desde, hasta)
    solicitudes = repositorio.justificaciones_de_sede(sede_usuario(repositorio, usuario))
    recientes = {}
    for solicitud, persona in solicitudes:
        if desde <= solicitud.fecha <= hasta:
            clave = (solicitud.persona_id, str(solicitud.fecha), solicitud.tipo)
            if clave not in recientes:
                recientes[clave] = {**datos_objeto(solicitud)}
    resultados = []
    for fila in filas:
        tipos = {tipo for persona_id, fecha, tipo in recientes if persona_id == fila["persona_id"] and fecha == fila["fecha"]}
        if fila["estado"] in ("Falta", "Tardanza"):
            tipos.add("falta" if fila["estado"] == "Falta" else "tardanza")
        for tipo in tipos:
            solicitud = recientes.get((fila["persona_id"], fila["fecha"], tipo))
            resultados.append({**fila, "tipo": tipo, "solicitud": solicitud,
                "estado_justificacion": solicitud["estado"] if solicitud else "sin_justificar"})
    resultados.sort(key=lambda fila: (fila["fecha"], fila["nombre"], fila["tipo"]), reverse=True)
    return resultados


def crear_justificacion(
    datos: DatosJustificacion,
    usuario: Usuario = None,
    repositorio: RepositorioGestion = None,
):
    if usuario.permiso != "administrador":
        raise ErrorAplicacion(403, "Solo administración puede registrar justificaciones.")
    persona = comprobar_persona(repositorio, usuario, datos.persona_id)
    repositorio.bloquear_persona(persona)
    existentes = repositorio.justificaciones_de_sede(sede_usuario(repositorio, usuario))
    if any(solicitud.persona_id == datos.persona_id and solicitud.fecha == datos.fecha and solicitud.tipo == datos.tipo and solicitud.estado in ("pendiente", "aprobada") for solicitud, _ in existentes):
        raise ErrorAplicacion(409, "Esta incidencia ya tiene una justificación pendiente o aprobada.")
    filas = filas_diarias(repositorio, usuario, datos.fecha, datos.fecha, persona_id=datos.persona_id)
    esperado = "Falta" if datos.tipo == "falta" else "Tardanza"
    if not any(fila["estado"] == esperado for fila in filas):
        raise ErrorAplicacion(422, "La incidencia ya no está disponible. Actualiza los registros antes de justificar.")
    justificacion = Justificacion(**datos.model_dump(), creada_por_id=usuario.id)
    justificacion.estado = "aprobada"
    justificacion.resuelta_por_id = usuario.id
    justificacion.observacion = "Aprobada al registrar por administración."
    repositorio.agregar(justificacion)
    repositorio.sincronizar()
    registrar_auditoria(
        repositorio,
        usuario,
        "crear_justificacion",
        "justificaciones",
        justificacion.id,
        {"persona_id": datos.persona_id, "fecha": datos.fecha,
         "estado": "aprobada", "aprobacion_directa": True},
    )
    confirmar(repositorio)
    return {"mensaje": "Incidencia justificada."}


def resolver_justificacion(
    identificador: int,
    datos: ResolverJustificacion,
    usuario: Usuario = None,
    repositorio: RepositorioGestion = None,
):
    justificacion = repositorio.obtener_justificacion(identificador)
    if not justificacion:
        raise ErrorAplicacion(404, "Justificación no disponible.")
    comprobar_persona(repositorio, usuario, justificacion.persona_id)
    anterior = justificacion.estado
    justificacion.estado, justificacion.observacion, justificacion.resuelta_por_id = (
        datos.estado,
        datos.observacion,
        usuario.id,
    )
    registrar_auditoria(
        repositorio,
        usuario,
        "resolver_justificacion",
        "justificaciones",
        justificacion.id,
        {"anterior": anterior, **datos.model_dump()},
    )
    confirmar(repositorio)
    return {"mensaje": "Estado actualizado."}


def guardar_reglas(
    datos: DatosReglas, usuario: Usuario = None, repositorio: RepositorioGestion = None
):
    if datos.alerta_porcentaje <= datos.observacion_porcentaje:
        raise ErrorAplicacion(
            422, "El umbral de alerta debe superar el de observación."
        )
    hoy = (
        obtener_hora_utc()
        .replace(tzinfo=timezone.utc)
        .astimezone(ZoneInfo("America/Lima"))
        .date()
    )
    for identificador, minutos in datos.tolerancias.items():
        if not repositorio.obtener_rol(identificador) or not 0 <= minutos <= 1440:
            raise ErrorAplicacion(422, "Revisa los roles y sus minutos de tolerancia.")
        margen = repositorio.bloquear_tolerancia(hoy, identificador)
        if margen and margen.vigente_desde == hoy:
            margen.minutos = minutos
        else:
            if margen:
                margen.vigente_hasta = hoy - timedelta(days=1)
            repositorio.agregar(
                ToleranciaRol(rol_id=identificador, minutos=minutos, vigente_desde=hoy)
            )
    regla = regla_sede(repositorio, sede_usuario(repositorio, usuario))
    for campo, valor in datos.model_dump(exclude={"tolerancias"}).items():
        setattr(regla, campo, valor)
    repositorio.agregar(regla)
    repositorio.sincronizar()
    registrar_auditoria(
        repositorio,
        usuario,
        "guardar_reglas",
        "reglas_sedes",
        regla.id,
        datos.model_dump(),
    )
    confirmar(repositorio)
    return {
        "mensaje": "Reglas guardadas. Los marcados ya evaluados conservan su resultado original."
    }


def guardar_dia(
    datos: DatosDia, usuario: Usuario = None, repositorio: RepositorioGestion = None
):
    sede = sede_usuario(repositorio, usuario)
    dia = repositorio.dia_no_lectivo(datos, sede) or DiaNoLectivo(
        sede_id=sede, fecha=datos.fecha
    )
    dia.motivo = datos.motivo
    repositorio.agregar(dia)
    repositorio.sincronizar()
    registrar_auditoria(
        repositorio,
        usuario,
        "guardar_dia_no_lectivo",
        "dias_no_lectivos",
        dia.id,
        datos.model_dump(),
    )
    confirmar(repositorio)
    return {"mensaje": "Día no lectivo guardado."}


def guardar_dispositivo(
    datos: DatosDispositivo,
    usuario: Usuario = None,
    repositorio: RepositorioGestion = None,
):
    if datos.direccion_ip:
        try:
            ip_address(datos.direccion_ip)
        except ValueError:
            raise ErrorAplicacion(422, "Escribe una dirección IP válida.")
    sede = sede_usuario(repositorio, usuario)
    dispositivo = (
        repositorio.obtener_dispositivo(datos.id)
        if datos.id
        else Dispositivo(sede_id=sede)
    )
    if not dispositivo or dispositivo.sede_id != sede:
        raise ErrorAplicacion(404, "Dispositivo no disponible.")
    for campo, valor in datos.model_dump(exclude={"id"}).items():
        setattr(dispositivo, campo, valor)
    repositorio.agregar(dispositivo)
    repositorio.sincronizar()
    registrar_auditoria(
        repositorio,
        usuario,
        "guardar_dispositivo",
        "dispositivos",
        dispositivo.id,
        datos.model_dump(),
    )
    confirmar(repositorio)
    return {
        "mensaje": "Configuración del puesto QR guardada."
    }


def consultar_expediente(
    identificador: int,
    desde: date,
    hasta: date,
    usuario: Usuario = None,
    repositorio: RepositorioGestion = None,
):
    persona = comprobar_persona(repositorio, usuario, identificador)
    valor = f"fym:carne:{persona.id}:{persona.version_carne}"
    filas = filas_diarias(repositorio, usuario, desde, hasta, persona_id=persona.id)
    programados = [
        fila for fila in filas if fila["estado"] not in ("No programado", "Pendiente")
    ]
    faltas = sum((fila["estado"] == "Falta" for fila in programados))
    porcentaje = round(faltas * 100 / len(programados), 1) if programados else 0
    regla = regla_sede(repositorio, persona.sede_id)
    alerta = (
        "Alerta"
        if porcentaje >= regla.alerta_porcentaje
        else "Observación" if porcentaje >= regla.observacion_porcentaje else "Regular"
    )
    return {
        "persona": {
            "nombre": f"{persona.nombres} {persona.apellidos}",
            "codigo": persona.codigo,
            "rol": repositorio.obtener_rol(persona.rol_id).nombre,
            "iniciales": iniciales_persona(persona),
            "sede": repositorio.obtener_sede(persona.sede_id).nombre,
            "qr": valor + ":" + firmar(valor),
        },
        "calendario": filas,
        "faltas": faltas,
        "porcentaje_faltas": porcentaje,
        "alerta": alerta,
        "tramos": [
            datos_objeto(tramo) for tramo in tramos_para(repositorio, persona, hasta)
        ],
    }


def consultar_preplanilla(
    desde: date,
    hasta: date,
    tarifa: Decimal | None = None,
    usuario: Usuario = None,
    repositorio: RepositorioGestion = None,
):
    if tarifa is not None and (not 0 <= tarifa <= 100000):
        raise ErrorAplicacion(422, "La tarifa debe estar entre 0 y 100000.")
    filas = filas_diarias(repositorio, usuario, desde, hasta)
    docentes = repositorio.docentes_de_sede(sede_usuario(repositorio, usuario))
    resultados = []
    for docente in docentes:
        datos = [fila for fila in filas if fila["persona_id"] == docente.id]
        configurada = repositorio.tarifa_del_docente(docente)
        valor = (
            tarifa
            if tarifa is not None
            else Decimal(configurada.tarifa_hora) if configurada else Decimal(0)
        )
        horas = sum((fila["horas_permanencia"] for fila in datos))
        minutos = sum(
            (fila["minutos_tardanza"] for fila in datos if fila["estado"] == "Tardanza")
        )
        resultados.append(
            {
                "persona_id": docente.id,
                "codigo": docente.codigo,
                "nombre": f"{docente.nombres} {docente.apellidos}",
                "horas_programadas": round(
                    sum((fila["horas_programadas"] for fila in datos)), 2
                ),
                "horas_permanencia": round(horas, 2),
                "minutos_tardanza": minutos,
                "faltas": sum((fila["estado"] == "Falta" for fila in datos)),
                "dias_incompletos": sum(
                    (
                        fila["entrada"] is not None and fila["salida"] is None
                        for fila in datos
                    )
                ),
                "tarifa_configurada": tarifa is not None or configurada is not None,
                "dias_tardanza": sum(fila["estado"] == "Tardanza" for fila in datos),
                "tarifa_hora": float(valor),
                "importe_estimado": round(float(valor) * horas, 2),
                "descuento_referencial": round(float(valor) * minutos / 60, 2),
            }
        )
    return resultados


def exportar(
    desde: date,
    hasta: date,
    tipo: Literal["asistencia", "preplanilla"] = "asistencia",
    rol: str = "",
    buscar: str = "",
    estado: str = "",
    carrera: str = "",
    tarifa: Decimal | None = None,
    solo_marcados: bool = False,
    incluir_no_programados: bool = True,
    ciclo: str = "",
    turno: str = "",
    usuario: Usuario = None,
    repositorio: RepositorioGestion = None,
):
    if tipo == "preplanilla":
        if usuario.permiso != "administrador":
            raise ErrorAplicacion(
                403, "La preplanilla requiere permiso de administrador."
            )
        filas = consultar_preplanilla(desde, hasta, tarifa, usuario, repositorio)
    else:
        filas = [
            fila
            for fila in consultar_diario(desde, hasta, usuario, repositorio, solo_marcados=solo_marcados)
            if (not rol or fila["rol_codigo"] == rol)
            and (not estado or fila["estado"] == estado)
            and (not carrera or fila["carrera"] == carrera)
            and (incluir_no_programados or fila["estado"] != "No programado")
            and (not ciclo or fila["ciclo"] == ciclo)
            and (not turno or fila["turno"] == turno)
            and (
                not buscar
                or buscar.lower() in (fila["nombre"] + " " + fila["codigo"]).lower()
            )
        ]
    if tipo == "preplanilla":
        detalle = [fila for fila in filas_diarias(repositorio, usuario, desde, hasta) if fila["rol_codigo"] == "docente"]
        resumen = [
            {**fila, "importe_estimado": fila["importe_estimado"] if fila["tarifa_configurada"] else "Sin tarifa", "descuento_referencial": fila["descuento_referencial"] if fila["tarifa_configurada"] else "Sin tarifa"}
            for fila in filas
        ]
        return construir_excel(resumen, tipo, detalle=detalle, desde=desde, hasta=hasta)
    filas.sort(key=lambda fila: (fila["fecha"], fila["entrada"] or "", fila["persona_id"]), reverse=True)
    filtros = " · ".join(valor for valor in [
        f"Rol: {rol}" if rol else "",
        f"Estado: {estado}" if estado else "",
        f"Carrera: {carrera}" if carrera else "",
        f"Ciclo: {ciclo}" if ciclo else "",
        f"Turno: {turno}" if turno else "",
        f"Busqueda: {buscar}" if buscar else "",
        "Incluye no programados" if incluir_no_programados else "Sin dias no programados",
    ] if valor)
    return construir_excel(filas, tipo, desde=desde, hasta=hasta, filtros=filtros)


def consultar_historial_marcados(
    desde: date,
    hasta: date,
    usuario: Usuario = None,
    repositorio: RepositorioGestion = None,
    pagina: int = 1,
    por_pagina: int = 50,
    modalidad: str | None = None,
):
    sede, zona, inicio, fin = intervalo(repositorio, usuario, desde, hasta)
    total, filas = repositorio.historial_de_marcados(fin, inicio, sede, pagina, por_pagina, modalidad)
    elementos = [
        {
            "id": marcado.id,
            "persona_id": persona.id,
            "nombre": f"{persona.nombres} {persona.apellidos}",
            "codigo": persona.codigo,
            "tipo": marcado.tipo,
            "fecha": str(
                marcado.ocurrido_en.replace(tzinfo=timezone.utc).astimezone(zona).date()
            ),
            "hora": marcado.ocurrido_en.replace(tzinfo=timezone.utc).isoformat(),
            "cargado_en": marcado.registrado_en.replace(
                tzinfo=timezone.utc
            ).isoformat(),
            "responsable": responsable or "Marcado personal",
            "modalidad": marcado.modalidad,
            "motivo": marcado.motivo,
            "resultado": marcado.resultado
            or evaluar_manual(repositorio, persona, marcado.ocurrido_en, marcado.tipo),
        }
        for marcado, persona, responsable in filas
    ]
    return {"elementos": elementos, "total": total, "pagina": pagina, "por_pagina": por_pagina}
