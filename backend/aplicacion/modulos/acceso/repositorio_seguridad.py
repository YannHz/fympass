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
rutas_seguridad = APIRouter(prefix='/api/seguridad', tags=['Seguridad'])


def fecha_iso(fecha):
    return fecha.replace(tzinfo=timezone.utc).isoformat()

def estado(usuario=Depends(obtener_usuario), base: Session=Depends(obtener_base_datos)):
    persona = base.get(Persona, usuario.persona_id)
    return {'administrador': usuario.permiso == 'administrador', 'usuario': usuario.nombre_usuario, 'nombre': f'{persona.nombres} {persona.apellidos}'}

def actividad(request: Request, usuario=Depends(obtener_usuario), base: Session=Depends(obtener_base_datos)):
    sesion = RepositorioAcceso(base).sesion_por_token(request.cookies.get('fym_sesion', ''))
    sesion.ultima_actividad = obtener_hora_utc()
    base.commit()
    return {'mensaje': 'Sesión activa.'}

def sesiones(request: Request, usuario=Depends(obtener_usuario), base: Session=Depends(obtener_base_datos)):
    actual = resumir_token(request.cookies.get('fym_sesion', ''))
    ahora = obtener_hora_utc()
    return [{'id': s.id, 'actual': s.token_hash == actual, 'creada': fecha_iso(s.creada_en), 'vence': fecha_iso(s.vence_en), 'actividad': fecha_iso(s.ultima_actividad)} for s in base.scalars(select(SesionAcceso).where(SesionAcceso.usuario_id == usuario.id, SesionAcceso.vence_en > ahora, SesionAcceso.ultima_actividad > ahora - timedelta(minutes=30))).all()]

def cerrar_otras(datos: Reautenticacion, request: Request, usuario=Depends(obtener_usuario), base: Session=Depends(obtener_base_datos)):
    proteccion.reautenticar(base, usuario, datos.actual)
    proteccion.revocar(base, usuario, resumir_token(request.cookies.get('fym_sesion', '')))
    proteccion.registrar(base, 'otras_sesiones_cerradas', usuario)
    base.commit()
    return {'mensaje': 'Otras sesiones cerradas; los puestos asociados se pausaron.'}




def objetivo(base, encargado, persona_id):
    persona = base.scalar(select(Persona).where(Persona.id == persona_id).with_for_update())
    sede = base.get(Persona, encargado.persona_id).sede_id
    if not persona or persona.sede_id != sede:
        raise ErrorAplicacion(404, 'Persona no disponible en tu sede.')
    return persona

def restablecer(persona_id: int, datos: Reautenticacion, usuario=Depends(administrador), base: Session=Depends(obtener_base_datos)):
    proteccion.reautenticar(base, usuario, datos.actual)
    persona = objetivo(base, usuario, persona_id)
    cuenta = base.scalar(select(Usuario).where(Usuario.persona_id == persona.id).with_for_update())
    if not cuenta or not cuenta.activo:
        raise ErrorAplicacion(404, 'Esta persona no tiene una cuenta activa.')
    if cuenta.id == usuario.id:
        raise ErrorAplicacion(422, 'Utiliza el cambio de contraseña de tu cuenta.')
    clave = proteccion.temporal(base, cuenta)
    proteccion.registrar(base, 'clave_restablecida', usuario, f'Persona: {persona.id}.')
    base.commit()
    return {'usuario': cuenta.nombre_usuario, 'clave_temporal': clave, 'vence': fecha_iso(cuenta.clave_temporal_vence), 'mensaje': 'Entrega el acceso temporal personalmente. Se muestra una sola vez.'}

def renovar_carne(persona_id: int, datos: Reautenticacion, usuario=Depends(administrador), base: Session=Depends(obtener_base_datos)):
    proteccion.reautenticar(base, usuario, datos.actual)
    persona = objetivo(base, usuario, persona_id)
    persona.version_carne = str(uuid4())
    proteccion.registrar(base, 'carne_revocado_renovado', usuario, f'Persona: {persona.id}')
    base.commit()
    return {'mensaje': 'Carné anterior revocado. El nuevo estará disponible al actualizar el carné personal.'}

def auditoria(antes: int | None=None, usuario=Depends(administrador), base: Session=Depends(obtener_base_datos)):
    sede = base.get(Persona, usuario.persona_id).sede_id
    consulta = select(EventoSeguridad).where((EventoSeguridad.sede_id == sede) | EventoSeguridad.sede_id.is_(None))
    if antes:
        consulta = consulta.where(EventoSeguridad.id < antes)
    filas = base.scalars(consulta.order_by(EventoSeguridad.id.desc()).limit(50)).all()
    return [{'id': f.id, 'accion': f.accion, 'detalle': f.detalle, 'fecha': fecha_iso(f.creada_en), 'usuario_id': f.usuario_id} for f in filas]

def alertas_qr(usuario=Depends(administrador), base: Session=Depends(obtener_base_datos)):
    sede = base.get(Persona, usuario.persona_id).sede_id
    filas = base.execute(select(EventoSeguridad.detalle, func.count(EventoSeguridad.id)).where(EventoSeguridad.sede_id == sede, EventoSeguridad.accion == 'qr_rechazado', EventoSeguridad.creada_en >= obtener_hora_utc() - timedelta(minutes=15)).group_by(EventoSeguridad.detalle).having(func.count(EventoSeguridad.id) >= 5)).all()
    return [{'detalle': detalle, 'intentos': cantidad} for detalle, cantidad in filas]
