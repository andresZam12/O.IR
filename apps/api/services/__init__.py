"""
services/__init__.py — Paquete de servicios

Contiene la lógica de negocio de la aplicación: detección de acordes,
obtención de letra, cálculo de dificultad, etc.
"""

from services.chord_service import ChordDetectionService

__all__ = ["ChordDetectionService"]
