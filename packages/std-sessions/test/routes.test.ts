// @vitest-environment node
// `@keel/std-sessions/routes` (std.sessions Ingest) over createApp with a sim ctx: ingest, list with `failing` and
// `since`, 413 past 256 KiB, the re-fingerprint, archive bounds (`sessions.capped`) and the reader
// guard. Seed 1337
import { createHash } from "node:crypto";
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { createApp, topology } from "@keel/server";
import { isolate, tx } from "@keel/store";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Session } from "../src/Session.schema.ts";
import { archiveStores } from "../src/archiveStores.ts";
import { fingerprint } from "../src/internal/fingerprint.ts";
import { sessionFingerprint } from "../src/internal/sessionFingerprint.ts";
import { utf8Length } from "../src/internal/utf8Length.ts";
import { routes } from "../src/routes.ts";
import { ARCHIVE_BOUNDS } from "../src/routes/ARCHIVE_BOUNDS.ts";
import { Listing } from "../src/routes/Listing.schema.ts";
import { archiveBytes } from "../src/routes/archiveBytes.ts";

const BASE = "http://localhost";

/** `fn` over a fresh `archiveStores()` in its own isolated scope, as k.server opens one per request. */
function fresh(fn: (st: ReturnType<typeof archiveStores>) => void): void {
  const sc = scope(() => undefined);
  isolate(sc);
  try {
    sc.run(() => fn(archiveStores()));
  } finally {
    sc.dispose();
  }
}
const json = { accept: "application/json", "content-type": "application/json" };

function sessionOf(n: number, over: Partial<Session> = {}): Session {
  const error = { code: `app.e${n % 7}`, message: "boom", data: null };
  const base: Session = {
    v: 1,
    id: stubId(n),
    seed: 1337,
    deterministic: true,
    at: n,
    route: { id: "cart.show", params: {}, search: {} },
    state: {},
    events: [{ at: n, kind: "error", route: "cart.show", error }],
    error,
    fingerprint: fingerprint(error, "cart.show"),
  };
  return { ...base, ...over };
}
const stub = { v: 1, deterministic: false, at: 0, route: { id: "", params: {}, search: {} }, state: {}, events: [] };
const stubId = (n: number): Session["id"] => {
  const r = Session.parse({ ...stub, id: `s-${n}`, error: null, fingerprint: "" });
  if (!r.ok) throw new Error("stub id");
  return r.value.id;
};

