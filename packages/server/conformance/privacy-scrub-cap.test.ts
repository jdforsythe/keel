// @vitest-environment happy-dom
// k.privacy, Sinks "Cost: a scope counts the UTF-8 bytes of its distinct values, secret and `.pii()` together (a lone surrogate 3 bytes; an NFC or NFD form that differs counts as a value). Past 65,536 bytes, or once one `Secret` has more than 1,000,000 values to read (its value and each value, key, array and object inside it counted), its set takes no more values and every text of the scope is past the cap. Below it, the matcher is built in steps linear in the bytes of the set it is built for, built again only when the set has grown, and each text is read in steps linear in its length, each of its readings once; a text over 2,000,000 characters is not read (k.serverlog)."
// k.privacy, Sinks "Server log (k.server): in a `diag` record's message and `frames` and the `req` record's path, each of `piiValues` (k.schema) of the request's decoded action input, its loaders' and actions' outputs and its factories' store states becomes `[pii]`. Each string, number and key but a declared field name (not a boolean) in a `Secret` made or revealed while the request runs (`bearer` too) becomes `[secret]`. A runner's `run` is scoped alike. Past the cap (Cost), a message after its prefix (`loader <id> threw: `), each frame and the path are one mark, `[secret]` if the scope holds a secret, else `[pii]`; a message with no prefix is one mark whole. Each request and runner `run` takes the `onSecret` slot of `@keel/schema/internal` for the server's listener as it begins; each text of a scope during which a package cleared or replaced it is one mark as past the cap, `[secret]`, since its set may lack a secret."
// Spec: k.privacy, clause "An action whose input holds 8,192 distinct 8-character ASCII secret strings (65,536 bytes) and throws `bad ` and one of them logs a message ending `bad [secret]`; with 8,193 it logs `action <id> threw: [secret]` and the `req` path `[secret]`; so do 4,096 and 4,097 distinct strings of 8 letters from U+0430 to U+0438 (16 bytes each)."
// Seed: 1337.
// The cap counts the UTF-8 bytes of a scope's distinct values, secret and `.pii()` together. Each case runs in dev and production, in json log format; the log is read through its parsed `message` and `path`.
// A secret too large to post, one with a lone surrogate and one of more than 1,000,000 values are made inside the action, as the neighbouring secret-reach cases do.
import { fixedTime } from "@keel/tooling/test-time";
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { reveal, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp } from "./fixtures.ts";
import { made } from "./privacy-secret-reach-helper.ts";
import { type Logged, modes, readLog, type Mode } from "./privacy-scrub-support.ts";

const view = (): Node => document.createElement("main");
const appContract = contract("app", { "app.a": { path: "/a" } });
const Input = s.object({
  items: s.array(s.secret(s.string())).optional(),
  notes: s.array(s.string().pii("contact")).optional(),
});

const ascii = (i: number): string => String(i).padStart(8, "0");
/** Eight letters from U+0430 to U+0438 (16 bytes), the base-9 digits of `i`. */
const cyrillic = (i: number): string => {
  let out = "";
  let rest = i;
  for (let d = 0; d < 8; d++) {
    out = String.fromCodePoint(0x430 + (rest % 9)) + out;
    rest = Math.floor(rest / 9);
  }
  return out;
};
const many = (n: number, make: (i: number) => string): string[] => Array.from({ length: n }, (_, i) => make(i));

interface Case {
  readonly input: Record<string, unknown>;
  /** Makes the secret inside the action and returns the text thrown after `bad `; else the action throws its first input item. */
  readonly mint?: () => string;
}
async function serve(mode: Mode, c: Case): Promise<{ log: Logged; lines: string[] }> {
  const lines: string[] = [];
  const act = action(appContract, "app.a", { input: Input }, async (input) => {
    await Promise.resolve();
    if (c.mint !== undefined) throw new Error(`bad ${c.mint()}`);
    const first = input.items?.[0];
    throw new Error(`bad ${first === undefined ? "" : reveal(first)}`);
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.a": { component: view, POST: act } }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  const res = await app.fetch(
    new Request("http://localhost/a", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(c.input),
    }),
  );
  await res.text();
  return { log: readLog(lines), lines };
}
const PAST = "action app.a threw: [secret]";

