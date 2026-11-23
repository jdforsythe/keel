// k.server API: the stores a direct `run` or `live` makes from the declared factory live in a scope of the call's
// own: detached from the scope the call was made in, and disposed once the handler settles or the stream ends.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { action } from "../src/action.ts";
import { contract } from "../src/contract/contract.ts";
import { loader } from "../src/loader.ts";

const Out = s.object({ n: s.int() });
const c = contract("sc", {
  "sc.get": { method: "GET", path: "/api/sc", output: Out },
  "sc.feed": { method: "GET", path: "/api/sc/feed", output: Out, events: true },
  "sc.add": { method: "POST", path: "/api/sc", body: Out, output: Out },
});
const args = { params: {}, search: {}, url: "http://localhost/api/sc", caller: "c" };
const sim = () => createCtx({ mode: "sim", seed: 1337 });
const turns = async (): Promise<void> => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};

/** A stores factory whose scope logs its disposal, and a gate the handler waits at. */
function world() {
  const log: string[] = [];
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const factory = () => {
    log.push("made");
    scope(() => undefined).onDispose(() => void log.push("disposed"));
    return { n: 7 };
  };
  return { log, gate, open, factory };
}

describe("the stores of a direct call", () => {
  it("a loader's run disposes them once the handler settles, not when the caller's scope ends", async () => {
    const w = world();
    const l = loader(c, "sc.get", { stores: w.factory }, async ({ stores }) => {
      await w.gate;
      w.log.push("answer");
      return ok({ n: stores.n });
    });
    const outer = scope(() => undefined);
    const answer = outer.run(() => l.run(args, sim()));
    await turns();
    outer.dispose();
    expect(w.log).toEqual(["made"]);
    w.open();
    expect(await answer).toEqual(ok({ n: 7 }));
    expect(w.log).toEqual(["made", "answer", "disposed"]);
  });

  it("a loader's run disposes them when the handler throws", async () => {
    const w = world();
    const l = loader(c, "sc.get", { stores: w.factory }, async () => {
      throw new Error("boom");
    });
    await expect(l.run(args, sim())).rejects.toThrow("boom");
    expect(w.log).toEqual(["made", "disposed"]);
  });

  it("an action's run disposes them once the handler settles, not when the caller's scope ends", async () => {
    const w = world();
    const a = action(c, "sc.add", { stores: w.factory }, async (body, at) => {
      await w.gate;
      w.log.push("answer");
      return ok({ n: body.n + at.stores.n });
    });
    const outer = scope(() => undefined);
    const answer = outer.run(() => a.run({ n: 1 }, args, sim()));
    await turns();
    outer.dispose();
    expect(w.log).toEqual(["made"]);
    w.open();
    expect(await answer).toEqual(ok({ n: 8 }));
    expect(w.log).toEqual(["made", "answer", "disposed"]);
  });

  it("a live loader's live disposes them at the stream's end, not when the caller's scope ends", async () => {
    const w = world();
    const l = loader(c, "sc.feed", { stores: w.factory }, async function* ({ stores }) {
      yield ok({ n: stores.n });
      await w.gate;
      w.log.push("second");
      yield ok({ n: stores.n + 1 });
    });
    const outer = scope(() => undefined);
    const stream = l.live({ ...args, signal: new AbortController().signal }, sim())[Symbol.asyncIterator]();
    const first = outer.run(() => stream.next());
    expect(await first).toEqual({ done: false, value: ok({ n: 7 }) });
    const second = stream.next();
    await turns();
    outer.dispose();
    expect(w.log).toEqual(["made"]);
    w.open();
    expect(await second).toEqual({ done: false, value: ok({ n: 8 }) });
    expect(w.log).toEqual(["made", "second"]);
    expect((await stream.next()).done).toBe(true);
    expect(w.log).toEqual(["made", "second", "disposed"]);
  });

  it("a live loader's live disposes them when the reader stops early", async () => {
    const w = world();
    const l = loader(c, "sc.feed", { stores: w.factory }, async function* ({ stores }) {
      yield ok({ n: stores.n });
      yield ok({ n: stores.n + 1 });
    });
    for await (const r of l.live({ ...args, signal: new AbortController().signal }, sim())) {
      expect(r).toEqual(ok({ n: 7 }));
      break;
    }
    expect(w.log).toEqual(["made", "disposed"]);
  });
});
