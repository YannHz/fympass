from sqlalchemy.exc import IntegrityError
from ..models import (
    Sede,
    Rol,
    Persona,
    Usuario,
    Horario,
    TramoHorario,
    AsignacionHorario,
    ToleranciaRol,
    PuntoAsistencia,
    Marcado,
    SesionAcceso,
    PuestoAbierto,
    EventoPuesto,
    Carrera,
    Grupo,
    Justificacion,
    DiaNoLectivo,
    ReglaSede,
    TarifaDocente,
    Dispositivo,
    Auditoria,
)
from .errores import ConflictoPersistencia


def datos_objeto(objeto):
    return {
        columna.name: getattr(objeto, columna.name)
        for columna in objeto.__table__.columns
    }


class RepositorioBase:
    def __init__(self, sesion):
        self._base = sesion

    def agregar(self, entidad):
        self._base.add(entidad)

    def eliminar(self, entidad):
        self._base.delete(entidad)

    def sincronizar(self):
        try:
            self._base.flush()
        except IntegrityError as error:
            raise ConflictoPersistencia() from error

    def confirmar(self):
        try:
            self._base.commit()
        except IntegrityError as error:
            raise ConflictoPersistencia() from error

    def revertir(self):
        self._base.rollback()

    def para_gestion(self):
        from ..modulos.gestion.repositorio import RepositorioGestion

        return RepositorioGestion(self._base)

    def obtener_sede(self, identificador):
        return self._base.get(Sede, identificador)

    def obtener_rol(self, identificador):
        return self._base.get(Rol, identificador)

    def obtener_persona(self, identificador):
        return self._base.get(Persona, identificador)

    def obtener_usuario(self, identificador):
        return self._base.get(Usuario, identificador)

    def obtener_horario(self, identificador):
        return self._base.get(Horario, identificador)

    def obtener_tramo_horario(self, identificador):
        return self._base.get(TramoHorario, identificador)

    def obtener_asignacion_horario(self, identificador):
        return self._base.get(AsignacionHorario, identificador)

    def obtener_tolerancia_rol(self, identificador):
        return self._base.get(ToleranciaRol, identificador)

    def obtener_punto_asistencia(self, identificador):
        return self._base.get(PuntoAsistencia, identificador)

    def obtener_marcado(self, identificador):
        return self._base.get(Marcado, identificador)

    def obtener_sesion_acceso(self, identificador):
        return self._base.get(SesionAcceso, identificador)

    def obtener_puesto_abierto(self, identificador):
        return self._base.get(PuestoAbierto, identificador)

    def obtener_evento_puesto(self, identificador):
        return self._base.get(EventoPuesto, identificador)

    def obtener_carrera(self, identificador):
        return self._base.get(Carrera, identificador)

    def obtener_grupo(self, identificador):
        return self._base.get(Grupo, identificador)

    def obtener_justificacion(self, identificador):
        return self._base.get(Justificacion, identificador)

    def obtener_dia_no_lectivo(self, identificador):
        return self._base.get(DiaNoLectivo, identificador)

    def obtener_regla_sede(self, identificador):
        return self._base.get(ReglaSede, identificador)

    def obtener_tarifa_docente(self, identificador):
        return self._base.get(TarifaDocente, identificador)

    def obtener_dispositivo(self, identificador):
        return self._base.get(Dispositivo, identificador)

    def obtener_auditoria(self, identificador):
        return self._base.get(Auditoria, identificador)
