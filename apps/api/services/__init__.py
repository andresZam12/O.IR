"""
services/__init__.py — Paquete de servicios

Contiene la lógica de negocio de la aplicación: detección de acordes,
obtención de letra, cálculo de dificultad, etc.
"""

from services.chord_service import ChordDetectionService
from services.lyrics_service import LyricsService
from services.difficulty_service import DifficultyService
from services.audio_service import AudioService

__all__ = [
    "ChordDetectionService",
    "LyricsService",
    "DifficultyService",
    "AudioService",
]
