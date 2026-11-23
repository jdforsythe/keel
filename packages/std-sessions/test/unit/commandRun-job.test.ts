// `keel session replay|minimize|to-test <f>` around its job, with the job itself scripted: what the command hands
// the job (the serving modules, their `redact` entries, the route module's `expose` entries, `--max-runs`), and what
// it makes of each result: E2003 and E2004, the `session` record, the minimized file, the emitted test file.
// Seed 1337 (no random inputs)
import type { Io } from "@keel/cli";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Session } from "../../src/Session.schema.ts";
import type { JobResult } from "../../src/internal/JobResult.ts";
import { commandRun } from "../../src/internal/commandRun.ts";
import { runJob } from "../../src/internal/runJob.ts";
import { sessionText } from "../../src/internal/sessionText.ts";
import { toTest } from "../../src/toTest.ts";

vi.mock("../../src/internal/runJob.ts", () => ({ runJob: vi.fn() }));
const job = vi.mocked(runJob);
beforeEach(() => {
  job.mockReset();
});

const FP = "7f3a9c01d2e4";
const F = "sessions/a.json";
const raw = (over: Record<string, unknown> = {}) => ({
  v: 1,
  id: "s1",
  seed: 7,
  deterministic: true,
  at: 0,
  route: { id: "cart.show", params: {}, search: {} },
  state: { "cart.cart": { items: [] }, "orders.list": { n: 1 } },
  events: [
    { at: 1, kind: "fire", id: "cart.add", event: { type: "click" } },
    { at: 1, kind: "tx", store: "cart.cart", name: "cart.add", payload: {} },
    { at: 2, kind: "nav", href: "/orders/o1" },
    { at: 3, kind: "net", online: false },
  ],
  error: { code: "cart.full", message: "full", data: null },
  fingerprint: FP,
  ...over,
});
const session = (over: Record<string, unknown> = {}): Session => {
  const parsed = Session.parse(raw(over));
  if (!parsed.ok) throw new Error("the fixture session parses");
  return parsed.value;
};
const manifest = (id: string, config: string) => ({
  path: `modules/${id}/module.ts`,
  source: `import { module } from "@keel/compiler";\nexport default module({ id: "${id}", std: { "@keel/std-sessions": ${config} } });\n`,
});
const file = (path: string, source = "export {};") => ({ path, source });
const project = (text: string = JSON.stringify(raw())) => [
  file(F, text),
  file(
    "topology.ts",
    'import { topology } from "@keel/compiler";\nexport default topology({ web: { modules: ["cart", "orders", "shared"], adapter: "node" } });\n',
  ),
  file("modules/cart/routes.ts"),
  file("modules/orders/routes.ts"),
  manifest("cart", '{ redact: ["tx:cart.pay#card.number"], expose: ["store:cart.cart#items", "el:cart.note#value"] }'),
  manifest("orders", '{ redact: ["tx:orders.pay#total", "el:orders.note#value"], expose: ["store:orders.list#n"] }'),
  manifest("shared", '{ redact: ["tx:shared.never#x"] }'),
  file("modules/cart/cart.ts"),
  file("modules/orders/list.ts"),
];
const io = (files = project()): Io => ({ cwd: "/project", files });
const result = (over: Partial<JobResult> = {}): { ok: true; result: JobResult } => ({
  ok: true,
  result: {
    reproduced: true,
    fingerprint: FP,
    error: "cart.full",
    unapplied: null,
    session: null,
    navs: [],
    runs: 1,
    minimal: false,
    ...over,
  },
});
const record = (over: Record<string, unknown> = {}) => ({
  kind: "session",
  id: "s1",
  fingerprint: FP,
  route: "cart.show",
  events: 4,
  inputs: 3,
  error: "cart.full",
  file: null,
  ...over,
});
const summary = (op: string, ok: boolean) => ({ kind: "summary", ok, name: `session ${op}`, counts: { sessions: 1 } });
const diag = (code: string, message: string) => ({
  kind: "diag",
  code,
  path: F,
  line: 1,
  col: 1,
  message,
  see: "std.sessions",
});

