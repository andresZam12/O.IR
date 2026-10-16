"use client";

import React, { useMemo } from "react";
import { ChordItem, LyricsResult } from "@/types/song";

interface ChordSheetViewProps {
  title?: string;
  artist?: string;
  chords: ChordItem[];
  lyrics?: LyricsResult;
  estimatedKey?: string | null;
  transposeMap?: Record<string, string>;
}

interface FormattedLine {
  chordLine: string;
  lyricLine: string;
  time?: number;
}

export default function ChordSheetView({
  title = "Canción",
  artist = "Artista",
  chords,
  lyrics,
  estimatedKey,
  transposeMap = {},
}: ChordSheetViewProps) {
  // Transponer el acorde en tiempo real si el usuario aplicó Capo
  const getChordDisplay = (rawChord: string) => {
    return transposeMap[rawChord] || rawChord;
  };

  // Formatear la transcripción armónica completa de inicio a fin
  const songSheetLines = useMemo<FormattedLine[]>(() => {
    const lines = lyrics?.lines || [];

    // CASO A: Letra completa obtenida automáticamente por la IA
    if (lines.length > 0) {
      const formatted: FormattedLine[] = [];

      // 1. Si la canción tiene introducción instrumental antes del primer verso cantado
      const firstLineTime = lines[0].time;
      if (firstLineTime > 4.0) {
        const introChords = chords.filter((c) => c.time < firstLineTime);
        if (introChords.length > 0) {
          const distinctIntro: string[] = [];
          introChords.forEach((c) => {
            const name = getChordDisplay(c.chord);
            if (distinctIntro.length === 0 || distinctIntro[distinctIntro.length - 1] !== name) {
              distinctIntro.push(name);
            }
          });
          const displayIntro = distinctIntro.slice(0, 4);
          const chordText = displayIntro.map((c) => c.padEnd(16, " ")).join("");
          formatted.push({
            chordLine: `   ${chordText.trimEnd()}`,
            lyricLine: `[INTRO INSTRUMENTAL]   ${displayIntro.join("  -  ")}`,
            time: 0.0,
          });
        }
      }

      // 2. Mapear cada verso de la letra con sus acordes simplificados para principiantes
      lines.forEach((line, idx) => {
        const lineStart = line.time;
        const nextLineStart = lines[idx + 1]?.time || lineStart + 6;
        const lineDuration = Math.max(nextLineStart - lineStart, 2);

        // Acordes que caen en la ventana de tiempo de este verso
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

        // Simplificación para principiantes: desduplicar y conservar máximo 2 acordes estructurales por línea
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

        // Construir la línea de acordes alineada sobre las palabras
        const chordLineChars = new Array(Math.max(text.length, 36)).fill(" ");

        if (simplifiedChords.length === 1) {
          const chordName = getChordDisplay(simplifiedChords[0].chord);
          const insertPos = Math.min(2, Math.max(0, text.length - chordName.length));
          for (let i = 0; i < chordName.length; i++) {
            chordLineChars[insertPos + i] = chordName[i];
          }
        } else if (simplifiedChords.length >= 2) {
          const chord1 = getChordDisplay(simplifiedChords[0].chord);
          const chord2 = getChordDisplay(simplifiedChords[1].chord);

          // Primer acorde al inicio de la frase
          for (let i = 0; i < chord1.length; i++) {
            chordLineChars[i] = chord1[i];
          }

          // Segundo acorde colocado holgadamente a mitad de la frase o donde caiga el cambio armónico
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
        });
      });

      return formatted;
    }

    // CASO B: Estructuración musical completa automática de inicio a fin desde los acordes detectados
    const step = 2;
    const sectionNames = [
      "INTRO",
      "ESTROFA 1",
      "ESTROFA 2",
      "CORO",
      "PUENTE INSTRUMENTAL",
      "ESTROFA 3",
      "CORO FINAL",
      "OUTRO",
    ];
    let secIdx = 0;
    const generated: FormattedLine[] = [];

    // Desduplicar acordes consecutivos
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
      const currentSec = sectionNames[secIdx % sectionNames.length];
      if (i > 0 && i % (step * 2) === 0) secIdx++;

      // Formatear acordes arriba y frase abajo
      const chordText = chunk.map((c) => getChordDisplay(c.chord).padEnd(20, " ")).join("");
      const phraseText = `[${currentSec}]   ` + chunk.map((c) => getChordDisplay(c.chord)).join("  -  ");

      generated.push({
        chordLine: `    ${chordText}`,
        lyricLine: phraseText,
        time: startT,
      });
    }

    return generated;
  }, [lyrics?.lines, chords, transposeMap]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="card w-full max-w-4xl mx-auto shadow-2xl border-slate-800 bg-[#0b0f19] p-6 sm:p-10 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
      {/* Encabezado limpio de la partitura */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800/80 gap-4 print:border-b-2 print:border-black">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-amber-500 print:text-amber-800">
            Cancionero Armónico &bull; Tonalidad: {estimatedKey || "Estándar"}
          </span>
          <h2 className="text-3xl font-black text-white tracking-tight mt-1 uppercase print:text-black">
            {title}
          </h2>
          {artist && (
            <p className="text-sm font-medium text-slate-400 mt-0.5 print:text-slate-600">
              {artist}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="print:hidden text-xs font-bold px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-lg shadow-amber-950/40 flex items-center gap-2 hover:scale-105 active:scale-95"
        >
          🖨️ Imprimir Cancionero
        </button>
      </div>

      {/* Contenido completo de la canción de principio a fin */}
      <div className="my-8 font-mono text-sm leading-relaxed overflow-x-auto">
        <div className="space-y-6">
          {songSheetLines.map((item, idx) => (
            <div key={idx} className="transition-opacity hover:opacity-100">
              {/* Acordes alineados arriba en color Ámbar/Naranja */}
              {item.chordLine && (
                <pre className="text-amber-400 font-bold tracking-widest text-sm select-all whitespace-pre print:text-amber-700">
                  {item.chordLine}
                </pre>
              )}
              {/* Letra de la canción alineada abajo en blanco limpio */}
              {item.lyricLine && (
                <pre className="text-slate-100 font-medium tracking-wide text-sm select-all whitespace-pre print:text-black">
                  {item.lyricLine}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pie de página sutil para impresión */}
      <div className="pt-6 border-t border-slate-800/80 flex justify-between items-center text-xs text-slate-500 print:text-slate-600">
        <span>O.IR &bull; Transcripción Armónica con IA</span>
        <span>Fin de la canción</span>
      </div>
    </div>
  );
}
