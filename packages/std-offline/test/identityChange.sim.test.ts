// Identity with the outbox under generated schedules (std.outbox-owner, std.offline Owner): user a queues writes, then
// signs out (in one case) and user b signs in on the same ctx while drops, lost answers, 503s, storage faults and
// offline windows play out. No write of a's is ever committed as b's or as no one's, a's entries left behind are failed
// with `offline.owner` and never posted again, b's write commits once, and none of a's writes vanishes unaccounted.
import { type SimCtx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { simulate } from "@keel/testing";
import { expect, test } from "vitest";
import { Write, drain, outbox, send, writeFor } from "../src/index.ts";
import { field } from "../src/internal/field.ts";

const Api = contract("app", {
  "app.add": { method: "POST", path: "/add", body: s.object({ t: s.string(), write: Write }), output: s.object({}) },
});

/** A server whose action passes `body.write` through `writeFor` with the signed-in user, committing each key once. */
function server(ctx: SimCtx) {
  const who = { user: "a" };
  const committed = new Map<string, { t: string; owner: string; user: string }>();
  const posts: { t: string; owner: string; user: string }[] = [];
  ctx.net.route("http://app.keel.invalid/add", async (req) => {
    const body: unknown = await req.json();
    const t = String(field(body, "t"));
    const w = Write.parse(field(body, "write"));
    if (!w.ok) return Response.json({ ok: false, error: w.error }, { status: 422 });
    posts.push({ t, owner: w.value.owner, user: who.user });
    const r = writeFor(w.value, who.user);
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
    if (!committed.has(r.value.key)) committed.set(r.value.key, { t, owner: w.value.owner, user: who.user });
    return Response.json({ ok: true, value: {} });
  });
  return { who, committed, posts };
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 400; i++) await Promise.resolve();
};

let n = 0;
/** Sign-in sequences: a straight to b, and a through a sign-out to b. */
const paths: readonly (readonly string[])[] = [
  ["a", "b"],
  ["a", "", "b"],
];

