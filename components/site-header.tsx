"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function FretboardMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 80 88" aria-hidden="true">
      <rect x="16" y="4" width="48" height="80" rx="5" fill="currentColor" />
      <g stroke="var(--page)" strokeWidth="1.3">
        {[22, 29, 36, 43, 50, 57].map((x) => (
          <path key={x} d={`M${x} 8v72`} />
        ))}
        {[20, 40, 60].map((y) => (
          <path key={y} d={`M17 ${y}h46`} />
        ))}
      </g>
      <g fill="var(--page)">
        <circle cx="22" cy="50" r="3.5" />
        <circle cx="29" cy="30" r="3.5" />
        <circle cx="57" cy="50" r="3.5" />
      </g>
    </svg>
  );
}
export function SiteHeader() {
  const home = usePathname() === "/";
  if (home)
    return (
      <header className="discovery-hero">
        <FretboardMark />
        <h1>Meu Tom</h1>
        <p>Encontre músicas que você já consegue tocar</p>
      </header>
    );
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Meu Tom, início">
        <span className="strings" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        Meu Tom
      </Link>
      <span className="header-note">
        Encontre músicas que você já consegue tocar
      </span>
    </header>
  );
}
