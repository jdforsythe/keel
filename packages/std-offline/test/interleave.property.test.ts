// Model property: random schedules of `send` under either of two owners, `drain` with either owner, `'mine'`
// `resolve`, connectivity changes (a `drain` flush), a storage whose writes settle one at a time in any order, may
// reject, throw synchronously, never settle (10 s on `ctx.clock` then count as rejected) or land after that bound, the
// clock passing 10 s, and a server that answers one held request at a time, refusing some by owner (`writeFor` with
// another owner than the write's, answered 400 `offline.owner`).
// An entry whose own write rejected is never posted after it, nothing is posted but the entry in hand, never while its
// post is in flight, never a `failed` one and never one of an owner other than the ctx's at the moment of the post; a
// call whose post was answered 2xx never resolves `failed`; no entry is lost; the flush is always released; and once
// everything settles storage holds what memory holds; a refused entry is `failed` with `offline.owner` (its message the
// outbox id), resolves so and is never posted again. Seed 1337.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { type OutboxResult, Write, drain, outbox, resolve, send, writeFor } from "../src/index.ts";
import { configOf } from "../src/internal/configOf.ts";
import { flowOf } from "../src/internal/flowOf.ts";

const ORIGIN = "http://app.keel.invalid";
const OWNER = "u1";
const OWNERS = ["u1", "u2"] as const;
const Api = contract("app", {
  "app.add": {
    method: "POST",
    path: "/add",
    body: s.object({ n: s.int(), write: Write }),
    output: s.object({ n: s.int() }),
  },
});

const settle = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const field = (x: unknown, k: string): unknown => (typeof x === "object" && x !== null ? Reflect.get(x, k) : undefined);

type How = "ok" | "fail" | "hang" | "late";
type Answer = "ok" | "conflict" | "refuse";
type Step =
  | { kind: "send"; who: number }
  | { kind: "owner"; who: number }
  | { kind: "throw" }
  | { kind: "mine"; pick: number }
  | { kind: "online"; on: boolean }
  | { kind: "write"; pick: number; how: How }
  | { kind: "time" }
  | { kind: "answer"; pick: number; how: Answer };
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.nat(1).map((who): Step => ({ kind: "send", who })),
  fc.nat(1).map((who): Step => ({ kind: "owner", who })),
  fc.constant<Step>({ kind: "throw" }),
  fc.nat(7).map((pick): Step => ({ kind: "mine", pick })),
  fc.boolean().map((on): Step => ({ kind: "online", on })),
  fc
    .record({ pick: fc.nat(7), how: fc.constantFrom<How>("ok", "fail", "hang", "late") })
    .map((w): Step => ({ kind: "write", ...w })),
  fc.constant<Step>({ kind: "time" }),
  fc
    .record({ pick: fc.nat(7), how: fc.constantFrom<Answer>("ok", "conflict", "refuse") })
    .map((a): Step => ({ kind: "answer", ...a })),
);

/**
 * `ctx.storage.set` held until pumped: `pump(i, how)` settles the `i`-th held write, out of order allowed, with
 * `'hang'` drops it so it never settles, and with `'late'` lands it last, once `ctx.clock` has passed its 10 s bound and
 * every other held write has landed;
 * `throwNext()` makes the next `set` throw synchronously; `lastLanded()` tells whether the write issued last has landed.
 */
function heldStorage(ctx: SimCtx) {
  const real = ctx.storage.set.bind(ctx.storage);
  const held: { run: (fail: boolean) => Promise<void> }[] = [];
  const state = { holding: true, throwing: false, issued: 0 };
  const landed = new Set<number>();
  const set = (key: string, value: string): Promise<void> => {
    const id = ++state.issued;
    if (state.throwing) {
      state.throwing = false;
      throw new RangeError("storage");
    }
    return state.holding
      ? new Promise<void>((done, bad) => {
          held.push({
            run: async (fail) => {
              if (fail) return bad(new Error("QuotaExceeded /data/user/secret.db"));
              await real(key, value);
              landed.add(id);
              done();
            },
          });
        })
      : real(key, value).then(() => void landed.add(id));
  };
  Object.defineProperty(ctx.storage, "set", { value: set, configurable: true, writable: true });
  return {
    pump: async (i: number, how: How): Promise<void> => {
      const [w] = held.splice(i % Math.max(held.length, 1), 1);
      if (w === undefined || how === "hang") return;
      if (how === "late") {
        ctx.clock.advance(10_000);
        await settle();
        while (held.length > 0) await held.shift()?.run(false);
        await settle();
      }
      await w.run(how === "fail");
    },
    lastLanded: (): boolean => landed.has(state.issued),
    throwNext: (): void => {
      state.throwing = true;
    },
    release: async (): Promise<void> => {
      state.holding = false;
      state.throwing = false;
      while (held.length > 0) await held.shift()?.run(false);
    },
  };
}

