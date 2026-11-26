from pydantic import BaseModel, Field


class Credenciales(BaseModel):
    usuario: str = Field(min_length=1, max_length=80)
    clave: str = Field(min_length=1, max_length=256)


class CambioClave(BaseModel):
    clave: str = Field(min_length=8, max_length=256)
    confirmacion: str = Field(min_length=8, max_length=256)
    actual: str = Field(default="", max_length=256)


class Reautenticacion(BaseModel):
    actual: str = Field(min_length=1, max_length=256)
