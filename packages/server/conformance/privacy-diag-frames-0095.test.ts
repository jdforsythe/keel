// Spec: k.privacy, Conformance "An action throwing an `Error` whose stack names a file path holding a marked input value logs that frame with `[pii]` in place of the value."
// Seed: 1337.
// @vitest-environment happy-dom
// ASSUMED shape (k.server Log): `frames` is an array of strings in json mode. The stack is generated: an app frame whose
// file name holds the marked `note` value, which is lowercase letters (so no unmarked text can mimic it).
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Kind, Params, SEED, createApp, post } from "./fixtures.ts";

const Input = s.object({ kind: Kind, note: s.string().pii("content") });
const words = fc.stringMatching(/^[a-z]{12,20}$/);

async function framesFor(note: string, mode: "dev" | "production"): Promise<unknown> {
  const thrown = new Error("cannot save");
  thrown.stack = `Error: cannot save\n    at save (${process.cwd()}/modules/orders/${note}.server.ts:10:4)\n    at next (${process.cwd()}/modules/orders/other.ts:3:1)`;
  const save = action({ input: Input }, () => Promise.reject(thrown));
  const routes = manifest({
    "orders.show": { path: "/orders/:kind", params: Params, component: () => document.createElement("main") },
  });
  routes.actions({ "orders.show": { POST: save } });
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  await app.fetch(post("/orders/open", { kind: "open", note }, { accept: "application/json" }));
  const diags = lines
    .map((l): unknown => JSON.parse(l))
    .filter((r) => typeof r === "object" && r !== null && Reflect.get(r, "kind") === "diag");
  expect(diags.length).toBeGreaterThan(0);
  const first = diags[0];
  return typeof first === "object" && first !== null ? Reflect.get(first, "frames") : undefined;
}

describe("k.privacy: scrubbed diag frames", () => {
  for (const mode of ["dev", "production"] as const) {
    test(`an action throwing an Error whose stack names a file path holding a marked input value logs that frame with [pii] in place of the value, in ${mode}`, async () => {
      await fc.assert(
        fc.asyncProperty(words, async (note) => {
          const frames = await framesFor(note, mode);
          expect(frames).toEqual(["modules/orders/[pii].server.ts:10:4", "modules/orders/other.ts:3:1"]);
          expect(JSON.stringify(frames)).not.toContain(note);
        }),
        { seed: SEED, numRuns: 25 },
      );
    }, 120_000);
  }
});
