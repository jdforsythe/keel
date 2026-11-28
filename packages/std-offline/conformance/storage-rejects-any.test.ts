// Spec: k.supervise, clause "With every `ctx.storage` write rejecting with the string `'s'` or with a defect, std.offline's `send` leaves the entry `failed` with `offline.storage`, and the process has no unhandled rejection."
// Seed 1337 (no random input: the two rejections are fixed). Every `ctx.storage` write is replaced by one that rejects; the load's `get` still answers.
import { defect } from "@keel/schema";
import { send } from "@keel/std-offline";
import { describe, expect, test } from "vitest";
import { OWNER, SEED, createServer, edit, entriesOf, makeClient, settle, simCtx } from "./fixtures.ts";

const REJECTS: readonly (readonly [string, () => Promise<never>])[] = [
  ["the string `'s'`", () => Promise.reject("s")],
  [
    "a defect",
    async () => {
      defect("bug");
    },
  ],
];

describe("k.supervise: std.offline's storage supervisor", () => {
  for (const [name, reject] of REJECTS) {
    test(`with every \`ctx.storage\` write rejecting with ${name}, \`send\` leaves the entry \`failed\` with \`offline.storage\`, and the process has no unhandled rejection`, async () => {
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => void unhandled.push(reason);
      process.on("unhandledRejection", onUnhandled);
      try {
        const ctx = simCtx(SEED);
        Object.defineProperty(ctx.storage, "set", { value: reject, configurable: true, writable: true });
        const server = createServer();
        server.attach(ctx);
        const c = makeClient();
        const r = await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
        await settle();
        expect(r.state).toBe("failed");
        if (r.state === "failed") expect(r.error.code).toBe("offline.storage");
        expect(server.posts).toHaveLength(0);
        expect(entriesOf(c.o).map((e) => e.state)).toEqual(["failed"]);
        await settle();
        expect(unhandled).toEqual([]);
        c.dispose();
      } finally {
        process.off("unhandledRejection", onUnhandled);
      }
    });
  }
});
