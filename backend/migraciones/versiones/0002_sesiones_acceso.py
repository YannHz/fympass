"""sesiones_acceso"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('sesiones_acceso',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('creada_en', sa.DateTime(), nullable=False),
    sa.Column('vence_en', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_sesiones_acceso_vence_en'), 'sesiones_acceso', ['vence_en'], unique=False)

def downgrade():
    op.drop_index(op.f('ix_sesiones_acceso_vence_en'), table_name='sesiones_acceso')
    op.drop_table('sesiones_acceso')
