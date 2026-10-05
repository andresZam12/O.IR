"""
tests/test_chord_service.py — Pruebas unitarias para ChordDetectionService
"""

import numpy as np
import pytest

from services.chord_service import ChordDetectionService
from schemas.song import ChordDetectionResult, ChordItem


def test_chord_templates_generation():
    """Verifica que se generen exactamente 24 plantillas (12 mayores y 12 menores)."""
    service = ChordDetectionService()
    templates = service._templates

    assert len(templates) == 24
    assert "C" in templates
    assert "Am" in templates
    assert "F#" in templates
    assert "Bbm" not in templates  # Usamos notación con sostenidos
    assert "A#m" in templates

    # Cada plantilla debe tener exactamente 12 componentes binarios con 3 notas activas
    for chord_name, vec in templates.items():
        assert vec.shape == (12,)
        assert np.sum(vec) == 3.0


def test_empty_audio_handling():
    """Verifica que un audio vacío devuelva un resultado seguro sin errores."""
    service = ChordDetectionService()
    empty_audio = np.array([], dtype=np.float32)

    result = service.detect_chords_from_audio(empty_audio, sample_rate=22050, duration=0.0)

    assert isinstance(result, ChordDetectionResult)
    assert result.duration == 0.0
    assert result.total_changes == 0
    assert len(result.chords) == 0


def test_synthetic_sine_tone_detection():
    """Verifica la detección en una señal sintética de tonos de la tríada de Do Mayor (C - E - G)."""
    service = ChordDetectionService()
    sample_rate = 22050
    duration = 2.0  # 2 segundos
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)

    # Frecuencias fundamentales de C4 (261.63 Hz), E4 (329.63 Hz), G4 (392.00 Hz)
    f_c = 261.63
    f_e = 329.63
    f_g = 392.00

    # Generar acorde sintetizado
    signal = np.sin(2 * np.pi * f_c * t) + np.sin(2 * np.pi * f_e * t) + np.sin(2 * np.pi * f_g * t)
    signal = (signal / np.max(np.abs(signal))).astype(np.float32)

    result = service.detect_chords_from_audio(signal, sample_rate=sample_rate, duration=duration)

    assert isinstance(result, ChordDetectionResult)
    assert result.duration == 2.0
    assert len(result.chords) > 0

    # El acorde dominante debe ser C o estar en la lista de acordes únicos
    assert "C" in result.unique_chords
