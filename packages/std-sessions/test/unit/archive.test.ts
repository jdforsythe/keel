// The ingest archive (std.sessions Ingest): invariant `sessions.capped` on store `sessions.archive`, checked state by
// state, and which fingerprint `addSession` evicts at the 64-fingerprint and 4 MiB bounds.
// Seed 1337
import { scope } from "@keel/reactive";
import { type Store, isolate, tx } from "@keel/store";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Archive } from "../../src/Archive.schema.ts";
import { Session } from "../../src/Session.schema.ts";
import { archiveStores } from "../../src/archiveStores.ts";
import { ARCHIVE_BOUNDS } from "../../src/routes/ARCHIVE_BOUNDS.ts";
import { archiveBytes } from "../../src/routes/archiveBytes.ts";
import { entryBytes } from "../../src/routes/entryBytes.ts";
import { itemBytes } from "../../src/routes/itemBytes.ts";

type Stores = ReturnType<typeof archiveStores>;

/** `fn` over a fresh `archiveStores()` in its own isolated scope, as a request has it. */
function fresh<T>(fn: (st: Stores) => T): T {
  const sc = scope(() => undefined, { detached: true });
  isolate(sc);
  try {
    return sc.run(() => fn(archiveStores()));
  } finally {
    sc.dispose();
  }
}
/** A session of fingerprint `fp` whose encoded JSON is `bytes` long (at least 400). */
function session(fp: string, bytes = 400): Session {
  const make = (pad: string): Session => {
    const parsed = Session.parse({
      v: 1,
      id: "s1",
      deterministic: false,
      at: 0,
      route: { id: "cart.show", params: {}, search: {} },
      state: { pad },
      events: [],
      error: null,
      fingerprint: fp,
    });
    if (!parsed.ok) throw new Error("the fixture session parses");
    return parsed.value;
  };
  const empty = JSON.stringify(Session.encode(make(""))).length;
  if (bytes < empty) throw new Error(`a session is at least ${empty} bytes`);
  return make("y".repeat(bytes - empty));
}
const fp = (n: number): string => n.toString(16).padStart(12, "0");
const entry = (sessions: number, count = sessions, bytes = 400, name = fp(1)) => ({
  count,
  first: 0,
  last: 0,
  sessions: Array.from({ length: sessions }, () => ({ bytes, session: session(name) })),
});
/** Whether `state` may be committed to the archive store. */
function allowed(state: Archive): boolean {
  return fresh(({ archive }) => {
    const r = archive.check(state);
    if (!r.ok) expect(r.error.code).toBe("store.invariant");
    else expect(r.value).toEqual(state);
    return r.ok;
  });
}

describe("archiveStores", () => {
  test("store sessions.archive starts empty, keeps no log, and addSession is bound to it", () => {
    fresh(({ archive, addSession }) => {
      expect(archive.id).toBe("sessions.archive");
      expect(archive.snapshot().state).toEqual({});
      expect(tx(addSession, { at: 5, session: session(fp(1)) }).ok).toBe(true);
      expect(Object.keys(archive.snapshot().state)).toEqual([fp(1)]);
      expect(archive.log()).toEqual([]);
    });
  });
});

