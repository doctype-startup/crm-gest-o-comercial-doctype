"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível entrar.");
      router.push("/os"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível entrar."); }
    finally { setLoading(false); }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label><span>E-mail</span><div className="input-icon"><Mail size={20} /><input name="email" type="email" autoComplete="username" placeholder="E-mail ou usuário" required /></div></label>
      <label><span>Senha</span><div className="input-icon"><LockKeyhole size={20} /><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Senha" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
      <div className="login-options"><label className="remember"><input type="checkbox" name="remember" defaultChecked /><span>Lembrar de mim</span></label><span className="forgot">Esqueceu a senha?</span></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary wide" disabled={loading}><ArrowRight size={21} />{loading ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
