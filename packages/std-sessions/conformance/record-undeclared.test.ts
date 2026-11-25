// @vitest-environment happy-dom
// Spec: std.sessions, clause "For every generated state and payload schema holding open objects and every value each accepts, with undeclared keys added under its open objects at depths 1 to 3, each added key and string under one a distinct 16-letter lowercase string found nowhere else: for a store of that state as `initial` and one `tx` of that payload, `JSON.stringify` of `record(ctx)`'s `stop()` holds none of them, its store `state` parses with the state schema and the `tx` `payload` with the payload schema."
// Spec: std.sessions, clause "A store of state schema `s.object({ m: s.record(s.string()) })` and `initial` `{ m: { k1: 'v1' } }` is recorded with that `state`; of `s.object({ m: s.object({}) })` and that `initial`, with `state` `{ m: {} }`."
// Spec: std.sessions, clause "After a `tx` of payload `{ p: { u: 'qwertyuiopasdfgh' } }` under payload schema `s.object({ p: s.object({}).pii('contact') })`, an error reported with message `bad qwertyuiopasdfgh` and `data` `{ v: 'qwertyuiopasdfgh' }` is recorded holding no `qwertyuiopasdfgh`."
// Seed 1337. Readings:
// - "its store `state`" is `session.state[<store id>]`, the base state, read from the session `record(ctx)` returns after the route renders; the recorded `tx` payload is the `payload` of the `tx` event named by the transaction.
// - Route values reach `renderRoute` as its `params` and `search` options (the to-test file does the same, std.sessions), and are recorded at `session.route`.
// - An error is "reported" with `report(ctx, { kind: 'error', error })` (`@keel/ctx/internal`, as the ctx conformance does), after the `tx`.
// - A key name is a place a value can leak: each marker below is used as a key name as often as as a value.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type ObjectSchema, type Schema, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import { type Session, record } from "@keel/std-sessions";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Button } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const opts = { seed: SEED, numRuns: 60 };
type Path = (string | number)[];

let counter = 0;
/** A 16-letter lowercase string found nowhere else: the base-26 digits of a process-wide counter behind a fixed stem. */
const mark = (): string => {
  let n = counter++;
  let tail = "";
  for (let i = 0; i < 9; i++) {
    tail += String.fromCharCode(97 + (n % 26));
    n = Math.floor(n / 26);
  }
  return `qzjxkvw${tail}`;
};

// ---- generated schemas: open objects, arrays and records of strings, ints and booleans
type Piece =
  | { readonly kind: "string" | "int" | "bool" }
  | { readonly kind: "array" | "record"; readonly item: Piece }
  | { readonly kind: "object"; readonly fields: readonly Piece[] };
const leaf: fc.Arbitrary<Piece> = fc.constantFrom<Piece>({ kind: "string" }, { kind: "int" }, { kind: "bool" });
const pieceArb = (depth: number): fc.Arbitrary<Piece> =>
  depth <= 0
    ? leaf
    : fc.oneof(
        leaf,
        fc.record({ kind: fc.constantFrom("array" as const, "record" as const), item: pieceArb(depth - 1) }),
        fc
          .array(pieceArb(depth - 1), { minLength: 0, maxLength: 3 })
          .map((fields): Piece => ({ kind: "object", fields })),
      );
const rootArb: fc.Arbitrary<Piece> = fc
  .array(pieceArb(2), { minLength: 0, maxLength: 3 })
  .map((fields): Piece => ({ kind: "object", fields }));
const schemaOf = (p: Piece): Schema<unknown> => {
  switch (p.kind) {
    case "string":
      return s.string();
    case "int":
      return s.int();
    case "bool":
      return s.boolean();
    case "array":
      return s.array(schemaOf(p.item));
    case "record":
      return s.record(schemaOf(p.item));
    case "object":
      return s.object(Object.fromEntries(p.fields.map((f, i) => [`f${i}`, schemaOf(f)])));
  }
};
const rootSchema = (p: Piece): Schema<object> =>
  s.object(p.kind === "object" ? Object.fromEntries(p.fields.map((f, i) => [`f${i}`, schemaOf(f)])) : {});
