"""organizacion de horarios del personal"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("horarios", sa.Column("tipo_personal", sa.String(20), nullable=False, server_default="administrativo"))
    op.add_column("horarios", sa.Column("carrera", sa.String(120), nullable=True))
    op.add_column("horarios", sa.Column("turno", sa.String(20), nullable=False, server_default="completo"))
    op.execute("""UPDATE horarios h SET tipo_personal = 'docente'
        WHERE h.nombre LIKE 'Docentes%' OR EXISTS (
            SELECT 1 FROM asignaciones_horarios a JOIN personas p ON p.id = a.persona_id
            JOIN roles r ON r.id = p.rol_id WHERE a.horario_id = h.id AND r.codigo = 'docente')""")
    op.execute("UPDATE horarios SET turno = 'manana' WHERE nombre LIKE '%mañana%'")
    op.execute("UPDATE horarios SET turno = 'tarde' WHERE nombre LIKE '%tarde%'")


def downgrade():
    op.drop_column("horarios", "turno")
    op.drop_column("horarios", "carrera")
    op.drop_column("horarios", "tipo_personal")
