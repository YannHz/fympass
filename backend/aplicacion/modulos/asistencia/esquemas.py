from uuid import UUID
from pydantic import BaseModel, Field


class OpcionesPunto(BaseModel):
    camara_puesto_habilitada: bool
    escaneo_movil_habilitado: bool


class LecturaQR(BaseModel):
    contenido: str = Field(min_length=1, max_length=512)
    identificador_evento: UUID
