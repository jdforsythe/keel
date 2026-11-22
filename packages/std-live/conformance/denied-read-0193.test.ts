// Spec: std.live, clause "A read answering `api.status` 403 commits nothing, `status()` is `denied`, the stream's request is aborted, and no read runs after 1 s, 2 s or 30 s on `ctx.clock`; a read answering `api.status` 502 leaves `status()` at `connecting` and reads again 1 s later."
// Spec: std.live, clause "A read returning a KeelError `keel.denied` gives `denied`."
// Spec: std.live, clause "With callers A and B live on one sim server and B's session removed, A's write leaves B's `status()` at `denied` and B's hydrated store as it was."
// Spec: std.live, `status()` "`denied` once the channel denies or a read is refused. A read is refused when its `err` is `api.status` with `status` 401 or 403, or a KeelError with code `keel.denied` (a direct loader call). A refused read commits nothing, closes the stream and stops reading, as a channel denial stops `subscribe`. `denied` ends that `live` call; a later sign-in shows on the next navigation or reload, which mounts the page again."
// Seed 1337
// Pending (rfc:0193): skipped until the build lands; the builder un-skips by changing each `test.skip` to `test` in this file.
// Assumption: an `api.status` err is `{ code: 'api.status', message, data: { status, body: null } }` (k.services); B's "session removed" is a sim net route on B's ctx that answers the board GET 403 from then on, the stream route staying B's own attachment of the shared sim server.
import { err, ok } from "@keel/schema";
import type { KeelError, Result } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { ORIGIN, api, boardArb, createServer, mount, readBoard, settle, simCtx, tick } from "./fixtures.ts";
import type { BoardValue, Read } from "./fixtures.ts";

const REFUSED =
  "A read answering `api.status` 403 commits nothing, `status()` is `denied`, the stream's request is aborted, and no read runs after 1 s, 2 s or 30 s on `ctx.clock`; a read answering `api.status` 502 leaves `status()` at `connecting` and reads again 1 s later.";
const DENIED = "A read returning a KeelError `keel.denied` gives `denied`.";
const SESSION =
  "With callers A and B live on one sim server and B's session removed, A's write leaves B's `status()` at `denied` and B's hydrated store as it was.";

const statusErr = (status: number): Result<BoardValue, KeelError<string, unknown>> =>
  err({ code: "api.status", message: `status ${status}`, data: { status, body: null } });

test.skip(`${REFUSED} (a 401 or 403 read: nothing committed, denied, request aborted, no later read)`, async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(401, 403), boardArb, async (status, board) => {
      const ctx = simCtx();
      const server = createServer();
      server.attach(ctx);
      let calls = 0;
      const read: Read = async () => {
        calls++;
        return calls === 1 ? ok(board) : statusErr(status);
      };
      const m = mount(ctx, read);
      await settle();
      expect(m.status()).toBe("live");
      const committed = m.view.log().length;
      server.save("x");
      await settle();
      expect(calls).toBe(2);
      expect(m.status()).toBe("denied");
      expect(m.view.log()).toHaveLength(committed);
      expect(server.openNow()).toBe(0);
      for (const ms of [1_000, 1_000, 28_000]) await tick(ctx, ms);
      expect(calls).toBe(2);
      expect(m.status()).toBe("denied");
      m.dispose();
    }),
    { seed: 1337, numRuns: 6 },
  );
});

test.skip(`${REFUSED} (a 401 or 403 first read: denied, nothing committed, no read after 1 s, 2 s or 30 s)`, async () => {
  for (const status of [401, 403]) {
    const ctx = simCtx();
    const server = createServer();
    server.attach(ctx);
    let calls = 0;
    const read: Read = async () => {
      calls++;
      return statusErr(status);
    };
    const m = mount(ctx, read);
    await settle();
    expect(m.status()).toBe("denied");
    expect(m.view.log()).toHaveLength(0);
    expect(server.openNow()).toBe(0);
    await tick(ctx, 1_000);
    expect(calls).toBe(1);
    await tick(ctx, 2_000);
    expect(calls).toBe(1);
    await tick(ctx, 30_000);
    expect(calls).toBe(1);
    expect(m.status()).toBe("denied");
    m.dispose();
  }
});

test.skip(`${REFUSED} (a 502 read leaves connecting and reads again 1 s later)`, async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  let calls = 0;
  const read: Read = async () => {
    calls++;
    return statusErr(502);
  };
  const m = mount(ctx, read);
  await settle();
  expect(calls).toBe(1);
  expect(m.status()).toBe("connecting");
  await tick(ctx, 999);
  expect(calls).toBe(1);
  await tick(ctx, 1);
  expect(calls).toBe(2);
  expect(m.status()).toBe("connecting");
  m.dispose();
});

test.skip(`${DENIED} (a direct loader call's refusal)`, async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  let calls = 0;
  const read: Read = async () => {
    calls++;
    return err({ code: "keel.denied", message: "denied", data: {} });
  };
  const m = mount(ctx, read);
  await settle();
  expect(m.status()).toBe("denied");
  expect(m.view.log()).toHaveLength(0);
  await tick(ctx, 30_000);
  expect(calls).toBe(1);
  m.dispose();
});

test.skip(`${SESSION} (B's refused read leaves denied and B's store as it was; A stays live)`, async () => {
  const server = createServer();
  const a = simCtx();
  const b = simCtx(1338);
  server.attach(a);
  server.attach(b);
  const ma = mount(a, readBoard);
  const mb = mount(b, readBoard);
  await settle();
  expect(mb.status()).toBe("live");
  const before = mb.view.log().length;
  const heldItems = mb.view.get("items");
  // B's session is removed: the board now refuses B.
  b.net.route(`${ORIGIN}/api/board`, () => new Response("{}", { status: 403 }));
  expect((await api.add({ body: { item: "from-a" } }, a)).ok).toBe(true);
  await settle();
  expect(mb.status()).toBe("denied");
  expect(mb.view.log()).toHaveLength(before);
  expect(mb.view.get("items")).toEqual(heldItems);
  expect(ma.status()).toBe("live");
  expect(ma.view.get("items")).toEqual(["from-a"]);
  ma.dispose();
  mb.dispose();
});

test.skip(`${DENIED} (denied is distinct from connecting and offline, and final: a later online event does not leave it)`, async () => {
  const ctx = simCtx();
  const server = createServer();
  server.attach(ctx);
  const read: Read = async () => statusErr(403);
  const m = mount(ctx, read);
  await settle();
  expect(m.status()).toBe("denied");
  ctx.net.setOnline(false);
  await settle();
  expect(m.status()).toBe("denied");
  ctx.net.setOnline(true);
  await tick(ctx, 30_000);
  expect(m.status()).toBe("denied");
  expect(server.openNow()).toBe(0);
  m.dispose();
});
