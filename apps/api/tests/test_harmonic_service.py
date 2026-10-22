"""
tests/test_harmonic_service.py — Pruebas unitarias para HarmonicEnrichmentService
"""

from schemas.lyrics import LyricLine, LyricsResult
from schemas.song import ChordDetectionResult, ChordItem
from services.harmonic_service import HarmonicEnrichmentService


def test_canonical_song_harmonic_enrichment():
    svc = HarmonicEnrichmentService()
    lyrics = LyricsResult(
        is_synced=True,
        source="test",
        lines=[
            LyricLine(time=10.0, text="Júrame ahora mismo por Dios"),
            LyricLine(time=14.0, text="Y que de mí nunca te olvidaste"),
            LyricLine(time=18.0, text="Y si me dices que no hay amor"),
            LyricLine(time=22.0, text="Con dolor tendré que marcharme"),
            LyricLine(time=26.0, text="Me alejaré con mucha pena, llevaré entre mis venas"),
            LyricLine(time=30.0, text="El desprecio de este amor"),
        ],
        title="Nuestro Juramento",
        artist="Julio Jaramillo",
    )
    chord_res = ChordDetectionResult(
        duration=60.0,
        chords=[ChordItem(time=0.0, chord="Em", confidence=0.5)],
        unique_chords=["Em"],
        total_changes=1,
        estimated_key="E Minor",
    )

    new_lyrics, new_chords = svc.enrich_song_harmonies(
        title="Nuestro Juramento",
        artist="Julio Jaramillo",
        lyrics=lyrics,
        chord_result=chord_res,
    )

    assert "Gm" in new_chords.estimated_key or "Sol menor" in new_chords.estimated_key
    assert "Gm" in new_chords.unique_chords
    assert "D7" in new_chords.unique_chords
    assert "Cm" in new_chords.unique_chords

    # Verificar que los versos tengan acordes correspondientes legítimos
    assert new_lyrics.lines[0].chord == "G7"
    assert new_lyrics.lines[1].chord == "Cm"
    assert new_lyrics.lines[2].chord == "F7"
    assert new_lyrics.lines[3].chord == "Bb"
