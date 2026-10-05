"""
routes/__init__.py — Paquete de routers

Contiene todos los endpoints de la API agrupados por funcionalidad.
Cada archivo define un APIRouter de FastAPI.
"""

from routes.songs import router as songs_router

__all__ = ["songs_router"]
