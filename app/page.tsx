import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/painel");
  }

  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{ background: "linear-gradient(160deg, #1D5C3A 0%, #0D3320 60%, #0A2418 100%)" }}
    >
      <header className="flex items-center justify-between px-8 py-6">
        <span className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          TopConsultores
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="btn btn-outline !border-white/40 !text-white hover:!bg-white/10">
            Entrar
          </Link>
          <Link href="/cadastro" className="btn btn-gold">
            Começar agora
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <span className="text-xs uppercase tracking-[0.25em] text-emerald-300/80 mb-6">Plataforma para consultoras doTERRA</span>
        <h1 className="max-w-3xl text-5xl md:text-6xl font-light leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          Seu site profissional, <em className="text-emerald-300">seu domínio</em>, no ar em minutos.
        </h1>
        <p className="mt-6 max-w-xl text-white/60 leading-relaxed">
          Site com IA especialista, agendamento, CRM, depoimentos, vitrine de produtos e domínio próprio.
          Crie sua conta, escolha seu plano e publique hoje mesmo.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/cadastro" className="btn btn-gold !px-8 !py-3">
            Quero um site assim
          </Link>
          <Link href="/login" className="btn !border !border-white/30 !text-white !px-8 !py-3 hover:!bg-white/10">
            Já tenho conta
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full text-sm">
          {[
            { n: "97", l: "por mês" },
            { n: "+ IA", l: "chat especialista" },
            { n: "∞", l: "seu próprio domínio" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-white/10 bg-white/5 px-6 py-5">
              <div className="text-3xl font-light" style={{ fontFamily: "var(--font-display)" }}>
                {s.n}
              </div>
              <div className="mt-1 text-white/50 uppercase tracking-wider text-xs">{s.l}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-8 py-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} TopConsultores · Consultoras independentes doTERRA
      </footer>
    </div>
  );
}
