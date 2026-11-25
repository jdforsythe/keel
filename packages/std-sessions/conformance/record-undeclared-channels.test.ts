// @vitest-environment happy-dom
// Spec: std.sessions-redact, clause "Each value std.sessions drops from later error messages and `data` (a redacted value; a marked open object's undeclared key, or a non-empty string or number under it, in a payload, a state or route values) is dropped from every error the recorder records, however the error reached the ctx: one passed to `report` (its `message`; in its `data`, at any depth, each string, each number and each object key, a nested `cause` among them), and the `keel.unexpected` a route's loader ends in when it throws an `Error` (its `message`), throws any other value (its `String()`) or returns a promise that rejects (its reason, read the same way)."
// Spec: std.sessions-redact, clause "For a store of state schema `s.object({ p: s.object({}).pii('contact') })`, with an undeclared key and a string under `p` given through `initial`, a `restore` whose snapshot holds them in `initial` only, a commit, or an undo back to a commit that made them, and for a `tx` payload of that schema holding them: an error then reported with them in its `message`, as `data` values, as `data` keys or in a nested `cause`, and one a loader ends in by throwing an `Error` naming them, throwing a string naming them, or rejecting with a string naming them, is recorded holding neither."
// Spec: std.sessions, clause "Later error messages and `data` also drop each undeclared key of a `.pii()`-marked open object, and each non-empty string and number under it, in a payload as given to `tx`, a state as last given to its store (`initial`, a `restore`, a commit or an undo; k.store `givenPii`) and route values, in every error the recorder records (std.sessions-redact)."
// Seed 1337 (fast-check `seed: 1337`).
// Sources (initial, a restore, a commit, an undo, a `tx` payload, route params, route search) crossed with channels (message; data string; data number; data object KEY; a nested `cause`; a loader throwing an `Error`; throwing a string; throwing a number; throwing an object read by `String()`; a rejected promise's reason as an `Error` and as a string). The recording's bytes hold neither the undeclared key's name nor its value.
// Readings: route params hold one string and no number or key, so the number channels do not cross them; route search holds a string and a number, no key. The channels' texts name every marker the source holds; a number channel names only the number (a data number, a thrown number). The data-key channel and the thrown-non-Error channels are named cases: a `data` key and a thrown `String()` were not scrubbed before RFC 0236.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type ObjectSchema, type Schema, ok, s } from "@keel/schema";
import { record } from "@keel/std-sessions";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Button } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const opts = { seed: SEED, numRuns: 10 };
const word = fc.stringMatching(/^[a-z]{16}$/);
const numArb = fc.integer({ min: 100000000, max: 999999999 });

const Pii = s.object({ p: s.object({}).pii("contact") });
const none = s.object({});
const empty = { p: {} };

type M = { key: string; str: string; num: number; id: string };
const nestedOf = (m: M): Record<string, unknown> => ({
  [`k${m.key}`]: `v${m.str}`,
  n: m.num,
  deep: { [`d${m.key}`]: [`e${m.str}`] },
});
const allOf = (m: M): string[] => [`k${m.key}`, `v${m.str}`, String(m.num), `d${m.key}`, `e${m.str}`];
const keysOf = (m: M): string[] => [`k${m.key}`, `d${m.key}`];

interface Kit {
  readonly st: ReturnType<typeof store<object>>;
  readonly commit: (next: object) => void;
}
interface Source {
  readonly name: string;
  readonly state?: Schema<object>;
  readonly initial?: (m: M) => object;
  readonly payload?: Schema<object>;
  readonly sent?: (m: M) => unknown;
  readonly route?: "params" | "search";
  readonly act?: (k: Kit, m: M) => void;
  /** Every marker string the source holds. */
  readonly markers: (m: M) => string[];
  /** Object keys among the markers. */
  readonly keys: (m: M) => string[];
  /** The number the source holds, if any. */
  readonly num: boolean;
}

const nested = (name: string, extra: Partial<Source>): Source => ({
  name,
  state: Pii,
  initial: () => empty,
  markers: allOf,
  keys: keysOf,
  num: true,
  ...extra,
});

