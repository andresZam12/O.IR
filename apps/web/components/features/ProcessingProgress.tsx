"use client";

import React from "react";
import { SongJobStatus } from "@/types/song";

interface ProcessingProgressProps {
  status: SongJobStatus;
}

const STEP_LABELS: Record<string, { label: string; icon: string }> = {
  iniciando: { label: "Preparando y cargando archivo...", icon: "⚙️" },
  detectando_acordes: {
    label: "Analizando frecuencias y detectando acordes con IA...",
    icon: "🎸",
  },
  sincronizando_letras: {
    label: "Obteniendo letra sincronizada con LRCLIB...",
    icon: "🎤",
  },
  evaluando_dificultad: {
    label: "Calculando dificultad y preparando consejos de práctica...",
    icon: "📊",
  },
  finalizando: { label: "Estructurando resultado final...", icon: "✨" },
  completado: { label: "¡Canción analizada con éxito!", icon: "🎉" },
};

export default function ProcessingProgress({
  status,
}: ProcessingProgressProps) {
  const currentStep = status.step || "iniciando";
  const stepInfo = STEP_LABELS[currentStep] || {
    label: "Procesando audio...",
    icon: "🔄",
  };

  const progressPercent = Math.min(100, Math.max(0, status.progress));

  return (
    <div className="card w-full max-w-2xl mx-auto shadow-2xl border-slate-800 bg-slate-900/90 backdrop-blur-md p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl animate-bounce">{stepInfo.icon}</span>
          <span className="font-semibold text-white text-sm">
            {stepInfo.label}
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-primary-400 bg-primary-950/60 px-2.5 py-1 rounded-full border border-primary-800">
          {progressPercent}%
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
        <div
          className="bg-gradient-to-r from-primary-600 via-indigo-500 to-primary-400 h-full rounded-full transition-all duration-500 ease-out shadow-lg shadow-primary-500/50"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Indicadores de etapas del pipeline */}
      <div className="grid grid-cols-4 gap-2 mt-6 pt-4 border-t border-slate-800/80 text-center">
        <StepIndicator
          label="Audio"
          active={progressPercent >= 10}
          completed={progressPercent > 25}
        />
        <StepIndicator
          label="Acordes"
          active={progressPercent >= 30}
          completed={progressPercent > 60}
        />
        <StepIndicator
          label="Letra"
          active={progressPercent >= 65}
          completed={progressPercent > 80}
        />
        <StepIndicator
          label="Dificultad"
          active={progressPercent >= 85}
          completed={progressPercent === 100}
        />
      </div>
    </div>
  );
}

function StepIndicator({
  label,
  active,
  completed,
}: {
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all ${
          completed
            ? "bg-green-500 text-slate-950"
            : active
            ? "bg-primary-500 text-white animate-pulse"
            : "bg-slate-800 text-slate-500"
        }`}
      >
        {completed ? "✓" : "•"}
      </div>
      <span
        className={`text-xs ${
          active ? "text-slate-200 font-medium" : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
