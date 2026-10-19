import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PassCard } from "@/components/features/PassCard";
import { StatStrip } from "@/components/ui/Card";
import type { BusPass } from "@/lib/types";

const base: BusPass = {
  id: 1, pass_code: "TF-0001", pass_type_id: 1, pass_type_name: "Monthly Pass", eligibility: "general",
  status: "active", valid_from: "2026-10-01", valid_to: "2026-10-31", days_left: 12, can_renew: false, qr_token: "tok", created_at: "2026-10-01T00:00:00Z",
};

describe("PassCard", () => {
  it("shows the real status and holder name", () => {
    render(<PassCard pass={base} holder="Asha Rao" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("12 days left")).toBeInTheDocument();
  });
  it("never labels an expired pass as active", () => {
    render(<PassCard pass={{ ...base, status: "expired", qr_token: null, days_left: 0 }} />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.queryByText(/days? left/)).toBeNull();
  });
});

describe("StatStrip", () => {
  it("renders every provided figure", () => {
    render(<StatStrip items={[{ label: "Routes", value: 5 }, { label: "Buses", value: 8 }]} />);
    expect(screen.getByText("Routes")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });
});
