// @vitest-environment happy-dom
// One group user (std.multi), driven here in the test's own thread over a MessageChannel, as its group drives it in a
// worker: the calls it answers (`open`, `fire`, `find`, `state`, `navigate`, `setOnline`, `advanceTo`, `settle`,
// `stop`, and for a replay `apply` and `finish`), the requests it sends to the group's server and the response parts
// it takes back, and the error each bad call answers with.
// Seed 1337 (no random inputs)
import { MessageChannel } from "node:worker_threads";
import { afterEach, describe, expect, test } from "vitest";
import * as userModule from "../../conformance/group-fixtures.ts";
import { Session } from "../../src/Session.schema.ts";
import { userRealm } from "../../src/group/internal/userRealm.ts";

const ORIGIN = userModule.ORIGIN;
const USER = "file:///project/test/user.ts";
const EMPTY = userModule.EMPTY_VIEW;
type Ret = { t: "ret"; id: number; ok: boolean; value: unknown; message?: string; code?: string };
type Req = { t: "req"; rid: number; method: string; url: string; headers: [string, string][]; body: string | null };
type Reply = (req: Req, post: (m: unknown) => void) => void;

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const board = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ title: "Milk", head: 0, items: [], caller: "caller-1", ...over });
/** The whole response at once: head, one chunk, end. */
const answer =
  (body: string, status = 200): Reply =>
  (req, post) => {
    post({ t: "head", rid: req.rid, status, statusText: "OK", headers: [["content-type", "application/json"]] });
    post({ t: "chunk", rid: req.rid, data: bytes(body) });
    post({ t: "end", rid: req.rid });
  };

const open: { close(): void }[] = [];
const base = userModule.clientView.snapshot();
afterEach(() => {
  for (const r of open.splice(0)) r.close();
  userModule.clientView.restore(base);
});

/** A user realm on one end of a channel; `reply` answers each request it sends to the server. */
function realm(options: { reply?: Reply; load?: (url: string) => Promise<unknown> } = {}) {
  const { port1, port2 } = new MessageChannel();
  const loaded: string[] = [];
  userRealm(
    port2,
    options.load ??
      (async (url) => {
        loaded.push(url);
        return userModule;
      }),
  );
  const waiting = new Map<number, (m: Ret) => void>();
  const requests: Req[] = [];
  const others: unknown[] = [];
  let reply = options.reply ?? answer(board());
  port1.on("message", (m: { t?: string; id?: number; body?: Uint8Array | null }) => {
    if (m.t === "ret" && typeof m.id === "number") {
      waiting.get(m.id)?.(Object.assign({ t: "ret" as const, id: m.id, ok: false, value: null }, m));
      waiting.delete(m.id);
    } else if (m.t === "req") {
      const req = Object.assign({ t: "req" as const, rid: -1, method: "", url: "", headers: [] }, m, {
        body: m.body instanceof Uint8Array ? new TextDecoder().decode(m.body) : null,
      });
      requests.push(req);
      reply(req, (x) => port1.postMessage(x));
    } else others.push(m);
  });
  let next = 0;
  const call = (op: string, arg: unknown = null): Promise<Ret> =>
    new Promise((resolve) => {
      const id = next++;
      waiting.set(id, resolve);
      port1.postMessage({ t: "call", id, op, arg });
    });
  const r = {
    call,
    loaded,
    requests,
    others,
    post: (m: unknown) => port1.postMessage(m),
    replyWith: (to: Reply) => {
      reply = to;
    },
    /** Several macrotask turns: posted messages arrive, and what they started runs and is answered. */
    turn: async () => {
      for (let i = 0; i < 8; i++) await new Promise((done) => setTimeout(done, 3));
    },
    close: () => {
      port1.close();
      port2.close();
    },
    opened: async (over: Record<string, unknown> = {}) => {
      const ret = await call("open", {
        user: USER,
        seed: 7,
        origin: ORIGIN,
        at: 0,
        session: null,
        schedule: null,
        ...over,
      });
      expect(ret).toEqual({ t: "ret", id: ret.id, ok: true, value: null });
    },
    click: async (id: string) => {
      expect((await call("fire", { at: 0, kind: "fire", id, event: { type: "click" } })).ok).toBe(true);
      await r.turn();
      expect((await call("settle")).ok).toBe(true);
    },
    type: async (id: string, value: string) =>
      expect((await call("fire", { at: 0, kind: "fire", id, event: { type: "input", value } })).ok).toBe(true),
    view: async (): Promise<unknown> => {
      const ret = await call("state");
      expect(ret.ok).toBe(true);
      return typeof ret.value === "object" && ret.value !== null && "view" in ret.value ? ret.value.view : undefined;
    },
  };
  open.push(r);
  return r;
}
/** A session as the JSON object a group sends a worker. */
const encoded = (session: Session): Record<string, unknown> => {
  const json = Session.encode(session);
  return typeof json === "object" && json !== null && !Array.isArray(json) ? { ...json } : {};
};
const failed = (id: number, message: string, code?: string) => ({
  t: "ret",
  id,
  ok: false,
  value: null,
  message,
  ...(code === undefined ? {} : { code }),
});

