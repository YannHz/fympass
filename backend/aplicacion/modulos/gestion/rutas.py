from datetime import date
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter, Depends, Response, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ...models import Usuario
from ...compartido.dependencias import (
    obtener_base_datos,
    obtener_encargado,
    validar_peticion,
    administrador,
)
from .repositorio import RepositorioGestion
from . import servicios
from .esquemas import (
    DatosPersona,
    DatosHorario,
    DatosSemanaLaboral,
    DatosAsignacionLaboral,
    DatosManual,
    DatosJustificacion,
    ResolverJustificacion,
    DatosReglas,
    DatosDia,
    DatosDispositivo,
    RespuestaError,
    RespuestaCreacion,
    RespuestaPersona,
    RespuestaMensaje,
    Pagina,
    MarcadoHistorial,
    JustificacionListado,
)

rutas_gestion = APIRouter(
    prefix="/api/gestion", tags=["Administración"],
    responses={400: {"model": RespuestaError}, 403: {"model": RespuestaError},
               404: {"model": RespuestaError}, 409: {"model": RespuestaError},
               422: {"model": RespuestaError}, 503: {"model": RespuestaError}},
)


@rutas_gestion.get("/catalogo")
def consultar_catalogo(
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.consultar_catalogo(
        usuario=usuario, repositorio=RepositorioGestion(base)
    )


@rutas_gestion.post("/personas", dependencies=[Depends(validar_peticion)], response_model=RespuestaPersona,
                   response_model_exclude_none=True, responses={201: {"model": RespuestaPersona}})
def guardar_persona(
    datos: DatosPersona,
    respuesta: Response,
    usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    resultado = servicios.guardar_persona(
        datos=datos, usuario=usuario, repositorio=RepositorioGestion(base)
    )
    if datos.id is None:
        respuesta.status_code = 201
    return resultado


@rutas_gestion.post("/horarios", dependencies=[Depends(validar_peticion)], status_code=201, response_model=RespuestaCreacion)
def guardar_horario(
    datos: DatosHorario,
    usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.guardar_horario(
        datos=datos, usuario=usuario, repositorio=RepositorioGestion(base)
    )


@rutas_gestion.post("/horarios/semana", dependencies=[Depends(validar_peticion)],
                   response_model=RespuestaCreacion, responses={201: {"model": RespuestaCreacion}})
def guardar_semana_laboral(
    datos: DatosSemanaLaboral,
    respuesta: Response,
    usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    resultado = servicios.guardar_semana_laboral(datos, usuario, RepositorioGestion(base))
    if datos.horario_id is None:
        respuesta.status_code = 201
    return resultado


@rutas_gestion.put("/horarios/{identificador}", dependencies=[Depends(validar_peticion)], response_model=RespuestaCreacion)
def editar_horario(
    identificador: int, datos: DatosHorario,
    usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.guardar_horario(datos=datos, usuario=usuario, repositorio=RepositorioGestion(base), horario_id=identificador)


@rutas_gestion.delete("/horarios/{identificador}", dependencies=[Depends(validar_peticion)])
def eliminar_horario(
    identificador: int, usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.eliminar_horario(identificador, usuario=usuario, repositorio=RepositorioGestion(base))


@rutas_gestion.get("/diario")
def consultar_diario(
    desde: date,
    hasta: date,
    respuesta: Response,
    solo_marcados: bool = False,
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    respuesta.headers["Cache-Control"] = "no-store"
    return servicios.consultar_diario(
        desde=desde, hasta=hasta, solo_marcados=solo_marcados, usuario=usuario, repositorio=RepositorioGestion(base)
    )


@rutas_gestion.get("/resumen")
def consultar_resumen(
    fecha: date,
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.consultar_resumen(
        fecha=fecha, usuario=usuario, repositorio=RepositorioGestion(base)
    )


@rutas_gestion.post("/manual", dependencies=[Depends(validar_peticion)])
def registrar_manual(
    datos: DatosManual,
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.registrar_manual(
        datos=datos, usuario=usuario, repositorio=RepositorioGestion(base)
    )


@rutas_gestion.get("/incidencias")
def consultar_incidencias(
    desde: date,
    hasta: date,
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.consultar_incidencias(desde, hasta, usuario, RepositorioGestion(base))


@rutas_gestion.get("/justificaciones", response_model=Pagina[JustificacionListado])
def consultar_justificaciones(
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=50, ge=1, le=100),
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.consultar_justificaciones(
        usuario=usuario, repositorio=RepositorioGestion(base), pagina=pagina, por_pagina=por_pagina
    )


@rutas_gestion.post("/justificaciones", dependencies=[Depends(validar_peticion)], status_code=201, response_model=RespuestaMensaje)
def crear_justificacion(
    datos: DatosJustificacion,
    usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.crear_justificacion(
        datos=datos, usuario=usuario, repositorio=RepositorioGestion(base)
    )


@rutas_gestion.post(
    "/justificaciones/{identificador}/resolver",
    dependencies=[Depends(validar_peticion)],
)
def resolver_justificacion(
    identificador: int,
    datos: ResolverJustificacion,
    usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.resolver_justificacion(
        identificador=identificador,
        datos=datos,
        usuario=usuario,
        repositorio=RepositorioGestion(base),
    )


@rutas_gestion.post("/reglas", dependencies=[Depends(validar_peticion)])
def guardar_reglas(
    datos: DatosReglas,
    usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.guardar_reglas(
        datos=datos, usuario=usuario, repositorio=RepositorioGestion(base)
    )


@rutas_gestion.post("/dias-no-lectivos", dependencies=[Depends(validar_peticion)])
def guardar_dia(
    datos: DatosDia,
    usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.guardar_dia(
        datos=datos, usuario=usuario, repositorio=RepositorioGestion(base)
    )


@rutas_gestion.post("/dispositivos", dependencies=[Depends(validar_peticion)])
def guardar_dispositivo(
    datos: DatosDispositivo,
    usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.guardar_dispositivo(
        datos=datos, usuario=usuario, repositorio=RepositorioGestion(base)
    )


@rutas_gestion.get("/personas/{identificador}/expediente")
def consultar_expediente(
    identificador: int,
    desde: date,
    hasta: date,
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.consultar_expediente(
        identificador=identificador,
        desde=desde,
        hasta=hasta,
        usuario=usuario,
        repositorio=RepositorioGestion(base),
    )


@rutas_gestion.get("/preplanilla")
def consultar_preplanilla(
    desde: date,
    hasta: date,
    tarifa: Decimal | None = None,
    usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.consultar_preplanilla(
        desde=desde,
        hasta=hasta,
        tarifa=tarifa,
        usuario=usuario,
        repositorio=RepositorioGestion(base),
    )


@rutas_gestion.get("/exportar")
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
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    archivo = servicios.exportar(
        desde=desde,
        hasta=hasta,
        tipo=tipo,
        rol=rol,
        buscar=buscar,
        estado=estado,
        carrera=carrera,
        tarifa=tarifa,
        solo_marcados=solo_marcados,
        incluir_no_programados=incluir_no_programados,
        ciclo=ciclo,
        turno=turno,
        usuario=usuario,
        repositorio=RepositorioGestion(base),
    )
    return StreamingResponse(
        archivo,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="FyM_{tipo}_{desde}_{hasta}.xlsx"'
        },
    )


@rutas_gestion.get("/marcados", response_model=Pagina[MarcadoHistorial])
def consultar_historial_marcados(
    desde: date,
    hasta: date,
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=50, ge=1, le=100),
    modalidad: Literal["camara_puesto", "escaneo_movil", "manual"] | None = None,
    usuario: Usuario = Depends(obtener_encargado),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.consultar_historial_marcados(
        desde=desde, hasta=hasta, usuario=usuario, repositorio=RepositorioGestion(base),
        pagina=pagina, por_pagina=por_pagina, modalidad=modalidad,
    )


@rutas_gestion.post("/horarios/asignar-personal", dependencies=[Depends(validar_peticion)])
def asignar_horario_laboral(
    datos: DatosAsignacionLaboral, usuario: Usuario = Depends(administrador),
    base: Session = Depends(obtener_base_datos),
):
    return servicios.asignar_horario_laboral(datos, usuario, RepositorioGestion(base))
