import ipaddress
from ...version import VERSION
from ...compartido.errores import FalloPersistencia


def direccion_movil(servidor):
    if not servidor:
        return None
    host, puerto = servidor
    try:
        ip = ipaddress.IPv4Address(host)
    except ipaddress.AddressValueError:
        return None
    if (
        not ip.is_private
        or ip.is_loopback
        or ip.is_unspecified
        or ip.is_link_local
        or ip.is_multicast
    ):
        return None
    return f"http://{ip}:{puerto}"


def consultar_salud():
    return {"estado": "disponible", "aplicacion": "FyM Pass", "version": VERSION}


def consultar_base_datos(repositorio):
    try:
        version = repositorio.version_base()
        return {
            "estado": "disponible",
            "motor": "MariaDB" if "mariadb" in version.lower() else "MySQL",
            "version": version,
        }
    except FalloPersistencia:
        return {
            "estado": "sin conexion",
            "mensaje": "Revisa el servicio de XAMPP y la configuracion local del backend.",
        }


def consultar_conexion(servidor):
    direccion = direccion_movil(servidor)
    return {
        "direccion_movil": direccion,
        "modo": "red" if direccion else "local",
        "mensaje": (
            "Conecta el teléfono a la misma red y configura esta dirección en Flutter."
            if direccion
            else "Para conectar Flutter por Wi-Fi, reinicia el sistema con --red auto o --red IP_PC."
        ),
    }
