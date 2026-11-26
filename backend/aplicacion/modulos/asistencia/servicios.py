from ...compartido.avisos_asistencia import notificar_marcado
from ...compartido.identidad import iniciales_persona
from ...compartido.codigos_qr import firmar, validar_firma
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import hmac
import secrets
import time
from ...models import (
    Persona,
    Usuario,
    Marcado,
    PuestoAbierto,
    EventoPuesto,
    obtener_hora_utc,
)
from ...seguridad import resumir_token
from .repositorio import RepositorioAsistencia
from ...compartido.errores import ErrorAplicacion
from .esquemas import OpcionesPunto, LecturaQR


def identidad(repositorio: RepositorioAsistencia, persona: Persona):
    rol = repositorio.obtener_rol(persona.rol_id)
    return {
        "nombre": f"{persona.nombres} {persona.apellidos}",
        "rol": rol.nombre,
        "iniciales": iniciales_persona(persona),
        "codigo": persona.codigo,
    }


def comprobar_puesto(repositorio: RepositorioAsistencia, puesto: PuestoAbierto):
    punto = repositorio.obtener_punto_asistencia(puesto.punto_id)
    sede = repositorio.obtener_sede(punto.sede_id)
    encargado = repositorio.obtener_usuario(puesto.encargado_id)
    encargado_persona = repositorio.obtener_persona(encargado.persona_id)
    if (
        not puesto.activo
        or puesto.vence_en <= obtener_hora_utc()
        or (not punto.activo)
        or (not sede.activa)
    ):
        raise ErrorAplicacion(409, "El puesto está pausado o cerrado.")
    if (
        not encargado.activo
        or not encargado_persona.activa
        or encargado.permiso not in ("administrador", "operador")
    ):
        raise ErrorAplicacion(409, "El encargado del puesto ya no está autorizado.")
    return punto


def obtener_puesto(token: str, repositorio: RepositorioAsistencia = None):
    if not token or len(token) > 128:
        raise ErrorAplicacion(401, "Abre el puesto desde el panel del encargado.")
    puesto = repositorio.puesto_por_token(token)
    if not puesto:
        raise ErrorAplicacion(401, "El acceso del puesto no es válido.")
    comprobar_puesto(repositorio, puesto)
    return puesto


def obtener_punto_encargado(repositorio: RepositorioAsistencia, usuario: Usuario):
    persona = repositorio.obtener_persona(usuario.persona_id)
    punto = repositorio.primer_punto_de_sede(persona)
    if not punto:
        raise ErrorAplicacion(404, "La sede no tiene punto de asistencia.")
    return punto


def consultar_punto(usuario: Usuario = None, repositorio: RepositorioAsistencia = None):
    punto = obtener_punto_encargado(repositorio, usuario)
    puesto = repositorio.puesto_abierto(obtener_hora_utc(), punto)
    propio = repositorio.puesto_abierto(obtener_hora_utc(), punto, usuario.id)
    return {
        "nombre": punto.nombre,
        "activo": puesto is not None,
        "propio_activo": propio is not None,
        "camara_puesto_habilitada": propio.camara_puesto_habilitada if propio else punto.camara_puesto_habilitada,
        "escaneo_movil_habilitado": propio.escaneo_movil_habilitado if propio else punto.escaneo_movil_habilitado,
    }


def abrir_puesto(
    datos: OpcionesPunto,
    usuario: Usuario = None,
    repositorio: RepositorioAsistencia = None,
):
    if not datos.camara_puesto_habilitada and (not datos.escaneo_movil_habilitado):
        raise ErrorAplicacion(422, "Activa al menos una modalidad.")
    punto = obtener_punto_encargado(repositorio, usuario)
    repositorio.bloquear_punto(punto)
    repositorio.desactivar_puestos(punto, usuario.id)
    token = secrets.token_urlsafe(32)
    puesto = PuestoAbierto(
        punto_id=punto.id,
        encargado_id=usuario.id,
        token_hash=resumir_token(token),
        activo=True,
        camara_puesto_habilitada=datos.camara_puesto_habilitada,
        escaneo_movil_habilitado=datos.escaneo_movil_habilitado,
        vence_en=obtener_hora_utc() + timedelta(hours=16),
    )
    repositorio.agregar(puesto)
    repositorio.confirmar()
    return {"token_puesto": token}


