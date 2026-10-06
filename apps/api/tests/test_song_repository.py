"""
tests/test_song_repository.py — Pruebas unitarias para el repositorio de canciones y caché
"""

import tempfile
import os
import pytest

from repositories.song_repository import SongRepository


def test_youtube_url_normalization():
    """Verifica que URLs equivalentes de YouTube generen la misma clave de caché."""
    url1 = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    url2 = "  HTTPS://WWW.YOUTUBE.COM/WATCH?V=dQw4w9WgXcQ  "

    hash1 = SongRepository.normalize_youtube_url(url1)
    hash2 = SongRepository.normalize_youtube_url(url2)

    assert hash1 == hash2
    assert len(hash1) == 64  # Longitud de SHA-256


def test_file_hash_generation():
    """Verifica el cálculo de hash SHA-256 en un archivo temporal de audio."""
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(b"fake audio data 12345")
        tmp_path = tmp.name

    try:
        file_hash = SongRepository.generate_file_hash(tmp_path)
        assert len(file_hash) == 64
        # Mismo contenido debe dar el mismo hash
        assert file_hash == SongRepository.generate_file_hash(tmp_path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_local_cache_save_and_retrieve():
    """Verifica que el repositorio guarde y recupere datos procesados en su caché."""
    repo = SongRepository()
    test_id = "test_song_123"
    test_data = {
        "status": "success",
        "duration": 150.0,
        "unique_chords": ["C", "G", "Am", "F"],
        "estimated_key": "C Major",
    }

    # Inicialmente no debe existir
    assert repo.get_by_identifier(test_id) is None

    # Guardar
    repo.save(identifier=test_id, source="upload", result_data=test_data)

    # Recuperar
    cached = repo.get_by_identifier(test_id)
    assert cached is not None
    assert cached["estimated_key"] == "C Major"
    assert cached["unique_chords"] == ["C", "G", "Am", "F"]
