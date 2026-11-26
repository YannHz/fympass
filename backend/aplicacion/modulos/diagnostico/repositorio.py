from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from ...compartido.errores import FalloPersistencia
from ...compartido.repositorio import RepositorioBase


class RepositorioDiagnostico(RepositorioBase):
    def version_base(self):
        try:
            return self._base.execute(text("SELECT VERSION()")).scalar_one()
        except SQLAlchemyError as error:
            raise FalloPersistencia() from error
