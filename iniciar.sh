#!/usr/bin/env bash
set -euo pipefail

raiz="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then
    echo "Falta Python 3. Revisa la preparación local del proyecto." >&2
    exit 1
fi
exec python3 -B -u - "$raiz" "$@" <<'PYTHON_FYM'
from pathlib import Path
import argparse
import ipaddress
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
from urllib.request import ProxyHandler, build_opener
import webbrowser


COMPROBAR_BACKEND = '''
import json
import sys
try:
    from aplicacion.main import aplicacion
    from aplicacion.database import motor
    from aplicacion.config import configuracion
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from alembic.runtime.migration import MigrationContext
    from sqlalchemy.exc import SQLAlchemyError
    try:
        if len(configuracion.clave_qr) < 32:
            raise ValueError("clave QR corta")
    except Exception:
        print(json.dumps({"estado": "seguridad"}))
        sys.exit(1)
    esperadas = set(ScriptDirectory.from_config(Config("alembic.ini")).get_heads())
    try:
        with motor.connect() as conexion:
            actuales = set(MigrationContext.configure(conexion).get_current_heads())
    except SQLAlchemyError:
        print(json.dumps({"estado": "base"}))
        sys.exit(1)
    print(json.dumps({"estado": "disponible" if actuales == esperadas else "migraciones",
                      "version": aplicacion.version, "revisiones": sorted(actuales)}))
    sys.exit(0 if actuales == esperadas else 1)
except ModuleNotFoundError as error:
    print(json.dumps({"estado": "dependencias", "modulo": error.name}))
    sys.exit(1)
except Exception:
    print(json.dumps({"estado": "configuracion"}))
    sys.exit(1)
'''


def detectar_direccion_local():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as conexion:
            # consulta la ruta local sin enviar datos a la red
            conexion.connect(('192.0.2.1', 9))
            return conexion.getsockname()[0]
    except OSError:
        raise SystemExit('No se pudo detectar la IP. Conecta la PC a la red o usa --red IP_PC.')


def comprobar_puerto(direccion, puerto):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as conexion:
            conexion.bind((direccion, puerto))
    except OSError as error:
        raise RuntimeError(f'No se puede usar {direccion}:{puerto}. Comprueba la IP y si hay otra instancia activa.') from error


def comprobar_backend(python, raiz):
    try:
        respuesta = subprocess.run([str(python), '-B', '-c', COMPROBAR_BACKEND], cwd=raiz / 'backend',
                                   capture_output=True, text=True, timeout=20)
        datos = json.loads(respuesta.stdout)
    except subprocess.TimeoutExpired:
        raise RuntimeError('La base no respondió a tiempo. Comprueba MySQL y backend/.env.')
    except (OSError, ValueError):
        raise RuntimeError('No se pudo comprobar el backend. Revisa su entorno virtual y configuración.')
    estado = datos.get('estado')
    if respuesta.returncode or estado != 'disponible':
        mensajes = {
            'base': 'No se puede acceder a MySQL. Inicia su servicio y revisa backend/.env.',
            'migraciones': 'La base no tiene las migraciones actuales. Aplica alembic upgrade head con la cuenta de migraciones (FYM_MIGRACION=1); consulta el README.',
            'dependencias': 'Faltan dependencias del backend. Instala backend/requirements.lock en su entorno virtual.',
            'configuracion': 'No se pudo cargar el backend. Revisa backend/.env y su configuración.',
            'seguridad': 'Faltan claves de seguridad válidas. Revisa CLAVE_QR según el README. El lanzador no crea ni reemplaza claves.',
        }
        raise RuntimeError(mensajes.get(estado, 'No se pudo comprobar el backend.'))
    return datos