def pausar_puesto(usuario: Usuario = None, repositorio: RepositorioAsistencia = None):
    punto = obtener_punto_encargado(repositorio, usuario)
    repositorio.bloquear_punto(punto)
    repositorio.desactivar_puestos(punto, usuario.id)
    repositorio.confirmar()
    return {"mensaje": "Tu puesto está pausado. Ábrelo nuevamente para reanudar."}


def consultar_estado_puesto(
    puesto: PuestoAbierto = None, repositorio: RepositorioAsistencia = None
):
    punto = repositorio.obtener_punto_asistencia(puesto.punto_id)
    bloque = int(time.time()) // 30
    valor = f"fym:puesto:{puesto.id}:{bloque}"
    return {
        "nombre": punto.nombre,
        "qr": valor + ":" + firmar(valor),
        "vence_en": (bloque + 1) * 30,
        "camara": puesto.camara_puesto_habilitada,
        "movil": puesto.escaneo_movil_habilitado,
    }


def consultar_carne(usuario: Usuario = None, repositorio: RepositorioAsistencia = None):
    persona = repositorio.obtener_persona(usuario.persona_id)
    valor = f"fym:carne:{persona.id}:{persona.version_carne}"
    return {
        **identidad(repositorio, persona),
        "sede": repositorio.obtener_sede(persona.sede_id).nombre,
        "qr": valor + ":" + firmar(valor),
    }


def formato_evento(repositorio: RepositorioAsistencia, evento: EventoPuesto):
    persona = (
        repositorio.obtener_persona(evento.persona_id) if evento.persona_id else None
    )
    return {
        "id": evento.id,
        "persona": identidad(repositorio, persona) if persona else None,
        "tipo": evento.tipo,
        "hora": evento.ocurrido_en.replace(tzinfo=timezone.utc).isoformat(),
        "resultado": evento.resultado,
        "aceptado": evento.aceptado,
        "repetido": False,
    }


def consultar_eventos(
    despues: int = 0,
    puesto: PuestoAbierto = None,
    repositorio: RepositorioAsistencia = None,
):
    eventos = repositorio.eventos_recientes(despues, obtener_hora_utc(), puesto)
    return [formato_evento(repositorio, evento) for evento in eventos]


def evaluar_entrada(
    repositorio: RepositorioAsistencia, persona: Persona, ahora: datetime
):
    sede = repositorio.obtener_sede(persona.sede_id)
    local = ahora.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(sede.zona_horaria))
    from ..gestion.servicios import tramos_para

    tramos = tramos_para(repositorio.para_gestion(), persona, local.date())
    tolerancia = repositorio.tolerancia_vigente(local, persona)
    if not tramos:
        return "Registrado · horario pendiente"
    entrada = datetime.combine(local.date(), tramos[0].hora_entrada, local.tzinfo)
    return (
        "Puntual"
        if local <= entrada + timedelta(minutes=tolerancia.minutos if tolerancia else 0)
        else "Tardanza"
    )