describe("commandRun: what the job is given", () => {
  test("the session, the serving modules that have routes, and every one of their redact entries", async () => {
    job.mockResolvedValue(result());
    const given = io();
    await commandRun("replay", F, given, undefined);
    expect(job).toHaveBeenCalledTimes(1);
    expect(job.mock.calls[0]?.[0]).toBe(given);
    expect(job.mock.calls[0]?.[1]).toEqual({
      op: "replay",
      session: raw(),
      modules: ["cart", "orders"],
      expose: [],
      redact: ["tx:cart.pay#card.number", "tx:orders.pay#total", "el:orders.note#value"],
    });
  });

  test("to-test also gets the route module's expose entries; --max-runs goes along when given", async () => {
    job.mockResolvedValue(result());
    await commandRun("to-test", F, io(), undefined);
    expect(job.mock.calls[0]?.[1]).toMatchObject({
      op: "to-test",
      expose: ["store:cart.cart#items", "el:cart.note#value"],
    });
    expect(job.mock.calls[0]?.[1]).not.toHaveProperty("maxRuns");
    await commandRun("minimize", F, io(), 25);
    expect(job.mock.calls[1]?.[1]).toMatchObject({ op: "minimize", expose: [], maxRuns: 25 });
    await commandRun(
      "minimize",
      F,
      io(project(JSON.stringify(raw({ route: { id: "orders.show", params: {}, search: {} } })))),
      0,
    );
    expect(job.mock.calls[2]?.[1]).toMatchObject({ maxRuns: 0 });
  });

  test("the expose entries are those of the session's route module, whichever module that is", async () => {
    job.mockResolvedValue(result());
    await commandRun(
      "to-test",
      F,
      io(project(JSON.stringify(raw({ route: { id: "orders.show", params: {}, search: {} } })))),
      undefined,
    );
    expect(job.mock.calls[0]?.[1]).toMatchObject({ expose: ["store:orders.list#n"] });
  });

  test("a module with no manifest, or one that does not parse, has no entries", async () => {
    job.mockResolvedValue(result());
    const files = project().filter((f) => f.path !== "modules/orders/module.ts");
    files.push(file("modules/orders/module.ts", "export default = ;"));
    await commandRun("to-test", F, io(files.filter((f) => f.path !== "modules/cart/module.ts")), undefined);
    expect(job.mock.calls[0]?.[1]).toMatchObject({ redact: [], expose: [] });
  });
});

describe("commandRun: a job that did not run", () => {
  test("its diagnostics come back and the summary fails, whatever they are", async () => {
    const note = { kind: "diag", code: "I1055", message: "only a note" };
    job.mockResolvedValue({ ok: false, diags: [note] });
    for (const op of ["replay", "minimize", "to-test"] as const)
      expect(await commandRun(op, F, io(), undefined)).toEqual({ records: [note, summary(op, false)], writes: [] });
  });
});

