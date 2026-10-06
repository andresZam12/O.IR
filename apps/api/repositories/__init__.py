"""
repositories/__init__.py — Paquete de repositorios

Implementa el patrón Repository: cada clase aquí es responsable
de comunicarse con la base de datos. La lógica de negocio (services)
no habla directamente con la BD, sino a través de estos repositorios.
"""

from repositories.song_repository import SongRepository

__all__ = ["SongRepository"]
