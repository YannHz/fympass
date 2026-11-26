import unicodedata
from .errores import ErrorAplicacion


def normalizar_nombre(valor):
    return "".join(letra for letra in unicodedata.normalize("NFKD", valor.lower())
                   if letra.isascii() and letra.isalpha())


def clave_inicial_persona(nombres, apellidos):
    primeros = nombres.split()
    nombre = normalizar_nombre(primeros[0]) if primeros else ""
    partes = [normalizar_nombre(parte) for parte in apellidos.split()]
    if not nombre or not partes or not all(partes):
        raise ErrorAplicacion(422, "Revisa los nombres y apellidos para generar la cuenta.")
    return nombre + "".join(parte[0] for parte in partes)


def credenciales_iniciales(nombres, apellidos, disponible):
    clave = clave_inicial_persona(nombres, apellidos)
    nombre = normalizar_nombre(nombres.split()[0])
    partes = [normalizar_nombre(parte) for parte in apellidos.split()]
    raiz = nombre[0] + partes[0]
    candidatos = [raiz + "fym"]
    if len(partes) > 1:
        candidatos.append(raiz + "".join(parte[0] for parte in partes[1:]) + "fym")
    for candidato in candidatos:
        if len(candidato) <= 80 and disponible(candidato):
            return candidato, clave
    raise ErrorAplicacion(409, "Ya existe una cuenta con estas iniciales y apellidos. Revisa los datos con administración.")
