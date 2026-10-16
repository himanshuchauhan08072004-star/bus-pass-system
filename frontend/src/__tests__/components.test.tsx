import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, Pagination } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState } from "@/components/ui/States";

describe("Button", () => {
  it("is disabled and busy while loading", () => {
    render(<Button loading>Save</Button>);
    const b = screen.getByRole("button", { name: /save/i });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
  });
  it("fires onClick", () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe("Input", () => {
  it("links label, error and aria-invalid", () => {
    render(<Input label="Email" error="Enter a valid email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });
  it("shows a hint when there is no error", () => {
    render(<Input label="Password" hint="10+ characters" />);
    expect(screen.getByText("10+ characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid");
  });
});

describe("badges and states", () => {
  it("renders a humanised status", () => {
    render(<StatusBadge status="pending_payment" />);
    expect(screen.getByText("Pending payment")).toBeInTheDocument();
    render(<Badge tone="danger">x</Badge>);
  });
  it("empty state shows title and message", () => {
    render(<EmptyState title="No routes match" message="Try again" />);
    expect(screen.getByText("No routes match")).toBeInTheDocument();
  });
  it("error state offers retry", () => {
    const retry = vi.fn();
    render(<ErrorState message="Boom" onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalled();
  });
});

describe("Modal", () => {
  it("is an accessible dialog that closes on Escape", () => {
    const close = vi.fn();
    render(<Modal open onClose={close} title="Confirm"><button>Inner</button></Modal>);
    const dlg = screen.getByRole("dialog", { name: "Confirm" });
    expect(dlg).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalled();
  });
  it("renders nothing when closed", () => {
    render(<Modal open={false} onClose={() => undefined} title="Hidden">x</Modal>);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DataTable", () => {
  const cols = [{ header: "Name", cell: (r: { n: string }) => r.n }];
  it("renders rows and the empty message", () => {
    const { rerender } = render(<DataTable rows={[{ n: "A" }, { n: "B" }]} columns={cols} rowKey={(r) => r.n} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    rerender(<DataTable rows={[]} columns={cols} rowKey={(r) => r.n} empty="Nothing" />);
    expect(screen.getByText("Nothing")).toBeInTheDocument();
  });
  it("paginates", () => {
    const change = vi.fn();
    render(<Pagination total={40} limit={15} offset={15} onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(change).toHaveBeenCalledWith(30);
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(change).toHaveBeenCalledWith(0);
  });
});
