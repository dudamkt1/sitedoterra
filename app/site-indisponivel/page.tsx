export default function SiteIndisponivelPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg, #1D5C3A 0%, #0D3320 60%, #0A2418 100%)" }}
    >
      <div className="max-w-md w-full text-center text-white">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-3xl font-light mb-3" style={{ fontFamily: "var(--font-display)" }}>
          Domínio não conectado
        </h1>
        <p className="text-white/60 leading-relaxed">
          Este domínio ainda não está conectado a nenhum site nesta plataforma.
          Se você é o proprietário, conecte o domínio no seu painel de administração.
        </p>
        <p className="mt-8 text-xs text-white/40">TopConsultores · Plataforma multi-site</p>
      </div>
    </div>
  );
}
