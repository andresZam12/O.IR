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

    @staticmethod
    def clean_title_and_artist(
        raw_title: str, raw_artist: Optional[str] = None
    ) -> tuple[str, Optional[str], list[str]]:
        """
        Limpia títulos procedentes de YouTube o nombres de archivo,
        eliminando etiquetas publicitarias, formatos ('[Official Video]', '(HD)', etc.),
        y detecta separadores para generar variantes de búsqueda optimizadas.
        """
        title = (raw_title or "").strip()

        # Quitar extensiones de archivo si las tiene
        title = re.sub(
            r"\.(mp3|wav|ogg|m4a|webm|flac)$", "", title, flags=re.IGNORECASE
        ).strip()

        # Quitar etiquetas tipo [Official Video], (Audio Oficial), (Visualizador Oficial), etc.
        noise_bracket_pattern = (
            r"(\(|\[|\{)(?i:official|oficial|video|audio|lyric|lyrics|letra|hd|4k|remastered|remaster|"
            r"live|en\s+vivo|extended|version|versión|visualizer|visualizador|clip|feat\.?|ft\.?).*?(\)|\]|\})"
        )
        title = re.sub(noise_bracket_pattern, "", title).strip()

        # Quitar prefijos como "OFFICIAL ", "Official Video - ", "Video Oficial:"
        prefix_pattern = (
            r"^(?i:official\s+music\s+video|official\s+video|official\s+audio|"
            r"official\s+lyric\s+video|official|video\s+oficial|audio\s+oficial|visualizador\s+oficial)\s*[:-]?"
        )
        title = re.sub(prefix_pattern, "", title).strip()
        title = title.strip("\"' ")

        artist = (raw_artist or "").strip()
        queries: list[str] = []

        # Detectar separadores comunes en nombres de videos/archivos ("Artista - Canción" o "Canción - Artista")
        sep_match = re.search(r"\s+[-–—|:]\s+", title)
        detected_artist: Optional[str] = None
        clean_track_name = title

        if sep_match:
            part1 = title[: sep_match.start()].strip()
            part2 = title[sep_match.end() :].strip()

            # En el 90% de los casos en español (ej. "Ismael Rivera - Incomprendido"),
            # part1 es el artista y part2 es la canción.
            clean_track_name = part2
            detected_artist = part1

            # Generar variantes de búsqueda prioritarias
            queries.append(f"{part1} {part2}")
            queries.append(f"{part2} {part1}")
            queries.append(part2)
            queries.append(part1)

            # Variante sin corchetes o paréntesis residuales en part2
            clean_part2 = re.sub(r"[\(\[\{].*?[\)\]\}]", "", part2).strip()
            if clean_part2 and clean_part2 != part2:
                queries.append(f"{part1} {clean_part2}")
                queries.append(clean_part2)
        else:
            if artist:
                queries.append(f"{artist} {title}")
            queries.append(title)
            # Variante sin corchetes o paréntesis
            no_brackets = re.sub(r"[\(\[\{].*?[\)\]\}]", "", title).strip()
            if no_brackets and no_brackets != title:
                if artist:
                    queries.append(f"{artist} {no_brackets}")
                queries.append(no_brackets)

        if artist and f"{artist} {clean_track_name}" not in queries:
            queries.insert(0, f"{artist} {clean_track_name}")

        # Desduplicar preservando orden
        seen = set()
        unique_queries = []
        for q in queries:
            norm_q = " ".join(q.split())
            if norm_q and norm_q.lower() not in seen:
                seen.add(norm_q.lower())
                unique_queries.append(norm_q)

        effective_artist = artist if artist else detected_artist
        return clean_track_name, effective_artist, unique_queries

    async def fetch_lyrics_lrclib(
        self,
        track_name: str,
        artist_name: Optional[str] = None,
        duration: Optional[float] = None,
    ) -> LyricsResult:
        """
        Consulta la API de LRCLIB buscando la letra sincronizada de una canción
        mediante múltiples candidatos inteligentes y fallback a fuentes secundarias.

        Args:
            track_name: Nombre o título de la canción (o título de video/archivo).
            artist_name: Nombre del artista o banda (opcional).
            duration: Duración estimada de la canción en segundos (opcional).

        Returns:
            LyricsResult con las líneas sincronizadas o la letra plana distribuida.
        """
        clean_title, clean_artist, search_queries = self.clean_title_and_artist(
            track_name, artist_name
        )

        headers = {
            "User-Agent": "OIR-HarmonicRecognition/1.0 (https://o-ir.vercel.app)",
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=headers) as client:
                # 1. Si tenemos título y artista claros, intentar coincidencia exacta /get
                if clean_title and clean_artist:
                    params: dict[str, str | int] = {
                        "track_name": clean_title,
                        "artist_name": clean_artist,
                    }
                    if duration and duration > 0:
                        params["duration"] = int(round(duration))

                    try:
                        res = await client.get(f"{self.LRCLIB_BASE_URL}/get", params=params)
                        if res.status_code == 200:
                            data = res.json()
                            item_dur = float(data.get("duration") or 0.0)
                            # Validar que coincida con la duración acústica del audio (tolerancia ±22s para intros/silencios de YouTube)
                            if not duration or duration <= 0 or item_dur <= 0 or abs(item_dur - duration) <= 22.0:
                                synced_lrc = data.get("syncedLyrics")
                                plain_lyrics = data.get("plainLyrics")
                                if synced_lrc:
                                    return LyricsResult(
                                        is_synced=True,
                                        source="lrclib",
                                        lines=self.parse_lrc(synced_lrc),
                                        plain_lyrics=plain_lyrics,
                                        title=data.get("trackName") or clean_title,
                                        artist=data.get("artistName") or clean_artist,
                                    )
                    except Exception:
                        pass

                # 2. Iterar sobre los queries de búsqueda inteligentes con filtro acústico
                for query in search_queries:
                    try:
                        search_res = await client.get(
                            f"{self.LRCLIB_BASE_URL}/search", params={"q": query}
                        )

                        # Reintentar brevemente si LRCLIB está sobrecargado (503)
                        if search_res.status_code == 503:
                            import asyncio
                            await asyncio.sleep(0.4)
                            search_res = await client.get(
                                f"{self.LRCLIB_BASE_URL}/search", params={"q": query}
                            )

                        if search_res.status_code == 200:
                            items = search_res.json()
                            if isinstance(items, list) and len(items) > 0:
                                # Validación acústica: permitir intros/outros comunes en YouTube (±22s)
                                valid_items = []
                                if duration and duration > 0:
                                    valid_items = [
                                        it for it in items
                                        if it.get("duration") and abs(float(it.get("duration", 0)) - duration) <= 22.0
                                    ]
                                    # Si no hubo coincidencia en ±22s, buscar el candidato más cercano en ±45s
                                    if not valid_items:
                                        sorted_by_dur = sorted(
                                            [it for it in items if it.get("duration")],
                                            key=lambda it: abs(float(it.get("duration", 0)) - duration),
                                        )
                                        if sorted_by_dur and abs(float(sorted_by_dur[0].get("duration", 0)) - duration) <= 45.0:
                                            valid_items = [sorted_by_dur[0]]
                                else:
                                    valid_items = items

                                if valid_items:
                                    # Priorizar el primer resultado acústicamente válido que tenga letras sincronizadas
                                    best_item = next((it for it in valid_items if it.get("syncedLyrics")), valid_items[0])
                                    synced_lrc = best_item.get("syncedLyrics")
                                    plain_lyrics = best_item.get("plainLyrics")

                                    if synced_lrc:
                                        return LyricsResult(
                                            is_synced=True,
                                            source="lrclib",
                                            lines=self.parse_lrc(synced_lrc),
                                            plain_lyrics=plain_lyrics,
                                            title=best_item.get("trackName") or clean_title,
                                            artist=best_item.get("artistName") or clean_artist,
                                        )
                                    elif plain_lyrics:
                                        raw_lines = [l.strip() for l in plain_lyrics.splitlines() if l.strip()]
                                        total = len(raw_lines)
                                        step = (duration / total) if total > 0 and duration and duration > 0 else 4.0
                                        return LyricsResult(
                                            is_synced=True,
                                            source="lrclib",
                                            lines=[
                                                LyricLine(time=round(i * step, 2), text=text)
                                                for i, text in enumerate(raw_lines)
                                            ],
                                            plain_lyrics=plain_lyrics,
                                            title=best_item.get("trackName") or clean_title,
                                            artist=best_item.get("artistName") or clean_artist,
                                        )
                    except Exception:
                        continue

                # 3. Fallback a API secundaria de letras (lyrics.ovh)
                candidate_pairs = []
                if clean_artist and clean_title:
                    candidate_pairs.append((clean_artist, clean_title))
                if " - " in track_name:
                    p1, p2 = [p.strip() for p in track_name.split(" - ", 1)]
                    candidate_pairs.append((p1, p2))
                    candidate_pairs.append((p2, p1))

                for art, trk in candidate_pairs:
                    try:
                        clean_art_encoded = re.sub(r"[^\w\s]", "", art).strip()
                        clean_trk_encoded = re.sub(r"[^\w\s]", "", trk).strip()
                        ovh_res = await client.get(
                            f"https://api.lyrics.ovh/v1/{clean_art_encoded}/{clean_trk_encoded}",
                            timeout=4.0,
                        )
                        if ovh_res.status_code == 200:
                            data = ovh_res.json()
                            lyrics_text = data.get("lyrics", "").strip()
                            if lyrics_text:
                                raw_lines = [l.strip() for l in lyrics_text.splitlines() if l.strip()]
                                total = len(raw_lines)
                                step = (duration / total) if total > 0 and duration and duration > 0 else 4.0
                                return LyricsResult(
                                    is_synced=True,
                                    source="lyrics_ovh",
                                    lines=[
                                        LyricLine(time=round(i * step, 2), text=text)
                                        for i, text in enumerate(raw_lines)
                                    ],
                                    plain_lyrics=lyrics_text,
                                    title=trk,
                                    artist=art,
                                )
                    except Exception:
                        continue

        except Exception:
            pass

        return LyricsResult(
            is_synced=False,
            source="not_found",
            lines=[],
            plain_lyrics=None,
            title=clean_title or track_name,
            artist=clean_artist or artist_name,
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
        if not chords:
            return lyrics

        if not lyrics.lines:
            return LyricsResult(
                is_synced=False,
                source="not_found",
                lines=[],
                plain_lyrics=None,
                title=lyrics.title,
                artist=lyrics.artist,
            )

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
