"""estructura_inicial"""
from alembic import op
import sqlalchemy as sa


revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('roles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('codigo', sa.String(length=30), nullable=False),
    sa.Column('nombre', sa.String(length=60), nullable=False),
    sa.Column('requiere_salida', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('codigo')
    )
    op.create_table('sedes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('codigo', sa.String(length=20), nullable=False),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('zona_horaria', sa.String(length=50), nullable=False),
    sa.Column('activa', sa.Boolean(), server_default=sa.text('1'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('codigo')
    )
    op.create_table('horarios',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=100), nullable=False),
    sa.Column('sede_id', sa.Integer(), nullable=False),
    sa.Column('activo', sa.Boolean(), server_default=sa.text('1'), nullable=False),
    sa.ForeignKeyConstraint(['sede_id'], ['sedes.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('personas',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('codigo', sa.String(length=30), nullable=False),
    sa.Column('nombres', sa.String(length=100), nullable=False),
    sa.Column('apellidos', sa.String(length=100), nullable=False),
    sa.Column('documento', sa.String(length=20), nullable=True),
    sa.Column('sede_id', sa.Integer(), nullable=False),
    sa.Column('rol_id', sa.Integer(), nullable=False),
    sa.Column('activa', sa.Boolean(), server_default=sa.text('1'), nullable=False),
    sa.Column('creada_en', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['rol_id'], ['roles.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['sede_id'], ['sedes.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('codigo'),
    sa.UniqueConstraint('documento')
    )
    op.create_index('ix_personas_sede_rol', 'personas', ['sede_id', 'rol_id'], unique=False)
    op.create_table('puntos_asistencia',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('sede_id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=100), nullable=False),
    sa.Column('camara_puesto_habilitada', sa.Boolean(), nullable=False),
    sa.Column('escaneo_movil_habilitado', sa.Boolean(), nullable=False),
    sa.Column('activo', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['sede_id'], ['sedes.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('sede_id', 'nombre', name='uq_puntos_sede_nombre')
    )
    op.create_table('tolerancias_roles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('rol_id', sa.Integer(), nullable=False),
    sa.Column('minutos', sa.Integer(), nullable=False),
    sa.Column('vigente_desde', sa.Date(), nullable=False),
    sa.Column('vigente_hasta', sa.Date(), nullable=True),
    sa.CheckConstraint('minutos >= 0', name='ck_tolerancias_minutos'),
    sa.CheckConstraint('vigente_hasta IS NULL OR vigente_hasta >= vigente_desde', name='ck_tolerancias_fechas'),
    sa.ForeignKeyConstraint(['rol_id'], ['roles.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('rol_id', 'vigente_desde', name='uq_tolerancias_rol_desde')
    )
    op.create_table('asignaciones_horarios',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('persona_id', sa.Integer(), nullable=False),
    sa.Column('horario_id', sa.Integer(), nullable=False),
    sa.Column('vigente_desde', sa.Date(), nullable=False),
    sa.Column('vigente_hasta', sa.Date(), nullable=True),
    sa.CheckConstraint('vigente_hasta IS NULL OR vigente_hasta >= vigente_desde', name='ck_asignaciones_fechas'),
    sa.ForeignKeyConstraint(['horario_id'], ['horarios.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('persona_id', 'horario_id', 'vigente_desde', name='uq_asignaciones_vigencia')
    )
    op.create_table('tramos_horarios',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('horario_id', sa.Integer(), nullable=False),
    sa.Column('dia_semana', sa.Integer(), nullable=False),
    sa.Column('hora_entrada', sa.Time(), nullable=False),
    sa.Column('hora_salida', sa.Time(), nullable=True),
    sa.CheckConstraint('dia_semana BETWEEN 0 AND 6', name='ck_tramos_dia'),
    sa.CheckConstraint('hora_salida IS NULL OR hora_salida > hora_entrada', name='ck_tramos_salida'),
    sa.ForeignKeyConstraint(['horario_id'], ['horarios.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('horario_id', 'dia_semana', 'hora_entrada', name='uq_tramos_horario_dia_entrada')
    )
    op.create_table('usuarios',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('persona_id', sa.Integer(), nullable=False),
    sa.Column('nombre_usuario', sa.String(length=80), nullable=False),
    sa.Column('clave_hash', sa.String(length=255), nullable=False),
    sa.Column('permiso', sa.String(length=20), nullable=False),
    sa.Column('activo', sa.Boolean(), server_default=sa.text('1'), nullable=False),
    sa.CheckConstraint("permiso IN ('personal','operador','administrador')", name='ck_usuarios_permiso'),
    sa.ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('nombre_usuario'),
    sa.UniqueConstraint('persona_id')
    )
    op.create_table('marcados',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('identificador_evento', sa.String(length=36), nullable=False),
    sa.Column('persona_id', sa.Integer(), nullable=False),
    sa.Column('punto_id', sa.Integer(), nullable=False),
    sa.Column('rol_id', sa.Integer(), nullable=False),
    sa.Column('tipo', sa.String(length=10), nullable=False),
    sa.Column('modalidad', sa.String(length=20), nullable=False),
    sa.Column('ocurrido_en', sa.DateTime(), nullable=False),
    sa.Column('registrado_en', sa.DateTime(), nullable=False),
    sa.Column('registrado_por_id', sa.Integer(), nullable=True),
    sa.Column('motivo', sa.String(length=500), nullable=True),
    sa.CheckConstraint("modalidad <> 'manual' OR (registrado_por_id IS NOT NULL AND motivo IS NOT NULL AND CHAR_LENGTH(TRIM(motivo)) > 0)", name='ck_marcados_manual'),
    sa.CheckConstraint("modalidad IN ('camara_puesto','escaneo_movil','manual')", name='ck_marcados_modalidad'),
    sa.CheckConstraint("tipo IN ('entrada','salida')", name='ck_marcados_tipo'),
    sa.ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['punto_id'], ['puntos_asistencia.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['registrado_por_id'], ['usuarios.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['rol_id'], ['roles.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('identificador_evento')
    )
    op.create_index('ix_marcados_persona_fecha', 'marcados', ['persona_id', 'ocurrido_en'], unique=False)
    op.create_index('ix_marcados_punto_fecha', 'marcados', ['punto_id', 'ocurrido_en'], unique=False)

    op.bulk_insert(sa.table('roles', sa.column('id', sa.Integer()), sa.column('codigo', sa.String()), sa.column('nombre', sa.String()), sa.column('requiere_salida', sa.Boolean())), [
        {'id': 1, 'codigo': 'estudiante', 'nombre': 'Estudiante', 'requiere_salida': False},
        {'id': 2, 'codigo': 'docente', 'nombre': 'Docente', 'requiere_salida': True},
        {'id': 3, 'codigo': 'administrativo', 'nombre': 'Personal administrativo', 'requiere_salida': True}])
    op.bulk_insert(sa.table('sedes', sa.column('id', sa.Integer()), sa.column('codigo', sa.String()), sa.column('nombre', sa.String()), sa.column('zona_horaria', sa.String()), sa.column('activa', sa.Boolean())), [{'id': 1, 'codigo': 'principal', 'nombre': 'Sede principal', 'zona_horaria': 'America/Lima', 'activa': True}])
    op.bulk_insert(sa.table('puntos_asistencia', sa.column('id', sa.Integer()), sa.column('sede_id', sa.Integer()), sa.column('nombre', sa.String()), sa.column('camara_puesto_habilitada', sa.Boolean()), sa.column('escaneo_movil_habilitado', sa.Boolean()), sa.column('activo', sa.Boolean())), [{'id': 1, 'sede_id': 1, 'nombre': 'Ingreso principal', 'camara_puesto_habilitada': True, 'escaneo_movil_habilitado': True, 'activo': True}])

def downgrade():
    op.drop_index('ix_marcados_punto_fecha', table_name='marcados')
    op.drop_index('ix_marcados_persona_fecha', table_name='marcados')
    op.drop_table('marcados')
    op.drop_table('usuarios')
    op.drop_table('tramos_horarios')
    op.drop_table('asignaciones_horarios')
    op.drop_table('tolerancias_roles')
    op.drop_table('puntos_asistencia')
    op.drop_index('ix_personas_sede_rol', table_name='personas')
    op.drop_table('personas')
    op.drop_table('horarios')
    op.drop_table('sedes')
    op.drop_table('roles')
