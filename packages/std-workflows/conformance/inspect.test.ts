import { ok } from "@keel/schema";
// Spec: std.workflows, Conformance "`workflows.instances` holds counts and no `data` value."
// Seed: 1337.
// Assumption: as for std.jobs `jobs.queue`, the dev `/__keel/inspect` body has `sections['workflows.instances']` as `{ doc, value }`; its value holds, per workflow, a number per state; the test finds the object holding a `queued` or `hidden` key.
// Assumption: a state with no instance may be absent or 0 in the counts.
import fc from "fast-check";
import { expect, test } from "vitest";
import { boot, close, hide, makeFlow, settle, sim, start } from "./fixtures.ts";

const idle = async () => ok({ freed: 0 });
const word = fc.stringMatching(/^[a-z]{12,20}$/);

function find(v: unknown, depth = 0): Record<string, unknown> | undefined {
  if (depth > 6 || typeof v !== "object" || v === null) return undefined;
  if (typeof Reflect.get(v, "queued") === "number" || typeof Reflect.get(v, "hidden") === "number") return Object(v);
  for (const k of Object.keys(v)) {
    const hit = find(Reflect.get(v, k), depth + 1);
    if (hit) return hit;
  }
  return undefined;
}

test.skip("`workflows.instances` holds counts and no `data` value.", async () => {
  await fc.assert(
    fc.asyncProperty(
      word,
      fc.integer({ min: 1, max: 3 }),
      fc.integer({ min: 0, max: 3 }),
      async (secret, queued, hidden) => {
        const ctx = sim();
        const f = makeFlow({ run: idle, ms: 600_000 });
        const app = await boot(ctx, f);
        for (let i = 0; i < queued; i++) await start(ctx, f, ctx.random.id("Flow"), { n: 1, freed: 0, code: secret });
        for (let i = 0; i < hidden; i++) {
          const id = ctx.random.id("Flow");
          await start(ctx, f, id, { n: 1, freed: 0, code: secret });
          await hide(ctx, f, id);
        }
        await settle();
        const res = await app.fetch(new Request("http://localhost/__keel/inspect"));
        const text = await res.text();
        expect(text).not.toContain(secret);
        const body: unknown = JSON.parse(text);
        const section = Reflect.get(Object(Reflect.get(Object(body), "sections")), "workflows.instances");
        const counts = find(section);
        expect(counts).toBeDefined();
        expect(counts?.queued ?? 0).toBe(queued);
        expect(counts?.hidden ?? 0).toBe(hidden);
        for (const v of Object.values(counts ?? {})) expect(typeof v).toBe("number");
        await close(app);
      },
    ),
    { seed: 1337, numRuns: 8 },
  );
});
