// @vitest-environment happy-dom
// Spec: k.serverlog, Conformance "With a revealed 64-character secret in a thrown message at each offset that puts the 2,048th written character inside it, no logged line holds 8 consecutive characters of the secret, in compact and json."
// Seed 1337 (fc.assert below). The secret is 64 characters of A-Z and 0-9; the prefix before it is lowercase ASCII, a double quote or U+0001 (six written characters), padded with `x` so the cut falls after `kept` characters of the secret, `kept` from 1 to 63.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { reveal, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Params, SEED, createApp, post } from "./fixtures.ts";

type Mode = "dev" | "production";
type Format = "compact" | "json";
const modes: readonly Mode[] = ["dev", "production"];
const formats: readonly Format[] = ["compact", "json"];

const record = (line: string): ReadonlyMap<string, unknown> => {
  const v: unknown = JSON.parse(line);
  return new Map(typeof v === "object" && v !== null ? Object.entries(v) : []);
};
const isReq = (line: string): boolean => /^[A-Z]+ \//.test(line);
const width = (ch: string): number => (ch === "\u0001" ? 6 : 1);

async function boot(mode: Mode, format: Format) {
  const lines: string[] = [];
  let prefix = "";
  let showSecret = true;
  const orders = contract("orders", {
    "orders.show": { path: "/orders/:kind", params: Params },
  });

  const save = action(orders, "orders.show", { input: s.object({ k: s.secret(s.string()) }) }, (input) =>
    Promise.reject(new Error(`${prefix}${showSecret ? reveal(input.k) : ""}`)),
  );
  const routes = manifest(orders, {
    "orders.show": { component: () => document.createElement("main"), POST: save },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format, write: (l: string) => void lines.push(l) },
  });
  return {
    lines,
    async run(text: string, secret: string, reveals: boolean): Promise<void> {
      lines.length = 0;
      prefix = text;
      showSecret = reveals;
      await (await app.fetch(post("/orders/open", { k: secret }, { accept: "application/json" }))).text();
    },
    /** The written length of what the server puts before the thrown text, from a throw that holds no secret. */
    async lead(): Promise<number> {
      await this.run("ZZZ", "Q".repeat(64), false);
      const diag = lines.find((l) => (format === "json" ? record(l).get("kind") === "diag" : !isReq(l))) ?? "";
      const message = format === "json" ? record(diag).get("message") : diag.slice(diag.indexOf(" ") + 1);
      return (typeof message === "string" ? message.length : 0) - 3;
    },
  };
}

describe("k.serverlog cut and scrub", () => {
  for (const mode of modes)
    for (const format of formats)
      it(`No logged line holds 8 consecutive characters of a revealed 64-character secret at each offset that puts the 2,048th written character inside it, in ${mode}, ${format}.`, async () => {
        const t = await boot(mode, format);
        const lead = await t.lead();
        expect(lead).toBeGreaterThan(0);
        const units = fc.array(fc.constantFrom("b", "k", '"', "\u0001"), { maxLength: 60 });
        await fc.assert(
          fc.asyncProperty(
            fc.stringMatching(/^[A-Z0-9]{64}$/),
            fc.integer({ min: 1, max: 63 }),
            units,
            async (secret, kept, chars) => {
              const used = chars.reduce((n, ch) => n + width(ch), 0);
              const pad = 2_048 - lead - kept - used;
              expect(pad).toBeGreaterThan(0);
              await t.run(`${chars.join("")}${"x".repeat(pad)}`, secret, true);
              expect(t.lines.length).toBeGreaterThan(0);
              for (const line of t.lines)
                for (let i = 0; i + 8 <= secret.length; i++) expect(line).not.toContain(secret.slice(i, i + 8));
            },
          ),
          { seed: SEED, numRuns: 25 },
        );
      }, 90_000);
});
