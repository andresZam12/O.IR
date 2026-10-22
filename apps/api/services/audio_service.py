"""
services/audio_service.py — Servicio de descarga y extracción de audio

Implementa la descarga de pistas de audio desde URLs de YouTube mediante yt-dlp,
extracción de metadatos (título, artista, duración) y validación de límites.
"""

import glob
import os
import re
import tempfile
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

    DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), "oir_downloads")

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

        # Soporte para proxy residencial (elude completamente bloqueos antibot de datacenter en Render / AWS)
        proxy = os.getenv("YOUTUBE_PROXY") or getattr(settings, "youtube_proxy", "")

        # Soporte para PoToken (Proof of Origin Token de YouTube)
        potoken = (
            os.getenv("YOUTUBE_POTOKEN")
            or os.getenv("YOUTUBE_PO_TOKEN")
            or getattr(settings, "youtube_potoken", "")
        )

        # Soporte para cookies opcionales si se configuran en el servidor en la nube
        cookie_path = os.getenv("YOUTUBE_COOKIE_PATH") or getattr(settings, "youtube_cookie_path", "")
        cookie_content = os.getenv("YOUTUBE_COOKIES") or getattr(settings, "youtube_cookies", "")
        if cookie_content and not cookie_path:
            cookie_path = os.path.join(self.DOWNLOAD_DIR, "yt_cookies.txt")
            try:
                # Normalizar saltos de línea y tabulaciones, garantizando encabezado Netscape estándar
                normalized = cookie_content.replace("\\n", "\n").replace("\\t", "\t").strip()
                if not normalized.startswith("# Netscape HTTP Cookie File"):
                    normalized = f"# Netscape HTTP Cookie File\n{normalized}"
                with open(cookie_path, "w", encoding="utf-8") as cf:
                    cf.write(normalized)
            except Exception:
                pass

        is_video = media_format.lower() == "mp4"
        format_spec = "best[ext=mp4]/best" if is_video else "ba[ext=m4a]/ba/b/bestaudio/best"

        base_opts = {
            "format": format_spec,
            "outtmpl": output_template,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "socket_timeout": 20,
            "retries": 2,
            "max_filesize": 100 * 1024 * 1024 if is_video else 60 * 1024 * 1024,
            "js_runtimes": {"node": {}},
        }

        if proxy and proxy.strip():
            base_opts["proxy"] = proxy.strip()

        if cookie_path and os.path.exists(cookie_path):
            base_opts["cookiefile"] = cookie_path

        # Selección de estrategias de cliente y evasión
        if potoken and potoken.strip():
            token_clean = potoken.strip()
            po_arg = token_clean if "+" in token_clean else f"web+{token_clean}"
            strategies = [
                {"extractor_args": {"youtube": {"po_token": [po_arg], "player_client": ["web"]}}},
                {"extractor_args": {"youtube": {"player_client": ["web"]}}},
                {},
            ]
        elif proxy and proxy.strip():
            # Con proxy residencial, las peticiones emulan usuarios reales de ISP hogareño
            strategies = [
                {},
                {"extractor_args": {"youtube": {"player_client": ["android", "ios", "web"]}}},
                {"extractor_args": {"youtube": {"player_client": ["web"]}}},
            ]
        elif cookie_path and os.path.exists(cookie_path):
            # Con cookies de sesión
            strategies = [
                {},
                {"extractor_args": {"youtube": {"player_client": ["web"]}}},
            ]
        else:
            # Estrategias de fallback ligero para centros de datos
            strategies = [
                {},
                {"extractor_args": {"youtube": {"player_client": ["tv", "web"]}}},
                {"extractor_args": {"youtube": {"player_client": ["web"]}}},
                {"extractor_args": {"youtube": {"player_client": ["ios", "web"]}}},
            ]

        last_error = None
        for attempt_idx, extra_opts in enumerate(strategies):
            ydl_opts = {**base_opts, **extra_opts}
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(clean_url, download=True)
                    if info is None:
                        raise RuntimeError("No se pudo extraer información del video.")

                    duration = float(info.get("duration", 0.0))
                    if duration > settings.max_audio_duration:
                        raise ValueError(
                            f"El medio dura {int(duration)} segundos. El límite máximo es de {settings.max_audio_duration}s ({int(settings.max_audio_duration/60)} minutos)."
                        )

                    title = info.get("title", "Video de YouTube" if is_video else "Canción de YouTube")
                    artist = info.get("uploader") or info.get("channel") or info.get("artist")

                    # 1. Intentar con el nombre preparado por yt-dlp
                    actual_file = ydl.prepare_filename(info)

                    # 2. Si no existe, buscar coincidencias de unique_id en el directorio de descargas
                    if not os.path.exists(actual_file):
                        pattern = os.path.join(self.DOWNLOAD_DIR, f"{unique_id}*")
                        matches = glob.glob(pattern)
                        if matches and os.path.exists(matches[0]):
                            actual_file = matches[0]
                        else:
                            for ext in [".mp3", ".m4a", ".mp4", ".webm", ".opus", ".wav", ".mkv"]:
                                cand = os.path.join(self.DOWNLOAD_DIR, f"{unique_id}{ext}")
                                if os.path.exists(cand):
                                    actual_file = cand
                                    break

                    if not os.path.exists(actual_file):
                        raise RuntimeError("No se encontró el archivo de audio descargado en el servidor.")

                    return AudioDownloadResult(
                        file_path=actual_file,
                        title=title,
                        artist=artist,
                        duration=duration,
                        source_url=youtube_url,
                    )
            except Exception as e:
                if isinstance(e, ValueError):
                    raise
                last_error = e
                err_str = str(e).lower()
                # Si es un error de bot o límite de YouTube, no tiene sentido reintentar todas las estrategias
                if "not a bot" in err_str or "sign in" in err_str:
                    break
                continue

        # Canal alternativo de alta resiliencia si yt-dlp fue bloqueado por restricciones de datacenter de YouTube
        try:
            return self._download_via_direct_stream(clean_url, unique_id)
        except Exception:
            pass

        err_msg = str(last_error) if last_error else "Error desconocido al procesar el enlace."
        if "not a bot" in err_msg.lower() or "sign in" in err_msg.lower():
            raise RuntimeError(
                "YouTube ha limitado la descarga desde servidores en la nube para este video. "
                "Te sugerimos usar la pestaña 'Subir Archivo' (.mp3 o .wav) o la opción de micrófono para procesarlo al instante."
            )
        raise RuntimeError(f"Error al descargar medio de YouTube: {err_msg}")

    def _download_via_direct_stream(
        self, clean_url: str, unique_id: str
    ) -> AudioDownloadResult:
        """
        Descarga el stream de audio en MP3 utilizando el canal de procesamiento
        independiente de restricciones antibot de centros de datos.
        """
        import json
        import urllib.request
        import time

        match = re.search(r"(?:v=|\/embed\/|\.be\/)([\w\-]{11})", clean_url)
        video_id = match.group(1) if match else clean_url

        api_url = f"https://loader.to/ajax/download.php?format=mp3&url=https://www.youtube.com/watch?v={video_id}"
        req = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
        )
        with urllib.request.urlopen(req, timeout=12) as r:
            init_data = json.loads(r.read())

        title = init_data.get("title") or f"cancion_{video_id}"
        progress_url = init_data.get("progress_url")
        if not progress_url:
            raise RuntimeError("No se pudo iniciar el canal de extracción.")

        download_link = None
        for _ in range(25):
            preq = urllib.request.Request(
                progress_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                },
            )
            with urllib.request.urlopen(preq, timeout=12) as pr:
                p_data = json.loads(pr.read())
                if p_data.get("download_url"):
                    download_link = p_data["download_url"]
                    break
            time.sleep(1.2)

        if not download_link:
            raise RuntimeError("Tiempo de espera agotado al obtener el flujo MP3.")

        target_file = os.path.join(self.DOWNLOAD_DIR, f"{unique_id}.mp3")
        with urllib.request.urlopen(download_link, timeout=40) as dl_resp, open(
            target_file, "wb"
        ) as f:
            while True:
                chunk = dl_resp.read(64 * 1024)
                if not chunk:
                    break
                f.write(chunk)

        if not os.path.exists(target_file) or os.path.getsize(target_file) == 0:
            raise RuntimeError("El archivo de audio descargado está vacío.")

        return AudioDownloadResult(
            file_path=target_file,
            title=title,
            artist=None,
            duration=180.0,
            source_url=clean_url,
        )

    def cleanup_file(self, file_path: str) -> None:
        """Elimina un archivo temporal de audio una vez procesado."""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass
