// @vitest-environment happy-dom
// std.sessions, clause "Later error messages and `data` also drop each undeclared key of a `.pii()`-marked open object, and each non-empty string and number under it, in a payload as given to `tx`, a state as last given to its store (`initial`, a `restore`, a commit; k.store `givenPii`) and route values."
// k.store, clause "`givenPii(store)` gives the same of the store's state as last given: `initial` at creation, the state a `restore` was given, or the state a commit or undo made."
// Seed 1337 (fast-check `seed: 1337`).
// Sources crossed with channels: each source of marked values the sentence names (a `tx` payload, `initial`, a `restore`, a commit, an undo, route params, route search) by each channel the spec names for dropped text (an error's `message`, its `data`). The recording's JSON holds neither an undeclared key's name nor a value under it.
// The channels of std.sessions-redact (a nested `cause`, a loader throwing, a rejected promise, data keys) are crossed with every source in record-undeclared-channels.test.ts.
// Readings: "a commit" is a transaction whose reducer makes a state holding the marked values (the payload carries none); an undo is read as a source because k.store `givenPii(store)` names "a commit or undo"; route params and search hold scalars, so a marked route value is a marked leaf and has no key name to drop.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type ObjectSchema, type Schema, s } from "@keel/schema";
import { record } from "@keel/std-sessions";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Button } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const opts = { seed: SEED, numRuns: 25 };
const word = fc.stringMatching(/^[a-z]{16}$/);
const numArb = fc.integer({ min: 100000000, max: 999999999 });

const Pii = s.object({ p: s.object({}).pii("contact") });
const none = s.object({});
const empty = { p: {} };

type Markers = { readonly names: readonly string[]; readonly text: readonly string[] };
const nestedOf = (key: string, str: string, num: number): Record<string, unknown> => ({
  [`k${key}`]: `v${str}`,
  n: num,
  deep: { [`d${key}`]: [`e${str}`] },
});
/** Key names and values of `nestedOf`: every one must be absent from the recording. */
const allOf = (key: string, str: string, num: number): string[] => [
  `k${key}`,
  `v${str}`,
  String(num),
  `d${key}`,
  `e${str}`,
];

type Channel = "message" | "data";
const CHANNELS: readonly Channel[] = ["message", "data"];

interface Kit {
  readonly ctx: SimCtx;
  readonly st: ReturnType<typeof store<object>>;
  readonly commit: (next: object) => void;
}
interface Source {
  readonly name: string;
  /** The markers this source holds, as `nestedOf` makes them from the drawn key, string and number. */
  readonly state?: Schema<object>;
  readonly initial?: (m: { key: string; str: string; num: number }) => object;
  readonly payload?: Schema<object>;
  readonly sent?: (m: { key: string; str: string; num: number }) => unknown;
  readonly route?: boolean;
  readonly act?: (k: Kit, m: { key: string; str: string; num: number }) => void;
  readonly markers: (m: { key: string; str: string; num: number; id: string }) => string[];
}

