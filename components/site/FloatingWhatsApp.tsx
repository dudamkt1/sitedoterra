"use client";

import { useEffect, useState } from "react";

interface FloatingWhatsAppProps {
  whatsapp: string | undefined;
  enabled: boolean;
}

/** Normaliza o número de WhatsApp para o formato internacional (55 + DDD + número) */
function normalizeWhatsApp(raw: string | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // Se já começa com 55, retorna como está
  if (digits.startsWith("55")) return digits;
  // Se tem 10 ou 11 dígitos (DDD + número), adiciona 55
  if (digits.length >= 10) return `55${digits}`;
  return digits;
}

export function FloatingWhatsApp({ whatsapp, enabled }: FloatingWhatsAppProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Verifica se deve exibir
    const normalized = normalizeWhatsApp(whatsapp);
    setIsVisible(enabled && normalized.length >= 12);
  }, [whatsapp, enabled]);

  if (!mounted || !isVisible) return null;

  const normalizedNumber = normalizeWhatsApp(whatsapp);
  const waUrl = `https://wa.me/${normalizedNumber}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-[100] w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#25D366]"
      aria-label="Conversar pelo WhatsApp"
      style={{
        background: "#25D366",
        boxShadow: "0 4px 20px rgba(37, 211, 102, 0.4)",
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          fill="#FFFFFF"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.004 2.003c-5.523 0-10 4.477-10 10 0 1.765.46 3.484 1.336 5.005L2.05 21.65l4.78-1.255a9.96 9.96 0 0 0 5.174 1.435h.004c5.523 0 10-4.477 10-10s-4.477-9.997-10-9.997Zm0 18.33a8.34 8.34 0 0 1-4.252-1.165l-.305-.18-3.155.828.842-3.077-.199-.316a8.33 8.33 0 0 1-1.275-4.42c0-4.601 3.744-8.343 8.344-8.343a8.3 8.3 0 0 1 5.902 2.443 8.3 8.3 0 0 1 2.443 5.9c0 4.602-3.743 8.33-8.345 8.33Zm4.575-6.247c-.25-.126-1.481-.731-1.711-.815-.23-.084-.398-.126-.566.126-.168.252-.65.815-.797.983-.147.168-.294.189-.544.063-.25-.126-1.056-.39-2.012-1.241-.744-.663-1.246-1.482-1.393-1.734-.147-.252-.016-.388.11-.513.113-.113.252-.294.378-.441.126-.147.168-.252.252-.42.084-.168.042-.315-.021-.441-.063-.126-.566-1.365-.776-1.869-.204-.49-.412-.423-.566-.431l-.483-.009a.93.93 0 0 0-.672.315c-.231.252-.882.861-.882 2.1 0 1.239.903 2.435 1.029 2.604.126.168 1.776 2.712 4.305 3.804.602.26 1.072.415 1.439.531.605.168 1.155.144 1.59.087.485-.063 1.481-.605 1.69-1.189.21-.584.21-1.084.147-1.189-.063-.105-.23-.168-.48-.294Z"
        />
      </svg>
    </a>
  );
}