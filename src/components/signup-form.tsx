"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail, User } from "lucide-react";
import type { PlanCatalogEntry, SelfServePlanId } from "@/lib/plan-catalog";

export function SignupForm({ plans }: { plans: readonly PlanCatalogEntry[] }) {
  const router = useRouter();
  const [plan, setPlan] = useState<SelfServePlanId>(plans[0]?.id ?? "Start");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.get("companyName"),
          adminName: form.get("adminName"),
          adminEmail: form.get("adminEmail"),
          password: form.get("password"),
          plan,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível criar sua conta.");
      router.push("/os?billing=welcome");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar sua conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form signup-form" onSubmit={submit}>
      <div className="plan-picker" role="radiogroup" aria-label="Escolha um plano">
        {plans.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={plan === entry.id}
            className={`plan-option${plan === entry.id ? " selected" : ""}`}
            onClick={() => setPlan(entry.id)}
          >
            <span className="plan-option-name">{entry.label}</span>
            <strong className="plan-option-price">{entry.monthlyPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}<small>/mês</small></strong>
            <span className="plan-option-users">Até {entry.maxUsers} usuários</span>
          </button>
        ))}
      </div>

      <label><span>Nome da empresa</span><div className="input-icon"><Building2 size={20} /><input name="companyName" type="text" placeholder="Nome da sua agência" required minLength={2} maxLength={200} /></div></label>
      <label><span>Seu nome</span><div className="input-icon"><User size={20} /><input name="adminName" type="text" autoComplete="name" placeholder="Seu nome" required minLength={2} maxLength={200} /></div></label>
      <label><span>E-mail</span><div className="input-icon"><Mail size={20} /><input name="adminEmail" type="email" autoComplete="email" placeholder="E-mail" required /></div></label>
      <label><span>Senha</span><div className="input-icon"><LockKeyhole size={20} /><input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Crie uma senha forte" required minLength={10} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label="Alternar visibilidade">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
      <p className="signup-password-hint">Mínimo de 10 caracteres, com letra, número e símbolo.</p>

      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary wide" aria-label="Criar minha conta DOC.OS" disabled={loading}><ArrowRight size={21} />{loading ? "Criando conta…" : "Criar minha conta"}</button>
      <p className="signup-terms">Ao continuar, você poderá ativar a cobrança automática (Pix ou Cartão) a qualquer momento dentro do DOC.OS.</p>
    </form>
  );
}
