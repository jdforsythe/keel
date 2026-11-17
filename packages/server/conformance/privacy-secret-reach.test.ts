import fs from "node:fs";
import path from "node:path";
// @vitest-environment happy-dom
// Spec: k.privacy, Sinks "So is the revealed value of each `Secret` made while the request runs (`bearer` too), by `[secret]`: each string or number in it, not a boolean."
// Spec: k.server, Log "`diag` per diagnostic or uncaught throw"
// Spec: k.privacy, Sinks "One made at startup or in a runner is not."
// Spec: k.privacy, Conformance "An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, as does a loader or action throwing one parsed after an `await`; a boolean secret logs as is; of two overlapping requests each marks only its own."
// Spec: k.privacy, Sinks "Past 2,000,000 characters of these values' written forms, the message and each frame are one mark, `[secret]` if the request made a secret."
// Seed: 1337.
// A `Secret` is made with `made(s.secret(s.string()).parse(text))` inside the handler, after an `await`: the scope that marks it follows the call chain of the request.
// The two-request case orders the requests on the sim clock (`ctx.clock.advance`), with no timers.
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { ok, reveal, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
  readonly artifacts?: string;
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
    ...(parts.artifacts ? { artifacts: parts.artifacts } : {}),
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  return { app, lines, ctx };
}
const json = { accept: "application/json" };

