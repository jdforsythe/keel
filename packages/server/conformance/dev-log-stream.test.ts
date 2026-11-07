// @vitest-environment happy-dom
// Clause: The dev log stream emits exactly one `req` record per request; in json mode every line parses.
// Spec: `createApp({ log: { format: 'compact' | 'json', write } })` writes the stream, one line per `write` (rfc:0034).
// Seed 1337 (fc.assert below). No wall time: the `ms` figure is only matched by shape.
import { ok } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { build, get, post } from "./fixtures.ts";

type Kind = "ok200" | "params404" | "invalid422" | "valid303" | "cross403" | "big413" | "throw500";
interface Case {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly status: number;
  readonly req: () => Request;
}

// happy-dom's Request drops forbidden request headers (Origin), so they are set on the headers object afterwards.
function forbidden(req: Request, extra: Record<string, string>): Request {
  const h = new Headers(req.headers);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  Object.defineProperty(req, "headers", { value: h });
  return req;
}

const MAX = 2000;
const cases: Record<Kind, Case> = {
  ok200: { method: "GET", path: "/orders/open", status: 200, req: () => get("/orders/open") },
  params404: { method: "GET", path: "/orders/zzz", status: 404, req: () => get("/orders/zzz") },
  invalid422: {
    method: "POST",
    path: "/orders/open",
    status: 422,
    req: () => post("/orders/open", { kind: "zzz", note: "n" }),
  },
  valid303: {
    method: "POST",
    path: "/orders/open",
    status: 303,
    req: () => post("/orders/open", { kind: "open", note: "n" }),
  },
  cross403: {
    method: "POST",
    path: "/orders/open",
    status: 403,
    req: () => forbidden(post("/orders/open", { kind: "open", note: "n" }), { origin: "http://evil.example" }),
  },
  big413: {
    method: "POST",
    path: "/orders/open",
    status: 413,
    req: () => post("/orders/open", { kind: "open", note: "x".repeat(MAX * 3) }),
  },
  throw500: { method: "GET", path: "/orders/closed", status: 500, req: () => get("/orders/closed") },
};
const kindArb = fc.constantFrom<Kind>("ok200", "params404", "invalid422", "valid303", "cross403", "big413", "throw500");

async function run(format: "compact" | "json", seq: readonly Kind[]) {
  const lines: string[] = [];
  const { app } = await build(
    {
      act: () => ok(null),
      show: ({ params }) => {
        if (params.kind === "closed") return Promise.reject(new Error("boom"));
        return Promise.resolve(ok({ title: "T" }));
      },
    },
    "dev",
    { log: { format, write: (l: string) => void lines.push(l) }, maxBodyBytes: MAX },
  );
  const sent: Case[] = [];
  for (const k of seq) {
    const c = cases[k];
    const res = await app.fetch(c.req());
    await res.text();
    sent.push(c);
    expect(res.status).toBe(c.status);
  }
  return { lines, sent };
}

const seqArb = fc.array(kindArb, { minLength: 1, maxLength: 12 });
const strip = (l: string) => (l.endsWith("\n") ? l.slice(0, -1) : l);

describe("k.server", () => {
  it("In json mode every dev log line parses and there is exactly one `req` record per request, in order, with its method, path and status", async () => {
    await fc.assert(
      fc.asyncProperty(seqArb, async (seq) => {
        const { lines, sent } = await run("json", seq);
        const reqs: Record<string, unknown>[] = [];
        for (const raw of lines) {
          const l = strip(raw);
          expect(l.includes("\n")).toBe(false);
          const v: unknown = JSON.parse(l);
          expect(typeof v === "object" && v !== null && !Array.isArray(v)).toBe(true);
          if (typeof v === "object" && v !== null && "kind" in v && v.kind === "req") {
            reqs.push(Object.fromEntries(Object.entries(v)));
          }
        }
        expect(reqs.length).toBe(sent.length);
        sent.forEach((c, i) => {
          expect(reqs[i]?.["method"]).toBe(c.method);
          expect(reqs[i]?.["path"]).toBe(c.path);
          expect(reqs[i]?.["status"]).toBe(c.status);
        });
      }),
      { seed: 1337, numRuns: 15 },
    );
  });

  it("In compact mode each `req` line has the form `GET /orders/7 orders.show 200 12ms`, one per request, in order", async () => {
    await fc.assert(
      fc.asyncProperty(seqArb, async (seq) => {
        const { lines, sent } = await run("compact", seq);
        const reqs = lines.map(strip).filter((l) => /^(GET|POST|PUT|PATCH|DELETE) \//.test(l));
        for (const l of lines) expect(strip(l).includes("\n")).toBe(false);
        expect(reqs.length).toBe(sent.length);
        sent.forEach((c, i) => {
          const m = /^(GET|POST|PUT|PATCH|DELETE) (\S+)(?: (\S+))? (\d{3}) (\d+)ms$/.exec(reqs[i] ?? "");
          expect(m).not.toBeNull();
          expect(m?.[1]).toBe(c.method);
          expect(m?.[2]).toBe(c.path);
          expect(m?.[4]).toBe(String(c.status));
          if (c.status === 200 || c.status === 303) expect(m?.[3]).toBe("orders.show");
        });
      }),
      { seed: 1337, numRuns: 15 },
    );
  });
});
