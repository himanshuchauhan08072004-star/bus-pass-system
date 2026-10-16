"use client";

import { motion, useReducedMotion } from "framer-motion";

const STOPS = [
  { x: 40, y: 190, label: "Gurugram" },
  { x: 150, y: 110, label: "IFFCO Chowk" },
  { x: 270, y: 150, label: "Dhaula Kuan" },
  { x: 380, y: 60, label: "Kashmere Gate" },
];

export function HeroVisual() {
  const reduce = useReducedMotion();
  const d = "M40 190 C 90 190, 100 110, 150 110 S 230 150, 270 150 S 340 60, 380 60";
  return (
    <div className="relative mx-auto w-full max-w-md rounded-3xl border border-line bg-surface/70 p-5 shadow-glow backdrop-blur" aria-hidden>
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span className="font-semibold text-fg">DEMO-101 · Live route preview</span>
        <span className="rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success">Every 30 min</span>
      </div>
      <svg viewBox="0 0 420 240" className="w-full">
        <path d={d} fill="none" stroke="rgb(var(--line))" strokeWidth="6" strokeLinecap="round" />
        <motion.path
          d={d}
          fill="none"
          stroke="rgb(var(--brand))"
          strokeWidth="6"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduce ? 0 : 2.2, ease: "easeInOut" }}
        />
        {STOPS.map((s) => (
          <g key={s.label}>
            <circle cx={s.x} cy={s.y} r="9" fill="rgb(var(--surface))" stroke="rgb(var(--brand))" strokeWidth="4" />
            <text x={s.x} y={s.y + 28} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">{s.label}</text>
          </g>
        ))}
        {!reduce && (
          <motion.circle r="7" fill="rgb(var(--brand))" initial={{ offsetDistance: "0%" }} animate={{ offsetDistance: "100%" }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} style={{ offsetPath: `path("${d}")` }} />
        )}
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        {[
          ["Fare", "₹78.40"],
          ["Distance", "38 km"],
          ["Ticket", "QR"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface2 py-2">
            <div className="text-muted">{k}</div>
            <div className="font-bold">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
