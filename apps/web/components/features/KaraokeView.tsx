"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChordItem, LyricsResult } from "@/types/song";

interface KaraokeViewProps {
  chords: ChordItem[];
  lyrics?: LyricsResult;
  duration: number;
  estimatedKey?: string | null;
  audioUrl?: string | null;
}

interface FormattedPrompterLine {
  chordLine: string;
  lyricLine: string;
  time: number;
  endTime: number;
}

// Frecuencias fundamentales de triadas para el sintetizador armónico
const CHORD_FREQUENCIES: Record<string, number[]> = {
  C: [261.63, 329.63, 392.0],
  Cm: [261.63, 311.13, 392.0],
  "C#": [277.18, 349.23, 415.3],
  "C#m": [277.18, 329.63, 415.3],
  D: [293.66, 369.99, 440.0],
  Dm: [293.66, 349.23, 440.0],
  "D#": [311.13, 392.0, 466.16],
  "D#m": [311.13, 369.99, 466.16],
  E: [329.63, 415.3, 493.88],
  Em: [329.63, 392.0, 493.88],
  F: [349.23, 440.0, 523.25],
  Fm: [349.23, 415.3, 523.25],
  "F#": [369.99, 466.16, 554.37],
  "F#m": [369.99, 440.0, 554.37],
  G: [392.0, 493.88, 587.33],
  Gm: [392.0, 466.16, 587.33],
  "G#": [415.3, 523.25, 622.25],
  "G#m": [415.3, 493.88, 622.25],
  A: [440.0, 554.37, 659.25],
  Am: [440.0, 523.25, 659.25],
  "A#": [466.16, 587.33, 698.46],
  "A#m": [466.16, 554.37, 698.46],
  B: [493.88, 622.25, 739.99],
  Bm: [493.88, 587.33, 739.99],
};

