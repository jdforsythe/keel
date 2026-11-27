// @vitest-environment happy-dom
// Spec: k.shared, clause "On a node server, with `export const last = signal('')` at the top level of `modules/p/last.ts`, a loader running `last.set(params.id)` fails its level with a value `isDefect(v, 'E1256')` accepts whose `data.kind` is `signal`, answers 500 with `keel.unexpected`, and leaves `last.get()` `''`."
// Spec: k.shared, clause "Two requests served at once, `/p/a` and `/p/b`, whose loader runs `last.set(params.id)`, awaits a timer, and returns `last.get()`: neither answer holds the other's id."
// Spec: k.shared, clause "`last.set('boot')` at the module's top level, and inside a `setInterval` callback registered there, changes `last` with no E1256, also while a request is being served."
// Spec: k.shared, clause "A library's maker built on `signal` (`counter(id)` returning `{ get, add }`), declared at a module's top level in an app that lists the library: an action calling its `add` fails with the E1256 defect; the same maker called inside a loader gives each of two concurrent requests its own count."
// Spec: k.shared, clause "A maker that makes its store on first use, declared at a module's top level and first used in a loader, fails that loader with the E1256 defect whose `data.kind` is `root`; first used at the top level, it serves requests that read it."
// Seed 1337 (no random input). The module root of a compiled top-level statement is `moduleRoot` from `@keel/reactive/internal` (test files are not compiled); the "timer" of the second clause is a promise the test settles, since no real timer is allowed; the `setInterval` callback of the third is a callback made at the top level and called while a request is held open.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { isDefect, ok, s } from "@keel/schema";
import { owner, signal } from "@keel/reactive";
import { moduleRoot } from "@keel/reactive/internal";
import { topology } from "@keel/server";
import { describe, expect, it } from "vitest";
import { SEED, createApp, get } from "./fixtures.ts";

const Out = s.object({ seen: s.string() });
const c = contract("p", {
  "p.read": { method: "GET", path: "/api/p/:id", params: s.object({ id: s.string() }), output: Out },
  "p.count": { method: "GET", path: "/api/count/:id", params: s.object({ id: s.string() }), output: Out },
});

const last = moduleRoot(() => signal(""));
const root = moduleRoot(() => owner());
const counter = (id: string) => {
  const n = moduleRoot(() => signal(0));
  return { id, get: () => n.get(), add: () => n.set(n.get() + 1) };
};
const moduleCounter = counter("module");

