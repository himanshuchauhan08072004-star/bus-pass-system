"""Tiny load generator for smoke-testing capacity. Requires: pip install httpx

  python scripts/loadtest.py --base-url http://localhost:8000 --concurrency 20 --duration 15

It hits public read endpoints only (health, route search, route detail). It does NOT
prove autoscaling: run it against a deployed service while watching the ECS/ALB metrics
(request count, task count, CPU, latency) and record the numbers yourself.
"""
import argparse
import asyncio
import statistics
import time

import httpx

PATHS = ["/health", "/api/v1/routes", "/api/v1/routes?origin=gurugram&destination=delhi&sort=fare", "/api/v1/pass-types"]


async def worker(client: httpx.AsyncClient, stop_at: float, latencies: list[float], errors: list[int]) -> None:
    i = 0
    while time.monotonic() < stop_at:
        path = PATHS[i % len(PATHS)]
        i += 1
        t = time.perf_counter()
        try:
            r = await client.get(path)
            latencies.append((time.perf_counter() - t) * 1000)
            if r.status_code >= 500:
                errors.append(r.status_code)
        except httpx.HTTPError:
            errors.append(0)


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000")
    ap.add_argument("--concurrency", type=int, default=20)
    ap.add_argument("--duration", type=int, default=15, help="seconds")
    a = ap.parse_args()
    latencies: list[float] = []
    errors: list[int] = []
    limits = httpx.Limits(max_connections=a.concurrency)
    async with httpx.AsyncClient(base_url=a.base_url, timeout=15, limits=limits) as client:
        stop_at = time.monotonic() + a.duration
        started = time.monotonic()
        await asyncio.gather(*[worker(client, stop_at, latencies, errors) for _ in range(a.concurrency)])
        elapsed = time.monotonic() - started
    n = len(latencies)
    if not n:
        print("No successful requests.")
        return
    latencies.sort()
    print(f"requests: {n}   errors(5xx/network): {len(errors)}   duration: {elapsed:.1f}s   rps: {n / elapsed:.1f}")
    print(f"latency ms  p50: {statistics.median(latencies):.0f}   p95: {latencies[int(n * 0.95) - 1]:.0f}   max: {latencies[-1]:.0f}")


if __name__ == "__main__":
    asyncio.run(main())
