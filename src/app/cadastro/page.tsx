import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { SignupForm } from "@/components/signup-form";
import { SELF_SERVE_PLANS } from "@/lib/plan-catalog";
import shell from "../login/login.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CadastroPage() {
  if (await getSession()) redirect("/os");

  return (
    <main className={shell.page}>
      <div className={shell.grid} aria-hidden="true" />
      <div className={shell.orangeGlowTop} aria-hidden="true" />
      <div className={shell.blueGlow} aria-hidden="true" />
      <div className={shell.orangeGlowBottom} aria-hidden="true" />

      <section className={shell.brand} aria-label="DOC.OS Gestão Interna">
        <div className={shell.brandInner}>
          <div className={shell.appName} aria-label="DOC.OS"><span>DOC</span><b>.</b><span>OS</span></div>
          <div className={shell.appCaption}>COMECE AGORA</div>

          <div className={shell.managementRow} aria-hidden="true">
            <span />
            <i />
            <span />
          </div>

          <div className={shell.values} aria-label="Processos, performance e resultados">
            <span>PROCESSOS</span><i />
            <span>PERFORMANCE</span><i />
            <span>RESULTADOS</span>
          </div>
        </div>
      </section>

      <section className={shell.loginArea}>
        <div className={shell.cardGlow} aria-hidden="true" />
        <div className={`${shell.card} signup-card`}>
          <div className={shell.cardHeading}>
            <h1>Crie sua conta</h1>
            <p>Escolha um plano e comece a usar o DOC.OS agora mesmo</p>
          </div>
          <SignupForm plans={SELF_SERVE_PLANS} />
          <p className="signup-enterprise">Precisa de mais de {SELF_SERVE_PLANS[SELF_SERVE_PLANS.length - 1].maxUsers} usuários ou um plano sob medida? <a href="mailto:comercial@doctype.com.br">Fale com a DOCTYPE</a> sobre o plano Enterprise.</p>
          <p className="signup-login-link">Já tem uma conta? <a href="/login">Entrar</a></p>
        </div>
      </section>

      <footer className={shell.footer}>
        <span><ShieldCheck size={16} /> Sistema seguro</span>
        <i />
        <span>UM PRODUTO DOCTYPE</span>
        <i />
        <span>Todos os direitos reservados</span>
      </footer>
    </main>
  );
}
