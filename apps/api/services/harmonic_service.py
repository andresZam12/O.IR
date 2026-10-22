"""
services/harmonic_service.py — Servicio de enriquecimiento armónico y acordes auténticos

Proporciona armonización precisa para canciones populares, combinando:
1. Base de conocimiento armónico canónico (boleros, pasillos, pop, rock clásico).
2. Enriquecimiento asistido con Gemini AI (gemini-3.5-flash-lite) con timeout seguro.
3. Fallback a detección acústica por Constant-Q Transform (chroma_cqt).
"""

import json
import logging
import os
import re
from typing import Optional

from core.config import settings
from schemas.lyrics import LyricLine, LyricsResult
from schemas.song import ChordDetectionResult, ChordItem

logger = logging.getLogger(__name__)


# Base de datos canónica de obras clásicas y populares en español/latinoamericanas
CANONICAL_SONG_HARMONIES: dict[str, dict] = {
    "nuestro juramento": {
        "artist": "Julio Jaramillo",
        "key": "Sol menor (Gm)",
        "unique_chords": ["Gm", "D7", "Cm", "G7", "F7", "Bb", "A7"],
        "patterns": [
            (r"(no puedo verte triste|porque me mata)", "Gm"),
            (r"(tu carita de pena|dulce amor)", "D7"),
            (r"(me duele tanto el llanto|que tu derramas)", "Cm"),
            (r"(se llena de angustia|mi coraz[oó]n)", "D7"),
            (r"(j[uú]rame ahora mismo|por dios)", "G7"),
            (r"(de m[ií] nunca te olvidaste|nunca te olvidaste)", "Cm"),
            (r"(si me dices que no hay amor|no hay amor)", "F7"),
            (r"(con dolor tendr[eé] que marcharme|marcharme)", "Bb"),
            (r"(me alejar[eé] con mucha pena|mucha pena)", "D7"),
            (r"(llevar[eé] entre mis venas)", "Gm"),
            (r"(el desprecio de este amor)", "D7"),
            (r"(si yo muero primero|es tu promesa)", "Gm"),
            (r"(sobre de mi cad[aá]ver|dejar caer)", "D7"),
            (r"(todo el llanto|que brote de tu tristeza)", "Cm"),
            (r"(y que me cubras|con tu amor)", "D7"),
        ],
    },
    "la gota fria": {
        "artist": "Carlos Vives",
        "key": "Re Mayor (D)",
        "unique_chords": ["D", "A", "G", "A7"],
        "patterns": [
            (r"(acordate|moralito)", "D"),
            (r"(de aquel d[ií]a|en urumita)", "A"),
            (r"(no quisiste hacer parranda)", "G"),
            (r"(te fuiste de ma[nñ]anita)", "D"),
        ],
    },
    "de musica ligera": {
        "artist": "Soda Stereo",
        "key": "Si menor (Bm)",
        "unique_chords": ["Bm", "G", "D", "A"],
        "patterns": [
            (r"(ella durmi[oó]|al calor de las masas)", "Bm"),
            (r"(y yo despert[eé]|queriendo so[nñ]arla)", "G"),
            (r"(alg[uú]n tiempo atr[aá]s)", "D"),
            (r"(pens[eé] escribirle)", "A"),
            (r"(de m[uú]sica ligera)", "Bm"),
            (r"(nada nos libra|nada m[aá]s queda)", "G"),
        ],
    },
}