const childPiece = (p: Piece | undefined, key: string | number): Piece | undefined => {
  if (p === undefined) return undefined;
  if (p.kind === "array" || p.kind === "record") return p.item;
  if (p.kind === "object") {
    const m = /^f(\d+)$/.exec(String(key));
    return m?.[1] === undefined ? undefined : p.fields[Number(m[1])];
  }
  return undefined;
};
/** Paths of every open object in a generated value (through arrays, objects and record values). */
const objectPaths = (p: Piece | undefined, v: unknown, path: Path = [], out: Path[] = []): Path[] => {
  if (typeof v !== "object" || v === null) return out;
  if (p?.kind === "object") out.push(path);
  for (const [k, c] of Object.entries(v)) {
    const key = Array.isArray(v) ? Number(k) : k;
    objectPaths(childPiece(p, key), c, [...path, key], out);
  }
  return out;
};
const addKeyAt = (v: unknown, path: Path, key: string, x: unknown): unknown => {
  const [head, ...rest] = path;
  if (head === undefined) return { ...Object(v), [key]: x };
  if (Array.isArray(v)) return v.map((c, i) => (i === head ? addKeyAt(c, rest, key, x) : c));
  return { ...Object(v), [head]: addKeyAt(Reflect.get(Object(v), head), rest, key, x) };
};

/** An undeclared value of depth 1 to 3: a marker string, or arrays and objects (the key a marker) around one. Markers are pushed to `found`. */
type Shape = "str" | "arr" | "obj";
const shapeArb = fc.array(fc.constantFrom<Shape>("arr", "obj"), { minLength: 0, maxLength: 2 });
const undeclaredValue = (wrappers: readonly Shape[], found: string[]): unknown => {
  const m = mark();
  found.push(m);
  return wrappers.reduceRight<unknown>((inner, w) => {
    if (w === "arr") return [inner];
    const k = mark();
    found.push(k);
    return { [k]: inner };
  }, m);
};
/** `value` with an undeclared key at each chosen open object (depth of the object is the generated value's own), each key and what is under it a fresh marker. */
const withUndeclared = (
  piece: Piece,
  value: unknown,
  picks: readonly number[],
  shapes: readonly (readonly Shape[])[],
  found: string[],
): object => {
  const paths = objectPaths(piece, value);
  let out = value;
  picks.forEach((pick, i) => {
    const at = paths[pick % paths.length];
    if (at === undefined) return;
    const key = mark();
    found.push(key);
    out = addKeyAt(out, at, key, undeclaredValue(shapes[i % Math.max(shapes.length, 1)] ?? [], found));
  });
  return Object(out);
};

// ---- the recorder over one route that fires one transaction
let runs = 0;
interface Captured {
  readonly session: Session;
  readonly storeId: string;
  readonly txName: string;
  readonly ctx: SimCtx;
}
async function capture(o: {
  readonly state: Schema<object>;
  readonly initial: object;
  readonly payload: Schema<object>;
  readonly sent: unknown;
  readonly params?: Record<string, unknown>;
  readonly search?: Record<string, unknown>;
  /** The route's `params` and `search` schemas (default `{ id: string }` and `{ q?: string }`). */
  readonly paramsSchema?: ObjectSchema<unknown>;
  readonly searchSchema?: ObjectSchema<unknown>;
  readonly after?: (ctx: SimCtx) => void;
}): Promise<Captured> {
  const storeId = `usr${runs++}`;
  const txName = `${storeId}.set`;
  const ctx: SimCtx = createCtx({ mode: "sim", seed: SEED });
  const rec = record(ctx);
  const Params = o.paramsSchema ?? s.object({ id: s.string() });
  const Search = o.searchSchema ?? s.object({ q: s.string().optional() });
  const c = contract("usr", { "usr.show": { path: "/usr/:id", params: Params, search: Search } });
  const built: { st: ReturnType<typeof store>; routes: ReturnType<typeof manifest> }[] = [];
  const owner = scope(() => {
    const st = store(o.state, o.initial, { id: storeId });
    const t = transaction(st, txName, o.payload, (state) => state);
    const routes = manifest(c, {
      "usr.show": {
        component(): Node {
          return Box({
            as: "main",
            id: "usr.page",
            children: [Button({ id: "usr.go", children: "Go", onClick: () => void tx(t, o.sent) })],
          });
        },
      },
    });
    built.push({ st, routes });
  });
  const [b] = built;
  if (b === undefined) throw new Error("capture: build failed");
  const h = await renderRoute("usr.show", {
    routes: b.routes,
    ctx,
    params: o.params ?? { id: "u1" },
    search: o.search ?? {},
    state: [[b.st, o.initial]],
  });
  await h.fire("usr.go", { type: "click" });
  o.after?.(ctx);
  const session = rec.stop();
  h.dispose();
  owner.dispose();
  return { session, storeId, txName, ctx };
}
const txPayload = (c: Captured): unknown => {
  const e = c.session.events.find((x) => x.kind === "tx" && x.name === c.txName);
  if (e === undefined || e.kind !== "tx") throw new Error("no tx event recorded");
  return e.payload;
};
const text = (v: Session): string => JSON.stringify(v);

