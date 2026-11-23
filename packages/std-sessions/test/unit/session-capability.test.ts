// The `session` capability, one implementation at a time: the request a real `put` sends and what it answers, the
// 64 KiB bound on `keepalive`, the uploads it refuses before any request, a shell that sends nothing, and a sim that
// keeps what it was given.
// Seed 1337 (no random inputs)
import { createCtx } from "@keel/ctx";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Session } from "../../src/Session.schema.ts";
import { PutFailed } from "../../src/internal/PutFailed.ts";
import { pageOrigin } from "../../src/internal/pageOrigin.ts";
import { session } from "../../src/session.ts";

afterEach(() => vi.unstubAllGlobals());

const PAGE = "https://app.test";
const URL_OK = new URL(`${PAGE}/sessions`);
const sample = (pad = ""): Session => {
  const parsed = Session.parse({
    v: 1,
    id: "s1",
    seed: 1337,
    deterministic: true,
    at: 0,
    route: { id: "cart.show", params: {}, search: {} },
    state: { pad },
    events: [],
    error: null,
    fingerprint: "000000000000",
  });
  if (!parsed.ok) throw new Error("the fixture session parses");
  return parsed.value;
};
/** A session whose encoded JSON is exactly `bytes` long. */
const sized = (bytes: number): Session => sample("y".repeat(bytes - JSON.stringify(Session.encode(sample())).length));

/** A real sink on a page of origin `origin`, with every fetch it makes noted and answered by `status`. */
function real(origin = PAGE, status: number | Error = 204) {
  vi.stubGlobal("location", { origin });
  const calls: { url: unknown; init: RequestInit | undefined }[] = [];
  vi.stubGlobal("fetch", async (url: unknown, init?: RequestInit) => {
    calls.push({ url, init });
    if (status instanceof Error) throw status;
    return new Response(null, { status });
  });
  return { sink: session(createCtx({ mode: "real" })), calls };
}

describe("session: real", () => {
  test("put POSTs the encoded session as JSON to the url, same-origin credentials, never following a redirect", async () => {
    const { sink, calls } = real();
    const s = sample("hello");
    expect(await sink.put(URL_OK, s)).toEqual({ ok: true, value: null });
    expect(calls).toEqual([
      {
        url: URL_OK,
        init: {
          method: "POST",
          body: JSON.stringify(Session.encode(s)),
          headers: { "content-type": "application/json" },
          keepalive: true,
          credentials: "same-origin",
          redirect: "error",
        },
      },
    ]);
  });

  test("keepalive is set up to a body of 64 KiB and not beyond; bytes are counted, not characters", async () => {
    const { sink, calls } = real();
    await sink.put(URL_OK, sized(65_536));
    await sink.put(URL_OK, sized(65_537));
    await sink.put(URL_OK, sample("é".repeat(32_700)));
    expect(calls.map((c) => [String(c.init?.body).length, c.init?.keepalive])).toEqual([
      [65_536, true],
      [65_537, false],
      [JSON.stringify(Session.encode(sample())).length + 32_700, false],
    ]);
  });

  test("any 2xx is ok; another status is sessions.putFailed with it; a fetch that throws is status 0", async () => {
    for (const status of [200, 201, 204, 299])
      expect((await real(PAGE, status).sink.put(URL_OK, sample())).ok, String(status)).toBe(true);
    for (const status of [301, 400, 413, 500]) {
      const r = await real(PAGE, status).sink.put(URL_OK, sample());
      expect(r, String(status)).toEqual({ ok: false, error: PutFailed.make({ status }) });
    }
    const off = await real(PAGE, new Error("offline")).sink.put(URL_OK, sample());
    expect(off).toEqual({
      ok: false,
      error: { code: "sessions.putFailed", message: "sessions.putFailed", data: { status: 0 } },
    });
  });

  test("an upload to another origin, with credentials in the url, or from an opaque page fails with status 0 and no request", async () => {
    for (const [url, origin] of [
      ["https://other.test/sessions", PAGE],
      ["http://app.test/sessions", PAGE],
      ["https://user:pw@app.test/sessions", PAGE],
      ["https://app.test/sessions", "null"],
      ["ftp://app.test/sessions", "ftp://app.test"],
    ] as const) {
      const { sink, calls } = real(origin);
      expect(await sink.put(new URL(url), sample()), url).toEqual({ ok: false, error: PutFailed.make({ status: 0 }) });
      expect(calls).toEqual([]);
    }
  });

  test("it keeps nothing, and its ids are Session ids, each new", () => {
    const { sink } = real();
    expect(sink.taken()).toEqual([]);
    const ids = [sink.id(), sink.id(), sink.id()];
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(Session.parse(Session.encode({ ...sample(), id })).ok).toBe(true);
  });
});

