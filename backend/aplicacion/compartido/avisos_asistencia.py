import asyncio
from threading import Lock
from uuid import uuid4


_cerrojo = Lock()
_versiones = {}
_esperas = {}
_inicio = uuid4().hex


def notificar_marcado(sede_id):
    with _cerrojo:
        _versiones[sede_id] = _versiones.get(sede_id, 0) + 1
        esperas = list(_esperas.get(sede_id, ()))
    for bucle, aviso in esperas:
        try:
            bucle.call_soon_threadsafe(despertar, aviso)
        except RuntimeError:
            pass


def despertar(aviso):
    if not aviso.done():
        aviso.set_result(None)


async def esperar_marcado(sede_id, version):
    bucle = asyncio.get_running_loop()
    aviso = bucle.create_future()
    espera = (bucle, aviso)
    with _cerrojo:
        actual = f"{_inicio}:{_versiones.get(sede_id, 0)}"
        if actual != version:
            return {"version": actual}
        _esperas.setdefault(sede_id, set()).add(espera)
    try:
        await asyncio.wait_for(aviso, timeout=20)
    except asyncio.TimeoutError:
        pass
    finally:
        with _cerrojo:
            _esperas[sede_id].discard(espera)
    with _cerrojo:
        return {"version": f"{_inicio}:{_versiones.get(sede_id, 0)}"}