describe("commandRun: replay", () => {
  test("a reproduced replay is one session record of the file's session with the replay's error, and passes", async () => {
    job.mockResolvedValue(result({ error: "cart.other" }));
    expect(await commandRun("replay", F, io(), undefined)).toEqual({
      records: [record({ error: "cart.other" }), summary("replay", true)],
      writes: [],
    });
    job.mockResolvedValue(result({ error: null }));
    expect((await commandRun("replay", F, io(), undefined)).records[0]).toEqual(record({ error: null }));
  });

  test("a fingerprint that differs is E2004 naming both, then the record, and fails", async () => {
    job.mockResolvedValue(result({ reproduced: false, fingerprint: "000000000000" }));
    expect(await commandRun("replay", F, io(), undefined)).toEqual({
      records: [
        diag("E2004", `replay fingerprint 000000000000 differs from ${FP}`),
        record(),
        summary("replay", false),
      ],
      writes: [],
    });
  });

  test("an input that did not apply is E2003 naming its index, its kind and its element or href", async () => {
    const message = async (unapplied: number): Promise<unknown> => {
      job.mockResolvedValue(result({ unapplied }));
      return (await commandRun("replay", F, io(), undefined)).records[0];
    };
    expect(await message(0)).toEqual(diag("E2003", "input event 0 (fire) does not apply: cart.add"));
    expect(await message(1)).toEqual(diag("E2003", "input event 1 (tx) does not apply: "));
    expect(await message(2)).toEqual(diag("E2003", "input event 2 (nav) does not apply: /orders/o1"));
    expect(await message(3)).toEqual(diag("E2003", "input event 3 (net) does not apply: "));
    expect(await message(9)).toEqual(diag("E2003", "input event 9 (none) does not apply: "));
    expect(await message(-1)).toEqual(diag("E2003", "base route cart.show is not served"));
  });

  test("both are reported, E2003 first; a replay that reproduced despite an unapplied input still fails by E2003", async () => {
    job.mockResolvedValue(result({ unapplied: 0, reproduced: false, fingerprint: "000000000000" }));
    const out = await commandRun("replay", F, io(), undefined);
    expect(out.records.map((r) => r.code ?? r.kind)).toEqual(["E2003", "E2004", "session", "summary"]);
    job.mockResolvedValue(result({ unapplied: 0 }));
    expect(await commandRun("replay", F, io(), undefined)).toEqual({
      records: [diag("E2003", "input event 0 (fire) does not apply: cart.add"), record(), summary("replay", false)],
      writes: [],
    });
  });

  test("a replay never writes, even when the job answers a session", async () => {
    job.mockResolvedValue(result({ session: session({ events: [] }) }));
    expect(await commandRun("replay", F, io(), undefined)).toEqual({
      records: [record(), summary("replay", true)],
      writes: [],
    });
  });
});

describe("commandRun: minimize", () => {
  test("the minimized session replaces the file and is the record, with its own counts and error", async () => {
    const out = session({ events: raw().events.slice(0, 1), error: null });
    job.mockResolvedValue(result({ session: out, runs: 5, minimal: true }));
    expect(await commandRun("minimize", F, io(), undefined)).toEqual({
      records: [record({ events: 1, inputs: 1, error: null, file: F }), summary("minimize", true)],
      writes: [{ path: F, content: sessionText(out), readonly: false }],
    });
    job.mockResolvedValue(result({ session: session() }));
    expect((await commandRun("minimize", F, io(), undefined)).records[0]).toEqual(record({ file: F }));
  });

  test("not reproduced: E2004, the file's own record, nothing written; an unapplied index is not an error here", async () => {
    job.mockResolvedValue(result({ reproduced: false, fingerprint: "000000000000", unapplied: 2 }));
    expect(await commandRun("minimize", F, io(), undefined)).toEqual({
      records: [
        diag("E2004", `replay fingerprint 000000000000 differs from ${FP}`),
        record(),
        summary("minimize", false),
      ],
      writes: [],
    });
    job.mockResolvedValue(result({ unapplied: 2, session: session() }));
    expect((await commandRun("minimize", F, io(), undefined)).writes).toHaveLength(1);
  });

  test("a job that answers no session writes nothing and reports the file's record", async () => {
    job.mockResolvedValue(result({ session: null }));
    expect(await commandRun("minimize", F, io(), undefined)).toEqual({
      records: [record(), summary("minimize", true)],
      writes: [],
    });
  });
});

