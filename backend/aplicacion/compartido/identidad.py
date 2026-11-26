def iniciales_persona(persona):
    nombre = persona.nombres.strip()[:1]
    apellido = persona.apellidos.strip()[:1]
    return (nombre + apellido).upper()
