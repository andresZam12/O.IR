# 🎵 O.IR — Chord & Lyrics Detector

> Plataforma web que detecta acordes y letra de canciones de forma automática, con vista sincronizada tipo karaoke.

---

## ¿Qué hace O.IR?

1. **Ingresa una canción** via URL de YouTube, archivo de audio (.mp3 / .wav) o grabación por micrófono.
2. **Detecta los acordes** con marcas de tiempo y nivel de confianza usando IA real (librosa + modelos de reconocimiento).
3. **Obtiene la letra** desde LRCLIB (API gratuita) o la transcribe con Whisper.
4. **Muestra una vista karaoke** sincronizada: acorde actual resaltado + letra en tiempo real.
5. **Calcula un puntaje de dificultad** (1–10) con desglose explicable.
6. **Exporta a PDF** estilo cancionero imprimible.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | Python 3.11 + FastAPI |
| Cola de tareas | Celery + Redis |
| Detección de acordes | librosa (MVP) → BTC/ONNX (mejora futura) |
| Letra | LRCLIB → Whisper (fallback) |
| Base de datos | Supabase (PostgreSQL) |
| PDF | @react-pdf/renderer (cliente) |
| Despliegue | Vercel (frontend) + Railway (API + Redis) |

---

## Estructura del proyecto

```
O.IR/
├── apps/
│   ├── web/          ← Frontend Next.js
│   └── api/          ← Backend FastAPI
└── README.md
```

---

## Cómo correr el proyecto en local

### Requisitos previos

- Node.js >= 18
- Python >= 3.11
- Redis (vía Docker o instalado localmente)
- FFmpeg instalado en el sistema ([instrucciones](https://ffmpeg.org/download.html))

### 1. Clonar el repositorio

```bash
git clone https://github.com/andresZam12/O.IR.git
cd O.IR
```

### 2. Configurar el frontend

```bash
cd apps/web
npm install
cp .env.example .env.local
# Editar .env.local con tus variables
npm run dev
```

El frontend estará en: `http://localhost:3000`

### 3. Configurar el backend

```bash
cd apps/api
python -m venv venv
source venv/bin/activate      # En Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Editar .env con tus variables
uvicorn main:app --reload --port 8000
```

La API estará en: `http://localhost:8000`  
Documentación automática: `http://localhost:8000/docs`

### 4. Levantar Redis y Celery (worker de tareas)

```bash
# En una terminal: levantar Redis con Docker
docker run -d -p 6379:6379 redis:alpine

# En otra terminal (dentro de apps/api con venv activo):
celery -A core.celery_app worker --loglevel=info
```

---

## Variables de entorno

### Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (`apps/api/.env`)

```env
REDIS_URL=redis://localhost:6379/0
DATABASE_URL=postgresql://user:password@host:5432/oir
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your_supabase_key
WHISPER_MODEL=base
MAX_AUDIO_DURATION=300   # segundos (5 min máximo)
```

---

## Autor

**Andrés Zamudio** — Estudiante de Ingeniería de Software, Séptimo Semestre  
Proyecto para la materia: *Programación Orientada a la Web*

---

## Nota legal

La descarga de audio desde YouTube va en contra de sus Términos de Servicio.
Esta funcionalidad existe únicamente con fines académicos, no se almacena ni redistribuye el contenido descargado.
Se recomienda usar la opción de subir un archivo de audio propio.
