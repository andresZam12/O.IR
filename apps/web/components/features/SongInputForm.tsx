"use client";

import React, { useState, useRef } from "react";
import {
  Video,
  Upload,
  MicVocal,
  AudioLines,
  Download,
  Sparkles,
  ChevronRight,
  Loader2,
  FileHeadphone,
  CheckCircle2,
  Square,
  AlertCircle,
  X,
  Music,
} from "lucide-react";
import { uploadAudioFile } from "@/services/api";

type InputMode = "youtube" | "upload" | "microphone";

interface SongInputFormProps {
  onJobStarted: (jobId: string, audioUrl?: string) => void;
  onError: (errorMessage: string) => void;
  isProcessing: boolean;
  onCurrentSongChange?: (title: string, artist?: string, bpm?: string) => void;
}

// Extrae el ID de 11 caracteres de cualquier URL de YouTube (watch, shorts, embed, youtu.be)
function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.trim().match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : null;
}

export default function SongInputForm({
  onJobStarted,
  onError,
  isProcessing,
  onCurrentSongChange,
}: SongInputFormProps) {
  const [mode, setMode] = useState<InputMode>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingMp3, setIsDownloadingMp3] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  // Estados para grabación por micrófono
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detección automática del ID de video para vista previa
  const detectedVideoId = extractYouTubeVideoId(youtubeUrl);

  // Descarga directa a través del backend de O.IR en formato MP3 sin anuncios ni páginas externas
  const handleDownloadMp3 = async () => {
    if (!youtubeUrl.trim() || isDownloadingMp3) return;
    try {
      setIsDownloadingMp3(true);
      setDownloadSuccessMessage(null);
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "https://oir-api.onrender.com";
      const targetUrl = `${apiUrl}/api/songs/download-youtube?url=${encodeURIComponent(
        youtubeUrl.trim()
      )}&format=mp3`;

      const response = await fetch(targetUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detailMsg =
          errorData.detail ||
          "YouTube ha limitado la descarga desde servidores en la nube. Te sugerimos usar la pestaña 'Subir Archivo' para procesar el audio directamente.";
        throw new Error(detailMsg);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition");
      let filename = `cancion_${detectedVideoId || "audio"}.mp3`;
      if (disposition) {
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match && utf8Match[1]) {
          try {
            filename = decodeURIComponent(utf8Match[1].trim());
          } catch {
            filename = utf8Match[1].trim();
          }
        } else {
          const regularMatch = disposition.match(/filename="?([^";]+)"?/i);
          if (regularMatch && regularMatch[1]) {
            filename = regularMatch[1].trim();
          }
        }
      }

      // Disparador nativo de guardado local en el navegador
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      const baseName = filename.replace(/\.[^/.]+$/, "");
      setDownloadSuccessMessage(`🎉 ¡${filename} descargado con éxito! Pásate a 'Subir archivo' para analizarlo.`);
      if (onCurrentSongChange) {
        onCurrentSongChange(baseName, "Descargado de YouTube", "120");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error al descargar el archivo MP3 desde el servidor";
      onError(msg);
    } finally {
      setIsDownloadingMp3(false);
    }
  };

  // Manejo de envío de archivo físico para análisis acústico
  const handleFileSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFile || isSubmitting || isProcessing) {
      if (!selectedFile) onError("Por favor selecciona un archivo de audio");
      return;
    }

    try {
      setIsSubmitting(true);
      const localAudioUrl = URL.createObjectURL(selectedFile);
      const cleanFileName = selectedFile.name.replace(/\.[^/.]+$/, "");
      if (onCurrentSongChange) {
        onCurrentSongChange(cleanFileName, "Pista de audio local", "—");
      }

      const response = await uploadAudioFile(selectedFile);
      onJobStarted(response.job_id, localAudioUrl);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
    if (onCurrentSongChange) {
      onCurrentSongChange(cleanFileName, "Archivo listo para análisis", "—");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Grabación por micrófono
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const recordedFile = new File([audioBlob], "grabacion_microfono.webm", {
          type: "audio/webm",
        });
        setSelectedFile(recordedFile);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      onError("No se pudo acceder al micrófono. Verifica los permisos de tu navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const tabs = [
    { id: "youtube", label: "YouTube", icon: Video },
    { id: "upload", label: "Subir archivo", icon: Upload },
    { id: "microphone", label: "Micrófono", icon: MicVocal },
  ];

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-2 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-3">
      {/* Selector de Pestañas Estilo v0 */}
      <div className="flex overflow-x-auto rounded-2xl border border-white/[0.07] bg-black/20 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id as InputMode);
              setDownloadSuccessMessage(null);
            }}
            className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-medium transition-all ${
              mode === id
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/30"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-8">
        {/* Encabezado dinámico de la tarjeta */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              Entrada seleccionada
            </p>
            <h2 className="text-xl font-medium text-white">
              {mode === "youtube"
                ? "Convertidor de YouTube a MP3"
                : mode === "upload"
                ? "Subir un archivo de audio"
                : "Escuchar desde el micrófono"}
            </h2>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-violet-300">
            <AudioLines className="size-5" />
          </div>
        </div>

        {/* 1. MODO YOUTUBE */}
        {mode === "youtube" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3">
              <label htmlFor="youtube-url" className="text-xs font-medium text-slate-300">
                Pega el enlace de la canción o video
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <input
                    id="youtube-url"
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10 font-mono"
                  />
                  {youtubeUrl && (
                    <button
                      type="button"
                      onClick={() => setYoutubeUrl("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!youtubeUrl.trim() || isDownloadingMp3}
                  onClick={handleDownloadMp3}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:from-violet-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isDownloadingMp3 ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Descargando MP3...</span>
                    </>
                  ) : (
                    <>
                      <Download className="size-4" />
                      <span>Descargar MP3</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Extracción limpia directa a MP3 con proxy residencial y sin anuncios.
              </p>
            </div>

            {/* Vista previa si se detectó video */}
            {detectedVideoId && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <img
                    src={`https://img.youtube.com/vi/${detectedVideoId}/mqdefault.jpg`}
                    alt="Vista previa del video"
                    className="w-full sm:w-44 h-28 object-cover rounded-xl border border-white/10 shadow-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-2 w-full text-left">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      <CheckCircle2 className="size-3" /> Video de YouTube listo
                    </span>
                    <h4 className="text-sm font-semibold text-white truncate">
                      ID: {detectedVideoId}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Haz clic en <strong>Descargar MP3</strong> para guardar la pista de audio en tu equipo y luego arrástrala a <strong>Subir archivo</strong>.
                    </p>
                  </div>
                </div>

                {downloadSuccessMessage && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-200">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-emerald-400 flex-shrink-0" />
                      <span>{downloadSuccessMessage}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMode("upload")}
                      className="ml-3 rounded-lg bg-emerald-500 px-3 py-1.5 font-bold text-slate-950 transition hover:bg-emerald-400 flex-shrink-0"
                    >
                      Ir a Subir ➔
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. MODO SUBIR ARCHIVO */}
        {mode === "upload" && (
          <div className="space-y-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            {!selectedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed transition p-6 text-center ${
                  isDragging
                    ? "border-violet-400 bg-violet-400/10 scale-[1.01]"
                    : "border-violet-300/25 bg-violet-400/[0.03] hover:border-violet-300/50 hover:bg-violet-400/[0.06]"
                }`}
              >
                <div className="rounded-full bg-violet-400/10 p-4 text-violet-300">
                  <FileHeadphone className="size-7" />
                </div>
                <div>
                  <span className="block text-sm font-medium text-slate-200">
                    Arrastra tu archivo de audio aquí
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    o haz clic para explorar en tu dispositivo (.mp3, .wav, .m4a)
                  </span>
                </div>
              </button>
            ) : (
              <div className="rounded-2xl border border-violet-400/30 bg-violet-950/20 p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-xl bg-violet-500/20 p-2.5 text-violet-300">
                      <Music className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Listo para analizar
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting || isProcessing}
                  onClick={() => handleFileSubmit()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-950/50 transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
                >
                  {isSubmitting || isProcessing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Procesando acordes y letra...</span>
                    </>
                  ) : (
                    <>
                      <span>Analizar pista de audio</span>
                      <ChevronRight className="size-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. MODO MICRÓFONO */}
        {mode === "microphone" && (
          <div className="space-y-5">
            <div className="flex min-h-44 flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
              <div className="relative rounded-full bg-cyan-400/10 p-5 text-cyan-300">
                {isRecording && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
                )}
                <MicVocal className="relative size-8" />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-200">
                  {isRecording ? `Grabando audio: ${formatSeconds(recordingSeconds)}` : "Listo para escuchar"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {isRecording
                    ? "Toca tu instrumento o reproduce la canción cerca del micrófono"
                    : "Permite el acceso al micrófono y presiona Iniciar"}
                </p>
              </div>

              <div className="flex gap-3">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex h-11 items-center gap-2 rounded-xl bg-cyan-500 px-5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    <MicVocal className="size-4" />
                    Iniciar Grabación
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-5 text-xs font-semibold text-white transition hover:bg-rose-500"
                  >
                    <Square className="size-4 fill-current" />
                    Detener Grabación
                  </button>
                )}

                {selectedFile && !isRecording && (
                  <button
                    type="button"
                    disabled={isSubmitting || isProcessing}
                    onClick={() => handleFileSubmit()}
                    className="flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-xs font-semibold text-white transition hover:bg-violet-500"
                  >
                    Analizar Grabación
                    <ChevronRight className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
