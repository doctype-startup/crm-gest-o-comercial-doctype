import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  if (await getSession()) redirect("/os");
  return (
    <main className="login-page">
      <section className="login-brand">
        <Image src="/assets/doctype-logo.svg" alt="DOCTYPE" width={92} height={92} priority />
        <div><span className="eyebrow">GESTÃO INTERNA</span><h1>DOCTYPE OS</h1><p>Direção, organização e conexão para a operação crescer.</p></div>
        <Image className="login-doc" src="/assets/doc-mascote.svg" alt="DOC, Guardião operacional" width={270} height={270} priority />
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="orange-line" />
          <span className="eyebrow">ACESSO SEGURO</span>
          <h2>Bem-vindo ao centro da operação.</h2>
          <p>Entre com seu usuário DOCTYPE para continuar.</p>
          <LoginForm />
          <small>Ambiente interno • Acesso registrado em auditoria</small>
        </div>
      </section>
    </main>
  );
}