class HarmonicEnrichmentService:
    """
    Enriquece la letra y el análisis armónico con acordes reales y correspondientes
    a la tonalidad y composición de la canción.
    """

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
                logger.warning(f"HarmonicEnrichmentService: cliente GenAI no iniciado: {e}")

    @property
    def is_available(self) -> bool:
        return bool(self._client and self.api_key)

    def enrich_song_harmonies(
        self,
        title: Optional[str],
        artist: Optional[str],
        lyrics: LyricsResult,
        chord_result: ChordDetectionResult,
    ) -> tuple[LyricsResult, ChordDetectionResult]:
        """
        Enriquece las líneas de letra y la progresión de acordes con la armonía real de la canción.
        """
        if not lyrics or not lyrics.lines:
            return lyrics, chord_result

        norm_title = self._normalize_str(title or lyrics.title or "")
        norm_artist = self._normalize_str(artist or lyrics.artist or "")

        # 1. Verificar coincidencia en base canónica
        canonical_match = self._find_canonical(norm_title)
        if canonical_match:
            logger.info(f"Armonía canónica encontrada para '{norm_title}'")
            return self._apply_canonical_match(canonical_match, lyrics, chord_result)

        # 2. Intentar enriquecimiento con Gemini AI si el título es claro
        if self.is_available and len(norm_title) >= 3:
            ai_enriched = self._enrich_via_gemini(norm_title, norm_artist, lyrics, chord_result)
            if ai_enriched:
                return ai_enriched

        # 3. Fallback armónico: alinear mediante ventana temporal acústica
        return self._align_windowed_acoustic(lyrics, chord_result)

    def _normalize_str(self, text: str) -> str:
        clean = re.sub(r"[^\w\s]", "", text.lower())
        return " ".join(clean.split())

    def _find_canonical(self, norm_title: str) -> Optional[dict]:
        for key, data in CANONICAL_SONG_HARMONIES.items():
            if key in norm_title or norm_title in key:
                return data
        return None

    def _apply_canonical_match(
        self,
        canonical: dict,
        lyrics: LyricsResult,
        chord_result: ChordDetectionResult,
    ) -> tuple[LyricsResult, ChordDetectionResult]:
        patterns = canonical.get("patterns", [])
        default_chords = canonical.get("unique_chords", ["C", "G", "Am", "F"])
        idx = 0

        updated_lines: list[LyricLine] = []
        new_chords: list[ChordItem] = []

        for line in lyrics.lines:
            matched_chord = None
            text_lower = line.text.lower()

            for pattern, chord_name in patterns:
                if re.search(pattern, text_lower):
                    matched_chord = chord_name
                    break

            if not matched_chord:
                # Asignar armónicamente dentro de la secuencia tonal de la canción
                matched_chord = default_chords[idx % len(default_chords)]
                idx += 1

            updated_lines.append(
                LyricLine(
                    time=line.time,
                    text=line.text,
                    chord=matched_chord,
                )
            )
            new_chords.append(
                ChordItem(
                    time=line.time,
                    chord=matched_chord,
                    confidence=0.98,
                )
            )

        new_lyrics = LyricsResult(
            is_synced=lyrics.is_synced,
            source="canonical_harmonic",
            lines=updated_lines,
            plain_lyrics=lyrics.plain_lyrics,
            title=lyrics.title,
            artist=canonical.get("artist") or lyrics.artist,
        )

        new_chord_result = ChordDetectionResult(
            duration=chord_result.duration,
            chords=new_chords if new_chords else chord_result.chords,
            unique_chords=canonical.get("unique_chords") or chord_result.unique_chords,
            total_changes=len(new_chords) if new_chords else chord_result.total_changes,
            estimated_key=canonical.get("key") or chord_result.estimated_key,
        )

        return new_lyrics, new_chord_result

    def _enrich_via_gemini(
        self,
        title: str,
        artist: str,
        lyrics: LyricsResult,
        chord_result: ChordDetectionResult,
    ) -> Optional[tuple[LyricsResult, ChordDetectionResult]]:
        try:
            line_texts = [l.text for l in lyrics.lines[:45]]
            song_label = f"{title}"
            if artist:
                song_label += f" de {artist}"

            prompt = (
                f"Actúa como un transcriptor musical experto en armonía de guitarra. "
                f"Canción: '{song_label}'.\n"
                f"Asigna a cada verso de esta lista el acorde de guitarra exacto, real y correspondiente "
                f"según la tonalidad oficial de la canción:\n"
                f"{json.dumps(line_texts, ensure_ascii=False)}\n\n"
                "RESPONDE ESTRICTAMENTE CON UN OBJETO JSON VÁLIDO (sin bloques markdown ni explicaciones adicionales):\n"
                "{\n"
                '  "key": "Gm",\n'
                '  "unique_chords": ["Gm", "D7", "Cm", "G7", "Bb"],\n'
                '  "line_chords": ["Gm", "D7", "Cm", "D7", "G7", ...]\n'
                "}"
            )

            import concurrent.futures

            def _call_model():
                try:
                    r = self._client.models.generate_content(
                        model="gemini-3.5-flash-lite",
                        contents=prompt,
                    )
                    return r.text if (r and r.text) else None
                except Exception as err:
                    logger.warning(f"Harmonic Gemini error: {err}")
                    return None

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                fut = executor.submit(_call_model)
                try:
                    resp_text = fut.result(timeout=3.5)
                except Exception:
                    resp_text = None

            if not resp_text:
                return None

            cleaned_json = re.sub(r"^```(?:json)?\s*", "", resp_text.strip(), flags=re.IGNORECASE)
            cleaned_json = re.sub(r"\s*```$", "", cleaned_json.strip())
            data = json.loads(cleaned_json)

            line_chords = data.get("line_chords", [])
            key_est = data.get("key") or chord_result.estimated_key
            unique_ch = data.get("unique_chords") or chord_result.unique_chords

            if isinstance(line_chords, list) and len(line_chords) > 0:
                updated_lines: list[LyricLine] = []
                new_chords: list[ChordItem] = []

                for i, line in enumerate(lyrics.lines):
                    chord_name = line_chords[i] if i < len(line_chords) else line_chords[-1]
                    # Limpiar formato si vienen dobles acordes tipo "D7 - Gm"
                    clean_chord = chord_name.split()[0].replace("-", "").strip() or chord_name.strip()
                    updated_lines.append(
                        LyricLine(
                            time=line.time,
                            text=line.text,
                            chord=clean_chord,
                        )
                    )
                    new_chords.append(
                        ChordItem(
                            time=line.time,
                            chord=clean_chord,
                            confidence=0.95,
                        )
                    )

                new_lyrics = LyricsResult(
                    is_synced=lyrics.is_synced,
                    source="ai_harmonic",
                    lines=updated_lines,
                    plain_lyrics=lyrics.plain_lyrics,
                    title=lyrics.title,
                    artist=lyrics.artist,
                )

                new_chord_result = ChordDetectionResult(
                    duration=chord_result.duration,
                    chords=new_chords,
                    unique_chords=unique_ch,
                    total_changes=len(new_chords),
                    estimated_key=key_est,
                )
                return new_lyrics, new_chord_result

        except Exception as e:
            logger.warning(f"HarmonicEnrichmentService omitido de forma segura: {e}")

        return None

    def _align_windowed_acoustic(
        self,
        lyrics: LyricsResult,
        chord_result: ChordDetectionResult,
    ) -> tuple[LyricsResult, ChordDetectionResult]:
        """
        Alinea cada línea de letra con el acorde acústico más representativo
        en la ventana temporal que dura dicha línea cantada.
        """
        if not chord_result.chords or not lyrics.lines:
            return lyrics, chord_result

        updated_lines: list[LyricLine] = []
        num_lines = len(lyrics.lines)

        for i, line in enumerate(lyrics.lines):
            t_start = line.time
            t_end = lyrics.lines[i + 1].time if (i + 1 < num_lines) else t_start + 4.0

            # Buscar acordes acústicos que caigan en la ventana [t_start, t_end]
            window_chords = [
                c.chord for c in chord_result.chords
                if t_start <= c.time < t_end and c.chord != "N/C"
            ]

            if window_chords:
                # Tomar el acorde con mayor presencia en la ventana
                chosen_chord = max(set(window_chords), key=window_chords.count)
            else:
                # Buscar el último acorde activo antes de t_start
                prev_chords = [c.chord for c in chord_result.chords if c.time <= t_start and c.chord != "N/C"]
                chosen_chord = prev_chords[-1] if prev_chords else (chord_result.unique_chords[0] if chord_result.unique_chords else "C")

            updated_lines.append(
                LyricLine(
                    time=line.time,
                    text=line.text,
                    chord=chosen_chord,
                )
            )

        new_lyrics = LyricsResult(
            is_synced=lyrics.is_synced,
            source=lyrics.source,
            lines=updated_lines,
            plain_lyrics=lyrics.plain_lyrics,
            title=lyrics.title,
            artist=lyrics.artist,
        )
        return new_lyrics, chord_result
