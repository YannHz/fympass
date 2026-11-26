"""retira campos heredados ajenos al marcado qr"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    conexion = op.get_bind()
    cantidad = conexion.scalar(sa.text("SELECT COUNT(*) FROM dispositivos WHERE tipo <> 'qr'"))
    if cantidad:
        raise RuntimeError("Hay dispositivos heredados. Revísalos antes de aplicar la limpieza del esquema.")
    op.drop_constraint("uq_personas_biometrico", "personas", type_="unique")
    op.drop_column("personas", "identificador_biometrico")
    op.drop_constraint("ck_dispositivos_tipo", "dispositivos", type_="check")
    op.create_check_constraint("ck_dispositivos_tipo", "dispositivos", "tipo = 'qr'")


def downgrade():
    op.drop_constraint("ck_dispositivos_tipo", "dispositivos", type_="check")
    op.create_check_constraint("ck_dispositivos_tipo", "dispositivos", "tipo IN ('qr','zkteco')")
    op.add_column("personas", sa.Column("identificador_biometrico", sa.String(40), nullable=True))
    op.create_unique_constraint("uq_personas_biometrico", "personas", ["identificador_biometrico"])
