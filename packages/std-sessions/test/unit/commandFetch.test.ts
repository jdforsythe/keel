// `keel session capture` and `keel session ingest` over a scripted `io.fetch`: the URL and headers each sends, the
// session records and files of what came back, and the one diagnostic of each way it can fail. With the helpers they
// are made of: the file a session goes to, its record and text, the NDJSON reader, and what a URL may show or carry.
// Seed 1337
import type { Io } from "@keel/cli";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Session } from "../../src/Session.schema.ts";
import { commandFetch } from "../../src/internal/commandFetch.ts";
import { fileOf } from "../../src/internal/fileOf.ts";
import { recordsOf } from "../../src/internal/recordsOf.ts";
import { safeUrl } from "../../src/internal/safeUrl.ts";
import { sessionOut } from "../../src/internal/sessionOut.ts";
import { sessionText } from "../../src/internal/sessionText.ts";
import { shownUrl } from "../../src/internal/shownUrl.ts";

const FP = "7f3a9c01d2e4";
const raw = (over: Record<string, unknown> = {}) => ({
  v: 1,
  id: "s1",
  seed: 7,
  deterministic: true,
  at: 0,
  route: { id: "cart.show", params: {}, search: {} },
  state: {},
  events: [
    { at: 1, kind: "fire", id: "cart.add", event: { type: "click" } },
    { at: 1, kind: "tx", store: "cart", name: "cart.add", payload: {} },
    { at: 2, kind: "nav", href: "/cart" },
    { at: 3, kind: "net", online: false },
    { at: 4, kind: "resource", id: "cart.items", state: "ready" },
    { at: 5, kind: "error", route: "cart.show", error: { code: "cart.full", message: "full", data: null } },
  ],
  error: { code: "cart.full", message: "full", data: null },
  fingerprint: FP,
  ...over,
});
const session = (over: Record<string, unknown> = {}): Session => {
  const parsed = Session.parse(raw(over));
  if (!parsed.ok) throw new Error("the fixture session parses");
  return parsed.value;
};
const record = (file: string, over: Record<string, unknown> = {}) => ({
  kind: "session",
  id: "s1",
  fingerprint: FP,
  route: "cart.show",
  events: 6,
  inputs: 3,
  error: "cart.full",
  file,
  ...over,
});
const summary = (op: string, ok: boolean, sessions: number) => ({
  kind: "summary",
  ok,
  name: `session ${op}`,
  counts: { sessions },
});
const diag = (code: string, message: string, see = code === "E1056" ? "k.inspect" : "k.cli") => ({ kind: "diag", code, message, see });

/** An `io` whose fetch answers with `answer` and notes what it was asked. */
function net(answer: (url: string) => Response | Promise<Response>, env?: Record<string, string>) {
  const asked: { url: string; init: RequestInit | undefined }[] = [];
  const io: Io = {
    cwd: "/project",
    ...(env === undefined ? {} : { env }),
    fetch: async (url, init) => {
      asked.push({ url, init });
      return answer(url);
    },
  };
  return { io, asked };
}
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });
const inspect = (value: unknown): Response => json({ sections: { "sessions.live": { value }, other: {} }, extra: 1 });
const listed = (value: unknown): Response => json({ results: { "sessions.list": { ok: true, value } } });

