"""
main.py — Punto de entrada de la aplicación FastAPI de O.IR

Aquí se crea la instancia de la app, se configuran los middlewares
y se registran todos los routers de la aplicación.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings

# --- Creación de la aplicación FastAPI ---
app = FastAPI(
    title="O.IR API",
    description="API para detección de acordes y letra de canciones",
    version="0.1.0",
    # Solo mostrar la documentación en entorno de desarrollo
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
)

# --- Configuración de CORS ---
# Permite que el frontend (Next.js en local o cualquier despliegue en Vercel) se comunique sin bloqueos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )


# --- Registro de routers ---
# Cada router maneja un grupo de endpoints relacionados
from routes.songs import router as songs_router

app.include_router(songs_router, prefix="/api/songs", tags=["songs"])


@app.get("/", tags=["root"])
async def root():
    """Endpoint raíz para verificar que la API está corriendo."""
    return {
        "app": "O.IR API",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
async def health_check():
    """Verificación de salud del servidor."""
    import os
    import sys
    try:
        import yt_dlp.version
        yv = yt_dlp.version.__version__
    except Exception as e:
        yv = str(e)
    cookie_str = os.getenv("YOUTUBE_COOKIES", "")
    return {
        "status": "ok",
        "build": "110-cookie-opt",
        "python": sys.version,
        "yt_dlp": yv,
        "has_youtube_cookies": bool(cookie_str or os.getenv("YOUTUBE_COOKIE_PATH")),
        "cookie_length": len(cookie_str),
    }
