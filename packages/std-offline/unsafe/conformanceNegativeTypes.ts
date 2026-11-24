// Type-only fixture for conformance/send-entry-name.test.ts (in unsafe/ because it needs expected-error directives):
// checked by tsc, never run. The conformance file makes the same calls untyped.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { outbox, send } from "@keel/std-offline";
import { unsafe } from "./unsafe.ts";

export async function conformanceNegativeTypes(): Promise<void> {
  return unsafe(
    "type-level negatives: each expected-error line asserts send and outbox reject a misuse; checked by tsc, never run",
    async () => {
      const Write = s.object({ key: s.id("Write"), base: s.int({ min: 0 }), owner: s.string() });
      const api = contract("api", {
        "api.board": { method: "GET", path: "/api/board", output: s.object({}) },
        "api.live": { method: "GET", path: "/api/live", events: true, output: s.object({}) },
        "api.home": { path: "/" },
        "api.editTodo": {
          method: "POST",
          path: "/api/todo",
          body: s.object({ title: s.string(), write: Write }),
          output: s.object({}),
        },
      });
      const ctx = createCtx({ mode: "sim", seed: 1337 });
      const o = outbox("api.outbox", api);
      // @ts-expect-error `board` is a GET entry
      await send(ctx, o, "board", {}, { base: 0, owner: "" });
      // @ts-expect-error `live` is an `events` entry
      await send(ctx, o, "live", {}, { base: 0, owner: "" });
      // @ts-expect-error `home` is a page
      await send(ctx, o, "home", {}, { base: 0, owner: "" });
    },
  );
}
