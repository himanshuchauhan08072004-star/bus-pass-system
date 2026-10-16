import { describe, expect, it } from "vitest";
import { addDays, cn, formatDate, formatMoney, formatTime, parseDate, statusLabel, statusTone, toDateInput } from "@/lib/format";
import { safeNext } from "@/lib/nav";

describe("format helpers", () => {
  it("formats money in INR with two decimals", () => {
    expect(formatMoney("78.4")).toBe("₹78.40");
    expect(formatMoney("1200")).toBe("₹1,200.00");
    expect(formatMoney(null)).toBe("₹0.00");
    expect(formatMoney("not-a-number")).toBe("₹0.00");
  });

  it("formats times", () => {
    expect(formatTime("05:30:00")).toMatch(/5:30\s?am/i);
    expect(formatTime("22:30")).toMatch(/10:30\s?pm/i);
  });

  it("parses date strings as local calendar dates (no timezone shift)", () => {
    const d = parseDate("2026-10-13");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 13]);
    expect(formatDate("2026-10-13")).toContain("13");
    expect(toDateInput(d)).toBe("2026-10-13");
    expect(toDateInput(addDays(d, 20))).toBe("2026-11-02");
  });

  it("maps statuses to tones and labels", () => {
    expect(statusTone("confirmed")).toBe("success");
    expect(statusTone("pending_payment")).toBe("warning");
    expect(statusTone("rejected")).toBe("danger");
    expect(statusTone("something-else")).toBe("neutral");
    expect(statusLabel("pending_payment")).toBe("Pending payment");
  });

  it("joins class names", () => {
    expect(cn("a", false, null, "b")).toBe("a b");
  });
});

describe("safeNext (open-redirect guard)", () => {
  it("allows same-site paths only", () => {
    expect(safeNext("/dashboard/bookings", "/x")).toBe("/dashboard/bookings");
    expect(safeNext("https://evil.example", "/x")).toBe("/x");
    expect(safeNext("//evil.example", "/x")).toBe("/x");
    expect(safeNext("/\\evil.example", "/x")).toBe("/x");
    expect(safeNext(null, "/x")).toBe("/x");
  });
});
