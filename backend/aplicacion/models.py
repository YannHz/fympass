from datetime import date, datetime, time, timezone
from uuid import uuid4
from sqlalchemy import Numeric, Text, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Time, UniqueConstraint, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def obtener_hora_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Sede(Base):
    __tablename__ = "sedes"
    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    zona_horaria: Mapped[str] = mapped_column(String(50), default="America/Lima")
    activa: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("1"))


class Rol(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True)
    nombre: Mapped[str] = mapped_column(String(60))
    requiere_salida: Mapped[bool] = mapped_column(Boolean)


class Persona(Base):
    __tablename__ = "personas"
    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True)
    nombres: Mapped[str] = mapped_column(String(100))
    apellidos: Mapped[str] = mapped_column(String(100))
    grupo_id: Mapped[int | None] = mapped_column(ForeignKey("grupos.id", ondelete="RESTRICT", name="fk_personas_grupo"))
    foto_ruta: Mapped[str | None] = mapped_column(String(255))
    version_carne: Mapped[str] = mapped_column(String(36), default=lambda: str(uuid4()))
    documento: Mapped[str | None] = mapped_column(String(20), unique=True)
    sede_id: Mapped[int] = mapped_column(ForeignKey("sedes.id", ondelete="RESTRICT"))
    rol_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"))
    activa: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("1"))
    creada_en: Mapped[datetime] = mapped_column(DateTime, default=obtener_hora_utc)
    __table_args__ = (Index("ix_personas_sede_rol", "sede_id", "rol_id"),)


class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("personas.id", ondelete="RESTRICT"), unique=True)
    nombre_usuario: Mapped[str] = mapped_column(String(80), unique=True)
    clave_hash: Mapped[str] = mapped_column(String(255))
    debe_cambiar_clave: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("1"))
    clave_temporal_vence: Mapped[datetime | None] = mapped_column(DateTime)
    permiso: Mapped[str] = mapped_column(String(20), default="personal")
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("1"))
    __table_args__ = (CheckConstraint("permiso IN ('personal','operador','administrador')", name="ck_usuarios_permiso"),)


class Horario(Base):
    __tablename__ = "horarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    tipo_personal: Mapped[str] = mapped_column(String(20), default="administrativo", server_default="administrativo")
    carrera: Mapped[str | None] = mapped_column(String(120))
    turno: Mapped[str] = mapped_column(String(20), default="manana", server_default="manana")
    sede_id: Mapped[int] = mapped_column(ForeignKey("sedes.id", ondelete="RESTRICT"))
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("1"))


class TramoHorario(Base):
    __tablename__ = "tramos_horarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    horario_id: Mapped[int] = mapped_column(ForeignKey("horarios.id", ondelete="RESTRICT"))
    dia_semana: Mapped[int] = mapped_column(Integer)
    hora_entrada: Mapped[time] = mapped_column(Time)
    hora_salida: Mapped[time | None] = mapped_column(Time)
    __table_args__ = (UniqueConstraint("horario_id", "dia_semana", "hora_entrada", name="uq_tramos_horario_dia_entrada"), CheckConstraint("dia_semana BETWEEN 0 AND 6", name="ck_tramos_dia"), CheckConstraint("hora_salida IS NULL OR hora_salida > hora_entrada", name="ck_tramos_salida"))


class AsignacionHorario(Base):
    __tablename__ = "asignaciones_horarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("personas.id", ondelete="RESTRICT"))
    horario_id: Mapped[int] = mapped_column(ForeignKey("horarios.id", ondelete="RESTRICT"))
    vigente_desde: Mapped[date] = mapped_column(Date)
    vigente_hasta: Mapped[date | None] = mapped_column(Date)
    __table_args__ = (UniqueConstraint("persona_id", "horario_id", "vigente_desde", name="uq_asignaciones_vigencia"), CheckConstraint("vigente_hasta IS NULL OR vigente_hasta >= vigente_desde", name="ck_asignaciones_fechas"))


class ToleranciaRol(Base):
    __tablename__ = "tolerancias_roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    rol_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"))
    minutos: Mapped[int] = mapped_column(Integer)
    vigente_desde: Mapped[date] = mapped_column(Date)
    vigente_hasta: Mapped[date | None] = mapped_column(Date)
    __table_args__ = (UniqueConstraint("rol_id", "vigente_desde", name="uq_tolerancias_rol_desde"), CheckConstraint("minutos >= 0", name="ck_tolerancias_minutos"), CheckConstraint("vigente_hasta IS NULL OR vigente_hasta >= vigente_desde", name="ck_tolerancias_fechas"))


