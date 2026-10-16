"""
tests/test_transposition_service.py — Pruebas unitarias para el servicio de transposición y Capo
"""

import pytest
from services.transposition_service import TranspositionService


@pytest.fixture
def service():
    return TranspositionService()


def test_transpose_simple_chords(service):
    """Prueba la transposición básica de notas mayores y menores."""
    # C subido 2 semitonos debe ser D
    assert service.transpose_single_chord("C", 2) == "D"
    # G bajado 2 semitonos debe ser F
    assert service.transpose_single_chord("G", -2) == "F"
    # A subido 3 semitonos debe ser C
    assert service.transpose_single_chord("A", 3) == "C"


def test_transpose_with_extensions(service):
    """Verifica que sufijos como m, 7, sus4 se mantengan intactos."""
    assert service.transpose_single_chord("Am", 2) == "Bm"
    assert service.transpose_single_chord("Cmaj7", 2) == "Dmaj7"
    assert service.transpose_single_chord("Gsus4", 1) == "G#sus4"
    assert service.transpose_single_chord("Em7", 5) == "Am7"


def test_transpose_slash_chords(service):
    """Verifica que el bajo también se transponga correctamente."""
    assert service.transpose_single_chord("D/F#", 2) == "E/G#"
    assert service.transpose_single_chord("C/G", 2) == "D/A"


def test_capo_recommendation_for_difficult_song(service):
    """
    Una canción con F y Bb es difícil para un principiante.
    El servicio debe recomendar una posición de Capo para usar figuras abiertas.
    """
    chords = ["F", "Bb", "C", "Dm"]
    rec = service.calculate_best_capo(chords)

    assert rec is not None
    assert 1 <= rec.fret <= 7
    assert len(rec.transposed_shapes) == len(chords)
    assert rec.difficulty_reduction > 0
    assert "Capo en el traste" in rec.explanation


def test_transpose_list_endpoint_structure(service):
    """Verifica la respuesta completa de lista de acordes."""
    original = ["C", "G", "Am", "F"]
    res = service.transpose_chords(original, 2)

    assert res.semitones == 2
    assert res.original_chords == original
    assert res.transposed_chords == ["D", "A", "Bm", "G"]
