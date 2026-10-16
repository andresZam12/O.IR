"""
services/transposition_service.py — Servicio de transposición de acordes y cálculo de cejilla (Capo)

Permite a los principiantes transportar tonalidades y calcular la posición
óptima del Capotasto para evitar acordes con cejilla difíciles.
"""

import re
from typing import List, Optional, Tuple
from schemas.transposition import CapoRecommendation, TransposeResponse


class TranspositionService:
    """Servicio con teoría musical para transposición cromática y optimización de Capo."""

    # Escala cromática estándar
    NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

    # Diccionario de normalización de enarmónicos
    ENHARMONIC_MAP = {
        "Db": "C#",
        "Eb": "D#",
        "Gb": "F#",
        "Ab": "G#",
        "Bb": "A#",
        "B#": "C",
        "Cb": "B",
        "E#": "F",
        "Fb": "E",
    }

    # Acordes abiertos considerados fáciles para un principiante de guitarra/teclado
    EASY_OPEN_CHORDS = {
        "C", "G", "D", "A", "E", "Am", "Em", "Dm",
        "C7", "G7", "D7", "A7", "E7", "Am7", "Em7", "Cadd9"
    }

    # Acordes típicos con cejilla que frustran a principiantes
    BARRE_CHORDS = {
        "F", "Fm", "F#", "F#m", "B", "Bm", "Bb", "Bbm",
        "C#", "C#m", "G#", "G#m", "D#", "D#m", "Eb", "Ebm", "Ab", "Abm"
    }

    @classmethod
    def normalize_root(cls, root: str) -> str:
        """Normaliza la nota raíz a su equivalente con sostenido."""
        return cls.ENHARMONIC_MAP.get(root, root)

    @classmethod
    def transpose_single_chord(cls, chord: str, semitones: int) -> str:
        """
        Transpone un acorde individual preservando sus extensiones (menor, 7, sus4, etc.).
        Ejemplo: 'C#m7' + 2 semitonos -> 'D#m7' (o 'Ebm7').
        """
        if not chord or chord in ("N", "Unknown", "?"):
            return chord

        # Expresión regular para separar la nota raíz (y accidental) del sufijo y bajo opcional
        # Grupo 1: Raíz (A-G con # o b opcional)
        # Grupo 2: Sufijo (m, maj7, 7, sus4, etc.)
        # Grupo 3: Nota de bajo opcional (/G)
        match = re.match(r"^([A-Ga-g][#b]?)(.*?)(\/([A-Ga-g][#b]?))?$", chord.strip())
        if not match:
            return chord

        root = match.group(1).capitalize()
        suffix = match.group(2) or ""
        has_slash = bool(match.group(3))
        bass_note = match.group(4).capitalize() if match.group(4) else None

        normalized_root = cls.normalize_root(root)
        if normalized_root not in cls.NOTES_SHARP:
            return chord

        current_idx = cls.NOTES_SHARP.index(normalized_root)
        target_idx = (current_idx + semitones) % 12
        new_root = cls.NOTES_SHARP[target_idx]

        # Si el acorde original usaba bemoles (como Bb o Eb), preferir salida con bemol
        if "b" in root and cls.NOTES_FLAT[target_idx] != new_root:
            new_root = cls.NOTES_FLAT[target_idx]

        # Transponer nota de bajo si existe (ej. D/F#)
        new_bass = ""
        if has_slash and bass_note:
            norm_bass = cls.normalize_root(bass_note)
            if norm_bass in cls.NOTES_SHARP:
                bass_idx = (cls.NOTES_SHARP.index(norm_bass) + semitones) % 12
                new_bass = "/" + cls.NOTES_SHARP[bass_idx]

        return f"{new_root}{suffix}{new_bass}"

    def transpose_chords(self, chords: List[str], semitones: int) -> TransposeResponse:
        """Transpone una lista de acordes y calcula recomendaciones de Capo."""
        transposed = [self.transpose_single_chord(c, semitones) for c in chords]
        capo_rec = self.calculate_best_capo(chords)

        return TransposeResponse(
            semitones=semitones,
            original_chords=chords,
            transposed_chords=transposed,
            capo_suggestion=capo_rec,
        )

    def calculate_best_capo(self, chords: List[str]) -> Optional[CapoRecommendation]:
        """
        Busca entre los trastes 1 al 7 la posición de Capo que minimice los
        acordes con cejilla y maximice las posiciones abiertas para principiantes.
        """
        unique_chords = list(dict.fromkeys([c for c in chords if c and c not in ("N", "Unknown")]))
        if not unique_chords:
            return None

        # Contar cuántos acordes con cejilla tiene el arreglo original
        original_barres = sum(1 for c in unique_chords if self._is_barre(c))
        if original_barres == 0 and len(unique_chords) <= 4:
            return None  # Ya es muy fácil, no necesita cejilla

        best_fret = None
        best_score = -999
        best_shapes = []

        # El Capo en traste N hace sonar la canción N semitonos más aguda,
        # por lo que el músico toca las figuras transportadas -N semitonos.
        for fret in range(1, 8):
            shapes = [self.transpose_single_chord(c, -fret) for c in unique_chords]
            easy_count = sum(1 for s in shapes if s in self.EASY_OPEN_CHORDS)
            barre_count = sum(1 for s in shapes if self._is_barre(s))

            # Puntaje: premiar acordes fáciles y penalizar cejillas
            score = (easy_count * 2) - (barre_count * 3)

            if score > best_score:
                best_score = score
                best_fret = fret
                best_shapes = shapes

        if best_fret is None or best_score <= 0:
            return None

        reduction = min(90, max(20, int((original_barres / max(1, len(unique_chords))) * 100)))

        return CapoRecommendation(
            fret=best_fret,
            transposed_shapes=best_shapes,
            difficulty_reduction=reduction,
            explanation=(
                f"Coloca el Capo en el traste {best_fret}. Podrás tocar la canción usando formas de acordes "
                f"abiertas y cómodas ({', '.join(best_shapes[:4])}) sonando exactamente en el tono original."
            ),
        )

    def _is_barre(self, chord: str) -> bool:
        """Determina si un acorde suele requerir cejilla en guitarra."""
        # Remover bajo si existe
        main = chord.split("/")[0].strip()
        return main in self.BARRE_CHORDS
