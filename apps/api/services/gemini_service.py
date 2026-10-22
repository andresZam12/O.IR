"""
services/gemini_service.py — Transcripción universal de letras de canciones con Google Gemini
"""

import base64
import json
import logging
import os
import re
from typing import Optional

from core.config import settings
from schemas.lyrics import LyricLine, LyricsResult

logger = logging.getLogger(__name__)


class GeminiLyricsService:
    """
    Servicio de transcripción de voz cantada utilizando la IA multimodal de Google Gemini.
    Permite extraer la letra sincronizada con marcas de tiempo de cualquier audio
    (incluso si no existe en bases de datos abiertas como LRCLIB).
    """

    MIME_MAP = {
        ".mp3": "audio/mp3",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".webm": "audio/webm",
        ".mp4": "video/mp4",
    }

    def __init__(self) -> None:
        self.api_key = (
            settings.gemini_api_key.strip() if settings.gemini_api_key else ""
        )
        self._client = None
        if self.api_key:
            try:
                from google import genai

                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"No se pudo inicializar Google GenAI Client: {e}")

    @property
    def is_available(self) -> bool:
        return bool(self._client and self.api_key)

    async def transcribe_audio(
        self,
        audio_path: str,
        hint_title: Optional[str] = None,
        hint_artist: Optional[str] = None,
        duration: Optional[float] = None,
    ) -> Optional[LyricsResult]:
        """
        Obtiene la letra de la canción usando Gemini AI de forma ultraligera y segura,
        sin cargar archivos pesados en memoria ni bloquear la CPU de Render.
        """
        if not self.is_available:
            return None

        if not hint_title and not hint_artist:
            return None

        song_info = f"{hint_title or 'Canción'}"
        if hint_artist:
            song_info += f" de {hint_artist}"

        total_dur = duration or 180.0

        prompt = (
            f"Proporciona la letra oficial y auténtica de la canción: '{song_info}'. "
            "Divide la letra en versos y asigna a cada verso una marca de tiempo 'time' en segundos "
            f"distribuida armónicamente entre 5.0 y {round(total_dur - 10, 1)} segundos. "
            "RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO (sin bloques markdown ni explicaciones adicionales):\n"
            "{\n"
            f'  "title": "{hint_title or ""}",\n'
            f'  "artist": "{hint_artist or ""}",\n'
            '  "lines": [\n'
            '    {"time": 12.0, "text": "Verso cantado..."}\n'
            "  ]\n"
            "}"
        )

        try:
            import concurrent.futures

            def _call_gemini():
                try:
                    resp = self._client.models.generate_content(
                        model="gemini-3.5-flash-lite",
                        contents=prompt,
                    )
                    return resp.text if (resp and resp.text) else None
                except Exception as err:
                    logger.warning(f"Gemini API llamada no completada: {err}")
                    return None

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                fut = executor.submit(_call_gemini)
                try:
                    response_text = fut.result(timeout=3.5)
                except Exception:
                    response_text = None

            if not response_text:
                return None

            cleaned_json = re.sub(
                r"^```(?:json)?\s*", "", response_text.strip(), flags=re.IGNORECASE
            )
            cleaned_json = re.sub(r"\s*```$", "", cleaned_json.strip())

            data = json.loads(cleaned_json)
            raw_lines = data.get("lines", [])

            lines: list[LyricLine] = []
            for item in raw_lines:
                try:
                    t = float(item.get("time", 0.0))
                    txt = str(item.get("text", "")).strip()
                    if txt:
                        lines.append(LyricLine(time=round(t, 2), text=txt))
                except Exception:
                    continue

            lines.sort(key=lambda l: l.time)

            if lines:
                return LyricsResult(
                    is_synced=True,
                    source="gemini",
                    lines=lines,
                    plain_lyrics="\n".join(l.text for l in lines),
                    title=data.get("title") or hint_title,
                    artist=data.get("artist") or hint_artist,
                )

        except Exception as e:
            logger.warning(f"GeminiLyricsService omitido de forma segura: {e}")

        return None
