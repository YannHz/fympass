from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session
from ...models import Usuario
from ...config import configuracion
from ...compartido.dependencias import (
    obtener_base_datos,
    obtener_usuario,
    obtener_encargado,
    validar_peticion,
    limitar_intentos,
)
from .repositorio import RepositorioAcceso
from . import servicios
from .esquemas import Credenciales, CambioClave

rutas = APIRouter(prefix="/api", tags=["Acceso"])


@rutas.post("/acceso/cambiar-clave", dependencies=[Depends(validar_peticion), Depends(limitar_intentos)])
def cambiar_clave(datos: CambioClave, respuesta: Response,
                  usuario: Usuario = Depends(obtener_usuario),
                  base: Session = Depends(obtener_base_datos)):
    identidad, token = servicios.cambiar_clave(datos, usuario, RepositorioAcceso(base))
    respuesta.set_cookie("fym_sesion", token, httponly=True,
                        secure=configuracion.cookie_segura, samesite="strict",
                        max_age=28800, path="/api")
    respuesta.headers["Cache-Control"] = "no-store"
    return identidad


@rutas.post(
    "/acceso/iniciar",
    dependencies=[Depends(validar_peticion), Depends(limitar_intentos)],
)
def iniciar_sesion(
    datos: Credenciales,
    respuesta: Response,
    request: Request,
    base: Session = Depends(obtener_base_datos),
):
    datos_sesion, token = servicios.iniciar_sesion(
        datos=datos,
        anterior=request.cookies.get("fym_sesion"),
        repositorio=RepositorioAcceso(base),
    )
    respuesta.set_cookie(
        "fym_sesion",
        token,
        httponly=True,
        secure=configuracion.cookie_segura,
        samesite="strict",
        max_age=28800,
        path="/api",
    )
    respuesta.headers["Cache-Control"] = "no-store"
    return datos_sesion


@rutas.get("/acceso/actual")
def consultar_sesion(
    respuesta: Response,
    usuario: Usuario = Depends(obtener_usuario),
    base: Session = Depends(obtener_base_datos),
):
    respuesta.headers["Cache-Control"] = "no-store"
    return servicios.consultar_sesion(
        usuario=usuario, repositorio=RepositorioAcceso(base)
    )


@rutas.post("/acceso/cerrar", dependencies=[Depends(validar_peticion)])
def cerrar_sesion(
    request: Request, respuesta: Response, base: Session = Depends(obtener_base_datos)
):
    resultado = servicios.cerrar_sesion(
        request.cookies.get("fym_sesion"), RepositorioAcceso(base)
    )
    respuesta.delete_cookie(
        "fym_sesion",
        path="/api",
        httponly=True,
        secure=configuracion.cookie_segura,
        samesite="strict",
    )
    return resultado


@rutas.get("/administracion/resumen")
def consultar_resumen(
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.consultar_resumen(
        usuario=usuario, repositorio=RepositorioAcceso(base)
    )
