import hashlib
import hmac
from ..config import configuracion
from .errores import ErrorAplicacion


def firmar(valor: str):
    if len(configuracion.clave_qr) < 32:
        raise ErrorAplicacion(503, "Falta configurar la clave QR del servidor.")
    return hmac.new(
        configuracion.clave_qr.encode(), valor.encode(), hashlib.sha256
    ).hexdigest()


def validar_firma(contenido: str, prefijo: str):
    partes = contenido.split(":")
    if len(partes) != 5 or partes[:2] != ["fym", prefijo]:
        raise ErrorAplicacion(422, "Este QR no corresponde a la modalidad elegida.")
    if not hmac.compare_digest(firmar(":".join(partes[:-1])), partes[-1]):
        raise ErrorAplicacion(422, "El QR no es válido.")
    return partes
