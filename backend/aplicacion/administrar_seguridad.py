"""administracion local de seguridad y respaldos cifrados"""
from argparse import ArgumentParser
from pathlib import Path
import json
import os
import secrets
import shutil
import subprocess
from datetime import datetime, timezone
from cryptography.fernet import Fernet
import pymysql
from .config import configuracion

raiz = Path(__file__).resolve().parents[1]
carpeta = raiz / "archivos/seguridad"


def proteger(archivo):
    if os.name == "nt":
        identidad = subprocess.check_output(["whoami"], text=True).strip()
        subprocess.run(["icacls", str(archivo), "/inheritance:r", "/grant:r", f"{identidad}:(F)", "SYSTEM:(F)"],
                       check=True, capture_output=True)
    else:
        archivo.chmod(0o700 if archivo.is_dir() else 0o600)


def guardar_privado(archivo, contenido):
    archivo.parent.mkdir(parents=True, exist_ok=True)
    archivo.write_text(contenido, encoding="utf-8")
    proteger(archivo)


def claves():
    carpeta.mkdir(parents=True, exist_ok=True)
    proteger(carpeta)
    for nombre in ("clave_respaldos.key",):
        archivo = carpeta / nombre
        if not archivo.exists():
            guardar_privado(archivo, Fernet.generate_key().decode())
        else:
            proteger(archivo)
    for nombre in ("administracion_bd.local.json", "migraciones_bd.local.json", "respaldo_bd.local.json"):
        archivo = carpeta / nombre
        if archivo.exists():
            proteger(archivo)
    proteger(raiz / ".env")


def conexion_admin():
    if configuracion.bd_host not in {"localhost", "127.0.0.1"} or configuracion.bd_nombre != "fym_pass":
        raise RuntimeError("Esta herramienta solo administra fym_pass en la computadora local.")
    archivo = carpeta / "administracion_bd.local.json"
    datos = json.loads(archivo.read_text()) if archivo.exists() else {"usuario": "root", "clave": ""}
    return pymysql.connect(host=configuracion.bd_host, port=configuracion.bd_puerto,
        user=datos["usuario"], password=datos["clave"], autocommit=True, charset="utf8mb4")


def mostrar_accesos(archivo):
    if not archivo:
        raise RuntimeError("Indica --archivo con el listado cifrado generado por datos_iniciales.")
    ruta = Path(archivo).resolve()
    permitida = (raiz / "archivos/respaldos").resolve()
    if not ruta.is_relative_to(permitida) or not ruta.name.endswith(".local.md.fernet"):
        raise RuntimeError("Solo se admiten listados iniciales cifrados de la carpeta de respaldos.")
    print(Fernet((carpeta / "clave_respaldos.key").read_bytes()).decrypt(ruta.read_bytes()).decode("utf-8"))


def respaldo():
    if configuracion.bd_host not in {"localhost", "127.0.0.1"} or configuracion.bd_nombre != "fym_pass":
        raise RuntimeError("El respaldo solo admite fym_pass en la base local.")
    ejecutable = shutil.which("mariadb-dump") or shutil.which("mysqldump") or "C:/xampp/mysql/bin/mysqldump.exe"
    credencial = carpeta / "respaldo_bd.local.json"
    if configuracion.produccion and not credencial.is_file():
        raise RuntimeError("Producción requiere respaldo_bd.local.json con una cuenta SQL de solo lectura.")
    if not credencial.is_file():
        credencial = carpeta / "administracion_bd.local.json"
    datos = json.loads(credencial.read_text()) if credencial.is_file() else {"usuario": "root", "clave": ""}
    if not (carpeta / "clave_respaldos.key").is_file():
        raise RuntimeError("Falta la clave de respaldos existente; no se genera una nueva durante el respaldo.")
    resultado = subprocess.run([ejecutable, "--host", configuracion.bd_host, "--port", str(configuracion.bd_puerto),
        "--user", datos["usuario"], "--single-transaction", "--no-tablespaces", "--hex-blob", configuracion.bd_nombre],
        env={**os.environ, "MYSQL_PWD": datos["clave"]}, capture_output=True, check=True)
    if len(resultado.stdout) < 100:
        raise RuntimeError("El respaldo está vacío.")
    cifrado = Fernet((carpeta / "clave_respaldos.key").read_bytes())
    destino = raiz / "archivos/respaldos" / ("seguro_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f") + ".sql.fernet")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(cifrado.encrypt(resultado.stdout))
    proteger(destino)
    if cifrado.decrypt(destino.read_bytes()) != resultado.stdout:
        raise RuntimeError("No se pudo verificar el respaldo cifrado.")
    print("Respaldo cifrado y verificado:", destino)
    return destino


