"use client";

import React, { useState, useRef } from "react";
import { uploadAudioFile } from "@/services/api";

type InputMode = "youtube" | "upload" | "microphone";

interface SongInputFormProps {
  onJobStarted: (jobId: string, audioUrl?: string) => void;
  onError: (errorMessage: string) => void;
  isProcessing: boolean;
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
}: SongInputFormProps) {
  const [mode, setMode] = useState<InputMode>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSongTitle, setUploadSongTitle] = useState("");
  const [uploadArtistName, setUploadArtistName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detección automática del ID de video para el convertidor
  const detectedVideoId = extractYouTubeVideoId(youtubeUrl);

  // Estados para grabación por micrófono
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <div className="flex border-b border-slate-800 mb-6 pb-2 space-x-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setMode("youtube")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            mode === "youtube"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-900/50"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <span>📥</span>
          <span>Convertidor YouTube (MP3 / MP4)</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            mode === "microphone"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-900/50"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <span>🎙️</span>
          <span>Micrófono en vivo</span>
        </button>
      </div>

      {/* Contenido según el modo: Convertidor de YouTube a MP3/MP4 */}
      {mode === "youtube" && (
        <div className="space-y-5 animate-fade-in">
          {/* Header informativo del convertidor */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-left space-y-2">
            <div className="flex items-center gap-2 text-primary-400 font-semibold text-sm">
              <span className="text-lg">📥</span>
              <span>Convertidor Directo a MP3 y MP4</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pega el enlace de cualquier canción o video de YouTube para descargarlo directamente en formato{" "}
              <strong className="text-white">MP3 (audio)</strong> o{" "}
              <strong className="text-white">MP4 (video)</strong> a tu dispositivo. Una vez descargado, pasa a la pestaña{" "}
              <strong className="text-primary-300">Subir Audio</strong> para extraer automáticamente sus acordes y letra sincronizada con IA.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Ingresa el enlace del video o canción de YouTube
            </label>
            <div className="relative flex items-center">
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 pr-20 text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all text-sm font-mono"
              />
              {youtubeUrl && (
                <button
                  type="button"
                  onClick={() => setYoutubeUrl("")}
                  className="absolute right-3 px-2 py-1 text-xs text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-700 rounded transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Si se detectó un video de YouTube válido */}
          {detectedVideoId ? (
            <div className="p-4 rounded-xl bg-slate-900/95 border border-primary-500/40 space-y-4 text-left shadow-xl animate-fade-in">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <img
                  src={`https://img.youtube.com/vi/${detectedVideoId}/mqdefault.jpg`}
                  alt="Vista previa del video"
                  className="w-full sm:w-44 h-28 object-cover rounded-lg border border-slate-700 shadow-md flex-shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1.5 w-full">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ✓ Video detectado
                    </span>
                    <span className="text-xs text-slate-400 font-mono truncate">
                      ID: {detectedVideoId}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    Elige el formato de descarga directa:
                  </h4>
                  <p className="text-xs text-slate-400">
                    Haz clic en cualquiera de las opciones para descargar el archivo directamente a tu equipo sin límites:
                  </p>
                </div>
              </div>

              {/* Botones de Descarga Directa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Opción 1: Descargar MP3 (Audio) */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🎵</span>
                    <div>
                      <div className="text-xs font-bold text-white">Audio en MP3</div>
                      <div className="text-[11px] text-slate-400">Recomendado para acordes y letra</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`https://www.y2mate.com/youtube/${detectedVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-lg text-center transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      <span>📥</span>
                      <span>Descargar MP3</span>
                    </a>
                    <a
                      href={`https://www.ssyoutube.com/watch?v=${detectedVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs py-2 px-3 rounded-lg text-center transition-colors border border-slate-700"
                      title="Servidor alternativo de descarga"
                    >
                      Opción 2
                    </a>
                  </div>
                </div>

                {/* Opción 2: Descargar MP4 (Video) */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-blue-500/50 transition-all flex flex-col justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🎬</span>
                    <div>
                      <div className="text-xs font-bold text-white">Video en MP4</div>
                      <div className="text-[11px] text-slate-400">Video con audio completo</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`https://www.ssyoutube.com/watch?v=${detectedVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 px-3 rounded-lg text-center transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      <span>📥</span>
                      <span>Descargar MP4</span>
                    </a>
                    <a
                      href={`https://www.y2mate.com/youtube/${detectedVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs py-2 px-3 rounded-lg text-center transition-colors border border-slate-700"
                      title="Servidor alternativo de descarga"
                    >
                      Opción 2
                    </a>
                  </div>
                </div>
              </div>

              {/* Paso 2: Ir a Subir Audio */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-primary-950/30 -mx-4 -mb-4 p-4 rounded-b-xl">
                <div className="flex items-center gap-2.5 text-left">
                  <span className="text-2xl">✨</span>
                  <div>
                    <div className="text-xs font-bold text-white">
                      ¿Ya descargaste tu archivo MP3?
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Cárgalo en O.IR para detectar automáticamente acordes y letra sincronizada con IA
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMode("upload")}
                  className="w-full sm:w-auto bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-all shadow-lg shadow-primary-900/40 flex items-center justify-center gap-1.5 flex-shrink-0"
                >
                  <span>📁</span>
                  <span>Ir a Subir Audio ➔</span>
                </button>
              </div>
            </div>
          ) : (
            /* Estado inicial cuando no se ha pegado un link */
            <div className="p-6 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center space-y-3">
              <span className="text-3xl block">🎵 ➔ 💾</span>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Pega cualquier enlace de YouTube arriba para desbloquear al instante los enlaces de descarga directa en formato MP3 o MP4.
              </p>
            </div>
          )}
        </div>
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
