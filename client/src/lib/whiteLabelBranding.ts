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

function getPreviewRequest() {
  if (typeof window === "undefined") return { partnerId: "", demoMode: false };
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("wlPreview") || params.get("whiteLabelPreview");
  const fromDemo = params.get("wlDemo") || params.get("whiteLabelDemo");
  const partnerId = fromQuery || fromDemo;
  if (partnerId) {
    window.localStorage.removeItem("whiteLabelPreviewPartnerId");
    window.sessionStorage.setItem("whiteLabelPreviewPartnerId", partnerId);
    window.sessionStorage.setItem("whiteLabelPreviewMode", fromDemo ? "demo" : "preview");
    return { partnerId, demoMode: Boolean(fromDemo) };
  }
  window.localStorage.removeItem("whiteLabelPreviewPartnerId");
  if (window.location.pathname.includes("/login")) {
    window.sessionStorage.removeItem("whiteLabelPreviewPartnerId");
    window.sessionStorage.removeItem("whiteLabelPreviewMode");
    return { partnerId: "", demoMode: false };
  }
  const storedPartnerId = window.sessionStorage.getItem("whiteLabelPreviewPartnerId") || "";
  const demoMode = window.sessionStorage.getItem("whiteLabelPreviewMode") === "demo";
  return { partnerId: storedPartnerId, demoMode };
}

export function clearWhiteLabelPreview() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("whiteLabelPreviewPartnerId");
  window.sessionStorage.removeItem("whiteLabelPreviewPartnerId");
  window.sessionStorage.removeItem("whiteLabelPreviewMode");
}

export function useWhiteLabelBranding(companyId?: number | null) {
  const [branding, setBranding] = useState<WhiteLabelBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const companyKey = companyId ? String(companyId) : "";

  const query = useMemo(() => {
    const params = new URLSearchParams();
    const preview = getPreviewRequest();
    if (preview.partnerId) params.set("previewPartnerId", preview.partnerId);
    else if (companyKey) params.set("companyId", companyKey);
    const qs = params.toString();
    return `/api/white-label/branding${qs ? `?${qs}` : ""}`;
  }, [companyKey]);

  useEffect(() => {
    let alive = true;
    const preview = getPreviewRequest();
    setLoading(true);
    fetch(query, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const next = { ...DEFAULT_BRANDING, ...(data || {}) };
        if (preview.demoMode && next.source === "preview") next.source = "domain";
        setBranding(next);
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
