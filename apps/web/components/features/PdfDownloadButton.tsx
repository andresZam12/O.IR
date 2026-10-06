"use client";

import React, { useState, useEffect } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import SongPdfDocument from "./SongPdfDocument";
import { ProcessedSongResult } from "@/types/song";

interface PdfDownloadButtonProps {
  data: ProcessedSongResult;
}

export default function PdfDownloadButton({ data }: PdfDownloadButtonProps) {
  const [isClient, setIsClient] = useState(false);

  // Asegurar que el componente solo renderice en el cliente para evitar errores de SSR
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <button
        disabled
        className="opacity-60 bg-slate-800 text-slate-400 text-xs font-semibold py-2 px-4 rounded-lg cursor-not-allowed"
      >
        📄 Preparando PDF...
      </button>
    );
  }

  const songTitle = (data.lyrics?.title || "cancionero")
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, "_");

  return (
    <PDFDownloadLink
      document={<SongPdfDocument data={data} />}
      fileName={`OIR_${songTitle}.pdf`}
      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-md shadow-indigo-950"
    >
      {({ loading }) => (
        <>
          <span>📄</span>
          <span>{loading ? "Generando documento..." : "Exportar Cancionero PDF"}</span>
        </>
      )}
    </PDFDownloadLink>
  );
}
