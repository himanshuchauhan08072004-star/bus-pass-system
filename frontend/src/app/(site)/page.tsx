"use client";

import { BadgeCheck, CalendarClock, Fingerprint, QrCode, Repeat, SearchCheck, ShieldCheck, Smartphone, Ticket, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { HeroVisual } from "@/components/features/HeroVisual";
import { Reveal } from "@/components/features/Reveal";
import { SearchForm } from "@/components/features/SearchForm";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const benefits = [
  { icon: ShieldCheck, title: "Fares the server calculates", text: "You never type a price. Every fare and pass price is computed on the backend, so a tampered request cannot change what you pay." },
  { icon: QrCode, title: "Tickets that cannot be forged", text: "Each ticket carries a signed QR code with no personal data. Validity is always checked against the live booking record." },
  { icon: Fingerprint, title: "No lost or double tickets", text: "Tickets live in your account, not on paper. Duplicate and clashing bookings are blocked by the database itself." },
  { icon: Repeat, title: "One-tap pass renewal", text: "Renew a pass in the last week of its validity and the new term starts the day the old one ends." },
  { icon: Wallet, title: "Clear refund policy", text: "Cancel early for a full refund, later for half. The exact refund is shown before you confirm." },
  { icon: Smartphone, title: "Works on any device", text: "A responsive interface with keyboard-friendly controls and light and dark themes." },
];

const steps = [
  { icon: SearchCheck, title: "Find your route", text: "Search by origin and destination, then filter and sort by fare or frequency." },
  { icon: CalendarClock, title: "Pick date and time", text: "Choose a scheduled departure. The fare is quoted by the server as you choose." },
  { icon: Wallet, title: "Pay securely", text: "Payment is confirmed only after the server verifies it with the provider." },
  { icon: Ticket, title: "Show your QR", text: "Your digital ticket or pass is ready instantly and verified at boarding." },
];

export default function Home() {
  const router = useRouter();
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0" aria-hidden />
        <div className="absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-semibold text-muted">
              <BadgeCheck className="h-4 w-4 text-brand" aria-hidden /> Cloud-ready digital ticketing
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Every journey, <span className="bg-gradient-to-r from-brand to-sky-400 bg-clip-text text-transparent">one tap away.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Discover bus routes, book tickets and manage digital passes. Prices are calculated and payments verified on the server, so every ticket you hold is one you can trust.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/routes" size="lg">Explore routes</ButtonLink>
              <ButtonLink href="/login" size="lg" variant="secondary">Sign in</ButtonLink>
            </div>
          </div>
          <HeroVisual />
        </div>
        <div className="relative mx-auto -mt-8 max-w-6xl px-4 pb-16">
          <Card className="p-5 shadow-glow sm:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Where are you going?</h2>
            <SearchForm
              onSearch={(o, d) => {
                const p = new URLSearchParams();
                if (o) p.set("origin", o);
                if (d) p.set("destination", d);
                router.push(`/routes${p.toString() ? `?${p}` : ""}`);
              }}
            />
          </Card>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight">Book in four steps</h2>
          <p className="mt-2 max-w-2xl text-muted">From search to boarding, everything happens in one place.</p>
        </Reveal>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 0.07}>
                <Card className="h-full p-5">
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-brand/10 p-2.5 text-brand"><s.icon className="h-5 w-5" aria-hidden /></span>
                    <span className="text-3xl font-black text-line" aria-hidden>{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-semibold"><span className="sr-only">Step {i + 1}: </span>{s.title}</h3>
                  <p className="mt-1 text-sm text-muted">{s.text}</p>
                </Card>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section id="benefits" className="border-y border-line bg-surface/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight">Built to be trusted</h2>
            <p className="mt-2 max-w-2xl text-muted">TransitFlow fixes the weak spots of traditional booking sites: lost tickets, tampering and wrong prices.</p>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b, i) => (
              <Reveal key={b.title} delay={(i % 3) * 0.07}>
                <Card className="h-full p-5">
                  <span className="inline-flex rounded-xl bg-brand/10 p-2.5 text-brand"><b.icon className="h-5 w-5" aria-hidden /></span>
                  <h3 className="mt-4 font-semibold">{b.title}</h3>
                  <p className="mt-1 text-sm text-muted">{b.text}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <Card className="relative overflow-hidden p-8 text-center sm:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-brand/15 via-transparent to-transparent" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight">Ready for a smoother commute?</h2>
            <p className="mx-auto mt-2 max-w-xl text-muted">Create a free account to book tickets, apply for a pass and keep every journey in one place.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/register" size="lg">Create your account</ButtonLink>
              <ButtonLink href="/routes" size="lg" variant="secondary">Browse routes</ButtonLink>
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}
