from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from contextlib import asynccontextmanager
import logging
from .version import VERSION
from .config import configuracion
from .compartido.errores import ErrorAplicacion, ConflictoPersistencia
from pathlib import Path
from .modulos.acceso.rutas import rutas
from .modulos.acceso.rutas_seguridad import rutas_seguridad
from .modulos.asistencia.rutas import rutas_asistencia
from .modulos.gestion.rutas import rutas_gestion
from .modulos.diagnostico.rutas import rutas_salud, rutas_diagnostico

avisos_registro = logging.getLogger("fym")


@asynccontextmanager
async def vigilar_configuracion(aplicacion_en_uso):
    if configuracion.produccion:
        if len(configuracion.clave_qr) < 32 or not configuracion.cookie_segura or not configuracion.bd_clave:
            raise RuntimeError("Producción requiere CLAVE_QR, COOKIE_SEGURA=true y BD_CLAVE.")
    # avisa al arrancar sobre configuracion debil antes del despliegue
    if len(configuracion.clave_qr) < 32:
        avisos_registro.warning(
            "CLAVE_QR ausente o corta: los codigos QR no se validarán hasta configurar una clave de 32 caracteres o más."
        )
    if not configuracion.cookie_segura:
        avisos_registro.warning(
            "COOKIE_SEGURA=false: da la cookie sin Secure. Definela antes de servir por HTTPS en producción."
        )
    yield


aplicacion = FastAPI(
    title="FyM Pass",
    description="API de asistencia institucional",
    version=VERSION,
    lifespan=vigilar_configuracion,
    docs_url=None if configuracion.produccion else "/docs",
    redoc_url=None if configuracion.produccion else "/redoc",
    openapi_url=None if configuracion.produccion else "/openapi.json",
)
for enrutador in (
    rutas_salud,
    rutas,
    rutas_seguridad,
    rutas_asistencia,
    rutas_gestion,
    rutas_diagnostico,
):
    aplicacion.include_router(enrutador)


@aplicacion.middleware("http")
async def encabezados_seguridad(request, siguiente):
    respuesta = await siguiente(request)
    if request.url.path.startswith("/api/"):
        respuesta.headers["Cache-Control"] = "no-store"
    respuesta.headers.setdefault("X-Content-Type-Options", "nosniff")
    respuesta.headers.setdefault("X-Frame-Options", "DENY")
    respuesta.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if configuracion.cookie_segura:
        respuesta.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000"
        )
    return respuesta


@aplicacion.exception_handler(ErrorAplicacion)
async def manejar_error_aplicacion(request, error):
    return JSONResponse(status_code=error.codigo, content={"detail": error.mensaje})


@aplicacion.exception_handler(SQLAlchemyError)
@aplicacion.exception_handler(ConflictoPersistencia)
async def manejar_error_base_datos(request, error):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "No se pudo guardar o consultar el registro. Revisa la conexión con la base de datos."
        },
    )


CARPETA_FOTOS = Path(__file__).resolve().parents[1] / "archivos/fotos"
CARPETA_FOTOS.mkdir(parents=True, exist_ok=True)
from .compartido.dependencias import obtener_usuario, obtener_base_datos
from .models import Persona
from sqlalchemy import select


@aplicacion.get("/api/fotos/{nombre}")
def consultar_foto(nombre: str, usuario=Depends(obtener_usuario), base: Session = Depends(obtener_base_datos)):
    if Path(nombre).name != nombre:
        raise HTTPException(404, "Archivo no disponible.")
    propia = base.get(Persona, usuario.persona_id)
    personas = base.scalars(select(Persona).where(Persona.sede_id == propia.sede_id)).all() if usuario.permiso in ("administrador", "operador") else [propia]
    permitida = any(p.foto_ruta and Path(p.foto_ruta).name == nombre for p in personas)
    archivo = (CARPETA_FOTOS / nombre).resolve()
    if not permitida or archivo.parent != CARPETA_FOTOS.resolve() or not archivo.is_file():
        raise HTTPException(404, "Archivo no disponible.")
    return FileResponse(archivo, headers={"Cache-Control": "no-store"})