describe("std.sessions: a recording holds each value as its schema encodes it", () => {
  test("for every generated state and payload schema with open objects, undeclared keys added at depths 1 to 3 (key names and strings under them) appear nowhere in the recording; its state and tx payload parse with their schemas", async () => {
    await fc.assert(
      fc.asyncProperty(
        rootArb.chain((sp) =>
          rootArb.chain((pp) => fc.tuple(fc.constant(sp), fc.constant(pp), gen(schemaOf(sp)), gen(schemaOf(pp)))),
        ),
        fc.array(fc.nat(), { minLength: 1, maxLength: 3 }),
        fc.array(fc.nat(), { minLength: 1, maxLength: 3 }),
        fc.array(shapeArb, { minLength: 1, maxLength: 3 }),
        async ([sp, pp, sv, pv], statePicks, payloadPicks, shapes) => {
          const found: string[] = [];
          const state = rootSchema(sp);
          const payload = rootSchema(pp);
          const initial = withUndeclared(sp, sv, statePicks, shapes, found);
          const sent = withUndeclared(pp, pv, payloadPicks, [...shapes].reverse(), found);
          const c = await capture({ state, initial, payload, sent });
          const out = text(c.session);
          expect(found.length).toBeGreaterThanOrEqual(2);
          for (const m of found) expect(out, `a marker is recorded: ${m}`).not.toContain(m);
          const recorded = c.session.state[c.storeId];
          expect(state.parse(recorded).ok).toBe(true);
          expect(payload.parse(txPayload(c)).ok).toBe(true);
          // each is what its schema encodes: the declared part only
          expect(recorded).toEqual(state.encode(sv));
          expect(txPayload(c)).toEqual(payload.encode(pv));
        },
      ),
      opts,
    );
  });

  test("the same holds for the route's params and search: an undeclared key of either, its name and what is under it, is not recorded", async () => {
    await fc.assert(
      fc.asyncProperty(shapeArb, shapeArb, fc.stringMatching(/^[a-z]{1,8}$/), async (inP, inS, q) => {
        const found: string[] = [];
        const params = { id: "u1", [mark()]: undeclaredValue(inP, found) };
        const search = { q, [mark()]: undeclaredValue(inS, found) };
        for (const k of [...Object.keys(params), ...Object.keys(search)]) if (k.startsWith("qzjxkvw")) found.push(k);
        const none = s.object({});
        const c = await capture({ state: none, initial: {}, payload: none, sent: {}, params, search });
        const out = text(c.session);
        for (const m of found) expect(out).not.toContain(m);
        expect(c.session.route.params).toEqual({ id: "u1" });
        expect(c.session.route.search).toEqual({ q });
      }),
      opts,
    );
  });

  test("a value at an undeclared key of the root, of a declared open object and of an object in an array is not recorded, and one in a union's member, a record's value and a nullable object is held as encoded", async () => {
    const Item = s.object({ n: s.int() });
    const State = s.object({
      top: s.object({ a: s.string() }),
      list: s.array(Item),
      byName: s.record(Item),
      maybe: Item.nullable(),
    });
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -9, max: 9 }), async (n) => {
        const found: string[] = [];
        const x = (): unknown => undeclaredValue(["obj", "arr"], found);
        const initial = {
          top: { a: "kept", [mark()]: x() },
          list: [{ n, [mark()]: x() }],
          byName: { r1: { n, [mark()]: x() } },
          maybe: { n, [mark()]: x() },
          [mark()]: x(),
        };
        for (const k of [
          Object.keys(initial),
          Object.keys(initial.top),
          Object.keys(initial.list[0] ?? {}),
          Object.keys(initial.byName.r1),
          Object.keys(initial.maybe),
        ].flat())
          if (k.startsWith("qzjxkvw")) found.push(k);
        const none = s.object({});
        const c = await capture({ state: State, initial, payload: none, sent: {} });
        for (const m of found) expect(text(c.session)).not.toContain(m);
        expect(c.session.state[c.storeId]).toEqual({
          top: { a: "kept" },
          list: [{ n }],
          byName: { r1: { n } },
          maybe: { n },
        });
      }),
      opts,
    );
  });
});

