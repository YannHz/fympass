import base64
import hashlib
import hmac
import secrets
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError

hasheador = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1)


def generar_hash_clave(clave: str) -> str:
    return hasheador.hash(clave)


def verificar_clave(clave: str, valor: str) -> bool:
    if valor.startswith("$argon2id$"):
        try:
            return hasheador.verify(valor, clave)
        except (VerificationError, InvalidHashError):
            return False
    try:
        algoritmo, sal, esperado = valor.split("$")
        if algoritmo != "scrypt":
            return False
        resumen = hashlib.scrypt(clave.encode(), salt=base64.b64decode(sal), n=16384, r=8, p=1)
        return hmac.compare_digest(resumen, base64.b64decode(esperado))
    except (ValueError, TypeError):
        return False


def resumir_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def requiere_actualizar_hash(valor):
    return not valor.startswith("$argon2id$") or hasheador.check_needs_rehash(valor)


def validar_clave_personal(clave, usuario="", nombres="", apellidos=""):
    from .compartido.errores import ErrorAplicacion
    import unicodedata
    import re
    if not 8 <= len(clave) <= 256 or not clave.strip():
        raise ErrorAplicacion(422, "Usa entre 8 y 256 caracteres. Puedes escribir una frase con espacios.")
    normalizada = "".join(c for c in unicodedata.normalize("NFKD", clave.casefold()) if not unicodedata.combining(c))
    compacta = "".join(c for c in normalizada if c.isalnum())
    comunes = {"password", "contrasena", "contraseña", "qwerty", "123456789", "administrador", "bienvenido", "finneymiller", "fympass", "letmein"}
    relacionadas = [usuario.casefold(), *nombres.casefold().split(), *apellidos.casefold().split()]
    if len(set(compacta)) < 4 or re.fullmatch(r"(.{1,4})\1{2,}", compacta) or any(p in compacta for p in comunes) or any(
        len(p) >= 4 and "".join(c for c in unicodedata.normalize("NFKD", p) if not unicodedata.combining(c)) in compacta for p in relacionadas
    ) or compacta.isdigit():
        raise ErrorAplicacion(422, "Elige una frase menos predecible, sin tu usuario, nombres, apellidos ni contraseñas comunes.")
