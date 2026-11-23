// `openHub`: a group's server and its users' workers, here over stand-in workers (`startRealm`) and a stand-in project
// host, in the test's own thread. What the server's storage starts with and reports, the server clock, the cookie jar
// each user's requests go through, the order workers start in and what happens when one fails to start, and what
// `settle` waits for: counted in turns, so a wait that is too long or too short shows.
// Seed 1337 (no random inputs)
import type { SimCtx } from "@keel/ctx";
import type { JsonValue } from "@keel/schema";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Outgoing } from "../../src/group/internal/Outgoing.ts";
import type { Realm } from "../../src/group/internal/Realm.ts";
import { openHub } from "../../src/group/internal/openHub.ts";

interface Started {
  readonly origin: string;
  readonly project: unknown;
  readonly fetch: (req: Outgoing) => Promise<Response>;
  readonly touch: () => void;
  readonly realm: Fake;
}
interface Fake extends Realm {
  readonly calls: [string, JsonValue][];
  terminated: number;
}
interface HubState {
  started: unknown[];
  drained: number;
  failAt: number;
  open: number;
  maxOpen: number;
  onCall: ((realm: unknown, op: string, index: number) => Promise<void> | void) | undefined;
  project: { invoke(): Promise<{ result: number }> };
  users: string[];
}
const state = vi.hoisted(
  (): HubState => ({
    started: [],
    drained: 0,
    failAt: -1,
    open: 0,
    maxOpen: 0,
    onCall: undefined,
    project: { invoke: async () => ({ result: 1 }) },
    users: [],
  }),
);

vi.mock("../../src/group/internal/drained.ts", () => ({
  drained: async () => {
    state.drained++;
    await new Promise((done) => setImmediate(done));
  },
}));
vi.mock("../../src/group/internal/projectServer.ts", () => ({
  projectServer: async (user: string) => {
    state.users.push(user);
    return state.project;
  },
}));
vi.mock("../../src/group/internal/startRealm.ts", () => ({
  startRealm: async (
    origin: string,
    project: unknown,
    fetch: (req: Outgoing) => Promise<Response>,
    touch: () => void,
  ) => {
    state.open++;
    state.maxOpen = Math.max(state.maxOpen, state.open);
    await new Promise((done) => setImmediate(done));
    state.open--;
    const index = state.started.length;
    if (index === state.failAt) throw new Error(`worker ${index} would not start`);
    const realm: Fake = {
      calls: [],
      terminated: 0,
      call: async (op: string, arg: JsonValue) => {
        realm.calls.push([op, arg]);
        await state.onCall?.(realm, op, realm.calls.length - 1);
        return undefined;
      },
      terminate: async () => {
        realm.terminated++;
      },
    };
    state.started.push({ origin, project, fetch, touch, realm });
    return realm;
  },
}));

const isStarted = (v: unknown): v is Started => typeof v === "object" && v !== null && "realm" in v;
const started = (i: number): Started => {
  const s = state.started[i];
  if (!isStarted(s)) throw new Error(`no worker ${i}`);
  return s;
};
const out = (url: string, over: Partial<Outgoing> = {}): Outgoing => ({
  url,
  method: "GET",
  headers: new Headers(),
  body: null,
  ...over,
});
const turns = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((done) => setImmediate(done));
};

type Handler = (req: Request, ctx: SimCtx) => Response | Promise<Response>;
let handler: Handler = () => new Response("");
let ctxSeen: SimCtx | undefined;
const seen: Request[] = [];
const hubs: { close(): Promise<void> }[] = [];
const ORIGIN = "http://app.test";

async function hub(
  over: Partial<{ at: number; server: { [k: string]: JsonValue }; count: number; seed: number }> = {},
) {
  const h = await openHub({
    serve: (ctx) => {
      ctxSeen = ctx;
      return {
        fetch: async (req) => {
          seen.push(req);
          return handler(req, ctx);
        },
      };
    },
    seed: 3,
    origin: ORIGIN,
    at: 0,
    server: {},
    count: 1,
    user: "file:///project/user.ts",
    ...over,
  });
  hubs.push(h);
  return h;
}

