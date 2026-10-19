"""
services/audio_service.py — Servicio de descarga y extracción de audio

Implementa la descarga de pistas de audio desde URLs de YouTube mediante yt-dlp,
extracción de metadatos (título, artista, duración) y validación de límites.
"""

import os
import re
import uuid
from typing import Optional
from dataclasses import dataclass

from core.config import settings

try:
    import yt_dlp
except ImportError:
    yt_dlp = None  # type: ignore


@dataclass
class AudioDownloadResult:
    """Metadatos y ruta del audio descargado."""

    file_path: str
    title: str
    artist: Optional[str]
    duration: float
    source_url: str


class AudioService:
    """
    Servicio encargado de la ingesta de audio desde fuentes externas (YouTube)
    y preprocesamiento de archivos multimedia.
    """

    DOWNLOAD_DIR = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "temp"
    )

    def __init__(self) -> None:
        """Asegura que el directorio temporal exista."""
        os.makedirs(self.DOWNLOAD_DIR, exist_ok=True)

    def download_youtube_audio(self, youtube_url: str) -> AudioDownloadResult:
        """
        Descarga el stream de audio de un video de YouTube y lo convierte a formato mono WAV/MP3.

        Args:
            youtube_url: URL pública del video de YouTube.

        Returns:
            AudioDownloadResult con la ruta del archivo local y los metadatos.

        Raises:
            RuntimeError: Si yt-dlp no está instalado o la descarga falla.
            ValueError: Si la duración del audio supera el límite permitido.
        """
        if yt_dlp is None:
            raise RuntimeError(
                "La librería 'yt-dlp' no está instalada en el entorno actual."
            )

        unique_id = str(uuid.uuid4())
        output_template = os.path.join(self.DOWNLOAD_DIR, f"{unique_id}.%(ext)s")

        # Limpiar la URL para asegurar que solo se descargue el video individual (descartar playlists y mixes automáticos)
        return self.download_youtube_media(youtube_url=youtube_url, media_format="mp3")

    def download_youtube_media(
        self, youtube_url: str, media_format: str = "mp3"
    ) -> AudioDownloadResult:
        """
        Descarga el stream de audio (MP3) o video (MP4) de YouTube usando yt-dlp
        con bypass de cliente móvil para evitar bloqueos antibot.
        """
        unique_id = str(uuid.uuid4())
        output_template = os.path.join(self.DOWNLOAD_DIR, f"{unique_id}.%(ext)s")

        clean_url = youtube_url.strip()
        match = re.search(r"(?:v=|\/embed\/|\.be\/)([\w\-]{11})", clean_url)
        if match:
            clean_url = f"https://www.youtube.com/watch?v={match.group(1)}"

        # Soporte para cookies opcionales si se configuran en el servidor en la nube
        cookie_path = os.getenv("YOUTUBE_COOKIE_PATH")
        cookie_content = os.getenv("YOUTUBE_COOKIES")
        if cookie_content and not cookie_path:
            cookie_path = os.path.join(self.DOWNLOAD_DIR, "yt_cookies.txt")
            try:
                with open(cookie_path, "w", encoding="utf-8") as cf:
                    cf.write(cookie_content)
            except Exception:
                pass

        is_video = media_format.lower() == "mp4"
        format_spec = "best[ext=mp4]/best" if is_video else "ba[ext=m4a]/ba/b/bestaudio/best"

        ydl_opts = {
            "format": format_spec,
            "outtmpl": output_template,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "socket_timeout": 30,
            "retries": 5,
            # Evitar descargar videos excesivamente largos (50MB audio, 100MB video)
            "max_filesize": 100 * 1024 * 1024 if is_video else 50 * 1024 * 1024,
            # Bypass antibot de YouTube mediante cliente Android
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "ios", "mweb"],
                }
            },
        }

        if cookie_path and os.path.exists(cookie_path):
            ydl_opts["cookiefile"] = cookie_path

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(clean_url, download=True)
                if info is None:
                    raise RuntimeError("No se pudo extraer información del video.")

                duration = float(info.get("duration", 0.0))
                if duration > settings.max_audio_duration:
                    raise ValueError(
                        f"El medio dura {int(duration)} segundos. El límite máximo es de {settings.max_audio_duration}s (5 minutos)."
                    )

                title = info.get("title", "Video de YouTube" if is_video else "Canción de YouTube")
                artist = info.get("uploader") or info.get("channel") or info.get("artist")

                target_ext = ".mp4" if is_video else ".mp3"
                expected_file = os.path.join(self.DOWNLOAD_DIR, f"{unique_id}{target_ext}")

                # Si el archivo tiene otra extensión de contenedor descargada
                if not os.path.exists(expected_file):
                    for ext in [".m4a", ".mp4", ".webm", ".opus", ".wav", ".mkv"]:
                        candidate = os.path.join(self.DOWNLOAD_DIR, f"{unique_id}{ext}")
                        if os.path.exists(candidate):
                            expected_file = candidate
                            break

                return AudioDownloadResult(
                    file_path=expected_file,
                    title=title,
                    artist=artist,
                    duration=duration,
                    source_url=youtube_url,
                )

        except Exception as e:
            if isinstance(e, ValueError):
                raise
            err_msg = str(e)
            if "not a bot" in err_msg.lower() or "sign in" in err_msg.lower():
                raise RuntimeError(
                    "YouTube ha limitado la descarga desde servidores en la nube para este video. "
                    "Te sugerimos usar la pestaña 'Subir Archivo' (.mp3 o .wav) o la opción de micrófono para procesarlo al instante."
                )
            raise RuntimeError(f"Error al descargar medio de YouTube: {err_msg}")

    def cleanup_file(self, file_path: str) -> None:
        """Elimina un archivo temporal de audio una vez procesado."""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass
