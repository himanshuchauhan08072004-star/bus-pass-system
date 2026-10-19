import Link from "next/link";

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden>
      <rect width="36" height="36" rx="12" className="fill-brand" />
      <rect x="7" y="9" width="22" height="15" rx="5" fill="rgb(var(--brand-fg))" />
      <rect x="10" y="12" width="7" height="6" rx="2" className="fill-sage" />
      <rect x="19" y="12" width="7" height="6" rx="2" className="fill-sage" />
      <rect x="7" y="20" width="22" height="2.4" className="fill-peach" />
      <circle cx="13" cy="26" r="2.6" className="fill-peach" />
      <circle cx="23" cy="26" r="2.6" className="fill-peach" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="TransitFlow home">
      <LogoMark />
      <span className="font-display text-xl">
        Transit<span className="italic text-brand">Flow</span>
      </span>
    </Link>
  );
}
