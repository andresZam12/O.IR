# CLAUDE.md — Convenciones y decisiones del proyecto O.IR

Este archivo documenta las reglas de desarrollo, decisiones técnicas y convenciones
que se deben seguir en todo el proyecto. Está pensado para que cualquier desarrollador
(o agente de IA) que trabaje en este repo entienda cómo y por qué las cosas están
hechas de cierta manera.

---

## Reglas generales de código

- **Idioma del código:** inglés (variables, funciones, clases, rutas, nombres de archivos)
- **Idioma de los comentarios:** español, claros y explicativos
- **Estilo:** código limpio, con responsabilidades bien separadas
- **Tipado:** estricto en TypeScript (`strict: true`) y en Python (type hints obligatorios)

---

## Arquitectura general

El proyecto es un **monorepo** con dos aplicaciones independientes:

```
O.IR/
├── apps/
│   ├── web/     ← Frontend: Next.js 14 + TypeScript + Tailwind
│   └── api/     ← Backend: Python 3.11 + FastAPI
```

### Capas del backend (apps/api)

```
api/
├── main.py                  ← Punto de entrada de FastAPI
├── core/                    ← Configuración central (settings, celery, db)
├── routes/                  ← Endpoints HTTP (controllers)
├── services/                ← Lógica de negocio (procesamiento, análisis)
├── repositories/            ← Acceso a la base de datos (patrón Repository)
├── models/                  ← Modelos de base de datos (SQLAlchemy / Supabase)
├── schemas/                 ← Esquemas de validación Pydantic (DTOs)
└── workers/                 ← Tareas asíncronas de Celery
```

### Capas del frontend (apps/web)

```
web/
├── app/                     ← App Router de Next.js (páginas y layouts)
├── components/              ← Componentes React reutilizables
│   ├── ui/                  ← Componentes genéricos (Button, Card, Input...)
│   └── features/            ← Componentes por funcionalidad (Player, ChordView...)
├── services/                ← Llamadas a la API (fetch wrappers)
├── hooks/                   ← Custom hooks de React
├── types/                   ← Tipos TypeScript compartidos
└── lib/                     ← Utilidades y helpers
```

---

## Patrones de diseño utilizados

| Patrón | Dónde | Por qué |
|---|---|---|
| **Repository** | Backend - acceso a BD | Desacopla la lógica de negocio del ORM/DB |
| **Service Layer** | Backend - procesamiento | Concentra la lógica de negocio en clases cohesivas |
| **DTO (Pydantic schemas)** | Backend - entrada/salida | Valida y documenta los datos que entran y salen de la API |
| **Factory** | Backend - audio processing | Permite intercambiar el motor de detección (librosa → BTC) sin cambiar el contrato |
| **Observer / Polling** | Frontend - estado de tarea | El frontend consulta el estado del job periódicamente |

---

## Convenciones de Git

### Tipos de commit

```
feat:     nueva funcionalidad
fix:      corrección de bug
chore:    configuración, dependencias, setup inicial
refactor: mejora de código sin cambiar comportamiento externo
docs:     README, comentarios, documentación
test:     pruebas unitarias o de integración
style:    formato, linting (sin lógica)
```

### Ejemplos de mensajes válidos

```
feat: add chord detection endpoint with librosa
fix: handle empty audio file upload error
chore: setup FastAPI project structure and dependencies
docs: update README with local setup instructions
refactor: extract audio processing into ChordDetectionService
```

### Reglas de commits

- Un commit por cada cosa concreta y coherente
- No subir archivos `.env`, archivos de audio o builds generados
- Siempre confirmar que el código corre antes de hacer commit

---

## Decisiones técnicas tomadas

### ¿Por qué librosa para la detección de acordes (MVP)?
- No requiere GPU, instala con pip, funciona en Railway/Render sin configuración especial.
- Precisión ~60-70%, suficiente para el MVP con mayores y menores.
- Plan de mejora: reemplazar por BTC (Beat-Transformer Chords) con export ONNX en fase posterior.

### ¿Por qué @react-pdf/renderer en lugar de WeasyPrint?
- Genera el PDF directamente en el navegador, sin carga adicional en el servidor.
- WeasyPrint requiere dependencias de sistema (Cairo, Pango) que complican el despliegue.
- El resultado es un componente React que usa los mismos datos ya disponibles en el frontend.

### ¿Por qué Celery + Redis en lugar de FastAPI BackgroundTasks?
- Procesar una canción puede tomar entre 30 y 90 segundos.
- BackgroundTasks no persiste el estado entre reinicios y no permite reintentos automáticos.
- Celery permite rastrear el estado de cada tarea (PENDING → STARTED → SUCCESS/FAILURE).

### ¿Por qué LRCLIB antes que Whisper?
- LRCLIB devuelve letras ya sincronizadas con timestamps si la canción está en su base de datos.
- Whisper transcribe el audio pero sin sincronización perfecta; es más lento y usa más CPU.
- Estrategia: LRCLIB primero → si no encuentra la canción → Whisper como fallback.

### ¿Por qué Supabase?
- PostgreSQL gestionado, gratis para proyectos pequeños.
- Dashboard visual para inspeccionar datos durante el desarrollo.
- En MVP se usa solo para caché de canciones procesadas (evitar reprocesar).
- La tabla de usuarios existe en el esquema pero sin auth activa en el MVP.

### ¿Por qué Vercel + Railway separados?
- Vercel está optimizado para Next.js (edge functions, CDN, deploy automático).
- Railway soporta contenedores Python + add-ons (Redis, PostgreSQL) en el mismo proyecto.
- El dominio propio apunta a Vercel; la API tiene su subdominio en Railway.

---

## Límites del sistema

- **Duración máxima de audio:** 5 minutos (300 segundos)
- **Formatos de audio aceptados:** mp3, wav, ogg, m4a, webm
- **Precisión esperada de acordes:** ~60-70% en mayores/menores; menor en séptimas e inversiones
- **Modelos de Whisper en uso:** `base` (por defecto), configurable a `small` o `medium`

---

## Autor

Andrés Zamudio — Ingeniería de Software, Séptimo Semestre  
Materia: Programación Orientada a la Web
