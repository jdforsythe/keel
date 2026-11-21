// @vitest-environment happy-dom
// Spec: k.serverlog, Conformance "A revealed secret of 8 bytes or more thrown JSON-escaped twice, `encodeURI`d, form-encoded, unpadded base64 and base64url logs `[secret]` in each place; a 2-character one inside a word logs as is."
// Spec: k.privacy, Sinks "Written forms: a value is marked as written; JSON-escaped, also with `\u` for each non-ASCII unit, and twice; `encodeURIComponent` once and twice, `encodeURI` and form-encoded (`+` for a space), none for a value with a lone surrogate; and as base64 of its UTF-8, padded, from 8 bytes also unpadded and URL-safe, found inside longer base64 from a byte offset that is a multiple of 3, to its end or for a multiple of 3 bytes. Letter case folds one code unit at a time; a form under 3 units is marked only as a whole token (no letter, digit, mark or `_` beside it). Overlapping matches are one mark."
// Seed: 1337.
// Each case runs in dev and production, in compact and json log formats; a json record is read through its parsed `message`.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { reveal, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp, post } from "./fixtures.ts";
import { made } from "./privacy-secret-reach-helper.ts";

const view = (): Node => document.createElement("main");
const modes = ["dev", "production"] as const;
const formats = ["compact", "json"] as const;
const Nothing = s.object({});

const bytes = (v: string): Uint8Array => new TextEncoder().encode(v);
const b64 = (v: string): string => btoa(String.fromCharCode(...bytes(v)));
const b64Of = (v: string): string => b64(v);
const unpadded = (v: string): string => b64Of(v).replace(/=+$/, "");
const b64url = (v: string): string => unpadded(v).replace(/\+/g, "-").replace(/\//g, "_");
const jsonEscaped = (v: string): string => JSON.stringify(v).slice(1, -1);
const form = (v: string): string => new URLSearchParams({ k: v }).toString().slice(2);

/** Throws `text(secret)` from an action that reveals `secret`; returns every logged line's readable text. */
async function logged(
  mode: (typeof modes)[number],
  format: (typeof formats)[number],
  secret: string,
  text: (revealed: string) => string,
): Promise<string[]> {
  const act = action({ input: Nothing }, async () => {
    await Promise.resolve();
    const key = made(s.secret(s.string()).parse(secret));
    throw new Error(text(reveal(key)));
  });
  const routes = manifest({ "app.a": { path: "/a", component: view } });
  routes.actions({ "app.a": { POST: act } });
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format, write: (l: string) => void lines.push(l) },
  });
  await (await app.fetch(post("/a", {}, { accept: "application/json" }))).text();
  return lines.map((l) => {
    if (format === "compact") return l;
    const rec: unknown = JSON.parse(l);
    const msg = typeof rec === "object" && rec !== null ? Reflect.get(rec, "message") : undefined;
    return typeof msg === "string" ? msg : l;
  });
}

const secretArb = fc.stringMatching(/^[A-Za-z0-9 "?>~é]{8,20}$/).filter((v) => bytes(v).length >= 8 && v.trim() === v);
const cases = modes.flatMap((m) => formats.map((f) => [m, f] as const));

const FORMS: ReadonlyArray<readonly [string, (v: string) => string]> = [
  ["JSON-escaped twice", (v) => jsonEscaped(jsonEscaped(v))],
  ["`encodeURI`d", (v) => encodeURI(v)],
  ["form-encoded", form],
  ["unpadded base64", unpadded],
  ["base64url", b64url],
];

describe("k.serverlog: a revealed secret of 8 bytes or more is marked in each written form", () => {
  for (const [mode, format] of cases)
    for (const [name, make] of FORMS)
      it(`a revealed secret thrown ${name} logs \`[secret]\` in its place, in ${mode} and ${format}`, async () => {
        await fc.assert(
          fc.asyncProperty(secretArb, async (secret) => {
            const written = make(secret);
            const out = await logged(mode, format, secret, () => `bad <${written}> end`);
            const diag = out.filter((l) => l.includes("end"));
            expect(diag.length).toBeGreaterThan(0);
            for (const l of out) expect(l).not.toContain(written);
            expect(diag.some((l) => l.includes("bad <[secret]> end"))).toBe(true);
          }),
          { seed: SEED, numRuns: 6 },
        );
      });

  for (const [mode, format] of cases) {
    it(`a 2-character secret inside a word logs as is, in ${mode} and ${format}`, async () => {
      const out = await logged(mode, format, "ab", () => "cabbage");
      expect(out.some((l) => l.includes("cabbage"))).toBe(true);
    });

    it(`a 2-character secret as a whole token is marked, in ${mode} and ${format}`, async () => {
      const out = await logged(mode, format, "ab", () => "x ab y");
      expect(out.some((l) => l.includes("x [secret] y"))).toBe(true);
    });
  }

  for (const [mode, format] of cases) {
    it(`an 11-character secret base64-encoded at byte offset 3 of a longer string logs \`[secret]\` there, in ${mode} and ${format}`, async () => {
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^[A-Za-z0-9]{11}$/), async (secret) => {
          const longer = b64Of(`abc${secret}`);
          const out = await logged(mode, format, secret, () => `t=${longer} end`);
          for (const l of out) expect(l).not.toContain(longer.slice(4));
          expect(out.some((l) => l.includes("[secret]"))).toBe(true);
        }),
        { seed: SEED, numRuns: 6 },
      );
    });

    it(`the same at offset 1 logs as is, in ${mode} and ${format}`, async () => {
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^[A-Za-z0-9]{11}$/), async (secret) => {
          const longer = b64Of(`a${secret}`);
          const out = await logged(mode, format, secret, () => `t=${longer} end`);
          expect(out.some((l) => l.includes(`t=${longer} end`))).toBe(true);
        }),
        { seed: SEED, numRuns: 6 },
      );
    });

    it(`the uppercase of a secret is marked, in ${mode} and ${format}`, async () => {
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^[a-z]{8,16}$/), async (secret) => {
          const out = await logged(mode, format, secret, (v) => `bad ${v.toUpperCase()} end`);
          for (const l of out) expect(l).not.toContain(secret.toUpperCase());
          expect(out.some((l) => l.includes("bad [secret] end"))).toBe(true);
        }),
        { seed: SEED, numRuns: 6 },
      );
    });

    it(`a secret with a lone surrogate has its JSON form marked, in ${mode} and ${format}`, async () => {
      const secret = "abcd\ud800efghij";
      const written = jsonEscaped(secret);
      const out = await logged(mode, format, secret, () => `bad ${written} end`);
      for (const l of out) expect(l).not.toContain(written);
      expect(out.some((l) => l.includes("bad [secret] end"))).toBe(true);
    });
  }
});
