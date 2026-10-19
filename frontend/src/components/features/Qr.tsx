"use client";

import { QRCodeSVG } from "qrcode.react";

/** White quiet-zone background keeps the code scannable in dark theme. */
export function QrBox({ value, size = 176, label }: { value: string; size?: number; label: string }) {
  return (
    <div className="inline-block rounded-3xl bg-white p-3 shadow-card" role="img" aria-label={label}>
      <QRCodeSVG value={value} size={size} level="M" bgColor="#ffffff" fgColor="#282d1f" />
    </div>
  );
}
