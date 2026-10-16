/**
 * services/api.ts — Cliente HTTP para comunicación con el backend FastAPI de O.IR
 */

import {
  ProcessedSongResult,
  SongJobResponse,
  SongJobStatus,
} from "@/types/song";

const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXTT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

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
export async function uploadAudioFile(
  file: File,
  trackTitle?: string,
  artistName?: string
): Promise<SongJobResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (trackTitle && trackTitle.trim()) {
    formData.append("track_title", trackTitle.trim());
  }
  if (artistName && artistName.trim()) {
    formData.append("artist_name", artistName.trim());
  }

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
  intervalMs = 3000
): Promise<ProcessedSongResult> {
  return new Promise((resolve, reject) => {
    let consecutiveErrors = 0;
    const maxErrors = 5;

    const check = async () => {
      try {
        const current = await getJobStatus(jobId);
        consecutiveErrors = 0; // Resetear contador al obtener respuesta exitosa

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
        consecutiveErrors += 1;
        if (consecutiveErrors >= maxErrors) {
          reject(err);
        } else {
          // Reintentar tras un breve retraso por si el servidor estaba reiniciando
          setTimeout(check, intervalMs * 1.5);
        }
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

interface LRCLIBItem {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

function parseLrc(lrcContent: string): { time: number; text: string }[] {
  const lines: { time: number; text: string }[] = [];
  const regex = /^\[(?<min>\d+):(?<sec>\d+)(?:\.(?<ms>\d+))?\](?<text>.*)$/;

  for (const raw of lrcContent.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const match = regex.exec(trimmed);
    if (!match || !match.groups) continue;

    const min = parseInt(match.groups.min, 10);
    const sec = parseInt(match.groups.sec, 10);
    const msStr = match.groups.ms || "0";
    const ms = parseFloat(msStr) / (msStr.length === 2 ? 100 : 1000);
    const time = Math.round((min * 60 + sec + ms) * 100) / 100;
    const text = match.groups.text.trim();
    lines.push({ time, text });
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

function alignChordsWithLyricsLines(
  lines: { time: number; text: string }[],
  chords: import("@/types/song").ChordItem[]
): import("@/types/song").LyricLine[] {
  return lines.map((line) => {
    let activeChord = "N/C";
    for (const c of chords) {
      if (c.time <= line.time) {
        activeChord = c.chord;
      } else {
        break;
      }
    }
    return {
      time: line.time,
      text: line.text,
      chord: activeChord,
    };
  });
}

function cleanSongTitle(raw: string): {
  cleanTrack: string;
  cleanArtist?: string;
  queries: string[];
} {
  const title = (raw || "")
    .replace(/\.(mp3|wav|ogg|m4a|webm|flac)$/i, "")
    .replace(
      /(\(|\[|\{)(?:official|oficial|video|audio|lyric|lyrics|letra|hd|4k|remastered|remaster|live|en\s+vivo|extended|version|versión|visualizer|visualizador|clip|feat\.?|ft\.?).*?(\)|\]|\})/gi,
      ""
    )
    .replace(
      /^(?:official\s+music\s+video|official\s+video|official\s+audio|video\s+oficial|audio\s+oficial|visualizador\s+oficial)\s*[:-]?/gi,
      ""
    )
    .trim();

  const queries: string[] = [];
  let cleanArtist: string | undefined = undefined;
  let cleanTrack = title;

  if (title.includes(" - ")) {
    const parts = title.split(" - ");
    const part1 = parts[0].trim();
    const part2 = parts.slice(1).join(" - ").trim();
    cleanArtist = part1;
    cleanTrack = part2;
    queries.push(`${part1} ${part2}`);
    queries.push(`${part2} ${part1}`);
    queries.push(part2);
    queries.push(part1);
  } else {
    queries.push(title);
    const noBrackets = title.replace(/[\(\[\{].*?[\)\]\}]/g, "").trim();
    if (noBrackets && noBrackets !== title) {
      queries.push(noBrackets);
    }
  }

  return { cleanTrack, cleanArtist, queries };
}

async function fetchDirectFromLRCLIB(
  trackName: string,
  artistName: string | undefined,
  duration: number,
  chords: import("@/types/song").ChordItem[]
): Promise<import("@/types/song").LyricsResult> {
  const { cleanTrack, cleanArtist, queries } = cleanSongTitle(trackName);
  const effectiveArtist = artistName || cleanArtist;

  if (effectiveArtist) {
    queries.unshift(`${effectiveArtist} ${cleanTrack}`);
  }

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) continue;
      const data: LRCLIBItem[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      const best = data.find((d) => d.syncedLyrics) || data[0];
      if (best.syncedLyrics) {
        const rawLines = parseLrc(best.syncedLyrics);
        const aligned = alignChordsWithLyricsLines(rawLines, chords);
        return {
          is_synced: true,
          source: "lrclib",
          lines: aligned,
          plain_lyrics: best.plainLyrics,
          title: best.trackName || cleanTrack,
          artist: best.artistName || effectiveArtist,
        };
      } else if (best.plainLyrics) {
        const textLines = best.plainLyrics
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const step =
          textLines.length > 0 && duration > 0
            ? duration / textLines.length
            : 4.0;
        const rawLines = textLines.map((text, i) => ({
          time: Math.round(i * step * 100) / 100,
          text,
        }));
        const aligned = alignChordsWithLyricsLines(rawLines, chords);
        return {
          is_synced: true,
          source: "lrclib",
          lines: aligned,
          plain_lyrics: best.plainLyrics,
          title: best.trackName || cleanTrack,
          artist: best.artistName || effectiveArtist,
        };
      }
    } catch {
      continue;
    }
  }

  throw new Error("No se encontraron letras para esta canción en la base de datos.");
}

/**
 * Busca y sincroniza la letra de una canción con los acordes detectados.
 * Cuenta con fallback directo y automático a LRCLIB (con soporte CORS).
 */
export async function syncLyrics(
  trackName: string,
  artistName: string | undefined,
  duration: number,
  chords: import("@/types/song").ChordItem[]
): Promise<import("@/types/song").LyricsResult> {
  // 1. Intentar endpoint del backend
  try {
    const response = await fetch(`${API_BASE_URL}/api/songs/sync-lyrics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        track_name: trackName,
        artist_name: artistName || undefined,
        duration,
        chords,
      }),
    });

    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Continuar a fallback directo si la API está desplegando
  }

  // 2. Fallback resiliente directo desde el navegador
  return await fetchDirectFromLRCLIB(trackName, artistName, duration, chords);
}
