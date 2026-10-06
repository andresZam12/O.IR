# 🚀 Guía de Despliegue en Producción — O.IR

Esta guía describe cómo desplegar la plataforma **O.IR** en la nube de forma **100% gratuita**, utilizando la arquitectura desacoplada de monorepo:

* **Frontend:** [Vercel](https://vercel.com/) (Next.js con SSR y CDN global).
* **Backend:** [Render](https://render.com/) (FastAPI + Librosa en contenedor Docker).
* **Base de Datos & Caché:** [Supabase](https://supabase.com/) (PostgreSQL administrado).

---

## 📋 Arquitectura de Despliegue

```
┌─────────────────────────────────┐
│     Usuario (Navegador Web)     │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│        Vercel (Frontend)        │
│   https://oir-web.vercel.app    │
└───────────────┬─────────────────┘
                │ REST API Calls
                ▼
┌─────────────────────────────────┐         ┌───────────────────────┐
│        Render (Backend)         │────────▶│  Supabase PostgreSQL  │
│  https://oir-api.onrender.com   │         │ (Canciones procesadas)│
└─────────────────────────────────┘         └───────────────────────┘
```

---

## 1. ⚙️ Despliegue del Backend en Render

El repositorio ya incluye el archivo [`render.yaml`](./render.yaml) y [`apps/api/Dockerfile`](./apps/api/Dockerfile) listos para producción.

### Pasos:
1. Ingresa a **[Render.com](https://render.com/)** e inicia sesión con tu cuenta de **GitHub**.
2. Haz clic en el botón **New +** y selecciona **Web Service**.
3. Selecciona tu repositorio: `andresZam12/O.IR`.
4. Render detectará automáticamente el Dockerfile o puedes configurar los siguientes campos:
   * **Name:** `oir-api`
   * **Region:** Oregon (US West) o Frankfurt (EU)
   * **Branch:** `main`
   * **Root Directory:** `apps/api`
   * **Runtime:** `Docker`
   * **Instance Type:** `Free`
5. En la sección **Environment Variables**, añade:
   * `ENVIRONMENT`: `production`
   * `PORT`: `8000`
   * `ALLOWED_ORIGINS`: `["https://oir-web.vercel.app", "http://localhost:3000"]` *(actualiza con la URL real de tu Vercel cuando la tengas)*.
6. Haz clic en **Create Web Service**.
7. Una vez finalizado el build, Render te otorgará una URL pública (ejemplo: `https://oir-api.onrender.com`).
8. Verifica que responda abriendo `https://tu-servicio.onrender.com/health` (debe responder `{"status": "ok"}`).

---

## 2. 🌐 Despliegue del Frontend en Vercel

### Pasos:
1. Ingresa a **[Vercel.com](https://vercel.com/)** e inicia sesión con tu cuenta de **GitHub**.
2. Haz clic en **Add New...** → **Project**.
3. Importa el repositorio `andresZam12/O.IR`.
4. En la configuración del proyecto:
   * **Framework Preset:** `Next.js`
   * **Root Directory:** Haz clic en *Edit* y selecciona la carpeta **`apps/web`**.
5. En la sección **Environment Variables**:
   * **Key:** `NEXT_PUBLIC_API_URL`
   * **Value:** La URL de tu backend en Render (ejemplo: `https://oir-api.onrender.com` sin barra final).
6. Haz clic en **Deploy**.
7. En menos de 2 minutos, Vercel generará tu enlace público (ejemplo: `https://oir-web.vercel.app`).

---

## 3. 🔄 Conectar CORS entre Frontend y Backend

Una vez que Vercel te dé tu dominio público (por ejemplo `https://oir-web.vercel.app`):
1. Ve a tu panel de **Render** → Servicio `oir-api` → **Environment**.
2. Actualiza la variable `ALLOWED_ORIGINS`:
   ```json
   ["https://oir-web.vercel.app", "http://localhost:3000"]
   ```
3. Guarda los cambios. Render reiniciará el servicio en segundos con los nuevos orígenes autorizados.

---

## 4. 🐳 Despliegue Alternativo en VPS con Docker Compose

Si prefieres desplegar todo el stack en un servidor propio (AWS EC2, DigitalOcean, Linode):

```bash
# 1. Clonar el repositorio
git clone https://github.com/andresZam12/O.IR.git
cd O.IR

# 2. Levantar el stack completo (FastAPI + Redis + Celery)
docker compose up -d

# 3. Verificar estado de los contenedores
docker compose ps
```

---

## 5. ✅ Lista de Verificación Pre-Entrega

- [x] Backend responde `200 OK` en endpoint `/health`.
- [x] CORS configurado para permitir peticiones desde Vercel.
- [x] Detección de acordes CQT y cálculo de dificultad pedagógica operativos.
- [x] Extracción de YouTube configurada contra bloqueos HTTP 403.
- [x] Generador de cancionero en PDF funcional en cliente.
