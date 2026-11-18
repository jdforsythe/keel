// Model property: random schedules of `send`, `'mine'` `resolve`, connectivity changes (a `drain` flush), a storage
// whose writes settle one at a time in any order and may reject, and a server that answers one held request at a time.
// An entry whose own write rejected is never posted after it, nothing is posted but the entry in hand and never while
// its post is in flight, no entry is lost, and the flush is always released. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type OutboxResult, Write, drain, outbox, resolve, send } from "../src/index.ts";

const ORIGIN = "http://app.keel.invalid";
const OWNER = "u1";
const Api = endpoints({
  add: { method: "POST", path: "/add", body: s.object({ n: s.int(), write: Write }), output: s.object({ n: s.int() }) },
});

const settle = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const field = (x: unknown, k: string): unknown => (typeof x === "object" && x !== null ? Reflect.get(x, k) : undefined);

type Step =
  | { kind: "send" }
  | { kind: "mine"; pick: number }
  | { kind: "online"; on: boolean }
  | { kind: "write"; pick: number; fail: boolean }
  | { kind: "answer"; pick: number; conflict: boolean };
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.constant<Step>({ kind: "send" }),
  fc.nat(7).map((pick): Step => ({ kind: "mine", pick })),
  fc.boolean().map((on): Step => ({ kind: "online", on })),
  fc.record({ pick: fc.nat(7), fail: fc.boolean() }).map((w): Step => ({ kind: "write", ...w })),
  fc.record({ pick: fc.nat(7), conflict: fc.boolean() }).map((a): Step => ({ kind: "answer", ...a })),
);

/** `ctx.storage.set` held until pumped: `pump(i, fail)` settles the `i`-th held write, out of order allowed. */
function heldStorage(ctx: SimCtx) {
  const real = ctx.storage.set.bind(ctx.storage);
  const held: { run: (fail: boolean) => Promise<void> }[] = [];
  const state = { holding: true };
  const set = (key: string, value: string): Promise<void> =>
    state.holding
      ? new Promise<void>((done, bad) => {
          held.push({
            run: async (fail) => {
              if (fail) return bad(new Error("QuotaExceeded /data/user/secret.db"));
              await real(key, value);
              done();
            },
          });
        })
      : real(key, value);
  Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
  return {
    pump: async (i: number, fail: boolean): Promise<void> => {
      const [w] = held.splice(i % Math.max(held.length, 1), 1);
      if (w !== undefined) await w.run(fail);
    },
    release: async (): Promise<void> => {
      state.holding = false;
      while (held.length > 0) await held.shift()?.run(false);
    },
  };
}

/**
 * A server that holds each post until `answer` and records each post's key, and as `wrong` each post of a key already
 * in flight or whose entry is not `sending` when it arrives (`stateOf`).
 */
function gatedServer(ctx: SimCtx, stateOf: (key: string) => string | undefined) {
  const posts: string[] = [];
  const wrong: string[] = [];
  const flying = new Set<string>();
  const applied = new Set<string>();
  const held: { key: string; go: (conflict: boolean) => void }[] = [];
  const state = { gated: true };
  ctx.net.route(`${ORIGIN}/add`, async (req) => {
    const key = String(field(field(await req.json(), "write"), "key"));
    posts.push(key);
    if (flying.has(key) || stateOf(key) !== "sending") wrong.push(key);
    flying.add(key);
    const conflict = await new Promise<boolean>((go) => {
      if (state.gated) held.push({ key, go });
      else go(false);
    });
    flying.delete(key);
    const headers = { "content-type": "application/json" };
    if (conflict) {
      const error = { code: "keel.conflict", message: "x", data: { transaction: "add", head: posts.length } };
      return new Response(JSON.stringify({ ok: false, error }), { status: 409, headers });
    }
    applied.add(key);
    return new Response(JSON.stringify({ ok: true, value: { n: posts.length } }), { headers });
  });
  return {
    posts,
    wrong,
    applied,
    answer: (i: number, conflict: boolean): void => {
      const [h] = held.splice(i % Math.max(held.length, 1), 1);
      h?.go(conflict);
    },
    open: (): void => {
      state.gated = false;
      for (const h of held.splice(0)) h.go(false);
    },
  };
}

let n = 0;

