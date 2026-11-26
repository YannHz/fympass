"""controles de seguridad de acceso"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    for nombre, tipo in [
        ("clave_temporal_vence", sa.DateTime()), ("mfa_secreto", sa.Text()),
        ("mfa_pendiente", sa.Text()), ("mfa_pendiente_vence", sa.DateTime()),
        ("mfa_recuperacion", sa.Text()), ("mfa_ultimo_paso", sa.Integer()),
    ]:
        op.add_column("usuarios", sa.Column(nombre, tipo, nullable=True))
    op.add_column("sesiones_acceso", sa.Column("ultima_actividad", sa.DateTime(), nullable=True))
    op.execute("UPDATE sesiones_acceso SET ultima_actividad = creada_en")
    op.alter_column("sesiones_acceso", "ultima_actividad", existing_type=sa.DateTime(), nullable=False)
    op.execute("UPDATE usuarios SET clave_temporal_vence = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 48 HOUR) WHERE debe_cambiar_clave = 1")
    op.create_table("eventos_seguridad",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sede_id", sa.Integer(), sa.ForeignKey("sedes.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("accion", sa.String(80), nullable=False),
        sa.Column("detalle", sa.String(500), nullable=False),
        sa.Column("creada_en", sa.DateTime(), nullable=False))
    op.create_index("ix_eventos_seguridad_accion", "eventos_seguridad", ["accion"])
    op.create_index("ix_eventos_seguridad_creada_en", "eventos_seguridad", ["creada_en"])
    op.create_table("limites_acceso",
        sa.Column("clave", sa.String(64), primary_key=True),
        sa.Column("intentos", sa.Integer(), nullable=False),
        sa.Column("inicio", sa.DateTime(), nullable=False),
        sa.Column("bloqueado_hasta", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_table("limites_acceso")
    op.drop_table("eventos_seguridad")
    op.drop_column("sesiones_acceso", "ultima_actividad")
    for nombre in ["clave_temporal_vence", "mfa_secreto", "mfa_pendiente", "mfa_pendiente_vence", "mfa_recuperacion", "mfa_ultimo_paso"]:
        op.drop_column("usuarios", nombre)
