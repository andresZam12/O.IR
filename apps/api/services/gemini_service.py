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
        Transcribe el archivo de audio cantado usando Gemini Multimodal y devuelve
        un LyricsResult con líneas sincronizadas segundo a segundo.
        """
        if not self.is_available:
            logger.info("GeminiLyricsService no disponible: falta GEMINI_API_KEY")
            return None

        if not os.path.exists(audio_path):
            logger.warning(f"Audio file no encontrado para Gemini: {audio_path}")
            return None

        _, ext = os.path.splitext(audio_path.lower())
        mime_type = self.MIME_MAP.get(ext, "audio/mp3")

        try:
            # Leer el archivo de audio y codificar en base64
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()

            # Si el archivo excede los 20MB, enviar primeros 15MB
            if len(audio_bytes) > 20 * 1024 * 1024:
                audio_bytes = audio_bytes[: 20 * 1024 * 1024]

            base64_data = base64.b64encode(audio_bytes).decode("utf-8")

            hint_text = ""
            if hint_title:
                hint_text += f"\n- Posible título: {hint_title}"
            if hint_artist:
                hint_text += f"\n- Posible artista: {hint_artist}"

            prompt = (
                "Actúa como un transcriptor musical experto. Escucha atentamente este audio. "
                "Extrae la letra cantada completa en el idioma original, dividida en versos "
                "con la marca de tiempo de inicio en segundos aproximada para cada verso."
                f"{hint_text}\n\n"
                "RESPONDE ESTRICTAMENTE CON UN OBJETO JSON VÁLIDO (sin bloques de código markdown ni texto adicional) con esta estructura exacta:\n"
                "{\n"
                '  "title": "Nombre de la canción o null",\n'
                '  "artist": "Artista o null",\n'
                '  "lines": [\n'
                '    {"time": 12.5, "text": "Línea cantada..."},\n'
                '    {"time": 16.0, "text": "Siguiente línea..."}\n'
                "  ]\n"
                "}\n"
                'Si el audio es instrumental o no contiene voz cantada, devuelve {"lines": []}.'
            )

            # Usar 'audio' o 'video' según el mime_type
            content_type = "video" if mime_type.startswith("video") else "audio"

            # Ejecutar llamada a Gemini Interactions API
            interaction = self._client.interactions.create(
                model="gemini-flash-latest",
                input=[
                    {"type": "text", "text": prompt},
                    {
                        "type": content_type,
                        "data": base64_data,
                        "mime_type": mime_type,
                    },
                ],
            )

            response_text = interaction.output_text or ""
            # Limpiar posible envoltorio markdown ```json ... ```
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
            logger.error(f"Error transcribiendo letra con Gemini: {e}")

        return None
