import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import type { RouteProps } from "@keel/router";
// @vitest-environment happy-dom
// Spec: k.resume, Conformance "A loader, guard or component writing a module store fails its level with a throw starting `E1256`, the store unchanged; such an action answers 500. Two requests in turn never see each other's request stores."
// Spec: k.resume, Rules "E1256 a write to a module store during a request (k.leave)."
// Spec: k.resume, Stores "During a request `createApp` serves (guards, loaders, action, renders, across `await`s), `tx` on a module store (k.store Registries) throws E1256, changing nothing: a level fails as a throw does; an action answers 500."
// Property seed: 1337 (fc.assert seed below). Real createApp over a module store defined in this test graph; the store sits in the module registry.
import type { KeelError } from "@keel/schema";
import { ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { type Lines, appOf, serveRoutes } from "./resume-graph-app.ts";
import { PRISTINE, Rows, board, setRows } from "./resume-modstore.ts";

afterEach(() => {
  board.restore(PRISTINE);
});

const Data = s.object({ title: s.string() });
const Name = s.object({ name: s.string() });
const Note = s.object({ note: s.string() });

const el = (tag: string, attrs: Readonly<Record<string, string>>, text: string): Node => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.textContent = text;
  return e;
};
const titleOf = (p: RouteProps): string => String(Reflect.get(Object(p.data), "title"));
const shown = (p: RouteProps): Node => el("main", { "data-page": "1" }, titleOf(p));
const errorElement = (p: { readonly error: KeelError<string, unknown> }): Node =>
  el("section", { "data-error-element": "1" }, p.error.code);
const write = (rows: string): void => void tx(setRows, { rows });

const rmContract = contract("rm", {
  "rm.login": { path: "/login" },
  "rm.after": { path: "/after" },
  "rm.before": { path: "/before" },
  "rm.afterEl": { path: "/after-el" },
  "rm.guarded": { path: "/guarded" },
  "rm.restore": { path: "/op-restore" },
  "rm.undo": { path: "/op-undo" },
  "rm.undoWhere": { path: "/op-undo-where" },
  "rm.render": { path: "/render" },
  "rm.act": { path: "/act" },
  "rm.made": { path: "/made" },
  "rm.factory": { path: "/factory" },
  "rm.reads": { path: "/reads" },
  "rm.data": { path: "/data/:name", params: Name },
  "rm.store": { path: "/store/:name", params: Name },
  "rm.requestStore": { path: "/request-store/:name", params: Name },
});
const rrContract = contract("rr", { "rr.page": { path: "/rr" } });

/** A loader that writes `board` before any await, or after one. */
const writing = (late: boolean, c: typeof rmContract | typeof rrContract, id: string) =>
  Reflect.apply(loader, undefined, [
    c,
    id,
    { output: Data },
    async () => {
      if (late) await Promise.resolve();
      write("leak");
      return ok({ title: "t" });
    },
  ]);

const afterAwait = writing(true, rmContract, "rm.after");
const afterAwaitEl = writing(true, rmContract, "rm.afterEl");
const afterAwaitRr = writing(true, rrContract, "rr.page");
const beforeAwait = writing(false, rmContract, "rm.before");

/** A loader that creates a store in the request and writes it: allowed. */
const madeHere = loader(rmContract, "rm.made", { output: Data }, () => {
  const made = store(Rows, { rows: "" }, { id: "rm.made" });
  const set = transaction(made, "rm.made.set", Rows, (_state, payload) => payload);
  void tx(set, { rows: "made" });
  return Promise.resolve(ok({ title: made.get("rows") }));
});

/** A loader writing a store its `stores` factory made: allowed. */
const factory = () => {
  const local = store(Rows, { rows: "" }, { id: "rm.factory" });
  return { local, setLocal: transaction(local, "rm.factory.set", Rows, (_state, payload) => payload) };
};
const viaFactory = loader(rmContract, "rm.factory", { output: Data, stores: factory }, ({ stores }) => {
  void tx(stores.setLocal, { rows: "factory" });
  return Promise.resolve(ok({ title: stores.local.get("rows") }));
});

