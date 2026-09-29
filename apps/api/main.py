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
# Permite que el frontend (Next.js) se comunique con esta API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Registro de routers ---
# Cada router maneja un grupo de endpoints relacionados
# Se agregarán a medida que avance el desarrollo
# from routes import songs, health
# app.include_router(health.router, prefix="/health", tags=["health"])
# app.include_router(songs.router, prefix="/api/songs", tags=["songs"])


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
    return {"status": "ok"}