const sources: readonly Source[] = [
  nested("a state as last given: `initial`", { initial: (m) => ({ p: nestedOf(m) }) }),
  nested("a state as last given: a `restore`", {
    act: (k, m) => k.st.restore({ ...k.st.snapshot(), initial: { p: nestedOf(m) }, log: [], keys: [] }),
  }),
  nested("a state as last given: a commit", { act: (k, m) => k.commit({ p: nestedOf(m) }) }),
  nested("a state as last given: an undo", {
    act: (k, m) => {
      k.commit({ p: nestedOf(m) });
      k.commit(empty);
      expect(k.st.undo()).toBe(true);
    },
  }),
  {
    name: "a payload as given to `tx`",
    payload: Pii,
    sent: (m) => ({ p: nestedOf(m) }),
    markers: allOf,
    keys: keysOf,
    num: true,
  },
  { name: "route values: params", route: "params", markers: (m) => [`i${m.id}`], keys: () => [], num: false },
  {
    name: "route values: search",
    route: "search",
    markers: (m) => [`q${m.str}`, String(m.num)],
    keys: () => [],
    num: true,
  },
];

type Throw = () => Promise<never>;
interface Channel {
  readonly name: string;
  /** Needs a number the source holds. */
  readonly numeric?: true;
  /** Needs an object key the source holds. */
  readonly keyed?: true;
  readonly via: "report" | "loader";
  readonly make: (ms: string[], keys: string[], num: number) => { message: string; data: unknown } | Throw;
}
class Named {
  constructor(private readonly label: string) {}
  toString(): string {
    return this.label;
  }
}
const text = (ms: string[]): string => `bad ${ms.join(" ")}`;
const channels: readonly Channel[] = [
  { name: "a reported error's message", via: "report", make: (ms) => ({ message: text(ms), data: null }) },
  {
    name: "a reported error's data string",
    via: "report",
    make: (ms) => ({ message: "bad", data: { all: ms, first: ms[0] } }),
  },
  {
    name: "a reported error's data number, at depth",
    numeric: true,
    via: "report",
    make: (_ms, _k, num) => ({ message: "bad", data: { deep: [{ n: num }] } }),
  },
  {
    name: "a reported error's data object KEY, at depth",
    keyed: true,
    via: "report",
    make: (_ms, keys) => ({
      message: "bad",
      data: { ...Object.fromEntries(keys.map((k) => [k, 1])), deep: [Object.fromEntries(keys.map((k) => [k, 1]))] },
    }),
  },
  {
    name: "a reported error's nested `cause`",
    via: "report",
    make: (ms, keys, num) => ({
      message: "bad",
      data: { cause: { message: text(ms), data: { n: num, all: ms, [keys[0] ?? "k"]: 1 }, cause: { message: ms[0] } } },
    }),
  },
  {
    name: "a loader throwing an `Error` (its message)",
    via: "loader",
    make: (ms) => () => {
      throw new Error(text(ms));
    },
  },
  {
    name: "a loader throwing a string",
    via: "loader",
    make: (ms) => () => {
      throw text(ms);
    },
  },
  {
    name: "a loader throwing a number (its String())",
    numeric: true,
    via: "loader",
    make: (_ms, _k, num) => () => {
      throw num;
    },
  },
  {
    name: "a loader throwing an object (its String())",
    via: "loader",
    make: (ms) => () => {
      throw new Named(text(ms));
    },
  },
  {
    name: "a loader returning a promise rejecting with an `Error` (its reason)",
    via: "loader",
    make: (ms) => () => Promise.reject(new Error(text(ms))),
  },
  {
    name: "a loader returning a promise rejecting with a string (its reason)",
    via: "loader",
    make: (ms) => () => Promise.reject(text(ms)),
  },
];

