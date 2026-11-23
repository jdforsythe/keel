// k.contract Binding: what `manifest` refuses, by code and message. A value stands where a contract, a binding, a
// loader, an action, a guard, a layout or a view member goes, and the error names the id and what is wrong.
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { action } from "../src/action.ts";
import { contract } from "../src/contract/contract.ts";
import { guard } from "../src/guard.ts";
import { compileRoutes } from "../src/internal/compileRoutes.ts";
import { serverOnly } from "../src/internal/serverOnly.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";

const SEED = 1337;
const Out = s.object({});
const In = s.object({});
/** A component for a table that renders no page. */
const view = (): Node => {
  throw new Error("no page renders here");
};
const Denied = s.error("keel.denied", s.object({}));

/** The message `manifest` throws over arguments its types refuse, or `null` when it returns. */
const refusal = (c: unknown, binding: unknown): string | null => {
  try {
    Reflect.apply(manifest, undefined, [c, binding]);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
};
const codeOf = (c: unknown, binding: unknown): unknown => {
  try {
    Reflect.apply(manifest, undefined, [c, binding]);
  } catch (e) {
    return Reflect.get(Object(e), "code");
  }
  return null;
};

const entries = {
  "t.frame": { layout: true },
  "t.page": { path: "/p" },
  "t.read": { method: "GET", path: "/api/t", output: Out },
  "t.write": { method: "POST", path: "/api/t", output: Out },
} as const;
const t = contract("t", entries);
/** A second contract of the same module and ids: its handlers are declared for another contract. */
const twin = contract("t", entries);
const o = contract("o", { "o.page": { path: "/o" }, "o.read": { method: "GET", path: "/api/o", output: Out } });

const pageLoader = loader(t, "t.page", { output: Out }, async () => ok({}));
const read = loader(t, "t.read", {}, async () => ok({}));
const write = action(t, "t.write", {}, async () => ok({}));
const post = action(t, "t.page", { input: In }, async () => ok(null));
const toPage = guard({ redirect: "t.page" }, async () => err(Denied.make({})));
const apiGuard = guard({}, async () => err(Denied.make({})));

const good = {
  "t.frame": { component: view },
  "t.page": { component: view },
  "t.read": { loader: read },
  "t.write": { action: write },
};
/** `good` with the members of `over` laid on entry `id`. */
const withAt = (id: keyof typeof good, over: object): object => ({ ...good, [id]: { ...good[id], ...over } });
/** A function carrying the own properties of `v`: what a handler holds, in a value that is no object. */
const asFunction = (v: object): unknown => Object.assign(() => undefined, v);

describe("manifest arguments", () => {
  it("binds the good table", () => {
    expect(refusal(t, good)).toBeNull();
    expect(
      refusal(t, withAt("t.page", { loader: pageLoader, POST: post, guard: toPage, layout: "t.frame" })),
    ).toBeNull();
    expect(refusal(t, withAt("t.read", { guard: apiGuard }))).toBeNull();
  });

  it("E1515 for a first argument that is no contract", () => {
    for (const c of [undefined, null, 7, "t", view, {}, { kind: "keel.routeTable" }, { ...t, kind: "contract" }]) {
      expect(refusal(c, good)).toBe("E1515 manifest: the first argument is no contract");
      expect(codeOf(c, good)).toBe("E1515");
    }
  });

  it("E1515 for a binding that is no object", () => {
    for (const b of [undefined, null, 7, "t", true, view]) {
      expect(refusal(t, b)).toBe("E1515 t: the binding is an object");
      expect(codeOf(t, b)).toBe("E1515");
    }
  });

  it("E1515 for an entry left unbound or bound to no object", () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(entries)), fc.constantFrom(null, 7, "x", true, view), (id, b) => {
        expect(refusal(t, { ...good, [id]: b })).toBe(`E1515 ${id}: its binding is an object`);
        expect(codeOf(t, { ...good, [id]: b })).toBe("E1515");
        expect(refusal(t, { ...good, [id]: undefined })).toBe(`E1515 ${id}: not bound`);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("E1515 for a view member that is no function, naming the member", () => {
    fc.assert(
      fc.property(fc.constantFrom("component", "errorElement", "title"), fc.constantFrom(null, 7, "x", {}), (k, v) => {
        expect(refusal(t, withAt("t.page", { [k]: v }))).toBe(`E1515 t.page: ${k} is a function`);
        expect(codeOf(t, withAt("t.page", { [k]: v }))).toBe("E1515");
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("E1510 for a member the entry's kind takes none of, naming it", () => {
    expect(refusal(t, withAt("t.frame", { title: view }))).toBe('E1510 t.frame: a layout binding takes no "title"');
    expect(refusal(t, withAt("t.frame", { POST: post }))).toBe('E1510 t.frame: a layout binding takes no "POST"');
    expect(refusal(t, withAt("t.read", { action: write }))).toBe('E1510 t.read: a read binding takes no "action"');
    expect(refusal(t, withAt("t.read", { layout: "t.frame" }))).toBe('E1510 t.read: a read binding takes no "layout"');
    expect(refusal(t, withAt("t.write", { loader: read }))).toBe('E1510 t.write: a write binding takes no "loader"');
    expect(refusal(t, withAt("t.write", { POST: post }))).toBe('E1510 t.write: a write binding takes no "POST"');
    expect(refusal(t, withAt("t.page", { action: write }))).toBe('E1510 t.page: a page binding takes no "action"');
  });

  it("a title bound on a page is the route's title", () => {
    const title = (): string => "T";
    const routes = manifest(t, { ...good, "t.page": { component: view, title } });
    expect(compileRoutes(routes).table.get("t.page")?.def.title).toBe(title);
    expect(compileRoutes(manifest(t, good)).table.get("t.page")?.def.title).toBeUndefined();
  });
});

describe("a loader that is none", () => {
  const no = "E1515 t.page: its loader is declared for no entry";
  it("E1515 for a value loader() did not make", () => {
    const values = [
      null,
      7,
      "x",
      {},
      view,
      { ...pageLoader, kind: "keel.action" },
      { ...pageLoader, kind: undefined },
      { ...pageLoader, run: undefined },
      { ...pageLoader, run: "run" },
      { ...pageLoader, output: undefined },
      { ...pageLoader, output: {} },
      asFunction(pageLoader),
    ];
    for (const v of values) expect(refusal(t, withAt("t.page", { loader: v }))).toBe(no);
    expect(codeOf(t, withAt("t.page", { loader: {} }))).toBe("E1515");
  });

  it("E1515 for a loader declared for another id or contract, naming whose it is", () => {
    expect(refusal(t, withAt("t.page", { loader: read }))).toBe("E1515 t.page: its loader is declared for t's t.read");
    expect(refusal(t, withAt("t.read", { loader: pageLoader }))).toBe(
      "E1515 t.read: its loader is declared for t's t.page",
    );
    const foreign = loader(o, "o.read", {}, async () => ok({}));
    expect(refusal(t, withAt("t.read", { loader: foreign }))).toBe(
      "E1515 t.read: its loader is declared for o's o.read",
    );
    const twinRead = loader(twin, "t.read", {}, async () => ok({}));
    expect(refusal(t, withAt("t.read", { loader: twinRead }))).toBe(
      "E1515 t.read: its loader is declared for t's t.read",
    );
  });

  it("E1515 for an async generator loader on an entry without events, and a plain one on an events entry", () => {
    const live = contract("l", {
      "l.events": { method: "GET", path: "/api/l", output: Out, events: true },
      "l.read": { method: "GET", path: "/api/r", output: Out },
      "l.page": { path: "/l" },
    });
    const gen = async function* () {
      yield ok({});
    };
    const plain = async () => ok({});
    const bound = (over: object): object => ({
      "l.events": { loader: loader(live, "l.events", {}, gen) },
      "l.read": { loader: loader(live, "l.read", {}, plain) },
      "l.page": { component: view },
      ...over,
    });
    expect(refusal(live, bound({}))).toBeNull();
    expect(
      refusal(live, bound({ "l.events": { loader: Reflect.apply(loader, undefined, [live, "l.events", {}, plain]) } })),
    ).toBe("E1515 l.events: an events entry's loader is an async generator");
    expect(
      refusal(live, bound({ "l.read": { loader: Reflect.apply(loader, undefined, [live, "l.read", {}, gen]) } })),
    ).toBe("E1515 l.read: only an events: true entry's loader is an async generator");
    expect(
      refusal(
        live,
        bound({
          "l.page": {
            component: view,
            loader: Reflect.apply(loader, undefined, [live, "l.page", { output: Out }, gen]),
          },
        }),
      ),
    ).toBe("E1515 l.page: only an events: true entry's loader is an async generator");
  });
});

describe("an action that is none", () => {
  it("E1515 for a value action() did not make, under the member it stands in", () => {
    const pageValues = [
      null,
      7,
      "x",
      {},
      view,
      { ...post, kind: "keel.loader" },
      { ...post, run: undefined },
      { ...post, input: undefined },
      { ...post, input: s.string() },
      asFunction(post),
    ];
    for (const v of pageValues)
      for (const verb of ["POST", "PUT", "PATCH", "DELETE"])
        expect(refusal(t, withAt("t.page", { [verb]: v }))).toBe(
          `E1515 t.page: ${verb} is not an action declared for t.page`,
        );
    for (const v of [null, 7, {}, view, { ...write, kind: "keel.loader" }, { ...write, run: 1 }, asFunction(write)])
      expect(refusal(t, withAt("t.write", { action: v }))).toBe(
        "E1515 t.write: action is not an action declared for t.write",
      );
    expect(codeOf(t, withAt("t.write", { action: {} }))).toBe("E1515");
  });

  it("E1515 for an action declared for another id, contract or kind of entry", () => {
    const twinWrite = action(twin, "t.write", {}, async () => ok({}));
    const twinPost = action(twin, "t.page", { input: In }, async () => ok(null));
    const refused = "E1515 t.write: action is not an action declared for t.write";
    expect(refusal(t, withAt("t.write", { action: twinWrite }))).toBe(refused);
    expect(refusal(t, withAt("t.write", { action: post }))).toBe(refused);
    expect(refusal(t, withAt("t.write", { action: { ...write, output: undefined } }))).toBe(refused);
    expect(refusal(t, withAt("t.page", { POST: twinPost }))).toBe(
      "E1515 t.page: POST is not an action declared for t.page",
    );
    expect(refusal(t, withAt("t.page", { PUT: write }))).toBe("E1515 t.page: PUT is not an action declared for t.page");
    expect(refusal(t, withAt("t.page", { POST: { ...post, id: "t.write", output: Out } }))).toBe(
      "E1515 t.page: POST is not an action declared for t.page",
    );
    expect(refusal(t, withAt("t.page", { POST: { ...post, output: Out } }))).toBe(
      "E1515 t.page: POST is not an action declared for t.page",
    );
  });
});

describe("a guard that is none", () => {
  it("E1515 for a value guard() did not make", () => {
    const values = [
      null,
      7,
      "x",
      {},
      view,
      { ...toPage, kind: "keel.loader" },
      { ...toPage, kind: undefined },
      { ...toPage, run: undefined },
      { ...toPage, run: {} },
      asFunction(toPage),
    ];
    for (const v of values) {
      expect(refusal(t, withAt("t.page", { guard: v }))).toBe("E1515 t.page: guard is no guard");
      expect(refusal(t, withAt("t.read", { guard: v }))).toBe("E1515 t.read: guard is no guard");
    }
    expect(codeOf(t, withAt("t.page", { guard: {} }))).toBe("E1515");
  });

  it("E1508 for a guard without redirect on a page or layout, none on an API entry", () => {
    expect(refusal(t, withAt("t.page", { guard: apiGuard }))).toBe("E1508 t.page: guard without redirect");
    expect(refusal(t, withAt("t.frame", { guard: apiGuard }))).toBe("E1508 t.frame: guard without redirect");
    expect(refusal(t, withAt("t.write", { guard: apiGuard }))).toBeNull();
    const toApi = guard({ redirect: "t.read" }, async () => err(Denied.make({})));
    expect(refusal(t, withAt("t.page", { guard: toApi }))).toBe("E1508 t.page: guard redirect to an API entry");
  });
});

describe("a layout that is none", () => {
  it("E1506 for a layout that is no string or not of the form module.name", () => {
    for (const v of [null, 7, {}, view, true, "", "frame", ".frame", "t.", "."])
      expect(refusal(t, withAt("t.page", { layout: v }))).toBe(
        `E1506 t.page: layout ${JSON.stringify(v)} is no layout of contract t`,
      );
    expect(codeOf(t, withAt("t.page", { layout: 7 }))).toBe("E1506");
  });

  it("E1506 for an id of the contract's own module that is no layout of it", () => {
    for (const v of ["t.page", "t.read", "t.nope"])
      expect(refusal(t, withAt("t.page", { layout: v }))).toBe(
        `E1506 t.page: layout "${v}" is no layout of contract t`,
      );
  });

  it("takes an id of another module, which the route table resolves", () => {
    expect(refusal(t, withAt("t.page", { layout: "tt.frame" }))).toBeNull();
    expect(refusal(t, withAt("t.page", { layout: "o.page" }))).toBeNull();
  });
});

describe("a stub in a handler's place", () => {
  const stub = (name: string): (() => never) => serverOnly("t.server.ts", name);
  const rejection = async (run: () => unknown): Promise<string> => {
    try {
      await run();
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    return "";
  };

  it("binds a loader, a guard and an action of that kind whose run is the stub's E1008", async () => {
    const routes = Reflect.apply(manifest, undefined, [
      t,
      {
        "t.frame": { component: view },
        "t.page": { component: view, loader: stub("load"), guard: stub("auth"), POST: stub("save") },
        "t.read": { loader: stub("read"), guard: stub("apiAuth") },
        "t.write": { action: stub("write") },
      },
    ]);
    const table = compileRoutes(routes).table;
    const page = table.get("t.page")?.def;
    const readDef = table.get("t.read")?.def;
    const writeDef = table.get("t.write")?.def;
    expect(page?.loader?.kind).toBe("keel.loader");
    expect(page?.loader?.id).toBe("t.page");
    expect(page?.loader?.contract).toBe(t);
    expect(page?.guard?.kind).toBe("keel.guard");
    expect(page?.actions.POST?.kind).toBe("keel.action");
    expect(page?.actions.POST?.id).toBe("t.page");
    expect(page?.actions.POST?.contract).toBe(t);
    expect(Object.isFrozen(page?.loader) && Object.isFrozen(page?.guard) && Object.isFrozen(page?.actions.POST)).toBe(
      true,
    );
    expect(readDef?.loader?.id).toBe("t.read");
    expect(writeDef?.actions.POST?.id).toBe("t.write");
    expect(await rejection(() => Reflect.apply(Object(page?.loader).run, undefined, []))).toBe(
      "E1008 load of t.server.ts runs only on the server",
    );
    expect(await rejection(() => Reflect.apply(Object(page?.guard).run, undefined, []))).toBe(
      "E1008 auth of t.server.ts runs only on the server",
    );
    expect(await rejection(() => Reflect.apply(Object(page?.actions.POST).run, undefined, []))).toBe(
      "E1008 save of t.server.ts runs only on the server",
    );
    expect(await rejection(() => Reflect.apply(Object(readDef?.guard).run, undefined, []))).toBe(
      "E1008 apiAuth of t.server.ts runs only on the server",
    );
    expect(await rejection(() => Reflect.apply(Object(writeDef?.actions.POST).run, undefined, []))).toBe(
      "E1008 write of t.server.ts runs only on the server",
    );
  });

  it("a function that is no stub is no handler", () => {
    expect(refusal(t, withAt("t.read", { loader: () => ok({}) }))).toBe(
      "E1515 t.read: its loader is declared for no entry",
    );
    expect(refusal(t, withAt("t.read", { guard: () => ok(null) }))).toBe("E1515 t.read: guard is no guard");
  });
});
