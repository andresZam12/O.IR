"""
schemas/transposition.py — DTOs para la transposición de acordes y cálculo de cejilla (Capo)
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class TransposeRequest(BaseModel):
    """Solicitud para transponer una lista de acordes un número de semitonos."""

    chords: List[str] = Field(..., description="Lista de acordes a transponer (ej. ['C', 'G', 'Am', 'F'])")
    semitones: int = Field(..., ge=-11, le=11, description="Número de semitonos a transponer (-11 a +11)")


class CapoRecommendation(BaseModel):
    """Sugerencia didáctica de posición de Capo para facilitar acordes a principiantes."""

    fret: int = Field(..., description="Traste sugerido para el Capo (1 al 7)")
    transposed_shapes: List[str] = Field(..., description="Formas de acorde abiertas y fáciles de tocar con ese Capo")
    difficulty_reduction: int = Field(..., description="Porcentaje estimado de reducción de dificultad")
    explanation: str = Field(..., description="Explicación pedagógica para el músico principiante")


class TransposeResponse(BaseModel):
    """Resultado de la transposición y sugerencia de Capo."""

    semitones: int
    original_chords: List[str]
    transposed_chords: List[str]
    capo_suggestion: Optional[CapoRecommendation] = None