describe("session: shell", () => {
  test("put answers ok(null) and sends nothing; nothing is kept; ids are Session ids", async () => {
    const calls: unknown[] = [];
    vi.stubGlobal("fetch", async (...args: unknown[]) => {
      calls.push(args);
      return new Response(null, { status: 500 });
    });
    const sink = session(createCtx({ mode: "shell", seed: 1337 }));
    expect(await sink.put(URL_OK, sample())).toEqual({ ok: true, value: null });
    expect(await sink.put(new URL("https://other.test/x"), sample())).toEqual({ ok: true, value: null });
    expect(calls).toEqual([]);
    expect(sink.taken()).toEqual([]);
    const ids = [sink.id(), sink.id()];
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(Session.parse(Session.encode({ ...sample(), id })).ok).toBe(true);
  });
});

describe("session: sim", () => {
  test("put keeps each url and session, oldest first, and sends nothing; taken() is a copy", async () => {
    const calls: unknown[] = [];
    vi.stubGlobal("fetch", async (...args: unknown[]) => {
      calls.push(args);
      return new Response(null);
    });
    const sink = session(createCtx({ mode: "sim", seed: 1337 }));
    const first = sample("one");
    const second = sample("two");
    const other = new URL("https://elsewhere.test/sessions");
    expect(await sink.put(URL_OK, first)).toEqual({ ok: true, value: null });
    expect(await sink.put(other, second)).toEqual({ ok: true, value: null });
    expect(sink.taken()).toEqual([
      { url: URL_OK, session: first },
      { url: other, session: second },
    ]);
    const taken = sink.taken();
    expect(taken).not.toBe(sink.taken());
    await sink.put(URL_OK, first);
    expect(taken).toHaveLength(2);
    expect(sink.taken()).toHaveLength(3);
    expect(calls).toEqual([]);
  });

  test("ids follow the seed: the same seed draws the same ids in order, another seed others", () => {
    const draw = (seed: number): string[] => {
      const sink = session(createCtx({ mode: "sim", seed }));
      return [sink.id(), sink.id(), sink.id()];
    };
    expect(draw(7)).toEqual(draw(7));
    expect(new Set(draw(7)).size).toBe(3);
    expect(draw(8)).not.toEqual(draw(7));
  });

  test("one ctx has one sink", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1 });
    await session(ctx).put(URL_OK, sample());
    expect(session(ctx).taken()).toHaveLength(1);
    expect(session(createCtx({ mode: "sim", seed: 1 })).taken()).toEqual([]);
  });
});

describe("pageOrigin", () => {
  test("self.origin when there is one, else location.origin, else the opaque origin", () => {
    vi.stubGlobal("self", { origin: "https://from-self.test" });
    vi.stubGlobal("location", { origin: "https://from-location.test" });
    expect(pageOrigin()).toBe("https://from-self.test");
    vi.stubGlobal("self", { origin: undefined });
    expect(pageOrigin()).toBe("https://from-location.test");
    vi.stubGlobal("self", undefined);
    expect(pageOrigin()).toBe("https://from-location.test");
    vi.stubGlobal("location", undefined);
    expect(pageOrigin()).toBe("null");
    vi.stubGlobal("self", { origin: "null" });
    expect(pageOrigin()).toBe("null");
  });
});
