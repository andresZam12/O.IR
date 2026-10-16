/**
 * services/api.ts — Cliente HTTP para comunicación con el backend FastAPI de O.IR
 */

import {
  ProcessedSongResult,
  SongJobResponse,
  SongJobStatus,
} from "@/types/song";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function handleFetchError(err: unknown): never {
  if (err instanceof TypeError && err.message.toLowerCase().includes("failed to fetch")) {
    throw new Error(
      `No se pudo conectar con el servidor backend (${API_BASE_URL}). Verifica que esté corriendo.`
    );
  }
  throw err;
}

/**
 * Sube un archivo de audio (.mp3, .wav, etc.) al backend para su procesamiento.
 */
export async function uploadAudioFile(file: File): Promise<SongJobResponse> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE_URL}/api/songs/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Error al subir archivo (${response.status})`
      );
    }

    return response.json();
  } catch (err) {
    handleFetchError(err);
  }
}

/**
 * Encola el procesamiento de una canción a través de su URL (ej. YouTube).
 */
export async function processSongUrl(
  youtubeUrl: string
): Promise<SongJobResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/songs/process-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "youtube",
        youtube_url: youtubeUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Error al procesar URL (${response.status})`
      );
    }

    return response.json();
  } catch (err) {
    handleFetchError(err);
  }
}

/**
 * Consulta el estado actual de una tarea en Celery.
 */
export async function getJobStatus(jobId: string): Promise<SongJobStatus> {
  const response = await fetch(`${API_BASE_URL}/api/songs/status/${jobId}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Error al consultar estado del job (${response.status})`);
  }

  return response.json();
}

/**
 * Realiza polling continuo cada N milisegundos hasta que la tarea finaliza o falla.
 */
export async function pollJobUntilComplete(
  jobId: string,
  onProgress?: (status: SongJobStatus) => void,
  intervalMs = 1500
): Promise<ProcessedSongResult> {
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const current = await getJobStatus(jobId);
        if (onProgress) {
          onProgress(current);
        }

        if (current.status === "SUCCESS") {
          if (current.result) {
            resolve(current.result);
          } else {
            reject(new Error("La tarea culminó pero no devolvió resultados"));
          }
          return;
        }

        if (current.status === "FAILURE") {
          reject(
            new Error(
              current.error || "Ocurrió un error durante el procesamiento del audio"
            )
          );
          return;
        }

        // Continuar haciendo polling
        setTimeout(check, intervalMs);
      } catch (err) {
        reject(err);
      }
    };

    check();
  });
}

export interface CapoRecommendation {
  fret: number;
  transposed_shapes: string[];
  difficulty_reduction: number;
  explanation: string;
}

export interface TransposeResponse {
  semitones: number;
  original_chords: string[];
  transposed_chords: string[];
  capo_suggestion?: CapoRecommendation | null;
}

/**
 * Transpone una lista de acordes y obtiene recomendaciones inteligentes de Capo.
 */
export async function transposeChords(
  chords: string[],
  semitones: number
): Promise<TransposeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/songs/transpose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chords, semitones }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Error al transponer acordes");
  }

  return response.json();
}