describe("userRealm: calls before open, and calls it does not know", () => {
  test("every call that needs the page answers `user is not open`; settle answers null", async () => {
    const r = realm();
    for (const [op, arg] of [
      ["state", null],
      ["stop", null],
      ["find", { id: "board.title" }],
      ["fire", { at: 0, kind: "fire", id: "board.refresh", event: { type: "click" } }],
      ["navigate", { href: "/board" }],
      ["setOnline", { online: false }],
      ["advanceTo", { ms: 5 }],
    ] as const) {
      const ret = await r.call(op, arg);
      expect(ret, op).toEqual(failed(ret.id, "group: user is not open"));
    }
    const settled = await r.call("settle");
    expect(settled).toEqual({ t: "ret", id: settled.id, ok: true, value: null });
    const finish = await r.call("finish");
    expect(finish).toEqual(failed(finish.id, "group: user is not replaying"));
    const apply = await r.call("apply", { index: 0 });
    expect(apply).toEqual({ t: "ret", id: apply.id, ok: true, value: false });
  });

  test("an unknown call, or the name of an inherited property, is `unknown call`", async () => {
    const r = realm();
    for (const op of ["nope", "toString", "constructor", "hasOwnProperty", ""]) {
      const ret = await r.call(op);
      expect(ret, op).toEqual(failed(ret.id, `group: unknown call ${op}`));
    }
  });

  test("a message that is no call is not answered", async () => {
    const r = realm();
    r.post({ t: "call", op: "state", arg: null });
    r.post({ t: "call", id: "1", op: "state", arg: null });
    r.post({ t: "call", id: 77, op: 5, arg: null });
    r.post({ t: "other", id: 78 });
    r.post({ t: "head", rid: 5, status: 200, statusText: "OK", headers: [] });
    r.post({ t: "chunk", rid: 5, data: bytes("x") });
    r.post({ t: "chunk", rid: "5", data: bytes("x") });
    r.post({ t: "end", rid: 5 });
    r.post({ t: "end" });
    r.post("call");
    r.post(null);
    const last = await r.call("settle");
    expect(last).toEqual({ t: "ret", id: 0, ok: true, value: null });
    expect(r.others).toEqual([]);
  });

  test("a call with an argument of the wrong shape names the call", async () => {
    const r = realm();
    await r.opened();
    for (const [op, arg, what] of [
      ["fire", {}, "fire"],
      ["fire", { at: 0, kind: "nav", href: "/board" }, "fire"],
      ["navigate", {}, "navigate"],
      ["navigate", { href: 5 }, "navigate"],
      ["find", {}, "find"],
      ["setOnline", { online: "no" }, "setOnline"],
      ["advanceTo", { ms: "5" }, "advanceTo"],
      ["apply", { index: "0" }, "apply"],
    ] as const) {
      const ret = await r.call(op, arg);
      expect(ret, `${op} ${JSON.stringify(arg)}`).toEqual(failed(ret.id, `group: bad ${what}`));
    }
  });
});

