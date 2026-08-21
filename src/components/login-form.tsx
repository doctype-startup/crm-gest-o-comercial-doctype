"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <label><span>E-mail</span><div className="input-icon"><Mail size={18} /><input name="email" type="email" autoComplete="username" required /></div></label>
      <label><span>Senha</span><div className="input-icon"><LockKeyhole size={18} /><input name="password" type="password" autoComplete="current-password" required /></div></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary wide" disabled={loading}>{loading ? "Entrando…" : "Entrar no DOCTYPE OS"}</button>
    </form>
  );
}
