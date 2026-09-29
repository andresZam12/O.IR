/**
 * app/page.tsx — Página principal (Home) de O.IR
 *
 * Esta es la primera pantalla que ve el usuario.
 * Por ahora es un placeholder con el diseño base.
 * Se irá completando en las siguientes semanas con el formulario de entrada.
 */

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* --- Hero section --- */}
      <div className="text-center max-w-3xl mx-auto">
        {/* Logo / nombre de la app */}
        <h1 className="text-6xl font-bold tracking-tight mb-4">
          <span className="text-white">O</span>
          <span className="text-primary-400">.</span>
          <span className="text-white">IR</span>
        </h1>

        {/* Tagline */}
        <p className="text-xl text-slate-400 mb-8 leading-relaxed">
          Pega el link de una canción y descubre{" "}
          <span className="text-primary-400 font-medium">los acordes y la letra</span>{" "}
          sincronizados en tiempo real.
        </p>

        {/* Llamada a la acción — placeholder hasta Semana 4 */}
        <div className="card max-w-xl mx-auto">
          <p className="text-slate-500 text-sm text-center">
            🚧 Formulario de entrada en construcción — Semana 4
          </p>
        </div>

        {/* Descripción de características */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
          <FeatureCard
            emoji="🎸"
            title="Detección de acordes"
            description="Acordes con marcas de tiempo y nivel de confianza"
          />
          <FeatureCard
            emoji="🎤"
            title="Letra sincronizada"
            description="Vista karaoke con el acorde encima de cada línea"
          />
          <FeatureCard
            emoji="📄"
            title="Exportar a PDF"
            description="Cancionero imprimible con letra y acordes"
          />
        </div>
      </div>
    </main>
  );
}

/* --- Componente auxiliar para las tarjetas de características --- */
interface FeatureCardProps {
  emoji: string;
  title: string;
  description: string;
}

function FeatureCard({ emoji, title, description }: FeatureCardProps) {
  return (
    <div className="card text-left hover:border-primary-700 transition-colors duration-200">
      <span className="text-2xl mb-3 block">{emoji}</span>
      <h2 className="font-semibold text-white mb-1">{title}</h2>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}