async function serve() {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const app = await createApp({
    topology: topology({ sessions: { modules: ["sessions"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  const post = (body: unknown, cookie = "") =>
    app.fetch(
      new Request(`${BASE}/sessions`, {
        method: "POST",
        headers: { ...json, ...(cookie === "" ? {} : { cookie }) },
        body: JSON.stringify(body),
      }),
    );
  const list = (cookie: string, search = "") =>
    app.fetch(new Request(`${BASE}/sessions/list${search}`, { headers: { accept: "application/json", cookie } }));
  return { ctx, app, post, list };
}

/** The `keel-caller` cookie a write minted and its caller hash (base64url SHA-256 of the cookie value, k.server). */
function callerOf(res: Response): { cookie: string; hash: string } {
  const set = res.headers.get("set-cookie") ?? "";
  const value = /keel-caller=([^;]+)/.exec(set)?.[1] ?? "";
  return { cookie: `keel-caller=${value}`, hash: createHash("sha256").update(value).digest("base64url") };
}

const listed = async (res: Response): Promise<Listing> => {
  const body: unknown = await res.json();
  const result: unknown = Reflect.get(Object(Reflect.get(Object(body), "results")), "sessions.list");
  const r = Listing.parse(Reflect.get(Object(result), "value"));
  if (!r.ok) throw new Error(`not an archive: ${JSON.stringify(body)}`);
  return r.value;
};

describe("sessions routes", () => {
  test("a reader lists what was ingested, by fingerprint; failing and since filter", async () => {
    const { post, list, ctx } = await serve();
    const minted = await post(sessionOf(1));
    expect(minted.status).toBe(200);
    const { cookie, hash } = callerOf(minted);
    bindStd(ctx, { "@keel/std-sessions": { ops: { readers: [hash] } } });
    expect((await list(cookie)).status).toBe(200);
    ctx.clock.advance(1000);
    const calm = sessionOf(2, { events: [], error: null, fingerprint: fingerprint(null, "cart.show") });
    expect((await post(calm, cookie)).status).toBe(200);
    const all = await listed(await list(cookie));
    expect(Object.keys(all).sort()).toEqual([fingerprint(null, "cart.show"), sessionOf(1).fingerprint].sort());
    expect(Object.keys(await listed(await list(cookie, "?failing=1")))).toEqual([sessionOf(1).fingerprint]);
    expect(Object.keys(await listed(await list(cookie, "?since=500")))).toEqual([fingerprint(null, "cart.show")]);
  });

  test("a session over 256 KiB is 413 keel.payloadTooLarge and is not archived", async () => {
    const { post } = await serve();
    const big = sessionOf(1, { state: { blob: "x".repeat(262_144) } });
    const res = await post(big);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "keel.payloadTooLarge" } });
  });

  test("the ingest recomputes error and fingerprint from the events; a posted fingerprint is never kept", async () => {
    const { post, list, ctx } = await serve();
    const own = sessionOf(3);
    const forged = sessionOf(3, {
      fingerprint: "abcdefabcdef",
      error: null,
      events: [{ at: 1, kind: "nav", href: "/cart" }, ...own.events],
    });
    const minted = await post(Session.encode(forged));
    expect(minted.status).toBe(200);
    const { cookie, hash } = callerOf(minted);
    bindStd(ctx, { "@keel/std-sessions": { ops: { readers: [hash] } } });
    const all = await listed(await list(cookie));
    expect(Object.keys(all)).toEqual([own.fingerprint]);
    expect(all[own.fingerprint]?.sessions[0]?.error).toEqual(own.error);
    expect(sessionFingerprint(forged)).toBe(own.fingerprint);
  });

  test("the 256 KiB bound holds for the session as filed, after `error` is rebuilt from its first error event", async () => {
    const { post } = await serve();
    const error = { code: "app.big", message: "m".repeat(200_000), data: null };
    const posted = sessionOf(1, { error: null, events: [{ at: 1, kind: "error", route: "cart.show", error }] });
    expect(utf8Length(JSON.stringify(Session.encode(posted)))).toBeLessThan(262_144);
    const res = await post(Session.encode(posted));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "keel.payloadTooLarge" } });
  });

  test("property (seed 1337): addSession keeps sessions.capped and its byte bound covers the archive JSON", () => {
    const op = fc.record({ key: fc.integer({ min: 0, max: 90 }), size: fc.constantFrom(0, 10, 90_000, 240_000) });
    fc.assert(
      fc.property(fc.array(op, { minLength: 1, maxLength: 120 }), (ops) => {
        fresh((st) => {
          ops.forEach((o, i) => {
            expect(put(st, i, `app.e${o.key}`, o.size).ok).toBe(true);
          });
          const a = st.archive.snapshot().state;
          expect(Object.keys(a).length).toBeLessThanOrEqual(ARCHIVE_BOUNDS.fingerprints);
          for (const e of Object.values(a)) {
            expect(e.sessions.length).toBeGreaterThan(0);
            expect(e.sessions.length).toBeLessThanOrEqual(ARCHIVE_BOUNDS.perFingerprint);
            expect(e.count).toBeGreaterThanOrEqual(e.sessions.length);
          }
          const actual = utf8Length(JSON.stringify(a));
          expect(archiveBytes(a)).toBeGreaterThanOrEqual(actual);
          expect(actual).toBeLessThanOrEqual(ARCHIVE_BOUNDS.bytes);
          expect(st.archive.log()).toEqual([]);
        });
      }),
      { seed: 1337, numRuns: 12 },
    );
  });

  test("each kept session's bytes is its encoded JSON length", () => {
    fresh((st) => {
      put(st, 1, "app.x", 1234);
      const x = Object.values(st.archive.snapshot().state)[0]?.sessions[0];
      expect(x?.bytes).toBe(utf8Length(JSON.stringify(x?.session)));
    });
  });

  test("a sixth session of one fingerprint keeps the newest 5 in arrival order", () => {
    fresh((st) => {
      for (let i = 0; i < 7; i++) put(st, i, "app.same", 10);
      const [e] = Object.values(st.archive.snapshot().state);
      expect(e?.count).toBe(7);
      expect(e?.sessions.map((x) => x.session.at)).toEqual([2, 3, 4, 5, 6]);
    });
  });

  test("past 64 fingerprints the oldest `last` goes, ties to the smaller key", () => {
    fresh((st) => {
      for (let i = 0; i < 64; i++) put(st, 0, `app.f${String(i).padStart(2, "0")}`, 0);
      put(st, 1, "app.new", 0);
      const a = st.archive.snapshot().state;
      expect(Object.keys(a)).toHaveLength(64);
      const fp = (code: string) => fingerprint({ code, message: "m", data: null }, "cart.show");
      const gone = [...Array(64).keys()].map((i) => fp(`app.f${String(i).padStart(2, "0")}`)).sort()[0] ?? "";
      expect(Object.hasOwn(a, gone)).toBe(false);
      expect(Object.hasOwn(a, fp("app.new"))).toBe(true);
    });
  });

  test("past 4 MiB the oldest fingerprint goes first and the new one stays", () => {
    fresh((st) => {
      for (let i = 0; i < 24; i++) expect(put(st, i, `app.big${i}`, 200_000).ok).toBe(true);
      const a = st.archive.snapshot().state;
      expect(utf8Length(JSON.stringify(a))).toBeLessThanOrEqual(ARCHIVE_BOUNDS.bytes);
      const lasts = Object.values(a).map((e) => e.last);
      expect(Math.max(...lasts)).toBe(23);
      expect(Math.min(...lasts)).toBe(24 - lasts.length);
    });
  });
});

/** File a session of error `code` with a `size`-byte state blob at ingest time `at`. */
function put(st: ReturnType<typeof archiveStores>, at: number, code: string, size: number) {
  const error = { code, message: "m", data: null };
  const s = sessionOf(at, {
    error,
    events: [{ at, kind: "error", route: "cart.show", error }],
    state: size === 0 ? {} : { blob: "y".repeat(size) },
    fingerprint: fingerprint(error, "cart.show"),
  });
  return tx(st.addSession, { at, session: s });
}
