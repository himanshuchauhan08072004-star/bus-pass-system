import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="frame">
      <Navbar />
      <main id="main" className="animate-rise">{children}</main>
      <Footer />
    </div>
  );
}