beforeEach(() => {
  state.started.length = 0;
  state.users.length = 0;
  Object.assign(state, { drained: 0, failAt: -1, open: 0, maxOpen: 0, onCall: undefined });
  handler = () => new Response("");
  seen.length = 0;
});
afterEach(async () => {
  state.onCall = undefined;
  for (const h of hubs.splice(0)) await h.close();
});

const snapshot = (over: Record<string, unknown> = {}) => ({
  state: { n: 1 },
  log: [],
  initial: { n: 0 },
  head: 0,
  ...over,
});

describe("openHub: starting", () => {
  test("the project is the user module's, and each worker starts after the one before it, given the origin and project", async () => {
    const h = await hub({ count: 3 });
    expect(state.users).toEqual(["file:///project/user.ts"]);
    expect(state.started).toHaveLength(3);
    expect(state.maxOpen).toBe(1);
    expect(h.realms).toEqual([started(0).realm, started(1).realm, started(2).realm]);
    for (const i of [0, 1, 2]) {
      expect(started(i).origin).toBe(ORIGIN);
      expect(started(i).project).toBe(state.project);
    }
  });

  test("a worker that fails to start ends the others that started, and the error comes out", async () => {
    state.failAt = 2;
    await expect(hub({ count: 3 })).rejects.toThrow("worker 2 would not start");
    expect(started(0).realm.terminated).toBe(1);
    expect(started(1).realm.terminated).toBe(1);
  });

  test("close ends every worker", async () => {
    const h = await hub({ count: 2 });
    await h.close();
    expect(started(0).realm.terminated).toBe(1);
    expect(started(1).realm.terminated).toBe(1);
  });
});

describe("openHub: the server's storage and clock", () => {
  test("storage starts with each store under keel.store.<id>, text as it is and a value as JSON", async () => {
    await hub({ server: { board: { title: "x" }, text: "already text", count: 4 } });
    expect(await ctxSeen?.storage.get("keel.store.board")).toBe('{"title":"x"}');
    expect(await ctxSeen?.storage.get("keel.store.text")).toBe("already text");
    expect(await ctxSeen?.storage.get("keel.store.count")).toBe("4");
    expect(await ctxSeen?.storage.get("board")).toBeNull();
  });

  test("stored reports the stores the server stored under the prefix, by id, and not other keys", async () => {
    const h = await hub({ server: { board: { title: "x" }, text: "already text" } });
    const storage = ctxSeen?.storage;
    await storage?.set("keel.store.todo", '{"a":1}');
    await storage?.set("other", "no");
    await storage?.set("keel.store.board", '{"title":"y"}');
    expect(await h.stored()).toEqual({ board: '{"title":"y"}', text: "already text", todo: '{"a":1}' });
  });

  test("the clock starts at `at`, left alone for 0 and for a negative one", async () => {
    const zero = await hub({ at: 0 });
    const base = zero.now();
    expect((await hub({ at: 30 })).now()).toBe(base + 30);
    expect((await hub({ at: -5 })).now()).toBe(base);
    expect(ctxSeen?.clock.now()).toBe(base);
  });

  test("advanceTo moves the server clock forward only, and tells every worker the time either way", async () => {
    const h = await hub({ at: 100, count: 2 });
    const base = h.now();
    await h.advanceTo(base + 50);
    expect(h.now()).toBe(base + 50);
    await h.advanceTo(base + 10);
    expect(h.now()).toBe(base + 50);
    expect(started(0).realm.calls).toEqual([
      ["advanceTo", { ms: base + 50 }],
      ["advanceTo", { ms: base + 10 }],
    ]);
    expect(started(1).realm.calls).toEqual(started(0).realm.calls);
  });

  test("advanceTo to the time it is does not move the clock", async () => {
    const h = await hub({ at: 10 });
    const now = h.now();
    await h.advanceTo(now);
    expect(h.now()).toBe(now);
  });
});