/**
 * A server that holds each post until `answer` and records each post's key, and as `wrong` each post of a key already
 * in flight or already refused, whose entry is not `sending` when it arrives (`stateOf`), or whose entry's owner is not
 * the ctx's then (`mine`). A `refuse` answer passes the post's `write` through `writeFor` with an owner no entry has.
 */
function gatedServer(
  ctx: SimCtx,
  stateOf: (key: string) => string | undefined,
  mine: (key: string) => boolean,
  refuseAt: readonly boolean[],
) {
  const posts: string[] = [];
  const wrong: string[] = [];
  const flying = new Set<string>();
  const applied = new Set<string>();
  const refused = new Set<string>();
  const held: { key: string; go: (how: Answer) => void }[] = [];
  const state = { gated: true, refusing: true };
  // Once the server stops holding posts, post `i` is refused as `refuseAt` says, until `stopRefusing`.
  const later = (): Answer => (state.refusing && refuseAt[posts.length % refuseAt.length] ? "refuse" : "ok");
  ctx.net.route(`${ORIGIN}/add`, async (req) => {
    const write = Write.parse(field(await req.json(), "write"));
    const key = write.ok ? write.value.key : "";
    posts.push(key);
    if (flying.has(key) || refused.has(key) || stateOf(key) !== "sending" || !mine(key)) wrong.push(key);
    flying.add(key);
    const how = await new Promise<Answer>((go) => {
      if (state.gated) held.push({ key, go });
      else go(later());
    });
    flying.delete(key);
    const headers = { "content-type": "application/json" };
    const checked = write.ok ? writeFor(write.value, how === "refuse" ? "nobody" : write.value.owner) : undefined;
    if (checked !== undefined && !checked.ok) {
      refused.add(key);
      return new Response(JSON.stringify({ ok: false, error: checked.error }), { status: 400, headers });
    }
    if (how === "conflict") {
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
    refused,
    answer: (i: number, how: Answer): void => {
      const [h] = held.splice(i % Math.max(held.length, 1), 1);
      h?.go(how);
    },
    open: (): void => {
      state.gated = false;
      for (const h of held.splice(0)) h.go(later());
    },
    stopRefusing: (): void => {
      state.refusing = false;
    },
  };
}

let n = 0;
const stored = (raw: string | null): unknown => field(JSON.parse(raw ?? "{}"), "entries");
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

async function run(script: readonly Step[], refuseAt: readonly boolean[]) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
  const entryOf = (key: string) => held.o?.get("entries").find((e) => e.key === key);
  const server = gatedServer(
    ctx,
    (key) => entryOf(key)?.state,
    (key) => held.o !== undefined && flowOf(configOf(held.o), ctx).owner === entryOf(key)?.owner,
    refuseAt,
  );
  const sc = scope(() => {
    held.o = outbox(`interleave${++n}.outbox`, Api);
    if (held.o !== undefined) void drain(ctx, held.o, { owner: OWNER });
  });
  const o = held.o;
  if (o === undefined) throw new Error("no outbox");
  await settle();
  const storage = heldStorage(ctx);
  /** Per admission (a `send` or a `'mine'` `resolve`): its key, the posts of that key before it, and its answer. */
  const admissions: { key: string; n: number; before: number; out?: OutboxResult<unknown> | false }[] = [];
  const postsOf = (key: string): number => server.posts.filter((k) => k === key).length;
  const drains: { dispose(): void }[] = [];
  let sent = 0;
  // Each admission of a `send` that has added its entry takes the key of the `<id>.add` carrying its `n`.
  const keys = (): void => {
    const added = o.log().filter((e) => e.name === `${o.id}.add`);
    for (const a of admissions.filter((x) => x.key === "")) {
      const add = added.find((e) => field(field(field(e.payload, "input"), "body"), "n") === a.n);
      a.key = add === undefined ? "" : String(field(add.payload, "key"));
    }
  };
  for (const step of script) {
    if (step.kind === "send") {
      const at = admissions.length;
      // Its key is read from the log once its entry is added.
      admissions.push({ key: "", n: sent, before: 0 });
      const owner = OWNERS[step.who] ?? OWNER;
      void send(ctx, o, "add", { body: { n: sent++ } }, { base: 0, owner }).then((out) => {
        const a = admissions[at];
        if (a) a.out = out;
      });
    } else if (step.kind === "mine") {
      const conflicts = o.get("entries").filter((e) => e.state === "conflict");
      const e = conflicts[step.pick % Math.max(conflicts.length, 1)];
      if (e !== undefined) {
        const at = admissions.length;
        admissions.push({ key: e.key, n: -1, before: postsOf(e.key) });
        void resolve(ctx, o, e.key, "mine").then((out) => {
          const a = admissions[at];
          if (a) a.out = out;
        });
      }
    } else if (step.kind === "owner") {
      const owner = OWNERS[step.who] ?? OWNER;
      drains.push(scope(() => void drain(ctx, o, { owner })));
    } else if (step.kind === "throw") storage.throwNext();
    else if (step.kind === "online") ctx.net.setOnline(step.on);
    else if (step.kind === "write") await storage.pump(step.pick, step.how);
    else if (step.kind === "time") ctx.clock.advance(10_000);
    else server.answer(step.pick, step.how);
    await settle();
    keys();
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
  // A write that never settled released its flush once 10 s passed, posting no more: reconnect to flush the rest.
  ctx.net.setOnline(false);
  await settle();
  ctx.net.setOnline(true);
  await settle();
  await storage.release();
  await settle();
  keys();
  // Unless the write issued last failed, storage holds what memory holds (a write landing after its bound included).
  const agreed = !storage.lastLanded() || equal(stored(await ctx.storage.get(`keel.outbox.${o.id}`)), o.get("entries"));
  const entries = o.get("entries");
  const posts = [...server.posts];
  // The flush is released: a new send flushes and is sent.
  server.stopRefusing();
  const last = await send(ctx, o, "add", { body: { n: -1 } }, { base: 0, owner: OWNER });
  await settle();
  const after = equal(stored(await ctx.storage.get(`keel.outbox.${o.id}`)), o.get("entries"));
  for (const d of drains) d.dispose();
  sc.dispose();
  const { wrong, applied, refused } = server;
  return { id: o.id, admissions, entries, posts, wrong, applied, refused, last, agreed, after };
}

test("interleaved sends, resolves, flushes and storage writes: never posted after a rejected write, never twice, never lost", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(stepArb, { maxLength: 24 }),
      fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
      async (script, refuseAt) => {
        const r = await run(script, refuseAt);
        // A `send` that added no entry (key "") is checked below.
        const failed = r.admissions.filter(
          (a) => a.key !== "" && a.out !== undefined && a.out !== false && a.out.state === "failed",
        );
        // Every admission answered.
        for (const a of r.admissions) expect(a.out).not.toBe(undefined);
        // An admission whose write rejected or whose owner changed: nothing posted for it, and no 2xx answer for its key.
        // A refused admission: posted once more than before it, then never again.
        for (const a of failed) {
          expect(["offline.storage", "offline.owner"]).toContain(
            a.out !== false && a.out?.state === "failed" ? a.out.error.code : "",
          );
          expect(r.posts.filter((k) => k === a.key)).toHaveLength(r.refused.has(a.key) ? a.before + 1 : a.before);
          expect(r.applied.has(a.key)).toBe(false);
          expect(r.entries.find((e) => e.key === a.key)?.state).toBe("failed");
        }
        // Never posted twice: each post is of an entry the flush holds `sending`, and no key is posted while in flight
        // (a post whose answer went offline is sent once more, under the same write key).
        expect(r.wrong).toEqual([]);
        // None lost: each key is applied (and gone) or still held `conflict` or `failed`.
        // A `send` whose owner stopped being the ctx's before it added its entry adds none.
        for (const a of r.admissions.filter((x) => x.key === ""))
          expect(a.out !== false && a.out?.state === "failed" ? a.out.error.code : "").toBe("offline.owner");
        for (const key of new Set(r.admissions.map((a) => a.key).filter((k) => k !== ""))) {
          const e = r.entries.find((x) => x.key === key);
          if (e === undefined) expect(r.applied.has(key)).toBe(true);
          else expect(["conflict", "failed"]).toContain(e.state);
        }
        // A refused entry is `failed` with `offline.owner`, its message the outbox id, and the last admission of its key
        // resolves so, or `queued` when its flush stopped before the post.
        const refusal = { state: "failed", error: { code: "offline.owner", message: r.id, data: {} } };
        for (const key of r.refused) {
          expect(r.entries.find((e) => e.key === key)).toMatchObject(refusal);
          const out = r.admissions.filter((x) => x.key === key).at(-1)?.out;
          if (out !== false && out?.state !== "queued") expect(out).toEqual(refusal);
        }
        expect(r.last.state).toBe("sent");
        // Once everything settles storage holds what memory holds, unless the write issued last failed.
        expect(r.agreed).toBe(true);
        expect(r.after).toBe(true);
      },
    ),
    { seed: 1337, numRuns: 300 },
  );
});
