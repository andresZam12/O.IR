/**
 * types/song.ts — Tipos e interfaces compartidas para canciones, acordes, letras y dificultad
 */

export interface ChordItem {
  time: number;
  chord: string;
  confidence: number;
}

export interface LyricLine {
  time: number;
  text: string;
  chord?: string | null;
}

export interface LyricsResult {
  is_synced: boolean;
  source: string;
  lines: LyricLine[];
  plain_lyrics?: string | null;
  title?: string | null;
  artist?: string | null;
}

export interface DifficultyMetrics {
  score: number;
  level: "Principiante" | "Intermedio" | "Avanzado" | string;
  unique_chord_count: number;
  barre_chord_count: number;
  barre_chords_present: string[];
  changes_per_minute: number;
  tempo_bpm?: number | null;
}

export interface DifficultyEvaluation {
  metrics: DifficultyMetrics;
  explanation: string;
  practice_tips: string[];
}

export interface ProcessedSongResult {
  status: "success" | "error" | string;
  audio_path: string;
  source: "youtube" | "upload" | "microphone" | string;
  duration: number;
  chords: ChordItem[];
  unique_chords: string[];
  total_changes: number;
  estimated_key?: string | null;
  lyrics?: LyricsResult;
  difficulty?: DifficultyEvaluation;
}

export interface SongJobResponse {
  job_id: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | string;
  message: string;
}

export interface SongJobStatus {
  job_id: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | string;
  progress: number;
  step?: string | null;
  result?: ProcessedSongResult | null;
  error?: string | null;
}