// Frames are relative to the folder holding `artifacts`: a scratch folder in the working directory.
let artifacts = "";
beforeAll(() => {
  artifacts = fs.mkdtempSync(path.join(process.cwd(), ".keel-secret-reach-artifacts-"));
});
afterAll(() => fs.rmSync(artifacts, { recursive: true, force: true }));

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

  for (const mode of modes) {
    it(`Each string or number in a \`Secret\` is marked (an object value: its string and its number, not its boolean), in ${mode}.`, async () => {
      const Obj = s.secret(s.object({ key: s.string(), n: s.int(), flag: s.boolean() }));
      const throwers = {
        string: (o: { key: string; n: number; flag: boolean }) => `obj key ${o.key} end`,
        number: (o: { key: string; n: number; flag: boolean }) => `obj n ${String(o.n)} end`,
        boolean: (o: { key: string; n: number; flag: boolean }) => `obj flag ${String(o.flag)} end`,
      };
      for (const [name, text] of Object.entries(throwers)) {
        const act = action({ input: Nothing }, async () => {
          await Promise.resolve();
          const o = reveal(made(Obj.parse({ key: "tok-obj-7f3a", n: 987654, flag: true })));
          throw new Error(text(o));
        });
        const t = await boot(mode, { act });
        await (await t.app.fetch(post("/a", {}, json))).text();
        const diags = diagsOf(t.lines);
        expect(diags.length, name).toBeGreaterThan(0);
        if (name === "boolean") {
          expect(diags.some((l) => l.includes("obj flag true end"))).toBe(true);
        } else {
          expect(diags.some((l) => l.includes("[secret]"))).toBe(true);
        }
        for (const line of t.lines) {
          if (name === "string") for (const form of forms("tok-obj-7f3a")) expect(line).not.toContain(form);
          if (name === "number") expect(line).not.toContain("987654");
        }
      }
    });

    it(`Each string in a \`Secret\` holding an array of strings is marked (an element in an Error message), in ${mode}.`, async () => {
      const Arr = s.secret(s.array(s.string()));
      const act = action({ input: Nothing }, async () => {
        await Promise.resolve();
        const list = reveal(made(Arr.parse(["first-3c9d1a", "second-6b2e8f"])));
        throw new Error(`list ${list.join(" and ")}`);
      });
      const t = await boot(mode, { act });
      await (await t.app.fetch(post("/a", {}, json))).text();
      expect(diagsOf(t.lines).some((l) => l.includes("[secret]"))).toBe(true);
      for (const line of t.lines) {
        for (const v of ["first-3c9d1a", "second-6b2e8f"])
          for (const form of forms(v)) expect(line).not.toContain(form);
      }
    });

    it(`The scrub never fails on a secret's text: a lone surrogate in a secret input still logs exactly one \`diag\` record and writes nothing to \`console.error\`, in ${mode}.`, async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        const act = action({ input: s.object({ v: s.secret(s.string()) }) }, async () => {
          await Promise.resolve();
          throw new Error("boom");
        });
        const t = await boot(mode, { act });
        const req = new Request("http://localhost/a", {
          method: "POST",
          headers: { ...json, "content-type": "application/json" },
          body: '{"v":"ab\\ud800cd"}',
        });
        await (await t.app.fetch(req)).text();
        expect(diagsOf(t.lines)).toHaveLength(1);
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it(`A secret is never left in part: with a second secret "1234" made in the request, no line holds a piece of "abcd-1234-9876", in ${mode}.`, async () => {
      const act = action({ input: Nothing }, async () => {
        await Promise.resolve();
        const whole = made(s.secret(s.string()).parse("abcd-1234-9876"));
        made(s.secret(s.string()).parse("1234"));
        throw new Error(`whole ${reveal(whole)}`);
      });
      const t = await boot(mode, { act });
      await (await t.app.fetch(post("/a", {}, json))).text();
      expect(diagsOf(t.lines).some((l) => l.includes("whole [secret]"))).toBe(true);
      for (const line of t.lines) {
        expect(line).not.toContain("abcd");
        expect(line).not.toContain("9876");
      }
    });

    it(`A secret is never left in part: with a personal-data input value "1234" inside the secret "abcd-1234-9876", no line holds a piece of the secret, in ${mode}.`, async () => {
      const act = action({ input: s.object({ code: s.string().pii("contact") }) }, async () => {
        await Promise.resolve();
        const whole = made(s.secret(s.string()).parse("abcd-1234-9876"));
        throw new Error(`whole ${reveal(whole)}`);
      });
      const t = await boot(mode, { act });
      await (await t.app.fetch(post("/a", { code: "1234" }, json))).text();
      expect(diagsOf(t.lines).length).toBeGreaterThan(0);
      for (const line of t.lines) {
        expect(line).not.toContain("abcd");
        expect(line).not.toContain("9876");
      }
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

  const manyKeys = (n: number): string[] => Array.from({ length: n }, (_, i) => `${"@".repeat(300)}${String(i)}`);
  const keysAction = action({ input: s.object({ keys: s.secret(s.array(s.string())) }) }, async (input) => {
    await Promise.resolve();
    const thrown = new Error(`refused ${String(reveal(input.keys)[0])}`);
    thrown.stack = `Error: ${thrown.message}\n    at save (${process.cwd()}/modules/app/save.server.ts:10:4)\n    at next (${process.cwd()}/modules/app/other.ts:3:1)`;
    throw thrown;
  });
  const sendKeys = (n: number): Request =>
    new Request("http://localhost/a", {
      method: "POST",
      headers: { ...json, "content-type": "application/json" },
      body: JSON.stringify({ keys: manyKeys(n) }),
    });
  const fieldOf = (line: string, name: string): unknown => {
    const rec: unknown = JSON.parse(line);
    return typeof rec === "object" && rec !== null ? Reflect.get(rec, name) : undefined;
  };
  const framesOf = (line: string): unknown[] => {
    const found = fieldOf(line, "frames");
    return Array.isArray(found) ? found : [];
  };

  for (const mode of modes) {
    it(`Past 2,000,000 characters of a secret's written forms, the \`diag\` message and each frame are one mark \`[secret]\` and no line holds the value, in ${mode}.`, async () => {
      const t = await boot(mode, { act: keysAction, artifacts });
      await (await t.app.fetch(sendKeys(2000))).text();
      const diags = diagsOf(t.lines);
      expect(diags).toHaveLength(1);
      for (const line of diags) {
        expect(fieldOf(line, "message")).toBe("[secret]");
        expect(framesOf(line)).toEqual(["[secret]", "[secret]"]);
      }
      for (const line of t.lines) expect(line).not.toContain("@@@@");
    }, 60_000);

    it(`Under 2,000,000 characters of a secret's written forms, the \`diag\` message is \`refused [secret]\` and the frames keep their file paths, in ${mode}.`, async () => {
      const t = await boot(mode, { act: keysAction, artifacts });
      await (await t.app.fetch(sendKeys(10))).text();
      const diags = diagsOf(t.lines);
      expect(diags).toHaveLength(1);
      for (const line of diags) {
        expect(String(fieldOf(line, "message"))).toContain("refused [secret]");
        const frames = framesOf(line);
        expect(frames).toEqual(["modules/app/save.server.ts:10:4", "modules/app/other.ts:3:1"]);
      }
      for (const line of t.lines) expect(line).not.toContain("@@@@");
    });
  }
});
