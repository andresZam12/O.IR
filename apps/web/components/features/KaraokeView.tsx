"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChordItem, LyricsResult } from "@/types/song";

interface KaraokeViewProps {
  chords: ChordItem[];
  lyrics?: LyricsResult;
  duration: number;
  estimatedKey?: string | null;
}

interface FormattedPrompterLine {
  chordLine: string;
  lyricLine: string;
  time: number;
  endTime: number;
}

export default function KaraokeView({
  chords,
  lyrics,
  duration,
  estimatedKey,
}: KaraokeViewProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Reproductor sincronizado con timer de alta precisión
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
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
  }, [isPlaying, duration]);

  // Acorde activo en el segundo actual para el display superior
  const currentChord = useMemo(() => {
    if (!chords || chords.length === 0) return "N/C";
    const found = chords
      .slice()
      .reverse()
      .find((c) => c.time <= currentTime);
    return found ? found.chord : chords[0].chord;
  }, [chords, currentTime]);

  // Construir las líneas completas del visor prompter (con acordes alineados arriba)
  const prompterLines = useMemo<FormattedPrompterLine[]>(() => {
    const lines = lyrics?.lines || [];

    if (lines.length > 0) {
      const formatted: FormattedPrompterLine[] = [];

      // 1. Intro instrumental antes del primer verso cantado
      const firstLineTime = lines[0].time;
      if (firstLineTime > 4.0) {
        const introChords = chords.filter((c) => c.time < firstLineTime);
        if (introChords.length > 0) {
          const chordText = introChords
            .map((c) => c.chord.padEnd(16, " "))
            .join("");
          formatted.push({
            chordLine: `   ${chordText.trimEnd()}`,
            lyricLine: `[INTRO INSTRUMENTAL]   ${introChords.map((c) => c.chord).join("  -  ")}`,
            time: 0.0,
            endTime: firstLineTime,
          });
        }
      }

      // 2. Mapear cada verso con sus acordes
      lines.forEach((line, idx) => {
        const lineStart = line.time;
        const nextLineStart = lines[idx + 1]?.time || (lineStart + 6);
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

        const chordLineChars = new Array(Math.max(text.length, 36)).fill(" ");

        if (activeChords.length === 1) {
          const chordName = activeChords[0].chord;
          const insertPos = Math.min(4, Math.max(0, text.length - chordName.length));
          for (let i = 0; i < chordName.length; i++) {
            chordLineChars[insertPos + i] = chordName[i];
          }
        } else {
          activeChords.forEach((c, cIdx) => {
            const chordName = c.chord;
            const ratio = Math.max(0, Math.min(0.85, (c.time - lineStart) / lineDuration));
            let insertPos = Math.floor(ratio * text.length);

            if (cIdx > 0) {
              const prevRatio = Math.max(0, (activeChords[cIdx - 1].time - lineStart) / lineDuration);
              const prevChordEnd = Math.floor(prevRatio * text.length) + activeChords[cIdx - 1].chord.length + 2;
              if (insertPos < prevChordEnd) insertPos = prevChordEnd;
            }

            for (let i = 0; i < chordName.length; i++) {
              if (insertPos + i < chordLineChars.length) {
                chordLineChars[insertPos + i] = chordName[i];
              }
            }
          });
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
    const sectionNames = ["INTRO", "ESTROFA 1", "ESTROFA 2", "CORO", "PUENTE", "ESTROFA 3", "CORO FINAL", "OUTRO"];
    let secIdx = 0;
    const generated: FormattedPrompterLine[] = [];

    for (let i = 0; i < chords.length; i += step) {
      const chunk = chords.slice(i, i + step);
      const startT = chunk[0].time;
      const endT = chords[i + step]?.time || (startT + 6);
      const currentSec = sectionNames[secIdx % sectionNames.length];
      if (i > 0 && i % (step * 2) === 0) secIdx++;

      const chordText = chunk.map((c) => c.chord.padEnd(14, " ")).join("");
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
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 px-5 rounded-xl transition-all shadow-md shadow-amber-950/40 hover:scale-105 active:scale-95"
          >
            {isPlaying ? "⏸️ Pausar" : "▶️ Reproducir"}
          </button>

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
          onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
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
              onClick={() => setCurrentTime(line.time)}
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
