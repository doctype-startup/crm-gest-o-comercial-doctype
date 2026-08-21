"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-page"><h1>Algo saiu do fluxo.</h1><p>O DOC registrou a falha. Tente novamente.</p><button className="primary" onClick={reset}>Tentar novamente</button></main>;
}
