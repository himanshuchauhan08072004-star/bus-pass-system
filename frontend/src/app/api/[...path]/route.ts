import type { NextRequest } from "next/server";

// Same-origin proxy to the FastAPI backend. Keeping the API on the same origin
// lets the session cookie stay SameSite=Lax + httpOnly with no CORS in play.
export const dynamic = "force-dynamic";

const BACKEND = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
const FORWARD_REQUEST_HEADERS = ["cookie", "content-type", "x-csrf-token", "accept"];

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${BACKEND}/api/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }
  // Behind a trusted load balancer the LAST X-Forwarded-For entry is the client IP
  // as seen by that balancer. Used only for rate limiting and audit logs.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) headers.set("x-forwarded-for", xff.split(",").pop()!.trim());

  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.text() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json({ detail: "The service is temporarily unavailable. Please try again." }, { status: 502 });
  }

  const out = new Headers();
  const type = upstream.headers.get("content-type");
  if (type) out.set("content-type", type);
  const retry = upstream.headers.get("retry-after");
  if (retry) out.set("retry-after", retry);
  for (const c of upstream.headers.getSetCookie()) out.append("set-cookie", c);
  out.set("cache-control", "no-store");
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