interface Gate {
  readonly promise: Promise<void>;
  open(): void;
}
const gate = (): Gate => {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    open = r;
  });
  return { promise, open };
};
const json = (path: string) => get(path, { accept: "application/json" });
const boot = async (handlers: Record<string, unknown>) => {
  const lines: string[] = [];
  const ids = ["p.read", "p.count"] as const;
  const bound = Object.fromEntries(
    ids.map((id) => [id, { loader: handlers[id] ?? loader(c, id, {}, async () => ok({ seen: "" })) }]),
  );
  const routes = Reflect.apply(manifest, undefined, [c, bound]);
  const app = await createApp({
    topology: topology({ web: { modules: ["p"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  return { app, lines };
};
const textOf = async (res: Response): Promise<string> => res.text();

describe("k.shared: a request never writes module state", () => {
  it("a loader running `last.set(params.id)` fails with the E1256 defect (data.kind signal), answers 500 keel.unexpected, and leaves last.get() empty", async () => {
    let seen: unknown;
    const read = loader(c, "p.read", {}, async ({ params }) => {
      try {
        last.set(params.id);
      } catch (e) {
        seen = e;
        throw e;
      }
      return ok({ seen: last.get() });
    });
    const { app } = await boot({ "p.read": read });
    const res = await app.fetch(json("/api/p/a"));
    expect(res.status).toBe(500);
    expect(await textOf(res)).toContain("keel.unexpected");
    expect(isDefect(seen, "E1256")).toBe(true);
    expect(seen instanceof Error && Object.getOwnPropertyDescriptor(seen, "data")?.value).toMatchObject({
      kind: "signal",
    });
    expect(last.get()).toBe("");
  });

  it("two requests served at once, /p/a and /p/b, whose loader sets, awaits and returns last.get(): neither answer holds the other's id", async () => {
    const hold = gate();
    const read = loader(c, "p.read", {}, async ({ params }) => {
      try {
        last.set(params.id);
      } catch {
        // refused: the write changes nothing
      }
      await hold.promise;
      return ok({ seen: last.get() });
    });
    const { app } = await boot({ "p.read": read });
    const a = app.fetch(json("/api/p/a"));
    const b = app.fetch(json("/api/p/b"));
    hold.open();
    const [ta, tb] = [await textOf(await a), await textOf(await b)];
    expect(ta).not.toContain('"b"');
    expect(tb).not.toContain('"a"');
    expect(last.get()).toBe("");
  });

  it("`last.set('boot')` at the module's top level and in a callback made there changes last with no E1256, also while a request is being served", async () => {
    const tick = () => last.set("tick");
    moduleRoot(() => last.set("boot"));
    expect(last.get()).toBe("boot");
    const hold = gate();
    const read = loader(c, "p.read", {}, async () => {
      await hold.promise;
      return ok({ seen: last.get() });
    });
    const { app } = await boot({ "p.read": read });
    const pending = app.fetch(json("/api/p/a"));
    tick();
    expect(last.get()).toBe("tick");
    hold.open();
    expect(await textOf(await pending)).toContain("tick");
    moduleRoot(() => last.set(""));
  });

  it("a library maker built on signal, declared at a module's top level: a loader calling its add fails with the E1256 defect", async () => {
    let seen: unknown;
    const read = loader(c, "p.read", {}, async () => {
      try {
        moduleCounter.add();
      } catch (e) {
        seen = e;
        throw e;
      }
      return ok({ seen: "x" });
    });
    const { app } = await boot({ "p.read": read });
    await app.fetch(json("/api/p/a"));
    expect(isDefect(seen, "E1256")).toBe(true);
    expect(moduleCounter.get()).toBe(0);
  });

  it("the same maker called inside a loader gives each of two concurrent requests its own count", async () => {
    const hold = gate();
    const count = loader(c, "p.count", {}, async ({ params }) => {
      const mine = counter(params.id);
      mine.add();
      await hold.promise;
      mine.add();
      return ok({ seen: String(mine.get()) });
    });
    const { app } = await boot({ "p.count": count });
    const a = app.fetch(json("/api/count/a"));
    const b = app.fetch(json("/api/count/b"));
    hold.open();
    expect(await textOf(await a)).toContain('"2"');
    expect(await textOf(await b)).toContain('"2"');
  });

  it("a maker that makes its store on first use, first used in a loader, fails that loader with the E1256 defect whose data.kind is root", async () => {
    let cell: ReturnType<typeof signal<number>> | undefined;
    const lazy = () => {
      cell ??= root.run(() => signal(7));
      return cell;
    };
    let seen: unknown;
    const read = loader(c, "p.read", {}, async () => {
      try {
        lazy();
      } catch (e) {
        seen = e;
        throw e;
      }
      return ok({ seen: "x" });
    });
    const { app } = await boot({ "p.read": read });
    await app.fetch(json("/api/p/a"));
    expect(isDefect(seen, "E1256")).toBe(true);
    expect(seen instanceof Error && Object.getOwnPropertyDescriptor(seen, "data")?.value).toMatchObject({
      kind: "root",
    });
  });

  it("first used at the top level, the lazy store serves requests that read it", async () => {
    let cell: ReturnType<typeof signal<number>> | undefined;
    const lazy = () => {
      cell ??= root.run(() => signal(7));
      return cell;
    };
    lazy();
    const read = loader(c, "p.read", {}, async () => ok({ seen: String(lazy().get()) }));
    const { app } = await boot({ "p.read": read });
    expect(await textOf(await app.fetch(json("/api/p/a")))).toContain('"7"');
  });
});
