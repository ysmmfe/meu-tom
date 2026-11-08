import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Meu Tom — Encontre músicas que você já consegue tocar",
    template: "%s · Meu Tom",
  },
  description:
    "Descubra músicas para os acordes que você conhece. Transposição e capotraste para quem está começando no violão.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <span>Feito para começar a tocar</span>
          <span>Índice chorrrds · Cifras didáticas CC0 · Código aberto</span>
        </footer>
      </body>
    </html>
  );
}
