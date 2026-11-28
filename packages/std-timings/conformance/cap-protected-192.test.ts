// std.timings, clause "A ctx keeps at most 256 names (rfc:0062). A call to a kept name is a repeat call. The protected names are the (at most) 192 kept names whose last call was a repeat call, latest first; the rest are unprotected. A name becomes unprotected at its first call, or when it drops out of the protected 192. A new name at the cap first evicts the name unprotected longest. So a kept name with `count` 2 or more is evicted only after 192 other names had a repeat call since its last call."
// Seed 1337
// @vitest-environment happy-dom
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import { time, timingsOf } from "@keel/std-timings";
import fc from "fast-check";
import { expect, test } from "vitest";

const appContract = contract("app", {
  "app.home": { path: "/" },
});

const routes = manifest(appContract, {
  "app.home": {
    component: () => {
      const e = document.createElement("main");
      e.append("home");
      return e;
    },
  },
});

async function droppedOf(ctx: ReturnType<typeof createCtx>): Promise<unknown> {
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
  });
  const res = await app.fetch(new Request("http://localhost/__keel/inspect"));
  const body: unknown = await res.json();
  const sections = Reflect.get(Object(body), "sections");
  const section = Reflect.get(Object(sections), "timings.recent");
  const value = Reflect.get(Object(section), "value");
  return Reflect.get(Object(value), "dropped");
}

const CAP = 256;
const PROTECTED = 192;

type Entry = { lastCall: number; lastWasRepeat: boolean; unprotectedSince: number; count: number };

// Declarative oracle: protected is recomputed from lastCall / lastWasRepeat at every step.
class Oracle {
  kept = new Map<string, Entry>();
  dropped = 0;
  step = 0;

  protectedSet(): Set<string> {
    const repeats = [...this.kept].filter(([, e]) => e.lastWasRepeat);
    repeats.sort((a, b) => b[1].lastCall - a[1].lastCall);
    return new Set(repeats.slice(0, PROTECTED).map(([n]) => n));
  }

  call(name: string): void {
    this.step += 1;
    const before = this.protectedSet();
    const entry = this.kept.get(name);
    if (entry !== undefined) {
      entry.count += 1;
      entry.lastCall = this.step;
      entry.lastWasRepeat = true;
    } else {
      if (this.kept.size >= CAP) {
        let victim: string | undefined;
        let since = Number.POSITIVE_INFINITY;
        for (const [n, e] of this.kept) {
          if (before.has(n)) continue;
          if (e.unprotectedSince < since) {
            since = e.unprotectedSince;
            victim = n;
          }
        }
        if (victim !== undefined) {
          this.kept.delete(victim);
          this.dropped += 1;
        }
      }
      this.kept.set(name, { lastCall: this.step, lastWasRepeat: false, unprotectedSince: this.step, count: 1 });
    }
    const after = this.protectedSet();
    for (const n of before) {
      const e = this.kept.get(n);
      if (e !== undefined && !after.has(n)) e.unprotectedSince = this.step;
    }
  }
}

async function check(names: readonly string[]): Promise<void> {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const oracle = new Oracle();
  for (const name of names) {
    await time(ctx, name, () => Promise.resolve(0));
    oracle.call(name);
  }
  const t = timingsOf(ctx);
  expect(Object.keys(t).sort()).toEqual([...oracle.kept.keys()].sort());
  expect(Object.keys(t).length).toBeLessThanOrEqual(CAP);
  for (const [name, e] of oracle.kept) expect(t[name]?.count).toBe(e.count);
  expect(await droppedOf(ctx)).toBe(oracle.dropped);
}

test("A ctx keeps at most 256 names; protected is the 192 latest repeat-called names; a new name at the cap evicts the name unprotected longest (oracle over any sequence)", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.nat({ max: 400 }), { maxLength: 1500 }), async (seq) => {
      await check(seq.map((i) => `n${i}`));
    }),
    { seed: 1337, numRuns: 15 },
  );
});

test("A name becomes unprotected when it drops out of the protected 192 (more than 192 repeated names, then a mix of singles and repeats)", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 193, max: 300 }),
      fc.array(fc.nat({ max: 500 }), { maxLength: 600 }),
      async (n, mix) => {
        const names: string[] = [];
        for (let i = 0; i < n; i++) names.push(`r${i}`, `r${i}`);
        for (const v of mix) names.push(v % 2 === 0 ? `s${v}` : `r${v % n}`);
        await check(names);
      },
    ),
    { seed: 1337, numRuns: 15 },
  );
});

test("A new name at the cap first evicts the name unprotected longest: 193 names called twice then 64 new names evicts r0 only", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  for (let i = 0; i < 193; i++) {
    await time(ctx, `r${i}`, () => Promise.resolve(0));
    await time(ctx, `r${i}`, () => Promise.resolve(0));
  }
  for (let i = 0; i < 64; i++) await time(ctx, `s${i}`, () => Promise.resolve(0));
  const t = timingsOf(ctx);
  expect(Object.keys(t)).toHaveLength(CAP);
  expect(t.r0).toBeUndefined();
  for (let i = 1; i < 193; i++) expect(t[`r${i}`]?.count).toBe(2);
  for (let i = 0; i < 64; i++) expect(t[`s${i}`]?.count).toBe(1);
  expect(await droppedOf(ctx)).toBe(1);
});
