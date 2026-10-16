import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { ProcessedSongResult } from "@/types/song";

// Estilos del documento PDF
const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 42,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1e293b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#6366f1",
    paddingBottom: 10,
    marginBottom: 16,
  },
  logo: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#6366f1",
  },
  tagline: {
    fontSize: 8,
    color: "#64748b",
  },
  titleSection: {
    marginBottom: 14,
  },
  songTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 3,
  },
  artistName: {
    fontSize: 12,
    color: "#475569",
  },
  metaGrid: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 8,
    marginBottom: 14,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
  },
  chordsBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    padding: 8,
    marginBottom: 14,
  },
  chordsTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#1d4ed8",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  chordsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chordBadge: {
    backgroundColor: "#dbeafe",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
  },
  difficultySection: {
    backgroundColor: "#fdf4ff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#f5d0fe",
    padding: 8,
    marginBottom: 16,
  },
  difficultyTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#a21caf",
    marginBottom: 3,
    textTransform: "uppercase",
  },
  difficultyText: {
    fontSize: 8,
    color: "#4a044e",
    lineHeight: 1.3,
  },
  songSheetTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 4,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  lyricsContainer: {
    marginTop: 4,
  },
  lyricRow: {
    marginBottom: 8,
  },
  chordAbove: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#4f46e5",
    marginBottom: 1,
  },
  lyricText: {
    fontSize: 10,
    color: "#1e293b",
    lineHeight: 1.3,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
    fontSize: 8,
    color: "#94a3b8",
  },
});

interface SongPdfDocumentProps {
  data: ProcessedSongResult;
}

export default function SongPdfDocument({ data }: SongPdfDocumentProps) {
  const title = data.lyrics?.title || "Canción";
  const artist = data.lyrics?.artist || "Artista Desconocido";
  const key = data.estimated_key || "No especificada";
  const level = data.difficulty?.metrics.level || "Principiante";
  const score = data.difficulty?.metrics.score || 3.0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.header}>
          <Text style={styles.logo}>O.IR</Text>
          <Text style={styles.tagline}>
            Cancionero Imprimible con Acordes y Letra
          </Text>
        </View>

        {/* Título de la obra */}
        <View style={styles.titleSection}>
          <Text style={styles.songTitle}>{title}</Text>
          <Text style={styles.artistName}>{artist}</Text>
        </View>

        {/* Metadatos (Tonalidad, Dificultad, Duración) */}
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Tonalidad</Text>
            <Text style={styles.metaValue}>{key}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Dificultad</Text>
            <Text style={styles.metaValue}>
              {level} ({score}/10)
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Duración</Text>
            <Text style={styles.metaValue}>
              {Math.floor(data.duration / 60)}:
              {Math.floor(data.duration % 60)
                .toString()
                .padStart(2, "0")}{" "}
              min
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Acordes Usados</Text>
            <Text style={styles.metaValue}>{data.unique_chords.length}</Text>
          </View>
        </View>

        {/* Acordes Únicos */}
        {data.unique_chords.length > 0 && (
          <View style={styles.chordsBox}>
            <Text style={styles.chordsTitle}>Acordes necesarios:</Text>
            <View style={styles.chordsList}>
              {data.unique_chords.map((chord, idx) => (
                <Text key={idx} style={styles.chordBadge}>
                  {chord}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Resumen pedagógico */}
        {data.difficulty && (
          <View style={styles.difficultySection}>
            <Text style={styles.difficultyTitle}>Guía de Práctica:</Text>
            <Text style={styles.difficultyText}>
              {data.difficulty.explanation}
            </Text>
          </View>
        )}

        {/* Cancionero: Letras con Acordes Arriba (Formato Cancionero Profesional) */}
        <Text style={styles.songSheetTitle}>Cancionero: Acordes sobre Letra</Text>

        <View style={styles.lyricsContainer}>
          {data.lyrics?.lines && data.lyrics.lines.length > 0 ? (
            data.lyrics.lines.map((line, idx) => {
              const text = line.text.trim();
              if (!text) return null;

              // Distribuir acordes en Courier monoespaciado
              const lineStart = line.time;
              const nextStart = data.lyrics?.lines[idx + 1]?.time || lineStart + 6;
              const duration = Math.max(nextStart - lineStart, 2);

              const lineChords = data.chords.filter(
                (c) => c.time >= lineStart - 0.5 && c.time < nextStart
              );

              let chordLineChars = new Array(Math.max(text.length, 30)).fill(" ");
              if (lineChords.length === 0) {
                if (line.chord) {
                  for (let i = 0; i < line.chord.length; i++) {
                    chordLineChars[Math.min(6, text.length) + i] = line.chord[i];
                  }
                }
              } else {
                lineChords.forEach((c) => {
                  const ratio = Math.max(0, Math.min(0.85, (c.time - lineStart) / duration));
                  const insertPos = Math.floor(ratio * text.length);
                  for (let i = 0; i < c.chord.length; i++) {
                    if (insertPos + i < chordLineChars.length) {
                      chordLineChars[insertPos + i] = c.chord[i];
                    }
                  }
                });
              }

              const chordLineStr = chordLineChars.join("").trimEnd();

              return (
                <View key={idx} style={{ marginBottom: 6 }}>
                  {chordLineStr ? (
                    <Text
                      style={{
                        fontFamily: "Courier-Bold",
                        fontSize: 9,
                        color: "#d97706",
                        marginBottom: 1,
                      }}
                    >
                      {chordLineStr}
                    </Text>
                  ) : null}
                  <Text
                    style={{
                      fontFamily: "Courier",
                      fontSize: 9,
                      color: "#1e293b",
                    }}
                  >
                    {text}
                  </Text>
                </View>
              );
            })
          ) : (
            // Si no hay letra, estructurar en compases de 4 acordes
            <View style={{ marginTop: 4 }}>
              <Text
                style={{
                  fontSize: 8,
                  fontFamily: "Helvetica-Bold",
                  color: "#64748b",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Progresión armónica por compases (4 tiempos):
              </Text>
              {Array.from({ length: Math.ceil(data.chords.length / 4) }).map((_, bIdx) => {
                const barChords = data.chords.slice(bIdx * 4, bIdx * 4 + 4);
                const barText = barChords
                  .map((c) => c.chord.padEnd(8, " "))
                  .join(" | ");

                return (
                  <Text
                    key={bIdx}
                    style={{
                      fontFamily: "Courier-Bold",
                      fontSize: 9,
                      color: "#b45309",
                      marginBottom: 4,
                    }}
                  >
                    {`|  ${barText} |`}
                  </Text>
                );
              })}
            </View>
          )}
        </View>

        {/* Pie de página */}
        <View style={styles.footer} fixed>
          <Text>Generado automáticamente por O.IR Platform</Text>
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
