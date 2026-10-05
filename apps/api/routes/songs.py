"""
routes/songs.py — Endpoints para el procesamiento y consulta de canciones
"""

import os
import uuid
import aiofiles
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from celery.result import AsyncResult

from core.celery_app import celery_app
from core.config import settings
from schemas.song import (
    SongJobResponse,
    SongJobStatus,
    SongProcessRequest,
)
from workers.song_worker import process_song

router = APIRouter()

# Directorio temporal para almacenar archivos subidos
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".webm"}


@router.post(
    "/upload",
    response_model=SongJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Subir archivo de audio para análisis",
)
async def upload_audio_file(file: UploadFile = File(...)) -> SongJobResponse:
    """
    Recibe un archivo de audio (.mp3, .wav, etc.), lo guarda temporalmente
    y crea una tarea asíncrona en Celery para la detección de acordes y letra.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre de archivo inválido",
        )

    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida. Formatos válidos: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Generar un nombre único para evitar colisiones
    file_id = f"{uuid.uuid4()}{ext}"
    saved_path = os.path.join(UPLOAD_DIR, file_id)

    try:
        async with aiofiles.open(saved_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # Chunks de 1MB
                await buffer.write(chunk)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error guardando el archivo de audio: {str(e)}",
        )

    # Despachar la tarea a Celery
    task = process_song.delay(audio_path=saved_path, source="upload")

    return SongJobResponse(
        job_id=task.id,
        status="PENDING",
        message="Archivo de audio recibido. Procesamiento iniciado en segundo plano.",
    )


@router.post(
    "/process-url",
    response_model=SongJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Procesar audio desde URL (YouTube)",
)
async def process_song_url(request: SongProcessRequest) -> SongJobResponse:
    """
    Recibe la URL de una canción (por ejemplo, YouTube) y encola
    la tarea de descarga y análisis en Celery.
    """
    if request.source == "youtube" and not request.youtube_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere 'youtube_url' cuando la fuente es 'youtube'",
        )

    # Por ahora pasamos la URL como ruta hasta que el descargador de YouTube esté activo
    target = request.youtube_url or ""
    task = process_song.delay(audio_path=target, source=request.source)

    return SongJobResponse(
        job_id=task.id,
        status="PENDING",
        message=f"Solicitud recibida para la fuente '{request.source}'. Tarea encolada.",
    )


@router.get(
    "/status/{job_id}",
    response_model=SongJobStatus,
    summary="Consultar estado de procesamiento de una tarea",
)
async def get_job_status(job_id: str) -> SongJobStatus:
    """
    Permite al frontend hacer polling periódico para conocer el progreso
    de la tarea (PENDING → STARTED → SUCCESS / FAILURE).
    """
    task_result = AsyncResult(job_id, app=celery_app)
    state = task_result.state

    if state == "PENDING":
        return SongJobStatus(
            job_id=job_id,
            status="PENDING",
            progress=0,
            step="en_cola",
        )

    elif state == "STARTED":
        meta = task_result.info if isinstance(task_result.info, dict) else {}
        return SongJobStatus(
            job_id=job_id,
            status="STARTED",
            progress=meta.get("progress", 25),
            step=meta.get("step", "procesando"),
        )

    elif state == "SUCCESS":
        return SongJobStatus(
            job_id=job_id,
            status="SUCCESS",
            progress=100,
            step="completado",
            result=task_result.result,
        )

    elif state == "FAILURE":
        return SongJobStatus(
            job_id=job_id,
            status="FAILURE",
            progress=0,
            step="error",
            error=str(task_result.info),
        )

    # Otros estados como RETRY
    return SongJobStatus(
        job_id=job_id,
        status=state,
        progress=50,
        step=state.lower(),
    )
