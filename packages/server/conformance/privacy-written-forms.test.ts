// @vitest-environment happy-dom
// Spec: k.serverlog, Conformance "A revealed secret of 8 bytes or more thrown JSON-escaped twice, `encodeURI`d, form-encoded, unpadded base64 and base64url logs `[secret]` in each place; a 2-character one inside a word logs as is."
// Spec: k.privacy, Sinks "Copies: a value is marked wherever one of its forms stands in the text or in one of the text's two decoded views (Views). Its forms: the value as given, and its NFC and its NFD where they differ; from 8 bytes of UTF-8, the hex of those bytes; and base64 of them (Base64). A value with a lone surrogate has no hex or base64 form. Letter case folds one code unit at a time, in hex and base64 too, so a near copy may be over-marked. A form under 3 units is marked only as a whole token: no letter, digit, mark or `_` beside it in the view it was found in. Copies that overlap in the text are one mark over all of them, `[secret]` if any is a secret's."
// Spec: k.privacy, Sinks "Views: the decoded view of a text reads it once from the start, writing for each escape what it stands for and any other unit as is: a run of `%` and two hex digits (either case) as bytes, each well-formed UTF-8 sequence among them as its code point and any other byte as its three characters; `+` as a space, or in the second decoded view as `+`; `\u` and four hex digits as that unit; `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r` and `\t` as their characters; `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&apos;`, `&#` with 1 to 7 decimal digits and `;`, and `&#x` or `&#X` with 1 to 6 hex digits and `;`, as their character, a numeric one only for a code point up to U+10FFFF that is no surrogate. The text is read as is, as each of its two decoded views, as each of the two decoded views of each of those, and as a view of each family of escapes alone, any other unit as is, and as that family's view of that view: the `%` escapes with `+` (as a space, and as `+`), the backslash escapes, the entities. A copy found in a view marks the text it was decoded from, from the first character of the escape its first unit came from to the last character of the escape its last unit came from. So a copy under one or two escapings of these kinds, nested in any order, is found: URL-encoded by any encoder that writes `%` escapes, form-encoded, JSON-escaped with or without `\u` or `\/`, HTML-safe JSON, HTML entities, JSON in a URL; a `+` of the value is found whether an escaping wrote it as `%2B` or left it as is (`encodeURI`, JSON, HTML entities); and a value holding an escape of one family is found under one or two escapings of another family that leave it as is (`JSON.stringify` of `a"b%41`, once or twice; `encodeURI` of `x&amp;y z`)."
// Spec: k.privacy, Sinks "Base64: in the standard and the URL-safe alphabet. A value under 8 bytes is matched as its own padded encoding, whole. A value of 8 bytes or more is matched at each of the three byte alignments, alone or inside any longer encoding, as the characters whose six bits all come from its bytes; the mark takes in the character before and the character after that hold some of its bits, at that alignment, and the `=` padding after them. So a base64url JWT payload whose JSON holds the value as is holds a copy."
// Seed: 1337.
// Each case runs in dev and production, in compact and json log formats; a json record is read through its parsed `message`.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
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
  const appContract = contract("app", { "app.a": { path: "/a" } });
  const act = action(appContract, "app.a", { input: Nothing }, async () => {
    await Promise.resolve();
    const key = made(s.secret(s.string()).parse(secret));
    throw new Error(text(reveal(key)));
  });
  const routes = manifest(appContract, { "app.a": { component: view, POST: act } });
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

    it(`the same at offset 1 is marked too: a base64 copy is found at each of the three byte alignments, in ${mode} and ${format}`, async () => {
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^[A-Za-z0-9]{11}$/), async (secret) => {
          const longer = b64Of(`a${secret}`);
          const out = await logged(mode, format, secret, () => `t=${longer} end`);
          expect(out.some((l) => l.includes("[secret]"))).toBe(true);
          for (const l of out) expect(l).not.toContain(longer.slice(2, -2));
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
