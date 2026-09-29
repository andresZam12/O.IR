"""
workers/__init__.py — Paquete de workers de Celery

Contiene las tareas asíncronas que se ejecutan en segundo plano.
Cada tarea es una función decorada con @celery_app.task que puede
correr en un proceso separado mientras la API responde al cliente.
"""
