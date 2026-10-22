import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { ProcessedSongResult, ChordItem } from "@/types/song";

// Estilos de alta calidad para cancionero profesional
const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#0f172a",
    position: "relative",
  },
  // Marca de agua de O.IR que abarca la mayoría de la página
  watermarkWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: -1,
  },
  watermarkText: {
    fontSize: 140,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    opacity: 0.045,
    transform: "rotate(-35deg)",
    letterSpacing: 10,
    textTransform: "lowercase",
  },
  // Encabezado principal: únicamente Título, Artista y Tonalidad
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 20,
  },
  titleGroup: {
    flex: 1,
  },
  songTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  artistName: {
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#475569",
    marginTop: 2,
  },
  keyBadge: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
  },
  keyText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textTransform: "uppercase",
  },
  // Contenedor de la letra y los acordes
  songSheet: {
    marginTop: 4,
  },
  lineBlock: {
    marginBottom: 8,
  },
  chordLine: {
    fontFamily: "Courier-Bold",
    fontSize: 9.5,
    color: "#b45309", // Tono ámbar/dorado clásico de cancionero profesional
    marginBottom: 1,
    letterSpacing: 0.2,
  },
  lyricLine: {
    fontFamily: "Courier",
    fontSize: 9.5,
    color: "#0f172a",
    letterSpacing: 0.2,
  },
  // Pie de página sutil
  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    paddingTop: 6,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#94a3b8",
  },
});

interface SongPdfDocumentProps {
  data: ProcessedSongResult;
}

interface FormattedPdfLine {
  chordLine: string;
  lyricLine: string;
}

export default function SongPdfDocument({ data }: SongPdfDocumentProps) {
  const title = (data.lyrics?.title || "Canción").trim();
  const artist = (data.lyrics?.artist || "Desconocido").trim();
  const estimatedKey = data.estimated_key || "Estándar";
  const chords = data.chords || [];
  const lines = data.lyrics?.lines || [];

  // Formatear líneas de cancionero (acordes alineados arriba de la letra)
  const formattedLines: FormattedPdfLine[] = React.useMemo(() => {
    const formatted: FormattedPdfLine[] = [];

    // CASO A: Tenemos letra sincronizada
    if (lines.length > 0) {
      const firstLineTime = lines[0].time;

      // 1. Detectar acordes de intro antes del primer verso cantado
      if (firstLineTime > 4.0) {
        const introChords = chords.filter((c) => c.time < firstLineTime - 0.5);
        if (introChords.length > 0) {
          const distinctIntro: string[] = [];
          introChords.forEach((c) => {
            if (
              distinctIntro.length === 0 ||
              distinctIntro[distinctIntro.length - 1] !== c.chord
            ) {
              distinctIntro.push(c.chord);
            }
          });

          const displayIntro = distinctIntro.slice(0, 4);
          const chordText = displayIntro.map((c) => c.padEnd(16, " ")).join("");
          formatted.push({
            chordLine: `   ${chordText.trimEnd()}`,
            lyricLine: `[INTRO INSTRUMENTAL]   ${displayIntro.join("  -  ")}`,
          });
        }
      }

      // 2. Mapear cada verso de la letra con sus acordes respectivos
      lines.forEach((line, idx) => {
        const lineStart = line.time;
        const nextLineStart = lines[idx + 1]?.time || lineStart + 6;
        const lineDuration = Math.max(nextLineStart - lineStart, 2);

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

        // Desduplicar acordes consecutivos para simplificar la partitura
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
          simplifiedChords = [
            simplifiedChords[0],
            simplifiedChords[simplifiedChords.length - 1],
          ];
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

          const ratio = Math.max(
            0.4,
            Math.min(0.75, (simplifiedChords[1].time - lineStart) / lineDuration)
          );
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
        });
      });

      return formatted;
    }

    // CASO B: Sin letra -> estructurar en compases armónicos
    const distinctGlobalChords: ChordItem[] = [];
    chords.forEach((c) => {
      if (
        distinctGlobalChords.length === 0 ||
        distinctGlobalChords[distinctGlobalChords.length - 1].chord !== c.chord
      ) {
        distinctGlobalChords.push(c);
      }
    });

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

    for (let i = 0; i < distinctGlobalChords.length; i += step) {
      const chunk = distinctGlobalChords.slice(i, i + step);
      const currentSec = sectionNames[secIdx % sectionNames.length];
      if (i > 0 && i % (step * 2) === 0) secIdx++;

      const chordText = chunk.map((c) => c.chord.padEnd(20, " ")).join("");
      const phraseText =
        `[${currentSec}]   ` + chunk.map((c) => c.chord).join("  -  ");

      formatted.push({
        chordLine: `    ${chordText}`,
        lyricLine: phraseText,
      });
    }

    return formatted;
  }, [lines, chords]);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Marca de agua grande fija de O.IR que abarca la mayoría de cada página */}
        <View style={styles.watermarkWrapper} fixed>
          <Text style={styles.watermarkText}>o.ir</Text>
          <Text style={styles.watermarkText}>o.ir</Text>
        </View>

        {/* Encabezado: Título, Artista y Tonalidad únicamente */}
        <View style={styles.header}>
          <View style={styles.titleGroup}>
            <Text style={styles.songTitle}>{title}</Text>
            {artist && <Text style={styles.artistName}>{artist}</Text>}
          </View>
          <View style={styles.keyBadge}>
            <Text style={styles.keyText}>Tonalidad: {estimatedKey}</Text>
          </View>
        </View>

        {/* Letra de la canción con sus acordes exactos alineados arriba */}
        <View style={styles.songSheet}>
          {formattedLines.map((line, idx) => (
            <View key={idx} style={styles.lineBlock} wrap={false}>
              {line.chordLine ? (
                <Text style={styles.chordLine}>{line.chordLine}</Text>
              ) : null}
              <Text style={styles.lyricLine}>{line.lyricLine}</Text>
            </View>
          ))}
        </View>

        {/* Pie de página discreto */}
        <View style={styles.footer} fixed>
          <Text>O.IR &bull; Cancionero Musical</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
