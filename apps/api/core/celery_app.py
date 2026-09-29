"""
core/celery_app.py — Configuración de Celery para el procesamiento asíncrono

Celery es el sistema de cola de tareas que permite procesar canciones
en segundo plano sin bloquear la API. Redis actúa como broker (canal de mensajes)
y como backend (almacén del estado de cada tarea).
"""

from celery import Celery

from core.config import settings

# --- Creación de la instancia de Celery ---
celery_app = Celery(
    "oir_worker",  # Nombre del worker
    broker=settings.redis_url,   # Redis recibe las tareas
    backend=settings.redis_url,  # Redis guarda el resultado/estado de cada tarea
)

# --- Configuración de Celery ---
celery_app.conf.update(
    # Serialización en JSON para que los resultados sean legibles
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Zona horaria
    timezone="America/Bogota",
    enable_utc=True,

    # Tiempo máximo de vida de un resultado en Redis (24 horas)
    result_expires=86400,

    # Tiempo máximo que una tarea puede correr antes de cancelarse (10 minutos)
    task_time_limit=600,

    # Lista de módulos donde Celery buscará las tareas registradas
    include=["workers.song_worker"],
)
