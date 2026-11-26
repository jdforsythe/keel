// `keel session replay|minimize|to-test <f>` up to the point a job would start: reading the file (from the files
// given, else from disk), E2002 for a file that is no session, the group-file path of `replay`, and E2003 when no
// deployable serves the session's route. With `projectOf` and `servingModules`, which decide those.
// Seed 1337 (no random inputs)
import fs from "node:fs";
import path from "node:path";
import type { Io } from "@keel/cli";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, test } from "vitest";
import { commandRun } from "../../src/internal/commandRun.ts";
import { projectOf } from "../../src/internal/projectOf.ts";
import { servingModules } from "../../src/internal/servingModules.ts";

const session = (over: Record<string, unknown> = {}) => ({
  v: 1,
  id: "s1",
  seed: 7,
  deterministic: true,
  at: 0,
  route: { id: "cart.show", params: {}, search: {} },
  state: {},
  events: [],
  error: null,
  fingerprint: "7f3a9c01d2e4",
  ...over,
});
const group = (users: unknown[]) => ({ v: 1, seed: 1, at: 0, origin: "http://group.test", server: {}, users });
const topology = (body: string) => ({
  path: "topology.ts",
  source: `import { topology } from "@keel/compiler";\nexport default topology(${body});\n`,
});
const io = (files: { path: string; source: string }[], cwd = "/project"): Io => ({ cwd, files });
const at = (path: string, text: string) => ({ path, source: text });
const diag = (code: string, message: string, file: string, see = "std.sessions") => ({
  kind: "diag",
  code,
  path: file,
  line: 1,
  col: 1,
  message,
  see,
});
const summary = (name: string, ok: boolean) => ({ kind: "summary", ok, name, counts: { sessions: 1 } });
const failed = (op: string, ...records: unknown[]) => ({
  records: [...records, summary(`session ${op}`, false)],
  writes: [],
});
const F = "sessions/a.json";

const dir = tempDir("keel-command-run-");
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("commandRun: reading the session file", () => {
  test("a file that is missing, empty or not JSON is E2002 at (root): not JSON, for each op", async () => {
    for (const op of ["replay", "minimize", "to-test"] as const) {
      for (const files of [[], [at(F, "")], [at(F, "{")], [at("sessions/other.json", JSON.stringify(session()))]])
        expect(await commandRun(op, F, io(files), undefined), op).toEqual(
          failed(op, diag("E2002", "session file fails sessions.Session at (root): not JSON", F)),
        );
    }
  });

  test("the target is matched to the given files by its normalized path", async () => {
    const files = [at(F, JSON.stringify(session({ v: 2 })))];
    for (const target of [F, "./sessions/a.json", "sessions//a.json", "sessions/x/../a.json"])
      expect((await commandRun("replay", target, io(files), undefined)).records[0], target).toMatchObject({
        code: "E2002",
        path: target,
        message: "session file fails sessions.Session at v: literal",
      });
  });

  test("a file not among those given is read from disk under the cwd", async () => {
    fs.mkdirSync(path.join(dir, "sessions"));
    fs.writeFileSync(path.join(dir, "sessions", "disk.json"), JSON.stringify(session({ v: 2 })));
    const out = await commandRun("replay", "sessions/disk.json", io([], dir), undefined);
    expect(out.records[0]).toMatchObject({
      code: "E2002",
      message: "session file fails sessions.Session at v: literal",
    });
    expect((await commandRun("replay", "sessions/none.json", io([], dir), undefined)).records[0]).toMatchObject({
      message: "session file fails sessions.Session at (root): not JSON",
    });
  });

  test("a file that is JSON but no session is E2002 at its first issue: the path, or (root), and the rule", async () => {
    const message = async (value: unknown): Promise<unknown> =>
      (await commandRun("minimize", F, io([at(F, JSON.stringify(value))]), undefined)).records[0];
    expect(await message(5)).toEqual(diag("E2002", "session file fails sessions.Session at (root): type", F));
    expect(await message(null)).toEqual(diag("E2002", "session file fails sessions.Session at (root): type", F));
    expect(await message(session({ v: 2 }))).toEqual(
      diag("E2002", "session file fails sessions.Session at v: literal", F),
    );
    expect(await message(session({ route: { id: 5, params: {}, search: {} } }))).toEqual(
      diag("E2002", "session file fails sessions.Session at route.id: type", F),
    );
    expect(await message(session({ events: [{ at: 1, kind: "nav" }] }))).toMatchObject({
      message: expect.stringMatching(/^session file fails sessions\.Session at events\.0(\.href)?: \w/),
    });
    expect(await message(session({ extra: 1 }))).toEqual(
      diag("E2002", "session file fails sessions.Session at extra: unknown-key", F),
    );
    expect(await message(session({ id: "a/b" }))).toMatchObject({
      code: "E2002",
      message: expect.stringContaining(" at id: "),
    });
  });

  test("every failure ends in a failing summary named for the op, counting the one session, and writes nothing", async () => {
    const out = await commandRun("to-test", F, io([at(F, "nope")]), 5);
    expect(out.records.at(-1)).toEqual(summary("session to-test", false));
    expect(out.writes).toEqual([]);
  });
});

