// @vitest-environment happy-dom
// Spec: k.privacy, Sinks "So is the revealed value of each `Secret` made while the request runs (`bearer` too), by `[secret]`: a string or a number, not a boolean."
// Spec: k.privacy, Sinks "One made at startup or in a runner is not."
// Spec: k.privacy, Conformance "An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, as does a loader or action throwing one parsed after an `await`; a boolean secret logs as is; of two overlapping requests each marks only its own."
// Seed: 1337.
// A `Secret` is made with `made(s.secret(s.string()).parse(text))` inside the handler, after an `await`: the scope that marks it follows the call chain of the request.
// The two-request case orders the requests on the sim clock (`ctx.clock.advance`), with no timers.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { ok, reveal, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp, get, post } from "./fixtures.ts";
import { made, mintLater } from "./privacy-secret-reach-helper.ts";
import { createAppLoose, flush } from "./topology-fixtures.ts";

const Nothing = s.object({});
const view = (): Node => document.createElement("main");
const STARTUP = made(s.secret(s.string()).parse("startup-8e2b4d"));
const KEY = "api-key-91c2e7d40b";
const TOKEN = "keelsim_0a1b2c3d4e5f6071_9f8e7d6c5b4a39281706f5e4d3c2b1a0";
const modes = ["dev", "production"] as const;

const forms = (v: string): string[] => [v, btoa(v), encodeURIComponent(v)];
const kind = (line: string): unknown => {
  const rec: unknown = JSON.parse(line);
  return typeof rec === "object" && rec !== null ? Reflect.get(rec, "kind") : undefined;
};
const diagsOf = (lines: readonly string[]): string[] => lines.filter((l) => kind(l) === "diag");

interface Parts {
  readonly loader?: ReturnType<typeof loader>;
  readonly act?: ReturnType<typeof action>;
}
async function boot(mode: "dev" | "production", parts: Parts, ctx = createCtx({ mode: "sim", seed: SEED })) {
  const routes = manifest({
    "app.a": { path: "/a", component: view, ...(parts.loader ? { loader: parts.loader } : {}) },
  });
  if (parts.act) routes.actions({ "app.a": { POST: parts.act } });
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode,
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  return { app, lines, ctx };
}
const json = { accept: "application/json" };

