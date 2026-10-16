"use client";

import React, { useState } from "react";
import { transposeChords, CapoRecommendation } from "@/services/api";

interface TransposerControlProps {
  originalChords: string[];
  onTransposeChange: (transposedMap: Record<string, string>, currentSemitones: number) => void;
}

export default function TransposerControl({
  originalChords,
  onTransposeChange,
}: TransposerControlProps) {
  const [semitones, setSemitones] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [capoSuggestion, setCapoSuggestion] = useState<CapoRecommendation | null>(null);

  const handleShift = async (delta: number) => {
    const nextSemitones = semitones + delta;
    if (nextSemitones < -6 || nextSemitones > 6) return;

    setLoading(true);
    setSemitones(nextSemitones);

    try {
      if (nextSemitones === 0) {
        onTransposeChange({}, 0);
        setCapoSuggestion(null);
      } else {
        const res = await transposeChords(originalChords, nextSemitones);
        const mapping: Record<string, string> = {};
        res.original_chords.forEach((orig, idx) => {
          mapping[orig] = res.transposed_chords[idx] || orig;
        });
        onTransposeChange(mapping, nextSemitones);
        if (res.capo_suggestion) {
          setCapoSuggestion(res.capo_suggestion);
        }
      }
    } catch (err) {
      console.error("Error al transponer:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetPitch = () => {
    setSemitones(0);
    setCapoSuggestion(null);
    onTransposeChange({}, 0);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 my-4 backdrop-blur-sm shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">🎵 Tonalidad:</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-medium">
            {semitones === 0
              ? "Tono original (0)"
              : semitones > 0
              ? `+${semitones} semitonos`
              : `${semitones} semitonos`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleShift(-1)}
            disabled={semitones <= -6 || loading}
            aria-label="Bajar un semitono"
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-sm transition-colors border border-slate-700 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            -1
          </button>

          <button
            type="button"
            onClick={resetPitch}
            disabled={semitones === 0 || loading}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 disabled:opacity-40"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={() => handleShift(1)}
            disabled={semitones >= 6 || loading}
            aria-label="Subir un semitono"
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-sm transition-colors border border-slate-700 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            +1
          </button>
        </div>
      </div>

      {capoSuggestion && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-start gap-2.5 text-xs text-amber-300/90 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
          <span className="text-base">🎸</span>
          <div>
            <div className="font-semibold text-amber-200">
              Sugerencia de Capo (Traste {capoSuggestion.fret})
            </div>
            <p className="text-slate-300 mt-0.5 leading-relaxed">
              {capoSuggestion.explanation}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-slate-400 font-mono">
                Figuras: {capoSuggestion.transposed_shapes.join(" - ")}
              </span>
              <span className="bg-emerald-950 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold border border-emerald-800/60">
                -{capoSuggestion.difficulty_reduction}% dificultad
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