describe("invariant sessions.capped", () => {
  test("the empty archive, and one fingerprint with 1 to 5 sessions, hold", () => {
    expect(allowed({})).toBe(true);
    for (const n of [1, 2, 5]) expect(allowed({ [fp(1)]: entry(n) }), `${n} sessions`).toBe(true);
  });

  test("a fingerprint with no session, or more than 5, does not", () => {
    expect(allowed({ [fp(1)]: entry(0, 1) })).toBe(false);
    expect(allowed({ [fp(1)]: entry(6) })).toBe(false);
    expect(allowed({ [fp(1)]: entry(6, 9) })).toBe(false);
  });

  test("count is at least the sessions kept", () => {
    expect(allowed({ [fp(1)]: entry(2, 2) })).toBe(true);
    expect(allowed({ [fp(1)]: entry(2, 9) })).toBe(true);
    expect(allowed({ [fp(1)]: entry(2, 1) })).toBe(false);
    expect(allowed({ [fp(1)]: entry(5, 4) })).toBe(false);
  });

  test("every fingerprint must hold, not just one", () => {
    expect(allowed({ [fp(1)]: entry(1), [fp(2)]: entry(0, 1), [fp(3)]: entry(1) })).toBe(false);
    expect(allowed({ [fp(1)]: entry(6), [fp(2)]: entry(1) })).toBe(false);
    expect(allowed({ [fp(1)]: entry(1), [fp(2)]: entry(2, 1) })).toBe(false);
    expect(allowed({ [fp(1)]: entry(1), [fp(2)]: entry(5), [fp(3)]: entry(3, 7) })).toBe(true);
  });

  test("at most 64 fingerprints", () => {
    const of = (n: number): Archive => Object.fromEntries(Array.from({ length: n }, (_, i) => [fp(i), entry(1)]));
    expect(ARCHIVE_BOUNDS.fingerprints).toBe(64);
    expect(allowed(of(64))).toBe(true);
    expect(allowed(of(65))).toBe(false);
  });

  test("the archive JSON, by the tracked bytes, is at most 4 MiB: exactly 4 MiB holds, one more byte does not", () => {
    expect(ARCHIVE_BOUNDS.bytes).toBe(4 * 1024 * 1024);
    const sized = (bytes: number): Archive => ({
      [fp(1)]: { ...entry(1), sessions: [{ bytes, session: session(fp(1)) }] },
    });
    const fixed = archiveBytes(sized(0));
    const atBound = sized(ARCHIVE_BOUNDS.bytes - fixed);
    expect(archiveBytes(atBound)).toBe(ARCHIVE_BOUNDS.bytes);
    expect(allowed(atBound)).toBe(true);
    expect(allowed(sized(ARCHIVE_BOUNDS.bytes - fixed + 1))).toBe(false);
    expect(allowed(sized(ARCHIVE_BOUNDS.bytes))).toBe(false);
  });
});

