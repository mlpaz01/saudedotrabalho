#!/usr/bin/env python3
"""
Patch script: Wire 4 new pages into App.tsx and AppLayout.tsx routing/navigation,
and fix certificate neutral text across multiple files.
"""

import re

BASE = "/var/www/saudedotrabalho"

# ─────────────────────────────────────────────
# PATCH 1: App.tsx – imports
# ─────────────────────────────────────────────
app_tsx_path = f"{BASE}/client/src/App.tsx"
with open(app_tsx_path, "r", encoding="utf-8") as f:
    app_tsx = f.read()

# Check if already patched
if "AdminGHEGSE" in app_tsx:
    print("App.tsx: already patched, skipping.")
else:
    # Add 4 new imports BEFORE AdminAcoesVinculadas import
    old_import = 'import AdminAcoesVinculadas from "@/pages/admin/AdminAcoesVinculadas";'
    new_imports = (
        'import AdminGHEGSE from "@/pages/admin/AdminGHEGSE";\n'
        'import AdminEPCEPI from "@/pages/admin/AdminEPCEPI";\n'
        'import AdminPGRRevision from "@/pages/admin/AdminPGRRevision";\n'
        'import AdminSSTDashboard from "@/pages/admin/AdminSSTDashboard";\n'
        + old_import
    )
    if old_import not in app_tsx:
        print(f"ERROR: Could not find import anchor in App.tsx:\n  {old_import}")
    else:
        app_tsx = app_tsx.replace(old_import, new_imports, 1)
        print("App.tsx: imports patched.")

    # Add 4 new routes BEFORE AdminAcoesVinculadas route
    old_route = '<Route path="/admin/acoes-vinculadas" component={() => <ProtectedRoute component={AdminAcoesVinculadas} adminOnly />} />'
    new_routes = (
        '<Route path="/admin/ghe-gse" component={() => <ProtectedRoute component={AdminGHEGSE} adminOnly />} />\n'
        '      <Route path="/admin/epc-epi" component={() => <ProtectedRoute component={AdminEPCEPI} adminOnly />} />\n'
        '      <Route path="/admin/pgr-revisoes" component={() => <ProtectedRoute component={AdminPGRRevision} adminOnly />} />\n'
        '      <Route path="/admin/sst-dashboard" component={() => <ProtectedRoute component={AdminSSTDashboard} adminOnly />} />\n'
        '      ' + old_route
    )
    if old_route not in app_tsx:
        print(f"ERROR: Could not find route anchor in App.tsx:\n  {old_route}")
    else:
        app_tsx = app_tsx.replace(old_route, new_routes, 1)
        print("App.tsx: routes patched.")

    with open(app_tsx_path, "w", encoding="utf-8") as f:
        f.write(app_tsx)
    print("App.tsx: written successfully.")

# ─────────────────────────────────────────────
# PATCH 2: AppLayout.tsx – lucide imports + nav items
# ─────────────────────────────────────────────
layout_path = f"{BASE}/client/src/components/AppLayout.tsx"
with open(layout_path, "r", encoding="utf-8") as f:
    layout = f.read()

if "AdminGHEGSE" in layout or "GHE / GSE" in layout:
    print("AppLayout.tsx: nav items already patched, skipping nav.")
else:
    # Fix lucide-react import: add Layers, RotateCcw, Activity
    # Current last import line ends with:  Link2} from "lucide-react";
    old_lucide_end = "  Link2} from \"lucide-react\";"
    new_lucide_end = "  Link2, Layers, RotateCcw, Activity} from \"lucide-react\";"

    if old_lucide_end not in layout:
        print(f"ERROR: Could not find lucide import anchor in AppLayout.tsx:\n  {old_lucide_end}")
    else:
        layout = layout.replace(old_lucide_end, new_lucide_end, 1)
        print("AppLayout.tsx: lucide imports patched.")

    # Add 4 nav items AFTER the "Ações Vinculadas" nav item
    old_nav = '{ label: "Ações Vinculadas", href: "/admin/acoes-vinculadas", notRoles: ["chefia"], icon: <Link2 size={18} />, feature: "risk_assessment" },'
    new_nav = (
        old_nav + '\n'
        '      { label: "GHE / GSE", href: "/admin/ghe-gse", notRoles: ["chefia"], icon: <Layers size={18} />, feature: "risk_assessment" },\n'
        '      { label: "EPC / EPI", href: "/admin/epc-epi", notRoles: ["chefia"], icon: <Shield size={18} />, feature: "risk_assessment" },\n'
        '      { label: "Revisões PGR", href: "/admin/pgr-revisoes", notRoles: ["chefia"], icon: <RotateCcw size={18} />, feature: "risk_assessment" },\n'
        '      { label: "Dashboard SST", href: "/admin/sst-dashboard", notRoles: ["chefia"], icon: <Activity size={18} />, feature: "risk_assessment" },'
    )
    if old_nav not in layout:
        print(f"ERROR: Could not find nav anchor in AppLayout.tsx:\n  {old_nav}")
    else:
        layout = layout.replace(old_nav, new_nav, 1)
        print("AppLayout.tsx: nav items patched.")

    with open(layout_path, "w", encoding="utf-8") as f:
        f.write(layout)
    print("AppLayout.tsx: written successfully.")

# ─────────────────────────────────────────────
# PATCH 3: Certificate neutral text – multiple files
# ─────────────────────────────────────────────
NEUTRAL_TEXT = "Este certificado atesta a participação e aprovação no curso indicado, demonstrando o comprometimento com o desenvolvimento profissional e com a saúde, segurança e qualidade de vida no trabalho."

cert_files_patches = [
    (
        f"{BASE}/client/src/pages/admin/AdminModules.tsx",
        [
            (
                '"Certificamos que o(a) participante concluiu com êxito o curso de treinamento em saúde mental e bem-estar corporativo."',
                f'"{NEUTRAL_TEXT}"'
            ),
        ]
    ),
    (
        f"{BASE}/client/src/pages/admin/AdminCertificates.tsx",
        [
            (
                '`Certificamos que o(a) participante concluiu com êxito o curso de treinamento em saúde mental e bem-estar corporativo.`',
                f'`{NEUTRAL_TEXT}`'
            ),
            (
                '"concluiu com êxito o curso de treinamento em saúde mental e bem-estar corporativo."',
                f'"{NEUTRAL_TEXT}"'
            ),
        ]
    ),
    (
        f"{BASE}/client/src/pages/Certificates.tsx",
        [
            (
                '"concluiu com êxito o curso de treinamento em saúde mental e bem-estar corporativo."',
                f'"{NEUTRAL_TEXT}"'
            ),
        ]
    ),
    (
        f"{BASE}/client/src/pages/ModulePlayer.tsx",
        [
            (
                '"Certificamos que o(a) participante concluiu com êxito este curso de treinamento."',
                f'"{NEUTRAL_TEXT}"'
            ),
        ]
    ),
]

for filepath, replacements in cert_files_patches:
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        changed = False
        for old, new in replacements:
            if old in content:
                content = content.replace(old, new)
                changed = True
                print(f"{filepath}: patched cert text.")
            else:
                print(f"{filepath}: anchor not found (may already be patched): {old[:60]}...")
        if changed:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"{filepath}: written.")
    except Exception as e:
        print(f"ERROR patching {filepath}: {e}")

print("\n=== All patches complete ===")
