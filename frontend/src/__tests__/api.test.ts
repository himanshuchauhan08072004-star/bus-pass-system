import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, buildQuery, readCookie } from "@/lib/api";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("api client", () => {
  beforeEach(() => {
    document.cookie = "tf_csrf=token-123; path=/";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "tf_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("reads cookies", () => {
    expect(readCookie("tf_csrf")).toBe("token-123");
    expect(readCookie("missing")).toBeNull();
  });

  it("builds query strings, skipping empty values", () => {
    expect(buildQuery({ a: "x y", b: "", c: undefined, d: 0, e: false })).toBe("?a=x+y&d=0&e=false");
    expect(buildQuery()).toBe("");
  });

  it("sends the CSRF header on mutations but not on GET", async () => {
    const f = mockFetch(200, { ok: true });
    await api("/bookings", { method: "POST", body: { a: 1 } });
    const post = f.mock.calls[0][1] as RequestInit & { headers: Record<string, string> };
    expect(post.headers["X-CSRF-Token"]).toBe("token-123");
    expect(post.headers["Content-Type"]).toBe("application/json");
    expect(post.credentials).toBe("same-origin");

    await api("/routes");
    const get = f.mock.calls[1][1] as RequestInit & { headers: Record<string, string> };
    expect(get.headers["X-CSRF-Token"]).toBeUndefined();
    expect(f.mock.calls[1][0]).toBe("/api/routes");
  });

  it("never sends a price or status chosen by the client (body is passed through untouched)", async () => {
    const f = mockFetch(200, {});
    await api("/bookings", { method: "POST", body: { route_id: 1 } });
    expect(JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)).toEqual({ route_id: 1 });
  });

  it("throws ApiError carrying the server detail and status", async () => {
    mockFetch(409, { detail: "You already have a booking at this date and time" });
    await expect(api("/bookings", { method: "POST", body: {} })).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "You already have a booking at this date and time",
    });
  });

  it("falls back to a generic message for non-JSON errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 })));
    const err = (await api("/x").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Request failed (502)");
  });

  it("reports network failures clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(api("/x")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("Cannot reach the server") });
  });

  it("handles 204 responses", async () => {
    mockFetch(204, null);
    await expect(api("/admin/stops/1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
