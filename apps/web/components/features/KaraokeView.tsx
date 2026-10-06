"use client";

import React, { useState, useEffect } from "react";
import { ChordItem, LyricsResult } from "@/types/song";

interface KaraokeViewProps {
  chords: ChordItem[];
  lyrics?: LyricsResult;
  duration: number;
  estimatedKey?: string | null;
}

export default function KaraokeView({
  chords,
  lyrics,
  duration,
  estimatedKey,
}: KaraokeViewProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Reproductor simulado con timer
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

  // Buscar el acorde activo en el currentTime actual
  const currentChord =
    chords
      .slice()
      .reverse()
      .find((c) => c.time <= currentTime)?.chord || "N/C";

  return (
    <div className="card w-full max-w-3xl mx-auto shadow-2xl border-slate-800 bg-slate-900/90 backdrop-blur-md p-6 sm:p-8">
      {/* Barra superior con Tonalidad y Acorde Activo Gigante */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Tonalidad Estimada
          </span>
          <p className="text-xl font-bold text-white mt-0.5">
            {estimatedKey || "No determinada"}
          </p>
        </div>

        {/* Display del acorde activo */}
        <div className="text-right">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Acorde Actual
          </span>
          <div className="mt-1">
            <span className="inline-block bg-primary-600/30 border border-primary-500/60 text-primary-300 text-3xl font-black px-4 py-1.5 rounded-xl shadow-lg shadow-primary-900/40">
              {currentChord}
            </span>
          </div>
        </div>
      </div>

      {/* Control de reproducción / Timeline */}
      <div className="my-6 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors"
          >
            {isPlaying ? "⏸️ Pausar" : "▶️ Reproducir"}
          </button>

          <span className="font-mono text-xs text-slate-300">
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
          className="w-full accent-primary-500 cursor-pointer"
        />
      </div>

      {/* Vista Karaoke con letra y acordes sobre cada línea */}
      {lyrics?.lines && lyrics.lines.length > 0 ? (
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {lyrics.lines.map((line, idx) => {
            const isLineActive =
              currentTime >= line.time &&
              (idx === lyrics.lines.length - 1 ||
                currentTime < lyrics.lines[idx + 1].time);

            return (
              <div
                key={idx}
                onClick={() => setCurrentTime(line.time)}
                className={`p-3 rounded-xl transition-all cursor-pointer border ${
                  isLineActive
                    ? "bg-primary-950/40 border-primary-500 shadow-md shadow-primary-950"
                    : "bg-slate-950/40 border-slate-800/60 hover:border-slate-700"
                }`}
              >
                {/* Acorde encima de la letra */}
                {line.chord && (
                  <span className="inline-block font-mono font-bold text-xs text-primary-400 bg-primary-950/80 border border-primary-800 px-2 py-0.5 rounded mb-1">
                    {line.chord}
                  </span>
                )}
                {/* Texto de la letra */}
                <p
                  className={`text-base font-medium transition-colors ${
                    isLineActive ? "text-white font-semibold" : "text-slate-400"
                  }`}
                >
                  {line.text}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        /* Secuencia de acordes si no hay letra */
        <div className="max-h-80 overflow-y-auto">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Secuencia temporal de acordes:
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {chords.map((c, i) => {
              const isCurrent =
                currentTime >= c.time &&
                (i === chords.length - 1 || currentTime < chords[i + 1].time);
              return (
                <div
                  key={i}
                  onClick={() => setCurrentTime(c.time)}
                  className={`p-2.5 rounded-lg border text-center cursor-pointer transition-all ${
                    isCurrent
                      ? "bg-primary-600 border-primary-400 text-white font-bold"
                      : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="block text-xs text-slate-500 font-mono">
                    {formatTime(c.time)}
                  </span>
                  <span className="text-base font-bold">{c.chord}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