def registrar_lectura(
    repositorio: RepositorioAsistencia,
    puesto: PuestoAbierto,
    persona: Persona | None,
    datos: LecturaQR,
    modalidad: str,
    rechazo: str | None = None,
):
    puesto = repositorio.bloquear_puesto(puesto)
    punto = comprobar_puesto(repositorio, puesto)
    if (
        modalidad == "camara_puesto"
        and (not puesto.camara_puesto_habilitada)
        or (modalidad == "escaneo_movil" and (not puesto.escaneo_movil_habilitado))
    ):
        raise ErrorAplicacion(409, "Esta modalidad está desactivada.")
    anterior = repositorio.evento_por_identificador(datos)
    if anterior:
        if anterior.puesto_id != puesto.id or anterior.persona_id != (
            persona.id if persona else None
        ):
            raise ErrorAplicacion(409, "El identificador de lectura ya se utilizó.")
        return {**formato_evento(repositorio, anterior), "repetido": True}
    if persona:
        persona = repositorio.bloquear_persona(persona)
    ahora = obtener_hora_utc()
    tipo = None
    rol = repositorio.obtener_rol(persona.rol_id) if persona else None
    if persona and (not rechazo):
        cuenta = repositorio.cuenta_persona(persona)
        if not persona.activa:
            rechazo = "Persona desactivada"
        elif cuenta and not cuenta.activo:
            rechazo = "Cuenta desactivada"
        elif rol.codigo not in ("docente", "administrativo"):
            rechazo = "Este sistema registra únicamente asistencia del personal."
        elif persona.sede_id != punto.sede_id:
            rechazo = "La persona pertenece a otra sede"
    if persona and (not rechazo):
        zona = ZoneInfo(repositorio.obtener_sede(persona.sede_id).zona_horaria)
        local = ahora.replace(tzinfo=timezone.utc).astimezone(zona)
        inicio = (
            datetime.combine(local.date(), datetime.min.time(), zona)
            .astimezone(timezone.utc)
            .replace(tzinfo=None)
        )
        ultimo = repositorio.ultimo_marcado_del_dia(inicio, persona)
        if ultimo and (ahora - ultimo.ocurrido_en).total_seconds() < 10:
            evento_previo = repositorio.evento_del_marcado(ultimo)
            if evento_previo:
                return {**formato_evento(repositorio, evento_previo), "repetido": True}
        if ultimo and (not rol.requiere_salida or ultimo.tipo == "salida"):
            rechazo = (
                "La asistencia de hoy ya está registrada"
                if not rol.requiere_salida
                else "La entrada y salida de hoy ya están registradas"
            )
            tipo = "entrada" if not rol.requiere_salida else "salida"
        else:
            tipo = "salida" if ultimo else "entrada"
    if persona and (not rechazo) and (tipo == "entrada"):
        from ..gestion.servicios import regla_sede, tramos_para

        regla = regla_sede(repositorio.para_gestion(), persona.sede_id)
        tramos = tramos_para(repositorio.para_gestion(), persona, local.date())
        if (
            regla.anticipacion_minutos
            and tramos
            and (
                local
                < datetime.combine(local.date(), tramos[0].hora_entrada, zona)
                - timedelta(minutes=regla.anticipacion_minutos)
            )
        ):
            rechazo = "El ingreso todavía no está habilitado para tu horario"
        elif tramos and local > (
            datetime.combine(local.date(), tramos[0].hora_entrada, zona)
            + timedelta(minutes=regla.limite_ausencia_minutos)
        ):
            sede = repositorio.obtener_sede(persona.sede_id)
            dias_no_lectivos = repositorio.para_gestion().dias_no_lectivos_del_intervalo(
                local.date(), local.date(), sede
            )
            if not dias_no_lectivos:
                rechazo = (
                    "Falta por ingreso fuera de plazo. "
                    "Acude al área de administración para justificarla"
                )
    resultado = rechazo or (
        "Salida registrada"
        if tipo == "salida"
        else evaluar_entrada(repositorio, persona, ahora)
    )
    marcado = None
    if not rechazo:
        marcado = Marcado(
            identificador_evento=str(datos.identificador_evento),
            persona_id=persona.id,
            punto_id=punto.id,
            rol_id=persona.rol_id,
            tipo=tipo,
            modalidad=modalidad,
            ocurrido_en=ahora,
            resultado=resultado,
            registrado_por_id=(
                puesto.encargado_id if modalidad == "camara_puesto" else None
            ),
        )
        repositorio.agregar(marcado)
        repositorio.sincronizar()
    evento = EventoPuesto(
        puesto_id=puesto.id,
        persona_id=persona.id if persona else None,
        identificador_evento=str(datos.identificador_evento),
        marcado_id=marcado.id if marcado else None,
        tipo=tipo,
        ocurrido_en=ahora,
        resultado=resultado,
        aceptado=not bool(rechazo),
    )
    repositorio.agregar(evento)
    if rechazo:
        from ..acceso.proteccion import registrar
        registrar(repositorio._base, "qr_rechazado", None,
                  f"Puesto: {puesto.id}. Persona: {persona.id if persona else 'no identificada'}. {rechazo}", sede_id=punto.sede_id)
    sede_id = persona.sede_id if marcado else None
    repositorio.confirmar()
    if sede_id is not None:
        notificar_marcado(sede_id)
    return formato_evento(repositorio, evento)