describe("userRealm: open", () => {
  test("a bad argument, a module with no route table, or a module with no base is an error", async () => {
    const bad = realm();
    for (const arg of [
      null,
      {},
      { user: USER, seed: 7, origin: ORIGIN, at: 0, session: null },
      { user: 5, seed: 7, origin: ORIGIN, at: 0, session: null, schedule: null },
    ]) {
      const ret = await bad.call("open", arg);
      expect(ret).toEqual(failed(ret.id, "group: bad open"));
    }
    expect(bad.loaded).toEqual([]);
    for (const mod of [
      {},
      { routes: {} },
      { routes: { kind: "keel.routeTable" } },
      { routes: { kind: "other", contracts: [] } },
      null,
    ]) {
      const r = realm({ load: async () => mod });
      const ret = await r.call("open", { user: USER, seed: 7, origin: ORIGIN, at: 0, session: null, schedule: null });
      expect(ret).toEqual(failed(ret.id, `group: ${USER} exports no routes`));
    }
    const noBase = realm({ load: async () => ({ routes: userModule.routes }) });
    const ret = await noBase.call("open", {
      user: USER,
      seed: 7,
      origin: ORIGIN,
      at: 0,
      session: null,
      schedule: null,
    });
    expect(ret).toEqual(failed(ret.id, `group: bad base of ${USER}`));
  });

  test("a loader that throws is answered with its message, and its code when it has a string one", async () => {
    const coded = realm({ load: () => Promise.reject(Object.assign(new Error("cannot load"), { code: "E1159" })) });
    const a = await coded.call("open", { user: USER, seed: 7, origin: ORIGIN, at: 0, session: null, schedule: null });
    expect(a).toEqual(failed(a.id, "cannot load", "E1159"));
    const numbered = realm({ load: () => Promise.reject(Object.assign(new Error("cannot load"), { code: 5 })) });
    const b = await numbered.call("open", {
      user: USER,
      seed: 7,
      origin: ORIGIN,
      at: 0,
      session: null,
      schedule: null,
    });
    expect(b).toEqual(failed(b.id, "cannot load"));
    const text = realm({ load: () => Promise.reject("just text") });
    const c = await text.call("open", { user: USER, seed: 7, origin: ORIGIN, at: 0, session: null, schedule: null });
    expect(c).toEqual(failed(c.id, "just text"));
  });

  test("live: loads the user module by its url and renders its base; the page answers find and state", async () => {
    const r = realm();
    await r.opened();
    expect(r.loaded).toEqual([USER]);
    expect(await r.view()).toEqual(EMPTY);
    const found = await r.call("find", { id: "board.refresh" });
    expect(found).toEqual({
      t: "ret",
      id: found.id,
      ok: true,
      value: { id: "board.refresh", role: "button", name: "Refresh", text: "Refresh", state: {} },
    });
    const missing = await r.call("find", { id: "board.nope" });
    expect(missing).toMatchObject({ ok: false, value: null, code: "E1705" });
    expect(missing.message).toContain('no element with id "board.nope"');
  });
});

