// Spec: k.cli Inspect and Rules E1056 (RFC 0020): `keel inspect [url]` fetches GET /__keel/inspect and prints one
// `inspect.store` record per store and a summary; an unreachable, non-2xx, or non-inspect target is E1056, exit 1.
// Driven through `run(['inspect', url], { fetch })` with an injected fetch. Seed 1337.
// Spec: k.cli, clause "`keel inspect` against an unreachable url emits E1056 and exits 1."
import { run } from "@keel/cli";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, lines, parseJsonLines } from "./fixtures";

const CWD = "/work/app";
const doc = (names: string[]) => ({
  live: true,
  graph: { nodes: [{ id: 1, kind: "scope" }], edges: [] },
  stores: Object.fromEntries(
    names.map((n) => [n, { state: { n: 1 }, log: [{ id: 1, name: `${n}.touch`, payload: {}, at: 1 }] }]),
  ),
  ids: {},
  a11y: {},
  routes: {},
});
const serving = (body: unknown, status = 200, seen: string[] = []) => ({
  cwd: CWD,
  fetch: (url: string): Promise<Response> => {
    seen.push(url);
    return Promise.resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
  },
});
const storeName = fc.stringMatching(/^[a-z]{3,6}\.[a-z]{3,6}$/);

describe("k.cli inspect client", () => {
  it("GETs <url>/__keel/inspect and prints one inspect.store record per store, then a summary last", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(storeName, { maxLength: 5 }), async (names) => {
        const seen: string[] = [];
        const r = await run(["inspect", "http://localhost:4000", "--format=json"], serving(doc(names), 200, seen));
        expect(seen).toEqual(["http://localhost:4000/__keel/inspect"]);
        expect(r.code).toBe(0);
        const recs = parseJsonLines(r.stdout);
        expect(recs.filter((x) => x.kind === "inspect.store").map((x) => x.id)).toEqual([...names].sort());
        expect(recs.at(-1)).toMatchObject({ kind: "summary", ok: true });
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("the default url is http://localhost:5173", async () => {
    const seen: string[] = [];
    await run(["inspect"], serving(doc([]), 200, seen));
    expect(seen).toEqual(["http://localhost:5173/__keel/inspect"]);
  });

  it("E1056 and exit 1 when the target is unreachable, not 2xx, or not an inspect document", async () => {
    const down = { cwd: CWD, fetch: (): Promise<Response> => Promise.reject(new TypeError("fetch failed")) };
    const runs = [
      await run(["inspect", "http://localhost:1", "--format=compact"], down),
      await run(["inspect", "--format=compact"], serving(doc([]), 404)),
      await run(["inspect", "--format=compact"], serving(doc([]), 500)),
      await run(["inspect", "--format=compact"], serving("<html>")),
      await run(["inspect", "--format=compact"], serving({ live: true })),
    ];
    for (const r of runs) {
      expect(r.code).toBe(1);
      expect(lines(r.stdout)[0]).toMatch(/^E1056 /);
    }
  });

  it("a reachable 2xx inspect document reports no E1056 (clean counterpart)", async () => {
    const r = await run(["inspect", "--format=compact"], serving(doc(["a.b"])));
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain("E1056");
  });
});
