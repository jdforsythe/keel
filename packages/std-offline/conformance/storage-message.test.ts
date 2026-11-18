// Spec: std.offline Conformance: "An `offline.storage` err's `message` is the outbox `id`, whatever was thrown."
// Spec: std.outbox, Errors: "An `offline.storage` or `offline.owner` err is `{ code, message, data: {} }`, its `message` the outbox `id`, never thrown text."
// Seed 1337
import type { SimCtx } from "@keel/ctx";
import { resolve, send } from "@keel/std-offline";
import fc from "fast-check";
import { expect, test } from "vitest";
import { OWNER, createServer, edit, makeClient, settle, simCtx } from "./fixtures.ts";

/** Makes the `n`th `set` after this call (1-based) reject with `thrown`; the others pass through. */
function failSetNumber(ctx: SimCtx, n: number, thrown: unknown): void {
  const real = ctx.storage.set.bind(ctx.storage);
  let count = 0;
  const set = async (key: string, value: string): Promise<void> => {
    count += 1;
    if (count === n) throw thrown;
    return real(key, value);
  };
  Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
}

const messageOf = (r: { state: string } | false): unknown => {
  if (r === false || r.state !== "failed") return undefined;
  const err: unknown = Reflect.get(r, "error");
  if (typeof err !== "object" || err === null) return undefined;
  expect(Reflect.get(err, "code")).toBe("offline.storage");
  return Reflect.get(err, "message");
};

type Where = "send" | "flush" | "resolve";

async function run(where: Where, thrown: unknown): Promise<{ message: unknown; id: string }> {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const c = makeClient();
  try {
    if (where === "send") {
      failSetNumber(ctx, 1, thrown);
      const r = await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
      await settle();
      return { message: messageOf(r), id: c.id };
    }
    if (where === "flush") {
      failSetNumber(ctx, 2, thrown);
      const r = await send(ctx, c.o, "editTodo", edit("t1", "x"), { base: 0, owner: OWNER });
      await settle();
      return { message: messageOf(r), id: c.id };
    }
    server.other("t1", "other");
    await send(ctx, c.o, "editTodo", edit("t1", "mine"), { base: 0, owner: OWNER });
    await settle();
    const entry = c.o.get("entries")[0];
    const key: unknown = typeof entry === "object" && entry !== null ? Reflect.get(entry, "key") : undefined;
    if (typeof key !== "string") throw new Error("no conflict entry");
    failSetNumber(ctx, 1, thrown);
    const r = await resolve(ctx, c.o, key, "mine");
    return { message: messageOf(r), id: c.id };
  } finally {
    c.dispose();
  }
}

const wheres: readonly Where[] = ["send", "flush", "resolve"];

for (const where of wheres) {
  test(`An \`offline.storage\` err's \`message\` is the outbox \`id\` when the storage throws an \`Error\` (${where}).`, async () => {
    const text = "QuotaExceeded /data/user/secret.db";
    const { message, id } = await run(where, new Error(text));
    expect(message).toBe(id);
    expect(String(message)).not.toContain("secret");
    expect(String(message)).not.toContain(text);
  });

  test(`An \`offline.storage\` err's \`message\` is the outbox \`id\` when the storage throws a non-Error value (${where}).`, async () => {
    for (const thrown of ["plain secret text", 42, { detail: "secret" }, null, undefined]) {
      const { message, id } = await run(where, thrown);
      expect(message).toBe(id);
      expect(String(message)).not.toContain("secret");
    }
  });

  test(`An \`offline.storage\` err's \`message\` is the outbox \`id\`, whatever text was thrown (${where}).`, async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 24 }), fc.boolean(), async (text, asError) => {
        const thrown = `SECRET-${text}`;
        const { message, id } = await run(where, asError ? new Error(thrown) : thrown);
        expect(message).toBe(id);
        expect(String(message)).not.toContain(thrown);
        expect(String(message)).not.toContain("SECRET-");
      }),
      { seed: 1337, numRuns: 12 },
    );
  });
}
