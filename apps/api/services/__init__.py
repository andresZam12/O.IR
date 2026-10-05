"""
services/__init__.py — Paquete de servicios

Contiene la lógica de negocio de la aplicación: detección de acordes,
obtención de letra, cálculo de dificultad, etc.
"""

from services.chord_service import ChordDetectionService
from services.lyrics_service import LyricsService

__all__ = ["ChordDetectionService", "LyricsService"]
