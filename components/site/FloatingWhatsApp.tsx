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
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M17.472 14.382C17.7017 14.3132 17.8938 14.1897 18.0073 14.023C18.1208 13.8562 18.1466 13.6642 18.0816 13.4876L17.5128 11.7593C17.388 11.3765 17.1711 11.011 16.8775 10.6814C16.5838 10.3518 16.2183 10.0624 15.8011 9.83274L14.6313 9.14916C13.6544 8.60576 12.5444 8.25645 11.4163 8.1317L10.8552 8.08057C10.0233 8.0086 9.20002 7.97503 8.38534 8.08271C7.18992 8.24108 6.04195 8.77586 5.06505 9.75276C4.08815 10.7297 3.55337 12.0905 3.52758 13.4961C3.50179 14.9016 3.91901 16.2705 4.75093 17.4558C6.72783 20.1855 10.439 22.1624 13.7347 21.9933C15.0515 21.9272 16.3281 21.5976 17.472 21.0716C18.616 20.5457 19.637 19.8057 20.2157 18.7305C20.8378 17.5804 20.9625 16.0884 20.5797 14.7716C20.427 14.2246 20.1852 13.7277 19.872 13.3286L18.1438 10.5298C18.0787 10.3531 17.9552 10.1948 17.7884 10.0971C17.6217 10.0005 17.4296 9.9747 17.2375 10.0398L14.4387 10.5592C13.5296 10.7213 12.636 10.8333 11.7578 10.8844C9.5998 10.9988 7.47982 10.6409 5.54759 9.78241L4.23225 9.25199C3.25534 8.86915 2.39686 8.05008 1.82806 6.90596C1.25926 5.76185 1.35695 4.55355 2.00871 3.52093C2.66046 2.48831 3.80843 1.6977 5.1252 1.67192C6.44198 1.64613 7.74772 2.27621 8.72463 3.25312C10.0567 4.57849 10.8757 6.06195 11.0341 7.4752L11.178 8.09239C11.2291 8.26906 11.2549 8.46113 11.2484 8.6532C11.2419 8.84527 11.1908 9.02194 11.1043 9.1692L10.4415 10.7829C9.90673 12.1623 9.8556 13.6099 10.2851 14.9713C10.3109 15.106 10.3367 15.2295 10.3432 15.353L10.387 16.3484C10.3935 16.472 10.4701 16.5855 10.5936 16.6199L12.5069 17.1986C14.1828 17.6942 15.8209 17.5358 17.1734 16.8522C18.5258 16.1687 19.3706 14.892 19.5289 13.354C19.5801 12.9549 19.5543 12.5711 19.4408 12.2082L19.1703 11.3535C19.1053 11.1768 18.9818 11.0185 18.815 10.9218C18.6482 10.8252 18.4561 10.7994 18.264 10.8644L17.472 11.1349L17.472 14.382Z"
          fill="white"
        />
      </svg>
    </a>
  );
}