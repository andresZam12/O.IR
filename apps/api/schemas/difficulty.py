"""
schemas/difficulty.py — Esquemas Pydantic para el cálculo de dificultad y consejos de práctica
"""

from typing import Optional
from pydantic import BaseModel, Field


class DifficultyMetrics(BaseModel):
    """Métricas cuantitativas y objetivas de la canción."""

    score: float = Field(
        ...,
        description="Puntaje de dificultad en escala de 1.0 (muy fácil) a 10.0 (muy difícil)",
        ge=1.0,
        le=10.0,
        examples=[3.5],
    )
    level: str = Field(
        ...,
        description="Categoría cualitativa: Principiante, Intermedio, Avanzado",
        examples=["Principiante"],
    )
    unique_chord_count: int = Field(
        ...,
        description="Cantidad total de acordes distintos que aparecen en la canción",
        ge=0,
        examples=[4],
    )
    barre_chord_count: int = Field(
        ...,
        description="Cantidad de acordes con cejilla (barre chords) detectados",
        ge=0,
        examples=[0],
    )
    barre_chords_present: list[str] = Field(
        default_factory=list,
        description="Nombres de los acordes con cejilla identificados",
        examples=[["F", "Bm"]],
    )
    changes_per_minute: float = Field(
        ...,
        description="Promedio de cambios de acorde por minuto (CPM)",
        ge=0.0,
        examples=[18.5],
    )
    tempo_bpm: Optional[float] = Field(
        default=None,
        description="Tempo estimado en pulsos por minuto (BPM)",
        examples=[120.0],
    )


class DifficultyEvaluation(BaseModel):
    """Evaluación completa de dificultad con explicación en lenguaje sencillo y tips."""

    metrics: DifficultyMetrics
    explanation: str = Field(
        ...,
        description="Explicación pedagógica en lenguaje simple sobre el porqué de la dificultad",
        examples=[
            "Esta canción es ideal para principiantes: solo usa 4 acordes abiertos y el ritmo de cambio es cómodo."
        ],
    )
    practice_tips: list[str] = Field(
        default_factory=list,
        description="Consejos concretos de práctica instrumental adaptados a las dificultades detectadas",
        examples=[
            "Empieza practicando el cambio entre C y G sin pausar la mano derecha.",
            "Utiliza un metrónomo a velocidad lenta antes de tocar sobre la canción original."
        ],
    )
