// k.server API, k.user: what a loader's and an action's handler is called with on a direct `run` and `live`: the
// caller's `user` or `""`, a `currentUser` that answers it, a signal that aborts once a live loader's first yield is
// taken, and stores of the call's own.
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { store } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { action } from "../src/action.ts";
import { contract } from "../src/contract/contract.ts";
import { judgedUser } from "../src/internal/index.ts";
import { loader } from "../src/loader.ts";

const SEED = 1337;
const Out = s.object({ n: s.int() });
const c = contract("h", {
  "h.get": { method: "GET", path: "/api/h", output: Out },
  "h.feed": { method: "GET", path: "/api/h/feed", output: Out, events: true },
  "h.add": { method: "POST", path: "/api/h", body: Out, output: Out },
  "h.page": { path: "/h" },
});
const args = { params: {}, search: {}, url: "http://localhost/api/h", caller: "c" };
const ctx = () => createCtx({ mode: "sim", seed: SEED });
const userName = fc.constantFrom("", "u1", "ada", "user with spaces");

describe("a loader's run", () => {
  it("gives the handler the caller's user, or the empty string", async () => {
    await fc.assert(
      fc.asyncProperty(fc.option(userName, { nil: undefined }), async (user) => {
        const seen: { user: string; bearer: unknown; aborted: boolean }[] = [];
        const l = loader(c, "h.get", {}, async (a) => {
          seen.push({ user: a.user, bearer: a.bearer, aborted: a.signal.aborted });
          return ok({ n: 1 });
        });
        expect(await l.run(user === undefined ? args : { ...args, user }, ctx())).toEqual(ok({ n: 1 }));
        expect(seen).toEqual([{ user: user ?? "", bearer: undefined, aborted: false }]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("of a live loader is its first yield; the generator is then returned and its signal aborted", async () => {
    const log: string[] = [];
    let signal: AbortSignal | undefined;
    const l = loader(c, "h.feed", {}, async function* (a) {
      signal = a.signal;
      log.push(`start ${a.signal.aborted}`);
      try {
        yield ok({ n: 1 });
        log.push("second");
        yield ok({ n: 2 });
      } finally {
        log.push("returned");
      }
    });
    expect(await l.run(args, ctx())).toEqual(ok({ n: 1 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(["start false", "returned"]);
    expect(signal?.aborted).toBe(true);
  });

  it("of a live loader that ends before a yield rejects, its signal aborted", async () => {
    let signal: AbortSignal | undefined;
    const l = loader(c, "h.feed", {}, async function* (a) {
      signal = a.signal;
      if (a.signal.aborted) yield ok({ n: 0 });
    });
    const thrown = await l.run(args, ctx()).then(
      () => null,
      (e: unknown) => e,
    );
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown instanceof Error ? thrown.message : "").toBe("no yield");
    expect(signal?.aborted).toBe(true);
  });

  it("of a plain loader leaves its signal unaborted", async () => {
    let signal: AbortSignal | undefined;
    const l = loader(c, "h.get", {}, async (a) => {
      signal = a.signal;
      return ok({ n: 1 });
    });
    await l.run(args, ctx());
    expect(signal?.aborted).toBe(false);
    expect(l.live).toBeUndefined();
  });

  it("makes each of two runs at once its own stores from the factory", async () => {
    const made: unknown[] = [];
    const factory = () => {
      const box = store(Out, { n: 0 }, { id: "h.box" });
      made.push(box);
      return { box };
    };
    const l = loader(c, "h.get", { stores: factory }, async ({ stores }) => {
      await Promise.resolve();
      return ok({ n: stores.box.get("n") });
    });
    const one = ctx();
    expect(await Promise.all([l.run(args, one), l.run(args, one)])).toEqual([ok({ n: 0 }), ok({ n: 0 })]);
    expect(made).toHaveLength(2);
    expect(made[0]).not.toBe(made[1]);
  });
});

describe("a live loader's live", () => {
  const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => {
    const out: T[] = [];
    for await (const x of it) out.push(x);
    return out;
  };
  const live = { ...args, signal: new AbortController().signal };

  it("yields every result, with the caller's user and a currentUser fixed to it", async () => {
    await fc.assert(
      fc.asyncProperty(fc.option(userName, { nil: undefined }), async (user) => {
        const seen: unknown[] = [];
        const l = loader(c, "h.feed", {}, async function* (a) {
          seen.push([a.user, await a.currentUser(), a.currentUser.fixed, a.bearer, a.stores]);
          yield ok({ n: 1 });
          yield ok({ n: 2 });
        });
        expect(await collect(l.live(user === undefined ? live : { ...live, user }, ctx()))).toEqual([
          ok({ n: 1 }),
          ok({ n: 2 }),
        ]);
        expect(seen).toEqual([[user ?? "", user ?? "", true, undefined, undefined]]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("passes the server's currentUser as it is: asked each call, not fixed", async () => {
    let asked = 0;
    const current = judgedUser(async () => `u${++asked}`);
    expect(current.fixed).toBe(false);
    const got: unknown[] = [];
    const l = loader(c, "h.feed", {}, async function* (a) {
      got.push(a.currentUser === current, a.currentUser.fixed, await a.currentUser(), await a.currentUser(), a.user);
      yield ok({ n: 1 });
    });
    await collect(l.live({ ...live, user: "first", currentUser: current }, ctx()));
    expect(got).toEqual([true, false, "u1", "u2", "first"]);
    expect(asked).toBe(2);
  });

  it("uses the stores it is given and calls no factory; without them, the factory's, one set per call", async () => {
    let made = 0;
    const factory = () => {
      made++;
      return { box: store(Out, { n: 5 }, { id: "h.live" }) };
    };
    const l = loader(c, "h.feed", { stores: factory }, async function* ({ stores }) {
      yield ok({ n: stores.box.get("n") });
    });
    const given = { box: { get: () => 9 } };
    expect(await collect(l.live({ ...live, stores: given }, ctx()))).toEqual([ok({ n: 9 })]);
    expect(made).toBe(0);
    const one = ctx();
    const both = await Promise.all([collect(l.live(live, one)), collect(l.live(live, one))]);
    expect(both).toEqual([[ok({ n: 5 })], [ok({ n: 5 })]]);
    expect(made).toBe(2);
  });
});

describe("an action's run", () => {
  it("gives the handler the caller's user, or the empty string", async () => {
    await fc.assert(
      fc.asyncProperty(fc.option(userName, { nil: undefined }), fc.integer({ min: 0, max: 9 }), async (user, n) => {
        const seen: unknown[] = [];
        const a = action(c, "h.add", {}, async (body, at) => {
          seen.push([at.user, at.bearer, at.stores, at.caller]);
          return ok(body);
        });
        expect(await a.run({ n }, user === undefined ? args : { ...args, user }, ctx())).toEqual(ok({ n }));
        expect(seen).toEqual([[user ?? "", undefined, undefined, "c"]]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("makes each of two runs at once its own stores from the factory", async () => {
    let made = 0;
    const factory = () => {
      made++;
      return { box: store(Out, { n: 3 }, { id: "h.act" }) };
    };
    const a = action(c, "h.add", { stores: factory }, async (body, at) => {
      await Promise.resolve();
      return ok({ n: body.n + at.stores.box.get("n") });
    });
    const one = ctx();
    expect(await Promise.all([a.run({ n: 1 }, args, one), a.run({ n: 2 }, args, one)])).toEqual([
      ok({ n: 4 }),
      ok({ n: 5 }),
    ]);
    expect(made).toBe(2);
  });
});

describe("a handler declared for an id the contract lacks", () => {
  it("is made all the same; manifest is where it is refused", () => {
    const made = Reflect.apply(action, undefined, [c, "h.nope", {}, async () => ok(null)]);
    expect(made.kind).toBe("keel.action");
    expect(made.id).toBe("h.nope");
    expect(made.input.parse({}).ok).toBe(true);
    expect(made.output).toBeUndefined();
    const l = Reflect.apply(loader, undefined, [c, "h.nope", { output: Out }, async () => ok({ n: 1 })]);
    expect(l.kind).toBe("keel.loader");
    expect(l.output).toBe(Out);
  });

  it("a loader with no output of its own or its entry's is a TypeError naming the id", () => {
    for (const id of ["h.page", "h.nope"]) {
      const thrown = (() => {
        try {
          Reflect.apply(loader, undefined, [c, id, {}, async () => ok({})]);
        } catch (e) {
          return e;
        }
        return null;
      })();
      expect(thrown).toBeInstanceOf(TypeError);
      expect(thrown instanceof Error ? thrown.message : "").toBe(
        `loader("${id}"): no output (a page or layout loader declares one)`,
      );
    }
  });

  it("an API action takes its entry's body as input and its output; a page action its declared input", () => {
    const api = action(c, "h.add", {}, async (body) => ok(body));
    expect(api.input.parse({ n: 1 }).ok).toBe(true);
    expect(api.input.parse({}).ok).toBe(false);
    expect(api.output).toBe(Out);
    const In = s.object({ name: s.string() });
    const page = action(c, "h.page", { input: In }, async () => ok(null));
    expect(page.input).toBe(In);
    expect(Object.keys(page)).not.toContain("output");
  });
});
