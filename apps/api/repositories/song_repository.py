"""
repositories/song_repository.py — Patrón Repository para caché y persistencia de canciones

Permite consultar y almacenar canciones analizadas en Supabase (PostgreSQL).
Si las credenciales de Supabase no están configuradas en el entorno local,
utiliza una caché segura en memoria/archivo para desarrollo continuo sin interrupciones.
"""

import hashlib
import os
import json
from typing import Optional

from core.config import settings

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None  # type: ignore
    Client = None  # type: ignore


class SongRepository:
    """
    Repositorio para la persistencia y lectura de resultados de canciones procesadas.
    Implementa el patrón Repository desacoplando la capa de servicios de la base de datos.
    """

    CACHE_TABLE = "processed_songs"

    def __init__(self) -> None:
        """Inicializa el cliente de Supabase si las credenciales están disponibles."""
        self._supabase: Optional[Client] = None
        # Diccionario en memoria como fallback para desarrollo local offline
        self._local_cache: dict[str, dict] = {}

        if (
            create_client
            and settings.supabase_url
            and settings.supabase_key
            and settings.supabase_url.startswith("https://")
        ):
            try:
                self._supabase = create_client(
                    settings.supabase_url, settings.supabase_key
                )
            except Exception:
                self._supabase = None

    @staticmethod
    def generate_file_hash(file_path: str) -> str:
        """
        Calcula el hash SHA-256 de un archivo de audio para usarlo como clave única de caché.
        """
        if not os.path.exists(file_path):
            return os.path.basename(file_path)

        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    @staticmethod
    def normalize_youtube_url(url: str) -> str:
        """Normaliza una URL de YouTube para usarla como clave de búsqueda en caché."""
        clean = url.strip().lower()
        hasher = hashlib.sha256(clean.encode("utf-8"))
        return hasher.hexdigest()

    def get_by_identifier(self, identifier: str) -> Optional[dict]:
        """
        Busca si una canción ya fue procesada por su identificador (hash o url limpia).

        Args:
            identifier: Hash SHA-256 del audio o identificador único.

        Returns:
            Diccionario con el resultado de la canción si existe, o None.
        """
        # 1. Intentar en Supabase si está conectado
        if self._supabase:
            try:
                response = (
                    self._supabase.table(self.CACHE_TABLE)
                    .select("data")
                    .eq("identifier", identifier)
                    .execute()
                )
                if response.data and len(response.data) > 0:
                    return response.data[0].get("data")
            except Exception:
                pass

        # 2. Fallback a caché local en memoria
        return self._local_cache.get(identifier)

    def save(self, identifier: str, source: str, result_data: dict) -> None:
        """
        Guarda el resultado procesado para evitar reprocesar la misma canción en el futuro.

        Args:
            identifier: Hash SHA-256 o identificador único de la fuente.
            source: Origen ('youtube', 'upload', 'microphone').
            result_data: Diccionario con los acordes, letra, tonalidad y dificultad.
        """
        # Guardar en memoria local
        self._local_cache[identifier] = result_data

        # Guardar en Supabase si está disponible
        if self._supabase:
            try:
                payload = {
                    "identifier": identifier,
                    "source": source,
                    "data": result_data,
                }
                # Upsert en Supabase
                self._supabase.table(self.CACHE_TABLE).upsert(payload).execute()
            except Exception:
                pass
