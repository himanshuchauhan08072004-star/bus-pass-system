"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/format";

/** Original SVG bus scene drawn with the theme tokens, so it follows light and dark themes. No external assets. */
export function BusIllustration({ className, animate = true }: { className?: string; animate?: boolean }) {
  const reduce = useReducedMotion();
  const float = animate && !reduce;
  return (
    <svg viewBox="0 0 520 280" className={cn("w-full", className)} role="img" aria-label="Illustration of a TransitFlow bus on the road">
      <circle cx="402" cy="78" r="50" className="fill-peach" opacity="0.85" />
      <path d="M0 196 C 70 150, 130 160, 190 182 S 320 150, 390 170 S 480 160, 520 176 V 232 H 0 Z" className="fill-sage" opacity="0.75" />
      <path d="M0 214 C 90 188, 170 204, 250 206 S 420 190, 520 206 V 240 H 0 Z" className="fill-sage" />
      <rect x="0" y="228" width="520" height="52" className="fill-brand" opacity="0.92" />
      <g className="stroke-brand-fg" strokeWidth="3" strokeLinecap="round" strokeDasharray="22 20" opacity="0.5">
        <line x1="0" y1="256" x2="520" y2="256" />
      </g>
      <motion.g animate={float ? { y: [0, -3, 0] } : undefined} transition={float ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : undefined}>
        <ellipse cx="240" cy="232" rx="170" ry="8" className="fill-fg" opacity="0.18" />
        <rect x="64" y="96" width="354" height="124" rx="30" className="fill-surface" />
        <rect x="64" y="96" width="354" height="124" rx="30" fill="none" className="stroke-brand" strokeWidth="2" opacity="0.35" />
        <path d="M64 176 H418 V190 a30 30 0 0 1 -30 30 H94 a30 30 0 0 1 -30 -30 Z" className="fill-sage" />
        <rect x="64" y="168" width="354" height="9" className="fill-peach" />
        {[92, 152, 212, 272].map((x) => (
          <rect key={x} x={x} y="116" width="48" height="44" rx="12" className="fill-sage" opacity="0.8" />
        ))}
        <path d="M340 116 H388 a14 14 0 0 1 14 14 V160 H340 Z" className="fill-brand" opacity="0.88" />
        <rect x="336" y="170" width="3" height="46" className="fill-brand" opacity="0.25" />
        <rect x="408" y="186" width="14" height="12" rx="5" className="fill-peach" />
        <text x="92" y="196" fontSize="13" fontWeight="700" letterSpacing="2.5" className="fill-brand">TRANSITFLOW</text>
        {[140, 350].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="222" r="23" className="fill-brand" />
            <circle cx={cx} cy="222" r="9" className="fill-surface2" />
          </g>
        ))}
      </motion.g>
    </svg>
  );
}