describe("openHub: snapshots", () => {
  test("each stored snapshot, by id, with its keys as stored, or from the keyed entries of its log", async () => {
    const entry = (id: number, name: string, key?: string) => ({
      id,
      name,
      payload: null,
      at: 0,
      ...(key === undefined ? {} : { key }),
    });
    const h = await hub({
      server: {
        kept: snapshot({ keys: [{ name: "a", key: "k" }], log: [entry(1, "x", "other")] }),
        derived: snapshot({ log: [entry(1, "add", "k1"), entry(2, "noop"), entry(3, "del", "k2")] }),
        bare: snapshot(),
      },
    });
    expect(await h.snapshots()).toEqual({
      kept: snapshot({ keys: [{ name: "a", key: "k" }], log: [entry(1, "x", "other")] }),
      derived: snapshot({
        log: [entry(1, "add", "k1"), entry(2, "noop"), entry(3, "del", "k2")],
        keys: [
          { name: "add", key: "k1" },
          { name: "del", key: "k2" },
        ],
      }),
      bare: snapshot({ keys: [] }),
    });
  });

  test("a store that is not a snapshot, or not JSON, is left out", async () => {
    const h = await hub({ server: { good: snapshot(), text: "already text", shape: { state: 1 }, num: 5 } });
    expect(Object.keys(await h.snapshots())).toEqual(["good"]);
    await ctxSeen?.storage.set("keel.store.later", JSON.stringify(snapshot()));
    expect(Object.keys(await h.snapshots())).toEqual(["good", "later"]);
  });
});

describe("openHub: requests through a user's cookie jar", () => {
  const reply = (...lines: string[]): Response => {
    const res = new Response("ok");
    for (const l of lines) res.headers.append("set-cookie", l);
    return res;
  };

  test("the server gets the request as sent, and what it sets comes back on that user's next request only", async () => {
    await hub({ count: 2 });
    handler = () => reply("a=1; Path=/", "b=2; Path=/");
    const res = await started(0).fetch(
      out(`${ORIGIN}/x`, { method: "POST", body: new TextEncoder().encode("hi"), headers: new Headers({ "x-k": "v" }) }),
    );
    expect(await res.text()).toBe("ok");
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe(`${ORIGIN}/x`);
    expect(seen[0]?.headers.get("x-k")).toBe("v");
    expect(await seen[0]?.text()).toBe("hi");
    expect(seen[0]?.headers.get("cookie")).toBeNull();
    handler = () => new Response("");
    await started(0).fetch(out(`${ORIGIN}/y`));
    expect(seen[1]?.headers.get("cookie")).toBe("a=1; b=2");
    await started(1).fetch(out(`${ORIGIN}/y`));
    expect(seen[2]?.headers.get("cookie")).toBeNull();
  });

  test("a cookie header the user sent is replaced by the jar's, and dropped when the jar has none", async () => {
    await hub();
    await started(0).fetch(out(`${ORIGIN}/x`, { headers: new Headers({ cookie: "mine=1" }) }));
    expect(seen[0]?.headers.get("cookie")).toBeNull();
    handler = () => reply("jar=9; Path=/");
    await started(0).fetch(out(`${ORIGIN}/x`));
    handler = () => new Response("");
    await started(0).fetch(out(`${ORIGIN}/x`, { headers: new Headers({ cookie: "mine=1" }) }));
    expect(seen[2]?.headers.get("cookie")).toBe("jar=9");
  });

  test("the jar is on the server clock: a cookie of Max-Age runs out when the clock passes it", async () => {
    const h = await hub();
    handler = () => reply("t=1; Path=/; Max-Age=10");
    await started(0).fetch(out(`${ORIGIN}/x`));
    handler = () => new Response("");
    await started(0).fetch(out(`${ORIGIN}/x`));
    expect(seen[1]?.headers.get("cookie")).toBe("t=1");
    await h.advanceTo(h.now() + 11_000);
    await started(0).fetch(out(`${ORIGIN}/x`));
    expect(seen[2]?.headers.get("cookie")).toBeNull();
  });

  /** A response whose headers have no `getSetCookie`, and `get` answers `line`. */
  const joined = (line: string | null, list?: string[]): Response => {
    const res = new Response("ok");
    Object.defineProperty(res, "headers", {
      value: {
        get: (name: string) => (name === "set-cookie" ? line : null),
        getSetCookie: list === undefined ? undefined : () => list,
        entries: () => [][Symbol.iterator](),
      },
    });
    return res;
  };

  test("without getSetCookie the one joined set-cookie line is split between cookies, not inside an Expires date", async () => {
    await hub();
    handler = () => joined("a=1; Path=/,b=2; Path=/, c=3; Path=/; Expires=Wed, 21 Oct 2099 07:28:00 GMT");
    await started(0).fetch(out(`${ORIGIN}/x`));
    handler = () => new Response("");
    await started(0).fetch(out(`${ORIGIN}/x`));
    expect(seen[1]?.headers.get("cookie")).toBe("a=1; b=2; c=3");
  });

  test("without getSetCookie and without a set-cookie header nothing is stored", async () => {
    await hub();
    handler = () => joined(null);
    await started(0).fetch(out(`${ORIGIN}/x`));
    await started(0).fetch(out(`${ORIGIN}/x`));
    expect(seen[1]?.headers.get("cookie")).toBeNull();
  });

  test("a getSetCookie that answers none falls back to the joined line, and one that answers some is used alone", async () => {
    await hub({ count: 2 });
    handler = () => joined("a=1; Path=/", []);
    await started(0).fetch(out(`${ORIGIN}/x`));
    handler = () => joined("z=9; Path=/", ["b=2; Path=/"]);
    await started(1).fetch(out(`${ORIGIN}/x`));
    handler = () => new Response("");
    await started(0).fetch(out(`${ORIGIN}/x`));
    await started(1).fetch(out(`${ORIGIN}/x`));
    expect(seen[2]?.headers.get("cookie")).toBe("a=1");
    expect(seen[3]?.headers.get("cookie")).toBe("b=2");
  });

  test("a server that throws leaves nothing waiting on it", async () => {
    const h = await hub();
    handler = () => {
      throw new Error("down");
    };
    await expect(started(0).fetch(out(`${ORIGIN}/x`))).rejects.toThrow("down");
    state.drained = 0;
    await h.settle();
    expect(state.drained).toBe(2);
  });
});

