"""puesto_y_carne"""
from alembic import op
import sqlalchemy as sa
from uuid import uuid4


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('puestos_abiertos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('punto_id', sa.Integer(), nullable=False),
    sa.Column('encargado_id', sa.Integer(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('activo', sa.Boolean(), nullable=False),
    sa.Column('vence_en', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['encargado_id'], ['usuarios.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['punto_id'], ['puntos_asistencia.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index('ix_puestos_punto_activo', 'puestos_abiertos', ['punto_id', 'activo'], unique=False)
    op.create_table('eventos_puesto',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('puesto_id', sa.Integer(), nullable=False),
    sa.Column('persona_id', sa.Integer(), nullable=True),
    sa.Column('identificador_evento', sa.String(length=36), nullable=False),
    sa.Column('marcado_id', sa.Integer(), nullable=True),
    sa.Column('tipo', sa.String(length=10), nullable=True),
    sa.Column('ocurrido_en', sa.DateTime(), nullable=False),
    sa.Column('resultado', sa.String(length=200), nullable=False),
    sa.Column('aceptado', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['marcado_id'], ['marcados.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['puesto_id'], ['puestos_abiertos.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('identificador_evento'),
    sa.UniqueConstraint('marcado_id')
    )
    op.create_index('ix_eventos_puesto_id', 'eventos_puesto', ['puesto_id', 'id'], unique=False)
    op.add_column('personas', sa.Column('foto_ruta', sa.String(length=255), nullable=True))
    op.add_column('personas', sa.Column('version_carne', sa.String(length=36), nullable=True))
    conexion = op.get_bind()
    for identificador in conexion.execute(sa.text('SELECT id FROM personas')).scalars():
        conexion.execute(sa.text('UPDATE personas SET version_carne=:version WHERE id=:id'), {'version': str(uuid4()), 'id': identificador})
    op.alter_column('personas', 'version_carne', existing_type=sa.String(36), nullable=False)

def downgrade():
    op.drop_column('personas', 'version_carne')
    op.drop_column('personas', 'foto_ruta')
    op.drop_index('ix_eventos_puesto_id', table_name='eventos_puesto')
    op.drop_table('eventos_puesto')
    op.drop_index('ix_puestos_punto_activo', table_name='puestos_abiertos')
    op.drop_table('puestos_abiertos')
