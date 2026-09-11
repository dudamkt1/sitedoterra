import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, DM_Sans, Manrope } from "next/font/google";
import { PwaPromptCapture } from "@/components/site/PwaPromptCapture";
import "@/app/globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});

// Sans moderna dos painéis (/admin e /painel): títulos sem serifa.
// O site público continua com Cormorant (serifa editorial).
const sansDisplay = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-sans-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TopConsultores | Sites profissionais para consultoras doTERRA",
    template: "%s | TopConsultores",
  },
  description:
    "Plataforma para consultoras doTERRA terem seu site profissional com IA, agendamento, CRM e domínio próprio.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${body.variable} ${sansDisplay.variable}`}>
        <PwaPromptCapture />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