async function run(script: readonly Step[]) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const server = gatedServer(ctx, (key) => held.o?.get("entries").find((e) => e.key === key)?.state);
  const sc = scope(() => {
    held.o = outbox(`interleave${++n}.outbox`, Api, { module: "app" });
    if (held.o !== undefined) void drain(ctx, held.o, { owner: OWNER });
  });
  const o = held.o;
  if (o === undefined) throw new Error("no outbox");
  await settle();
  const storage = heldStorage(ctx);
  /** Per admission (a `send` or a `'mine'` `resolve`): its key, the posts of that key before it, and its answer. */
  const admissions: { key: string; before: number; out?: OutboxResult<unknown> | false }[] = [];
  const postsOf = (key: string): number => server.posts.filter((k) => k === key).length;
  let sent = 0;
  let adds = 0;
  for (const step of script) {
    if (step.kind === "send") {
      const at = admissions.length;
      // Its key is the next `<id>.add` of the log, read once the step has settled.
      admissions.push({ key: "", before: 0 });
      void send(ctx, o, "add", { body: { n: sent++ } }, { base: 0, owner: OWNER }).then((out) => {
        const a = admissions[at];
        if (a) a.out = out;
      });
    } else if (step.kind === "mine") {
      const conflicts = o.get("entries").filter((e) => e.state === "conflict");
      const e = conflicts[step.pick % Math.max(conflicts.length, 1)];
      if (e !== undefined) {
        const at = admissions.length;
        admissions.push({ key: e.key, before: postsOf(e.key) });
        void resolve(ctx, o, e.key, "mine").then((out) => {
          const a = admissions[at];
          if (a) a.out = out;
        });
      }
    } else if (step.kind === "online") ctx.net.setOnline(step.on);
    else if (step.kind === "write") await storage.pump(step.pick, step.fail);
    else server.answer(step.pick, step.conflict);
    await settle();
    const added = o
      .log()
      .filter((e) => e.name === `${o.id}.add`)
      .map((e) => String(field(e.payload, "key")))
      .slice(adds);
    for (const a of admissions.filter((x) => x.key === "")) {
      a.key = added.shift() ?? "";
      if (a.key !== "") adds++;
    }
  }
  // Let everything finish: storage and server stop holding, the client comes online, the retry timer runs.
  await storage.release();
  server.open();
  ctx.net.setOnline(false);
  await settle();
  ctx.net.setOnline(true);
  await settle();
  await storage.release();
  ctx.clock.advance(60_000);
  await settle();
  await storage.release();
  await settle();
  const entries = o.get("entries");
  const posts = [...server.posts];
  // The flush is released: a new send flushes and is sent.
  const last = await send(ctx, o, "add", { body: { n: -1 } }, { base: 0, owner: OWNER });
  sc.dispose();
  return { admissions, entries, posts, wrong: server.wrong, applied: server.applied, last };
}

test("interleaved sends, resolves, flushes and storage writes: never posted after a rejected write, never twice, never lost", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(stepArb, { maxLength: 24 }), async (script) => {
      const r = await run(script);
      const failed = r.admissions.filter((a) => a.out !== undefined && a.out !== false && a.out.state === "failed");
      // Every admission answered.
      for (const a of r.admissions) expect(a.out).not.toBe(undefined);
      // An admission whose write rejected: nothing posted for it.
      for (const a of failed) {
        expect(a.out !== false && a.out?.state === "failed" ? a.out.error.code : "").toBe("offline.storage");
        expect(r.posts.filter((k) => k === a.key)).toHaveLength(a.before);
        expect(r.entries.find((e) => e.key === a.key)?.state).toBe("failed");
      }
      // Never posted twice: each post is of an entry the flush holds `sending`, and no key is posted while in flight
      // (a post whose answer went offline is sent once more, under the same write key).
      expect(r.wrong).toEqual([]);
      // None lost: each key is applied (and gone) or still held `conflict` or `failed`.
      for (const key of new Set(r.admissions.map((a) => a.key))) {
        const e = r.entries.find((x) => x.key === key);
        if (e === undefined) expect(r.applied.has(key)).toBe(true);
        else expect(["conflict", "failed"]).toContain(e.state);
      }
      expect(r.last.state).toBe("sent");
    }),
    { seed: 1337, numRuns: 120 },
  );
});
