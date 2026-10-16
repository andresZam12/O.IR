"use client";

import React, { useState, useMemo } from "react";
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
}

export default function ChordSheetView({
  title = "Canción",
  artist = "Artista",
  chords,
  lyrics,
  estimatedKey,
  transposeMap = {},
}: ChordSheetViewProps) {
  const [customLyrics, setCustomLyrics] = useState<string>("");
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);

  // Obtener nombre del acorde transponiendo si existe mapeo
  const getChordDisplay = (rawChord: string) => {
    return transposeMap[rawChord] || rawChord;
  };

  // 1. Si hay letra sincronizada de LRCLIB, distribuir los acordes temporalmente sobre cada frase
  const formattedFromLyrics = useMemo<FormattedLine[]>(() => {
    const lines = lyrics?.lines || [];
    if (lines.length === 0) return [];

    return lines.map((line, idx) => {
      const lineStart = line.time;
      const nextLineStart = lines[idx + 1]?.time || lineStart + 6;
      const lineDuration = Math.max(nextLineStart - lineStart, 2);

      // Buscar todos los acordes que caen en la ventana de tiempo de esta línea
      const lineChords = chords.filter(
        (c) => c.time >= lineStart - 0.5 && c.time < nextLineStart
      );

      // Si no se detectó ningún acorde en la ventana, usar el acorde más reciente
      let activeChords = lineChords;
      if (activeChords.length === 0) {
        const lastChord = chords
          .slice()
          .reverse()
          .find((c) => c.time <= lineStart);
        if (lastChord) {
          activeChords = [lastChord];
        }
      }

      const text = line.text.trim();
      if (!text) {
        return { chordLine: "", lyricLine: "" };
      }

      // Construir línea de acordes espaciada monospaced
      let chordLineChars = new Array(Math.max(text.length, 30)).fill(" ");

      if (activeChords.length === 1) {
        // Un solo acorde: colocarlo al inicio o sobre la primera palabra importante
        const chordName = getChordDisplay(activeChords[0].chord);
        const insertPos = Math.min(6, Math.max(0, text.length - chordName.length));
        for (let i = 0; i < chordName.length; i++) {
          chordLineChars[insertPos + i] = chordName[i];
        }
      } else {
        // Múltiples acordes: distribuirlos según el timestamp relativo
        activeChords.forEach((c, cIdx) => {
          const chordName = getChordDisplay(c.chord);
          const ratio = Math.max(0, Math.min(0.85, (c.time - lineStart) / lineDuration));
          let insertPos = Math.floor(ratio * text.length);

          // Asegurar que no se solape con el acorde previo
          if (cIdx > 0) {
            const prevChordEnd = Math.floor(
              (Math.max(0, (activeChords[cIdx - 1].time - lineStart) / lineDuration) * text.length) +
              getChordDisplay(activeChords[cIdx - 1].chord).length + 2
            );
            if (insertPos < prevChordEnd) {
              insertPos = prevChordEnd;
            }
          }

          for (let i = 0; i < chordName.length; i++) {
            if (insertPos + i < chordLineChars.length) {
              chordLineChars[insertPos + i] = chordName[i];
            }
          }
        });
      }

      return {
        chordLine: chordLineChars.join("").trimEnd(),
        lyricLine: text,
      };
    });
  }, [lyrics?.lines, chords, transposeMap]);

  // 2. Si el usuario ingresó letra manual o pegada
  const formattedFromCustom = useMemo<FormattedLine[]>(() => {
    if (!customLyrics.trim()) return [];
    const rawLines = customLyrics.split("\n");
    const uniqueChordsList = chords.map((c) => getChordDisplay(c.chord));
    let chordPointer = 0;

    return rawLines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return { chordLine: "", lyricLine: "" };

      // Asignar acordes secuenciales por verso
      const c1 = uniqueChordsList[chordPointer % uniqueChordsList.length] || "C";
      chordPointer++;
      const c2 = uniqueChordsList[chordPointer % uniqueChordsList.length] || "G";
      chordPointer++;

      let chordLineChars = new Array(Math.max(trimmed.length, 30)).fill(" ");
      const pos1 = Math.floor(trimmed.length * 0.15);
      const pos2 = Math.floor(trimmed.length * 0.65);

      for (let i = 0; i < c1.length; i++) chordLineChars[pos1 + i] = c1[i];
      for (let i = 0; i < c2.length; i++) chordLineChars[pos2 + i] = c2[i];

      return {
        chordLine: chordLineChars.join("").trimEnd(),
        lyricLine: trimmed,
      };
    });
  }, [customLyrics, chords, transposeMap]);

  // 3. Si no hay letra disponible, estructurar la progresión de acordes en compases de 4
  const structuredProgression = useMemo<string[]>(() => {
    const bars: string[] = [];
    const step = 4;
    for (let i = 0; i < chords.length; i += step) {
      const slice = chords.slice(i, i + step);
      const barText = slice
        .map((c) => getChordDisplay(c.chord).padEnd(8, " "))
        .join(" |  ");
      bars.push(`|  ${barText} |`);
    }
    return bars;
  }, [chords, transposeMap]);

  const activeLines =
    formattedFromCustom.length > 0
      ? formattedFromCustom
      : formattedFromLyrics;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="card w-full max-w-3xl mx-auto shadow-2xl border-slate-800 bg-[#0c1220] backdrop-blur-md p-6 sm:p-8 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
      {/* Encabezado del Cancionero */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4 print:border-b-2 print:border-black">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-amber-500 print:text-amber-700">
            Cancionero de Acordes &bull; Tonalidad: {estimatedKey || "General"}
          </span>
          <h2 className="text-2xl font-black text-white tracking-wide mt-1 uppercase print:text-black">
            {title}
          </h2>
          {artist && (
            <p className="text-sm font-medium text-slate-400 print:text-slate-600">
              {artist}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setIsEditingLyrics(!isEditingLyrics)}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            {isEditingLyrics ? "Cerrar Editor" : "✏️ Pegar / Editar Letra"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="text-xs font-bold px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-lg shadow-amber-950/40 flex items-center gap-1.5"
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {/* Editor rápido de letra si el archivo MP3 no tenía letra asociada */}
      {isEditingLyrics && (
        <div className="my-6 p-4 rounded-xl bg-slate-950 border border-slate-800 print:hidden animate-fade-in">
          <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
            Pega aquí la letra de la canción (un verso por línea):
          </label>
          <textarea
            rows={6}
            value={customLyrics}
            onChange={(e) => setCustomLyrics(e.target.value)}
            placeholder={`EN EL NEGRO AZABACHE, DE TU BLONDA, CABELLERA\nY EN EL ROJO ESCARLATA, DE TU BOCA, TAN DIVINA...`}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-slate-500">
              Los acordes detectados se posicionarán automáticamente sobre cada verso.
            </span>
            <button
              type="button"
              onClick={() => setIsEditingLyrics(false)}
              className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded"
            >
              Aplicar al Cancionero
            </button>
          </div>
        </div>
      )}

      {/* Vista de Acordes sobre Letra (Estilo LaCuerda / Ultimate Guitar) */}
      <div className="my-6 font-mono overflow-x-auto">
        {activeLines.length > 0 ? (
          <div className="space-y-4 text-sm leading-relaxed">
            {activeLines.map((item, idx) => (
              <div key={idx} className="group">
                {/* Línea de Acordes (en Ámbar/Naranja resaltado) */}
                {item.chordLine && (
                  <pre className="text-amber-400 font-bold tracking-wider text-sm select-all whitespace-pre print:text-amber-600">
                    {item.chordLine}
                  </pre>
                )}
                {/* Línea de Letra (en Blanco o Negro de Impresión) */}
                {item.lyricLine && (
                  <pre className="text-slate-100 font-medium tracking-wide text-sm select-all whitespace-pre print:text-black">
                    {item.lyricLine}
                  </pre>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Si no hay letra aún, mostrar los compases musicales estructurados */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center print:hidden">
              <p className="text-xs text-slate-400 mb-2">
                No se encontraron letras automáticas para este audio. Puedes pulsar{" "}
                <button
                  type="button"
                  onClick={() => setIsEditingLyrics(true)}
                  className="text-amber-400 underline font-semibold"
                >
                  Pegar / Editar Letra
                </button>{" "}
                para montarlas encima de los versos, o leer la partitura de compases:
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 print:bg-white print:border-none">
              <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-4 print:text-black">
                Estructura de Compases y Progresión:
              </h4>
              <div className="space-y-2 text-sm">
                {structuredProgression.map((barLine, bIdx) => (
                  <pre
                    key={bIdx}
                    className="text-amber-400 font-bold tracking-widest py-1 px-2 rounded bg-slate-900/60 border border-slate-800/40 print:text-black print:bg-transparent print:border-none"
                  >
                    {barLine}
                  </pre>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pie de cancionero */}
      <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 print:text-slate-600">
        <span>O.IR &bull; Reconocimiento Armónico Inteligente</span>
        <span>Apto para afinación estándar y cejilla</span>
      </div>
    </div>
  );
}
