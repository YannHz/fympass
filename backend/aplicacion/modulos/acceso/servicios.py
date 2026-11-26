from ...compartido.identidad import iniciales_persona
from collections import OrderedDict
from datetime import timedelta
from threading import Lock
from time import monotonic
import secrets
from ...models import Usuario, SesionAcceso, obtener_hora_utc
from ...seguridad import generar_hash_clave, verificar_clave, resumir_token
from .repositorio import RepositorioAcceso
from ...compartido.errores import ErrorAplicacion
from .esquemas import Credenciales
from . import proteccion
from ...seguridad import validar_clave_personal, requiere_actualizar_hash
from ...config import configuracion

hash_ficticio = generar_hash_clave(secrets.token_urlsafe(32))


def describir_usuario(repositorio: RepositorioAcceso, usuario: Usuario):
    persona = repositorio.obtener_persona(usuario.persona_id)
    rol = repositorio.obtener_rol(persona.rol_id)
    sede = repositorio.obtener_sede(persona.sede_id)
    destinos = {
        "administrador": "/administracion",
        "operador": "/operacion",
        "personal": "/mi-acceso",
    }
    return {
        "id": usuario.id,
        "debe_cambiar_clave": usuario.debe_cambiar_clave,
        "inactividad_minutos": configuracion.inactividad_minutos,
        "usuario": usuario.nombre_usuario,
        "iniciales": iniciales_persona(persona),
        "nombre": f"{persona.nombres} {persona.apellidos}",
        "rol": rol.codigo,
        "permiso": usuario.permiso,
        "sede": sede.nombre,
        "destino": destinos[usuario.permiso],
    }


def obtener_usuario(token: str, repositorio: RepositorioAcceso):
    if not token or len(token) > 128:
        raise ErrorAplicacion(401, "Inicia sesión para continuar.")
    sesion = repositorio.sesion_vigente(obtener_hora_utc(), token)
    if sesion and obtener_hora_utc() - sesion.ultima_actividad > timedelta(minutes=configuracion.inactividad_minutos):
        repositorio.eliminar(sesion)
        repositorio.confirmar()
        raise ErrorAplicacion(401, "Tu sesión terminó por inactividad.")
    usuario = repositorio.obtener_usuario(sesion.usuario_id) if sesion else None
    persona = repositorio.obtener_persona(usuario.persona_id) if usuario else None
    sede = repositorio.obtener_sede(persona.sede_id) if persona else None
    rol = repositorio.obtener_rol(persona.rol_id) if persona else None
    if (
        not usuario
        or not usuario.activo
        or (not persona.activa)
        or (not sede.activa)
        or (not rol)
        or rol.codigo not in ("docente", "administrativo")
    ):
        raise ErrorAplicacion(401, "La sesión expiró o la cuenta no está disponible.")
    return usuario


def obtener_encargado(usuario: Usuario = None):
    if usuario.permiso not in ("administrador", "operador"):
        raise ErrorAplicacion(403, "Tu cuenta no tiene acceso al panel administrativo.")
    return usuario


def iniciar_sesion(
    datos: Credenciales, anterior: str | None, repositorio: RepositorioAcceso = None
):
    usuario = repositorio.usuario_por_nombre(datos)
    if usuario:
        usuario = repositorio.bloquear_usuario(usuario)
    correcta = verificar_clave(
        datos.clave, usuario.clave_hash if usuario else hash_ficticio
    )
    persona = repositorio.obtener_persona(usuario.persona_id) if usuario else None
    sede = repositorio.obtener_sede(persona.sede_id) if persona else None
    rol = repositorio.obtener_rol(persona.rol_id) if persona else None
    if (
        not correcta
        or not usuario
        or (not usuario.activo)
        or (not persona.activa)
        or (not sede.activa)
        or (not rol)
        or rol.codigo not in ("docente", "administrativo")
    ):
        proteccion.registrar(repositorio._base, "acceso_fallido", usuario)
        repositorio.confirmar()
        raise ErrorAplicacion(401, "Usuario o contraseña incorrectos.")
    if usuario.debe_cambiar_clave and (not usuario.clave_temporal_vence or usuario.clave_temporal_vence <= obtener_hora_utc()):
        proteccion.registrar(repositorio._base, "temporal_vencida", usuario)
        repositorio.confirmar()
        raise ErrorAplicacion(401, "El acceso temporal venció. Solicita uno nuevo a administración.")
    if requiere_actualizar_hash(usuario.clave_hash):
        usuario.clave_hash = generar_hash_clave(datos.clave)
    if anterior:
        sesion = repositorio.sesion_anterior(anterior)
        if sesion:
            repositorio.eliminar(sesion)
    token = secrets.token_urlsafe(32)
    repositorio.agregar(
        SesionAcceso(
            usuario_id=usuario.id,
            token_hash=resumir_token(token),
            vence_en=obtener_hora_utc() + timedelta(hours=8),
        )
    )
    proteccion.registrar(repositorio._base, "acceso_correcto", usuario)
    repositorio.confirmar()
    return (describir_usuario(repositorio, usuario), token)


def consultar_sesion(usuario: Usuario = None, repositorio: RepositorioAcceso = None):
    return describir_usuario(repositorio, usuario)


def cambiar_clave(datos, usuario, repositorio):
    usuario = repositorio.bloquear_usuario(usuario)
    if not usuario.debe_cambiar_clave:
        proteccion.reautenticar(repositorio._base, usuario, datos.actual)
    elif not usuario.clave_temporal_vence or usuario.clave_temporal_vence <= obtener_hora_utc():
        raise ErrorAplicacion(401, "La contraseña temporal venció. Solicita un restablecimiento.")
    persona = repositorio.obtener_persona(usuario.persona_id)
    validar_clave_personal(datos.clave, usuario.nombre_usuario, persona.nombres, persona.apellidos)
    if datos.clave != datos.confirmacion:
        raise ErrorAplicacion(422, "Las contraseñas no coinciden.")
    if not datos.clave.strip():
        raise ErrorAplicacion(422, "La contraseña no puede contener solo espacios.")
    if verificar_clave(datos.clave, usuario.clave_hash):
        raise ErrorAplicacion(422, "Elige una contraseña diferente de la inicial.")
    usuario.clave_hash = generar_hash_clave(datos.clave)
    usuario.debe_cambiar_clave = False
    usuario.clave_temporal_vence = None
    proteccion.registrar(repositorio._base, "clave_cambiada", usuario)
    proteccion.revocar(repositorio._base, usuario)
    repositorio.revocar_sesiones(usuario)
    token = secrets.token_urlsafe(32)
    repositorio.agregar(SesionAcceso(
        usuario_id=usuario.id, token_hash=resumir_token(token),
        vence_en=obtener_hora_utc() + timedelta(hours=8),
    ))
    repositorio.confirmar()
    return describir_usuario(repositorio, usuario), token


def cerrar_sesion(token: str, repositorio: RepositorioAcceso):
    sesion = repositorio.sesion_por_token(token) if token else None
    if sesion:
        usuario = repositorio.obtener_usuario(sesion.usuario_id)
        proteccion.registrar(repositorio._base, "sesion_cerrada", usuario)
        repositorio.eliminar(sesion)
        repositorio.confirmar()
    return {"mensaje": "Sesión cerrada."}


def consultar_resumen(usuario: Usuario = None, repositorio: RepositorioAcceso = None):
    persona = repositorio.obtener_persona(usuario.persona_id)
    filas = repositorio.conteos_por_rol(persona)
    return {
        "personas_por_rol": dict(filas),
        "mensaje": "Resumen de personas activas de la sede.",
    }