describe("std.sessions: an author declares a key to record it", () => {
  test("a declared field, and every key of a `s.record`, is recorded; the same key left undeclared is not", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{16}$/), fc.stringMatching(/^[a-z]{16}$/), async (key, value) => {
        const k = `k${key}`;
        const v = `v${value}`;
        const none = s.object({});
        const declared = await capture({
          state: s.object({ [k]: s.string() }),
          initial: { [k]: v },
          payload: none,
          sent: {},
        });
        expect(declared.session.state[declared.storeId]).toEqual({ [k]: v });
        const asRecord = await capture({
          state: s.object({ m: s.record(s.string()) }),
          initial: { m: { [k]: v } },
          payload: none,
          sent: {},
        });
        expect(asRecord.session.state[asRecord.storeId]).toEqual({ m: { [k]: v } });
        const open = await capture({ state: s.object({}), initial: { [k]: v }, payload: none, sent: {} });
        expect(open.session.state[open.storeId]).toEqual({});
        expect(text(open.session)).not.toContain(v);
        expect(text(open.session)).not.toContain(k);
      }),
      opts,
    );
  });

  test("a payload field declared in its transaction's schema is recorded as sent; an undeclared one is not", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{16}$/), fc.stringMatching(/^[a-z]{16}$/), async (a, b) => {
        const P = s.object({ keep: s.string() });
        const c = await capture({
          state: s.object({}),
          initial: {},
          payload: P,
          sent: { keep: `k${a}`, drop: `d${b}` },
        });
        expect(txPayload(c)).toEqual({ keep: `k${a}` });
        expect(text(c.session)).not.toContain(`d${b}`);
      }),
      opts,
    );
  });
});

describe("std.sessions: the two stated examples", () => {
  test("a store of state schema s.object({ m: s.record(s.string()) }) and initial { m: { k1: 'v1' } } is recorded with that state", async () => {
    const none = s.object({});
    const c = await capture({
      state: s.object({ m: s.record(s.string()) }),
      initial: { m: { k1: "v1" } },
      payload: none,
      sent: {},
    });
    expect(c.session.state[c.storeId]).toEqual({ m: { k1: "v1" } });
  });

  test("a store of state schema s.object({ m: s.object({}) }) and that initial is recorded with state { m: {} }", async () => {
    const none = s.object({});
    const c = await capture({
      state: s.object({ m: s.object({}) }),
      initial: { m: { k1: "v1" } },
      payload: none,
      sent: {},
    });
    expect(c.session.state[c.storeId]).toEqual({ m: {} });
    expect(text(c.session)).not.toContain("v1");
    expect(text(c.session)).not.toContain("k1");
  });
});

describe("std.sessions: errors after a tx drop a .pii() open object's undeclared keys and everything under it", () => {
  const Pii = s.object({ p: s.object({}).pii("contact") });
  const none = s.object({});
  const reportError = (ctx: SimCtx, message: string, data: unknown): void => {
    report(ctx, { kind: "error", error: { code: "usr.bad", message, data } });
  };

  test("after a tx of payload { p: { u: 'qwertyuiopasdfgh' } }, an error with message 'bad qwertyuiopasdfgh' and data { v: 'qwertyuiopasdfgh' } is recorded holding no 'qwertyuiopasdfgh'", async () => {
    const c = await capture({
      state: none,
      initial: {},
      payload: Pii,
      sent: { p: { u: "qwertyuiopasdfgh" } },
      after: (ctx) => reportError(ctx, "bad qwertyuiopasdfgh", { v: "qwertyuiopasdfgh" }),
    });
    expect(c.session.events.some((e) => e.kind === "error")).toBe(true);
    expect(c.session.error?.code).toBe("usr.bad");
    expect(text(c.session)).not.toContain("qwertyuiopasdfgh");
  });

  test("for every undeclared key name, string and number under the marked open object, an error naming it in its message or data is recorded without it", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{16}$/),
        fc.stringMatching(/^[a-z]{16}$/),
        fc.integer({ min: 100000000, max: 999999999 }),
        fc.constantFrom("message", "data", "both"),
        async (key, str, num, where) => {
          const k = `k${key}`;
          const v = `v${str}`;
          const c = await capture({
            state: none,
            initial: {},
            payload: Pii,
            sent: { p: { [k]: v, n: num, deep: { [`d${key}`]: [`e${str}`] } } },
            after: (ctx) =>
              reportError(
                ctx,
                where === "data" ? "bad" : `bad ${k} ${v} ${num} d${key} e${str}`,
                where === "message" ? null : { k, v, n: num, d: `d${key}`, e: `e${str}` },
              ),
          });
          const out = text(c.session);
          for (const m of [k, v, String(num), `d${key}`, `e${str}`]) expect(out).not.toContain(m);
          expect(c.session.events.some((e) => e.kind === "error")).toBe(true);
        },
      ),
      opts,
    );
  });
});