/** `values` with the pick first: the action throws the first item. */
const rotate = (values: string[], at: number): string[] => [...values.slice(at), ...values.slice(0, at)];

for (const mode of modes) {
  describe(`k.privacy Cost: a byte cap on the distinct values of a scope, in ${mode}`, () => {
    for (const [name, make, atCap] of [
      ["8-character ASCII", ascii, 8_192],
      ["8-letter U+0430 to U+0438", cyrillic, 4_096],
    ] as const) {
      it(`An action whose input holds ${String(atCap)} distinct ${name} secret strings and throws \`bad \` and one of them logs a message ending \`bad [secret]\`.`, async () => {
        await fc.assert(
          fc.asyncProperty(fc.integer({ min: 0, max: atCap - 1 }), async (at) => {
            const values = rotate(many(atCap, make), at);
            const { log, lines } = await serve(mode, { input: { items: values } });
            expect(log.messages).toHaveLength(1);
            expect(log.messages[0]?.endsWith("bad [secret]")).toBe(true);
            for (const line of lines) expect(line).not.toContain(values[0] ?? "");
          }),
          { seed: SEED, numRuns: 3 },
        );
      });

      it(`With ${String(atCap + 1)} distinct ${name} secret strings it logs \`action <id> threw: [secret]\` and the \`req\` path \`[secret]\`.`, async () => {
        await fc.assert(
          fc.asyncProperty(fc.integer({ min: 0, max: atCap }), async (at) => {
            const values = rotate(many(atCap + 1, make), at);
            const { log, lines } = await serve(mode, { input: { items: values } });
            expect(log.messages).toEqual([PAST]);
            expect(log.path).toBe("[secret]");
            expect(log.frames.every((f) => f === "[secret]")).toBe(true);
            for (const line of lines) expect(line).not.toContain(values[0] ?? "");
          }),
          { seed: SEED, numRuns: 3 },
        );
      });
    }

    it("Distinct values only: the same 8,192 strings each sent twice stay under the cap and log `bad [secret]`.", async () => {
      const once = many(8_192, ascii);
      const { log } = await serve(mode, { input: { items: [...once, ...once] } });
      expect(log.messages[0]?.endsWith("bad [secret]")).toBe(true);
    });

    it("Secret and `.pii()` values count together: 4,096 distinct secret strings and 4,096 distinct `.pii()` strings of 8 characters (65,536 bytes) log `bad [secret]`, and with one more `.pii()` string the message is `action <id> threw: [secret]`.", async () => {
      const secrets = many(4_096, ascii);
      const notes = many(4_097, (i) => `n${String(i).padStart(7, "0")}`);
      const under = await serve(mode, { input: { items: secrets, notes: notes.slice(0, 4_096) } });
      expect(under.log.messages[0]?.endsWith("bad [secret]")).toBe(true);
      const over = await serve(mode, { input: { items: secrets, notes } });
      expect(over.log.messages).toEqual([PAST]);
      expect(over.log.path).toBe("[secret]");
    });

    it("Past the cap with `.pii()` values and no secret, the message after its prefix and the path are one mark `[pii]`.", async () => {
      const notes = many(8_193, (i) => `n${String(i).padStart(7, "0")}`);
      const act = action(appContract, "app.a", { input: Input }, async (input) => {
        await Promise.resolve();
        throw new Error(`bad ${input.notes?.[0] ?? ""}`);
      });
      const lines: string[] = [];
      const app = await createApp({
        topology: topology({ web: { modules: ["app"], adapter: "node" } }),
        routes: manifest(appContract, { "app.a": { component: view, POST: act } }),
        ctx: createCtx({ mode: "sim", seed: SEED }),
        mode,
        log: { format: "json", write: (l: string) => void lines.push(l) },
      });
      await (
        await app.fetch(
          new Request("http://localhost/a", {
            method: "POST",
            headers: { accept: "application/json", "content-type": "application/json" },
            body: JSON.stringify({ notes }),
          }),
        )
      ).text();
      const log = readLog(lines);
      expect(log.messages).toEqual(["action app.a threw: [pii]"]);
      expect(log.path).toBe("[pii]");
    });

    it("A lone surrogate counts 3 bytes: 6,553 distinct strings of a lone surrogate and 7 digits (65,530 bytes) log `bad [secret]`, and 6,554 (65,540) log `action <id> threw: [secret]`.", async () => {
      const lone = (n: number): string[] => many(n, (i) => `\ud800${String(i).padStart(7, "0")}`);
      const run = (n: number) =>
        serve(mode, {
          input: {},
          mint: () => {
            const all = made(s.secret(s.array(s.string())).parse(lone(n)));
            return reveal(all)[0] ?? "";
          },
        });
      expect((await run(6_553)).log.messages[0]?.endsWith("bad [secret]")).toBe(true);
      expect((await run(6_554)).log.messages).toEqual([PAST]);
    });

    it("An NFC or NFD form that differs counts as a value: 3,449 distinct strings of `é` and 7 digits (9 bytes, with 10 bytes of NFD: 65,531) log `bad [secret]`, and 3,450 (65,550) log `action <id> threw: [secret]`.", async () => {
      const accented = (n: number): string[] => many(n, (i) => `é${String(i).padStart(7, "0")}`);
      const run = (n: number) =>
        serve(mode, {
          input: {},
          mint: () => {
            const all = made(s.secret(s.array(s.string())).parse(accented(n)));
            return reveal(all)[0] ?? "";
          },
        });
      expect((await run(3_449)).log.messages[0]?.endsWith("bad [secret]")).toBe(true);
      expect((await run(3_450)).log.messages).toEqual([PAST]);
    });
  });
}

