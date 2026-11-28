// @vitest-environment happy-dom
// k.leave, Module stores "During a request every state-changing operation on a module store throws E1256 and changes nothing: `tx`, `restore` (but the one a store makes from a waiting `#k-state` snapshot while it is created), `undo` and `undoWhere`. The request's mark follows async context, not data, through every `await`, timer and promise the request schedules, for their whole life: work a request starts and that runs after its response has gone out is still checked, and a guarded operation there throws E1256. A callback registered outside a request (at module load, in a runner, at startup) is not checked, even when a request resolves its promise or fills the queue it drains."
// Spec: k.leave, clause "In a loader, `restore`, `undo` and `undoWhere` on a module store each throw E1256 and leave its state and head as they were; a store an island creates from a waiting snapshot while resuming restores with no E1256."
// Spec: k.leave, clause "An action that schedules `setTimeout(() => tx(t, p), 30)` and returns `ok(null)` answers before the write; the write throws E1256 and the module store is unchanged."
// Spec: k.leave, clause "A promise made at module load whose `.then` writes a module store, resolved by a loader, commits the write with no E1256."
// Spec: k.shared, clause "With `mode: 'dev'`, a GET of a page whose loader runs `tx` on a module store with id `shop.cart` answers 500 with a page that holds `E1256 write to module state during a request` and `shop.cart`; the thrown value is `isDefect(v, 'E1256')` with `data` deep-equal to `{ node: 'shop.cart', kind: 'store' }`; in production mode the body holds neither `E1256` nor `shop.cart`."
// Seed: 1337 (the property below). Real createApp over the module store `rm.board` of resume-modstore.ts.
// The timer in the action and the promise registered at module load are the fixtures the clauses name.
import { fixedTime } from "@keel/tooling/test-time";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { isDefect, ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { resumeDocument } from "@keel/testing";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SEED } from "./leave-support.ts";
import { type Lines, appOf, serveRoutes } from "./resume-graph-app.ts";
import { PRISTINE, Rows, board, setRows } from "./resume-modstore.ts";

afterEach(() => {
  board.restore(PRISTINE);
});

const Data = s.object({ title: s.string() });
const Note = s.object({ note: s.string() });
const MODULES = ["lm"];
const e1256 = (log: Lines): string[] => log.lines.filter((l) => l.includes("E1256"));
const page = () => document.createElement("main");

type Op = "restore" | "undo" | "undoWhere";
let op: Op = "restore";

/** A loader that runs the guarded operation `op` on the module store. */
const lm = contract("lm", {
  "lm.op": { path: "/op" },
  "lm.own": { path: "/own" },
  "lm.release": { path: "/release" },
  "lm.timer": { path: "/timer" },
});

const operating = loader(lm, "lm.op", { output: Data }, () => {
  if (op === "restore") board.restore(PRISTINE);
  else if (op === "undo") board.undo();
  else board.undoWhere(() => true);
  return Promise.resolve(ok({ title: "t" }));
});

/** A loader that undoes and restores a store it created itself: allowed. */
const ownStore = loader(lm, "lm.own", { output: Data }, () => {
  const mine = store(Rows, { rows: "" }, { id: "lm.mine" });
  const set = transaction(mine, "lm.mine.set", Rows, (_state, payload) => payload);
  void tx(set, { rows: "a" });
  void tx(set, { rows: "b" });
  const undone = mine.undo();
  const restored = mine.restore(mine.snapshot());
  return Promise.resolve(ok({ title: `${String(undone)}:${String(restored.ok)}:${mine.get("rows")}` }));
});

// The promise of the module-load clause: a callback registered here is outside every request.
let release: (value: string) => void = () => undefined;
const gate = new Promise<string>((resolve) => {
  release = resolve;
});
let gateError: unknown;
const gated = gate.then((value) => {
  try {
    void tx(setRows, { rows: value });
  } catch (e) {
    gateError = e;
  }
});

const releasing = loader(lm, "lm.release", { output: Data }, () => {
  release("via-gate");
  return Promise.resolve(ok({ title: "released" }));
});

// The timer of the late-write clause: it is started by a request and fires after the response.
let seen: unknown;
let fired: () => void = () => undefined;
const timerFired = new Promise<void>((resolve) => {
  fired = resolve;
});
const scheduling = action(lm, "lm.timer", { input: Note }, () => {
  setTimeout(() => {
    try {
      void tx(setRows, { rows: "late" });
    } catch (e) {
      seen = e;
    }
    fired();
  }, 30);
  return Promise.resolve(ok(null));
});

const routes = manifest(lm, {
  "lm.op": { loader: operating, component: page },
  "lm.own": { loader: ownStore, component: page },
  "lm.release": { loader: releasing, component: page },
  "lm.timer": { component: page, POST: scheduling },
});

