from sqlalchemy import create_engine, URL
from .config import configuracion

direccion = URL.create("mysql+pymysql", username=configuracion.bd_usuario,
    password=configuracion.bd_clave, host=configuracion.bd_host,
    port=configuracion.bd_puerto, database=configuracion.bd_nombre,
    query={"charset": "utf8mb4"})
motor = create_engine(direccion, pool_pre_ping=True, connect_args={"connect_timeout": 3})
