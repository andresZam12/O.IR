/** @type {import('tailwindcss').Config} */
module.exports = {
  // Archivos donde Tailwind buscará las clases para incluirlas en el build
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // --- Paleta de colores de O.IR ---
      colors: {
        // Color primario: violeta musical
        primary: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        // Color de acento: cyan/verde para acordes resaltados
        accent: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        // Fondo oscuro para el modo dark
        surface: {
          900: "#0f0f13",
          800: "#1a1a24",
          700: "#242433",
          600: "#2e2e42",
        },
      },
      // --- Tipografía ---
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
