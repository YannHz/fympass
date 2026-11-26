"""cambio obligatorio de clave inicial"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("usuarios", sa.Column("debe_cambiar_clave", sa.Boolean(), nullable=False, server_default=sa.text("1")))


def downgrade():
    op.drop_column("usuarios", "debe_cambiar_clave")
