from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal, Generic, TypeVar
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
import re


class Formulario(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class RespuestaError(BaseModel):
    detail: str | list[dict]


class RespuestaCreacion(BaseModel):
    id: int
    mensaje: str


class RespuestaPersona(RespuestaCreacion):
    usuario: str | None = None
    clave_temporal: str | None = None
    vence: datetime | None = None


class RespuestaMensaje(BaseModel):
    mensaje: str


class MarcadoHistorial(BaseModel):
    id: int
    persona_id: int
    nombre: str
    codigo: str
    tipo: str
    fecha: date
    hora: datetime
    cargado_en: datetime
    responsable: str
    modalidad: str
    motivo: str | None
    resultado: str


class JustificacionListado(BaseModel):
    id: int
    persona_id: int
    fecha: date
    tipo: str
    motivo: str
    referencia: str | None
    estado: str
    creada_por_id: int
    resuelta_por_id: int | None
    observacion: str | None
    creada_en: datetime
    nombre: str


Elemento = TypeVar("Elemento")


class Pagina(BaseModel, Generic[Elemento]):
    elementos: list[Elemento]
    total: int
    pagina: int
    por_pagina: int


class DatosPersona(Formulario):
    id: int | None = None
    codigo: str = Field(default="", max_length=30)
    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    documento: str | None = Field(default=None, max_length=20)
    rol_id: int
    grupo_id: int | None = None
    horario_id: int | None = None
    activa: bool = True
    tarifa_hora: Decimal = Field(default=0, ge=0, le=100000)
    nombre_usuario: str | None = Field(default=None, pattern="^[a-z0-9._-]{3,80}$")
    clave: str | None = Field(default=None, min_length=8, max_length=256)
    permiso: Literal["personal", "operador", "administrador"] = "personal"
    actual: str = Field(default="", max_length=256)

    @field_validator("documento")
    @classmethod
    def validar_dni(cls, valor):
        if valor in (None, ""):
            return None
        if not re.fullmatch(r"[0-9]{8}", valor):
            raise ValueError("El DNI debe contener exactamente 8 dígitos, sin letras ni espacios.")
        return valor

    @model_validator(mode="after")
    def exigir_dni_nuevo(self):
        if self.id is None and self.documento is None:
            raise ValueError("Ingresa el DNI para registrar a la persona y generar su ID institucional.")
        return self


class DatosCarrera(Formulario):
    id: int | None = None
    nombre: str = Field(min_length=1, max_length=120)
    codigo: str = Field(min_length=1, max_length=30)
    activa: bool = True


class DatosTramo(Formulario):
    dia_semana: int = Field(ge=0, le=6)
    hora_entrada: time
    hora_salida: time | None = None


class DatosHorario(Formulario):
    nombre: str = Field(min_length=1, max_length=100)
    tipo_personal: Literal["docente", "administrativo"]
    carrera: str | None = Field(default=None, max_length=120)
    turno: Literal["manana", "tarde", "noche", "completo"]
    tramos: list[DatosTramo] = Field(min_length=1, max_length=14)


class DatosGrupo(Formulario):
    id: int | None = None
    carrera_id: int
    horario_id: int | None = None
    codigo: str = Field(min_length=1, max_length=30)
    ciclo: str = Field(min_length=1, max_length=30)
    turno: str = Field(min_length=1, max_length=30)
    activo: bool = True
    ingreso: DatosHorario | None = None
    alcance: Literal["grupo"] = "grupo"


class DatosSemanaLaboral(DatosHorario):
    horario_id: int | None = Field(default=None, gt=0)
    persona_ids: list[int] = Field(default_factory=list, max_length=500)
    vigente_desde: date


class DatosUsarHorarioGrupo(Formulario):
    persona_ids: list[int] = Field(min_length=1, max_length=500)
    horario_esperado: int = Field(gt=0)
    vigente_desde: date


class DatosAsignacionLaboral(Formulario):
    persona_ids: list[int] = Field(min_length=1, max_length=500)
    horario_id: int = Field(gt=0)
    vigente_desde: date


class DatosManual(Formulario):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    persona_id: int = Field(gt=0)
    identificador_evento: str = Field(pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


class DatosJustificacion(Formulario):
    persona_id: int
    fecha: date
    tipo: Literal["falta", "tardanza"]
    motivo: str = Field(min_length=3, max_length=1000)
    referencia: str | None = Field(default=None, max_length=200)


class ResolverJustificacion(Formulario):
    estado: Literal["aprobada", "observada"]
    observacion: str = Field(min_length=3, max_length=500)


class DatosReglas(Formulario):
    tolerancias: dict[int, int]
    anticipacion_minutos: int = Field(ge=0, le=1440)
    limite_ausencia_minutos: int = Field(ge=0, le=1440)
    observacion_porcentaje: int = Field(ge=0, le=99)
    alerta_porcentaje: int = Field(ge=1, le=100)


class DatosDia(Formulario):
    fecha: date
    motivo: str = Field(min_length=3, max_length=200)


class DatosDispositivo(Formulario):
    id: int | None = None
    nombre: str = Field(min_length=1, max_length=100)
    tipo: Literal["qr"]
    modelo: str | None = Field(default=None, max_length=80)
    direccion_ip: str | None = None
    puerto: int = Field(default=4370, ge=1, le=65535)
    activo: bool = True
