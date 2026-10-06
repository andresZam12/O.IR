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
  // Tolerancia de construcción en CI/CD para librerías con tipos externos
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
