// @vitest-environment happy-dom
// Spec: k.serverlog, Conformance "A thrown message holding a line feed, a carriage return, U+001B, U+0085, U+2028 and `…` logs one line per record in compact, with `\u000a`, `\u000d`, `\u001b`, `\u0085`, `\u2028` and `…` in their places; the parsed json message holds those texts." (the section's text holds the characters themselves where this line spells `\u2028` and `…`)
// Spec: k.serverlog, Parts "Escape. Each control character (U+0000 to U+001F, U+007F to U+009F), U+2028, U+2029 and `…` (U+2026) is written as `\u` and four lowercase hex digits, in compact and json alike; a parsed json value holds those six characters."
// Seed 1337 (fc.assert below).
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Params, SEED, createApp, post } from "./fixtures.ts";

type Mode = "dev" | "production";
type Format = "compact" | "json";
const modes: readonly Mode[] = ["dev", "production"];
const formats: readonly Format[] = ["compact", "json"];

const hex = (code: number): string => `\\u${code.toString(16).padStart(4, "0")}`;
const record = (line: string): ReadonlyMap<string, unknown> => {
  const v: unknown = JSON.parse(line);
  return new Map(typeof v === "object" && v !== null ? Object.entries(v) : []);
};
const isReq = (line: string): boolean => /^[A-Z]+ \//.test(line);
const isRaw = (code: number): boolean =>
  code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029 || code === 0x2026;

/** An app whose action throws the text most recently given to `run`. */
async function thrower(mode: Mode, format: Format) {
  const lines: string[] = [];
  let current = "";
  const save = action({ input: s.object({}) }, () => Promise.reject(new Error(current)));
  const routes = manifest({
    "orders.show": { path: "/orders/:kind", params: Params, component: () => document.createElement("main") },
  });
  routes.actions({ "orders.show": { POST: save } });
  const app = await createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format, write: (l: string) => void lines.push(l) },
  });
  return {
    async run(text: string): Promise<{ lines: string[]; message: string }> {
      lines.length = 0;
      current = text;
      await (await app.fetch(post("/orders/open", {}, { accept: "application/json" }))).text();
      const diags = lines.filter((l) => (format === "json" ? record(l).get("kind") === "diag" : !isReq(l)));
      expect(diags).toHaveLength(1);
      const [diag = ""] = diags;
      const message = format === "json" ? record(diag).get("message") : diag.slice(diag.indexOf(" ") + 1);
      return { lines: [...lines], message: typeof message === "string" ? message : "" };
    },
  };
}

describe("k.serverlog escape", () => {
  for (const mode of modes)
    for (const format of formats) {
      const where = `in ${mode}, ${format}`;
      const six = `a\nb\rc${String.fromCharCode(0x1b)}d${String.fromCharCode(0x85)}e${String.fromCharCode(0x2028)}f${String.fromCharCode(0x2026)}g`;
      const written = `a${hex(10)}b${hex(13)}c${hex(0x1b)}d${hex(0x85)}e${hex(0x2028)}f${hex(0x2026)}g`;
      it(`A thrown message holding a line feed, a carriage return, U+001B, U+0085, U+2028 and the ellipsis is written with their backslash-u forms, one line per record, ${where}.`, async () => {
        const t = await thrower(mode, format);
        const { lines, message } = await t.run(six);
        expect(message.endsWith(written)).toBe(true);
        for (const line of lines) for (const ch of line) expect(isRaw(ch.charCodeAt(0))).toBe(false);
        if (format === "json") for (const line of lines) JSON.parse(line);
      }, 30_000);

      it(`A thrown line break cannot produce a second line or a forged req record, ${where}.`, async () => {
        const t = await thrower(mode, format);
        const { lines } = await t.run("x\nGET /admin app.admin 200 1ms");
        const forged = lines.filter((l) => (format === "compact" ? isReq(l) : record(l).get("kind") === "req"));
        for (const line of forged) expect(line).not.toContain("/admin");
        for (const line of lines) expect(line).not.toMatch(/[\r\n]/);
        expect(lines.filter((l) => l.startsWith("GET /admin"))).toEqual([]);
      }, 30_000);

      it(`Each control character, U+2028, U+2029 and the ellipsis is written as a backslash-u form of four lowercase hex digits, ${where}.`, async () => {
        const t = await thrower(mode, format);
        const code = fc.oneof(
          fc.integer({ min: 0, max: 0x1f }),
          fc.integer({ min: 0x7f, max: 0x9f }),
          fc.constantFrom(0x2028, 0x2029, 0x2026),
        );
        await fc.assert(
          fc.asyncProperty(
            code,
            fc.stringMatching(/^[a-z]{1,6}$/),
            fc.stringMatching(/^[a-z]{1,6}$/),
            async (c, l, r) => {
              const { lines, message } = await t.run(`${l}${String.fromCharCode(c)}${r}`);
              expect(message.endsWith(`${l}${hex(c)}${r}`)).toBe(true);
              for (const line of lines) for (const ch of line) expect(isRaw(ch.charCodeAt(0))).toBe(false);
            },
          ),
          { seed: SEED, numRuns: 40 },
        );
      }, 60_000);
    }
});
