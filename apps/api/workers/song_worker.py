"""
workers/song_worker.py — Tareas asíncronas para el procesamiento de canciones

Este módulo define las tareas de Celery que se ejecutan en segundo plano.
Cuando el usuario envía una canción, la API crea una tarea aquí y devuelve
inmediatamente un job_id. El frontend hace polling al endpoint de estado
hasta que la tarea termina.
"""

from core.celery_app import celery_app


@celery_app.task(bind=True, name="process_song")
def process_song(self, audio_path: str, source: str) -> dict:
    """
    Tarea principal: procesa un archivo de audio y extrae acordes + letra.

    Args:
        audio_path: Ruta local al archivo de audio ya descargado/subido.
        source: Origen del audio ('youtube', 'upload', 'microphone').

    Returns:
        Diccionario con acordes, letra, tonalidad y puntaje de dificultad.

    Nota: Esta tarea se irá completando semana a semana. Por ahora es un placeholder.
    """

    # --- Actualizar el estado a 'en proceso' para que el frontend lo vea ---
    self.update_state(state="STARTED", meta={"progress": 0, "step": "iniciando"})

    # TODO Semana 2: importar y llamar a ChordDetectionService
    # TODO Semana 3: importar y llamar a LyricsService
    # TODO Semana 6: importar y llamar a DifficultyService

    # Por ahora retornamos una respuesta de prueba
    return {
        "status": "success",
        "message": "Pipeline de procesamiento listo para implementar",
        "audio_path": audio_path,
        "source": source,
    }