describe("openHub: settle", () => {
  test("with no traffic it asks each worker to settle once, in order, between two turns", async () => {
    const h = await hub({ count: 2 });
    await h.settle();
    expect(started(0).realm.calls).toEqual([["settle", null]]);
    expect(started(1).realm.calls).toEqual([["settle", null]]);
    expect(state.drained).toBe(2);
  });

  test("a round that saw traffic is followed by another, until one sees none", async () => {
    const h = await hub({ count: 2 });
    state.onCall = (realm, _op, index) => {
      if (realm === started(0).realm && index < 2) started(0).touch();
    };
    await h.settle();
    expect(started(0).realm.calls).toHaveLength(3);
    expect(started(1).realm.calls).toHaveLength(3);
    expect(state.drained).toBe(6);
  });

  test("traffic that never goes quiet ends in an error after 500 rounds", async () => {
    const h = await hub();
    state.onCall = () => started(0).touch();
    await expect(h.settle()).rejects.toThrow("group did not settle");
    expect(started(0).realm.calls).toHaveLength(500);
  });

  test("a request still waiting on the server is waited for 200 turns, and no more", async () => {
    const h = await hub();
    let release: (() => void) | undefined;
    handler = () =>
      new Promise((resolve) => {
        release = () => resolve(new Response(""));
      });
    const pending = started(0).fetch(out(`${ORIGIN}/x`));
    await turns(1);
    state.drained = 0;
    await h.settle();
    expect(state.drained).toBe(202);
    release?.();
    await pending;
    state.drained = 0;
    await h.settle();
    expect(state.drained).toBe(2);
  });

  test("a request that is answered while settle waits is followed by another round", async () => {
    const h = await hub();
    let answered = false;
    state.onCall = (_realm, _op, index) => {
      if (index !== 0) return;
      handler = async () => {
        await turns(5);
        return new Response("");
      };
      void started(0)
        .fetch(out(`${ORIGIN}/x`))
        .then(() => {
          answered = true;
          started(0).touch();
        });
    };
    await h.settle();
    expect(answered).toBe(true);
    expect(started(0).realm.calls).toHaveLength(2);
  });

  test("traffic in a round is not waited on for the idle turns", async () => {
    const h = await hub();
    let release: (() => void) | undefined;
    handler = () =>
      new Promise((resolve) => {
        release = () => resolve(new Response(""));
      });
    const pending = started(0).fetch(out(`${ORIGIN}/x`));
    await turns(1);
    state.onCall = (_realm, _op, index) => {
      if (index === 0) started(0).touch();
    };
    state.drained = 0;
    await h.settle();
    expect(state.drained).toBe(2 + 202);
    release?.();
    await pending;
  });
});
