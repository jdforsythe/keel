// @vitest-environment node
// `@keel/std-sessions/routes` (std.sessions Ingest, backlog 0093) over createApp with a sim ctx: ingest, list with
// `failing` and `since`, 413 past 256 KiB, the re-fingerprint, archive bounds (`sessions.capped`) and the reader
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
import { Archive } from "../src/Archive.schema.ts";
import { Session } from "../src/Session.schema.ts";
import { archiveStores } from "../src/archiveStores.ts";
import { fingerprint } from "../src/internal/fingerprint.ts";
import { routes } from "../src/routes.ts";
import { ARCHIVE_BOUNDS } from "../src/routes/ARCHIVE_BOUNDS.ts";
import { ingestFingerprint } from "../src/routes/ingestFingerprint.ts";

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
    events: [{ at: n, kind: "error", error }],
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

const listed = async (res: Response): Promise<Archive> => {
  const body: unknown = await res.json();
  const result: unknown = Reflect.get(Object(Reflect.get(Object(body), "results")), "sessions.list");
  const r = Archive.parse(Reflect.get(Object(result), "value"));
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

  test("the ingest re-fingerprints: a forged fingerprint is replaced when the session holds the error's route", () => {
    const s = sessionOf(3, { fingerprint: "000000000000" });
    expect(ingestFingerprint(s)).toBe(sessionOf(3).fingerprint);
    const moved = sessionOf(3, {
      fingerprint: "abcdefabcdef",
      events: [{ at: 1, kind: "nav", href: "/other" }, ...sessionOf(3).events],
    });
    expect(ingestFingerprint(moved)).toBe("abcdefabcdef");
    expect(ingestFingerprint({ ...moved, fingerprint: "__proto__" })).toBe(sessionOf(3).fingerprint);
  });

  test("property (seed 1337): addSession keeps sessions.capped (64 fingerprints, 5 each, count kept)", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 90 }), { minLength: 1, maxLength: 200 }), (keys) => {
        fresh((st) => {
          const counts = new Map<string, number>();
          keys.forEach((k, i) => {
            const error = { code: `app.e${k}`, message: "m", data: null };
            const s = sessionOf(i, { error, events: [], fingerprint: fingerprint(error, "cart.show") });
            counts.set(s.fingerprint, (counts.get(s.fingerprint) ?? 0) + 1);
            expect(tx(st.addSession, { at: i, session: s }).ok).toBe(true);
          });
          const a = st.archive.snapshot().state;
          expect(Object.keys(a).length).toBeLessThanOrEqual(ARCHIVE_BOUNDS.fingerprints);
          for (const [fp, e] of Object.entries(a)) {
            expect(e.sessions.length).toBe(Math.min(ARCHIVE_BOUNDS.perFingerprint, e.count));
            expect(e.count).toBe(counts.get(fp));
          }
          expect(st.archive.log()).toEqual([]);
        });
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  test("the archive stays within 4 MiB: the oldest fingerprint goes first", () => {
    fresh((st) => {
      for (let i = 0; i < 24; i++) {
        const error = { code: `app.big${i}`, message: "m", data: null };
        const s = sessionOf(i, { error, events: [], state: { blob: "y".repeat(200_000) } });
        expect(tx(st.addSession, { at: i, session: { ...s, fingerprint: fingerprint(error, "cart.show") } }).ok).toBe(
          true,
        );
      }
      const a = st.archive.snapshot().state;
      expect(JSON.stringify(a).length).toBeLessThanOrEqual(ARCHIVE_BOUNDS.bytes);
      const lasts = Object.values(a).map((e) => e.last);
      expect(Math.max(...lasts)).toBe(23);
      expect(Math.min(...lasts)).toBeGreaterThan(0);
    });
  });
});