describe("userRealm: a live user", () => {
  test("an input changes its state; the session it stops with starts at `at`, on its seed, with each event at the clock's time", async () => {
    const r = realm();
    await r.opened({ at: 50 });
    await r.type("board.note", "hello");
    expect(await r.view()).toEqual({ ...EMPTY, note: "hello" });
    expect((await r.call("advanceTo", { ms: 75 })).value).toBeNull();
    expect((await r.call("advanceTo", { ms: 60 })).ok).toBe(true);
    await r.click("board.probe");
    const stopped = await r.call("stop");
    expect(stopped.ok).toBe(true);
    const session = Session.parse(stopped.value);
    if (!session.ok) throw new Error("stop answers a session");
    expect(session.value).toMatchObject({
      v: 1,
      seed: 7,
      deterministic: true,
      at: 50,
      route: { id: "board.show", params: {}, search: {} },
      state: { view: EMPTY },
      error: null,
    });
    expect(session.value.events).toEqual([
      { at: 50, kind: "fire", id: "board.note", event: { type: "input", value: "hello" } },
      { at: 50, kind: "tx", store: "view", name: "view.setNote", payload: { note: "hello" } },
      { at: 75, kind: "fire", id: "board.probe", event: { type: "click" } },
      { at: 75, kind: "tx", store: "view", name: "view.setStatus", payload: { status: "true" } },
    ]);
    const again = await r.call("stop");
    expect(again.value).toEqual(stopped.value);
    const after = await r.call("state");
    expect(after).toEqual(failed(after.id, "group: user is not open"));
  });

  test("opened at 0 the clock is not moved, and another seed draws another session id", async () => {
    const a = realm();
    await a.opened({ at: 0, seed: 7 });
    const first = Session.parse((await a.call("stop")).value);
    const b = realm();
    await b.opened({ at: 0, seed: 8 });
    const second = Session.parse((await b.call("stop")).value);
    if (!first.ok || !second.ok) throw new Error("stop answers a session");
    expect(first.value.at).toBe(0);
    expect(first.value.seed).toBe(7);
    expect(second.value.seed).toBe(8);
    expect(second.value.id).not.toBe(first.value.id);
  });

  test("navigate goes to a route of the table and refuses an href that matches none", async () => {
    const r = realm();
    await r.opened();
    const ok = await r.call("navigate", { href: "/board" });
    expect(ok).toEqual({ t: "ret", id: ok.id, ok: true, value: null });
    const bad = await r.call("navigate", { href: "/nowhere" });
    expect(bad).toEqual(failed(bad.id, "group: no route matches /nowhere"));
    const session = Session.parse((await r.call("stop")).value);
    expect(session.ok && session.value.events).toEqual([{ at: 0, kind: "nav", href: "/board" }]);
  });

  test("setOnline turns the user's net off and on: offline, a request fails without reaching the server", async () => {
    const r = realm();
    await r.opened();
    const off = await r.call("setOnline", { online: false });
    expect(off).toEqual({ t: "ret", id: off.id, ok: true, value: null });
    await r.click("board.probe");
    expect(await r.view()).toMatchObject({ status: "false" });
    await r.click("board.refresh");
    expect(await r.view()).toMatchObject({ status: "offline", title: "" });
    expect(r.requests).toEqual([]);
    await r.call("setOnline", { online: true });
    await r.click("board.refresh");
    expect(await r.view()).toMatchObject({ status: "ok", title: "Milk" });
    expect(r.requests).toHaveLength(1);
  });
});