def preparar():
    claves()
    with conexion_admin() as conexion:
        respaldo()
        with conexion.cursor() as cursor:
            cursor.execute("SELECT CURRENT_USER()")
            identidad = cursor.fetchone()[0]
            if identidad.startswith("root@") and not (carpeta / "administracion_bd.local.json").exists():
                nueva = secrets.token_urlsafe(32)
                guardar_privado(carpeta / "administracion_bd.local.json", json.dumps({"usuario": "root", "clave": nueva}))
                cursor.execute("SELECT Host FROM mysql.user WHERE User = 'root'")
                for (host,) in cursor.fetchall():
                    cursor.execute("ALTER USER %s@%s IDENTIFIED BY %s", ("root", host, nueva))
            archivo = carpeta / "migraciones_bd.local.json"
            if archivo.exists():
                migracion = json.loads(archivo.read_text())
            else:
                migracion = {"usuario": "fym_migracion", "clave": secrets.token_urlsafe(32)}
                guardar_privado(archivo, json.dumps(migracion))
            for host in ("localhost", "127.0.0.1"):
                cursor.execute("CREATE USER IF NOT EXISTS %s@%s IDENTIFIED BY %s", (migracion["usuario"], host, migracion["clave"]))
                cursor.execute("ALTER USER %s@%s IDENTIFIED BY %s", (migracion["usuario"], host, migracion["clave"]))
                cursor.execute("GRANT ALL PRIVILEGES ON fym_pass.* TO %s@%s", (migracion["usuario"], host))
                cursor.execute("REVOKE ALL PRIVILEGES, GRANT OPTION FROM %s@%s", (configuracion.bd_usuario, host))
                cursor.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON fym_pass.* TO %s@%s", (configuracion.bd_usuario, host))
    print("Cuenta operativa limitada; migraciones separadas; credenciales administrativas protegidas.")


def proteger_historicos():
    claves()
    cifrado = Fernet((carpeta / "clave_respaldos.key").read_bytes())
    proyecto = raiz.parent
    archivos = [proyecto / "README_CREDENCIALES.local.md",
        raiz / ".credenciales_beta.local.txt", raiz / ".credenciales_demo.local.txt",
        raiz / "archivos/accesos_iniciales_20261114.local.md"]
    archivos += list((raiz / "archivos/respaldos").rglob("*.sql"))
    archivos += list((raiz / "archivos/respaldos").rglob("*.local.md"))
    archivos += list((proyecto / "database").glob("*.sql*"))
    for archivo in archivos:
        if not archivo.is_file() or archivo.name.endswith(".fernet"):
            continue
        destino = archivo.with_name(archivo.name + ".fernet")
        original = archivo.read_bytes()
        if destino.exists():
            raise RuntimeError("Ya existe el archivo protegido: " + str(destino))
        destino.write_bytes(cifrado.encrypt(original))
        proteger(destino)
        if cifrado.decrypt(destino.read_bytes()) != original:
            raise RuntimeError("No se pudo verificar el archivo cifrado.")
        archivo.unlink()
    print("Listados y respaldos históricos protegidos; originales recuperables desde los archivos .fernet.")


def recuperar_admin(nombre):
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session
    from .database import motor
    from .models import Usuario
    from .modulos.acceso import proteccion
    if not nombre:
        raise RuntimeError("Indica --usuario con la cuenta administradora que recuperarás localmente.")
    datos = json.loads((carpeta / "administracion_bd.local.json").read_text())
    motor_admin = create_engine(motor.url.set(username=datos["usuario"], password=datos["clave"]))
    try:
        with Session(motor_admin) as base:
            usuario = base.scalar(select(Usuario).where(Usuario.nombre_usuario == nombre, Usuario.permiso == "administrador").with_for_update())
            if not usuario or not usuario.activo:
                raise RuntimeError("Cuenta administradora activa no encontrada.")
            clave = proteccion.temporal(base, usuario)
            proteccion.registrar(base, "recuperacion_administrativa_local", usuario, "Recuperación mediante la cuenta administrativa local de la base.")
            base.commit()
            print("Acceso temporal de 48 horas, mostrado una sola vez:", clave)
            print("El usuario deberá cambiar la contraseña antes de continuar.")
    finally:
        motor_admin.dispose()


def main():
    parser = ArgumentParser()
    parser.add_argument("accion", choices=["preparar", "respaldo", "proteger-historicos", "recuperar-admin", "claves", "mostrar-accesos"])
    parser.add_argument("--usuario")
    parser.add_argument("--archivo")
    datos = parser.parse_args()
    if datos.accion == "preparar":
        preparar()
    elif datos.accion == "claves":
        claves()
        print("Claves locales preparadas sin cambiar las existentes.")
    elif datos.accion == "mostrar-accesos":
        mostrar_accesos(datos.archivo)
    elif datos.accion == "proteger-historicos":
        proteger_historicos()
    elif datos.accion == "recuperar-admin":
        recuperar_admin(datos.usuario)
    else:
        respaldo()


if __name__ == "__main__":
    main()
