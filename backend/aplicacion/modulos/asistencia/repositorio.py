from datetime import timedelta
from sqlalchemy import or_, select, update
from ...models import (
    Persona,
    Usuario,
    ToleranciaRol,
    PuntoAsistencia,
    Marcado,
    PuestoAbierto,
    EventoPuesto,
)
from ...seguridad import resumir_token
from ...compartido.repositorio import RepositorioBase


class RepositorioAsistencia(RepositorioBase):

    def cuenta_persona(self, persona):
        return self._base.scalar(select(Usuario).where(Usuario.persona_id == persona.id))

    def puesto_por_token(self, token):
        return self._base.scalar(
            select(PuestoAbierto).where(
                PuestoAbierto.token_hash == resumir_token(token)
            )
        )

    def primer_punto_de_sede(self, persona):
        return self._base.scalar(
            select(PuntoAsistencia)
            .where(PuntoAsistencia.sede_id == persona.sede_id)
            .order_by(PuntoAsistencia.id)
        )

    def puesto_abierto(self, hora_consulta, punto, encargado_id=None):
        condiciones = [
            PuestoAbierto.punto_id == punto.id,
            PuestoAbierto.activo.is_(True),
            PuestoAbierto.vence_en > hora_consulta,
        ]
        if encargado_id is not None:
            condiciones.append(PuestoAbierto.encargado_id == encargado_id)
        return self._base.scalar(
            select(PuestoAbierto).where(
                *condiciones,
            ).order_by(PuestoAbierto.id.desc()).limit(1)
        )

    def bloquear_punto(self, punto):
        return self._base.execute(
            select(PuntoAsistencia)
            .where(PuntoAsistencia.id == punto.id)
            .with_for_update()
        ).scalar_one()

    def desactivar_puestos(self, punto, encargado_id):
        return self._base.execute(
            update(PuestoAbierto)
            .where(
                PuestoAbierto.punto_id == punto.id,
                PuestoAbierto.encargado_id == encargado_id,
                PuestoAbierto.activo.is_(True),
            )
            .values(activo=False)
        )

    def eventos_recientes(self, despues, hora_consulta, puesto):
        sede_id = (
            select(PuntoAsistencia.sede_id)
            .where(PuntoAsistencia.id == puesto.punto_id)
            .scalar_subquery()
        )
        return self._base.scalars(
            select(EventoPuesto)
            .join(PuestoAbierto, EventoPuesto.puesto_id == PuestoAbierto.id)
            .join(PuntoAsistencia, PuestoAbierto.punto_id == PuntoAsistencia.id)
            .where(
                PuntoAsistencia.sede_id == sede_id,
                or_(
                    EventoPuesto.puesto_id == puesto.id,
                    EventoPuesto.aceptado.is_(True),
                ),
                EventoPuesto.id > despues,
                EventoPuesto.ocurrido_en > hora_consulta - timedelta(minutes=2),
            )
            .order_by(EventoPuesto.id)
            .limit(20)
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

    def bloquear_puesto(self, puesto):
        return self._base.scalar(
            select(PuestoAbierto)
            .where(PuestoAbierto.id == puesto.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def evento_por_identificador(self, datos):
        return self._base.scalar(
            select(EventoPuesto).where(
                EventoPuesto.identificador_evento == str(datos.identificador_evento)
            )
        )

    def bloquear_persona(self, persona):
        return self._base.scalar(
            select(Persona)
            .where(Persona.id == persona.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def ultimo_marcado_del_dia(self, inicio, persona):
        return self._base.scalar(
            select(Marcado)
            .where(
                Marcado.persona_id == persona.id,
                Marcado.ocurrido_en >= inicio,
                Marcado.ocurrido_en < inicio + timedelta(days=1),
            )
            .order_by(Marcado.ocurrido_en.desc(), Marcado.id.desc())
        )

    def evento_del_marcado(self, ultimo):
        return self._base.scalar(
            select(EventoPuesto).where(EventoPuesto.marcado_id == ultimo.id)
        )

    def ultimos_marcados_de_sede(self, persona):
        return self._base.execute(
            select(Marcado, Persona, EventoPuesto.resultado)
            .join(Persona, Marcado.persona_id == Persona.id)
            .join(PuntoAsistencia, Marcado.punto_id == PuntoAsistencia.id)
            .outerjoin(EventoPuesto, EventoPuesto.marcado_id == Marcado.id)
            .where(PuntoAsistencia.sede_id == persona.sede_id)
            .order_by(Marcado.id.desc())
            .limit(30)
        ).all()
