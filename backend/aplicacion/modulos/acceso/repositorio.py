from sqlalchemy import select, func
from ...models import Rol, Persona, Usuario, SesionAcceso
from ...seguridad import resumir_token
from ...compartido.repositorio import RepositorioBase


class RepositorioAcceso(RepositorioBase):

    def bloquear_usuario(self, usuario):
        return self._base.scalar(select(Usuario).where(Usuario.id == usuario.id).with_for_update().execution_options(populate_existing=True))

    def revocar_sesiones(self, usuario):
        for sesion in self._base.scalars(select(SesionAcceso).where(SesionAcceso.usuario_id == usuario.id)).all():
            self._base.delete(sesion)

    def sesion_vigente(self, hora_consulta, token):
        return self._base.scalar(
            select(SesionAcceso).where(
                SesionAcceso.token_hash == resumir_token(token),
                SesionAcceso.vence_en > hora_consulta,
            )
        )

    def usuario_por_nombre(self, datos):
        return self._base.scalar(
            select(Usuario).where(
                Usuario.nombre_usuario == datos.usuario.strip().lower()
            )
        )

    def sesion_anterior(self, anterior):
        return self._base.scalar(
            select(SesionAcceso).where(
                SesionAcceso.token_hash == resumir_token(anterior)
            )
        )

    def sesion_por_token(self, token):
        return self._base.scalar(
            select(SesionAcceso).where(SesionAcceso.token_hash == resumir_token(token))
        )

    def conteos_por_rol(self, persona):
        return self._base.execute(
            select(Rol.codigo, func.count(Persona.id))
            .join(Persona, Persona.rol_id == Rol.id)
            .where(Persona.sede_id == persona.sede_id, Persona.activa.is_(True))
            .group_by(Rol.codigo)
        ).all()
