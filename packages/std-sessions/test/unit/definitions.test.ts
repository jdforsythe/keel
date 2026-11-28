// What `@keel/std-sessions/tools` declares at load: the `session` command (its input, its dispatch, `monitor`), the
// check rules E2001, E2005, E2007, E2008 and E2009 (code, message, explanation, fix), and the `session` formatter.
// Seed 1337
import type { Finding } from "@keel/check";
import type { Io } from "@keel/cli";
import { respond } from "@keel/cli/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { adapterNotNode } from "../../src/adapterNotNode.ts";
import { command } from "../../src/command.ts";
import { groupRules } from "../../src/groupRules.ts";
import { commandMonitor } from "../../src/internal/commandMonitor.ts";
import { parseTs } from "../../src/internal/parseTs.ts";
import { monitorNotNode } from "../../src/monitorNotNode.ts";
import { redactPath } from "../../src/redactPath.ts";
import "../../src/sessionFormatter.ts";

const finding = (data?: Record<string, string | number>): Finding => ({
  path: "modules/cart/module.ts",
  line: 1,
  col: 1,
  ...(data === undefined ? {} : { data }),
});
const messageOf = (rule: { message: string | ((f: Finding) => string) }, f: Finding): string =>
  typeof rule.message === "string" ? rule.message : rule.message(f);
const summary = (name: string, ok: boolean, counts: Record<string, number> = {}) => ({
  kind: "summary",
  ok,
  name,
  counts,
});

