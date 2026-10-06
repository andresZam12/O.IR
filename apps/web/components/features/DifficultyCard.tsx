"use client";

import React from "react";
import { DifficultyEvaluation } from "@/types/song";

interface DifficultyCardProps {
  evaluation: DifficultyEvaluation;
}

export default function DifficultyCard({ evaluation }: DifficultyCardProps) {
  const { metrics, explanation, practice_tips } = evaluation;

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "principiante":
        return "text-emerald-400 bg-emerald-950/50 border-emerald-800";
      case "intermedio":
        return "text-amber-400 bg-amber-950/50 border-amber-800";
      case "avanzado":
        return "text-rose-400 bg-rose-950/50 border-rose-800";
      default:
        return "text-primary-400 bg-primary-950/50 border-primary-800";
    }
  };

  return (
    <div className="card w-full max-w-3xl mx-auto shadow-2xl border-slate-800 bg-slate-900/90 backdrop-blur-md p-6 sm:p-8">
      {/* Encabezado con Score */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Nivel de Dificultad
          </span>
          <div className="flex items-center gap-3 mt-1">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${getLevelColor(
                metrics.level
              )}`}
            >
              {metrics.level}
            </span>
            <span className="text-3xl font-extrabold text-white">
              {metrics.score}
              <span className="text-slate-500 text-lg font-normal"> / 10</span>
            </span>
          </div>
        </div>

        {/* Métricas objetivas */}
        <div className="grid grid-cols-3 gap-3 w-full sm:w-auto">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-center">
            <span className="block text-xs text-slate-400">Acordes</span>
            <span className="text-lg font-bold text-white">
              {metrics.unique_chord_count}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-center">
            <span className="block text-xs text-slate-400">Cejillas</span>
            <span className="text-lg font-bold text-amber-400">
              {metrics.barre_chord_count}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-center">
            <span className="block text-xs text-slate-400">Cambios/min</span>
            <span className="text-lg font-bold text-white">
              {metrics.changes_per_minute}
            </span>
          </div>
        </div>
      </div>

      {/* Explicación simple generada */}
      <div className="my-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <span>💡</span>
          <span>¿Por qué tiene esta dificultad?</span>
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/70">
          {explanation}
        </p>
      </div>

      {/* Consejos prácticos */}
      {practice_tips.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <span>🎯</span>
            <span>Consejos de práctica recomendados:</span>
          </h3>
          <ul className="space-y-2.5">
            {practice_tips.map((tip, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-sm text-slate-300 bg-primary-950/20 border border-primary-900/30 p-3 rounded-xl"
              >
                <span className="text-primary-400 font-bold mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
