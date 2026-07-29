import { useEffect, useMemo, useState } from "react";

export type WhiteLabelBranding = {
  found: boolean;
  source: "default" | "domain" | "company" | "preview" | string;
  partnerId: number | null;
  brandName: string;
  logoUrl: string;
  logoFullUrl: string;
  logoMarkUrl: string;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string | null;
  hideSdtBrand: boolean;
  allowPartnerBranding: boolean;
};

export const DEFAULT_BRANDING: WhiteLabelBranding = {
  found: false,
  source: "default",
  partnerId: null,
  brandName: "Saúde do Trabalho",
  logoUrl: "/plataforma/logo-horizontal.webp",
  logoFullUrl: "/plataforma/logo-full.png",
  logoMarkUrl: "/plataforma/logo-mark.png",
  primaryColor: "#0E2C46",
  secondaryColor: "#43C285",
  customDomain: null,
  hideSdtBrand: false,
  allowPartnerBranding: false,
};

function getPreviewPartnerId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("wlPreview") || params.get("whiteLabelPreview");
  if (fromQuery) {
    window.localStorage.setItem("whiteLabelPreviewPartnerId", fromQuery);
    return fromQuery;
  }
  return window.localStorage.getItem("whiteLabelPreviewPartnerId") || "";
}

export function clearWhiteLabelPreview() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("whiteLabelPreviewPartnerId");
}

export function useWhiteLabelBranding(companyId?: number | null) {
  const [branding, setBranding] = useState<WhiteLabelBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const companyKey = companyId ? String(companyId) : "";

  const query = useMemo(() => {
    const params = new URLSearchParams();
    const previewPartnerId = getPreviewPartnerId();
    if (previewPartnerId) params.set("previewPartnerId", previewPartnerId);
    else if (companyKey) params.set("companyId", companyKey);
    const qs = params.toString();
    return `/api/white-label/branding${qs ? `?${qs}` : ""}`;
  }, [companyKey]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(query, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setBranding({ ...DEFAULT_BRANDING, ...(data || {}) });
      })
      .catch(() => {
        if (alive) setBranding(DEFAULT_BRANDING);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [query]);

  return { branding, loading };
}

export function applyBrandVars(branding: WhiteLabelBranding) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--wl-primary", branding.primaryColor || DEFAULT_BRANDING.primaryColor);
  document.documentElement.style.setProperty("--wl-secondary", branding.secondaryColor || DEFAULT_BRANDING.secondaryColor);
}
