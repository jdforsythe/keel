// @vitest-environment happy-dom
// Spec: k.server, Conformance "A `log.write` that throws on the `req` record gives a 500 and one `keel.unexpected` `diag` naming the route id; one that always throws gives one fixed stderr line per process."
// Spec: k.server, Log "A throw past the handler's guards (a throwing `log.write`) is a bare 500 and one fixed `keel.unexpected` `diag` naming the matched route id, if any; if that write throws, one fixed stderr line, once per process. Neither holds a thrown or request value."
// Seed: 1337.
// The stderr line is once per process, so the always-throwing case is the first test of this file and the only one that reaches stderr. Its text and format are not in the spec; only its count is asserted.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SEED, createApp } from "./fixtures.ts";

const view = (): Node => document.createElement("main");
const Plain = s.object({ slug: s.string() });
const routes = () => manifest({ "app.plain": { path: "/plain/:slug", params: Plain, component: view } });
const get = (path: string) => new Request(`http://localhost${path}`, { headers: { accept: "application/json" } });

const isReq = (format: "compact" | "json", line: string): boolean => {
  if (format === "compact") return line.startsWith("GET ");
  const rec: unknown = JSON.parse(line);
  return typeof rec === "object" && rec !== null && Reflect.get(rec, "kind") === "req";
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("k.server last resort", () => {
  it("A `log.write` that always throws gives one fixed stderr line per process, two requests write one between them, and `fetch` never rejects.", async () => {
    const err = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: routes(),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
      log: {
        format: "compact",
        write: () => {
          throw new Error("sink-down-secret-text");
        },
      },
    });
    const first = await app.fetch(get("/plain/aaaa"));
    const second = await app.fetch(get("/plain/bbbb"));
    await first.text();
    await second.text();
    expect(first.status).toBe(500);
    expect(second.status).toBe(500);
    expect(err).toHaveBeenCalledTimes(1);
    const written = err.mock.calls.map((c) => String(c[0])).join("");
    expect(written.trim().split("\n")).toHaveLength(1);
    expect(written).not.toContain("sink-down-secret-text");
    expect(written).not.toContain("aaaa");
    expect(written).not.toContain("bbbb");
  });

  for (const mode of ["dev", "production"] as const)
    for (const format of ["compact", "json"] as const)
      it(`A \`log.write\` that throws on the \`req\` record gives a 500 and one \`keel.unexpected\` \`diag\` naming the route id and no request value, in ${mode}, ${format}.`, async () => {
        await fc.assert(
          fc.asyncProperty(fc.stringMatching(/^[a-z]{10,14}$/), async (slug) => {
            const lines: string[] = [];
            const app = await createApp({
              topology: topology({ web: { modules: ["app"], adapter: "node" } }),
              routes: routes(),
              ctx: createCtx({ mode: "sim", seed: SEED }),
              mode,
              log: {
                format,
                write: (l: string) => {
                  if (isReq(format, l)) throw new Error(`write failed ${slug}`);
                  lines.push(l);
                },
              },
            });
            const res = await app.fetch(get(`/plain/${slug}`));
            await res.text();
            expect(res.status).toBe(500);
            const diags = lines.filter((l) => l.includes("keel.unexpected"));
            expect(diags).toHaveLength(1);
            expect(diags[0]).toContain("app.plain");
            for (const l of lines) expect(l).not.toContain(slug);
          }),
          { seed: SEED, numRuns: 8 },
        );
      });
});
