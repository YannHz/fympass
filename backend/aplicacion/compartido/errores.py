class ErrorAplicacion(Exception):
    def __init__(self, codigo, mensaje):
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje


class ConflictoPersistencia(Exception):
    pass


class FalloPersistencia(Exception):
    pass
