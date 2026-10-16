import Link from "next/link";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-brand" />
      <path d="M7 21c4 0 5-10 9-10s5 10 9 10" fill="none" stroke="rgb(var(--brand-fg))" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="7" cy="21" r="2.2" fill="rgb(var(--brand-fg))" />
      <circle cx="25" cy="21" r="2.2" fill="rgb(var(--brand-fg))" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-bold tracking-tight" aria-label="TransitFlow home">
      <LogoMark />
      <span className="text-lg">
        Transit<span className="text-brand">Flow</span>
      </span>
    </Link>
  );
}
