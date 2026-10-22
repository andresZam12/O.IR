"use client";

import React, { useState, useMemo } from "react";
import {
  Music2,
  Sparkles,
  Radio,
  Guitar,
  Play,
  Pause,
  Headphones,
  HelpCircle,
  RotateCcw,
  BookOpen,
  Mic2,
  FileText,
  Volume2,
} from "lucide-react";
import SongInputForm from "@/components/features/SongInputForm";
import ProcessingProgress from "@/components/features/ProcessingProgress";
import KaraokeView from "@/components/features/KaraokeView";
import DifficultyCard from "@/components/features/DifficultyCard";
import PdfDownloadButton from "@/components/features/PdfDownloadButton";
import TransposerControl from "@/components/features/TransposerControl";
import ChordSheetView from "@/components/features/ChordSheetView";
import { pollJobUntilComplete } from "@/services/api";
import { ProcessedSongResult, SongJobStatus } from "@/types/song";

const SAMPLE_CHORDS = ["Em", "C", "G", "D", "Am", "B7"];

export default function HomePage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<SongJobStatus | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedSongResult | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transposeMap, setTransposeMap] = useState<Record<string, string>>({});
  const [resultTab, setResultTab] = useState<"chordsheet" | "karaoke">("chordsheet");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Estado lateral de sesión activa
  const [nowPlayingTitle, setNowPlayingTitle] = useState<string>("Sin canción cargada");
  const [nowPlayingSubtitle, setNowPlayingSubtitle] = useState<string>("Tu sesión en vivo");
  const [currentBpm, setCurrentBpm] = useState<string>("— BPM");
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [activeChordIndex, setActiveChordIndex] = useState(0);

  // Acordes actualizados en tiempo real según la transposición elegida
  const displayChords = useMemo(() => {
    if (!processedData?.chords) return [];
    if (Object.keys(transposeMap).length === 0) return processedData.chords;
    return processedData.chords.map((c) => ({
      ...c,
      chord: transposeMap[c.chord] || c.chord,
    }));
  }, [processedData?.chords, transposeMap]);

  // Lista de acordes únicos para la barra inferior
  const bottomChords = useMemo(() => {
    if (processedData?.unique_chords && processedData.unique_chords.length > 0) {
      return processedData.unique_chords.slice(0, 8).map((c) => transposeMap[c] || c);
    }
    return SAMPLE_CHORDS;
  }, [processedData?.unique_chords, transposeMap]);

  // Iniciar flujo de procesamiento y polling continuo
  const handleJobStarted = async (id: string, localAudioUrl?: string) => {
    setJobId(id);
    setAudioUrl(localAudioUrl || null);
    setErrorMessage(null);
    setProcessedData(null);
    setTransposeMap({});
    setJobStatus({ job_id: id, status: "STARTED", progress: 5, step: "iniciando" });

    try {
      const result = await pollJobUntilComplete(id, (status) => {
        setJobStatus(status);
      });
      setProcessedData(result);
      setJobId(null);
      setNowPlayingTitle(result.lyrics?.title || "Audio analizado");
      setNowPlayingSubtitle(result.lyrics?.artist || "Artista detectado");
      if (result.duration) {
        setCurrentBpm(`${Math.round(result.duration)}s`);
      }
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
    setTransposeMap({});
    setAudioUrl(null);
    setNowPlayingTitle("Sin canción cargada");
    setNowPlayingSubtitle("Tu sesión en vivo");
    setCurrentBpm("— BPM");
    setIsPreviewPlaying(false);
  };

  const togglePreviewChords = () => {
    setIsPreviewPlaying((prev) => !prev);
    setActiveChordIndex((prev) => (prev + 1) % bottomChords.length);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070812] text-white selection:bg-violet-400/30 print:bg-white print:text-black print:overflow-visible print:min-h-0">
      {/* Luces de ambiente y elementos visuales de fondo de v0 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden print:hidden" aria-hidden="true">
        <div className="absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-violet-700/10 blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-[34rem] w-[34rem] rounded-full bg-blue-600/10 blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:72px_72px]" />

        {/* Ilustración de guitarra y notas musicales brillante */}
        <div
          className="guitar-glow absolute left-[64%] top-[54%] hidden h-[38rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] md:block"
          aria-hidden="true"
        >
          <div className="absolute left-1/2 top-0 h-40 w-9 -translate-x-1/2 rounded-t-lg rounded-b-sm border border-violet-200/30 bg-gradient-to-r from-slate-500/30 via-violet-300/25 to-slate-900/40 shadow-[0_0_35px_rgba(124,58,237,.25)]" />
          <div className="absolute left-1/2 top-[-1.4rem] h-12 w-16 -translate-x-1/2 rounded-xl border border-violet-200/30 bg-slate-900/80 shadow-[0_0_28px_rgba(124,58,237,.3)]">
            <span className="absolute left-2 top-3 size-1 rounded-full bg-cyan-200 shadow-[0_0_8px_#67e8f9]" />
            <span className="absolute right-2 top-3 size-1 rounded-full bg-cyan-200 shadow-[0_0_8px_#67e8f9]" />
          </div>
          <div className="absolute left-1/2 top-[7.5rem] h-56 w-14 -translate-x-1/2 border-x border-violet-200/25 bg-gradient-to-r from-slate-800/70 via-violet-300/20 to-slate-900/70 shadow-[0_0_24px_rgba(124,58,237,.2)]" />
          <div className="absolute left-1/2 top-[9rem] h-[21rem] w-[15rem] -translate-x-1/2 rounded-[45%] border border-violet-200/30 bg-gradient-to-br from-violet-400/25 via-indigo-500/12 to-slate-950/70 shadow-[0_0_100px_rgba(124,58,237,.32)] before:absolute before:left-1/2 before:top-[42%] before:h-20 before:w-28 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-cyan-200/30 before:bg-slate-950/50 before:shadow-[0_0_35px_rgba(34,211,238,.2)] after:absolute after:left-1/2 after:top-1/2 after:h-6 after:w-24 after:-translate-x-1/2 after:rounded-full after:bg-cyan-200/20 after:blur-[2px]" />
          <div className="absolute left-1/2 top-[7rem] flex h-[24rem] w-10 -translate-x-1/2 justify-around opacity-60">
            {[...Array(6)].map((_, i) => (
              <i key={i} className="h-full w-px bg-gradient-to-b from-cyan-100/70 via-violet-200/40 to-cyan-100/60" />
            ))}
          </div>
          <div className="absolute left-1/2 top-[10rem] h-[18rem] w-[11rem] -translate-x-1/2 opacity-50">
            {["top-8", "top-16", "top-24", "top-32", "top-40"].map((t, i) => (
              <i key={i} className={`absolute left-1/2 h-px w-full -translate-x-1/2 bg-violet-100/40 ${t}`} />
            ))}
          </div>
          <div className="absolute -right-20 top-12 text-[8rem] font-serif leading-none text-violet-300/10 drop-shadow-[0_0_30px_rgba(167,139,250,.35)]">
            𝄞
          </div>
        </div>
      </div>

      {/* Barra de navegación superior estilo v0 */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] shadow-lg shadow-violet-950/30">
            <Music2 className="size-4 text-violet-300" />
          </div>
          <span className="text-lg font-semibold tracking-[0.28em]">
            O<span className="text-violet-400">.</span>IR
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="hidden items-center gap-2 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            Motor de audio listo
          </span>
          <button
            type="button"
            onClick={() =>
              alert(
                "O.IR — Extracción Armónica & Karaoke con Inteligencia Artificial.\n\n" +
                  "1. Pega un enlace de YouTube para descargar el audio en MP3 sin anuncios.\n" +
                  "2. Carga tu archivo en 'Subir archivo' para detectar acordes y letra sincronizada.\n" +
                  "3. O usa el 'Micrófono' para tocar o cantar en directo."
              )
            }
            className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
            aria-label="Ayuda"
          >
            <HelpCircle className="size-4" />
          </button>
        </div>
      </header>

      {/* Contenido principal */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-4 lg:px-10 lg:pt-8 print:p-0 print:m-0 print:max-w-none">
        {/* Hero Section */}
        <div className="mb-10 max-w-2xl print:hidden">
          <div className="mb-4 flex items-center gap-4">
            <span className="text-3xl text-cyan-300 drop-shadow-[0_0_16px_rgba(103,232,249,.9)]">
              ♪
            </span>
            <h1 className="relative text-6xl font-black tracking-[-0.08em] text-white drop-shadow-[0_0_22px_rgba(139,92,246,.65)] sm:text-7xl">
              O<span className="text-violet-400">·</span>IR
              <span className="ml-3 text-4xl font-normal tracking-normal text-cyan-300">
                ♫
              </span>
            </h1>
            <span className="text-3xl text-violet-300 drop-shadow-[0_0_16px_rgba(167,139,250,.9)]">
              ♪
            </span>
          </div>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.07] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-violet-200">
            <Sparkles className="size-3.5" />
            Análisis musical inteligente
          </div>

          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            Toca la canción.
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              Encuentra su lenguaje.
            </span>
          </h2>

          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-400">
            Descubre acordes, ritmo y letra sincronizada en tiempo real. Tu próxima sesión empieza aquí.
          </p>
        </div>

        {/* Mensaje de error (si existe) */}
        {errorMessage && (
          <div className="mb-8 w-full max-w-4xl rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-200 backdrop-blur-md flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="rounded-lg bg-rose-900/60 px-3 py-1 font-semibold text-rose-200 transition hover:bg-rose-800"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Layout en 2 Columnas estilo v0 (si no hay datos procesados) */}
        {!processedData && !jobId && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px] print:hidden">
            {/* Columna Izquierda: Formulario de Entrada */}
            <SongInputForm
              onJobStarted={handleJobStarted}
              onError={(msg) => setErrorMessage(msg)}
              isProcessing={!!jobId}
              onCurrentSongChange={(title, artist, bpm) => {
                setNowPlayingTitle(title);
                if (artist) setNowPlayingSubtitle(artist);
                if (bpm) setCurrentBpm(bpm);
              }}
            />

            {/* Columna Derecha: Sidebar "Ahora suena / Tu sesión en vivo" */}
            <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Ahora suena
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-200 truncate max-w-[200px]">
                    {nowPlayingSubtitle}
                  </p>
                </div>
                <Radio className="size-4 text-cyan-300" />
              </div>

              <div className="mb-7 flex flex-col items-center text-center">
                <div className="relative mb-5 flex size-36 items-center justify-center rounded-full border border-violet-300/20 bg-gradient-to-br from-violet-500/20 to-blue-500/10 shadow-[0_0_50px_rgba(124,58,237,.15)]">
                  <div className="absolute inset-3 rounded-full border border-dashed border-cyan-300/20 animate-spin-slow" />
                  <Guitar className="size-12 text-violet-200" />
                  <span className="absolute -right-1 top-5 size-2 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" />
                </div>
                <span className="text-xs font-semibold text-slate-200 max-w-[220px] truncate block">
                  {nowPlayingTitle}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">Sesión activa</span>
              </div>

              <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-4">
                <span className="text-xs text-slate-500">Tempo / Longitud</span>
                <span className="font-mono text-xs text-slate-300">{currentBpm}</span>
              </div>

              <button
                type="button"
                onClick={togglePreviewChords}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] py-3 text-xs font-medium text-slate-200 transition hover:bg-white/10"
              >
                {isPreviewPlaying ? "Pausar preview" : "Preview de acordes"}
                {isPreviewPlaying ? (
                  <Pause className="size-3.5 fill-violet-300 text-violet-300" />
                ) : (
                  <Play className="size-3.5 text-slate-300" />
                )}
              </button>
            </aside>
          </div>
        )}

        {/* Barra de progreso de análisis */}
        {jobId && jobStatus && (
          <div className="w-full max-w-4xl mx-auto my-6 print:hidden">
            <ProcessingProgress status={jobStatus} />
          </div>
        )}

        {/* Clave de Sol · Visualizador de Progresión de Acordes (Tarjeta inferior estilo v0) */}
        {!processedData && (
          <div className="mt-5 flex flex-col gap-5 rounded-3xl border border-violet-300/20 bg-black/25 p-5 shadow-[0_0_55px_rgba(124,58,237,.12)] backdrop-blur-md sm:p-7 print:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-5xl leading-none text-violet-300 drop-shadow-[0_0_18px_rgba(167,139,250,.8)]">
                  𝄞
                </span>
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">
                    Clave de sol · Visualizador de acordes
                  </p>
                  <p className="text-sm text-slate-300">
                    Progresión armónica en tiempo real <span className="ml-2 text-xs text-slate-600">• 00:00</span>
                  </p>
                </div>
              </div>
              <Headphones className="size-4 text-slate-600" />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {bottomChords.map((chord, idx) => (
                <div
                  key={`${chord}-${idx}`}
                  className={`flex h-16 min-w-[72px] flex-1 items-center justify-center rounded-2xl border font-mono text-lg transition ${
                    idx === activeChordIndex
                      ? "border-violet-300/50 bg-gradient-to-br from-violet-500/25 to-indigo-500/10 text-violet-100 shadow-[0_0_26px_rgba(139,92,246,.18)] scale-[1.03]"
                      : "border-white/[0.07] bg-white/[0.025] text-slate-500 hover:text-slate-300 hover:border-white/20"
                  }`}
                >
                  {chord}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sección de Resultados cuando la canción culmina su análisis */}
        {processedData && (
          <div className="mt-8 w-full max-w-5xl mx-auto space-y-6 print:m-0 print:p-0 print:max-w-none print:space-y-0">
            {/* Header del resultado con botón de reiniciar y PDF */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur-md print:hidden">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border border-violet-400/30 text-violet-300 shadow-[0_0_20px_rgba(124,58,237,.2)]">
                  <Guitar className="size-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">
                    Canción analizada con éxito
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    {processedData.lyrics?.title || "Audio analizado"}{" "}
                    {processedData.lyrics?.artist ? `— ${processedData.lyrics.artist}` : ""}
                  </h3>
                  {processedData.estimated_key && (
                    <span className="text-xs text-slate-400 font-mono">
                      Tonalidad estimada: {processedData.estimated_key}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <PdfDownloadButton data={processedData} />
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  <RotateCcw className="size-3.5" />
                  Analizar otra
                </button>
              </div>
            </div>

            {/* Tarjeta de Dificultad */}
            {processedData.difficulty && (
              <div className="print:hidden">
                <DifficultyCard evaluation={processedData.difficulty} />
              </div>
            )}

            {/* Control de Transposición */}
            {processedData.unique_chords && processedData.unique_chords.length > 0 && (
              <div className="print:hidden">
                <TransposerControl
                  originalChords={processedData.unique_chords}
                  onTransposeChange={(mapping) => setTransposeMap(mapping)}
                />
              </div>
            )}

            {/* Selector de Vista: Cancionero vs Karaoke */}
            <div className="flex overflow-x-auto rounded-2xl border border-white/[0.07] bg-black/20 p-1 max-w-md print:hidden">
              <button
                type="button"
                onClick={() => setResultTab("chordsheet")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all ${
                  resultTab === "chordsheet"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/30"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <BookOpen className="size-4" />
                Cancionero (Acordes sobre Letra)
              </button>
              <button
                type="button"
                onClick={() => setResultTab("karaoke")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all ${
                  resultTab === "karaoke"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/30"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <Mic2 className="size-4" />
                Karaoke Interactivo
              </button>
            </div>

            {/* Vista activa */}
            {resultTab === "chordsheet" ? (
              <ChordSheetView
                title={processedData.lyrics?.title || "Audio Analizado"}
                artist={processedData.lyrics?.artist || "Desconocido"}
                chords={displayChords}
                lyrics={processedData.lyrics}
                estimatedKey={processedData.estimated_key}
                transposeMap={transposeMap}
                duration={processedData.duration}
                onLyricsSynced={(newLyrics) =>
                  setProcessedData((prev) =>
                    prev ? { ...prev, lyrics: newLyrics } : prev
                  )
                }
              />
            ) : (
              <div className="print:hidden">
                <KaraokeView
                  chords={displayChords}
                  lyrics={processedData.lyrics}
                  duration={processedData.duration}
                  estimatedKey={processedData.estimated_key}
                  audioUrl={
                    audioUrl ||
                    (processedData.audio_url
                      ? `${process.env.NEXT_PUBLIC_API_URL || "https://oir-api.onrender.com"}${processedData.audio_url}`
                      : undefined)
                  }
                />
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
