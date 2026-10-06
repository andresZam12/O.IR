"use client";

import React, { useState } from "react";
import SongInputForm from "@/components/features/SongInputForm";
import ProcessingProgress from "@/components/features/ProcessingProgress";
import KaraokeView from "@/components/features/KaraokeView";
import DifficultyCard from "@/components/features/DifficultyCard";
import PdfDownloadButton from "@/components/features/PdfDownloadButton";
import { pollJobUntilComplete } from "@/services/api";
import { ProcessedSongResult, SongJobStatus } from "@/types/song";

export default function HomePage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<SongJobStatus | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedSongResult | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Iniciar flujo de procesamiento y polling continuo
  const handleJobStarted = async (id: string) => {
    setJobId(id);
    setErrorMessage(null);
    setProcessedData(null);
    setJobStatus({ job_id: id, status: "STARTED", progress: 5, step: "iniciando" });

    try {
      const result = await pollJobUntilComplete(id, (status) => {
        setJobStatus(status);
      });
      setProcessedData(result);
      setJobId(null);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Error al procesar la canción"
      );
      setJobId(null);
    }
  };

  const handleReset = () => {
    setJobId(null);
    setJobStatus(null);
    setProcessedData(null);
    setErrorMessage(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start py-12 px-4 sm:px-6">
      {/* --- Encabezado Hero --- */}
      <div className="text-center max-w-3xl mx-auto mb-8">
        <h1 className="text-6xl font-black tracking-tight mb-3">
          <span className="text-white">O</span>
          <span className="text-primary-400">.</span>
          <span className="text-white">IR</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
          Descubre los <span className="text-primary-400 font-semibold">acordes y la letra sincronizada</span> de cualquier canción con IA para músicos principiantes.
        </p>
      </div>

      {/* --- Mensaje de Error (si existe) --- */}
      {errorMessage && (
        <div className="w-full max-w-2xl mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-sm flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs bg-red-900/60 hover:bg-red-800 px-2 py-1 rounded"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* --- 1. Formulario de Entrada (si no está procesando ni hay resultado) --- */}
      {!jobId && !processedData && (
        <div className="w-full">
          <SongInputForm
            onJobStarted={handleJobStarted}
            onError={(msg) => setErrorMessage(msg)}
            isProcessing={!!jobId}
          />

          {/* Tarjetas de características informativas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-12">
            <FeatureCard
              emoji="🎸"
              title="Detección de acordes"
              description="Extracción armónica precisa con Constant-Q Transform y librosa."
            />
            <FeatureCard
              emoji="🎤"
              title="Letra sincronizada"
              description="Integración directa con LRCLIB y vista interactiva estilo karaoke."
            />
            <FeatureCard
              emoji="📊"
              title="Evaluación de dificultad"
              description="Puntaje objetivo de 1 a 10 con consejos prácticos de cejilla y ritmo."
            />
          </div>
        </div>
      )}

      {/* --- 2. Barra de Progreso Activa (mientras Celery procesa) --- */}
      {jobId && jobStatus && (
        <div className="w-full mt-4">
          <ProcessingProgress status={jobStatus} />
        </div>
      )}

      {/* --- 3. Resultados: Karaoke + Dificultad (cuando culmina con éxito) --- */}
      {processedData && (
        <div className="w-full max-w-4xl space-y-8 animate-fade-in">
          {/* Botón de reinicio / Exportar PDF / Nueva canción */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800 gap-3">
            <div>
              <span className="text-xs text-slate-400">Canción analizada:</span>
              <p className="text-sm font-semibold text-white">
                {processedData.lyrics?.title || "Audio analizado"}{" "}
                {processedData.lyrics?.artist ? `— ${processedData.lyrics.artist}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <PdfDownloadButton data={processedData} />
              <button
                onClick={handleReset}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2 px-4 rounded-lg border border-slate-700 transition-colors"
              >
                🔄 Analizar otra
              </button>
            </div>
          </div>

          {/* Evaluación de Dificultad y Tips de Práctica */}
          {processedData.difficulty && (
            <DifficultyCard evaluation={processedData.difficulty} />
          )}

          {/* Vista Karaoke interactiva */}
          <KaraokeView
            chords={processedData.chords}
            lyrics={processedData.lyrics}
            duration={processedData.duration}
            estimatedKey={processedData.estimated_key}
          />
        </div>
      )}
    </main>
  );
}

function FeatureCard({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="card text-left hover:border-primary-700/60 transition-colors duration-200 bg-slate-900/50">
      <span className="text-2xl mb-3 block">{emoji}</span>
      <h2 className="font-semibold text-white mb-1 text-sm">{title}</h2>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
