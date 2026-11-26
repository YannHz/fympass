from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from ...models import AsignacionHorario, obtener_hora_utc
from ...compartido.errores import ErrorAplicacion


def hoy_sede(repositorio, sede_id):
    return obtener_hora_utc().replace(tzinfo=timezone.utc).astimezone(
        ZoneInfo(repositorio.obtener_sede(sede_id).zona_horaria)).date()


def validar_fecha(repositorio, sede_id, fecha):
    hoy = hoy_sede(repositorio, sede_id)
    if fecha < hoy or fecha > hoy + timedelta(days=366):
        raise ErrorAplicacion(422, "Elige una fecha desde hoy y dentro del próximo año.")


def asignar_desde(repositorio, persona, horario_id, fecha):
    validar_fecha(repositorio, persona.sede_id, fecha)
    asignaciones = repositorio.asignaciones_desde(fecha, persona)
    if len(asignaciones) == 1:
        actual = asignaciones[0]
        if actual.horario_id == horario_id and actual.vigente_desde <= fecha and actual.vigente_hasta is None:
            return False
    zona = ZoneInfo(repositorio.obtener_sede(persona.sede_id).zona_horaria)
    inicio = datetime.combine(fecha, datetime.min.time(), zona).astimezone(timezone.utc).replace(tzinfo=None)
    fin = inicio + timedelta(days=1)
    if repositorio.marcados_de_persona(fin, inicio, persona):
        raise ErrorAplicacion(409, f"{persona.nombres} ya tiene marcados en esa fecha. Aplica el cambio desde el día siguiente.")
    for actual in asignaciones:
        if actual.vigente_desde >= fecha:
            repositorio.eliminar(actual)
        else:
            actual.vigente_hasta = fecha - timedelta(days=1)
    repositorio.sincronizar()
    if horario_id:
        repositorio.agregar(AsignacionHorario(persona_id=persona.id, horario_id=horario_id, vigente_desde=fecha))
    return True
