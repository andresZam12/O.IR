/**
 * app/layout.tsx — Layout raíz de la aplicación
 *
 * Este componente envuelve TODAS las páginas de la app.
 * Aquí se define el HTML base, los metadatos SEO globales y los estilos.
 */

import type { Metadata } from "next";
import "./globals.css";

// --- Metadatos SEO de la aplicación ---
export const metadata: Metadata = {
  title: {
    default: "O.IR — Detecta acordes de cualquier canción",
    template: "%s | O.IR",
  },
  description:
    "Detecta los acordes y la letra de cualquier canción con IA. " +
    "Vista sincronizada tipo karaoke, puntaje de dificultad y exportación a PDF.",
  keywords: ["acordes", "guitarra", "karaoke", "detección de acordes", "música", "O.IR"],
  authors: [{ name: "Andrés Zamudio" }],
  openGraph: {
    title: "O.IR — Detecta acordes de cualquier canción",
    description: "Aprende a tocar cualquier canción con detección de acordes por IA",
    type: "website",
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout raíz: define el HTML base y el body con estilos de fondo.
 * El `children` es la página actual que Next.js inyecta automáticamente.
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-surface-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
