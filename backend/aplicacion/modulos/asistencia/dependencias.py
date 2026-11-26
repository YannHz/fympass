from fastapi import Depends, Request
from sqlalchemy.orm import Session
from ...compartido.dependencias import obtener_base_datos
from .repositorio import RepositorioAsistencia
from . import servicios


def obtener_puesto(request: Request, base: Session = Depends(obtener_base_datos)):
    return servicios.obtener_puesto(
        request.headers.get("x-fym-puesto", ""), RepositorioAsistencia(base)
    )
