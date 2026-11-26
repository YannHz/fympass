from datetime import timedelta, timezone
from uuid import uuid4
import json
import secrets
import time
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select, delete, func
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from ...compartido.dependencias import obtener_usuario, administrador, obtener_base_datos, validar_peticion, limitar_intentos
from ...compartido.errores import ErrorAplicacion
from ...models import Usuario, Persona, SesionAcceso, EventoSeguridad, obtener_hora_utc
from ...seguridad import resumir_token
from .esquemas import Reautenticacion
from . import proteccion, servicios
from .repositorio import RepositorioAcceso

from . import repositorio_seguridad as implementacion

rutas_seguridad = APIRouter(prefix="/api/seguridad", tags=["Seguridad"])

@rutas_seguridad.get('/estado')
def estado(usuario=Depends(obtener_usuario), base: Session=Depends(obtener_base_datos)):
    return implementacion.estado(**locals())

@rutas_seguridad.post('/actividad', dependencies=[Depends(validar_peticion)])
def actividad(request: Request, usuario=Depends(obtener_usuario), base: Session=Depends(obtener_base_datos)):
    return implementacion.actividad(**locals())

@rutas_seguridad.get('/sesiones')
def sesiones(request: Request, usuario=Depends(obtener_usuario), base: Session=Depends(obtener_base_datos)):
    return implementacion.sesiones(**locals())

@rutas_seguridad.post('/sesiones/cerrar-otras', dependencies=[Depends(validar_peticion), Depends(limitar_intentos)])
def cerrar_otras(datos: Reautenticacion, request: Request, usuario=Depends(obtener_usuario), base: Session=Depends(obtener_base_datos)):
    return implementacion.cerrar_otras(**locals())




@rutas_seguridad.post('/personas/{persona_id}/restablecer', dependencies=[Depends(validar_peticion), Depends(limitar_intentos)])
def restablecer(persona_id: int, datos: Reautenticacion, usuario=Depends(administrador), base: Session=Depends(obtener_base_datos)):
    return implementacion.restablecer(**locals())

@rutas_seguridad.post('/personas/{persona_id}/renovar-carne', dependencies=[Depends(validar_peticion), Depends(limitar_intentos)])
def renovar_carne(persona_id: int, datos: Reautenticacion, usuario=Depends(administrador), base: Session=Depends(obtener_base_datos)):
    return implementacion.renovar_carne(**locals())

@rutas_seguridad.get('/auditoria')
def auditoria(antes: int | None=None, usuario=Depends(administrador), base: Session=Depends(obtener_base_datos)):
    return implementacion.auditoria(**locals())

@rutas_seguridad.get('/alertas-qr')
def alertas_qr(usuario=Depends(administrador), base: Session=Depends(obtener_base_datos)):
    return implementacion.alertas_qr(**locals())
