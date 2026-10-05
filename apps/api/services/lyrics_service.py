"""
services/lyrics_service.py — Servicio de obtención y sincronización de letras

Implementa la consulta a la API pública de LRCLIB, el parseo de formato LRC
y la alineación temporal entre las líneas de la letra y los acordes detectados.
"""

import re
from typing import Optional
import httpx

from schemas.lyrics import LyricLine, LyricsResult
from schemas.song import ChordItem


class LyricsService:
    """
    Servicio de obtención de letras de canciones sincronizadas con timestamps.
    Consulta LRCLIB como primera fuente para evitar el costo computacional de Whisper.
    """

    LRCLIB_BASE_URL: str = "https://lrclib.net/api"
    # Expresión regular para parsear marcas de tiempo estándar LRC: [mm:ss.xx] o [mm:ss.xxx]
    LRC_TIMESTAMP_REGEX: re.Pattern = re.compile(
        r"^\[(?P<min>\d{2}):(?P<sec>\d{2})(?:\.(?P<ms>\d{2,3}))?\](?P<text>.*)$"
    )

    def __init__(self, timeout: float = 10.0) -> None:
        """
        Inicializa el cliente de letras con tiempo de espera configurable.
        """
        self.timeout = timeout

    def parse_lrc(self, lrc_content: str) -> list[LyricLine]:
        """
        Parsea un texto en formato LRC y lo convierte en una lista ordenada de LyricLine.

        Args:
            lrc_content: Cadena de texto con el contenido de las letras con timestamps.

        Returns:
            Lista de LyricLine ordenadas por tiempo.
        """
        lines: list[LyricLine] = []

        for raw_line in lrc_content.splitlines():
            raw_line = raw_line.strip()
            if not raw_line:
                continue

            match = self.LRC_TIMESTAMP_REGEX.match(raw_line)
            if not match:
                # Líneas que no coinciden con timestamp (metadatos como [ar:...], [ti:...])
                continue

            minutes = int(match.group("min"))
            seconds = int(match.group("sec"))
            ms_str = match.group("ms") or "0"

            # Normalizar milisegundos: si tiene 2 dígitos (centésimas), dividir por 100
            ms_val = float(ms_str) / (100.0 if len(ms_str) == 2 else 1000.0)
            total_seconds = round(minutes * 60 + seconds + ms_val, 2)

            text = match.group("text").strip()
            # Permitir líneas instrumentales o silencios como texto vacío si es necesario
            lines.append(LyricLine(time=total_seconds, text=text))

        # Asegurar orden cronológico estricto
        lines.sort(key=lambda line: line.time)
        return lines

    async def fetch_lyrics_lrclib(
        self,
        track_name: str,
        artist_name: Optional[str] = None,
        duration: Optional[float] = None,
    ) -> LyricsResult:
        """
        Consulta la API de LRCLIB buscando la letra sincronizada de una canción.

        Args:
            track_name: Nombre o título de la canción.
            artist_name: Nombre del artista o banda (opcional).
            duration: Duración estimada de la canción en segundos (opcional).

        Returns:
            LyricsResult con las líneas sincronizadas o la letra plana.
        """
        params: dict[str, str | int] = {"track_name": track_name}
        if artist_name:
            params["artist_name"] = artist_name
        if duration and duration > 0:
            params["duration"] = int(round(duration))

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # 1. Intentar endpoint exacto /get
                response = await client.get(f"{self.LRCLIB_BASE_URL}/get", params=params)

                if response.status_code == 200:
                    data = response.json()
                    synced_lrc = data.get("syncedLyrics")
                    plain_lyrics = data.get("plainLyrics")

                    if synced_lrc:
                        parsed_lines = self.parse_lrc(synced_lrc)
                        return LyricsResult(
                            is_synced=True,
                            source="lrclib",
                            lines=parsed_lines,
                            plain_lyrics=plain_lyrics,
                            title=data.get("trackName"),
                            artist=data.get("artistName"),
                        )
                    elif plain_lyrics:
                        return LyricsResult(
                            is_synced=False,
                            source="lrclib",
                            lines=[],
                            plain_lyrics=plain_lyrics,
                            title=data.get("trackName"),
                            artist=data.get("artistName"),
                        )

                # 2. Si no hubo coincidencia exacta, intentar búsqueda abierta /search
                search_query = f"{artist_name} {track_name}".strip() if artist_name else track_name
                search_response = await client.get(
                    f"{self.LRCLIB_BASE_URL}/search", params={"q": search_query}
                )

                if search_response.status_code == 200:
                    items = search_response.json()
                    if isinstance(items, list) and len(items) > 0:
                        first_match = items[0]
                        synced_lrc = first_match.get("syncedLyrics")
                        if synced_lrc:
                            return LyricsResult(
                                is_synced=True,
                                source="lrclib",
                                lines=self.parse_lrc(synced_lrc),
                                plain_lyrics=first_match.get("plainLyrics"),
                                title=first_match.get("trackName"),
                                artist=first_match.get("artistName"),
                            )

        except Exception:
            # En caso de desconexión o fallo de API externa, degradación suave
            pass

        return LyricsResult(
            is_synced=False,
            source="not_found",
            lines=[],
            plain_lyrics=None,
            title=track_name,
            artist=artist_name,
        )

    def align_chords_with_lyrics(
        self, lyrics: LyricsResult, chords: list[ChordItem]
    ) -> LyricsResult:
        """
        Alinea cada línea de letra con el acorde activo en ese segundo exacto.
        Permite mostrar al usuario el acorde a tocar justo sobre la sílaba/frase.

        Args:
            lyrics: Resultado de letras obtenido previamente.
            chords: Lista ordenada de acordes detectados con sus marcas de tiempo.

        Returns:
            LyricsResult con las líneas actualizadas con el campo chord correspondiente.
        """
        if not lyrics.lines or not chords:
            return lyrics

        aligned_lines: list[LyricLine] = []

        for line in lyrics.lines:
            target_time = line.time
            active_chord = "N/C"

            # Buscar el último acorde que comenzó antes o en el mismo instante de la línea
            for chord in chords:
                if chord.time <= target_time:
                    active_chord = chord.chord
                else:
                    break

            aligned_lines.append(
                LyricLine(
                    time=line.time,
                    text=line.text,
                    chord=active_chord if active_chord != "N/C" else None,
                )
            )

        return LyricsResult(
            is_synced=lyrics.is_synced,
            source=lyrics.source,
            lines=aligned_lines,
            plain_lyrics=lyrics.plain_lyrics,
            title=lyrics.title,
            artist=lyrics.artist,
        )
