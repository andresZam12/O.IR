"""
workers/song_worker.py — Tareas asíncronas para el procesamiento de canciones

Este módulo define las tareas de Celery que se ejecutan en segundo plano.
Cuando el usuario envía una canción, la API crea una tarea aquí y devuelve
inmediatamente un job_id. El frontend hace polling al endpoint de estado
hasta que la tarea termina.
"""

import asyncio
import logging
import os
from typing import Any, Optional

from core.celery_app import celery_app
from services.chord_service import ChordDetectionService
from services.lyrics_service import LyricsService
from services.difficulty_service import DifficultyService
from services.audio_service import AudioService
from repositories.song_repository import SongRepository

logger = logging.getLogger(__name__)


def execute_song_pipeline(
    task_context: Any,
    audio_path: str,
    source: str,
    track_name: Optional[str] = None,
    artist_name: Optional[str] = None,
    identifier: Optional[str] = None,
) -> dict:
    """
    Ejecuta el pipeline completo de procesamiento de una canción:
    1. Descarga / resolución de audio
    2. Detección de acordes con librosa
    3. Búsqueda y sincronización de letra con LRCLIB
    4. Evaluación objetiva de dificultad pedagógica
    5. Cacheo en Supabase / JSON
    """
    # --- 1. Inicialización y descarga si proviene de YouTube ---
    task_context.update_state(state="STARTED", meta={"progress": 10, "step": "iniciando"})

    effective_audio_path = audio_path
    effective_title = track_name
    effective_artist = artist_name
    is_temp_download = False

    if source == "youtube":
        task_context.update_state(
            state="STARTED",
            meta={"progress": 15, "step": "descargando_audio"}
        )
        audio_service = AudioService()
        download_info = audio_service.download_youtube_audio(audio_path)
        effective_audio_path = download_info.file_path
        effective_title = effective_title or download_info.title
        effective_artist = effective_artist or download_info.artist
        is_temp_download = True
    elif source == "upload" and os.path.exists(effective_audio_path):
        try:
            from tinytag import TinyTag
            tag = TinyTag.get(effective_audio_path)
            if tag.title and tag.title.strip():
                effective_title = tag.title.strip()
            if tag.artist and tag.artist.strip():
                effective_artist = tag.artist.strip()
        except Exception:
            pass

    # --- 2. Detección de acordes con librosa ---
    task_context.update_state(
        state="STARTED",
        meta={"progress": 35, "step": "detectando_acordes"}
    )
    chord_service = ChordDetectionService()
    chord_result = chord_service.detect_chords_from_file(effective_audio_path)

    # --- 3. Obtención y sincronización de letra con LRCLIB ---
    task_context.update_state(
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
            artist_name=effective_artist,
            duration=chord_result.duration,
        )
    )

    # Fallback automático universal con Google Gemini AI si no existe en la base de datos abierta:
    if not lyrics_result or not lyrics_result.lines:
        try:
            from services.gemini_service import GeminiLyricsService

            gemini_svc = GeminiLyricsService()
            if gemini_svc.is_available:
                task_context.update_state(
                    state="STARTED",
                    meta={"progress": 70, "step": "transcribiendo_con_gemini_ai"},
                )
                gemini_res = asyncio.run(
                    gemini_svc.transcribe_audio(
                        audio_path=effective_audio_path,
                        hint_title=effective_title,
                        hint_artist=effective_artist,
                        duration=chord_result.duration,
                    )
                )
                if gemini_res and gemini_res.lines:
                    lyrics_result = gemini_res
        except Exception as e:
            logger.warning(f"Error en transcripción con Gemini: {e}")

    if lyrics_result.title:
        effective_title = lyrics_result.title
    if lyrics_result.artist:
        effective_artist = lyrics_result.artist

    # --- 3.5 Enriquecimiento armónico con acordes auténticos y correspondientes ---
    from services.harmonic_service import HarmonicEnrichmentService

    harmonic_service = HarmonicEnrichmentService()
    aligned_lyrics, chord_result = harmonic_service.enrich_song_harmonies(
        title=effective_title,
        artist=effective_artist,
        lyrics=lyrics_result,
        chord_result=chord_result,
    )

    # --- 4. Evaluación de dificultad objetiva y consejos pedagógicos ---
    task_context.update_state(
        state="STARTED",
        meta={"progress": 85, "step": "evaluando_dificultad"}
    )
    difficulty_service = DifficultyService()
    difficulty_eval = difficulty_service.evaluate_song(chord_result)

    task_context.update_state(
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
        "audio_url": f"/songs/stream/{identifier}" if identifier else None,
    }

    # Guardar en repositorio de Supabase / caché si se proporcionó un identificador
    if identifier:
        try:
            SongRepository().save(
                identifier=identifier, source=source, result_data=final_result
            )
        except Exception as e:
            logger.warning(f"No se pudo guardar en caché/repositorio: {e}")

    return final_result


@celery_app.task(bind=True, name="process_song")
def process_song(
    self,
    audio_path: str,
    source: str = "upload",
    track_name: Optional[str] = None,
    artist_name: Optional[str] = None,
    identifier: Optional[str] = None,
) -> dict:
    """Wrapper de Celery para ejecutar el pipeline de la canción con contexto asíncrono."""
    return execute_song_pipeline(
        task_context=self,
        audio_path=audio_path,
        source=source,
        track_name=track_name,
        artist_name=artist_name,
        identifier=identifier,
    )