describe("session capture", () => {
  test("fetches <url>/__keel/inspect, by default from localhost:5173, without the url's trailing slashes", async () => {
    const a = net(() => inspect(null));
    await commandFetch("capture", {}, a.io);
    expect(a.asked).toEqual([{ url: "http://localhost:5173/__keel/inspect", init: undefined }]);
    const b = net(() => inspect(null));
    await commandFetch("capture", { target: "http://app.test:4000///" }, b.io);
    expect(b.asked.map((x) => x.url)).toEqual(["http://app.test:4000/__keel/inspect"]);
    const c = net(() => inspect(null));
    await commandFetch("capture", { target: "http://app.test/a//b" }, c.io);
    expect(c.asked.map((x) => x.url)).toEqual(["http://app.test/a//b/__keel/inspect"]);
  });

  test("the live session is written to .keel/sessions/<fingerprint>-0.json and reported as a session record", async () => {
    const { io } = net(() => inspect(raw()));
    const out = await commandFetch("capture", { target: "http://app.test" }, io);
    const file = `.keel/sessions/${FP}-0.json`;
    expect(out.records).toEqual([record(file), summary("capture", true, 1)]);
    expect(out.writes).toEqual([{ path: file, content: sessionText(session()), readonly: false }]);
  });

  test("a session with no error is reported with error null", async () => {
    const { io } = net(() => inspect(raw({ error: null, events: [] })));
    const out = await commandFetch("capture", {}, io);
    expect(out.records[0]).toEqual(record(`.keel/sessions/${FP}-0.json`, { error: null, events: 0, inputs: 0 }));
  });

  test("each way to have nothing to save is one E1056 with its own message, and nothing is written", async () => {
    const answers: readonly [string, () => Response, string][] = [
      ["absent", () => json({ sections: { other: {} } }), "has no sessions.live section"],
      ["null", () => inspect(null), "found no recorder (sessions.live is null)"],
      [
        "error",
        () => json({ sections: { "sessions.live": { error: { code: "E1057", message: "read\nthrew" } } } }),
        "sessions.live is an error: read threw",
      ],
      ["not a session", () => inspect({ v: 2 }), "sessions.live is not a session"],
      ["no value", () => json({ sections: { "sessions.live": {} } }), "sessions.live is not a session"],
    ];
    for (const [name, answer, why] of answers) {
      const { io } = net(answer);
      expect(await commandFetch("capture", {}, io), name).toEqual({
        records: [diag("E1056", `session capture ${why}: http://localhost:5173`), summary("capture", false, 0)],
        writes: [],
      });
    }
  });

  test("each failure is one E1056 naming the target's origin only, and no write", async () => {
    const target = "http://user:secret@app.test:4000/base?token=1";
    const failing = async (answer: () => Response | Promise<Response>, why: string) => {
      const { io } = net(answer);
      expect(await commandFetch("capture", { target }, io), why).toEqual({
        records: [diag("E1056", `session capture ${why}: http://app.test:4000`), summary("capture", false, 0)],
        writes: [],
      });
    };
    await failing(() => Promise.reject(new Error("down")), "target unreachable");
    await failing(() => json({}, 503), "target answered 503");
    await failing(() => new Response("<html>"), "not JSON");
    await failing(() => json({ sections: {} }), "has no sessions.live section");
    await failing(() => json({ other: 1 }), "has no sessions.live section");
    await failing(() => json({ sections: { "sessions.live": 5 } }), "has no sessions.live section");
    await failing(() => inspect({ v: 2 }), "sessions.live is not a session");
    await failing(() => inspect("session"), "sessions.live is not a session");
    await failing(() => inspect(raw({ id: "a/b" })), "sessions.live is not a session");
  });

  test("without io.fetch it is I1055, which is not a failure", async () => {
    expect(await commandFetch("capture", {}, { cwd: "/project" })).toEqual({
      records: [diag("I1055", "session capture needs a network (io.fetch)"), summary("capture", true, 0)],
      writes: [],
    });
    expect((await commandFetch("ingest", { target: "https://s.test" }, { cwd: "/p" })).records[0]).toEqual(
      diag("I1055", "session ingest needs a network (io.fetch)"),
    );
  });
});