let runs = 0;
async function drive(src: Source, ch: Channel, m: M) {
  const storeId = `chan${runs++}`;
  const ctx: SimCtx = createCtx({ mode: "sim", seed: SEED });
  const rec = record(ctx);
  const Params: ObjectSchema<unknown> =
    src.route === "params" ? s.object({ id: s.string().pii("contact") }) : s.object({ id: s.string() });
  const Search: ObjectSchema<unknown> =
    src.route === "search"
      ? s.object({ q: s.string().pii("contact").optional(), n: s.int().pii("contact").optional() })
      : s.object({ q: s.string().optional() });
  const c = contract("src", {
    "src.show": { path: "/src/:id", params: Params, search: Search },
    "src.bad": { path: "/bad" },
  });
  const initial = src.initial?.(m) ?? {};
  let armed: Throw | null = null;
  const run = (): Promise<ReturnType<typeof ok<object>>> => {
    const t = armed;
    return t === null ? Promise.resolve(ok({})) : t().then(() => ok({}));
  };
  const built: {
    st: ReturnType<typeof store<object>>;
    routes: ReturnType<typeof manifest>;
    commit: (n: object) => void;
  }[] = [];
  const owner = scope(() => {
    const st = store(src.state ?? none, initial, { id: storeId });
    let next: object = initial;
    const t = transaction(st, `${storeId}.send`, src.payload ?? none, (state) => state);
    const mk = transaction(st, `${storeId}.make`, none, () => next);
    const page =
      (id: string): (() => Node) =>
      () =>
        Box({
          as: "main",
          id: "src.page",
          children: [Button({ id: "src.go", children: id, onClick: () => void tx(t, src.sent?.(m) ?? {}) })],
        });
    const routes = manifest(c, {
      "src.show": { component: page("show"), loader: loader(c, "src.show", { output: s.object({}) }, run) },
      "src.bad": { component: page("bad"), loader: loader(c, "src.bad", { output: s.object({}) }, run) },
    });
    built.push({
      st,
      routes,
      commit: (n) => {
        next = n;
        void tx(mk, {});
      },
    });
  });
  const [b] = built;
  if (b === undefined) throw new Error("drive: build failed");
  const h = await renderRoute("src.show", {
    routes: b.routes,
    ctx,
    params: { id: src.route === "params" ? `i${m.id}` : "u1" },
    search: src.route === "search" ? { q: `q${m.str}`, n: m.num } : {},
    state: [[b.st, initial]],
  });
  await h.fire("src.go", { type: "click" });
  src.act?.({ st: b.st, commit: b.commit }, m);
  const ms = ch.numeric === true && !ch.name.includes("nested") ? [String(m.num)] : src.markers(m);
  const made = ch.make(ms, src.keys(m), m.num);
  if (ch.via === "report" && typeof made !== "function") {
    report(ctx, { kind: "error", error: { code: "src.bad", message: made.message, data: made.data } });
  } else if (typeof made === "function") {
    armed = made;
    await h.navigate(c.href("src.bad"));
  }
  const session = rec.stop();
  h.dispose();
  owner.dispose();
  return session;
}

describe("std.sessions-redact: every channel an error reaches the ctx by, from every source of marked values", () => {
  for (const src of sources) {
    for (const ch of channels) {
      if (ch.numeric === true && !src.num) continue;
      if (ch.keyed === true && src.keys({ key: "a", str: "b", num: 1, id: "c" }).length === 0) continue;
      test(`${src.name}; ${ch.name}: the recording holds neither the undeclared key's name nor its value`, async () => {
        await fc.assert(
          fc.asyncProperty(word, word, numArb, word, async (key, str, num, id) => {
            const m = { key, str, num, id };
            const session = await drive(src, ch, m);
            expect(session.events.some((e) => e.kind === "error")).toBe(true);
            const out = JSON.stringify(session);
            const named =
              ch.numeric === true && !ch.name.includes("nested")
                ? [String(num)]
                : ch.keyed === true
                  ? src.keys(m)
                  : src.markers(m);
            for (const x of named) expect(out, `${src.name} / ${ch.name}: ${x}`).not.toContain(x);
          }),
          opts,
        );
      });
    }
  }

  // Control: the channels carry their text into the recording, so the cases above are not vacuous. An unmarked state drops nothing (std.sessions: only `.pii()` values and redacted values are dropped from error text).
  const unmarked: Source = nested("an unmarked state given through `initial`", {
    state: s.object({ p: s.object({}) }),
    initial: (m) => ({ p: nestedOf(m) }),
  });
  for (const name of [
    "a reported error's message",
    "a reported error's data object KEY, at depth",
    "a loader throwing an `Error` (its message)",
    "a loader throwing a string",
    "a loader throwing an object (its String())",
    "a loader throwing a number (its String())",
    "a loader returning a promise rejecting with a string (its reason)",
  ]) {
    test(`control, ${name}: with nothing marked the recording keeps the text`, async () => {
      const ch = channels.find((x) => x.name === name);
      if (ch === undefined) throw new Error(`no channel ${name}`);
      await fc.assert(
        fc.asyncProperty(word, word, numArb, word, async (key, str, num, id) => {
          const m = { key, str, num, id };
          const out = JSON.stringify(await drive(unmarked, ch, m));
          expect(out).toContain(ch.keyed === true ? `k${key}` : ch.numeric === true ? String(num) : `v${str}`);
        }),
        opts,
      );
    });
  }
});