describe("userRealm: requests to the group's server", () => {
  test("a GET goes out with its method, url and headers and no body; a POST carries its body as bytes", async () => {
    const r = realm();
    await r.opened();
    await r.type("board.note", "hello");
    await r.click("board.refresh");
    r.replyWith(answer(board({ head: 1, items: ["hello"] })));
    await r.click("board.write");
    const headers = [
      ["accept", "application/json"],
      ["content-type", "application/json"],
      ["x-keel", "1"],
    ];
    expect(r.requests).toEqual([
      { t: "req", rid: 0, method: "GET", url: `${ORIGIN}/api/board`, headers, body: null },
      { t: "req", rid: 1, method: "POST", url: `${ORIGIN}/api/append`, headers, body: '{"text":"hello"}' },
    ]);
    expect(await r.view()).toEqual({
      title: "Milk",
      head: 1,
      items: ["hello"],
      caller: "caller-1",
      note: "hello",
      status: "ok",
    });
  });

  test("the response is its head, then its body in as many chunks as arrive, then its end", async () => {
    const body = board({ title: "Split across chunks" });
    const r = realm({
      reply: (req, post) => {
        post({
          t: "head",
          rid: req.rid,
          status: 200,
          statusText: "OK",
          headers: [["content-type", "application/json"], ["bad"]],
        });
        post({ t: "chunk", rid: req.rid, data: bytes(body.slice(0, 10)) });
        post({ t: "chunk", rid: req.rid + 100, data: bytes("to no one") });
        post({ t: "chunk", rid: req.rid, data: "not bytes" });
        post({ t: "chunk", rid: req.rid, data: bytes(body.slice(10)) });
        post({ t: "end", rid: req.rid + 100 });
        post({ t: "end", rid: req.rid });
        post({ t: "chunk", rid: req.rid, data: bytes("after the end") });
      },
    });
    await r.opened();
    await r.click("board.refresh");
    expect(await r.view()).toMatchObject({ status: "ok", title: "Split across chunks" });
  });

  test("a head for another request, or one that does not parse, is ignored", async () => {
    const r = realm({
      reply: (req, post) => {
        post({ t: "head", rid: req.rid + 1, status: 200, statusText: "OK", headers: [] });
        post({ t: "head", rid: req.rid, status: "200", statusText: "OK", headers: [] });
        post({ t: "head", rid: req.rid });
        answer(board({ title: "The real one" }))(req, post);
      },
    });
    await r.opened();
    await r.click("board.refresh");
    expect(await r.view()).toMatchObject({ status: "ok", title: "The real one" });
  });

  test("a status with no body (101, 204, 205, 304) is a response at its head: later parts are dropped", async () => {
    for (const status of [204, 205, 304]) {
      const r = realm({
        reply: (req, post) => {
          post({ t: "head", rid: req.rid, status, statusText: "No Content", headers: [] });
          post({ t: "chunk", rid: req.rid, data: bytes(board()) });
          post({ t: "end", rid: req.rid });
        },
      });
      await r.opened();
      await r.click("board.refresh");
      expect(await r.view(), String(status)).toMatchObject({ status: "offline", title: "" });
    }
  });

  test("a body that is not the page's JSON is answered as bad; another 2xx status still carries its body", async () => {
    const r = realm({ reply: answer('{"title":5}') });
    await r.opened();
    await r.click("board.refresh");
    expect(await r.view()).toMatchObject({ status: "bad" });
    r.replyWith(answer(board({ title: "Created" }), 201));
    await r.click("board.refresh");
    expect(await r.view()).toMatchObject({ status: "ok", title: "Created" });
  });

  test("an end before the head fails the request; an end with an error after the head fails its body", async () => {
    const early = realm({ reply: (req, post) => post({ t: "end", rid: req.rid }) });
    await early.opened();
    await early.click("board.refresh");
    expect(await early.view()).toMatchObject({ status: "offline" });
    const named = realm({ reply: (req, post) => post({ t: "end", rid: req.rid, error: "server gone" }) });
    await named.opened();
    await named.click("board.refresh");
    expect(await named.view()).toMatchObject({ status: "offline" });
    const broken = realm({
      reply: (req, post) => {
        post({ t: "head", rid: req.rid, status: 200, statusText: "OK", headers: [] });
        post({ t: "chunk", rid: req.rid, data: bytes('{"title":"cut') });
        post({ t: "end", rid: req.rid, error: "reset" });
      },
    });
    await broken.opened();
    await broken.click("board.refresh");
    expect(await broken.view()).toMatchObject({ status: "offline", title: "" });
    const whole = realm({
      reply: (req, post) => {
        post({ t: "head", rid: req.rid, status: 200, statusText: "OK", headers: [] });
        post({ t: "chunk", rid: req.rid, data: bytes('{"title":"cut') });
        post({ t: "end", rid: req.rid });
      },
    });
    await whole.opened();
    await whole.click("board.refresh");
    expect(await whole.view()).toMatchObject({ status: "offline" });
  });

  test("each request has its own number, and answers may come back in another order", async () => {
    const held: (() => void)[] = [];
    const r = realm({
      reply: (req, post) => {
        held.push(() => answer(board({ title: `answer to ${req.rid}` }))(req, post));
      },
    });
    await r.opened();
    await r.call("fire", { at: 0, kind: "fire", id: "board.refresh", event: { type: "click" } });
    await r.call("fire", { at: 0, kind: "fire", id: "board.refresh", event: { type: "click" } });
    await r.turn();
    expect(r.requests.map((q) => q.rid)).toEqual([0, 1]);
    held[1]?.();
    await r.turn();
    expect(await r.view()).toMatchObject({ title: "answer to 1" });
    held[0]?.();
    await r.turn();
    expect(await r.view()).toMatchObject({ title: "answer to 0" });
  });
});