for (const path of paths) {
  test(`writes queued under a are not sent as another user across ${path.map((u) => u || "signed out").join(" -> ")}`, async () => {
    let refused = 0;
    let committedA = 0;
    await simulate(
      async ({ ctx, run, schedule }) => {
        const srv = server(ctx);
        // The same id on every run and replay of a path: the run disposes its outbox, and a replay's trace names the store.
        const id = `ident${path.length}.outbox`;
        const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
        const decl = scope(
          () => {
            held.o = outbox(id, Api);
          },
          { detached: true },
        );
        const o = held.o;
        if (o === undefined) throw new Error("no outbox");
        const tA = ["a1", "a2"];
        let page = scope(() => void drain(ctx, o, { owner: "a" }), { detached: true });
        await run();
        const sends = tA.map((t) => send(ctx, o, "add", { body: { t } }, { base: 0, owner: "a" }).catch(() => null));
        // The user changes at times this run draws, while a's writes may still be queued or in flight; b then writes.
        let at = 0;
        let chain: Promise<unknown> = Promise.resolve();
        for (const user of path.slice(1)) {
          at += Math.floor(ctx.random.float() * 3000);
          const when = ctx.clock.after(at);
          chain = chain
            .then(() => when)
            .then(() => {
              srv.who.user = user;
              page.dispose();
              page = scope(() => void drain(ctx, o, { owner: user }), { detached: true });
            });
        }
        const mine = chain.then(() =>
          send(ctx, o, "add", { body: { t: "b1" } }, { base: 0, owner: "b" }).catch(() => null),
        );
        await run();
        // `run()` stops at the horizon, and a window edge it stepped to can leave a send's answer past it: the clock
        // runs past every window, online, and on until nothing is pending before the sends are awaited.
        const end = Math.max(0, ...schedule.offline.map((w) => w.at + w.ms));
        if (ctx.clock.now() < end) ctx.clock.advance(end - ctx.clock.now());
        ctx.net.setOnline(true);
        await run();
        for (let i = 0; i < 20 && ctx.clock.next() !== null; i++) {
          ctx.clock.advance(60_000);
          await run();
        }
        await Promise.all([...sends, mine]);

        // Committed writes keep the owner who queued them, and that owner was the signed-in user.
        for (const c of srv.committed.values()) {
          expect(c.owner).toBe(c.t.startsWith("a") ? "a" : "b");
          expect(c.user).toBe(c.owner);
        }
        const entries = o.get("entries");
        const entryOf = (t: string) => entries.find((e) => field(field(e.input, "body"), "t") === t);
        // Each of a's writes is committed under a, or left in the outbox failed; none is waiting to go out as b.
        for (const t of tA) {
          const e = entryOf(t);
          const done = [...srv.committed.values()].some((c) => c.t === t);
          expect(done || e !== undefined).toBe(true);
          if (e !== undefined) {
            expect(e.state).toBe("failed");
            expect(e.owner).toBe("a");
          }
        }
        if (entries.some((e) => e.owner === "a" && field(e.error, "code") === "offline.owner")) refused++;
        if ([...srv.committed.values()].some((c) => c.owner === "a")) committedA++;
        // A failed entry of a's is never posted again, however often the connection comes back.
        const before = srv.posts.filter((p) => p.owner === "a").length;
        for (let i = 0; i < 3; i++) {
          ctx.net.setOnline(false);
          ctx.net.setOnline(true);
          ctx.clock.advance(60_000);
          await run();
        }
        expect(srv.posts.filter((p) => p.owner === "a").length).toBe(before);
        // b's write: committed under b, or failed by a fault and kept (a storage fault after the post can do both). A
        // storage fault in a's flush releases it with b's entry still queued and no retry (std.outbox), so b's write is
        // judged once those reconnects flushed it and the clock ran on until no retry was left.
        for (let i = 0; i < 20 && ctx.clock.next() !== null; i++) {
          ctx.clock.advance(60_000);
          await run();
        }
        const b1 = [...srv.committed.values()].filter((c) => c.t === "b1");
        const b1Entry = o.get("entries").find((e) => field(field(e.input, "body"), "t") === "b1");
        expect(b1.length === 1 || b1Entry?.state === "failed").toBe(true);
        page.dispose();
        decl.dispose();
      },
      { runs: 100, seed: 41 },
    );
    // The runs reached both sides of the change: a's write committed before it, and refused after it.
    expect(refused).toBeGreaterThan(0);
    expect(committedA).toBeGreaterThan(0);
  }, 300_000);
}

test("in one page: a's queued writes wait through a sign-out, go as a's when a signs in again, and fail when b does", async () => {
  for (const next of ["a", "b"]) {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const srv = server(ctx);
    const held: { o?: ReturnType<typeof outbox<typeof Api>> } = {};
    const decl = scope(
      () => {
        held.o = outbox(`ident${++n}.outbox`, Api);
      },
      { detached: true },
    );
    const o = held.o;
    if (o === undefined) throw new Error("no outbox");
    let page = scope(() => void drain(ctx, o, { owner: "a" }), { detached: true });
    ctx.net.setOnline(false);
    for (const t of ["a1", "a2"]) await send(ctx, o, "add", { body: { t } }, { base: 0, owner: "a" });
    // Signed out, back online: nothing goes, nothing fails.
    srv.who.user = "";
    page.dispose();
    page = scope(() => void drain(ctx, o, { owner: "" }), { detached: true });
    ctx.net.setOnline(true);
    await settle();
    expect(srv.posts).toEqual([]);
    expect(o.get("entries").map((e) => e.state)).toEqual(["queued", "queued"]);
    srv.who.user = next;
    page.dispose();
    page = scope(() => void drain(ctx, o, { owner: next }), { detached: true });
    await settle();
    if (next === "a") {
      expect(srv.posts).toEqual([
        { t: "a1", owner: "a", user: "a" },
        { t: "a2", owner: "a", user: "a" },
      ]);
      expect(o.get("entries")).toEqual([]);
    } else {
      expect(srv.posts).toEqual([]);
      expect(o.get("entries").map((e) => [e.state, field(e.error, "code")])).toEqual([
        ["failed", "offline.owner"],
        ["failed", "offline.owner"],
      ]);
    }
    page.dispose();
    decl.dispose();
  }
});