def comprobar_compilacion(raiz):
    salida = raiz / 'web/dist'
    if not all((salida / nombre).is_file() for nombre in ('index.html', 'manifest.webmanifest', 'service-worker.js')):
        raise RuntimeError('No hay una compilación completa. Inicia sin --sin-compilar para generarla.')
    pagina = (salida / 'index.html').read_text(encoding='utf-8')
    recursos = re.findall(r'(?:src|href)="(/assets/[^"?#]+)', pagina)
    if not recursos or any(not (salida / recurso.lstrip('/')).is_file() for recurso in recursos):
        raise RuntimeError('Faltan recursos de la compilación. Inicia sin --sin-compilar para regenerarla.')
    fuentes = [raiz / 'web/src', raiz / 'web/public']
    archivos = [raiz / 'web' / nombre for nombre in ('index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'pwa.ts', 'service-worker.js')]
    for carpeta in fuentes:
        archivos.extend(ruta for ruta in carpeta.rglob('*') if ruta.is_file())
    if any(ruta.stat().st_mtime > (salida / 'index.html').stat().st_mtime for ruta in archivos if ruta.exists()):
        raise RuntimeError('La compilación es anterior a los cambios del código. Inicia sin --sin-compilar.')


def esperar_servicios(procesos, direccion, puerto, version, python, raiz):
    cliente = build_opener(ProxyHandler({}))
    limite = time.monotonic() + 45
    while time.monotonic() < limite:
        if any(proceso.poll() is not None for proceso in procesos):
            raise RuntimeError('Un servicio no pudo iniciar. Revisa .registros/backend.log y .registros/web.log.')
        try:
            with cliente.open('http://127.0.0.1:8000/api/salud', timeout=2) as respuesta:
                directa = json.load(respuesta)
            with cliente.open(f'http://{direccion}:{puerto}/api/salud', timeout=2) as respuesta:
                api = json.load(respuesta)
            with cliente.open(f'http://{direccion}:{puerto}/', timeout=2) as respuesta:
                pagina = respuesta.read().decode('utf-8')
            if directa.get('estado') == api.get('estado') == 'disponible' and directa.get('version') == api.get('version') == version and 'id="root"' in pagina:
                comprobar_backend(python, raiz)
                return
        except (OSError, ValueError):
            pass
        time.sleep(.3)
    raise RuntimeError('No se completó el inicio. Comprueba MySQL, el proxy de la web y los registros en .registros/.')


def detener_procesos(procesos):
    for proceso in procesos:
        if proceso.poll() is None:
            try:
                os.killpg(proceso.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
    for proceso in procesos:
        try:
            proceso.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proceso.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            proceso.wait()


def iniciar():
    raiz = Path(sys.argv.pop(1)).resolve()
    analizador = argparse.ArgumentParser(prog='iniciar.sh', description='Inicia FyM Pass compilado y su API local. MySQL debe estar activo. Ctrl+C detiene los procesos iniciados por este script.',
                                        epilog='Ejemplos: ./iniciar.sh | ./iniciar.sh --desarrollo | ./iniciar.sh --sin-compilar --sin-navegador | ./iniciar.sh --red auto')
    modos = analizador.add_mutually_exclusive_group()
    modos.add_argument('--desarrollo', action='store_true', help='Usar Vite con actualización del código en el puerto 5173; no activa la PWA')
    modos.add_argument('--sin-compilar', action='store_true', help='Reutilizar web/dist si está completo y actualizado')
    analizador.add_argument('--red', metavar='IP_PC', help='Publicar la web en una IPv4 privada de esta PC, o auto; la API sigue en localhost')
    analizador.add_argument('--sin-navegador', action='store_true', help='No abrir el navegador al iniciar')
    opciones = analizador.parse_args()
    if os.name != 'posix':
        analizador.error('Este lanzador requiere Linux/macOS con Bash y Python 3. En Windows usa los comandos del README.')
    if opciones.desarrollo and opciones.red:
        analizador.error('El desarrollo se mantiene en localhost. Para red utiliza la web compilada sin --desarrollo.')
    direccion = '127.0.0.1'
    if opciones.red:
        try:
            ip = ipaddress.IPv4Address(detectar_direccion_local() if opciones.red == 'auto' else opciones.red)
        except ipaddress.AddressValueError:
            analizador.error('Usa una IPv4 válida de esta PC en la red local.')
        if not ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_multicast:
            analizador.error('Usa la IPv4 privada de esta PC en la red local.')
        direccion = str(ip)
    python = raiz / 'backend/.venv/bin/python'
    node = shutil.which('node')
    vite = raiz / 'web/node_modules/vite/bin/vite.js'
    tsc = raiz / 'web/node_modules/typescript/bin/tsc'
    faltantes = []
    if not python.is_file():
        faltantes.append('el entorno virtual backend/.venv')
    if not node:
        faltantes.append('Node.js en PATH')
    if not vite.is_file() or not tsc.is_file():
        faltantes.append('las dependencias web (npm --prefix web ci)')
    if not (raiz / 'backend/.env').is_file():
        faltantes.append('backend/.env configurado para MySQL')
    if faltantes:
        analizador.error('Falta: ' + '; '.join(faltantes) + '.')
    entorno = os.environ.copy()
    entorno['FYM_API_URL'] = 'http://127.0.0.1:8000'
    entorno['PYTHONDONTWRITEBYTECODE'] = '1'
    registros = raiz / '.registros'
    registros.mkdir(exist_ok=True)
    puerto = 5173 if opciones.desarrollo else 4173
    procesos, archivos = [], []
    try:
        comprobar_puerto('127.0.0.1', 8000)
        comprobar_puerto(direccion, puerto)
        datos = comprobar_backend(python, raiz)
        version = json.loads((raiz / 'web/package.json').read_text(encoding='utf-8'))['version']
        if datos['version'] != version:
            raise RuntimeError('Las versiones del frontend y backend no coinciden. Revisa la instalación antes de iniciar.')
        print(f'FyM Pass {version} · {"desarrollo" if opciones.desarrollo else "web compilada"}', flush=True)
        print('Base disponible y migraciones al día.', flush=True)
        if not opciones.desarrollo:
            if opciones.sin_compilar:
                comprobar_compilacion(raiz)
            else:
                print('Comprobando TypeScript y compilando la web…', flush=True)
                with (registros / 'compilacion.log').open('w', encoding='utf-8') as salida:
                    for comando in ([node, str(tsc)], [node, str(vite), 'build']):
                        proceso = subprocess.Popen(comando, cwd=raiz / 'web', env=entorno, stdout=salida, stderr=salida,
                                                   stdin=subprocess.DEVNULL, start_new_session=True)
                        procesos.append(proceso)
                        if proceso.wait() != 0:
                            raise RuntimeError('La compilación falló. Revisa .registros/compilacion.log. No se inició la aplicación.')
                comprobar_compilacion(raiz)
        servicios = [
            ('backend', raiz / 'backend', [str(python), '-B', '-m', 'uvicorn', 'aplicacion.main:aplicacion', '--host', '127.0.0.1', '--port', '8000']),
            ('web', raiz / 'web', [node, str(vite), *([] if opciones.desarrollo else ['preview']), '--host', direccion, '--port', str(puerto), '--strictPort']),
        ]
        for nombre, carpeta, comando in servicios:
            salida = (registros / f'{nombre}.log').open('a', encoding='utf-8')
            archivos.append(salida)
            procesos.append(subprocess.Popen(comando, cwd=carpeta, env=entorno, stdout=salida, stderr=salida,
                                             stdin=subprocess.DEVNULL, start_new_session=True))
        activos = procesos[-2:]
        esperar_servicios(activos, direccion, puerto, version, python, raiz)
        url = f'http://{direccion}:{puerto}'
        print(f'Web: {url}')
        print('API local: http://127.0.0.1:8000/docs')
        if opciones.red:
            print('Acceso HTTP en la red local. La cámara y la instalación en teléfonos requieren HTTPS.')
        elif not opciones.desarrollo:
            print('Para un túnel HTTPS usa esta dirección como destino: http://127.0.0.1:4173')
        print('Mantén esta terminal abierta. Ctrl+C detiene API y web; MySQL permanece activo.')
        if not opciones.sin_navegador:
            try:
                webbrowser.open(url)
            except webbrowser.Error:
                print('No se pudo abrir el navegador. Abre la dirección web manualmente.')
        while all(proceso.poll() is None for proceso in activos):
            time.sleep(.5)
        raise RuntimeError('Un servicio se detuvo. Revisa los archivos de .registros/.')
    except KeyboardInterrupt:
        print('\nDeteniendo FyM Pass…')
    except (RuntimeError, OSError) as problema:
        raise SystemExit(str(problema))
    finally:
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        detener_procesos(procesos)
        for archivo in archivos:
            archivo.close()


def detener(senal, marco):
    raise KeyboardInterrupt


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, detener)
    iniciar()

PYTHON_FYM
