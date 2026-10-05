"""
schemas/__init__.py — Paquete de schemas Pydantic

Define los modelos de datos que entran y salen de la API (DTOs).
Pydantic valida automáticamente los tipos y genera la documentación OpenAPI.
"""

from schemas.song import (
    ChordItem,
    ChordDetectionResult,
    SongProcessRequest,
    SongJobResponse,
    SongJobStatus,
)
from schemas.lyrics import (
    LyricLine,
    LyricsResult,
)

__all__ = [
    "ChordItem",
    "ChordDetectionResult",
    "SongProcessRequest",
    "SongJobResponse",
    "SongJobStatus",
    "LyricLine",
    "LyricsResult",
]
