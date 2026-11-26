from alembic import context
from aplicacion.database import motor
import os
import json
from pathlib import Path
from sqlalchemy import create_engine
if os.environ.get("FYM_MIGRACION") == "1":
    datos = json.loads((Path(__file__).resolve().parents[1] / "archivos/seguridad/migraciones_bd.local.json").read_text())
    motor = create_engine(motor.url.set(username=datos["usuario"], password=datos["clave"]))
from aplicacion.models import Base

def migrar_sin_conexion():
    context.configure(url=motor.url, target_metadata=Base.metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()

def migrar_con_conexion():
    with motor.connect() as conexion:
        context.configure(connection=conexion, target_metadata=Base.metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    migrar_sin_conexion()
else:
    migrar_con_conexion()
