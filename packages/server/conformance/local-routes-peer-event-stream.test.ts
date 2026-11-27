// @vitest-environment happy-dom
// Spec: k.topology, clause "Through `x`, a `GET` with `accept: text/event-stream` of `y`'s `local: true` live API entry `b.feed`, from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: none`, answers 403 `keel.denied`, its loader not run."
// Seed 1337 (fast-check: the request's remote address). Fixture: local-routes-peer-support.ts (`y`'s `b.feed` is a `local: true` live API entry with `events: true`).
// ASSUMED: the 403 body holds the text `keel.denied`; the status is read from the response head, so no event is read.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GOOD, NONE, SEED, conn, get, pair, six } from "./local-routes-peer-support.ts";

const SSE = { ...GOOD, accept: "text/event-stream" };

describe("k.topology Calls and peers: an event stream of a `local` route of a peer", () => {
  it("through `x`, a `GET` with `accept: text/event-stream` of `y`'s `local: true` live API entry `b.feed`, from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: none`, reaches `y` with `x-keel-forwarded: 1`", async () => {
    const { x, seen } = await pair();
    await x.fetch(get("/api/feed", SSE), conn("127.0.0.1"));
    expect(seen).toEqual([{ method: "GET", path: "/api/feed", forwarded: "1" }]);
  });

  it("answers 403 `keel.denied`", async () => {
    const { x } = await pair();
    const res = await x.fetch(get("/api/feed", SSE), conn("127.0.0.1"));
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type") ?? "").not.toContain("text/event-stream");
    expect(await res.text()).toContain("keel.denied");
  });

  it("answers with the six k.security headers", async () => {
    const { x } = await pair();
    six(await x.fetch(get("/api/feed", SSE), conn("127.0.0.1")), "event stream");
  });

  it("leaves `b.feed`'s loader not run, whatever the remote address", async () => {
    const octet = fc.integer({ min: 0, max: 255 });
    const address = fc.oneof(
      fc.constantFrom("127.0.0.1", "::1", "10.0.0.5"),
      fc.tuple(octet, octet, octet, octet).map((p) => p.join(".")),
    );
    const { x, hits } = await pair();
    await fc.assert(
      fc.asyncProperty(address, async (a) => {
        const res = await x.fetch(get("/api/feed", SSE), conn(a));
        expect(res.status, a).toBe(403);
      }),
      { seed: SEED, numRuns: 20 },
    );
    expect(hits).toEqual(NONE);
  });
});