class PuntoAsistencia(Base):
    __tablename__ = "puntos_asistencia"
    id: Mapped[int] = mapped_column(primary_key=True)
    sede_id: Mapped[int] = mapped_column(ForeignKey("sedes.id", ondelete="RESTRICT"))
    nombre: Mapped[str] = mapped_column(String(100))
    camara_puesto_habilitada: Mapped[bool] = mapped_column(Boolean, default=True)
    escaneo_movil_habilitado: Mapped[bool] = mapped_column(Boolean, default=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (UniqueConstraint("sede_id", "nombre", name="uq_puntos_sede_nombre"),)


class Marcado(Base):
    __tablename__ = "marcados"
    id: Mapped[int] = mapped_column(primary_key=True)
    identificador_evento: Mapped[str] = mapped_column(String(36), unique=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("personas.id", ondelete="RESTRICT"))
    punto_id: Mapped[int] = mapped_column(ForeignKey("puntos_asistencia.id", ondelete="RESTRICT"))
    rol_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"))
    tipo: Mapped[str] = mapped_column(String(10))
    resultado: Mapped[str | None] = mapped_column(String(200))
    modalidad: Mapped[str] = mapped_column(String(20))
    ocurrido_en: Mapped[datetime] = mapped_column(DateTime)
    registrado_en: Mapped[datetime] = mapped_column(DateTime, default=obtener_hora_utc)
    registrado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    motivo: Mapped[str | None] = mapped_column(String(500))
    __table_args__ = (Index("ix_marcados_persona_fecha", "persona_id", "ocurrido_en"), Index("ix_marcados_punto_fecha", "punto_id", "ocurrido_en"), CheckConstraint("tipo IN ('entrada','salida')", name="ck_marcados_tipo"), CheckConstraint("modalidad IN ('camara_puesto','escaneo_movil','manual')", name="ck_marcados_modalidad"), CheckConstraint("modalidad <> 'manual' OR (registrado_por_id IS NOT NULL AND motivo IS NOT NULL AND CHAR_LENGTH(TRIM(motivo)) > 0)", name="ck_marcados_manual"))


class SesionAcceso(Base):
    __tablename__ = "sesiones_acceso"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    creada_en: Mapped[datetime] = mapped_column(DateTime, default=obtener_hora_utc)
    vence_en: Mapped[datetime] = mapped_column(DateTime, index=True)
    ultima_actividad: Mapped[datetime] = mapped_column(DateTime, default=obtener_hora_utc)


class EventoSeguridad(Base):
    __tablename__ = "eventos_seguridad"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))
    sede_id: Mapped[int | None] = mapped_column(ForeignKey("sedes.id", ondelete="RESTRICT"))
    accion: Mapped[str] = mapped_column(String(80), index=True)
    detalle: Mapped[str] = mapped_column(String(500))
    creada_en: Mapped[datetime] = mapped_column(DateTime, default=obtener_hora_utc, index=True)


class LimiteAcceso(Base):
    __tablename__ = "limites_acceso"
    clave: Mapped[str] = mapped_column(String(64), primary_key=True)
    intentos: Mapped[int] = mapped_column(Integer, default=0)
    inicio: Mapped[datetime] = mapped_column(DateTime)
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(DateTime)


class PuestoAbierto(Base):
    __tablename__ = "puestos_abiertos"
    id: Mapped[int] = mapped_column(primary_key=True)
    punto_id: Mapped[int] = mapped_column(ForeignKey("puntos_asistencia.id", ondelete="RESTRICT"))
    encargado_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    camara_puesto_habilitada: Mapped[bool] = mapped_column(Boolean, default=True)
    escaneo_movil_habilitado: Mapped[bool] = mapped_column(Boolean, default=True)
    vence_en: Mapped[datetime] = mapped_column(DateTime)
    __table_args__ = (Index("ix_puestos_punto_activo", "punto_id", "activo"),)


class EventoPuesto(Base):
    __tablename__ = "eventos_puesto"
    id: Mapped[int] = mapped_column(primary_key=True)
    puesto_id: Mapped[int] = mapped_column(ForeignKey("puestos_abiertos.id", ondelete="RESTRICT"))
    persona_id: Mapped[int | None] = mapped_column(ForeignKey("personas.id", ondelete="RESTRICT"))
    identificador_evento: Mapped[str] = mapped_column(String(36), unique=True)
    marcado_id: Mapped[int | None] = mapped_column(ForeignKey("marcados.id", ondelete="RESTRICT"), unique=True)
    tipo: Mapped[str | None] = mapped_column(String(10))
    ocurrido_en: Mapped[datetime] = mapped_column(DateTime, default=obtener_hora_utc)
    resultado: Mapped[str] = mapped_column(String(200))
    aceptado: Mapped[bool] = mapped_column(Boolean)
    __table_args__ = (Index("ix_eventos_puesto_id", "puesto_id", "id"),)