describe("the byte bound's arithmetic", () => {
  test("archiveBytes is 2, plus each fingerprint's entry bytes, plus each kept session's bytes and 48", () => {
    expect(archiveBytes({})).toBe(2);
    expect(entryBytes(fp(1))).toBe(14 + 128);
    expect(entryBytes("é")).toBe(4 + 128);
    expect(itemBytes({ bytes: 1000, session: session(fp(1)) })).toBe(1048);
    const archive: Archive = {
      [fp(1)]: { ...entry(2), sessions: [100, 250].map((bytes) => ({ bytes, session: session(fp(1)) })) },
      [fp(2)]: { ...entry(1), sessions: [{ bytes: 7, session: session(fp(2)) }] },
    };
    expect(archiveBytes(archive)).toBe(2 + 142 + 148 + 298 + 142 + 55);
  });

  test("property: the bound is never under the archive's real JSON length", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.nat(40), fc.integer({ min: 400, max: 2000 })), { maxLength: 12 }), (writes) => {
        fresh(({ archive, addSession }) => {
          writes.forEach(([n, bytes], at) =>
            expect(tx(addSession, { at, session: session(fp(n), bytes) }).ok).toBe(true),
          );
          expect(archiveBytes(archive.snapshot().state)).toBeGreaterThanOrEqual(
            JSON.stringify(Archive.encode(archive.snapshot().state)).length,
          );
        });
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("addSession", () => {
  const put = (st: { addSession: Stores["addSession"] }, at: number, name: string, bytes = 400) =>
    tx(st.addSession, { at, session: session(name, bytes) });
  const kept = (archive: Store<Archive>): string[] => Object.keys(archive.snapshot().state).sort();

  test("a session is filed under its fingerprint with its encoded length; count, first and last follow the writes", () => {
    fresh((st) => {
      put(st, 10, fp(1), 500);
      expect(st.archive.snapshot().state).toEqual({
        [fp(1)]: { count: 1, first: 10, last: 10, sessions: [{ bytes: 500, session: session(fp(1), 500) }] },
      });
      put(st, 20, fp(1), 600);
      put(st, 15, fp(2));
      expect(st.archive.snapshot().state[fp(1)]).toMatchObject({ count: 2, first: 10, last: 20 });
      expect(st.archive.snapshot().state[fp(1)]?.sessions.map((x) => x.bytes)).toEqual([500, 600]);
      expect(st.archive.snapshot().state[fp(2)]).toMatchObject({ count: 1, first: 15, last: 15 });
    });
  });

  test("the bytes filed are UTF-8 bytes, not characters", () => {
    fresh((st) => {
      const base = session(fp(1));
      const wide = { ...base, state: { pad: "é".repeat(10) } };
      tx(st.addSession, { at: 1, session: wide });
      const chars = JSON.stringify(Session.encode(wide)).length;
      expect(st.archive.snapshot().state[fp(1)]?.sessions[0]?.bytes).toBe(chars + 10);
    });
  });

  test("past 5 sessions of a fingerprint the oldest goes and count keeps counting", () => {
    fresh((st) => {
      for (let i = 0; i < 7; i++) put(st, i, fp(1), 400 + i);
      const e = st.archive.snapshot().state[fp(1)];
      expect(e).toMatchObject({ count: 7, first: 0, last: 6 });
      expect(e?.sessions.map((x) => x.bytes)).toEqual([402, 403, 404, 405, 406]);
    });
  });

  test("a 65th fingerprint evicts the one written longest ago, whatever its key and wherever it sits", () => {
    fresh((st) => {
      put(st, 10, fp(1));
      put(st, 5, fp(900));
      for (let i = 0; i < 62; i++) put(st, 20 + i, fp(100 + i));
      expect(kept(st.archive)).toHaveLength(64);
      put(st, 99, fp(2));
      expect(kept(st.archive)).toHaveLength(64);
      expect(st.archive.snapshot().state[fp(900)]).toBeUndefined();
      expect(st.archive.snapshot().state[fp(1)]).toBeDefined();
      expect(st.archive.snapshot().state[fp(2)]).toBeDefined();
    });
  });

  test("the fingerprint just written never goes, even when its time is the oldest", () => {
    fresh((st) => {
      for (let i = 0; i < 64; i++) put(st, 100 + i, fp(100 + i));
      put(st, 1, fp(1));
      expect(kept(st.archive)).toHaveLength(64);
      expect(st.archive.snapshot().state[fp(1)]).toMatchObject({ count: 1, last: 1 });
      expect(st.archive.snapshot().state[fp(100)]).toBeUndefined();
      expect(st.archive.snapshot().state[fp(101)]).toBeDefined();
    });
  });

  test("among fingerprints written at one time the smaller key goes first, whatever the order they were filed in", () => {
    for (const order of [
      [3, 1, 2],
      [1, 2, 3],
      [2, 3, 1],
    ]) {
      fresh((st) => {
        for (const n of order) put(st, 7, fp(n));
        for (let i = 0; i < 61; i++) put(st, 50 + i, fp(100 + i));
        put(st, 200, fp(900));
        expect(st.archive.snapshot().state[fp(1)], order.join()).toBeUndefined();
        expect(st.archive.snapshot().state[fp(2)], order.join()).toBeDefined();
        put(st, 201, fp(901));
        expect(st.archive.snapshot().state[fp(2)], order.join()).toBeUndefined();
        expect(st.archive.snapshot().state[fp(3)], order.join()).toBeDefined();
      });
    }
  });

  test("past 4 MiB the oldest fingerprints go until the archive fits, and no more than that", () => {
    const mib = 1024 * 1024;
    fresh((st) => {
      put(st, 1, fp(1), mib);
      put(st, 2, fp(2), mib);
      put(st, 3, fp(3), mib);
      expect(kept(st.archive)).toEqual([fp(1), fp(2), fp(3)]);
      put(st, 4, fp(4), 1.5 * mib);
      expect(kept(st.archive)).toEqual([fp(2), fp(3), fp(4)]);
      put(st, 5, fp(5), 3 * mib);
      expect(kept(st.archive)).toEqual([fp(5)]);
      put(st, 6, fp(6), fixedTime(900_000));
      expect(kept(st.archive)).toEqual([fp(5), fp(6)]);
    });
  });

  test("an archive of exactly 4 MiB is kept whole; one more byte evicts", () => {
    const sizeFor = (total: number): number => total - 2 - 2 * 142 - 2 * 48 - 1000;
    fresh((st) => {
      put(st, 1, fp(1), 1000);
      put(st, 2, fp(2), sizeFor(ARCHIVE_BOUNDS.bytes));
      expect(archiveBytes(st.archive.snapshot().state)).toBe(ARCHIVE_BOUNDS.bytes);
      expect(kept(st.archive)).toEqual([fp(1), fp(2)]);
    });
    fresh((st) => {
      put(st, 1, fp(1), 1000);
      put(st, 2, fp(2), sizeFor(ARCHIVE_BOUNDS.bytes) + 1);
      expect(kept(st.archive)).toEqual([fp(2)]);
    });
  });

  test("a session over 4 MiB on its own is refused by the invariant and the archive is unchanged", () => {
    fresh((st) => {
      put(st, 1, fp(1));
      const before = st.archive.snapshot().state;
      const r = put(st, 2, fp(2), 5 * 1024 * 1024);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("store.invariant");
      expect(st.archive.snapshot().state).toEqual(before);
    });
  });
});