describe("the session command", () => {
  test("is `session`, a query, with op and target as its positional fields", () => {
    expect(command.name).toBe("session");
    expect(command.scope).toBe("query");
    expect(command.positional).toEqual(["op", "target"]);
    expect(command.description).toBe(
      "Capture, ingest, replay, minimize or make a test of a recorded session (std.sessions).",
    );
  });

  test("its input takes each op and the documented flags", () => {
    for (const op of ["capture", "ingest", "replay", "minimize", "to-test", "monitor"])
      expect(command.input.parse({ op }).ok, op).toBe(true);
    const full = {
      op: "minimize",
      target: "sessions/a.json",
      failing: true,
      since: "2026-01-01",
      "max-runs": 50,
      out: "m.json",
      format: "json",
      quiet: true,
      limit: 10,
      verbose: false,
    };
    const parsed = command.input.parse(full);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toEqual(full);
    for (const format of ["compact", "json", "pretty"])
      expect(command.input.parse({ op: "replay", format }).ok).toBe(true);
    expect(command.input.parse({ op: "replay", "max-runs": 1, limit: 0 }).ok).toBe(true);
    expect(command.input.parse({ op: "replay", "max-runs": 100_000, limit: 1_000_000 }).ok).toBe(true);
  });

  test("its input refuses an unknown op, a bad format and out-of-range numbers", () => {
    const bad = (extra: Record<string, unknown>) => command.input.parse({ op: "replay", ...extra }).ok;
    expect(command.input.parse({}).ok).toBe(false);
    expect(command.input.parse({ op: "record" }).ok).toBe(false);
    expect(command.input.parse({ op: "" }).ok).toBe(false);
    expect(bad({ format: "xml" })).toBe(false);
    expect(bad({ format: "" })).toBe(false);
    expect(bad({ "max-runs": 0 })).toBe(false);
    expect(bad({ "max-runs": 100_001 })).toBe(false);
    expect(bad({ "max-runs": 1.5 })).toBe(false);
    expect(bad({ limit: -1 })).toBe(false);
    expect(bad({ limit: 1_000_001 })).toBe(false);
    expect(bad({ target: 5 })).toBe(false);
    expect(bad({ failing: "yes" })).toBe(false);
  });

  test("its output is a list of records, each with a string kind", () => {
    expect(command.output.parse({ records: [{ kind: "session", id: "s1" }, { kind: "summary" }] }).ok).toBe(true);
    expect(command.output.parse({ records: [] }).ok).toBe(true);
    expect(command.output.parse({}).ok).toBe(false);
    expect(command.output.parse({ records: [{ id: "s1" }] }).ok).toBe(false);
    expect(command.output.parse({ records: [{ kind: 5 }] }).ok).toBe(false);
    expect(command.output.parse({ records: "none" }).ok).toBe(false);
  });

  test("capture, ingest and monitor go to their own commands", async () => {
    const io: Io = { cwd: "/project", files: [] };
    const first = async (op: string, extra: Record<string, unknown> = {}) =>
      (await command.run({ op, ...extra }, io)).records;
    expect(await first("capture")).toEqual([
      { kind: "diag", code: "I1055", message: "session capture needs a network (io.fetch)", see: "k.cli" },
      summary("session capture", true, { sessions: 0 }),
    ]);
    expect(await first("ingest", { target: "https://s.test" })).toEqual([
      { kind: "diag", code: "I1055", message: "session ingest needs a network (io.fetch)", see: "k.cli" },
      summary("session ingest", true, { sessions: 0 }),
    ]);
    expect(await first("monitor", { target: "https://s.test" })).toEqual([
      { kind: "diag", code: "I1055", message: "session monitor needs a network (io.fetch)", see: "k.cli" },
      summary("session monitor", true),
    ]);
  });

  test("replay, minimize and to-test need a session file", async () => {
    const io: Io = { cwd: "/project", files: [] };
    for (const op of ["replay", "minimize", "to-test"]) {
      expect(await command.run({ op }, io), op).toEqual({
        records: [
          { kind: "diag", code: "E1052", message: `session ${op} needs a session file`, see: "k.cli" },
          summary(`session ${op}`, false),
        ],
        writes: [],
      });
    }
  });

  test("with a file they read it: one that is missing is E2002 at that file", async () => {
    const io: Io = { cwd: "/project", files: [] };
    for (const op of ["replay", "minimize", "to-test"]) {
      expect(await command.run({ op, target: "sessions/none.json", "max-runs": 3 }, io), op).toEqual({
        records: [
          {
            kind: "diag",
            code: "E2002",
            path: "sessions/none.json",
            line: 1,
            col: 1,
            message: "session file fails sessions.Session at (root): not JSON",
            see: "std.sessions",
          },
          summary(`session ${op}`, false, { sessions: 1 }),
        ],
        writes: [],
      });
    }
  });

  test("an op it does not know does nothing", async () => {
    expect(await command.run({ op: "other", target: "x" }, { cwd: "/project", files: [] })).toEqual({
      records: [],
      writes: [],
    });
  });
});