describe("session ingest", () => {
  test("needs a url: none, or only slashes, is E1052 and nothing is fetched", async () => {
    for (const input of [{}, { target: "" }, { target: "///" }]) {
      const { io, asked } = net(() => listed({}));
      expect(await commandFetch("ingest", input, io)).toEqual({
        records: [diag("E1052", "session ingest needs the ingest service url"), summary("ingest", false, 0)],
        writes: [],
      });
      expect(asked).toEqual([]);
    }
  });

  test("a url that is neither https nor this machine is refused before any request", async () => {
    const { io, asked } = net(() => listed({}));
    expect(await commandFetch("ingest", { target: "http://sessions.example.com/" }, io)).toEqual({
      records: [diag("E1056", "session ingest needs https: http://sessions.example.com"), summary("ingest", false, 0)],
      writes: [],
    });
    expect(asked).toEqual([]);
  });

  test("asks <url>/sessions/list for JSON, with failing=1 and since only when given", async () => {
    const asks = async (input: { failing?: boolean; since?: string }) => {
      const { io, asked } = net(() => listed({}));
      await commandFetch("ingest", { target: "https://s.test//", ...input }, io);
      return asked;
    };
    expect(await asks({})).toEqual([
      { url: "https://s.test/sessions/list", init: { headers: { accept: "application/json" } } },
    ]);
    expect((await asks({ failing: true }))[0]?.url).toBe("https://s.test/sessions/list?failing=1");
    expect((await asks({ failing: false }))[0]?.url).toBe("https://s.test/sessions/list");
    expect((await asks({ since: "2026-01-01T00:00:00Z" }))[0]?.url).toBe(
      "https://s.test/sessions/list?since=2026-01-01T00%3A00%3A00Z",
    );
    expect((await asks({ failing: true, since: "t" }))[0]?.url).toBe("https://s.test/sessions/list?failing=1&since=t");
    expect((await asks({ since: "" }))[0]?.url).toBe("https://s.test/sessions/list?since=");
  });

  test("KEEL_SESSIONS_TOKEN goes as the caller cookie: __Host-keel-caller on https, keel-caller on this machine", async () => {
    const env = { KEEL_SESSIONS_TOKEN: "t0ken" };
    const secure = net(() => listed({}), env);
    await commandFetch("ingest", { target: "https://s.test" }, secure.io);
    expect(secure.asked[0]?.init).toEqual({
      headers: { accept: "application/json", cookie: "__Host-keel-caller=t0ken" },
    });
    const local = net(() => listed({}), env);
    await commandFetch("ingest", { target: "http://localhost:4200" }, local.io);
    expect(local.asked[0]).toEqual({
      url: "http://localhost:4200/sessions/list",
      init: { headers: { accept: "application/json", cookie: "keel-caller=t0ken" } },
    });
  });

  test("each archived session is written, fingerprints in order, numbered across them; one that is no session is skipped", async () => {
    const other = "0123456789ab";
    const { io } = net(() =>
      listed({
        [FP]: { sessions: [raw({ id: "s2" }), "junk", { v: 2 }, raw({ id: "s3", error: null })], count: 9 },
        [other]: { sessions: [raw({ id: "s1", fingerprint: other })] },
        empty: { sessions: [] },
      }),
    );
    const out = await commandFetch("ingest", { target: "https://s.test" }, io);
    expect(out.records).toEqual([
      record(`.keel/sessions/${other}-0.json`, { id: "s1", fingerprint: other }),
      record(`.keel/sessions/${FP}-1.json`, { id: "s2" }),
      record(`.keel/sessions/${FP}-2.json`, { id: "s3", error: null }),
      summary("ingest", true, 3),
    ]);
    expect(out.writes).toEqual([
      {
        path: `.keel/sessions/${other}-0.json`,
        content: sessionText(session({ id: "s1", fingerprint: other })),
        readonly: false,
      },
      { path: `.keel/sessions/${FP}-1.json`, content: sessionText(session({ id: "s2" })), readonly: false },
      {
        path: `.keel/sessions/${FP}-2.json`,
        content: sessionText(session({ id: "s3", error: null })),
        readonly: false,
      },
    ]);
  });

  test("an empty archive passes with nothing written", async () => {
    const { io } = net(() => listed({}));
    expect(await commandFetch("ingest", { target: "https://s.test" }, io)).toEqual({
      records: [summary("ingest", true, 0)],
      writes: [],
    });
  });

  test("each failure is one E1056 naming the service's origin only", async () => {
    const target = "https://user:secret@s.test/base?token=1";
    const failing = async (answer: () => Response | Promise<Response>, why: string) => {
      const { io } = net(answer);
      expect(await commandFetch("ingest", { target }, io), why).toEqual({
        records: [diag("E1056", `session ingest ${why}: https://s.test`), summary("ingest", false, 0)],
        writes: [],
      });
    };
    const without = "answered without a sessions.list result";
    await failing(() => Promise.reject(new Error("down")), "target unreachable");
    await failing(() => json({ error: { code: "keel.denied" } }, 403), "target answered 403");
    await failing(() => new Response("<html>"), "not JSON");
    await failing(() => json({}), without);
    await failing(() => json({ results: {} }), without);
    await failing(() => json({ results: { "sessions.list": { ok: false, error: { code: "x" } } } }), without);
    await failing(() => json({ results: { "sessions.list": { value: {} } } }), without);
    await failing(() => json({ results: { "sessions.list": { ok: true } } }), without);
    await failing(() => listed({ [FP]: {} }), without);
    await failing(() => listed({ [FP]: { sessions: "none" } }), without);
    await failing(() => listed([]), without);
  });
});