/** A loader that only reads `board`. */
const reading = loader(rmContract, "rm.reads", { output: Data }, () =>
  Promise.resolve(ok({ title: board.get("rows") })),
);

/** A loader that awaits, then calls one guarded operation other than `tx` on `board`. */
const operations = {
  restore: () => board.restore(PRISTINE),
  undo: () => board.undo(),
  undoWhere: () => board.undoWhere(() => true),
} as const;
const operating = (name: keyof typeof operations, id: string) =>
  Reflect.apply(loader, undefined, [
    rmContract,
    id,
    { output: Data },
    async () => {
      await Promise.resolve();
      operations[name]();
      return ok({ title: "t" });
    },
  ]);

const guarded = guard({ redirect: "rm.login" }, async () => {
  await Promise.resolve();
  write("leak");
  return ok(null);
});

const act = action(rmContract, "rm.act", { input: Note }, async () => {
  await Promise.resolve();
  write("leak");
  return ok(null);
});

/** Rows as loader data, the form the spec asks apps for. */
const asData = loader(rmContract, "rm.data", { output: Data }, ({ params }) =>
  Promise.resolve(ok({ title: params.name })),
);

/** The same page with the loader written as an app writing a module store: it writes, then returns the rows it wrote. */
const asStore = loader(rmContract, "rm.store", { output: Data }, async ({ params }) => {
  await Promise.resolve();
  write(params.name);
  return ok({ title: board.get("rows") });
});

/** A page whose render creates its own request store, holding the name it was asked for. */
function RequestStorePage(p: RouteProps): Node {
  const name = String(Reflect.get(Object(p.params), "name"));
  const mine = store(Rows, { rows: name }, { id: "rq.rows" });
  return el("main", { "data-page": "1" }, mine.get("rows"));
}

/** A page whose render writes `board`. */
function WritingPage(): Node {
  write("leak");
  return el("main", { "data-page": "1" }, "rendered");
}

const routes = manifest(rmContract, {
  "rm.login": { component: () => el("main", {}, "login") },
  "rm.after": { component: shown, loader: afterAwait },
  "rm.before": { component: shown, loader: beforeAwait },
  "rm.afterEl": { component: shown, loader: afterAwaitEl, errorElement: errorElement },
  "rm.guarded": { component: () => el("main", { "data-page": "1" }, "guarded"), guard: guarded },
  "rm.restore": { component: shown, loader: operating("restore", "rm.restore") },
  "rm.undo": { component: shown, loader: operating("undo", "rm.undo") },
  "rm.undoWhere": { component: shown, loader: operating("undoWhere", "rm.undoWhere") },
  "rm.render": { component: WritingPage },
  "rm.act": { component: () => el("main", { "data-page": "1" }, "act"), POST: act },
  "rm.made": { component: shown, loader: madeHere },
  "rm.factory": { component: shown, loader: viaFactory },
  "rm.reads": { component: shown, loader: reading },
  "rm.data": { component: shown, loader: asData },
  "rm.store": { component: shown, loader: asStore },
  "rm.requestStore": { component: RequestStorePage },
});

const MODULES = ["rm"];
const MODES = ["dev", "production"] as const;

function post(path: string): Request {
  const fd = new FormData();
  fd.set("note", "n");
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: fd,
    headers: { accept: "application/json", "x-keel": "1" },
  });
}

const unchanged = (): void => {
  expect(board.get("rows")).toBe("");
  expect(board.log()).toHaveLength(0);
};

const e1256 = (log: Lines): string[] => log.lines.filter((l) => l.includes("E1256"));

