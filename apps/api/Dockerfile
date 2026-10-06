# Dockerfile — O.IR Backend (FastAPI + Librosa Audio Engine)
FROM python:3.11-slim

# Evitar generación de archivos .pyc y buffer de salida en logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Instalar dependencias del sistema necesarias para procesamiento de audio (FFmpeg, libsndfile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente de la API
COPY . .

# Exponer el puerto configurado
EXPOSE 8000

# Ejecutar Uvicorn enlazando a 0.0.0.0 y usando la variable de entorno $PORT (compatible con Render/Railway/Fly.io)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
