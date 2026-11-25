// @vitest-environment node
// k.privacy Server log: a `Secret` too large to read whole (its read is cut at 1,000,000 values) puts its scope's set
// past its cap, so the values left unread cannot reach the log: every thrown text of the scope is one `[secret]` mark.
// Seed 1337.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { noteRequestSecrets } from "../src/internal/noteRequestSecrets.ts";
import { pastCap } from "../src/internal/pastCap.ts";
import { requestSecrets } from "../src/internal/requestSecrets.ts";

// One array of 1,000,000 items is 1,000,001 values: the read is cut at its last item. Every item is one value, so the
// set itself stays small.
const huge = (): number[] => Array.from({ length: 1_000_000 }, () => 0);
const Huge = s.secret(s.array(s.int()));
// Each value a parse reads is judged, copied, frozen and read for the scope's set: about 0.25 us here, so 5 us a value
// bounds the work with a margin of twenty. A parse of `huge()` reads 1,000,001 values.
const VALUE_MS = 0.005;
const PARSE_MS = 1_000_001 * VALUE_MS;

describe("a secret whose read is cut", () => {
  it("puts the scope's set past its cap", { timeout: 2 * PARSE_MS }, () => {
    noteRequestSecrets();
    const set = new Set<string>();
    requestSecrets.run(set, () => Huge.parse(huge()));
    expect(pastCap.has(set)).toBe(true);
    const small = new Set<string>();
    requestSecrets.run(small, () => Huge.parse(huge().slice(1)));
    expect(pastCap.has(small)).toBe(false);
  });

  it("an action that makes one and throws logs its message as one mark", { timeout: PARSE_MS }, async () => {
    const lines: string[] = [];
    const c = contract("app", { "app.a": { path: "/a" } });
    const routes = manifest(c, {
      "app.a": {
        component: () => document.createElement("main"),
        POST: action(c, "app.a", { input: s.object({}) }, async () => {
          Huge.parse(huge());
          throw new Error("refused 7");
        }),
      },
    });
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      mode: "production",
      log: { format: "json", write: (l) => lines.push(l) },
    });
    const res = await app.fetch(
      new Request("http://localhost/a", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json", accept: "application/json" },
      }),
    );
    await res.text();
    const messages = lines
      .map((l): { code: string; message: string } => JSON.parse(l))
      .filter((d) => d.code === "keel.unexpected")
      .map((d) => d.message);
    expect(messages).toEqual(["action app.a threw: [secret]"]);
    for (const l of lines) expect(l).not.toContain("refused 7");
  });
});
