// @vitest-environment happy-dom
// std.sessions: every way a value reaches a recording, against every way an error reaches it. For each source (a
// store's `initial`, state seeded by `restore`, a `restore` after the page rendered whose snapshot gives the value in its
// `initial` only (a snapshot given from outside, as the conformance builds it), state a transaction makes, an undo back
// to such a state after a later commit, a `tx` payload, a route's search) holding an
// undeclared key under a `.pii()`-marked open object (a route's search: a marked scalar), and each error channel
// (`report` message, `data` values, `data` keys, a nested `cause`, a loader that throws an `Error`, throws a string, or rejects), the
// recording's bytes hold neither the key's name nor its value. Seed 1337.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Button } from "@keel/ui";
import fc from "fast-check";
import { expect, test } from "vitest";
import { record } from "../src/index.ts";

type Source = "initial" | "restore" | "restoreInitial" | "txState" | "undo" | "payload" | "search";
type Channel = "message" | "data" | "dataKey" | "cause" | "throwError" | "throwString" | "reject";
const SOURCES: readonly Source[] = ["initial", "restore", "restoreInitial", "txState", "undo", "payload", "search"];
const CHANNELS: readonly Channel[] = ["message", "data", "dataKey", "cause", "throwError", "throwString", "reject"];

let runs = 0;
const Pii = s.object({ p: s.object({}).pii("contact") });

/** The recording's JSON after `source` carries `k: v` and an error on `channel` names `k` and `v`. */
async function recorded(source: Source, channel: Channel, k: string, v: string): Promise<string> {
  const id = `sw${runs++}`;
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const rec = record(ctx);
  const text = `bad ${k} ${v}`;
  const Search = s.object({ q: s.string().pii("contact").optional() });
  const c = contract(id, {
    [`${id}.show`]: { path: `/${id}`, search: Search },
    [`${id}.boom`]: { path: `/${id}/boom` },
  });
  const made: { st: ReturnType<typeof store>; routes: ReturnType<typeof manifest>; clear: () => void }[] = [];
  const owner = scope(() => {
    const st = store(Pii, source === "initial" ? { p: { [k]: v } } : { p: {} }, { id: `${id}.st` });
    const set = transaction(st, `${id}.set`, Pii, (state) =>
      source === "txState" || source === "undo" ? { p: { ...state.p, [k]: v } } : state,
    );
    const emptied = transaction(st, `${id}.clear`, s.object({}), () => ({ p: {} }));
    const thrown = (): never => {
      if (channel === "throwError") throw new Error(text);
      throw text;
    };
    const routes = manifest(c, {
      [`${id}.show`]: {
        component: () =>
          Box({
            as: "main",
            id: `${id}.page`,
            children: [
              Button({
                id: `${id}.go`,
                children: "Go",
                onClick: () => void tx(set, source === "payload" ? { p: { [k]: v } } : { p: {} }),
              }),
            ],
          }),
      },
      [`${id}.boom`]: {
        loader: loader(c, `${id}.boom`, { output: s.object({}) }, async () =>
          channel === "reject" ? Promise.reject(text) : thrown(),
        ),
        component: () => Box({ as: "main", id: `${id}.boomed`, children: "boom" }),
      },
    });
    made.push({ st, routes, clear: () => void tx(emptied, {}) });
  });
  const [m] = made;
  if (m === undefined) throw new Error("built");
  const h = await renderRoute(`${id}.show`, {
    routes: m.routes,
    ctx,
    search: source === "search" ? { q: v } : {},
    ...(source === "restore" ? { state: [[m.st, { p: { [k]: v } }]] as const } : {}),
  });
  await h.fire(`${id}.go`, { type: "click" });
  if (source === "restoreInitial")
    expect(m.st.restore({ ...m.st.snapshot(), initial: { p: { [k]: v } }, log: [], keys: [] }).ok).toBe(true);
  if (source === "undo") {
    m.clear();
    expect(m.st.undo()).toBe(true);
  }
  if (channel === "message") report(ctx, { kind: "error", error: { code: "usr.bad", message: text, data: null } });
  if (channel === "data") report(ctx, { kind: "error", error: { code: "usr.bad", message: "bad", data: { k, v } } });
  if (channel === "dataKey")
    report(ctx, { kind: "error", error: { code: "usr.bad", message: "bad", data: { [k]: 1, [v]: { [k]: 2 } } } });
  if (channel === "cause")
    report(ctx, { kind: "error", error: { code: "usr.bad", message: "bad", data: { cause: { message: text } } } });
  if (channel === "throwError" || channel === "throwString" || channel === "reject")
    await h.navigate(c.href(`${id}.boom`)).catch(() => undefined);
  const session = rec.stop();
  h.dispose();
  owner.dispose();
  expect(session.events.some((e) => e.kind === "error")).toBe(true);
  return JSON.stringify(session);
}

for (const source of SOURCES)
  for (const channel of CHANNELS)
    test(`${source} through ${channel}: the recording holds neither the undeclared key nor its value`, async () => {
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^[a-z]{14}$/), fc.stringMatching(/^[a-z]{14}$/), async (a, b) => {
          const k = `kq${a}`;
          const v = `vq${b}`;
          const out = await recorded(source, channel, k, v);
          if (source !== "search") expect(out).not.toContain(k);
          expect(out).not.toContain(v);
        }),
        { seed: 1337, numRuns: 3 },
      );
    });