describe("commandRun: to-test", () => {
  const navs = [{ index: 2, id: "orders.show", params: { orderId: "o1" }, search: {} }];
  const routes = [
    { module: "cart", from: "../routes.ts", contract: "../cart.contract.ts" },
    { module: "orders", from: "../../orders/routes.ts", contract: "../../orders/orders.contract.ts" },
  ];

  test("writes modules/<route module>/test/session-<fingerprint>.test.ts from the job's session, its navs, the importable stores and the serving modules", async () => {
    const out = session();
    job.mockResolvedValue(result({ session: out, navs, runs: 2 }));
    const path = `modules/cart/test/session-${FP}.test.ts`;
    const made = await commandRun("to-test", F, io(), undefined);
    expect(made.records).toEqual([record({ file: path }), summary("to-test", true)]);
    expect(made.writes).toEqual([
      {
        path,
        content: toTest(out, {
          navs,
          stores: [
            { id: "cart.cart", name: "cart", from: "../cart.ts" },
            { id: "orders.list", name: "list", from: "../../orders/list.ts" },
          ],
          routes,
        }),
        readonly: false,
      },
    ]);
    expect(made.writes[0]?.content).toContain('import { cart } from "../cart.ts";');
    expect(made.writes[0]?.content).toContain('import { list } from "../../orders/list.ts";');
    expect(made.writes[0]?.content).toContain('await h.navigate(orders.href("orders.show", {"orderId":"o1"}));');
  });

  test("a store is imported only when its id is <module>.<name>, the name is an identifier and modules/<module>/<name>.ts exists", async () => {
    const state = {
      "cart.cart": 1,
      "cart.missing": 2,
      nodot: 3,
      ".lead": 4,
      "cart.my-store": 5,
      "cart.9lives": 6,
      "cart.$ok_1": 7,
      "cart.deep.name": 8,
      "cart.sp ace": 9,
    };
    const out = session({ state });
    job.mockResolvedValue(result({ session: out }));
    const files = [
      ...project(),
      file("modules/cart/my-store.ts"),
      file("modules/cart/9lives.ts"),
      file("modules/cart/$ok_1.ts"),
      file("modules/cart/deep.name.ts"),
      file("modules//lead.ts"),
      file("modules/cart/sp ace.ts"),
      file("modules/nodot.ts"),
    ];
    const made = await commandRun("to-test", F, io(files), undefined);
    expect(made.writes[0]?.content).toBe(
      toTest(out, {
        navs: [],
        stores: [
          { id: "cart.cart", name: "cart", from: "../cart.ts" },
          { id: "cart.$ok_1", name: "$ok_1", from: "../$ok_1.ts" },
        ],
        routes,
      }),
    );
  });

  test("the file goes to the session's route module, and a store of that module is imported from beside it", async () => {
    const out = session({ route: { id: "orders.show", params: {}, search: {} } });
    job.mockResolvedValue(result({ session: out }));
    const made = await commandRun(
      "to-test",
      F,
      io(project(JSON.stringify(raw({ route: { id: "orders.show", params: {}, search: {} } })))),
      undefined,
    );
    expect(made.writes.map((w) => w.path)).toEqual([`modules/orders/test/session-${FP}.test.ts`]);
    expect(made.writes[0]?.content).toBe(
      toTest(out, {
        navs: [],
        stores: [
          { id: "cart.cart", name: "cart", from: "../../cart/cart.ts" },
          { id: "orders.list", name: "list", from: "../list.ts" },
        ],
        routes: [
          { module: "cart", from: "../../cart/routes.ts", contract: "../../cart/cart.contract.ts" },
          { module: "orders", from: "../routes.ts", contract: "../orders.contract.ts" },
        ],
      }),
    );
  });

  test("the file is named for the fingerprint of the job's session, and the record carries its error", async () => {
    const out = session({ fingerprint: "0123456789ab", error: null });
    job.mockResolvedValue(result({ session: out }));
    const made = await commandRun("to-test", F, io(), undefined);
    expect(made.writes.map((w) => w.path)).toEqual(["modules/cart/test/session-0123456789ab.test.ts"]);
    expect(made.records[0]).toEqual(
      record({ fingerprint: "0123456789ab", error: null, file: "modules/cart/test/session-0123456789ab.test.ts" }),
    );
  });

  test("not reproduced, an unapplied input, or no session from the job: diagnostics and the file's record, nothing written", async () => {
    job.mockResolvedValue(result({ reproduced: false, fingerprint: "000000000000", session: session() }));
    expect(await commandRun("to-test", F, io(), undefined)).toEqual({
      records: [
        diag("E2004", `replay fingerprint 000000000000 differs from ${FP}`),
        record(),
        summary("to-test", false),
      ],
      writes: [],
    });
    job.mockResolvedValue(result({ unapplied: 0, session: session() }));
    expect(await commandRun("to-test", F, io(), undefined)).toEqual({
      records: [diag("E2003", "input event 0 (fire) does not apply: cart.add"), record(), summary("to-test", false)],
      writes: [],
    });
    job.mockResolvedValue(result({ session: null }));
    expect(await commandRun("to-test", F, io(), undefined)).toEqual({
      records: [record(), summary("to-test", true)],
      writes: [],
    });
  });
});
