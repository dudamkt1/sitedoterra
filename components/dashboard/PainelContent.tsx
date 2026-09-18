"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { SiteActivationRequired } from "@/components/dashboard/SiteActivationRequired";

interface PainelContentProps {
  children: ReactNode;
  isDemo: boolean;
  isSuperAdmin: boolean;
  siteActivated: boolean;
}

export function PainelContent({
  children,
  isDemo,
  isSuperAdmin,
  siteActivated,
}: PainelContentProps) {
  const pathname = usePathname();
  const isAfiliados = pathname?.startsWith("/painel/afiliados");
  const showActivationRequired = !siteActivated && !isSuperAdmin && !isDemo && !isAfiliados;

  if (showActivationRequired) {
    return <SiteActivationRequired />;
  }

  return <>{children}</>;
}