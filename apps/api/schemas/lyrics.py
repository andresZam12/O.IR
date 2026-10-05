"""
schemas/lyrics.py — Esquemas Pydantic para el manejo de letras sincronizadas
"""

from typing import Optional
from pydantic import BaseModel, Field


class LyricLine(BaseModel):
    """Representa una línea de letra con su marca de tiempo para vista karaoke."""

    time: float = Field(
        ...,
        description="Marca de tiempo en segundos en la que inicia la línea",
        ge=0.0,
        examples=[12.5],
    )
    text: str = Field(
        ...,
        description="Texto correspondiente a la línea de la canción",
        examples=["De música ligera nada nos libra"],
    )
    chord: Optional[str] = Field(
        default=None,
        description="Acorde activo en el momento que inicia la línea (si está alineado)",
        examples=["Bm"],
    )


class LyricsResult(BaseModel):
    """Resultado de la obtención y sincronización de la letra de la canción."""

    is_synced: bool = Field(
        default=False,
        description="Indica si la letra cuenta con marcas de tiempo sincronizadas",
        examples=[True],
    )
    source: str = Field(
        ...,
        description="Origen de la letra: 'lrclib', 'whisper' o 'not_found'",
        examples=["lrclib"],
    )
    lines: list[LyricLine] = Field(
        default_factory=list,
        description="Líneas de la letra ordenadas cronológicamente",
    )
    plain_lyrics: Optional[str] = Field(
        default=None,
        description="Texto completo de la letra en formato plano",
    )
    title: Optional[str] = Field(
        default=None,
        description="Título de la canción según el proveedor de letras",
        examples=["De Música Ligera"],
    )
    artist: Optional[str] = Field(
        default=None,
        description="Artista o banda según el proveedor de letras",
        examples=["Soda Stereo"],
    )
