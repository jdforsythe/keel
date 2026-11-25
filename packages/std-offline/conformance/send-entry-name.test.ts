// std.contracts, std-offline "`outbox(id, contract, opts)` (std.offline) sends the contract's API write entries; `send`'s third argument is an entry's name after the module (`'editTodo'` for `api.editTodo`), and a GET, `events` or page id does not compile."
// Spec: std.contracts, clause "`send(ctx, o, 'board', ...)` for a GET entry `api.board` of the outbox's contract does not compile."
// Seed 1337 (no random input). The compile halves are in ./negative-types.test-d.ts; here the same calls are untyped, inside a function that is never called; the runtime half sends through an unbound sim ctx.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { outbox, send } from "@keel/std-offline";
import { expect, test } from "vitest";

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

test("`send`'s third argument is an entry's name after the module and a GET, `events` or page id does not compile", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const o = outbox("api.outbox", api);
  const never = async () => {
    await send(ctx, o, "editTodo", { body: { title: "t" } }, { base: 0, owner: "" });
    await Reflect.apply(send, undefined, [ctx, o, "board", {}, { base: 0, owner: "" }]);
    await Reflect.apply(send, undefined, [ctx, o, "live", {}, { base: 0, owner: "" }]);
    await Reflect.apply(send, undefined, [ctx, o, "home", {}, { base: 0, owner: "" }]);
  };
  expect(typeof never).toBe("function");
});

test("`outbox(id, contract)` creates client store `id` over the contract's write entries", () => {
  const o = outbox("api.outbox", api);
  expect(o.get("entries")).toEqual([]);
});
