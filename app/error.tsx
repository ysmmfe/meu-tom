"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="conteudo" className="shell">
      <h1>Não foi possível carregar a página</h1>
      <p>
        Verifique a conexão e tente novamente. O catálogo local não depende de
        provedores externos.
      </p>
      <button onClick={reset}>Tentar novamente</button>
    </main>
  );
}
