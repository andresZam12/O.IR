/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración de imágenes externas permitidas
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.youtube.com", // Miniaturas de YouTube
      },
    ],
  },
  // Mapeo de variables de entorno para el backend (soporta múltiples alias)
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXTT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.BACKEND_URL ||
      "",
  },
  // Tolerancia de construcción en CI/CD para librerías con tipos externos
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
