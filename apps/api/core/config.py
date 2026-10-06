"""
core/config.py — Configuración central de la aplicación

Usa pydantic-settings para cargar las variables de entorno del archivo .env
y exponerlas como un objeto tipado accesible desde cualquier parte del proyecto.
"""

from typing import Any
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Clase de configuración global.
    Cada atributo corresponde a una variable de entorno.
    Si la variable no existe, se usa el valor por defecto.
    """

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Base de datos ---
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/oir"
    supabase_url: str = ""
    supabase_key: str = ""

    # --- Whisper ---
    whisper_model: str = "base"

    # --- Límites del sistema ---
    max_audio_duration: int = 300  # segundos

    # --- Entorno de ejecución ---
    environment: str = "development"

    # --- CORS ---
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Any) -> list[str]:
        """Permite cargar orígenes permitidos tanto en lista JSON como separados por coma."""
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    import json
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Indicar que las variables se cargan desde el archivo .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


# Instancia global de configuración — se importa desde cualquier módulo
settings = Settings()
