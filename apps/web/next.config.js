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
};

module.exports = nextConfig;
