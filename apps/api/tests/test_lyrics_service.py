"""
tests/test_lyrics_service.py — Pruebas unitarias para LyricsService y parser de LRC
"""

import pytest
from services.lyrics_service import LyricsService
from schemas.lyrics import LyricLine, LyricsResult
from schemas.song import ChordItem


def test_parse_lrc_standard_format():
    """Verifica que el parser convierta marcas [mm:ss.xx] a segundos flotantes correctamente."""
    service = LyricsService()
    lrc_sample = """
    [ti:De Música Ligera]
    [ar:Soda Stereo]
    [00:15.50] Ella durmió
    [00:18.25] Al calor de las masas
    [01:04.10] De música ligera
    """

    lines = service.parse_lrc(lrc_sample)

    assert len(lines) == 3
    assert lines[0].time == 15.50
    assert lines[0].text == "Ella durmió"

    assert lines[1].time == 18.25
    assert lines[1].text == "Al calor de las masas"

    assert lines[2].time == 64.10
    assert lines[2].text == "De música ligera"


def test_parse_lrc_empty_or_metadata_only():
    """Verifica que un archivo sin marcas de tiempo devuelva una lista vacía."""
    service = LyricsService()
    sample = "[ti:Test]\n[ar:Artist]\n[al:Album]"
    lines = service.parse_lrc(sample)
    assert len(lines) == 0


def test_align_chords_with_lyrics():
    """Verifica que los acordes se alineen con la línea temporal correspondiente."""
    service = LyricsService()

    lyrics = LyricsResult(
        is_synced=True,
        source="lrclib",
        lines=[
            LyricLine(time=10.0, text="Línea 1"),
            LyricLine(time=25.0, text="Línea 2"),
            LyricLine(time=40.0, text="Línea 3"),
        ],
    )

    chords = [
        ChordItem(time=0.0, chord="C", confidence=0.9),
        ChordItem(time=20.0, chord="Am", confidence=0.85),
        ChordItem(time=35.0, chord="F", confidence=0.88),
    ]

    aligned = service.align_chords_with_lyrics(lyrics, chords)

    assert len(aligned.lines) == 3
    # A t=10.0, el acorde activo es C (comenzó en t=0)
    assert aligned.lines[0].chord == "C"
    # A t=25.0, el acorde activo es Am (comenzó en t=20)
    assert aligned.lines[1].chord == "Am"
    # A t=40.0, el acorde activo es F (comenzó en t=35)
    assert aligned.lines[2].chord == "F"