describe("k.resume: E1256 a write to a module store during a request", () => {
  it.each(MODES)(
    "a loader that awaits then writes a module store fails its level as a throw does (%s): 500, the store unchanged, an E1256 diag",
    async (mode) => {
      const log: Lines = { lines: [] };
      const doc = await serveRoutes(routes, MODULES, "/after", { mode, log });
      expect(doc.status).toBe(500);
      expect(doc.text).not.toContain('data-page="1"');
      expect(e1256(log)).not.toHaveLength(0);
      unchanged();
    },
  );

  it.each([
    ["restore", "/op-restore"],
    ["undo", "/op-undo"],
    ["undoWhere", "/op-undo-where"],
  ])(
    "a loader calling `%s` on a module store fails its level with E1256, state and head as they were",
    async (_name, path) => {
      write("seed");
      const head = board.head();
      const log: Lines = { lines: [] };
      const doc = await serveRoutes(routes, MODULES, path, { mode: "production", log });
      expect(doc.status).toBe(500);
      expect(doc.text).not.toContain('data-page="1"');
      expect(e1256(log)).not.toHaveLength(0);
      expect(board.get("rows")).toBe("seed");
      expect(board.head()).toBe(head);
    },
  );

  it("a loader that writes before any await fails the same way", async () => {
    const log: Lines = { lines: [] };
    const doc = await serveRoutes(routes, MODULES, "/before", { mode: "production", log });
    expect(doc.status).toBe(500);
    expect(e1256(log)).not.toHaveLength(0);
    unchanged();
  });

  it("the error is an Error whose message starts with E1256 and names the store", async () => {
    const doc = await serveRoutes(routes, MODULES, "/after", { mode: "dev" });
    expect(doc.text).toMatch(/E1256/);
    expect(doc.text).toContain("rm.board");
  });

  it("a route with an errorElement shows it when its loader writes a module store", async () => {
    const log: Lines = { lines: [] };
    const doc = await serveRoutes(routes, MODULES, "/after-el", { mode: "production", log });
    expect(doc.text).toContain('data-error-element="1"');
    expect(doc.text).not.toContain('data-page="1"');
    expect(e1256(log)).not.toHaveLength(0);
    unchanged();
  });

  it.each(MODES)(
    "a guard that awaits then writes a module store fails its level (%s), the store unchanged",
    async (mode) => {
      const log: Lines = { lines: [] };
      const doc = await serveRoutes(routes, MODULES, "/guarded", { mode, log });
      expect(doc.status).toBe(500);
      expect(doc.text).not.toContain('data-page="1"');
      expect(e1256(log)).not.toHaveLength(0);
      unchanged();
    },
  );

  it.each(MODES)("a render that writes a module store fails its level (%s), the store unchanged", async (mode) => {
    const log: Lines = { lines: [] };
    const doc = await serveRoutes(routes, MODULES, "/render", { mode, log });
    expect(doc.status).toBe(500);
    expect(doc.text).not.toContain('data-page="1"');
    expect(e1256(log)).not.toHaveLength(0);
    unchanged();
  });

  it.each(MODES)(
    "an action that awaits then writes a module store answers 500 keel.unexpected (%s), the store unchanged",
    async (mode) => {
      const log: Lines = { lines: [] };
      const app = await appOf(routes, MODULES, { mode, log });
      const res = await app.fetch(post("/act"));
      expect(res.status).toBe(500);
      expect(await res.text()).toContain("keel.unexpected");
      expect(e1256(log)).not.toHaveLength(0);
      unchanged();
    },
  );

  it("a loader writing a store it created in the request succeeds", async () => {
    const log: Lines = { lines: [] };
    const doc = await serveRoutes(routes, MODULES, "/made", { mode: "dev", log });
    expect(doc.status).toBe(200);
    expect(doc.text).toContain("made");
    expect(e1256(log)).toEqual([]);
    unchanged();
  });

  it("a loader writing a store of its `stores` factory succeeds", async () => {
    const log: Lines = { lines: [] };
    const doc = await serveRoutes(routes, MODULES, "/factory", { mode: "dev", log });
    expect(doc.status).toBe(200);
    expect(doc.text).toContain("factory");
    expect(e1256(log)).toEqual([]);
    unchanged();
  });

  it("reads of a module store are allowed during a request", async () => {
    write("seed");
    const doc = await serveRoutes(routes, MODULES, "/reads", { mode: "dev" });
    expect(doc.status).toBe(200);
    expect(doc.text).toContain("seed");
    expect(board.get("rows")).toBe("seed");
  });
});

