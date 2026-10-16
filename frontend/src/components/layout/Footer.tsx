import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface/50 no-print">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted">
            Digital tickets and bus passes with server-verified pricing and payments, built cloud-first.
          </p>
          <p className="mt-4 text-xs text-muted">
            Demonstration project built for the CodeAlpha Cloud Computing Internship. Routes, fares and payments in this
            deployment are demo data; no real money moves.
          </p>
        </div>
        <nav aria-label="Product">
          <h3 className="text-sm font-semibold">Product</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-fg" href="/routes">Explore routes</Link></li>
            <li><Link className="hover:text-fg" href="/dashboard/passes">Bus passes</Link></li>
            <li><Link className="hover:text-fg" href="/verify">Verify a ticket</Link></li>
          </ul>
        </nav>
        <nav aria-label="Account">
          <h3 className="text-sm font-semibold">Account</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-fg" href="/login">Sign in</Link></li>
            <li><Link className="hover:text-fg" href="/register">Create account</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">© {new Date().getFullYear()} TransitFlow. All rights reserved.</div>
    </footer>
  );
}
