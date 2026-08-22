import type { Metadata } from "next";
import "./globals.css";
import "./brand-v2.css";
import "./doc-monitor.css";
import "./guardiao.css";

export const metadata: Metadata = {
  title: "DOCTYPE OS — Gestão Interna",
  description: "Sistema operacional interno da DOCTYPE",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
