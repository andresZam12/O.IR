"""
services/difficulty_service.py — Servicio de cálculo de dificultad y pedagogía musical

Calcula un puntaje objetivo de 1 a 10 evaluando:
1. Cantidad de acordes distintos (riqueza armónica).
2. Presencia y cantidad de acordes con cejilla (barre chords).
3. Cambios de acorde por minuto (CPM - velocidad motriz requerida).
4. Tempo musical en BPM (si está disponible).
Genera una explicación comprensible y consejos prácticos para el principiante.
"""

from typing import Optional
from schemas.difficulty import DifficultyMetrics, DifficultyEvaluation
from schemas.song import ChordDetectionResult


class DifficultyService:
    """
    Servicio de evaluación de dificultad técnica instrumental.
    Traduce variables cuantitativas musicales a retroalimentación educativa accionable.
    """

    # Acordes que comúnmente requieren postura de cejilla completa en guitarra y ukelele
    # (Los acordes abiertos estándares son: C, D, E, G, A, Em, Am, Dm)
    BARRE_CHORDS: set[str] = {
        "F", "Fm", "F#", "F#m",
        "G#", "G#m", "A#", "A#m",
        "B", "Bm", "C#", "C#m",
        "D#", "D#m", "Cm", "Gm"
    }

    def evaluate_song(
        self, chord_result: ChordDetectionResult, tempo_bpm: Optional[float] = None
    ) -> DifficultyEvaluation:
        """
        Evalúa el resultado de detección de una canción y genera la dificultad y tips.

        Args:
            chord_result: Resultado estructurado de acordes de la canción.
            tempo_bpm: Tempo opcional en BPM.

        Returns:
            DifficultyEvaluation con métricas numéricas, nivel y consejos pedagógicos.
        """
        unique_chords = [c for c in chord_result.unique_chords if c != "N/C"]
        unique_count = len(unique_chords)
        total_changes = chord_result.total_changes
        duration = max(chord_result.duration, 1.0)

        # 1. Detección de acordes con cejilla
        barre_chords = [c for c in unique_chords if c in self.BARRE_CHORDS]
        barre_count = len(barre_chords)

        # 2. Cambios de acorde por minuto (CPM)
        cpm = round((total_changes / duration) * 60.0, 1)

        # 3. Cálculo de la puntuación objetiva (1.0 a 10.0)
        raw_score = 1.0

        # Componente A: Riqueza de acordes (hasta +3.0)
        if unique_count <= 3:
            raw_score += 0.5
        elif unique_count <= 5:
            raw_score += 1.5
        elif unique_count <= 7:
            raw_score += 2.2
        else:
            raw_score += 3.0

        # Componente B: Acordes con cejilla (hasta +3.5)
        if barre_count == 0:
            raw_score += 0.0
        elif barre_count == 1:
            raw_score += 1.6
        elif barre_count == 2:
            raw_score += 2.6
        else:
            raw_score += 3.5

        # Componente C: Velocidad de transiciones CPM (hasta +2.5)
        if cpm < 15.0:
            raw_score += 0.5
        elif cpm <= 25.0:
            raw_score += 1.2
        elif cpm <= 40.0:
            raw_score += 1.8
        else:
            raw_score += 2.5

        # Ajuste leve por tempo si es rápido (>135 BPM)
        if tempo_bpm and tempo_bpm > 135:
            raw_score += 0.5

        # Acotar puntaje entre 1.0 y 10.0
        score = round(min(10.0, max(1.0, raw_score)), 1)

        # 4. Clasificación cualitativa
        if score <= 4.0:
            level = "Principiante"
        elif score <= 7.0:
            level = "Intermedio"
        else:
            level = "Avanzado"

        metrics = DifficultyMetrics(
            score=score,
            level=level,
            unique_chord_count=unique_count,
            barre_chord_count=barre_count,
            barre_chords_present=barre_chords,
            changes_per_minute=cpm,
            tempo_bpm=tempo_bpm,
        )

        # 5. Generación de explicación y consejos prácticos
        explanation = self._build_explanation(metrics, unique_chords)
        tips = self._build_practice_tips(metrics, barre_chords)

        return DifficultyEvaluation(
            metrics=metrics,
            explanation=explanation,
            practice_tips=tips,
        )

    def _build_explanation(self, metrics: DifficultyMetrics, unique_chords: list[str]) -> str:
        """Genera una explicación comprensible en lenguaje cotidiano."""
        if metrics.level == "Principiante":
            if metrics.barre_chord_count == 0:
                return (
                    f"Canción muy accesible para principiantes (Puntaje: {metrics.score}/10). "
                    f"Utiliza {metrics.unique_chord_count} acordes abiertos ({', '.join(unique_chords)}) "
                    f"sin necesidad de cejillas y con un ritmo de cambios moderado ({metrics.changes_per_minute} cambios/min)."
                )
            else:
                return (
                    f"Nivel principiante con un pequeño reto (Puntaje: {metrics.score}/10). "
                    f"La progresión es sencilla, pero incluye {metrics.barre_chord_count} acorde con cejilla ({', '.join(metrics.barre_chords_present)})."
                )

        elif metrics.level == "Intermedio":
            reasons = []
            if metrics.barre_chord_count > 0:
                reasons.append(f"{metrics.barre_chord_count} acorde(s) con cejilla ({', '.join(metrics.barre_chords_present)})")
            if metrics.changes_per_minute > 25.0:
                reasons.append(f"cambios frecuentes ({metrics.changes_per_minute} por minuto)")
            if metrics.unique_chord_count >= 5:
                reasons.append(f"una variedad de {metrics.unique_chord_count} acordes")

            return (
                f"Nivel intermedio (Puntaje: {metrics.score}/10). "
                f"Presenta desafíos técnicos como: {', '.join(reasons)}."
            )

        else:
            return (
                f"Nivel avanzado (Puntaje: {metrics.score}/10). "
                f"Exige agilidad técnica considerable: {metrics.unique_chord_count} acordes en total, "
                f"{metrics.barre_chord_count} con cejilla y una alta velocidad de transición ({metrics.changes_per_minute} cambios/min)."
            )

    def _build_practice_tips(
        self, metrics: DifficultyMetrics, barre_chords: list[str]
    ) -> list[str]:
        """Produce consejos concretos adaptados a las dificultades identificadas."""
        tips: list[str] = []

        if metrics.barre_chord_count > 0:
            tips.append(
                f"Para los acordes con cejilla ({', '.join(barre_chords)}), mantén el pulgar detrás del mástil a media altura y rota ligeramente el dedo índice sobre su borde lateral para mayor presión."
            )

        if metrics.changes_per_minute > 25.0:
            tips.append(
                "La velocidad de cambio es ágil. Practica las transiciones en bucles de 2 acordes con metrónomo al 60% de la velocidad antes de acelerar."
            )
        else:
            tips.append(
                "El ritmo de cambio es cómodo. Concéntrate en que todas las cuerdas suenen limpias sin rozar cuerdas vecinas."
            )

        if metrics.unique_chord_count <= 4:
            tips.append(
                "Esta canción tiene una estructura armónica cíclica. Memoriza el orden de los 4 acordes para tocarla fluidamente de memoria."
            )
        else:
            tips.append(
                "Divide la canción por secciones (estrofa, coro, puente) y domina los acordes de cada sección por separado."
            )

        return tips
