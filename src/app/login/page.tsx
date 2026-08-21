import { redirect } from "next/navigation";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import styles from "./login.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage() {
  if (await getSession()) redirect("/os");

  return (
    <main className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.orangeGlowTop} aria-hidden="true" />
      <div className={styles.blueGlow} aria-hidden="true" />
      <div className={styles.orangeGlowBottom} aria-hidden="true" />

      <section className={styles.brand} aria-label="DOC.OS Gestão Interna">
        <div className={styles.brandInner}>
          <div className={styles.appName} aria-label="DOC.OS"><span>DOC</span><b>.</b><span>OS</span></div>
          <div className={styles.appCaption}>GESTÃO INTERNA</div>

          <div className={styles.managementRow} aria-hidden="true">
            <span />
            <i />
            <span />
          </div>

          <div className={styles.values} aria-label="Processos, performance e resultados">
            <span>PROCESSOS</span><i />
            <span>PERFORMANCE</span><i />
            <span>RESULTADOS</span>
          </div>
        </div>

        <div className={styles.doctypeSignature} aria-label="DOCTYPE">
          <small>BY</small>
          <Image src="/assets/doctype-logo-official.png" alt="DOCTYPE" width={291} height={81} priority unoptimized />
        </div>
      </section>

      <section className={styles.loginArea}>
        <div className={styles.cardGlow} aria-hidden="true" />
        <div className={styles.card}>
          <div className={styles.cardHeading}>
            <h1>Acesse sua conta</h1>
            <p>Digite suas credenciais para continuar</p>
          </div>
          <LoginForm />
        </div>
      </section>

      <footer className={styles.footer}>
        <span><ShieldCheck size={16} /> Sistema seguro</span>
        <i />
        <span>DOC.OS</span>
        <i />
        <span>Todos os direitos reservados</span>
      </footer>
    </main>
  );
}