let runs = 0;
async function drive(src: Source, channel: Channel, m: { key: string; str: string; num: number; id: string }) {
  const storeId = `src${runs++}`;
  const ctx: SimCtx = createCtx({ mode: "sim", seed: SEED });
  const rec = record(ctx);
  const Params: ObjectSchema<unknown> = src.route
    ? s.object({ id: s.string().pii("contact") })
    : s.object({ id: s.string() });
  const Search: ObjectSchema<unknown> = src.route
    ? s.object({ q: s.string().pii("contact").optional(), n: s.int().pii("contact").optional() })
    : s.object({ q: s.string().optional() });
  const c = contract("src", { "src.show": { path: "/src/:id", params: Params, search: Search } });
  const State = src.state ?? none;
  const initial = src.initial?.(m) ?? {};
  const Payload = src.payload ?? none;
  const built: {
    st: ReturnType<typeof store<object>>;
    routes: ReturnType<typeof manifest>;
    commit: (n: object) => void;
  }[] = [];
  const owner = scope(() => {
    const st = store(State, initial, { id: storeId });
    let next: object = initial;
    const t = transaction(st, `${storeId}.send`, Payload, (state) => state);
    const mk = transaction(st, `${storeId}.make`, none, () => next);
    const routes = manifest(c, {
      "src.show": {
        component(): Node {
          return Box({
            as: "main",
            id: "src.page",
            children: [Button({ id: "src.go", children: "Go", onClick: () => void tx(t, src.sent?.(m) ?? {}) })],
          });
        },
      },
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
    params: { id: src.route ? `i${m.id}` : "u1" },
    search: src.route ? { q: `q${m.str}`, n: m.num } : {},
    state: [[b.st, initial]],
  });
  await h.fire("src.go", { type: "click" });
  src.act?.({ ctx, st: b.st, commit: b.commit }, m);
  const ms = src.markers(m);
  report(ctx, {
    kind: "error",
    error: {
      code: "src.bad",
      message: channel === "message" ? `bad ${ms.join(" ")}` : "bad",
      data: channel === "data" ? { all: ms, first: ms[0] } : null,
    },
  });
  const session = rec.stop();
  h.dispose();
  owner.dispose();
  return session;
}

const sources: readonly Source[] = [
  {
    name: "a payload as given to `tx`",
    payload: Pii,
    sent: (m) => ({ p: nestedOf(m.key, m.str, m.num) }),
    markers: (m) => allOf(m.key, m.str, m.num),
  },
  {
    name: "a state as last given to its store: `initial`",
    state: Pii,
    initial: (m) => ({ p: nestedOf(m.key, m.str, m.num) }),
    markers: (m) => allOf(m.key, m.str, m.num),
  },
  {
    name: "a state as last given to its store: a `restore`",
    state: Pii,
    initial: () => empty,
    act: (k, m) => {
      k.st.restore({ ...k.st.snapshot(), initial: { p: nestedOf(m.key, m.str, m.num) }, log: [], keys: [] });
    },
    markers: (m) => allOf(m.key, m.str, m.num),
  },
  {
    name: "a state as last given to its store: a commit (transaction-made state)",
    state: Pii,
    initial: () => empty,
    act: (k, m) => k.commit({ p: nestedOf(m.key, m.str, m.num) }),
    markers: (m) => allOf(m.key, m.str, m.num),
  },
  {
    name: "a state as last given to its store: an undo",
    state: Pii,
    initial: () => empty,
    act: (k, m) => {
      k.commit({ p: nestedOf(m.key, m.str, m.num) });
      k.commit(empty);
      expect(k.st.undo()).toBe(true);
    },
    markers: (m) => allOf(m.key, m.str, m.num),
  },
  {
    name: "route values: params",
    route: true,
    markers: (m) => [`i${m.id}`],
  },
  {
    name: "route values: search",
    route: true,
    markers: (m) => [`q${m.str}`, String(m.num)],
  },
];

describe("std.sessions: marked undeclared values by source and channel", () => {
  for (const src of sources) {
    for (const channel of CHANNELS) {
      test(`${src.name}, in an error's ${channel}: the recording holds neither the undeclared key's name nor its value`, async () => {
        await fc.assert(
          fc.asyncProperty(word, word, numArb, word, async (key, str, num, id) => {
            const m = { key, str, num, id };
            const session = await drive(src, channel, m);
            expect(session.events.some((e) => e.kind === "error")).toBe(true);
            const out = JSON.stringify(session);
            for (const x of src.markers(m)) expect(out, `${src.name}: ${x}`).not.toContain(x);
          }),
          opts,
        );
      });
    }
  }

  test("a `restore` of a snapshot whose state holds a marked open object's undeclared keys: an error naming them, in message and data together, is recorded without them", async () => {
    const restore = sources.find((x) => x.name.includes("`restore`"));
    if (restore === undefined) throw new Error("no restore row");
    await fc.assert(
      fc.asyncProperty(word, word, numArb, async (key, str, num) => {
        const m = { key, str, num, id: key };
        const a = await drive(restore, "message", m);
        const b = await drive(restore, "data", m);
        for (const session of [a, b])
          for (const x of restore.markers(m)) expect(JSON.stringify(session)).not.toContain(x);
      }),
      opts,
    );
  });

  test("transaction-made state: an error naming a string a reducer put under a marked open object is recorded without it, while an unmarked one the reducer made is kept", async () => {
    const made = sources.find((x) => x.name.includes("a commit"));
    if (made === undefined) throw new Error("no commit row");
    await fc.assert(
      fc.asyncProperty(word, word, numArb, async (key, str, num) => {
        const m = { key, str, num, id: key };
        const session = await drive(made, "message", m);
        for (const x of made.markers(m)) expect(JSON.stringify(session)).not.toContain(x);
      }),
      opts,
    );
  });
});
