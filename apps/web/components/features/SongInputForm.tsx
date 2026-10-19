"use client";

import React, { useState, useRef } from "react";
import { processSongUrl, uploadAudioFile } from "@/services/api";

type InputMode = "youtube" | "upload" | "microphone";

interface SongInputFormProps {
  onJobStarted: (jobId: string, audioUrl?: string) => void;
  onError: (errorMessage: string) => void;
  isProcessing: boolean;
}

export default function SongInputForm({
  onJobStarted,
  onError,
  isProcessing,
}: SongInputFormProps) {
  const [mode, setMode] = useState<InputMode>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSongTitle, setUploadSongTitle] = useState("");
  const [uploadArtistName, setUploadArtistName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [youtubeBlocked, setYoutubeBlocked] = useState<string | null>(null);

  // Estados para grabación por micrófono
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manejo de envío de YouTube
  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim() || isSubmitting || isProcessing) {
      if (!youtubeUrl.trim()) onError("Por favor ingresa una URL de YouTube");
      return;
    }

    try {
      setIsSubmitting(true);
      setYoutubeBlocked(null);
      const response = await processSongUrl(youtubeUrl.trim());
      onJobStarted(response.job_id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al procesar el enlace";
      if (
        msg.toLowerCase().includes("bot") ||
        msg.toLowerCase().includes("sign in") ||
        msg.toLowerCase().includes("cookies") ||
        msg.toLowerCase().includes("yt-dlp") ||
        msg.toLowerCase().includes("forbidden") ||
        msg.toLowerCase().includes("403")
      ) {
        setYoutubeBlocked(youtubeUrl.trim());
      }
      onError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejo de envío de archivo
  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || isSubmitting || isProcessing) {
      if (!selectedFile) onError("Por favor selecciona un archivo de audio");
      return;
    }

    try {
      setIsSubmitting(true);
      const localAudioUrl = URL.createObjectURL(selectedFile);
      const response = await uploadAudioFile(
        selectedFile,
        uploadSongTitle,
        uploadArtistName
      );
      onJobStarted(response.job_id, localAudioUrl);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Procesar archivo seleccionado y autocompletar título/artista desde el nombre del archivo
  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    const rawName = file.name.replace(/\.[^/.]+$/, "");
    if (rawName.includes(" - ")) {
      const parts = rawName.split(" - ");
      if (!uploadArtistName.trim()) setUploadArtistName(parts[0].trim());
      if (!uploadSongTitle.trim()) setUploadSongTitle(parts.slice(1).join(" - ").trim());
    } else {
      if (!uploadSongTitle.trim()) {
        const cleanTitle = rawName.replace(/[_-]/g, " ").trim();
        setUploadSongTitle(cleanTitle);
      }
    }
  };

  // Manejo de Drag and Drop
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

  // Inicio de grabación por micrófono
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

  // Detener grabación
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  return (
    <div className="card w-full max-w-2xl mx-auto shadow-2xl border-slate-800 bg-slate-900/90 backdrop-blur-md p-6">
      {/* Selector de modo (Tabs) */}
      <div className="flex border-b border-slate-800 mb-6 pb-2 space-x-2">
        <button
          type="button"
          onClick={() => setMode("youtube")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "youtube"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-900/50"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <span>📺</span>
          <span>YouTube</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "upload"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-900/50"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <span>📁</span>
          <span>Subir Audio</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("microphone")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === "microphone"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-900/50"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <span>🎙️</span>
          <span>Micrófono en vivo</span>
        </button>
      </div>

      {/* Contenido según el modo */}
      {mode === "youtube" && (
        <form onSubmit={handleYoutubeSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Ingresa el enlace del video o canción
            </label>
            <div className="relative">
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={isProcessing}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all text-sm"
              />
            </div>
          </div>

          {/* Acceso directo a descarga y convertidor de YouTube a MP3 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs px-1 text-slate-400 gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="flex items-center gap-1.5">
              <span>💡</span>
              <span>¿Quieres descargar el MP3 directo del video?</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!youtubeUrl.trim()}
                onClick={() => {
                  const apiUrl =
                    process.env.NEXT_PUBLIC_API_URL ||
                    "https://oir-api.onrender.com";
                  window.open(
                    `${apiUrl}/api/songs/download-youtube?url=${encodeURIComponent(
                      youtubeUrl.trim()
                    )}`,
                    "_blank"
                  );
                }}
                className="text-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/30 transition-colors"
              >
                <span>📥 Descargar MP3 directo</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing || !youtubeUrl.trim()}
            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-primary-900/30 flex items-center justify-center gap-2"
          >
            {isProcessing ? "Procesando..." : "Analizar canción 🎵"}
          </button>

          {/* Tarjeta de rescate si YouTube bloqueó la descarga en la nube */}
          {youtubeBlocked && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-3 mt-4 text-left animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">⚠️</span>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-amber-300">
                    Descarga directa de audio del video
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Si el análisis automático en la nube experimenta restricciones de YouTube, descarga el archivo de audio directamente en tu equipo con 1 clic y súbelo a continuación:
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <a
                  href={`${
                    process.env.NEXT_PUBLIC_API_URL ||
                    "https://oir-api.onrender.com"
                  }/api/songs/download-youtube?url=${encodeURIComponent(
                    youtubeBlocked
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2.5 px-3 rounded-lg text-center transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <span>📥</span>
                  <span>Descarga Directa de Audio (.MP3)</span>
                </a>
                <a
                  href="https://y2mate.nu/es-mp3/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2.5 px-3 rounded-lg text-center transition-colors flex items-center justify-center gap-1 border border-slate-700"
                >
                  <span>Convertidor Web (Y2Mate)</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setMode("upload");
                    setYoutubeBlocked(null);
                  }}
                  className="bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs py-2.5 px-3 rounded-lg text-center transition-colors flex items-center justify-center gap-1"
                >
                  <span>📁</span>
                  <span>Ir a Subir Audio</span>
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {mode === "upload" && (
        <form onSubmit={handleFileSubmit} className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-primary-500 bg-primary-950/20"
                : "border-slate-800 hover:border-slate-700 bg-slate-950/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.ogg,.m4a,.webm"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <span className="text-4xl block mb-2">🎵</span>
            {selectedFile ? (
              <div>
                <p className="text-white font-medium">{selectedFile.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB — Clic para cambiar archivo
                </p>
              </div>
            ) : (
              <div>
                <p className="text-slate-300 font-medium">
                  Arrastra tu archivo aquí o haz clic para examinar
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Formatos soportados: MP3, WAV, OGG, M4A (máx. 5 minutos)
                </p>
              </div>
            )}
          </div>

          {/* Campos opcionales pero recomendados para obtener la letra automáticamente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre de la canción (para letra con IA)
              </label>
              <input
                type="text"
                value={uploadSongTitle}
                onChange={(e) => setUploadSongTitle(e.target.value)}
                placeholder="Ej. Azabache, De Música Ligera..."
                disabled={isProcessing || isSubmitting}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Artista o intérprete (opcional)
              </label>
              <input
                type="text"
                value={uploadArtistName}
                onChange={(e) => setUploadArtistName(e.target.value)}
                placeholder="Ej. Julio Jaramillo, Soda Stereo..."
                disabled={isProcessing || isSubmitting}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing || isSubmitting || !selectedFile}
            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-primary-900/30 flex items-center justify-center gap-2"
          >
            {isSubmitting
              ? "Subiendo archivo..."
              : isProcessing
              ? "Procesando audio..."
              : "Subir y Analizar 🚀"}
          </button>
        </form>
      )}

      {mode === "microphone" && (
        <div className="space-y-6 text-center py-4">
          <p className="text-sm text-slate-400">
            Toca o canta directamente frente a tu micrófono para que O.IR identifique los acordes en vivo.
          </p>

          <div className="flex flex-col items-center justify-center gap-4">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={isProcessing}
                className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-900/50 text-2xl transition-transform hover:scale-105 active:scale-95"
              >
                🎙️
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-slate-800 border-2 border-red-500 text-white flex items-center justify-center shadow-lg text-2xl animate-pulse"
              >
                ⏹️
              </button>
            )}

            <p className="text-sm font-medium text-slate-300">
              {isRecording
                ? `Grabando: ${recordingSeconds} segundos...`
                : selectedFile
                ? `Audio capturado listo (${selectedFile.name})`
                : "Presiona para iniciar grabación"}
            </p>
          </div>

          {selectedFile && !isRecording && (
            <div className="space-y-4 pt-2 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nombre de la canción (para extraer letra completa)
                  </label>
                  <input
                    type="text"
                    value={uploadSongTitle}
                    onChange={(e) => setUploadSongTitle(e.target.value)}
                    placeholder="Ej. Azabache, De Música Ligera..."
                    disabled={isProcessing || isSubmitting}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Artista o intérprete (opcional)
                  </label>
                  <input
                    type="text"
                    value={uploadArtistName}
                    onChange={(e) => setUploadArtistName(e.target.value)}
                    placeholder="Ej. Julio Jaramillo, Soda Stereo..."
                    disabled={isProcessing || isSubmitting}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleFileSubmit}
                disabled={isProcessing}
                className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-primary-900/30"
              >
                Analizar Grabación de Micrófono 🎸
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
