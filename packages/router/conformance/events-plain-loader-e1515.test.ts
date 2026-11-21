// @vitest-environment happy-dom
// Spec: k.contract, clause "An `events: true` entry bound to a plain loader throws E1515; an async generator loader declared for a page, or an API GET without `events`, does not compile and `manifest` throws E1515."
// Spec: RFC 0157 Conformance diff: "An `events: true` entry bound to a loader whose `fn` is not an async generator throws E1515; with one, the client iterates its yields." (the client half: packages/services/conformance/contract-events.test.ts) Seed 1337.
// Compile-time half of each "does not compile" claim: ../unsafe/conformanceNegativeTypes.ts; the calls here are untyped.
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { thrown } from "./contract-support.ts";

const Tick = s.object({ n: s.int() });
const Page = s.object({ title: s.string() });
const pages = contract("p", {
  "p.shell": { layout: true },
  "p.home": { path: "/" },
});
const c = contract("a", {
  "a.ticks": { method: "GET", path: "/api/ticks", output: Tick, events: true },
  "a.plain": { method: "GET", path: "/api/plain", output: Tick },
});

describe("k.contract events entries", () => {
  it("An `events: true` entry bound to a plain loader throws E1515 and does not compile", () => {
    const plainTicks = loader(c, "a.ticks", {}, async () => ok({ n: 1 }));
    const plain = loader(c, "a.plain", {}, async () => ok({ n: 1 }));
    const bad = () =>
      Reflect.apply(manifest, undefined, [c, { "a.ticks": { loader: plainTicks }, "a.plain": { loader: plain } }]);
    const e = thrown(bad);
    expect(e?.code).toBe("E1515");
    expect(e?.message).toContain("a.ticks");
  });

  it("an `events: true` entry bound to an async generator is clean", () => {
    const live = loader(c, "a.ticks", {}, async function* () {
      yield ok({ n: 1 });
      yield ok({ n: 2 });
    });
    const plain = loader(c, "a.plain", {}, async () => ok({ n: 1 }));
    expect(thrown(() => manifest(c, { "a.ticks": { loader: live }, "a.plain": { loader: plain } }))).toBeNull();
  });

  it("an async generator loader declared for an API GET without `events` does not compile and `manifest` throws E1515", () => {
    const generator = Reflect.apply(loader, undefined, [
      c,
      "a.plain",
      {},
      async function* () {
        yield ok({ n: 1 });
      },
    ]);
    const ticks = loader(c, "a.ticks", {}, async function* () {
      yield ok({ n: 1 });
    });
    const e = thrown(() =>
      Reflect.apply(manifest, undefined, [c, { "a.ticks": { loader: ticks }, "a.plain": { loader: generator } }]),
    );
    expect(e?.code).toBe("E1515");
    expect(e?.message).toContain("a.plain");
  });

  it("an async generator loader declared for a page or a layout does not compile and `manifest` throws E1515: no page or layout loader is live", () => {
    const view = () => document.createElement("main");
    const generator = async function* () {
      yield ok({ title: "t" });
    };
    for (const id of ["p.home", "p.shell"]) {
      const handler = Reflect.apply(loader, undefined, [pages, id, { output: Page }, generator]);
      const binding =
        id === "p.home"
          ? { "p.shell": { component: view }, "p.home": { component: view, loader: handler } }
          : { "p.shell": { component: view, loader: handler }, "p.home": { component: view } };
      const e = thrown(() => Reflect.apply(manifest, undefined, [pages, binding]));
      expect(e?.code, id).toBe("E1515");
      expect(e?.message, id).toContain(id);
    }
  });
});