describe("k.resume: a module store written outside a request is not refused", () => {
  it("a module store `tx`ed in the test before fetch is not refused, and after a request still is not", async () => {
    write("before");
    expect(board.get("rows")).toBe("before");
    const doc = await serveRoutes(routes, MODULES, "/reads", { mode: "dev" });
    expect(doc.status).toBe(200);
    write("after");
    expect(board.get("rows")).toBe("after");
  });

  it("a runner that writes a module store is not refused", async () => {
    const log: Lines = { lines: [] };
    const run = async (): Promise<void> => {
      await Promise.resolve();
      write("runner");
    };
    const app = await appOf(routes, MODULES, { mode: "dev", log, runners: { rm: [{ run }] } });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(board.get("rows")).toBe("runner");
    expect(e1256(log)).toEqual([]);
    await app.close();
  });

  it("a page loader writing a module store through renderRoute is not refused", async () => {
    const rr = manifest(rrContract, {
      "rr.page": { component: (p: RouteProps) => el("main", { id: "rr.out" }, titleOf(p)), loader: afterAwaitRr },
    });
    const t = await renderRoute("rr.page", { routes: rr, ctx: createCtx({ mode: "sim", seed: 1337 }) });
    expect(board.get("rows")).toBe("leak");
    t.dispose();
  });
});

describe("k.resume: two requests in turn never see each other's request stores", () => {
  const names = fc.uniqueArray(fc.constantFrom("alpha", "bravo", "charlie", "delta", "echo"), {
    minLength: 2,
    maxLength: 2,
  });

  it("property: rows returned as loader data, and a store a render creates, belong to their own request", async () => {
    await fc.assert(
      fc.asyncProperty(names, async ([a, b]) => {
        if (a === undefined || b === undefined) throw new Error("fixture: two names");
        const app = await appOf(routes, MODULES, { mode: "production" });
        const get = async (path: string): Promise<{ status: number; text: string }> => {
          const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
          return { status: res.status, text: await res.text() };
        };
        for (const prefix of ["/data/", "/request-store/"]) {
          const first = await get(`${prefix}${a}`);
          const second = await get(`${prefix}${b}`);
          const again = await get(`${prefix}${a}`);
          expect(first.status).toBe(200);
          expect(second.status).toBe(200);
          expect(again.status).toBe(200);
          expect(first.text).toContain(a);
          expect(first.text).not.toContain(b);
          expect(second.text).toContain(b);
          expect(second.text).not.toContain(a);
          expect(again.text).toContain(a);
          expect(again.text).not.toContain(b);
        }
      }),
      { seed: 1337, numRuns: 10 },
    );
  }, 120_000);

  it("with the loader written as a module store write, both requests fail with E1256 and neither shows the other's rows", async () => {
    const log: Lines = { lines: [] };
    const app = await appOf(routes, MODULES, { mode: "production", log });
    const get = async (path: string): Promise<{ status: number; text: string }> => {
      const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
      return { status: res.status, text: await res.text() };
    };
    const first = await get("/store/alpha");
    const second = await get("/store/bravo");
    expect(first.status).toBe(500);
    expect(second.status).toBe(500);
    expect(e1256(log)).toHaveLength(2);
    expect(first.text).not.toContain("bravo");
    expect(second.text).not.toContain("alpha");
    unchanged();
  });
});