class Carrera(Base):
    __tablename__ = "carreras"
    id: Mapped[int] = mapped_column(primary_key=True)
    sede_id: Mapped[int] = mapped_column(ForeignKey("sedes.id", ondelete="RESTRICT"))
    nombre: Mapped[str] = mapped_column(String(120))
    codigo: Mapped[str] = mapped_column(String(30))
    activa: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (UniqueConstraint("sede_id", "codigo", name="uq_carreras_sede_codigo"),)


class Grupo(Base):
    __tablename__ = "grupos"
    id: Mapped[int] = mapped_column(primary_key=True)
    carrera_id: Mapped[int] = mapped_column(ForeignKey("carreras.id", ondelete="RESTRICT"))
    horario_id: Mapped[int | None] = mapped_column(ForeignKey("horarios.id", ondelete="RESTRICT"))
    codigo: Mapped[str] = mapped_column(String(30))
    ciclo: Mapped[str] = mapped_column(String(30))
    turno: Mapped[str] = mapped_column(String(30))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (UniqueConstraint("carrera_id", "codigo", name="uq_grupos_carrera_codigo"),)


class Justificacion(Base):
    __tablename__ = "justificaciones"
    id: Mapped[int] = mapped_column(primary_key=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("personas.id", ondelete="RESTRICT"))
    fecha: Mapped[date] = mapped_column(Date)
    tipo: Mapped[str] = mapped_column(String(20))
    motivo: Mapped[str] = mapped_column(String(1000))
    referencia: Mapped[str | None] = mapped_column(String(200))
    estado: Mapped[str] = mapped_column(String(20), default="pendiente")
    creada_por_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    resuelta_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    observacion: Mapped[str | None] = mapped_column(String(500))
    creada_en: Mapped[datetime] = mapped_column(DateTime, default=obtener_hora_utc)
    __table_args__ = (CheckConstraint("estado IN ('pendiente','aprobada','observada')", name="ck_justificaciones_estado"), CheckConstraint("tipo IN ('falta','tardanza')", name="ck_justificaciones_tipo"))


class DiaNoLectivo(Base):
    __tablename__ = "dias_no_lectivos"
    id: Mapped[int] = mapped_column(primary_key=True)
    sede_id: Mapped[int] = mapped_column(ForeignKey("sedes.id", ondelete="RESTRICT"))
    fecha: Mapped[date] = mapped_column(Date)
    motivo: Mapped[str] = mapped_column(String(200))
    __table_args__ = (UniqueConstraint("sede_id", "fecha", name="uq_dias_no_lectivos_sede_fecha"),)


class ReglaSede(Base):
    __tablename__ = "reglas_sedes"
    id: Mapped[int] = mapped_column(primary_key=True)
    sede_id: Mapped[int] = mapped_column(ForeignKey("sedes.id", ondelete="RESTRICT"), unique=True)
    anticipacion_minutos: Mapped[int] = mapped_column(Integer, default=0)
    limite_ausencia_minutos: Mapped[int] = mapped_column(Integer, default=45)
    observacion_porcentaje: Mapped[int] = mapped_column(Integer, default=15)
    alerta_porcentaje: Mapped[int] = mapped_column(Integer, default=30)
    __table_args__ = (CheckConstraint("anticipacion_minutos >= 0 AND limite_ausencia_minutos >= 0", name="ck_reglas_minutos"), CheckConstraint("observacion_porcentaje >= 0 AND alerta_porcentaje > observacion_porcentaje AND alerta_porcentaje <= 100", name="ck_reglas_porcentajes"))


class TarifaDocente(Base):
    __tablename__ = "tarifas_docentes"
    id: Mapped[int] = mapped_column(primary_key=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("personas.id", ondelete="RESTRICT"), unique=True)
    tarifa_hora: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    __table_args__ = (CheckConstraint("tarifa_hora >= 0", name="ck_tarifas_positivas"),)


class Dispositivo(Base):
    __tablename__ = "dispositivos"
    id: Mapped[int] = mapped_column(primary_key=True)
    sede_id: Mapped[int] = mapped_column(ForeignKey("sedes.id", ondelete="RESTRICT"))
    nombre: Mapped[str] = mapped_column(String(100))
    tipo: Mapped[str] = mapped_column(String(20))
    modelo: Mapped[str | None] = mapped_column(String(80))
    direccion_ip: Mapped[str | None] = mapped_column(String(50))
    puerto: Mapped[int] = mapped_column(Integer, default=4370)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("tipo = 'qr'", name="ck_dispositivos_tipo"), CheckConstraint("puerto BETWEEN 1 AND 65535", name="ck_dispositivos_puerto"))


class Auditoria(Base):
    __tablename__ = "auditoria"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    accion: Mapped[str] = mapped_column(String(80))
    entidad: Mapped[str] = mapped_column(String(50))
    entidad_id: Mapped[int] = mapped_column(Integer)
    detalle: Mapped[str] = mapped_column(Text)
    creada_en: Mapped[datetime] = mapped_column(DateTime, default=obtener_hora_utc)
