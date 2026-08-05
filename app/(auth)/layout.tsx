import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg, #1D5C3A 0%, #0D3320 60%, #0A2418 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
            TopConsultores
          </Link>
          <p className="mt-2 text-sm text-emerald-200/70">Sites profissionais para consultoras doTERRA</p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-2xl">{children}</div>
      </div>
    </div>
  );
}
