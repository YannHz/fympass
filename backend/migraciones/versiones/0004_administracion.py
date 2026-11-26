"""administracion"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('carreras',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('sede_id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('codigo', sa.String(length=30), nullable=False),
    sa.Column('activa', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['sede_id'], ['sedes.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('sede_id', 'codigo', name='uq_carreras_sede_codigo')
    )
    op.create_table('dias_no_lectivos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('sede_id', sa.Integer(), nullable=False),
    sa.Column('fecha', sa.Date(), nullable=False),
    sa.Column('motivo', sa.String(length=200), nullable=False),
    sa.ForeignKeyConstraint(['sede_id'], ['sedes.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('sede_id', 'fecha', name='uq_dias_no_lectivos_sede_fecha')
    )
    op.create_table('dispositivos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('sede_id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=100), nullable=False),
    sa.Column('tipo', sa.String(length=20), nullable=False),
    sa.Column('modelo', sa.String(length=80), nullable=True),
    sa.Column('direccion_ip', sa.String(length=50), nullable=True),
    sa.Column('puerto', sa.Integer(), nullable=False),
    sa.Column('activo', sa.Boolean(), nullable=False),
    sa.CheckConstraint("tipo IN ('qr','zkteco')", name='ck_dispositivos_tipo'),
    sa.CheckConstraint('puerto BETWEEN 1 AND 65535', name='ck_dispositivos_puerto'),
    sa.ForeignKeyConstraint(['sede_id'], ['sedes.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('reglas_sedes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('sede_id', sa.Integer(), nullable=False),
    sa.Column('anticipacion_minutos', sa.Integer(), nullable=False),
    sa.Column('limite_ausencia_minutos', sa.Integer(), nullable=False),
    sa.Column('observacion_porcentaje', sa.Integer(), nullable=False),
    sa.Column('alerta_porcentaje', sa.Integer(), nullable=False),
    sa.CheckConstraint('anticipacion_minutos >= 0 AND limite_ausencia_minutos >= 0', name='ck_reglas_minutos'),
    sa.CheckConstraint('observacion_porcentaje >= 0 AND alerta_porcentaje > observacion_porcentaje AND alerta_porcentaje <= 100', name='ck_reglas_porcentajes'),
    sa.ForeignKeyConstraint(['sede_id'], ['sedes.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('sede_id')
    )
    op.create_table('grupos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('carrera_id', sa.Integer(), nullable=False),
    sa.Column('horario_id', sa.Integer(), nullable=True),
    sa.Column('codigo', sa.String(length=30), nullable=False),
    sa.Column('ciclo', sa.String(length=30), nullable=False),
    sa.Column('turno', sa.String(length=30), nullable=False),
    sa.Column('activo', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['carrera_id'], ['carreras.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['horario_id'], ['horarios.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('carrera_id', 'codigo', name='uq_grupos_carrera_codigo')
    )
    op.create_table('tarifas_docentes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('persona_id', sa.Integer(), nullable=False),
    sa.Column('tarifa_hora', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.CheckConstraint('tarifa_hora >= 0', name='ck_tarifas_positivas'),
    sa.ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('persona_id')
    )
    op.create_table('auditoria',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('accion', sa.String(length=80), nullable=False),
    sa.Column('entidad', sa.String(length=50), nullable=False),
    sa.Column('entidad_id', sa.Integer(), nullable=False),
    sa.Column('detalle', sa.Text(), nullable=False),
    sa.Column('creada_en', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('justificaciones',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('persona_id', sa.Integer(), nullable=False),
    sa.Column('fecha', sa.Date(), nullable=False),
    sa.Column('tipo', sa.String(length=20), nullable=False),
    sa.Column('motivo', sa.String(length=1000), nullable=False),
    sa.Column('referencia', sa.String(length=200), nullable=True),
    sa.Column('estado', sa.String(length=20), nullable=False),
    sa.Column('creada_por_id', sa.Integer(), nullable=False),
    sa.Column('resuelta_por_id', sa.Integer(), nullable=True),
    sa.Column('observacion', sa.String(length=500), nullable=True),
    sa.Column('creada_en', sa.DateTime(), nullable=False),
    sa.CheckConstraint("estado IN ('pendiente','aprobada','observada')", name='ck_justificaciones_estado'),
    sa.CheckConstraint("tipo IN ('falta','tardanza')", name='ck_justificaciones_tipo'),
    sa.ForeignKeyConstraint(['creada_por_id'], ['usuarios.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['resuelta_por_id'], ['usuarios.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.add_column('marcados', sa.Column('resultado', sa.String(length=200), nullable=True))
    op.add_column('personas', sa.Column('grupo_id', sa.Integer(), nullable=True))
    op.add_column('personas', sa.Column('identificador_biometrico', sa.String(length=40), nullable=True))
    op.create_unique_constraint('uq_personas_biometrico', 'personas', ['identificador_biometrico'])
    op.create_foreign_key('fk_personas_grupo', 'personas', 'grupos', ['grupo_id'], ['id'], ondelete='RESTRICT')

    op.execute(sa.text('UPDATE marcados SET resultado=(SELECT resultado FROM eventos_puesto WHERE eventos_puesto.marcado_id=marcados.id LIMIT 1) WHERE resultado IS NULL'))

def downgrade():
    op.drop_constraint('fk_personas_grupo', 'personas', type_='foreignkey')
    op.drop_constraint('uq_personas_biometrico', 'personas', type_='unique')
    op.drop_column('personas', 'identificador_biometrico')
    op.drop_column('personas', 'grupo_id')
    op.drop_column('marcados', 'resultado')
    op.drop_table('justificaciones')
    op.drop_table('auditoria')
    op.drop_table('tarifas_docentes')
    op.drop_table('grupos')
    op.drop_table('reglas_sedes')
    op.drop_table('dispositivos')
    op.drop_table('dias_no_lectivos')
    op.drop_table('carreras')
