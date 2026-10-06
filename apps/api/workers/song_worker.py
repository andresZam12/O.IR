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
from services.difficulty_service import DifficultyService
from services.audio_service import AudioService
from repositories.song_repository import SongRepository


@celery_app.task(bind=True, name="process_song")
def process_song(
    self,
    audio_path: str,
    source: str,
    track_name: Optional[str] = None,
    artist_name: Optional[str] = None,
    identifier: Optional[str] = None,
) -> dict:
    """
    Tarea principal: procesa un archivo de audio y extrae acordes + letra + dificultad.

    Args:
        audio_path: Ruta local al audio o URL de YouTube.
        source: Origen del audio ('youtube', 'upload', 'microphone').
        track_name: Título opcional de la canción para buscar letra en LRCLIB.
        artist_name: Nombre opcional del artista.
        identifier: Clave de hash para persistencia en caché.

    Returns:
        Diccionario con acordes, letra sincronizada, tonalidad y evaluación de dificultad.
    """

    # --- 1. Inicialización y descarga si proviene de YouTube ---
    self.update_state(state="STARTED", meta={"progress": 10, "step": "iniciando"})

    effective_audio_path = audio_path
    effective_title = track_name
    effective_artist = artist_name
    is_temp_download = False

    if source == "youtube":
        self.update_state(
            state="STARTED",
            meta={"progress": 15, "step": "descargando_audio"}
        )
        audio_service = AudioService()
        download_info = audio_service.download_youtube_audio(audio_path)
        effective_audio_path = download_info.file_path
        effective_title = effective_title or download_info.title
        effective_artist = effective_artist or download_info.artist
        is_temp_download = True

    # --- 2. Detección de acordes con librosa ---
    self.update_state(
        state="STARTED",
        meta={"progress": 35, "step": "detectando_acordes"}
    )
    chord_service = ChordDetectionService()
    chord_result = chord_service.detect_chords_from_file(effective_audio_path)

    # --- 3. Obtención y sincronización de letra con LRCLIB ---
    self.update_state(
        state="STARTED",
        meta={"progress": 65, "step": "sincronizando_letras"}
    )

    lyrics_service = LyricsService()
    # Si no se pasó track_name, inferir del nombre del archivo
    if not effective_title:
        effective_title = os.path.splitext(os.path.basename(effective_audio_path))[0]

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

    # --- 4. Evaluación de dificultad objetiva y consejos pedagógicos ---
    self.update_state(
        state="STARTED",
        meta={"progress": 85, "step": "evaluando_dificultad"}
    )
    difficulty_service = DifficultyService()
    difficulty_eval = difficulty_service.evaluate_song(chord_result)

    self.update_state(
        state="STARTED",
        meta={"progress": 100, "step": "finalizando"}
    )

    final_result = {
        "status": "success",
        "audio_path": audio_path,
        "source": source,
        "duration": chord_result.duration,
        "chords": [c.model_dump() for c in chord_result.chords],
        "unique_chords": chord_result.unique_chords,
        "total_changes": chord_result.total_changes,
        "estimated_key": chord_result.estimated_key,
        "lyrics": aligned_lyrics.model_dump(),
        "difficulty": difficulty_eval.model_dump(),
    }

    # Guardar en repositorio de Supabase / caché si se proporcionó un identificador
    if identifier:
        try:
            SongRepository().save(
                identifier=identifier, source=source, result_data=final_result
            )
        except Exception as e:
            logger.warning(f"No se pudo guardar en caché/repositorio: {e}")

    # Limpieza de archivo temporal si fue descargado de YouTube
    if is_temp_download and 'audio_service' in locals():
        audio_service.cleanup_file(effective_audio_path)

    return final_result
