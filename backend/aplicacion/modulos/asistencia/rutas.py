from fastapi import APIRouter, Depends, Response, Query
from sqlalchemy.orm import Session
from ...models import Usuario, PuestoAbierto
from ...compartido.dependencias import (
    obtener_base_datos,
    obtener_usuario,
    obtener_encargado,
    validar_peticion,
)
from .repositorio import RepositorioAsistencia
from . import servicios
from .esquemas import OpcionesPunto, LecturaQR
from .dependencias import obtener_puesto

rutas_asistencia = APIRouter(prefix="/api", tags=["Asistencia"])


@rutas_asistencia.get("/asistencia/punto")
def consultar_punto(
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.consultar_punto(
        usuario=usuario, repositorio=RepositorioAsistencia(base)
    )


@rutas_asistencia.post("/asistencia/abrir", dependencies=[Depends(validar_peticion)])
def abrir_puesto(
    datos: OpcionesPunto,
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.abrir_puesto(
        datos=datos, usuario=usuario, repositorio=RepositorioAsistencia(base)
    )


@rutas_asistencia.post("/asistencia/pausar", dependencies=[Depends(validar_peticion)])
def pausar_puesto(
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.pausar_puesto(
        usuario=usuario, repositorio=RepositorioAsistencia(base)
    )


@rutas_asistencia.get("/puesto/estado")
def consultar_estado_puesto(
    respuesta: Response,
    puesto: PuestoAbierto = Depends(obtener_puesto),
    base: Session = Depends(obtener_base_datos),
):
    respuesta.headers["Cache-Control"] = "no-store"
    return servicios.consultar_estado_puesto(
        puesto=puesto, repositorio=RepositorioAsistencia(base)
    )


@rutas_asistencia.get("/carne")
def consultar_carne(
    respuesta: Response,
    usuario: Usuario = Depends(obtener_usuario),
    base: Session = Depends(obtener_base_datos),
):
    respuesta.headers["Cache-Control"] = "no-store"
    return servicios.consultar_carne(
        usuario=usuario, repositorio=RepositorioAsistencia(base)
    )


@rutas_asistencia.get("/puesto/eventos")
def consultar_eventos(
    respuesta: Response,
    despues: int = 0,
    puesto: PuestoAbierto = Depends(obtener_puesto),
    base: Session = Depends(obtener_base_datos),
):
    respuesta.headers["Cache-Control"] = "no-store"
    return servicios.consultar_eventos(
        despues=despues, puesto=puesto, repositorio=RepositorioAsistencia(base)
    )


@rutas_asistencia.post("/puesto/leer", dependencies=[Depends(validar_peticion)])
def leer_carne(
    datos: LecturaQR,
    puesto: PuestoAbierto = Depends(obtener_puesto),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.leer_carne(
        datos=datos, puesto=puesto, repositorio=RepositorioAsistencia(base)
    )


@rutas_asistencia.post("/carne/marcar", dependencies=[Depends(validar_peticion)])
def marcar_desde_movil(
    datos: LecturaQR,
    usuario: Usuario = Depends(obtener_usuario),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.marcar_desde_movil(
        datos=datos, usuario=usuario, repositorio=RepositorioAsistencia(base)
    )


@rutas_asistencia.get("/asistencia/marcados")
def consultar_marcados(
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.consultar_marcados(
        usuario=usuario, repositorio=RepositorioAsistencia(base)
    )


@rutas_asistencia.get("/mi-asistencia")
def consultar_mis_asistencias(
    respuesta: Response,
    mes: str | None = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    usuario: Usuario = Depends(obtener_usuario),
    base: Session = Depends(obtener_base_datos),
):
    respuesta.headers["Cache-Control"] = "no-store"
    return servicios.consultar_mis_asistencias(
        mes=mes, usuario=usuario, repositorio=RepositorioAsistencia(base)
    )


@rutas_asistencia.get("/asistencia/cambios")
async def esperar_cambios(
    respuesta: Response,
    version: str = Query(default="", max_length=80),
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    from ...compartido.avisos_asistencia import esperar_marcado
    sede_id = RepositorioAsistencia(base).obtener_persona(usuario.persona_id).sede_id
    base.close()
    respuesta.headers["Cache-Control"] = "no-store"
    return await esperar_marcado(sede_id, version)
