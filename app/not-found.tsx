import Link from "next/link";
export default function NotFound() {
  return (
    <main id="conteudo" className="shell">
      <h1>Música não encontrada</h1>
      <p>Essa cifra não está disponível no catálogo publicado.</p>
      <Link href="/" className="button">
        Voltar para a descoberta
      </Link>
    </main>
  );
}
