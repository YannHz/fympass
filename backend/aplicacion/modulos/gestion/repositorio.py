from sqlalchemy import select, func
from ...models import (
    Rol,
    Persona,
    Usuario,
    SesionAcceso,
    Horario,
    TramoHorario,
    AsignacionHorario,
    ToleranciaRol,
    PuntoAsistencia,
    Marcado,
    Carrera,
    Grupo,
    Justificacion,
    DiaNoLectivo,
    ReglaSede,
    TarifaDocente,
    Dispositivo,
)
from ...compartido.repositorio import RepositorioBase


class RepositorioGestion(RepositorioBase):

    def usuario_disponible(self, nombre):
        return self._base.scalar(select(Usuario.id).where(Usuario.nombre_usuario == nombre)) is None

    def revocar_sesiones(self, cuenta):
        # cierra todas las sesiones del usuario tras cambiar la contrasena
        sesiones = self._base.scalars(
            select(SesionAcceso).where(SesionAcceso.usuario_id == cuenta.id)
        ).all()
        for sesion in sesiones:
            self._base.delete(sesion)

    def bloquear_carrera(self, identificador):
        return self._base.scalar(select(Carrera).where(Carrera.id == identificador).with_for_update())

    def asignaciones_programadas(self, fecha, persona):
        return self._base.scalars(select(AsignacionHorario).where(
            AsignacionHorario.persona_id == persona.id,
            AsignacionHorario.vigente_hasta.is_(None) | (AsignacionHorario.vigente_hasta >= fecha)
        ).order_by(AsignacionHorario.vigente_desde)).all()

    def asignaciones_desde(self, fecha, persona):
        return self._base.scalars(select(AsignacionHorario).where(
            AsignacionHorario.persona_id == persona.id,
            AsignacionHorario.vigente_hasta.is_(None) | (AsignacionHorario.vigente_hasta >= fecha)
        ).with_for_update().execution_options(populate_existing=True)).all()

    def bloquear_grupo(self, identificador):
        return self._base.scalar(select(Grupo).where(Grupo.id == identificador).with_for_update().execution_options(populate_existing=True))

    def bloquear_horario(self, identificador):
        return self._base.scalar(select(Horario).where(Horario.id == identificador).with_for_update())

    def horario_tiene_asignaciones(self, identificador, bloquear=False):
        grupos = select(Grupo.id).where(Grupo.horario_id == identificador).limit(1)
        personas = select(AsignacionHorario.id).where(AsignacionHorario.horario_id == identificador).limit(1)
        grupo = self._base.scalar(grupos.with_for_update() if bloquear else grupos)
        persona = self._base.scalar(personas.with_for_update() if bloquear else personas)
        return grupo is not None or persona is not None

    def eliminar_tramos(self, identificador):
        for tramo in self._base.scalars(select(TramoHorario).where(TramoHorario.horario_id == identificador).with_for_update()).all():
            self.eliminar(tramo)
        self.sincronizar()

    def personas_del_horario(self, identificador):
        return self._base.execute(
            select(AsignacionHorario, Persona)
            .join(Persona, Persona.id == AsignacionHorario.persona_id)
            .where(AsignacionHorario.horario_id == identificador)
            .order_by(Persona.apellidos, Persona.nombres)
        ).all()

    def regla_de_sede(self, sede):
        return self._base.scalar(select(ReglaSede).where(ReglaSede.sede_id == sede))

    def asignacion_vigente(self, fecha, persona):
        return self._base.scalar(
            select(AsignacionHorario)
            .where(
                AsignacionHorario.persona_id == persona.id,
                AsignacionHorario.vigente_desde <= fecha,
                AsignacionHorario.vigente_hasta.is_(None)
                | (AsignacionHorario.vigente_hasta >= fecha),
            )
            .order_by(AsignacionHorario.vigente_desde.desc())
        )

    def tramos_del_dia(self, fecha, horario):
        return self._base.scalars(
            select(TramoHorario)
            .where(
                TramoHorario.horario_id == horario.id,
                TramoHorario.dia_semana == fecha.weekday(),
            )
            .order_by(TramoHorario.hora_entrada)
        ).all()

    def tolerancia_vigente(self, local, persona):
        return self._base.scalar(
            select(ToleranciaRol)
            .where(
                ToleranciaRol.rol_id == persona.rol_id,
                ToleranciaRol.vigente_desde <= local.date(),
                ToleranciaRol.vigente_hasta.is_(None)
                | (ToleranciaRol.vigente_hasta >= local.date()),
            )
            .order_by(ToleranciaRol.vigente_desde.desc())
        )

    def personas_ordenadas(self, sede):
        return self._base.scalars(
            select(Persona).where(Persona.sede_id == sede).order_by(Persona.apellidos)
        ).all()

    def cuenta_de_persona(self, persona):
        return self._base.scalar(
            select(Usuario).where(Usuario.persona_id == persona.id)
        )

    def asignacion_del_catalogo(self, hoy, persona):
        return self._base.scalar(
            select(AsignacionHorario)
            .where(
                AsignacionHorario.persona_id == persona.id,
                AsignacionHorario.vigente_desde <= hoy,
                AsignacionHorario.vigente_hasta.is_(None)
                | (AsignacionHorario.vigente_hasta >= hoy),
            )
            .order_by(AsignacionHorario.vigente_desde.desc())
        )

    def tarifa_de_persona(self, persona):
        return self._base.scalar(
            select(TarifaDocente).where(TarifaDocente.persona_id == persona.id)
        )

    def horarios_de_sede(self, sede):
        return self._base.scalars(select(Horario).where(Horario.sede_id == sede)).all()

    def roles(self):
        return self._base.scalars(select(Rol)).all()

    def tolerancia_del_catalogo(self, hoy, rol):
        return self._base.scalar(
            select(ToleranciaRol)
            .where(
                ToleranciaRol.rol_id == rol.id,
                ToleranciaRol.vigente_desde <= hoy,
                ToleranciaRol.vigente_hasta.is_(None)
                | (ToleranciaRol.vigente_hasta >= hoy),
            )
            .order_by(ToleranciaRol.vigente_desde.desc())
        )

    def carreras_de_sede(self, sede):
        return self._base.scalars(select(Carrera).where(Carrera.sede_id == sede)).all()

    def grupos_de_sede(self, sede):
        return self._base.scalars(
            select(Grupo).join(Carrera).where(Carrera.sede_id == sede)
        ).all()

    def tramos_del_horario(self, horario):
        return self._base.scalars(
            select(TramoHorario)
            .where(TramoHorario.horario_id == horario.id)
            .order_by(TramoHorario.dia_semana, TramoHorario.hora_entrada)
        ).all()

    def dias_no_lectivos(self, sede):
        return self._base.scalars(
            select(DiaNoLectivo)
            .where(DiaNoLectivo.sede_id == sede)
            .order_by(DiaNoLectivo.fecha)
        ).all()

    def dispositivos_de_sede(self, sede):
        return self._base.scalars(
            select(Dispositivo).where(Dispositivo.sede_id == sede)
        ).all()

    def asignaciones_abiertas(self, persona):
        return self._base.scalars(
            select(AsignacionHorario).where(
                AsignacionHorario.persona_id == persona.id,
                AsignacionHorario.vigente_hasta.is_(None),
            )
        ).all()

    def personas_con_marcados(self, sede, inicio, fin):
        return self._base.scalars(
            select(Persona)
            .join(Marcado, Marcado.persona_id == Persona.id)
            .where(Persona.sede_id == sede.id, Marcado.ocurrido_en >= inicio, Marcado.ocurrido_en < fin)
            .distinct()
        ).all()

    def personas_del_diario(self, sede, persona_id=None):
        return self._base.scalars(
            select(Persona).where(Persona.sede_id == sede.id, *([Persona.id == persona_id] if persona_id is not None else []))
        ).all()

    def marcados_del_intervalo(self, fin, inicio, sede, persona_id=None):
        return self._base.scalars(
            select(Marcado)
            .join(Persona)
            .where(
                Persona.sede_id == sede.id,
                *([Persona.id == persona_id] if persona_id is not None else []),
                Marcado.ocurrido_en >= inicio,
                Marcado.ocurrido_en < fin,
            )
            .order_by(Marcado.ocurrido_en)
        ).all()

    def dias_no_lectivos_del_intervalo(self, desde, hasta, sede):
        return self._base.scalars(
            select(DiaNoLectivo).where(
                DiaNoLectivo.sede_id == sede.id,
                DiaNoLectivo.fecha >= desde,
                DiaNoLectivo.fecha <= hasta,
            )
        ).all()

    def justificaciones_aprobadas(self, desde, hasta, sede, persona_id=None):
        return self._base.scalars(
            select(Justificacion)
            .join(Persona)
            .where(
                Persona.sede_id == sede.id,
                *([Persona.id == persona_id] if persona_id is not None else []),
                Justificacion.estado == "aprobada",
                Justificacion.fecha >= desde,
                Justificacion.fecha <= hasta,
            )
        ).all()

    def justificaciones_pendientes(self, sede_consulta):
        return self._base.scalars(
            select(Justificacion)
            .join(Persona)
            .where(
                Persona.sede_id == sede_consulta, Justificacion.estado == "pendiente"
            )
        ).all()

    def bloquear_persona(self, persona):
        return self._base.execute(
            select(Persona).where(Persona.id == persona.id).with_for_update().execution_options(populate_existing=True)
        ).scalar_one()

    def marcado_por_evento(self, datos):
        return self._base.scalar(
            select(Marcado).where(
                Marcado.identificador_evento == datos.identificador_evento
            )
        )

    def marcados_de_persona(self, fin, inicio, persona):
        return self._base.scalars(
            select(Marcado).where(
                Marcado.persona_id == persona.id,
                Marcado.ocurrido_en >= inicio,
                Marcado.ocurrido_en < fin,
            ).with_for_update()
        ).all()

    def primer_punto_de_sede(self, PuntoAsistencia, persona):
        return self._base.scalar(
            select(PuntoAsistencia)
            .where(
                PuntoAsistencia.sede_id == persona.sede_id,
                PuntoAsistencia.activo.is_(True),
            )
            .order_by(PuntoAsistencia.id)
        )

    def justificaciones_de_sede(self, sede_consulta):
        return self._base.execute(
            select(Justificacion, Persona)
            .join(Persona)
            .where(Persona.sede_id == sede_consulta)
            .order_by(Justificacion.id.desc())
        ).all()

    def pagina_justificaciones(self, sede_consulta, pagina, por_pagina):
        filtro = Persona.sede_id == sede_consulta
        total = self._base.scalar(select(func.count(Justificacion.id)).join(Persona).where(filtro)) or 0
        filas = self._base.execute(
            select(Justificacion, Persona).join(Persona).where(filtro)
            .order_by(Justificacion.id.desc())
            .offset((pagina - 1) * por_pagina).limit(por_pagina)
        ).all()
        return total, filas

    def bloquear_tolerancia(self, hoy, identificador):
        return self._base.scalar(
            select(ToleranciaRol)
            .where(
                ToleranciaRol.rol_id == identificador,
                ToleranciaRol.vigente_desde <= hoy,
                ToleranciaRol.vigente_hasta.is_(None)
                | (ToleranciaRol.vigente_hasta >= hoy),
            )
            .order_by(ToleranciaRol.vigente_desde.desc())
            .with_for_update()
        )

    def dia_no_lectivo(self, datos, sede):
        return self._base.scalar(
            select(DiaNoLectivo).where(
                DiaNoLectivo.sede_id == sede, DiaNoLectivo.fecha == datos.fecha
            )
        )

    def docentes_de_sede(self, sede_consulta):
        return self._base.scalars(
            select(Persona)
            .join(Rol)
            .where(Persona.sede_id == sede_consulta, Rol.codigo == "docente")
        ).all()

    def tarifa_del_docente(self, docente):
        return self._base.scalar(
            select(TarifaDocente).where(TarifaDocente.persona_id == docente.id)
        )

    def historial_de_marcados(self, fin, inicio, sede, pagina=1, por_pagina=50, modalidad=None):
        filtros = (
            Persona.sede_id == sede.id,
            Marcado.ocurrido_en >= inicio,
            Marcado.ocurrido_en < fin,
        )
        if modalidad:
            filtros += (Marcado.modalidad == modalidad,)
        total = self._base.scalar(
            select(func.count(Marcado.id)).join(Persona).where(*filtros)
        ) or 0
        filas = self._base.execute(
            select(Marcado, Persona, Usuario.nombre_usuario)
            .join(Persona, Marcado.persona_id == Persona.id)
            .outerjoin(Usuario, Marcado.registrado_por_id == Usuario.id)
            .where(*filtros)
            .order_by(Marcado.ocurrido_en.desc(), Marcado.id.desc())
            .offset((pagina - 1) * por_pagina).limit(por_pagina)
        ).all()
        return total, filas