describe("fileOf", () => {
  test(".keel/sessions/<fingerprint>-<index>.json, from a fingerprint of 12 hex characters", () => {
    expect(fileOf(session(), 0)).toBe(`.keel/sessions/${FP}-0.json`);
    expect(fileOf(session(), 12)).toBe(`.keel/sessions/${FP}-12.json`);
  });

  test("any other fingerprint is written as twelve zeros, so the name never comes from the session", () => {
    for (const fingerprint of [
      "",
      "7f3a9c01d2e",
      "7f3a9c01d2e4a",
      "7F3A9C01D2E4",
      "../../../etc",
      "x7f3a9c01d2e4",
      "7f3a9c01d2e4\n",
    ])
      expect(fileOf(session({ fingerprint }), 3), fingerprint).toBe(".keel/sessions/000000000000-3.json");
  });

  test("property: the name is always <12 hex>-<index>.json under .keel/sessions/", () => {
    fc.assert(
      fc.property(fc.string(), fc.nat(), (fingerprint, index) => {
        expect(fileOf(session({ fingerprint }), index)).toMatch(/^\.keel\/sessions\/[0-9a-f]{12}-\d+\.json$/);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("sessionOut and sessionText", () => {
  test("the record counts every event and, as inputs, the fires, navs and net changes", () => {
    expect(sessionOut(session(), "cart.full", "a.json")).toEqual(record("a.json"));
    expect(sessionOut(session(), null, null)).toEqual(record("a.json", { error: null, file: null }));
    const one = (event: unknown) => sessionOut(session({ events: [event] }), null, null);
    expect(one({ at: 1, kind: "fire", id: "a", event: { type: "click" } })).toMatchObject({ events: 1, inputs: 1 });
    expect(one({ at: 1, kind: "nav", href: "/" })).toMatchObject({ events: 1, inputs: 1 });
    expect(one({ at: 1, kind: "net", online: true })).toMatchObject({ events: 1, inputs: 1 });
    expect(one({ at: 1, kind: "tx", store: "s", name: "s.t", payload: null })).toMatchObject({ events: 1, inputs: 0 });
    expect(one({ at: 1, kind: "resource", id: "r", state: "ready" })).toMatchObject({ events: 1, inputs: 0 });
  });

  test("a session file is the encoded session as 2-space JSON with one trailing newline", () => {
    const text = sessionText(session());
    expect(text).toBe(`${JSON.stringify(raw(), null, 2)}\n`);
    expect(text.startsWith('{\n  "v": 1,\n')).toBe(true);
    expect(Session.parse(JSON.parse(text)).ok).toBe(true);
  });
});

describe("recordsOf", () => {
  test("each line that is a JSON object with a string kind is a record, in order; every other line is skipped", () => {
    const stdout = [
      '{"kind":"session","id":"s1"}',
      "",
      "   ",
      "not json",
      "5",
      "null",
      '"kind"',
      '{"id":"no kind"}',
      '{"kind":5}',
      '[{"kind":"in an array"}]',
      '  {"kind":"summary","ok":true}  ',
    ].join("\n");
    expect(recordsOf(stdout)).toEqual([
      { kind: "session", id: "s1" },
      { kind: "summary", ok: true },
    ]);
    expect(recordsOf("")).toEqual([]);
    expect(recordsOf('{"kind":"a"}\r\n{"kind":"b"}\n')).toEqual([{ kind: "a" }, { kind: "b" }]);
  });
});

describe("safeUrl and shownUrl", () => {
  test("a token may travel over https anywhere, and over http to this machine only", () => {
    for (const url of [
      "https://s.test",
      "https://s.test:8443/x",
      "http://localhost:4200",
      "http://127.0.0.1",
      "http://[::1]:9",
    ])
      expect(safeUrl(url), url).toBe(true);
    for (const url of [
      "http://s.test",
      "http://localhost.evil.test",
      "http://127.0.0.2",
      "ftp://localhost",
      "ws://localhost",
      "file:///etc/passwd",
      "localhost:4200",
      "/sessions",
      "",
      "not a url",
    ])
      expect(safeUrl(url), url).toBe(false);
  });

  test("a URL is shown as its origin; one with none says so", () => {
    expect(shownUrl("https://user:pw@s.test:8443/a/b?token=1#frag")).toBe("https://s.test:8443");
    expect(shownUrl("http://localhost:4200/")).toBe("http://localhost:4200");
    expect(shownUrl("not a url")).toBe("(not an http(s) URL)");
    expect(shownUrl("")).toBe("(not an http(s) URL)");
    expect(shownUrl("file:///etc/passwd")).toBe("(not an http(s) URL)");
    expect(shownUrl("mailto:a@b.test")).toBe("(not an http(s) URL)");
  });
});
