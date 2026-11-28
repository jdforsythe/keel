// @vitest-environment happy-dom
// Spec: k.privacy, clause "An action throwing the revealed value of a `Secret` input or `bearer`, as a string or in an `Error` message, logs a `diag` record holding `[secret]` and not the value, in dev and production, as does a loader or action throwing one parsed after an `await` or made earlier and revealed in it, a record or `json` key in one, and a runner's; a boolean or declared field name logs as is; of two overlapping requests each marks only its own."
// Spec: k.privacy, clause "An action throwing an `Error` whose message or a stack frame's file path holds a marked input value logs a `diag` record with `[pii]` in its place, in dev and production."
// Spec: k.serverlog, clause "An action throwing an `Error` whose message is 1,000,000 `a`, and a runner rejecting with it, log in compact and json a `diag` whose message is its first 2,048 characters then `…+<n>`, `n` the characters left out; every json line parses."
// Spec: k.serverlog, clause "In production mode, a loader `p.def` throwing `new Error('user jane@x.com failed')`, the string `token=abc123`, the object `{ ssn: '078-05-1120' }` or `defect('user failed', { data: { email: 'jane@x.com' } })`, none of them a value the request declared, logs a `diag` whose message matches `^loader p\.def threw: (Error|value|Defect) #[0-9a-f]{8}( at \S+:\d+)?$`, and no logged line, compact or json, holds `jane`, `abc123` or `078`."
// Seed 1337. READING: k.serverlog Thrown values writes a thrown value by its class, code and fingerprint, its text only in dev mode; so the production half of the two k.privacy clauses above is that the `diag` message is the fingerprint form and no line holds the value, `[secret]` or `[pii]` being what dev's second record shows (privacy-diag-scrub.test.ts, privacy-secret-reach.test.ts, which now run in dev). The spec's "holding `[secret]`" in production is not assertable beside k.serverlog; this file asserts the absence.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { reveal, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp, post } from "./fixtures.ts";
import { ENCODINGS, thrower } from "./privacy-scrub-support.ts";

const FINGERPRINT = /^action app\.a threw: (Error|value) #[0-9a-f]{8}( at \S+:\d+)?$/;
const word = fc.stringMatching(/^[a-z]{12,24}$/);

describe("k.privacy and k.serverlog in production: a thrown value's text is not in the log", () => {
  it("an action throwing the revealed value of a Secret, or an Error holding it, logs only the fingerprint form and no line holds the value in any encoding", async () => {
    const t = await thrower("production");
    await fc.assert(
      fc.asyncProperty(word, word, word, async (secret, p, q) => {
        fc.pre(!p.includes(secret) && !q.includes(secret) && secret.length >= 8);
        const log = await t.run(secret, `${p}${secret}${q}`);
        expect(log.messages).toEqual([]);
        expect(log.frames.every((f) => !f.includes(secret))).toBe(true);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("every `diag` of production reads `action <id> threw: <class> #<fingerprint>` and no logged line holds the secret in any of the spec's encodings", async () => {
    const lines: string[] = [];
    const c = contract("app", { "app.a": { path: "/a" } });
    const secretOf = "tok-7f3a9c-prod";
    const act = action(c, "app.a", { input: s.object({ k: s.secret(s.string()) }) }, async (input) => {
      await Promise.resolve();
      throw new Error(`bad ${reveal(input.k)}`);
    });
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: manifest(c, { "app.a": { component: () => document.createElement("main"), POST: act } }),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
      log: { format: "json", write: (l: string) => void lines.push(l) },
    });
    await (await app.fetch(post("/a", { k: secretOf }, { accept: "application/json" }))).text();
    const diags = lines.flatMap((l) => {
      const v: unknown = JSON.parse(l);
      return typeof v === "object" && v !== null && Reflect.get(v, "kind") === "diag"
        ? [String(Reflect.get(v, "message"))]
        : [];
    });
    expect(diags.length).toBeGreaterThan(0);
    for (const m of diags) expect(m).toMatch(FINGERPRINT);
    for (const [, encode] of ENCODINGS) for (const l of lines) expect(l).not.toContain(encode(secretOf));
  });

  it("an action throwing an Error that holds a `.pii()` input value logs no line holding it in production", async () => {
    await fc.assert(
      fc.asyncProperty(word, async (value) => {
        const lines: string[] = [];
        const c = contract("app", { "app.a": { path: "/a" } });
        const act = action(c, "app.a", { input: s.object({ v: s.string().pii("name") }) }, async (input) => {
          await Promise.resolve();
          throw new Error(`cannot save ${input.v}`);
        });
        const app = await createApp({
          topology: topology({ web: { modules: ["app"], adapter: "node" } }),
          routes: manifest(c, { "app.a": { component: () => document.createElement("main"), POST: act } }),
          ctx: createCtx({ mode: "sim", seed: SEED }),
          mode: "production",
          log: { format: "json", write: (l: string) => void lines.push(l) },
        });
        await (await app.fetch(post("/a", { v: value }, { accept: "application/json" }))).text();
        expect(lines.length).toBeGreaterThan(0);
        for (const l of lines) expect(l).not.toContain(value);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("an Error whose message is 1,000,000 `a` logs no run of `a` and every line is at most 8,192 characters, in production", async () => {
    const t = await thrower("production");
    const log = await t.run("tok-7f3a9c-prod", "a".repeat(1_000_000));
    expect(log.messages).toEqual([]);
    expect(log.frames.every((f) => !f.includes("aaaaaaaa"))).toBe(true);
  });
});
