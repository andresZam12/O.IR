"""
routes/songs.py — Endpoints para el procesamiento y consulta de canciones
"""

import os
import socket
import tempfile
import uuid
from typing import Optional
from urllib.parse import urlparse
import aiofiles
from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from celery.result import AsyncResult

from core.celery_app import celery_app
from core.config import settings
from schemas.song import (
    SongJobResponse,
    SongJobStatus,
    SongProcessRequest,
)
from schemas.transposition import TransposeRequest, TransposeResponse
from services.transposition_service import TranspositionService
from repositories.song_repository import SongRepository
from workers.song_worker import execute_song_pipeline, process_song

router = APIRouter()

import threading

# Almacén de trabajos local para fallback cuando Redis no está activo
local_jobs: dict[str, dict] = {}
# Bloqueo para serializar el procesamiento de audio en entornos con memoria limitada (ej. Render 512MB)
pipeline_lock = threading.Semaphore(1)


def is_redis_available() -> bool:
    """Verifica de forma instantánea (timeout 200ms) si el servidor Redis está activo."""
    try:
        parsed = urlparse(settings.redis_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        with socket.create_connection((host, port), timeout=0.2):
            return True
    except Exception:
        return False


def run_direct_process(
    job_id: str,
    audio_path: str,
    source: str,
    track_name: Optional[str] = None,
    artist_name: Optional[str] = None,
    identifier: Optional[str] = None,
) -> None:
    """Ejecuta el procesamiento en hilo local si Celery/Redis no están disponibles."""
    class TaskContext:
        def update_state(self, state: str, meta: dict) -> None:
            if job_id in local_jobs:
                local_jobs[job_id]["status"] = state
                local_jobs[job_id]["progress"] = meta.get("progress", 50)
                local_jobs[job_id]["step"] = meta.get("step", "procesando")

    with pipeline_lock:
        try:
            local_jobs[job_id] = {"status": "STARTED", "progress": 10, "step": "iniciando"}
            fake_task = TaskContext()
            res = execute_song_pipeline(
                task_context=fake_task,
                audio_path=audio_path,
                source=source,
                track_name=track_name,
                artist_name=artist_name,
                identifier=identifier,
            )
            local_jobs[job_id] = {
                "status": "SUCCESS",
                "progress": 100,
                "step": "completado",
                "result": res,
            }
        except Exception as e:
            local_jobs[job_id] = {
                "status": "FAILURE",
                "progress": 0,
                "step": "error",
                "error": str(e),
            }


ALLOWED_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".webm"}
UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "oir_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post(
    "/upload",
    response_model=SongJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Subir archivo de audio para análisis",
)
async def upload_audio_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    track_title: Optional[str] = Form(None),
    artist_name: Optional[str] = Form(None),
) -> SongJobResponse:
    """
    Recibe un archivo de audio (.mp3, .wav, etc.), opcionalmente título y artista,
    lo guarda temporalmente y crea una tarea asíncrona para detección de acordes y letras.
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

    file_id = f"{uuid.uuid4()}{ext}"
    saved_path = os.path.join(UPLOAD_DIR, file_id)

    try:
        async with aiofiles.open(saved_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                await buffer.write(chunk)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error guardando el archivo de audio: {str(e)}",
        )

    file_hash = SongRepository.generate_file_hash(saved_path)
    effective_title = (
        track_title.strip() if track_title and track_title.strip() else None
    )
    effective_artist = (
        artist_name.strip() if artist_name and artist_name.strip() else None
    )

    # Extraer metadatos ID3 / Vorbis incrustados directamente en el archivo
    try:
        from tinytag import TinyTag
        tag = TinyTag.get(saved_path)
        if not effective_title and tag.title and tag.title.strip():
            effective_title = tag.title.strip()
        if not effective_artist and tag.artist and tag.artist.strip():
            effective_artist = tag.artist.strip()
    except Exception:
        pass

    if not effective_title:
        effective_title = os.path.splitext(file.filename)[0]

    # Despachar a Celery si Redis está activo; de lo contrario, ejecutar localmente
    if is_redis_available():
        try:
            task = process_song.delay(
                audio_path=saved_path,
                source="upload",
                track_name=effective_title,
                artist_name=effective_artist,
                identifier=file_hash,
            )
            job_id = task.id
        except Exception:
            job_id = None
    else:
        job_id = None

    if not job_id:
        job_id = str(uuid.uuid4())
        local_jobs[job_id] = {"status": "STARTED", "progress": 10, "step": "iniciando"}
        background_tasks.add_task(
            run_direct_process,
            job_id=job_id,
            audio_path=saved_path,
            source="upload",
            track_name=effective_title,
            artist_name=effective_artist,
            identifier=file_hash,
        )

    return SongJobResponse(
        job_id=job_id,
        status="PENDING",
        message="Archivo de audio recibido. Procesamiento iniciado en segundo plano.",
    )


@router.post(
    "/process-url",
    response_model=SongJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Procesar audio desde URL (YouTube)",
)
async def process_song_url(
    request: SongProcessRequest,
    background_tasks: BackgroundTasks,
) -> SongJobResponse:
    """
    Recibe la URL de una canción (por ejemplo, YouTube) y encola
    la tarea de descarga y análisis.
    """
    if request.source == "youtube" and not request.youtube_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere 'youtube_url' cuando la fuente es 'youtube'",
        )

    target = request.youtube_url or ""
    url_hash = SongRepository.normalize_youtube_url(target)

    # Despachar a Celery si Redis está activo; de lo contrario, ejecutar localmente
    if is_redis_available():
        try:
            task = process_song.delay(
                audio_path=target,
                source=request.source,
                identifier=url_hash,
            )
            job_id = task.id
        except Exception:
            job_id = None
    else:
        job_id = None

    if not job_id:
        job_id = str(uuid.uuid4())
        local_jobs[job_id] = {"status": "STARTED", "progress": 10, "step": "iniciando"}
        background_tasks.add_task(
            run_direct_process,
            job_id=job_id,
            audio_path=target,
            source=request.source,
            track_name=None,
            artist_name=None,
            identifier=url_hash,
        )

    return SongJobResponse(
        job_id=job_id,
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
    # 1. Si se ejecutó en el pool local de BackgroundTasks
    if job_id in local_jobs:
        info = local_jobs[job_id]
        return SongJobStatus(
            job_id=job_id,
            status=info.get("status", "STARTED"),
            progress=info.get("progress", 0),
            step=info.get("step", "procesando"),
            result=info.get("result"),
            error=info.get("error"),
        )

    # 2. Si Redis está activo, consultar Celery
    if is_redis_available():
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

        return SongJobStatus(
            job_id=job_id,
            status=state,
            progress=50,
            step=state.lower(),
        )

    return SongJobStatus(
        job_id=job_id,
        status="FAILURE",
        progress=0,
        step="error",
        error="Tarea no encontrada",
    )


@router.get(
    "/stream/{job_id}",
    summary="Obtener stream de audio del archivo analizado",
)
async def stream_audio_file(job_id: str):
    """
    Transmite el archivo de audio para su reproducción sincronizada
    en la vista de Karaoke Interactivo.
    """
    audio_path = None
    if job_id in local_jobs:
        job = local_jobs[job_id]
        res = job.get("result")
        if res and isinstance(res, dict):
            audio_path = res.get("audio_path")

    if not audio_path or not os.path.exists(audio_path):
        for ext in ALLOWED_EXTENSIONS:
            candidate = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")
            if os.path.exists(candidate):
                audio_path = candidate
                break

    if not audio_path or not os.path.exists(audio_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de audio no disponible para reproducción",
        )

    _, ext = os.path.splitext(audio_path.lower())
    media_types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".webm": "audio/webm",
    }
    return FileResponse(
        path=audio_path,
        media_type=media_types.get(ext, "audio/mpeg"),
        filename=os.path.basename(audio_path),
    )


@router.get(
    "/download-youtube",
    summary="Descargar directamente el audio de YouTube como archivo MP3 al navegador",
)
async def download_youtube_audio_endpoint(url: str):
    """
    Descarga el stream de audio del video de YouTube en el servidor
    y lo envía inmediatamente al navegador como descarga de archivo MP3.
    """
    if not url or not url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Por favor proporciona una URL válida de YouTube.",
        )

    service = AudioService()
    try:
        download_result = service.download_youtube_audio(url.strip())
        clean_title = re.sub(r'[^\w\s-]', '', download_result.title).strip() or "cancion_youtube"
        download_name = f"{clean_title[:50]}.mp3"

        return FileResponse(
            path=download_result.file_path,
            media_type="audio/mpeg",
            filename=download_name,
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"'
            },
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al descargar audio de YouTube: {str(e)}",
        )


@router.post(
    "/transpose",
    response_model=TransposeResponse,
    summary="Transponer lista de acordes y sugerir posición óptima de Capo",
)
async def transpose_chords_endpoint(request: TransposeRequest) -> TransposeResponse:
    """
    Permite transponer un conjunto de acordes a cualquier intervalo
    de semitonos y devuelve sugerencias inteligentes de cejilla para principiantes.
    """
    service = TranspositionService()
    return service.transpose_chords(request.chords, request.semitones)


from pydantic import BaseModel
from schemas.lyrics import LyricsResult
from services.lyrics_service import LyricsService


class SyncLyricsRequest(BaseModel):
    track_name: str
    artist_name: Optional[str] = None
    duration: float
    chords: list[ChordItem]


@router.post(
    "/sync-lyrics",
    response_model=LyricsResult,
    summary="Buscar y sincronizar letra con acordes existentes en tiempo real",
)
async def sync_lyrics_endpoint(request: SyncLyricsRequest) -> LyricsResult:
    """
    Permite asociar y sincronizar dinámicamente la letra de una canción con
    la progresión de acordes ya analizada, sin necesidad de re-procesar el audio.
    """
    service = LyricsService()
    lyrics_result = await service.fetch_lyrics_lrclib(
        track_name=request.track_name,
        artist_name=request.artist_name,
        duration=request.duration,
    )
    aligned = service.align_chords_with_lyrics(lyrics_result, request.chords)
    return aligned