def leer_carne(
    datos: LecturaQR,
    puesto: PuestoAbierto = None,
    repositorio: RepositorioAsistencia = None,
):
    persona = None
    rechazo = None
    try:
        partes = validar_firma(datos.contenido, "carne")
        persona = repositorio.obtener_persona(int(partes[2]))
        if not persona or not hmac.compare_digest(persona.version_carne, partes[3]):
            rechazo = "El carnet no está vigente"
    except (ErrorAplicacion, ValueError):
        rechazo = "QR no válido. Presenta tu carnet de FyM Pass"
    return registrar_lectura(
        repositorio, puesto, persona, datos, "camara_puesto", rechazo
    )


def marcar_desde_movil(
    datos: LecturaQR, usuario: Usuario = None, repositorio: RepositorioAsistencia = None
):
    partes = validar_firma(datos.contenido, "puesto")
    try:
        identificador = int(partes[2])
        bloque = int(partes[3])
    except ValueError:
        raise ErrorAplicacion(422, "El QR no es válido.")
    if bloque != int(time.time()) // 30:
        raise ErrorAplicacion(409, "El QR venció. Escanea el código actual del puesto.")
    puesto = repositorio.obtener_puesto_abierto(identificador)
    if not puesto:
        raise ErrorAplicacion(409, "El puesto no está disponible.")
    return registrar_lectura(
        repositorio,
        puesto,
        repositorio.obtener_persona(usuario.persona_id),
        datos,
        "escaneo_movil",
    )


def consultar_marcados(
    usuario: Usuario = None, repositorio: RepositorioAsistencia = None
):
    persona = repositorio.obtener_persona(usuario.persona_id)
    filas = repositorio.ultimos_marcados_de_sede(persona)
    return [
        {
            "id": marcado.id,
            "persona": identidad(repositorio, sujeto),
            "tipo": marcado.tipo,
            "hora": marcado.ocurrido_en.replace(tzinfo=timezone.utc).isoformat(),
            "resultado": resultado or "Registrado",
            "modalidad": marcado.modalidad,
        }
        for marcado, sujeto, resultado in filas
    ]


def consultar_mis_asistencias(mes=None, usuario=None, repositorio=None):
    from calendar import monthrange
    from ..gestion.servicios import filas_diarias

    persona = repositorio.obtener_persona(usuario.persona_id)
    sede = repositorio.obtener_sede(persona.sede_id)
    hoy = obtener_hora_utc().replace(tzinfo=timezone.utc).astimezone(ZoneInfo(sede.zona_horaria)).date()
    mes = mes or hoy.strftime("%Y-%m")
    try:
        desde = date.fromisoformat(mes + "-01")
    except ValueError:
        raise ErrorAplicacion(422, "Selecciona un mes válido.")
    if desde > hoy:
        raise ErrorAplicacion(422, "Selecciona el mes actual o uno anterior.")
    hasta = min(date(desde.year, desde.month, monthrange(desde.year, desde.month)[1]), hoy)
    filas = filas_diarias(repositorio.para_gestion(), usuario, desde, hasta, persona_id=persona.id)
    campos = ("fecha", "entrada", "salida", "estado")
    return {
        "mes": mes,
        "hasta": hasta.isoformat(),
        "zona_horaria": sede.zona_horaria,
        "requiere_salida": repositorio.obtener_rol(persona.rol_id).requiere_salida,
        "dias": [{campo: fila[campo] for campo in campos} for fila in reversed(filas)],
    }
