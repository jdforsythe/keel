// @vitest-environment happy-dom
// The CSP window's per-source cap (k.security Reports): over generated sequences of reports from a few sources and none,
// each source logs at most 10, the window at most 100, logged + dropped is every report sent, and no line holds a
// source. reportSource: the last x-forwarded-for entry, else the node peer address. Seed 1337.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { reportSource } from "../src/internal/reportSource.ts";

const SEED = 1337;
const SOURCES = ["198.51.100.1", "198.51.100.2", "198.51.100.3", "2001:db8::7"];
const body = JSON.stringify({
  "csp-report": { "document-uri": "http://localhost/", "violated-directive": "img-src", "blocked-uri": "inline" },
});
const cspCount = (lines: readonly string[]): number =>
  lines.filter((l) => l.includes('"kind":"csp"') && !l.includes('"dropped"')).length;
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("CSP per-source cap", () => {
  it("logs at most 10 per source and 100 in all, counts the rest, and logs no source", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.option(fc.constantFrom(...SOURCES), { nil: undefined }), { maxLength: 160 }),
        async (from) => {
          const lines: string[] = [];
          const ctx = createCtx({ mode: "sim", seed: SEED });
          const app = await createApp({
            topology: topology({ web: { modules: ["app"], adapter: "node" } }),
            routes: manifest({ "app.home": { path: "/", component: () => document.createElement("main") } }),
            ctx,
            mode: "production",
            log: { format: "json", write: (l) => lines.push(l) },
          });
          const per = new Map<string | undefined, number>();
          let logged = 0;
          for (const f of from) {
            const headers: Record<string, string> = { "content-type": "application/csp-report" };
            if (f !== undefined) headers["x-forwarded-for"] = `203.0.113.5, ${f}`;
            const before = cspCount(lines);
            await app.fetch(new Request("http://localhost/__keel/csp", { method: "POST", body, headers }));
            const took = cspCount(lines) - before;
            logged += took;
            per.set(f, (per.get(f) ?? 0) + took);
          }
          for (const [f, n] of per) if (f !== undefined) expect(n).toBeLessThanOrEqual(10);
          expect(logged).toBeLessThanOrEqual(100);
          ctx.clock.advance(60_000);
          await flush();
          const dropped = lines
            .map((l): unknown => JSON.parse(l))
            .flatMap((r) => {
              const d = typeof r === "object" && r !== null ? Reflect.get(r, "dropped") : undefined;
              return typeof d === "number" ? [d] : [];
            });
          expect(logged + (dropped[0] ?? 0)).toBe(from.length);
          for (const l of lines) for (const s of [...SOURCES, "203.0.113.5"]) expect(l).not.toContain(s);
          await app.close();
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  }, 60_000);
});

describe("reportSource", () => {
  const req = (xff?: string): Request =>
    new Request("http://localhost/__keel/csp", xff === undefined ? {} : { headers: { "x-forwarded-for": xff } });
  const env = { incoming: { socket: { remoteAddress: "192.0.2.50" } } };

  it("is the last x-forwarded-for entry, else the peer address, else undefined", () => {
    expect(reportSource(req("203.0.113.9, 192.0.2.1"), env)).toBe("192.0.2.1");
    expect(reportSource(req(" 192.0.2.3 "), undefined)).toBe("192.0.2.3");
    expect(reportSource(req("192.0.2.1, "), env)).toBe("192.0.2.50");
    expect(reportSource(req(), env)).toBe("192.0.2.50");
    expect(reportSource(req(), { incoming: { socket: {} } })).toBeUndefined();
    expect(reportSource(req(), undefined)).toBeUndefined();
  });
});
