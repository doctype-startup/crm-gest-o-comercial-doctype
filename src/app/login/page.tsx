import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import styles from "./login.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage() {
  if (await getSession()) redirect("/os");

  return (
    <main className={styles.page}>
      <section className={styles.brand} aria-label="DOCTYPE OS">
        <div className={styles.top}>
          <Image className={styles.logo} src="/assets/doctype-logo.svg" alt="DOCTYPE" width={176} height={56} priority />
          <span className={styles.systemTag}><i /> Sistema de gestão</span>
        </div>

        <div className={styles.copy}>
          <span className={styles.kicker}>Gestão financeira e operacional</span>
          <h1>Controle a operação.<br /><span>Antecipe decisões.</span></h1>
          <p>Uma visão central da saúde da empresa: financeiro, clientes, operação, equipe, renovações e alertas em um único ambiente.</p>
          <div className={styles.signature}>DOCTYPE OS</div>
        </div>

        <div className={styles.guardianGlow} aria-hidden="true" />
        <Image className={styles.guardian} src="/assets/doc-mascote.svg" alt="DOC, Guardião operacional da DOCTYPE" width={560} height={560} priority />
        <div className={styles.monitorCard}>
          <div className={styles.monitorHead}><strong>DOC MONITOR</strong><span className={styles.online}><i /> Ativo</span></div>
          <p>O Guardião acompanha indicadores e sinaliza exceções que exigem atenção.</p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.card}>
          <span className={styles.accessLabel}>Acesso seguro</span>
          <h2>Bem-vindo ao centro da operação.</h2>
          <p>Acesse seu ambiente DOCTYPE OS para acompanhar e administrar sua empresa.</p>
          <LoginForm />
          <div className={styles.security}><i /> Ambiente protegido · acesso registrado em auditoria</div>
        </div>
      </section>
    </main>
  );
}