describe("std.sessions: where a .pii() open object's undeclared values are read: a state as last given to its store and route values", () => {
  const Pii = s.object({ p: s.object({}).pii("contact") });
  const none = s.object({});
  const reportError = (ctx: SimCtx, message: string, data: unknown): void => {
    report(ctx, { kind: "error", error: { code: "usr.bad", message, data } });
  };
  const nested = (key: string, str: string, num: number): Record<string, unknown> => ({
    [`k${key}`]: `v${str}`,
    n: num,
    deep: { [`d${key}`]: [`e${str}`] },
  });
  const markers = (key: string, str: string, num: number): string[] => [
    `k${key}`,
    `v${str}`,
    String(num),
    `d${key}`,
    `e${str}`,
  ];
  const errorWith = (ms: readonly string[]): ((ctx: SimCtx) => void) => {
    return (ctx) => reportError(ctx, `bad ${ms.join(" ")}`, { all: ms });
  };

  test("a state as last given to its store (`initial`): an error naming an undeclared key, string or number under a marked open object of the store's state is recorded without it", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{16}$/),
        fc.stringMatching(/^[a-z]{16}$/),
        fc.integer({ min: 100000000, max: 999999999 }),
        async (key, str, num) => {
          const ms = markers(key, str, num);
          const c = await capture({
            state: Pii,
            initial: { p: nested(key, str, num) },
            payload: none,
            sent: {},
            after: errorWith(ms),
          });
          const out = text(c.session);
          expect(c.session.events.some((e) => e.kind === "error")).toBe(true);
          for (const m of ms) expect(out).not.toContain(m);
        },
      ),
      opts,
    );
  });

  test("route values: an error naming a marked params string, a marked search string or a marked search number is recorded without it", async () => {
    // Reading: a route's `params` and `search` hold scalars (a contract refuses an object there), so a route value under a mark is a marked leaf.
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{16}$/),
        fc.stringMatching(/^[a-z]{16}$/),
        fc.integer({ min: 100000000, max: 999999999 }),
        fc.stringMatching(/^[a-z]{16}$/),
        async (_key, str, num, id) => {
          const ms = [`q${str}`, String(num), `i${id}`];
          const c = await capture({
            state: none,
            initial: {},
            payload: none,
            sent: {},
            paramsSchema: s.object({ id: s.string().pii("contact") }),
            searchSchema: s.object({ q: s.string().pii("contact").optional(), n: s.int().pii("contact").optional() }),
            params: { id: `i${id}` },
            search: { q: `q${str}`, n: num },
            after: errorWith(ms),
          });
          const out = text(c.session);
          expect(c.session.events.some((e) => e.kind === "error")).toBe(true);
          for (const m of ms) expect(out).not.toContain(m);
        },
      ),
      opts,
    );
  });

  test("a marker no marked path holds is kept in the error's message and data", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{16}$/), async (str) => {
        const c = await capture({
          state: none,
          initial: {},
          payload: Pii,
          sent: { p: { u: `u${str}` } },
          after: (ctx) => reportError(ctx, `bad t${str}`, { v: `t${str}` }),
        });
        expect(c.session.error?.message).toContain(`t${str}`);
        expect(text(c.session)).not.toContain(`u${str}`);
      }),
      opts,
    );
  });
});
