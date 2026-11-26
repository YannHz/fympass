from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import motor
from ..config import configuracion
from ..models import Usuario
from ..modulos.acceso import servicios
from ..modulos.acceso.repositorio import RepositorioAcceso


def obtener_base_datos():
    with Session(motor) as base:
        yield base


def validar_peticion(request: Request):
    if request.headers.get("x-fym-peticion") != "1":
        raise HTTPException(403, "Solicitud no permitida.")


async def limitar_intentos(request: Request, base: Session = Depends(obtener_base_datos)):
    # detras de un proxy confiable la IP real llega en X-Forwarded-For
    if configuracion.proxy_confiable:
        reenviadas = request.headers.get("x-forwarded-for", "")
        cliente = reenviadas.split(",")[0].strip() or (
            request.client.host if request.client else "local"
        )
    else:
        cliente = request.client.host if request.client else "local"
    from ..modulos.acceso.proteccion import limitar
    import json
    try:
        datos = json.loads(await request.body())
    except (ValueError, TypeError):
        datos = {}
    usuario = str(datos.get("usuario", "")).strip().lower()[:80] if isinstance(datos, dict) else ""
    claves = [("ip", cliente, 120)]
    if usuario:
        claves.append(("cuenta", usuario, 10))
    from starlette.concurrency import run_in_threadpool
    await run_in_threadpool(limitar, base, claves)


def obtener_usuario(request: Request, base: Session = Depends(obtener_base_datos)):
    usuario = servicios.obtener_usuario(
        request.cookies.get("fym_sesion"), RepositorioAcceso(base)
    )
    if usuario.debe_cambiar_clave and request.url.path not in (
        "/api/acceso/actual", "/api/acceso/cambiar-clave", "/api/acceso/cerrar", "/api/seguridad/actividad",
    ):
        raise HTTPException(403, "Establece tu nueva contraseña para continuar.")
    return usuario


def obtener_encargado(usuario: Usuario = Depends(obtener_usuario)):
    return servicios.obtener_encargado(usuario)


def administrador(usuario: Usuario = Depends(obtener_encargado)):
    from ..modulos.gestion.servicios import administrador as comprobar_administrador

    return comprobar_administrador(usuario)
