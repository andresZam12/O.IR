"""
schemas/song.py — Esquemas Pydantic para el procesamiento y detección de acordes

Define los DTOs (Data Transfer Objects) para las peticiones y respuestas
del servicio de canciones, detección de acordes y estado de los trabajos de Celery.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field, HttpUrl


class ChordItem(BaseModel):
    """Representa un acorde detectado en un instante de tiempo."""

    time: float = Field(
        ...,
        description="Marca de tiempo en segundos en la que inicia o cambia el acorde",
        ge=0.0,
        examples=[14.25],
    )
    chord: str = Field(
        ...,
        description="Nombre del acorde detectado (ej. 'C', 'Am', 'G#m', 'N/C')",
        examples=["Am"],
    )
    confidence: float = Field(
        ...,
        description="Nivel de confianza de la predicción (0.0 a 1.0)",
        ge=0.0,
        le=1.0,
        examples=[0.875],
    )


class ChordDetectionResult(BaseModel):
    """Resultado completo de la detección de acordes de un audio."""

    duration: float = Field(
        ...,
        description="Duración total del archivo de audio analizado en segundos",
        ge=0.0,
        examples=[184.5],
    )
    chords: list[ChordItem] = Field(
        default_factory=list,
        description="Secuencia temporal de cambios de acordes",
    )
    unique_chords: list[str] = Field(
        default_factory=list,
        description="Lista de acordes únicos detectados en la canción",
        examples=[["Am", "C", "F", "G"]],
    )
    total_changes: int = Field(
        ...,
        description="Cantidad total de transiciones de acordes en la canción",
        ge=0,
        examples=[42],
    )
    estimated_key: Optional[str] = Field(
        default=None,
        description="Tonalidad estimada de la canción (ej. 'C Major', 'A Minor')",
        examples=["C Major"],
    )


class SongProcessRequest(BaseModel):
    """Petición para iniciar el procesamiento de una canción."""

    source: Literal["youtube", "upload", "microphone"] = Field(
        ...,
        description="Fuente del audio a procesar",
        examples=["youtube"],
    )
    youtube_url: Optional[str] = Field(
        default=None,
        description="URL del video de YouTube (requerido si source es 'youtube')",
        examples=["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    )


class SongJobResponse(BaseModel):
    """Respuesta inicial al encolar una tarea en Celery."""

    job_id: str = Field(
        ...,
        description="Identificador único de la tarea asíncrona en Celery",
        examples=["c9b3a4e1-7d12-4f80-87a3-1994e6bdf631"],
    )
    status: str = Field(
        default="PENDING",
        description="Estado inicial del trabajo",
        examples=["PENDING"],
    )
    message: str = Field(
        ...,
        description="Mensaje informativo para el cliente",
        examples=["Canción encolada para procesamiento"],
    )


class SongJobStatus(BaseModel):
    """Consulta del estado actual de procesamiento de una tarea."""

    job_id: str = Field(
        ...,
        description="Identificador único de la tarea",
    )
    status: str = Field(
        ...,
        description="Estado actual de Celery: PENDING, STARTED, SUCCESS, FAILURE, RETRY",
        examples=["STARTED"],
    )
    progress: int = Field(
        default=0,
        description="Porcentaje aproximado de avance (0 a 100)",
        ge=0,
        le=100,
        examples=[45],
    )
    step: Optional[str] = Field(
        default=None,
        description="Etapa actual del procesamiento (ej. 'descargando', 'detectando_acordes')",
        examples=["detectando_acordes"],
    )
    result: Optional[dict] = Field(
        default=None,
        description="Resultado final cuando la tarea culmina exitosamente",
    )
    error: Optional[str] = Field(
        default=None,
        description="Mensaje de error en caso de fallo",
    )