export default function KaraokeView({
  chords,
  lyrics,
  duration,
  estimatedKey,
  audioUrl,
}: KaraokeViewProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastSynthesizedChordRef = useRef<string | null>(null);

  // Sintetizador Web Audio API para asegurar sonido en cualquier circunstancia
  const playSynthesizerChord = (chordName: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const freqs = CHORD_FREQUENCIES[chordName] || [261.63, 329.63, 392.0];
      const now = ctx.currentTime;

      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 1.25);
      });
    } catch {
      // Ignorar si el navegador bloquea audio context
    }
  };

  // Reproductor sincronizado: si no hay archivo de audio, usar timer con sintetizador armónico
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && (!audioUrl || !audioRef.current)) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return Number((prev + 0.25).toFixed(2));
        });
      }, 250);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, duration, audioUrl]);

  // Acorde activo en el segundo actual para el display superior
  const currentChord = useMemo(() => {
    if (!chords || chords.length === 0) return "N/C";
    const found = chords
      .slice()
      .reverse()
      .find((c) => c.time <= currentTime);
    return found ? found.chord : chords[0].chord;
  }, [chords, currentTime]);

  // Si no hay archivo cargado de audio, hacer sonar el acorde sintetizado al cambiar
  useEffect(() => {
    if (isPlaying && !audioUrl && currentChord !== "N/C" && currentChord !== lastSynthesizedChordRef.current) {
      lastSynthesizedChordRef.current = currentChord;
      playSynthesizerChord(currentChord);
    }
  }, [currentChord, isPlaying, audioUrl]);

  // Construir las líneas completas del visor prompter (simplificadas para principiantes)
  const prompterLines = useMemo<FormattedPrompterLine[]>(() => {
    const lines = lyrics?.lines || [];

    if (lines.length > 0) {
      const formatted: FormattedPrompterLine[] = [];

      // 1. Intro instrumental antes del primer verso cantado
      const firstLineTime = lines[0].time;
      if (firstLineTime > 4.0) {
        const introChords = chords.filter((c) => c.time < firstLineTime);
        if (introChords.length > 0) {
          const distinctIntro: string[] = [];
          introChords.forEach((c) => {
            if (distinctIntro.length === 0 || distinctIntro[distinctIntro.length - 1] !== c.chord) {
              distinctIntro.push(c.chord);
            }
          });
          const displayIntro = distinctIntro.slice(0, 4);
          const chordText = displayIntro.map((c) => c.padEnd(16, " ")).join("");
          formatted.push({
            chordLine: `   ${chordText.trimEnd()}`,
            lyricLine: `[INTRO INSTRUMENTAL]   ${displayIntro.join("  -  ")}`,
            time: 0.0,
            endTime: firstLineTime,
          });
        }
      }

      // 2. Mapear cada verso con sus acordes simplificados
      lines.forEach((line, idx) => {
        const lineStart = line.time;
        const nextLineStart = lines[idx + 1]?.time || lineStart + 6;
        const lineDuration = Math.max(nextLineStart - lineStart, 2);

        // Buscar acordes en la ventana de tiempo
        const lineChords = chords.filter(
          (c) => c.time >= lineStart - 0.5 && c.time < nextLineStart
        );

        let activeChords = lineChords;
        if (activeChords.length === 0) {
          const lastChord = chords
            .slice()
            .reverse()
            .find((c) => c.time <= lineStart);
          if (lastChord) activeChords = [lastChord];
        }

        let text = line.text.trim();
        if (!text) {
          if (activeChords.length > 0) {
            text = "[INTERLUDIO INSTRUMENTAL]";
          } else {
            return;
          }
        }

        // Simplificación para principiantes: desduplicar y limitar a máximo 2 acordes por línea
        const distinctChords: ChordItem[] = [];
        activeChords.forEach((c) => {
          if (
            distinctChords.length === 0 ||
            distinctChords[distinctChords.length - 1].chord !== c.chord
          ) {
            distinctChords.push(c);
          }
        });

        let simplifiedChords = distinctChords;
        if (simplifiedChords.length > 2) {
          simplifiedChords = [simplifiedChords[0], simplifiedChords[simplifiedChords.length - 1]];
        }

        const chordLineChars = new Array(Math.max(text.length, 36)).fill(" ");

        if (simplifiedChords.length === 1) {
          const chordName = simplifiedChords[0].chord;
          const insertPos = Math.min(2, Math.max(0, text.length - chordName.length));
          for (let i = 0; i < chordName.length; i++) {
            chordLineChars[insertPos + i] = chordName[i];
          }
        } else if (simplifiedChords.length >= 2) {
          const chord1 = simplifiedChords[0].chord;
          const chord2 = simplifiedChords[1].chord;

          for (let i = 0; i < chord1.length; i++) {
            chordLineChars[i] = chord1[i];
          }

          const ratio = Math.max(0.4, Math.min(0.75, (simplifiedChords[1].time - lineStart) / lineDuration));
          let pos2 = Math.floor(ratio * text.length);
          if (pos2 < chord1.length + 6) pos2 = chord1.length + 6;

          for (let i = 0; i < chord2.length; i++) {
            if (pos2 + i < chordLineChars.length) {
              chordLineChars[pos2 + i] = chord2[i];
            }
          }
        }

        formatted.push({
          chordLine: chordLineChars.join("").trimEnd(),
          lyricLine: text,
          time: lineStart,
          endTime: nextLineStart,
        });
      });

      return formatted;
    }

    // Estructuración automática si no hay letra
    const step = 2;
    const sectionNames = [
      "INTRO",
      "ESTROFA 1",
      "ESTROFA 2",
      "CORO",
      "PUENTE",
      "ESTROFA 3",
      "CORO FINAL",
      "OUTRO",
    ];
    let secIdx = 0;
    const generated: FormattedPrompterLine[] = [];

    const distinctGlobalChords: ChordItem[] = [];
    chords.forEach((c) => {
      if (
        distinctGlobalChords.length === 0 ||
        distinctGlobalChords[distinctGlobalChords.length - 1].chord !== c.chord
      ) {
        distinctGlobalChords.push(c);
      }
    });

    for (let i = 0; i < distinctGlobalChords.length; i += step) {
      const chunk = distinctGlobalChords.slice(i, i + step);
      const startT = chunk[0].time;
      const endT = distinctGlobalChords[i + step]?.time || (startT + 6);
      const currentSec = sectionNames[secIdx % sectionNames.length];
      if (i > 0 && i % (step * 2) === 0) secIdx++;

      const chordText = chunk.map((c) => c.chord.padEnd(16, " ")).join("");
      const phraseText = `[${currentSec}]   ` + chunk.map((c) => c.chord).join("  -  ");

      generated.push({
        chordLine: `   ${chordText}`,
        lyricLine: phraseText,
        time: startT,
        endTime: endT,
      });
    }

    return generated;
  }, [lyrics?.lines, chords]);

  // Manejo de reproducción/pausa vinculado al elemento de audio real
  const handleTogglePlay = () => {
    if (audioRef.current && audioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.warn("Reproducción directa falló, activando timer:", err);
            setIsPlaying(true);
          });
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Salto manual a un tiempo específico
  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Auto-scroll del prompter hacia la línea activa durante la reproducción
  useEffect(() => {
    if (isPlaying && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime, isPlaying]);

  return (
    <div className="card w-full max-w-4xl mx-auto shadow-2xl border-slate-800 bg-[#0b0f19] p-6 sm:p-8">
      {/* Elemento de Audio HTML5 real vinculado */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
      )}

      {/* Barra superior: Tonalidad y Acorde Actual Gigante */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-slate-400">
            Tonalidad
          </span>
          <p className="text-2xl font-black text-white mt-0.5">
            {estimatedKey || "Estándar"}
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs uppercase tracking-widest font-bold text-amber-500">
            Acorde Actual
          </span>
          <div className="mt-1">
            <span className="inline-block bg-amber-500/20 border-2 border-amber-500 text-amber-400 text-4xl font-black px-6 py-2 rounded-2xl shadow-xl shadow-amber-950/50 tracking-wider">
              {currentChord}
            </span>
          </div>
        </div>
      </div>

      {/* Control de reproducción / Timeline sincronizado */}
      <div className="my-6 bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 px-5 rounded-xl transition-all shadow-md shadow-amber-950/40 hover:scale-105 active:scale-95"
            >
              {isPlaying ? "⏸️ Pausar" : "▶️ Reproducir"}
            </button>

            <button
              type="button"
              onClick={() => handleSeek(0)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 px-3 rounded-lg border border-slate-700 transition-colors"
            >
              ⏮️ Reiniciar
            </button>
          </div>

          <span className="font-mono text-xs font-semibold text-slate-300">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="w-full accent-amber-500 cursor-pointer"
        />
      </div>

      {/* Visor Prompter Sincronizado (Acordes sobre Letra con auto-scroll) */}
      <div
        ref={containerRef}
        className="max-h-[480px] overflow-y-auto pr-2 space-y-4 font-mono scroll-smooth"
      >
        {prompterLines.map((line, idx) => {
          const isLineActive =
            currentTime >= line.time &&
            (idx === prompterLines.length - 1 || currentTime < line.endTime);

          return (
            <div
              key={idx}
              ref={isLineActive ? activeLineRef : null}
              onClick={() => handleSeek(line.time)}
              className={`p-4 rounded-xl transition-all cursor-pointer border ${
                isLineActive
                  ? "bg-amber-500/10 border-amber-500/80 shadow-lg shadow-amber-950/40 scale-[1.01]"
                  : "bg-slate-950/40 border-slate-900/60 opacity-60 hover:opacity-100 hover:border-slate-800"
              }`}
            >
              {/* Acordes alineados arriba */}
              {line.chordLine && (
                <pre
                  className={`text-sm font-bold tracking-widest whitespace-pre transition-colors ${
                    isLineActive ? "text-amber-400 font-black" : "text-amber-500/70"
                  }`}
                >
                  {line.chordLine}
                </pre>
              )}
              {/* Letra de la canción alineada abajo */}
              {line.lyricLine && (
                <pre
                  className={`text-sm font-medium tracking-wide whitespace-pre transition-colors ${
                    isLineActive ? "text-white font-bold" : "text-slate-400"
                  }`}
                >
                  {isLineActive ? `▶  ${line.lyricLine}` : `   ${line.lyricLine}`}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}
