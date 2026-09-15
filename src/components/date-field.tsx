"use client";

import { useState } from "react";

function isoToBr(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function maskBr(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function brToIso(masked: string) {
  const match = masked.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${month}-${day}`;
}

// Input nativo type="date" segue o idioma do sistema operacional do navegador, não o
// lang="pt-BR" da página — em máquinas configuradas em outro idioma isso mostra o campo
// em mm/dd/aaaa mesmo com o app inteiro em português. Este componente usa texto mascarado
// (dd/mm/aaaa) para garantir o mesmo formato de preenchimento em qualquer navegador,
// convertendo para o formato ISO (aaaa-mm-dd) já usado para armazenar e exibir datas.
export function DateField({ label, value, onChange, required, full, hint }: { label: string; value: string; onChange: (iso: string) => void; required?: boolean; full?: boolean; hint?: string }) {
  const [display, setDisplay] = useState(() => isoToBr(value));
  // Ajusta o texto exibido quando o valor vem de fora (ex.: registro carregado no modal
  // de edição) — durante a renderização, não num efeito, para evitar um render extra.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDisplay(isoToBr(value));
  }

  function handleChange(raw: string) {
    const masked = maskBr(raw);
    setDisplay(masked);
    if (!masked) return onChange("");
    const iso = brToIso(masked);
    if (iso) onChange(iso);
  }

  return <label className={`field ${full ? "full" : ""}`}>
    <span>{label}{required && " *"}</span>
    <input type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" maxLength={10} value={display} required={required} onChange={(event) => handleChange(event.target.value)} />
    {hint && <small className="field-hint">{hint}</small>}
  </label>;
}
