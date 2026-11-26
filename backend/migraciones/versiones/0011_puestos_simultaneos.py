"""permite sesiones de puesto simultaneas por encargado"""

from alembic import op
import sqlalchemy as sa


revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "puestos_abiertos",
        sa.Column("camara_puesto_habilitada", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "puestos_abiertos",
        sa.Column("escaneo_movil_habilitado", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    conexion = op.get_bind()
    conexion.execute(sa.text(
        "UPDATE puestos_abiertos AS puesto "
        "JOIN puntos_asistencia AS punto ON punto.id = puesto.punto_id "
        "SET puesto.camara_puesto_habilitada = punto.camara_puesto_habilitada, "
        "puesto.escaneo_movil_habilitado = punto.escaneo_movil_habilitado"
    ))


def downgrade():
    op.drop_column("puestos_abiertos", "escaneo_movil_habilitado")
    op.drop_column("puestos_abiertos", "camara_puesto_habilitada")