describe("k.privacy secret reach", () => {
  for (const mode of modes) {
    it(`A loader throwing the revealed value of a \`Secret\` parsed after an \`await\` logs a \`diag\` record holding \`[secret]\` and not the value, in ${mode}.`, async () => {
      const load = loader({ output: Nothing }, async () => {
        await Promise.resolve();
        const key = made(s.secret(s.string()).parse(KEY));
        throw new Error(`upstream refused ${reveal(key)}`);
      });
      const t = await boot(mode, { loader: load });
      await (await t.app.fetch(get("/a"))).text();
      const diags = diagsOf(t.lines);
      expect(diags.length).toBeGreaterThan(0);
      expect(diags.some((l) => l.includes("upstream refused [secret]"))).toBe(true);
      for (const line of t.lines) for (const form of forms(KEY)) expect(line).not.toContain(form);
    });

    it(`An action throwing the revealed value of a \`Secret\` minted after an \`await\` logs a \`diag\` record holding \`[secret]\` and not the value, in ${mode}; in dev the response body does not hold it either.`, async () => {
      const act = action({ input: Nothing }, async () => {
        await Promise.resolve();
        const token = made(s.secret(s.string()).parse(TOKEN));
        throw new Error(`mailer down; token ${reveal(token)}`);
      });
      const t = await boot(mode, { act });
      const res = await t.app.fetch(post("/a", {}, json));
      const body = await res.text();
      expect(diagsOf(t.lines).some((l) => l.includes("mailer down; token [secret]"))).toBe(true);
      for (const line of t.lines) for (const form of forms(TOKEN)) expect(line).not.toContain(form);
      if (mode === "dev") for (const form of forms(TOKEN)) expect(body).not.toContain(form);
    });

    it(`A \`Secret\` made by a helper in a second file, called after two \`await\`s, is marked in the \`diag\` record of the throw, in ${mode}.`, async () => {
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{12,20}$/), async (text) => {
          const act = action({ input: Nothing }, async () => {
            await Promise.resolve();
            await Promise.resolve();
            const minted = await mintLater(text);
            throw new Error(`helper ${reveal(minted)}`);
          });
          const t = await boot(mode, { act });
          await (await t.app.fetch(post("/a", {}, json))).text();
          expect(diagsOf(t.lines).some((l) => l.includes("helper [secret]"))).toBe(true);
          for (const line of t.lines) for (const form of forms(text)) expect(line).not.toContain(form);
        }),
        { seed: SEED, numRuns: 10 },
      );
    });
  }

  it('A boolean `Secret` logs as is: an action throwing `Error("flag " + String(reveal(flag)))` for `{ flag: true }` logs `flag true`.', async () => {
    const act = action({ input: s.object({ flag: s.secret(s.boolean()) }) }, async (input) => {
      await Promise.resolve();
      throw new Error(`flag ${String(reveal(input.flag))}`);
    });
    const t = await boot("production", { act });
    await (await t.app.fetch(post("/a", { flag: "true" }, json))).text();
    const diags = diagsOf(t.lines);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((l) => l.includes("Error: flag true"))).toBe(true);
    for (const line of diags) expect(line).not.toContain("flag [secret]");
  });

  it("A `Secret` number is marked: an action throwing the revealed value of a number secret logs `[secret]` and not the number.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 100000, max: 999999 }), async (n) => {
        const act = action({ input: Nothing }, async () => {
          await Promise.resolve();
          const minted = made(s.secret(s.number()).parse(n));
          throw new Error(`count ${String(reveal(minted))}`);
        });
        const t = await boot("production", { act });
        await (await t.app.fetch(post("/a", {}, json))).text();
        expect(diagsOf(t.lines).some((l) => l.includes("count [secret]"))).toBe(true);
        for (const line of t.lines) expect(line).not.toContain(String(n));
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("Of two overlapping requests each marks only its own: each line marks its own value and holds the other's as written.", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(fc.stringMatching(/^a[a-z0-9]{9,14}$/), fc.stringMatching(/^b[a-z0-9]{9,14}$/)),
        async ([alpha, bravo]) => {
          const ctx = createCtx({ mode: "sim", seed: SEED });
          const own = new Map([
            ["alpha", { value: alpha, other: bravo, first: 10, second: 40 }],
            ["bravo", { value: bravo, other: alpha, first: 20, second: 10 }],
          ]);
          const act = action({ input: s.object({ who: s.string() }) }, async (input) => {
            const mine = own.get(input.who);
            if (mine === undefined) return ok(null);
            await ctx.clock.after(mine.first);
            const minted = made(s.secret(s.string()).parse(mine.value));
            await ctx.clock.after(mine.second);
            throw new Error(`${input.who}: ${reveal(minted)} then ${mine.other}`);
          });
          const routes = manifest({ "app.a": { path: "/a", component: view } });
          routes.actions({ "app.a": { POST: act } });
          const lines: string[] = [];
          const app = await createAppLoose({
            topology: topology({ web: { modules: ["app"], adapter: "node" } }),
            routes,
            ctx,
            mode: "production",
            log: { format: "json", write: (l: string) => void lines.push(l) },
          });
          const both = Promise.all([
            app.fetch(post("/a", { who: "alpha" }, json)),
            app.fetch(post("/a", { who: "bravo" }, json)),
          ]);
          await flush();
          for (let i = 0; i < 6; i++) {
            ctx.clock.advance(10);
            await flush();
          }
          for (const res of await both) await res.text();
          const diags = diagsOf(lines);
          expect(diags.some((l) => l.includes(`alpha: [secret] then ${bravo}`))).toBe(true);
          expect(diags.some((l) => l.includes(`bravo: [secret] then ${alpha}`))).toBe(true);
          for (const l of diags) {
            if (l.includes("alpha:")) expect(l).not.toContain(`alpha: ${alpha}`);
            if (l.includes("bravo:")) expect(l).not.toContain(`bravo: ${bravo}`);
          }
        },
      ),
      { seed: SEED, numRuns: 5 },
    );
  }, 60_000);

  it("One made at startup is not marked: a `Secret` parsed at module scope and thrown revealed by an action is logged as written.", async () => {
    const act = action({ input: Nothing }, async () => {
      await Promise.resolve();
      throw new Error(`startup ${reveal(STARTUP)}`);
    });
    const t = await boot("production", { act });
    await (await t.app.fetch(post("/a", {}, json))).text();
    expect(diagsOf(t.lines).some((l) => l.includes("startup startup-8e2b4d"))).toBe(true);
  });

  it("One made in a runner is not marked: a runner that parses a `Secret` and rejects with its revealed value logs the `runner rejected` line holding it as written.", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const lines: string[] = [];
    const routes = manifest({ "app.a": { path: "/a", component: view } });
    const run = async (): Promise<void> => {
      await Promise.resolve();
      const minted = made(s.secret(s.string()).parse("runner-5d3c1f"));
      throw new Error(`runner ${reveal(minted)}`);
    };
    const app = await createAppLoose({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx,
      mode: "dev",
      log: { format: "json", write: (l: string) => void lines.push(l) },
      runners: { app: [{ run }] },
    });
    await flush();
    const diags = diagsOf(lines);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((l) => l.includes("runner runner-5d3c1f"))).toBe(true);
    await app.close?.();
  });
});