describe("commandRun: a group file", () => {
  test("replay of a file with a top-level `users` reports E2007 and E2008 and replays nothing", async () => {
    const bad = JSON.stringify({ ...group([session()]), v: 2 });
    expect(await commandRun("replay", F, io([at(F, bad)]), undefined)).toEqual(
      failed("replay", diag("E2007", "group file fails sessions.SessionGroup at v: literal", F, "std.multi")),
    );
    const unseeded = JSON.stringify(group([session(), session({ seed: undefined, deterministic: false })]));
    expect(await commandRun("replay", F, io([at(F, unseeded)]), undefined)).toEqual(
      failed("replay", diag("E2008", "group user 1's session has no seed", F, "std.multi")),
    );
  });

  test("a valid group passes with a summary that says how a group replays", async () => {
    const text = JSON.stringify(group([session(), session({ id: "s2" })]));
    expect(await commandRun("replay", F, io([at(F, text)]), undefined)).toEqual({
      records: [summary("session replay: a group file replays through replayGroup", true)],
      writes: [],
    });
  });

  test("only replay reads a group: minimize and to-test take the file as a session, and so does an array or a string", async () => {
    const text = JSON.stringify(group([session()]));
    for (const op of ["minimize", "to-test"] as const)
      expect((await commandRun(op, F, io([at(F, text)]), undefined)).records[0], op).toMatchObject({
        code: "E2002",
        see: "std.sessions",
      });
    for (const value of [["users"], "users", 5, { user: [] }])
      expect((await commandRun("replay", F, io([at(F, JSON.stringify(value))]), undefined)).records[0]).toMatchObject({
        code: "E2002",
      });
    expect(
      (await commandRun("replay", F, io([at(F, JSON.stringify({ users: 5 }))]), undefined)).records[0],
    ).toMatchObject({
      code: "E2007",
    });
  });
});

describe("commandRun: a session whose route nothing serves", () => {
  test("no topology, no deployable with the route's module, or no routes file is E2003 for the base", async () => {
    const text = JSON.stringify(session());
    const routes = at("modules/cart/routes.ts", "export const routes = {};");
    for (const files of [
      [at(F, text)],
      [at(F, text), routes],
      [at(F, text), routes, topology('{ web: { modules: ["orders"], adapter: "node" } }')],
      [at(F, text), topology('{ web: { modules: ["cart"], adapter: "node" } }')],
    ])
      for (const op of ["replay", "minimize", "to-test"] as const)
        expect(await commandRun(op, F, io(files), undefined)).toEqual(
          failed(op, diag("E2003", "base route cart.show is not served", F)),
        );
  });
});

describe("servingModules", () => {
  const files = (body: string, ...modules: string[]) => [
    topology(body),
    ...modules.map((m) => at(`modules/${m}/routes.ts`, "export const routes = {};")),
  ];

  test("the modules of the deployable serving the route id's module, each with a routes.ts", () => {
    const project = files('{ web: { modules: ["cart", "orders", "shared"], adapter: "node" } }', "cart", "orders");
    expect(servingModules(project, "cart.show")).toEqual(["cart", "orders"]);
    expect(servingModules(project, "orders.list.page")).toEqual(["cart", "orders"]);
    expect(servingModules(project, "cart")).toEqual(["cart", "orders"]);
  });

  test("with several deployables serving it, the first by name", () => {
    const body =
      '{ zeta: { modules: ["cart", "z"], adapter: "node" }, alpha: { modules: ["cart", "a"], adapter: "node" }, mid: { modules: ["cart", "m"], adapter: "node" } }';
    expect(servingModules(files(body, "cart", "a", "m", "z"), "cart.show")).toEqual(["cart", "a"]);
    const two =
      '{ b: { modules: ["cart", "second"], adapter: "node" }, a: { modules: ["cart", "first"], adapter: "node" } }';
    expect(servingModules(files(two, "cart", "first", "second"), "cart.show")).toEqual(["cart", "first"]);
  });

  test("undefined with no topology.ts at the root, no serving deployable, or no routes.ts for the route's own module", () => {
    const body = '{ web: { modules: ["cart", "orders"], adapter: "node" } }';
    expect(servingModules([at("modules/cart/routes.ts", "")], "cart.show")).toBeUndefined();
    expect(
      servingModules([{ ...topology(body), path: "apps/topology.ts" }, at("modules/cart/routes.ts", "")], "cart.show"),
    ).toBeUndefined();
    expect(servingModules(files(body, "cart", "orders"), "users.show")).toBeUndefined();
    expect(servingModules(files(body, "orders"), "cart.show")).toBeUndefined();
    expect(servingModules(files(body), "cart.show")).toBeUndefined();
    expect(servingModules(files(body, "cart", "orders"), "")).toBeUndefined();
    expect(servingModules(files(body, "cart"), "cart.show")).toEqual(["cart"]);
  });
});

describe("projectOf", () => {
  test("paths come out relative to the cwd with forward slashes, sources untouched", () => {
    const given: Io = {
      cwd: "/project",
      files: [
        at("/project/modules/cart/cart.ts", "a"),
        at("modules/./orders/../cart/x.ts", "b"),
        at("topology.ts", "c"),
        at("/elsewhere/y.ts", "d"),
      ],
    };
    expect(projectOf(given)).toEqual([
      at("modules/cart/cart.ts", "a"),
      at("modules/cart/x.ts", "b"),
      at("topology.ts", "c"),
      at("../elsewhere/y.ts", "d"),
    ]);
    expect(projectOf({ cwd: "/project" })).toEqual([]);
    expect(projectOf({ cwd: "/project", files: [] })).toEqual([]);
  });
});
