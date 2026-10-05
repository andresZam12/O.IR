"""
workers/song_worker.py — Tareas asíncronas para el procesamiento de canciones

Este módulo define las tareas de Celery que se ejecutan en segundo plano.
Cuando el usuario envía una canción, la API crea una tarea aquí y devuelve
inmediatamente un job_id. El frontend hace polling al endpoint de estado
hasta que la tarea termina.
"""

import asyncio
import os
from typing import Optional

from core.celery_app import celery_app
from services.chord_service import ChordDetectionService
from services.lyrics_service import LyricsService


@celery_app.task(bind=True, name="process_song")
def process_song(
    self,
    audio_path: str,
    source: str,
    track_name: Optional[str] = None,
    artist_name: Optional[str] = None,
) -> dict:
    """
    Tarea principal: procesa un archivo de audio y extrae acordes + letra.

    Args:
        audio_path: Ruta local al archivo de audio ya descargado/subido.
        source: Origen del audio ('youtube', 'upload', 'microphone').
        track_name: Título opcional de la canción para buscar letra en LRCLIB.
        artist_name: Nombre opcional del artista.

    Returns:
        Diccionario con acordes, letra sincronizada, tonalidad y dificultad.
    """

    # --- 1. Inicialización ---
    self.update_state(state="STARTED", meta={"progress": 10, "step": "iniciando"})

    # --- 2. Detección de acordes con librosa ---
    self.update_state(
        state="STARTED",
        meta={"progress": 30, "step": "detectando_acordes"}
    )
    chord_service = ChordDetectionService()
    chord_result = chord_service.detect_chords_from_file(audio_path)

    # --- 3. Obtención y sincronización de letra con LRCLIB ---
    self.update_state(
        state="STARTED",
        meta={"progress": 65, "step": "sincronizando_letras"}
    )

    lyrics_service = LyricsService()
    # Si no se pasó track_name, inferir del nombre del archivo
    effective_title = track_name or os.path.splitext(os.path.basename(audio_path))[0]

    lyrics_result = asyncio.run(
        lyrics_service.fetch_lyrics_lrclib(
            track_name=effective_title,
            artist_name=artist_name,
            duration=chord_result.duration,
        )
    )

    # Alinear acordes sobre cada línea de la letra para la vista karaoke
    aligned_lyrics = lyrics_service.align_chords_with_lyrics(
        lyrics=lyrics_result,
        chords=chord_result.chords,
    )

    # TODO Semana 6: importar y llamar a DifficultyService

    self.update_state(
        state="STARTED",
        meta={"progress": 95, "step": "finalizando"}
    )

    return {
        "status": "success",
        "audio_path": audio_path,
        "source": source,
        "duration": chord_result.duration,
        "chords": [c.model_dump() for c in chord_result.chords],
        "unique_chords": chord_result.unique_chords,
        "total_changes": chord_result.total_changes,
        "estimated_key": chord_result.estimated_key,
        "lyrics": aligned_lyrics.model_dump(),
    }
