"""
workers/song_worker.py — Tareas asíncronas para el procesamiento de canciones

Este módulo define las tareas de Celery que se ejecutan en segundo plano.
Cuando el usuario envía una canción, la API crea una tarea aquí y devuelve
inmediatamente un job_id. El frontend hace polling al endpoint de estado
hasta que la tarea termina.
"""

from core.celery_app import celery_app
from services.chord_service import ChordDetectionService


@celery_app.task(bind=True, name="process_song")
def process_song(self, audio_path: str, source: str) -> dict:
    """
    Tarea principal: procesa un archivo de audio y extrae acordes + letra.

    Args:
        audio_path: Ruta local al archivo de audio ya descargado/subido.
        source: Origen del audio ('youtube', 'upload', 'microphone').

    Returns:
        Diccionario con acordes, letra, tonalidad y puntaje de dificultad.
    """

    # --- Actualizar el estado a 'en proceso' para que el frontend lo vea ---
    self.update_state(state="STARTED", meta={"progress": 10, "step": "iniciando"})

    # --- Semana 2: Detección de acordes con librosa ---
    self.update_state(
        state="STARTED",
        meta={"progress": 30, "step": "detectando_acordes"}
    )
    chord_service = ChordDetectionService()
    chord_result = chord_service.detect_chords_from_file(audio_path)

    # TODO Semana 3: importar y llamar a LyricsService (LRCLIB / Whisper)
    # TODO Semana 6: importar y llamar a DifficultyService

    self.update_state(
        state="STARTED",
        meta={"progress": 90, "step": "finalizando"}
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
    }
