import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg, #1D5C3A 0%, #0D3320 60%, #0A2418 100%)" }}
    >
      <div className="max-w-md w-full text-center text-white">
        <div className="text-6xl font-light mb-4" style={{ fontFamily: "var(--font-display)" }}>
          404
        </div>
        <h1 className="text-2xl font-light mb-3" style={{ fontFamily: "var(--font-display)" }}>
          Página não encontrada
        </h1>
        <p className="text-white/60 mb-8">O endereço que você procura não existe ou foi movido.</p>
        <Link href="/" className="btn btn-gold">Ir para o início</Link>
      </div>
    </div>
  );
}
