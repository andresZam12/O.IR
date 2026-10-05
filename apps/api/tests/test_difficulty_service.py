"""
tests/test_difficulty_service.py — Pruebas unitarias para DifficultyService
"""

import pytest
from services.difficulty_service import DifficultyService
from schemas.song import ChordDetectionResult, ChordItem


def test_beginner_song_evaluation():
    """Verifica que una progresión con acordes abiertos (C, G, Am, F no presente) sea nivel principiante."""
    service = DifficultyService()

    chord_result = ChordDetectionResult(
        duration=180.0,
        unique_chords=["C", "G", "Am", "Em"],
        total_changes=20,  # ~6.6 CPM (muy pausado)
        chords=[ChordItem(time=0.0, chord="C", confidence=0.9)],
        estimated_key="C Major",
    )

    evaluation = service.evaluate_song(chord_result)

    assert evaluation.metrics.level == "Principiante"
    assert evaluation.metrics.score <= 4.0
    assert evaluation.metrics.barre_chord_count == 0
    assert evaluation.metrics.unique_chord_count == 4
    assert len(evaluation.practice_tips) > 0
    assert "principiantes" in evaluation.explanation.lower()


def test_barre_chord_detection_and_tips():
    """Verifica que si aparece un acorde con cejilla (como F o Bm), se identifique y agregue el tip correspondiente."""
    service = DifficultyService()

    chord_result = ChordDetectionResult(
        duration=120.0,
        unique_chords=["C", "G", "Am", "F", "Bm"],
        total_changes=45,  # 22.5 CPM
        chords=[ChordItem(time=0.0, chord="C", confidence=0.9)],
        estimated_key="C Major",
    )

    evaluation = service.evaluate_song(chord_result)

    assert evaluation.metrics.barre_chord_count == 2
    assert "F" in evaluation.metrics.barre_chords_present
    assert "Bm" in evaluation.metrics.barre_chords_present
    assert evaluation.metrics.score > 4.0

    # Debe contener un consejo explícito para la técnica de cejilla
    has_barre_tip = any("cejilla" in tip.lower() for tip in evaluation.practice_tips)
    assert has_barre_tip is True
