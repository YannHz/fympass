"""conserva las asignaciones heredadas antes de exigir confirmacion"""
from datetime import date, timedelta
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    conexion = op.get_bind()
    estudiantes = conexion.execute(sa.text("""
        SELECT p.id, g.horario_id FROM personas p
        JOIN roles r ON r.id = p.rol_id
        JOIN grupos g ON g.id = p.grupo_id
        JOIN horarios h ON h.id = g.horario_id
        WHERE r.codigo = 'estudiante' AND g.activo = 1 AND h.activo = 1
    """)).all()
    for persona_id, horario_id in estudiantes:
        asignaciones = conexion.execute(sa.text("""
            SELECT vigente_desde, vigente_hasta FROM asignaciones_horarios
            WHERE persona_id = :persona ORDER BY vigente_desde
        """), {"persona": persona_id}).all()
        desde = date(1900, 1, 1)
        huecos = []
        for inicio, fin in asignaciones:
            if inicio > desde:
                huecos.append((desde, inicio - timedelta(days=1)))
            if fin is None:
                desde = None
                break
            desde = max(desde, fin + timedelta(days=1))
        if desde is not None:
            huecos.append((desde, None))
        for inicio, fin in huecos:
            conexion.execute(sa.text("""
                INSERT INTO asignaciones_horarios (persona_id, horario_id, vigente_desde, vigente_hasta)
                VALUES (:persona, :horario, :desde, :hasta)
            """), {"persona": persona_id, "horario": horario_id, "desde": inicio, "hasta": fin})


def downgrade():
    # las asignaciones confirmadas se conservan al volver a la revision anterior
    pass