describe("k.privacy Cost: once one `Secret` has more than 1,000,000 values to read", () => {
  // The value and each value, key, array and object inside it are counted: an array of n strings is n + 1 values.
  const same = (n: number): string[] => new Array<string>(n).fill("abcdefgh");
  const run = (n: number) =>
    serve("production", { input: {}, mint: () => reveal(made(s.secret(s.array(s.string())).parse(same(n))))[0] ?? "" });
  const nested = (n: number) =>
    serve("production", {
      input: {},
      mint: () => reveal(made(s.secret(s.array(s.array(s.string()))).parse([same(n)])))[0]?.[0] ?? "",
    });

  it(
    "A `Secret` of 1,000,000 values (the array and 999,999 strings, one distinct string) is read: the message ends `bad [secret]`.",
    async () => {
      expect((await run(999_999)).log.messages[0]?.endsWith("bad [secret]")).toBe(true);
    },
    fixedTime(60_000),
  );

  it(
    "A `Secret` of 1,000,001 values (the array and 1,000,000 strings, one distinct string) is past the cap: `action <id> threw: [secret]` and the `req` path `[secret]`.",
    async () => {
      const out = await run(1_000_000);
      expect(out.log.messages).toEqual([PAST]);
      expect(out.log.path).toBe("[secret]");
    },
    fixedTime(60_000),
  );

  it(
    "A `Secret` counts each array inside it: an array of an array of 999,998 strings (1,000,000 values) is read, and of 999,999 (1,000,001) is past the cap.",
    async () => {
      expect((await nested(999_998)).log.messages[0]?.endsWith("bad [secret]")).toBe(true);
      expect((await nested(999_999)).log.messages).toEqual([PAST]);
    },
    fixedTime(60_000),
  );
});
