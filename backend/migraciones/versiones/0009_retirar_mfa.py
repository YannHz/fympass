"""retira el segundo factor por decision del proyecto"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    for nombre in ("mfa_secreto", "mfa_pendiente", "mfa_pendiente_vence", "mfa_recuperacion", "mfa_ultimo_paso"):
        op.drop_column("usuarios", nombre)


def downgrade():
    for nombre, tipo in (
        ("mfa_secreto", sa.Text()), ("mfa_pendiente", sa.Text()),
        ("mfa_pendiente_vence", sa.DateTime()), ("mfa_recuperacion", sa.Text()),
        ("mfa_ultimo_paso", sa.Integer()),
    ):
        op.add_column("usuarios", sa.Column(nombre, tipo, nullable=True))
