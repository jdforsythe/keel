// @vitest-environment happy-dom
// Spec: k.data, clause "An API loader returning its capability's `err` `keel.unreachable`, `keel.conflict` or `keel.notFound` answers 502, 409 or 404; one returning `ok` of a value failing the entry's `output` answers 500 and, in dev, an E1554 `diag`."
// Seed: 1337. The capability is registered by the test through `@keel/ctx`'s `register` (the app-registered accessor of k.data); its sim side
// answers the planned `Result`, and the loader returns the accessor's answer as its own. A value the entry's `output` refuses is built through
// `Reflect.apply`, since the type refuses it.
// ASSUMPTION: a loader's `fn` gets `ctx` as its last argument (k.server API); the diag is one JSON line of the `log` sink with `kind: 'diag'`.
import { createCtx, register } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import type { KeelError, Result } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp } from "./fixtures.ts";

const Note = s.object({ title: s.string() });
const Errors = {
  "keel.unreachable": s.error("keel.unreachable", s.object({})),
  "keel.conflict": s.error("keel.conflict", s.object({})),
  "keel.notFound": s.error("keel.notFound", s.object({})),
};
const STATUS = { "keel.unreachable": 502, "keel.conflict": 409, "keel.notFound": 404 } as const;
type Code = keyof typeof STATUS;
const codes: readonly Code[] = ["keel.unreachable", "keel.conflict", "keel.notFound"];

type Answer = Result<unknown, KeelError<string, unknown>>;
interface NoteStore {
  read(): Promise<Answer>;
}
let n = 0;
async function boot(answer: () => Answer, mode: "dev" | "production") {
  const name = `notes.status${n++}`;
  const notes = register<NoteStore>(name, {
    real: () => ({ read: () => Promise.resolve(answer()) }),
    shell: () => ({ read: () => Promise.resolve(answer()) }),
    sim: () => ({ read: () => Promise.resolve(answer()) }),
  });
  const c = contract("notes", { "notes.get": { method: "GET", path: "/api/notes/one", output: Note } });
  // the capability's answer is of the store's wide `Result`; the loader's type is the entry's, so it is made untyped
  const get = Reflect.apply(loader, undefined, [
    c,
    "notes.get",
    {},
    (_args: unknown, ctx: Parameters<typeof notes>[0]) => notes(ctx).read(),
  ]);
  const routes = Reflect.apply(manifest, undefined, [c, { "notes.get": { loader: get } }]);
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["notes"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  const res = await app.fetch(
    new Request("http://localhost/api/notes/one", { headers: { accept: "application/json" } }),
  );
  return { res, lines };
}

describe("k.data: an expected failure of a capability answers through k.server's status table", () => {
  it("an API loader returning its capability's `err` `keel.unreachable`, `keel.conflict` or `keel.notFound` answers 502, 409 or 404", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...codes),
        fc.constantFrom<"dev" | "production">("dev", "production"),
        async (code, mode) => {
          const { res } = await boot(() => err(Errors[code].make({})), mode);
          expect(res.status).toBe(STATUS[code]);
          const body: unknown = await res.json();
          // k.api: a GET answers `{ id, results }`; the loader's `Result` sits at `results[id]`.
          const results = typeof body === "object" && body !== null ? Reflect.get(body, "results") : undefined;
          const entry = typeof results === "object" && results !== null ? Reflect.get(results, "notes.get") : undefined;
          const error = typeof entry === "object" && entry !== null ? Reflect.get(entry, "error") : undefined;
          expect(typeof error === "object" && error !== null ? Reflect.get(error, "code") : undefined).toBe(code);
        },
      ),
      { seed: SEED, numRuns: 12 },
    );
  });

  it("a loader returning `ok` of a value failing the entry's `output` answers 500, and in dev one E1554 `diag`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 9999 }), async (v) => {
        const dev = await boot(() => ok({ title: v }), "dev");
        expect(dev.res.status).toBe(500);
        expect(dev.lines.filter((l) => l.includes("E1554"))).toHaveLength(1);
        const prod = await boot(() => ok({ title: v }), "production");
        expect(prod.res.status).toBe(500);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  it("clean counterpart: a loader returning `ok` of a value its `output` accepts answers 200 with no E1554", async () => {
    const { res, lines } = await boot(() => ok({ title: "t" }), "dev");
    expect(res.status).toBe(200);
    expect(lines.filter((l) => l.includes("E1554"))).toEqual([]);
  });
});
