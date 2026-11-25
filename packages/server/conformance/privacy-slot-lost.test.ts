// @vitest-environment happy-dom
// k.privacy, Sinks "Server log (k.server): in a `diag` record's message and `frames` and the `req` record's path, each of `piiValues` (k.schema) of the request's decoded action input, its loaders' and actions' outputs and its factories' store states becomes `[pii]`. Each string, number and key but a declared field name (not a boolean) in a `Secret` made or revealed while the request runs (`bearer` too) becomes `[secret]`. A runner's `run` is scoped alike. Past the cap (Cost), a message after its prefix (`loader <id> threw: `), each frame and the path are one mark, `[secret]` if the scope holds a secret, else `[pii]`; a message with no prefix is one mark whole. Each request and runner `run` takes the `onSecret` slot of `@keel/schema/internal` for the server's listener as it begins; each text of a scope during which a package cleared or replaced it is one mark as past the cap, `[secret]`, since its set may lack a secret."
// Spec: k.privacy, clause "An action that calls `onSecret(() => {})` from `@keel/schema/internal`, then reveals its `Secret` input and throws `bad ` and its value, logs `action <id> threw: [secret]` and the `req` path `[secret]`; a request after it that calls nothing logs its thrown secret as `bad [secret]`."
// Seed: 1337.
// One app, one action: its `lose` field decides whether it clears the slot before it reveals. The slot is process-wide, so each request must take it back as it begins; the order of the two requests is the case.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { reveal, s } from "@keel/schema";
import { onSecret } from "@keel/schema/internal";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, createApp } from "./fixtures.ts";
import { modes, readLog, type Mode } from "./privacy-scrub-support.ts";

const view = (): Node => document.createElement("main");
const appContract = contract("app", { "app.a": { path: "/a" } });

async function boot(mode: Mode) {
  const lines: string[] = [];
  const act = action(
    appContract,
    "app.a",
    { input: s.object({ lose: s.boolean(), token: s.secret(s.string()) }) },
    async (input) => {
      await Promise.resolve();
      if (input.lose) onSecret(() => {});
      throw new Error(`bad ${reveal(input.token)}`);
    },
  );
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.a": { component: view, POST: act } }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  return {
    async send(lose: boolean, token: string) {
      lines.length = 0;
      const res = await app.fetch(
        new Request("http://localhost/a", {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ lose, token }),
        }),
      );
      await res.text();
      return { log: readLog(lines), lines: [...lines] };
    },
  };
}

for (const mode of modes) {
  describe(`k.privacy: a lost \`onSecret\` slot, in ${mode}`, () => {
    it("An action that calls `onSecret(() => {})` from `@keel/schema/internal`, then reveals its `Secret` input and throws `bad ` and its value, logs `action <id> threw: [secret]` and the `req` path `[secret]`; a request after it that calls nothing logs its thrown secret as `bad [secret]`.", async () => {
      const t = await boot(mode);
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^tok-[a-f0-9]{12}$/),
          fc.stringMatching(/^tok-[a-f0-9]{12}$/),
          async (a, b) => {
            const lost = await t.send(true, a);
            expect(lost.log.messages).toEqual(["action app.a threw: [secret]"]);
            expect(lost.log.path).toBe("[secret]");
            for (const line of lost.lines) expect(line).not.toContain(a);
            const after = await t.send(false, b);
            expect(after.log.messages).toHaveLength(1);
            expect(after.log.messages[0]?.endsWith("bad [secret]")).toBe(true);
            expect(after.log.path).toBe("/a");
            for (const line of after.lines) expect(line).not.toContain(b);
          },
        ),
        { seed: SEED, numRuns: 6 },
      );
    });

    it("A request that calls nothing after two requests that cleared the slot logs its thrown secret as `bad [secret]` and its path as sent: each request takes the slot as it begins.", async () => {
      const t = await boot(mode);
      await t.send(true, "tok-aaaaaaaaaaaa");
      await t.send(true, "tok-bbbbbbbbbbbb");
      const after = await t.send(false, "tok-cccccccccccc");
      expect(after.log.messages[0]?.endsWith("bad [secret]")).toBe(true);
      expect(after.log.path).toBe("/a");
    });
  });
}