describe("k.leave Module stores: restore, undo and undoWhere on a module store throw E1256 in a request", () => {
  it.each(["restore", "undo", "undoWhere"] as const)(
    "a loader calling `%s` on a module store fails its level with a throw starting E1256, and the state and head are as they were",
    async (which) => {
      void tx(setRows, { rows: "one" });
      void tx(setRows, { rows: "two" });
      const head = board.head();
      op = which;
      const log: Lines = { lines: [] };
      const doc = await serveRoutes(routes, MODULES, "/op", { mode: "dev", log });
      expect(doc.status).toBe(500);
      expect(log.lines.some((l) => /threw: Defect: E1256/.test(l))).toBe(true);
      expect(e1256(log)).not.toHaveLength(0);
      expect(board.get("rows")).toBe("two");
      expect(board.head()).toBe(head);
      expect(board.log()).toHaveLength(2);
    },
  );

  it(
    "property: for any pre-request writes and any guarded operation, the module store's state, head and log are unchanged and the level fails",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 4 }),
          fc.constantFrom<Op>("restore", "undo", "undoWhere"),
          async (writes, which) => {
            board.restore(PRISTINE);
            for (const rows of writes) void tx(setRows, { rows });
            const before = board.snapshot();
            op = which;
            const doc = await serveRoutes(routes, MODULES, "/op", { mode: "production" });
            expect(doc.status).toBe(500);
            expect(board.snapshot()).toEqual(before);
          },
        ),
        { seed: SEED, numRuns: 12 },
      );
    },
    fixedTime(120_000),
  );

  it("negative: a loader undoing and restoring a store it created in the request is not refused", async () => {
    const log: Lines = { lines: [] };
    const doc = await serveRoutes(routes, MODULES, "/own", { mode: "dev", log });
    expect(doc.status).toBe(200);
    expect(e1256(log)).toEqual([]);
  });

  it("negative: a store an island creates from a waiting #k-state snapshot while resuming restores with no E1256", async () => {
    const mod = await import("./resume-graph-routes.ts");
    const doc = await serveRoutes(mod.routes, ["gl", "gc", "gr"], "/local");
    expect(doc.status).toBe(200);
    const t = await resumeDocument(doc.text, { routes: () => import("./resume-graph-routes.ts") });
    expect(t.state()["p.local"]).toEqual({ n: 3 });
    t.dispose();
  });
});

describe("k.leave Module stores: late work stays checked", () => {
  it("an action that schedules `setTimeout(() => tx(t, p), 30)` and returns ok(null) answers before the write; the write throws E1256 and the module store is unchanged", async () => {
    const app = await appOf(routes, MODULES, { mode: "production" });
    const fd = new FormData();
    fd.set("note", "n");
    const res = await app.fetch(
      new Request("http://localhost/timer", {
        method: "POST",
        body: fd,
        headers: { accept: "application/json", "x-keel": "1" },
      }),
    );
    expect(res.status).toBe(200);
    expect(seen).toBeUndefined();
    await timerFired;
    expect(isDefect(seen, "E1256")).toBe(true);
    expect(board.get("rows")).toBe("");
    expect(board.log()).toHaveLength(0);
  });
});

describe("k.leave Module stores: the mark follows async context, not data", () => {
  it("a promise made at module load whose `.then` writes a module store, resolved by a loader, commits the write with no E1256", async () => {
    const log: Lines = { lines: [] };
    const doc = await serveRoutes(routes, MODULES, "/release", { mode: "production", log });
    await gated;
    expect(doc.status).toBe(200);
    expect(gateError).toBeUndefined();
    expect(board.get("rows")).toBe("via-gate");
    expect(e1256(log)).toEqual([]);
  });
});

describe("k.shared: the dev page names the module store a guarded operation touched", () => {
  it.each(["restore", "undo", "undoWhere"] as const)(
    "with `mode: 'dev'`, a loader calling `%s` on the module store `rm.board` answers 500 with a page that holds `E1256 write to module state during a request` and `rm.board`",
    async (which) => {
      void tx(setRows, { rows: "one" });
      op = which;
      const doc = await serveRoutes(routes, MODULES, "/op", { mode: "dev", log: { lines: [] } });
      expect(doc.status).toBe(500);
      expect(doc.text).toContain("E1256 write to module state during a request");
      expect(doc.text).toContain("rm.board");
    },
  );

  it("in production mode the body holds neither `E1256` nor `rm.board`", async () => {
    op = "restore";
    const doc = await serveRoutes(routes, MODULES, "/op", { mode: "production", log: { lines: [] } });
    expect(doc.status).toBe(500);
    expect(doc.text).not.toContain("E1256");
    expect(doc.text).not.toContain("rm.board");
  });
});