describe("userRealm: a replay", () => {
  /** A session recorded live: a note typed, a refresh, a probe. */
  async function recorded(): Promise<Session> {
    const r = realm();
    await r.opened({ at: 10 });
    await r.type("board.note", "hello");
    await r.click("board.refresh");
    await r.click("board.probe");
    const parsed = Session.parse((await r.call("stop")).value);
    if (!parsed.ok) throw new Error("stop answers a session");
    r.close();
    userModule.clientView.restore(base);
    return parsed.value;
  }
  const replaying = (session: unknown, over: Record<string, unknown> = {}) => ({
    user: USER,
    seed: 7,
    origin: ORIGIN,
    at: 10,
    session,
    schedule: null,
    ...over,
  });

  test("applying each event in turn reproduces the session: same fingerprint, same final state, its observations back", async () => {
    const session = await recorded();
    const r = realm();
    expect((await r.call("open", replaying(Session.encode(session)))).ok).toBe(true);
    for (let i = 0; i < session.events.length; i++) {
      const applied = await r.call("apply", { index: i });
      expect(applied, `event ${i}`).toEqual({ t: "ret", id: applied.id, ok: true, value: true });
      await r.turn();
    }
    const past = await r.call("apply", { index: session.events.length });
    expect(past.value).toBe(false);
    const finish = await r.call("finish");
    expect(finish.ok).toBe(true);
    expect(finish.value).toEqual({
      observed: session.events.filter((e) => e.kind !== "fire" && e.kind !== "nav"),
      state: { view: { ...EMPTY, title: "Milk", caller: "caller-1", note: "hello", status: "true" } },
      error: null,
      reproduced: true,
      unapplied: null,
    });
    const after = await r.call("state");
    expect(after).toEqual(failed(after.id, "group: user is not open"));
  });

  test("the base state of the session is what the page starts from", async () => {
    const session = await recorded();
    const seeded = {
      ...encoded(session),
      state: { view: { ...EMPTY, title: "Seeded", note: "kept" } },
      events: [],
    };
    const r = realm();
    expect((await r.call("open", replaying(seeded))).ok).toBe(true);
    expect(await r.view()).toEqual({ ...EMPTY, title: "Seeded", note: "kept" });
    const finish = await r.call("finish");
    expect(finish.value).toMatchObject({
      observed: [],
      state: { view: { ...EMPTY, title: "Seeded", note: "kept" } },
      unapplied: null,
    });
  });

  test("an input that cannot be applied stops the replay there: later ones are not applied and finish names it", async () => {
    const session = await recorded();
    const events = [
      { at: 10, kind: "fire", id: "board.note", event: { type: "input", value: "typed" } },
      { at: 10, kind: "fire", id: "board.gone", event: { type: "click" } },
      { at: 10, kind: "fire", id: "board.note", event: { type: "input", value: "never" } },
    ];
    const r = realm();
    expect((await r.call("open", replaying({ ...encoded(session), events }))).ok).toBe(true);
    expect((await r.call("apply", { index: 0 })).value).toBe(true);
    expect((await r.call("apply", { index: 1 })).value).toBe(false);
    expect((await r.call("apply", { index: 2 })).value).toBe(false);
    expect(await r.view()).toMatchObject({ note: "typed" });
    const finish = await r.call("finish");
    expect(finish.value).toMatchObject({
      unapplied: 1,
      reproduced: false,
      state: { view: { ...EMPTY, note: "typed" } },
    });
    expect(finish.value).toHaveProperty("error.code");
  });

  test("a session whose base route the table lacks cannot start: nothing applies and finish says -1", async () => {
    const session = await recorded();
    const r = realm();
    const lost = { ...encoded(session), route: { id: "board.gone", params: {}, search: {} } };
    expect((await r.call("open", replaying(lost))).ok).toBe(true);
    expect((await r.call("apply", { index: 0 })).value).toBe(false);
    const finish = await r.call("finish");
    expect(finish.value).toMatchObject({ unapplied: -1 });
    const again = await r.call("finish");
    expect(again.ok).toBe(true);
  });

  test("a session with another fingerprint is replayed and reported as not reproduced", async () => {
    const session = await recorded();
    const r = realm();
    expect((await r.call("open", replaying({ ...encoded(session), events: [], fingerprint: "000000000000" }))).ok).toBe(
      true,
    );
    expect((await r.call("finish")).value).toMatchObject({ reproduced: false, unapplied: null, error: null });
  });

  test("a live user has nothing to finish", async () => {
    const r = realm();
    await r.opened();
    const finish = await r.call("finish");
    expect(finish).toEqual(failed(finish.id, "group: user is not replaying"));
    const apply = await r.call("apply", { index: 0 });
    expect(apply.value).toBe(false);
  });
});
