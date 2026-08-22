import type { Metadata } from "next";
import "./globals.css";
import "./brand-v2.css";
import "./doc-monitor.css";
import "./guardiao.css";
import "./guardiao-inline.css";
import "./commercial-suite.css";
import "./realtime-monitor.css";
import "./ux-visual-audit.css";
import "./contrast-fix.css";
import "./doc-crm-security-ux.css";
import "./doc-monitor-principles-ux.css";
import "./settings-ux.css";
import "./dashboard-operation-hover-fix.css";
import "./hover-contrast-safety.css";

export const metadata: Metadata = {
  title: "DOCTYPE OS — Gestão Interna",
  description: "Sistema operacional interno da DOCTYPE",
  robots: { index: false, follow: false },
};

// Production checkpoint: keep the stable application tree deployable after rollback.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