describe("session monitor", () => {
  const tally = { v: 1, from: 100, to: 900, tx: { "cart.pay": 2, "cart.add": 5, "a.first": 0 } };
  const answer = (value: unknown, status = 200): Response =>
    new Response(JSON.stringify({ results: { "sessions.tally": { ok: true, value } } }), { status });
  function net(reply: () => Response | Promise<Response>, env?: Record<string, string>) {
    const asked: { url: string; init: RequestInit | undefined }[] = [];
    const io: Io = {
      cwd: "/project",
      ...(env === undefined ? {} : { env }),
      fetch: async (url, init) => {
        asked.push({ url, init });
        return reply();
      },
    };
    return { io, asked };
  }
  const failed = (message: string, code = "E2010", see = "std.monitor") => ({
    records: [{ kind: "diag", code, message, see }, summary("session monitor", false)],
    writes: [],
  });

  test("asks <url>/sessions/tally with the reader headers and writes .keel/monitored.json, tx names sorted", async () => {
    const { io, asked } = net(() => answer(tally), { KEEL_SESSIONS_TOKEN: "t0ken" });
    const out = await commandMonitor("https://user:pw@app.test:8443/base//", undefined, io);
    expect(asked).toEqual([
      {
        url: "https://user:pw@app.test:8443/base/sessions/tally",
        init: { headers: { accept: "application/json", cookie: "__Host-keel-caller=t0ken" } },
      },
    ]);
    const content = `${JSON.stringify(
      { v: 1, origin: "https://app.test:8443", from: 100, to: 900, tx: { "a.first": 0, "cart.add": 5, "cart.pay": 2 } },
      null,
      2,
    )}\n`;
    expect(out).toEqual({
      records: [
        {
          kind: "session.monitor",
          origin: "https://app.test:8443",
          transactions: 3,
          runs: 7,
          file: ".keel/monitored.json",
        },
        summary("session monitor", true),
      ],
      writes: [{ path: ".keel/monitored.json", content, readonly: false }],
    });
    expect(content).toContain('"tx": {\n    "a.first": 0,\n    "cart.add": 5,\n    "cart.pay": 2\n  }');
  });

  test("--out names the file; an empty tally is written with no transaction", async () => {
    const { io } = net(() => answer({ v: 1, from: 0, to: 0, tx: {} }));
    const out = await commandMonitor("http://localhost:4200", "reports/m.json", io);
    expect(out.records[0]).toEqual({
      kind: "session.monitor",
      origin: "http://localhost:4200",
      transactions: 0,
      runs: 0,
      file: "reports/m.json",
    });
    expect(out.writes.map((w) => w.path)).toEqual(["reports/m.json"]);
  });

  test("needs a url, and one a token may travel to; neither sends a request", async () => {
    for (const target of [undefined, "", "//"]) {
      const { io, asked } = net(() => answer(tally));
      expect(await commandMonitor(target, undefined, io)).toEqual(
        failed("session monitor needs the tally service url", "E1052", "k.cli"),
      );
      expect(asked).toEqual([]);
    }
    const { io, asked } = net(() => answer(tally));
    expect(await commandMonitor("http://app.test/", undefined, io)).toEqual(
      failed("session monitor needs https: http://app.test"),
    );
    expect(asked).toEqual([]);
  });

  test("unreachable, not 2xx, or not a Tally is E2010 naming the origin only, and writes nothing", async () => {
    const target = "https://user:pw@app.test/base?token=1";
    const failing = async (reply: () => Response | Promise<Response>, why: string) => {
      const { io } = net(reply);
      expect(await commandMonitor(target, undefined, io), why).toEqual(
        failed(`session monitor ${why}: https://app.test`),
      );
    };
    const none = "answered without a Tally";
    await failing(() => Promise.reject(new Error("down")), "target unreachable");
    await failing(() => answer(tally, 403), "target answered 403");
    await failing(() => new Response("<html>"), "not JSON");
    await failing(() => new Response("{}"), none);
    await failing(() => new Response(JSON.stringify({ results: {} })), none);
    await failing(
      () => new Response(JSON.stringify({ results: { "sessions.tally": { ok: false, value: tally } } })),
      none,
    );
    await failing(() => new Response(JSON.stringify({ results: { "sessions.tally": { value: tally } } })), none);
    await failing(() => answer({ ...tally, v: 2 }), none);
    await failing(() => answer({ ...tally, tx: { "cart.pay": -1 } }), none);
    await failing(() => answer({ ...tally, tx: { "cart.pay": 1.5 } }), none);
    await failing(() => answer({ ...tally, extra: 1 }), none);
    await failing(() => answer({ v: 1, from: 0, to: 0 }), none);
  });

  test("without io.fetch it is I1055, which is not a failure", async () => {
    expect(await commandMonitor("https://app.test", undefined, { cwd: "/project" })).toEqual({
      records: [
        { kind: "diag", code: "I1055", message: "session monitor needs a network (io.fetch)", see: "k.cli" },
        summary("session monitor", true),
      ],
      writes: [],
    });
  });

  test("property: runs is the sum of the counts and transactions their number", async () => {
    await fc.assert(
      fc.asyncProperty(fc.dictionary(fc.stringMatching(/^[a-z]{1,5}\.[a-z]{1,5}$/), fc.nat(1000)), async (tx) => {
        const { io } = net(() => answer({ v: 1, from: 0, to: 1, tx }));
        const [record] = (await commandMonitor("https://app.test", undefined, io)).records;
        expect(record).toMatchObject({
          transactions: Object.keys(tx).length,
          runs: Object.values(tx).reduce((a, b) => a + b, 0),
        });
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("the check rules", () => {
  test("E2005: a non-node deployable serves the sessions routes", () => {
    expect(adapterNotNode.code).toBe("E2005");
    expect(adapterNotNode.see).toBe("std.sessions");
    expect(messageOf(adapterNotNode, finding({ deployable: "web", adapter: "static" }))).toBe(
      "deployable 'web' (static) serves @keel/std-sessions/routes; ingest needs node",
    );
    expect(messageOf(adapterNotNode, finding())).toBe(
      "deployable '' () serves @keel/std-sessions/routes; ingest needs node",
    );
    expect(adapterNotNode.explain).toBe(
      "the sessions ingest route needs a server. A deployable with adapter 'static' or 'client' cannot serve it. " +
        "Fix: topology({ web: { modules: ['cart'], adapter: 'node' } }), or drop the @keel/std-sessions/routes import.",
    );
  });

  test("E2009: a non-node deployable serves the monitor runner", () => {
    expect(monitorNotNode.code).toBe("E2009");
    expect(monitorNotNode.see).toBe("std.monitor");
    expect(messageOf(monitorNotNode, finding({ deployable: "edge", adapter: "client" }))).toBe(
      "deployable 'edge' (client) serves @keel/std-sessions/monitor; monitor needs node",
    );
    expect(messageOf(monitorNotNode, finding())).toBe(
      "deployable '' () serves @keel/std-sessions/monitor; monitor needs node",
    );
    expect(monitorNotNode.explain).toBe(
      "the tally runner needs a server. A deployable with adapter 'static' or 'client' cannot run them. " +
        "Fix: topology({ api: { modules: ['api'], adapter: 'node' } }), or drop the @keel/std-sessions/monitor import.",
    );
  });

  test("E2005 and E2009 fire on the file that imports the source, when a non-node deployable serves its module", () => {
    const input = (path: string, source: string, adapter: string) => {
      const ast = parseTs(path, source);
      if (ast === undefined) throw new Error("the fixture parses");
      const file = { path, source };
      const topology = {
        path: "topology.ts",
        source: `import { topology } from "@keel/compiler";\nexport default topology({ web: { modules: ["cart"], adapter: "${adapter}" } });\n`,
      };
      return { file, ast, artifacts: {}, project: [file, topology] };
    };
    const routes = 'export { routes } from "@keel/std-sessions/routes";\n';
    expect(adapterNotNode.check(input("modules/cart/routes.ts", routes, "static"))).toEqual([
      { path: "modules/cart/routes.ts", line: 1, col: 24, data: { deployable: "web", adapter: "static" } },
    ]);
    expect(adapterNotNode.check(input("modules/cart/routes.ts", routes, "node"))).toEqual([]);
    expect(adapterNotNode.check(input("modules/cart/other.ts", routes, "static"))).toEqual([]);
    expect(adapterNotNode.check(input("modules/cart/runners.server.ts", routes, "static"))).toEqual([]);
    const runners = 'import { monitor } from "@keel/std-sessions/monitor";\nexport const runners = [monitor];\n';
    expect(monitorNotNode.check(input("modules/cart/runners.server.ts", runners, "client"))).toEqual([
      { path: "modules/cart/runners.server.ts", line: 1, col: 25, data: { deployable: "web", adapter: "client" } },
    ]);
    expect(monitorNotNode.check(input("modules/cart/runners.server.ts", runners, "node"))).toEqual([]);
    expect(monitorNotNode.check(input("modules/cart/routes.ts", runners, "client"))).toEqual([]);
    expect(monitorNotNode.check(input("modules/cart/runners.server.ts", routes, "client"))).toEqual([]);
    expect(adapterNotNode.check(input("modules/cart/routes.ts", runners, "static"))).toEqual([]);
  });

  test("E2007 and E2008 hold the std.multi explanations and find nothing in source", () => {
    expect(groupRules.map((r) => [r.code, r.see, r.message, r.explain])).toEqual([
      [
        "E2007",
        "std.multi",
        "group file fails SessionGroup",
        "A group file must parse as SessionGroup. Fix: record it with openGroup.",
      ],
      [
        "E2008",
        "std.multi",
        "group user session has no seed",
        "Each user session needs the seed it drew ids from. Fix: record under simulation.",
      ],
    ]);
    const file = { path: "modules/cart/module.ts", source: "export default 1;" };
    const ast = parseTs(file.path, file.source);
    if (ast === undefined) throw new Error("the fixture parses");
    for (const rule of groupRules) expect(rule.check({ file, ast, artifacts: {}, project: [file] })).toEqual([]);
  });

  test("E2001: the message says what is wrong with the entry, clipped to 24 characters a part", () => {
    expect(redactPath.code).toBe("E2001");
    expect(redactPath.see).toBe("std.sessions");
    const message = (data: Record<string, string | number>) => messageOf(redactPath, finding(data));
    expect(message({ why: "subject", subject: "user", entry: "user:cart#x", list: "redact" })).toBe(
      "redact entry 'user:cart#x' has unknown subject 'user'",
    );
    expect(message({ why: "module", target: "orders", id: "cart", entry: "tx:orders.pay#x", list: "expose" })).toBe(
      "expose entry 'tx:orders.pay#x' targets module 'orders', not 'cart'",
    );
    expect(message({ why: "path", path: "card.cvc", entry: "tx:cart.pay#card.cvc", list: "redact" })).toBe(
      "redact entry 'tx:cart.pay#card.cvc' path 'card.cvc' is not in its schema",
    );
    expect(message({ why: "form", entry: "nonsense", list: "redact" })).toBe(
      "redact entry 'nonsense' is not <subject>:<target>#<path>",
    );
    expect(messageOf(redactPath, finding())).toBe("redact entry '' is not <subject>:<target>#<path>");
    expect(message({ why: "subject" })).toBe("redact entry '' has unknown subject ''");
    expect(message({ why: "module" })).toBe("redact entry '' targets module '', not ''");
    expect(message({ why: "path" })).toBe("redact entry '' path '' is not in its schema");
    const long = "a".repeat(25);
    expect(message({ why: "path", path: long, entry: long, list: "redact" })).toBe(
      `redact entry '${"a".repeat(21)}...' path '${"a".repeat(21)}...' is not in its schema`,
    );
    expect(message({ why: "path", path: "b".repeat(24), entry: "c".repeat(24), list: "redact" })).toBe(
      `redact entry '${"c".repeat(24)}' path '${"b".repeat(24)}' is not in its schema`,
    );
    expect(redactPath.explain).toBe(
      "redact/expose entry must be '<subject>:<target>#<path>': subject tx|store|route|el|error, target in this module, " +
        "path present in its schema. Fix: redact: ['tx:cart.pay#card.number'] with card.number in the payload schema.",
    );
  });

  test("E2001: the fix removes the entry's span, when the finding carries one", () => {
    const file = { path: "modules/cart/module.ts", source: "" };
    const ast = parseTs(file.path, file.source);
    if (ast === undefined) throw new Error("the fixture parses");
    const fix = (data?: Record<string, string | number>) => redactPath.fix?.(finding(data), { file, ast });
    expect(fix({ rmStart: 10, rmEnd: 20 })).toEqual([{ start: 10, end: 20, text: "" }]);
    expect(fix({ rmStart: 0, rmEnd: 0 })).toEqual([{ start: 0, end: 0, text: "" }]);
    expect(fix({ rmStart: 10 })).toBeNull();
    expect(fix({ rmEnd: 20 })).toBeNull();
    expect(fix({ rmStart: "10", rmEnd: 20 })).toBeNull();
    expect(fix({ rmStart: 10, rmEnd: "20" })).toBeNull();
    expect(fix()).toBeNull();
  });

  test("E2001: each kind of bad entry is found at its literal, with what the fix needs; a good one is not", () => {
    const source = `import { module } from '@keel/compiler'
export default module({
  id: 'cart',
  std: { '@keel/std-sessions': { redact: ['nonsense', 'user:cart.pay#x', 'tx:orders.pay#x', 'tx:cart.pay#card.cvc', 'tx:cart.pay#card.number', 'el:cart.card#value'], expose: ['el:cart.card#checked'] } },
})
`;
    const file = { path: "modules/cart/module.ts", source };
    const cart = {
      path: "modules/cart/cart.ts",
      source:
        "export const pay = transaction(cart, 'cart.pay', s.object({ card: s.object({ number: s.string() }) }), fn);",
    };
    const ast = parseTs(file.path, source);
    if (ast === undefined) throw new Error("the fixture parses");
    const found = redactPath.check({ file, ast, artifacts: {}, project: [file, cart] });
    expect(found.map((f) => [f.line, f.data?.entry, f.data?.list, f.data?.why])).toEqual([
      [4, "nonsense", "redact", "form"],
      [4, "user:cart.pay#x", "redact", "subject"],
      [4, "tx:orders.pay#x", "redact", "module"],
      [4, "tx:cart.pay#card.cvc", "redact", "path"],
      [4, "el:cart.card#checked", "expose", "path"],
    ]);
    expect(found[1]?.data).toMatchObject({ subject: "user" });
    expect(found[2]?.data).toMatchObject({ target: "orders", id: "cart" });
    expect(found[3]?.data).toMatchObject({ path: "card.cvc" });
    for (const f of found) {
      expect(f.path).toBe("modules/cart/module.ts");
      const entry = `'${String(f.data?.entry)}'`;
      expect(f.col).toBe((source.split("\n")[3] ?? "").indexOf(entry) + 1);
      expect(typeof f.data?.rmStart).toBe("number");
      expect(typeof f.data?.rmEnd).toBe("number");
    }
    expect(redactPath.check({ file: cart, ast, artifacts: {}, project: [file, cart] })).toEqual([]);
    const nested = { path: "modules/cart/sub/module.ts", source };
    expect(redactPath.check({ file: nested, ast, artifacts: {}, project: [nested, cart] })).toEqual([]);
  });
});

describe("the session formatter", () => {
  const record = {
    kind: "session",
    id: "s1",
    fingerprint: "7f3a9c01d2e4",
    route: "cart.show",
    events: 4,
    inputs: 2,
    error: "cart.full",
    file: null,
  };

  test("compact is the session line; pretty adds inputs and, when written, the file on its own line", () => {
    expect(respond([record]).stdout.split("\n")[0]).toBe("7f3a9c01d2e4 cart.show 4 events cart.full");
    expect(respond([{ ...record, error: null, file: "a.json" }]).stdout.split("\n")[0]).toBe(
      "7f3a9c01d2e4 cart.show 4 events ok -> a.json",
    );
    expect(respond([record], { format: "pretty" }).stdout).toContain(
      "session 7f3a9c01d2e4 cart.show: 4 events, 2 inputs, cart.full\n",
    );
    expect(respond([record], { format: "pretty" }).stdout).not.toContain("file:");
    expect(respond([{ ...record, error: null, file: "a.json" }], { format: "pretty" }).stdout).toContain(
      "session 7f3a9c01d2e4 cart.show: 4 events, 2 inputs, ok\n  file: a.json",
    );
  });

  test("a record that is no session record is E1054", () => {
    expect(respond([{ ...record, events: "many" }]).stdout).toContain("E1054");
    expect(respond([{ ...record, extra: 1 }]).stdout).toContain("E1054");
  });
});
