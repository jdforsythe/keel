// std.jobs rules E2501 to E2505: where each finding sits, its message and the edit its fix makes, and the sources it
// leaves alone. Seed 1337
import { check } from "@keel/check";
import "@keel/std-jobs/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
type Row = { code: string; path: string; line: number; col: number; message: string; edit: string[] | null };

/** The lines a fix patch adds and removes. */
const editOf = (fix: string | undefined): string[] | null =>
  fix === undefined
    ? null
    : fix
        .split("\n")
        .filter((l) => /^[-+]/.test(l) && !/^(---|\+\+\+)/.test(l))
        .map((l) => l);
const rows = (files: Files, code: string): Row[] =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === code)
    .map((d) => ({ code: d.code, path: d.path, line: d.line, col: d.col, message: d.message, edit: editOf(d.fix) }));
const at = (source: string, needle: string, from = 0) => {
  const i = source.indexOf(needle, from);
  const before = source.slice(0, i);
  return { line: before.split("\n").length, col: i - before.lastIndexOf("\n") };
};

const manifest = (exports = "") =>
  `import { module } from "@keel/compiler"\nexport default module({ id: "orders", deps: ["@keel/std-jobs"], capabilities: ["clock"]${exports} })\n`;
const topo = (adapter = "node", modules = '"orders"') =>
  `import { topology } from "@keel/server"\nexport default topology({ web: { modules: [${modules}], adapter: "${adapter}" } })\n`;
const HOME = "modules/orders/jobs.server.ts";
const queueFile = (body: string, imp = `import { queue } from "@keel/std-jobs"\n`) => `${imp}${body}\n`;

test("E2501 flags each static table key not prefixed by the module id, at the key, with an edit that prefixes it", () => {
  const src = queueFile(
    `export const jobs = queue({ b: 1, "c": 2, "orders.d": 3, ["e"]: 4, ...f, 5: 6, ordersx: 7, orders: 8, [\`g\`]: 9 })`,
  );
  const got = rows([{ path: HOME, source: src }], "E2501");
  const line = src.split("\n")[1] ?? "";
  const edit = (from: string, to: string) => [`-${line}`, `+${line.replace(from, to)}`];
  expect(got).toEqual([
    {
      code: "E2501",
      path: HOME,
      ...at(src, "b:"),
      message: "queue key 'b' is not prefixed by module 'orders'",
      edit: edit("b:", '"orders.b":'),
    },
    {
      code: "E2501",
      path: HOME,
      ...at(src, '"c"'),
      message: "queue key 'c' is not prefixed by module 'orders'",
      edit: edit('"c"', '"orders.c"'),
    },
    {
      code: "E2501",
      path: HOME,
      ...at(src, "ordersx"),
      message: "queue key 'ordersx' is not prefixed by module 'orders'",
      edit: edit("ordersx:", '"orders.ordersx":'),
    },
    {
      code: "E2501",
      path: HOME,
      ...at(src, "orders: 8"),
      message: "queue key 'orders' is not prefixed by module 'orders'",
      edit: edit("orders: 8", '"orders.orders": 8'),
    },
  ]);
});

test("E2501 names a long key and a long module id by their first 24 characters", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{25,40}$/), fc.stringMatching(/^[a-z]{25,40}$/), (key, id) => {
      const path = `modules/${id}/jobs.server.ts`;
      const got = rows([{ path, source: queueFile(`export const jobs = queue({ ${key}: 1 })`) }], "E2501");
      expect(got.map((r) => r.message)).toEqual([
        `queue key '${key.slice(0, 24)}' is not prefixed by module '${id.slice(0, 24)}'`,
      ]);
    }),
    { seed: 1337, numRuns: 20 },
  );
});

test("E2501 finds `queue` through an alias, through a namespace import and through no other name", () => {
  const home = (body: string, imp: string) => rows([{ path: HOME, source: queueFile(body, imp) }], "E2501").length;
  expect(home("q({ a: 1 })", `import { queue as q } from "@keel/std-jobs"\n`)).toBe(1);
  expect(home("ns.queue({ a: 1 })", `import * as ns from "@keel/std-jobs"\n`)).toBe(1);
  expect(home("ns.queue({ a: 1 })", `import * as ns from "@keel/std-jobs"\nimport * as other from "other"\n`)).toBe(1);
  expect(home("other.queue({ a: 1 })", `import * as ns from "@keel/std-jobs"\nimport * as other from "other"\n`)).toBe(
    0,
  );
  expect(home("queue({ a: 1 })", `import { queue } from "other"\n`)).toBe(0);
  expect(home("queue({ a: 1 })", `import { job as queue } from "@keel/std-jobs"\n`)).toBe(0);
  expect(home("ns.job({ a: 1 })", `import * as ns from "@keel/std-jobs"\n`)).toBe(0);
  expect(home('ns["queue"]({ a: 1 })', `import * as ns from "@keel/std-jobs"\n`)).toBe(0);
  expect(home("ns.queue.x({ a: 1 })", `import * as ns from "@keel/std-jobs"\n`)).toBe(0);
  expect(home("ns.a.queue({ a: 1 })", `import * as ns from "@keel/std-jobs"\n`)).toBe(0);
  expect(home("queue", `import { queue } from "@keel/std-jobs"\n`)).toBe(0);
  expect(home("queue({ a: 1 })", "")).toBe(0);
  expect(home("other({ a: 1 })", `import { queue } from "@keel/std-jobs"\n`)).toBe(0);
  expect(home("queue({ a: 1 })", `import def from "@keel/std-jobs"\nimport { queue } from "@keel/std-jobs"\n`)).toBe(1);
  expect(home("queue({ a: 1 })", `import { "queue" as q } from "@keel/std-jobs"\n`)).toBe(0);
});

test("E2501 flags a `queue` call outside modules/<id>/jobs.server.ts at the call, once per call, with no fix", () => {
  const src = queueFile(`\n  queue({ "orders.a": 1 })\nexport const x = queue({ "orders.b": 2 })`);
  for (const path of [
    "modules/orders/other.server.ts",
    "jobs.server.ts",
    "modules/orders/sub/jobs.server.ts",
    "modules/orders/jobs.ts",
  ]) {
    expect(rows([{ path, source: src }], "E2501"), path).toEqual([
      { code: "E2501", path, ...at(src, "queue({"), message: "queue outside modules/<id>/jobs.server.ts", edit: null },
      {
        code: "E2501",
        path,
        ...at(src, "queue({", src.indexOf("queue({") + 1),
        message: "queue outside modules/<id>/jobs.server.ts",
        edit: null,
      },
    ]);
  }
  expect(rows([{ path: "apps/web/modules/orders/jobs.server.ts", source: src }], "E2501")).toEqual([]);
});

test("E2501 leaves a table that is not an object literal, and a call without one, alone", () => {
  const files = (body: string): Files => [{ path: HOME, source: queueFile(body) }];
  expect(rows(files("export const jobs = queue(table)"), "E2501")).toEqual([]);
  expect(rows(files("export const jobs = queue()"), "E2501")).toEqual([]);
  expect(rows(files("export const jobs = queue({})"), "E2501")).toEqual([]);
});

const exportsOf = (list: string) => `, public: { exports: ${list} }`;
const withJobs = (module: string, path = "modules/orders/module.ts"): Files => [
  { path, source: module },
  { path: path.replace("module.ts", "jobs.server.ts"), source: queueFile("export const jobs = queue({})") },
];

test("E2502 flags `jobs` among a module's public exports, at the entry, with an edit that removes it and its comma", () => {
  const cases: [string, string][] = [
    [`["a", "jobs", "b"]`, `["a", "b"]`],
    [`["jobs", "b"]`, `["b"]`],
    [`["a", "jobs"]`, `["a"]`],
    [`["jobs"]`, "[]"],
    [`["a", "jobs", "jobs"]`, `["a", "jobs"]`],
  ];
  for (const [list, after] of cases) {
    const src = manifest(exportsOf(list));
    const line = src.split("\n")[1] ?? "";
    expect(rows(withJobs(src), "E2502"), list).toEqual([
      {
        code: "E2502",
        path: "modules/orders/module.ts",
        ...at(src, '"jobs"'),
        message: "jobs is public; other modules start jobs through this module's actions",
        edit: [`-${line}`, `+${line.replace(list, after)}`],
      },
    ]);
  }
});

test("E2502 reads the manifest as a call or a plain object, at any app prefix", () => {
  const plain = `export default { id: "orders", public: { exports: ["a", "jobs"] } }\n`;
  expect(rows(withJobs(plain), "E2502").length).toBe(1);
  const prefixed = rows(withJobs(manifest(exportsOf(`["jobs"]`)), "apps/web/modules/orders/module.ts"), "E2502");
  expect(prefixed.map((r) => r.path)).toEqual(["apps/web/modules/orders/module.ts"]);
});

test("E2502 stays silent without a jobs.server.ts, in another file, in another module, or without a literal exports list", () => {
  const m = manifest(exportsOf(`["jobs"]`));
  expect(rows([{ path: "modules/orders/module.ts", source: m }], "E2502")).toEqual([]);
  expect(rows([...withJobs(m), { path: "modules/orders/other.ts", source: m }].slice(0, 2), "E2502").length).toBe(1);
  expect(rows([{ path: "modules/orders/other.ts", source: m }, ...withJobs(m).slice(1)], "E2502")).toEqual([]);
  expect(rows([{ path: "modules/billing/module.ts", source: m }, ...withJobs(m).slice(1)], "E2502")).toEqual([]);
  for (const src of [
    manifest(exportsOf(`["a", "b"]`)),
    manifest(exportsOf("exportsList")),
    manifest(exportsOf("[...more]")),
    manifest(exportsOf("[jobs]")),
    manifest(""),
    "export default module()\n",
    "export default 5\n",
    "export const x = 1\n",
  ])
    expect(rows(withJobs(src), "E2502"), src).toEqual([]);
  const first = `const x = 1\nexport function f() {}\n${manifest(exportsOf(`["jobs"]`))}`;
  expect(rows(withJobs(first), "E2502").length).toBe(1);
});

const jobSrc = (
  input: string,
  imp = `import { job } from "@keel/std-jobs"\nimport { s } from "@keel/schema"\n`,
  pre = "",
) => `${imp}${pre}export const send = job({ input: ${input} }, async () => null)\n`;
const secrets = (src: string) => rows([{ path: "modules/orders/send.server.ts", source: src }], "E2503");

test("E2503 flags a job whose input holds s.secret, at the input, with no fix", () => {
  const src = jobSrc("s.object({ a: s.array(s.secret(s.string())) })");
  expect(secrets(src)).toEqual([
    {
      code: "E2503",
      path: "modules/orders/send.server.ts",
      ...at(src, "s.object"),
      message: "job input holds s.secret; a job's input is stored",
      edit: null,
    },
  ]);
});

test("E2503 follows an input named by a const of the file, exported or not, and nothing else", () => {
  const imp = `import { job } from "@keel/std-jobs"\nimport { s } from "@keel/schema"\n`;
  expect(secrets(jobSrc("input", imp, "const input = s.object({ t: s.secret(s.string()) })\n")).length).toBe(1);
  expect(secrets(jobSrc("input", imp, "export const input = s.object({ t: s.secret(s.string()) })\n")).length).toBe(1);
  expect(secrets(jobSrc("input", imp, "const input = s.object({ t: s.string() })\n")).length).toBe(0);
  expect(secrets(jobSrc("input", imp, "const { input } = other\n")).length).toBe(0);
  expect(secrets(jobSrc("input", imp, "function input() {}\nconst x = s.secret(s.string())\n")).length).toBe(0);
  expect(secrets(jobSrc("input", imp, "")).length).toBe(0);
  expect(secrets(jobSrc("other", imp, "const input = s.secret(s.string())\n")).length).toBe(0);
  expect(secrets(jobSrc("s.object({})", imp, "const input = s.secret(s.string())\nlet y = 1, z = 2\n")).length).toBe(0);
});

test("E2503 recognises `s` through an alias and a namespace import of @keel/schema, and no other source", () => {
  const job = `import { job } from "@keel/std-jobs"\n`;
  expect(secrets(jobSrc("z.secret(z.string())", `${job}import { s as z } from "@keel/schema"\n`)).length).toBe(1);
  expect(secrets(jobSrc("k.s.secret(k.s.string())", `${job}import * as k from "@keel/schema"\n`)).length).toBe(1);
  expect(secrets(jobSrc("k.t.secret(k.s.string())", `${job}import * as k from "@keel/schema"\n`)).length).toBe(0);
  expect(secrets(jobSrc("s.secret(s.string())", `${job}import { s } from "other"\n`)).length).toBe(0);
  expect(secrets(jobSrc("s.secret(s.string())", `${job}import { t as s } from "@keel/schema"\n`)).length).toBe(0);
  expect(secrets(jobSrc("s.secret(s.string())", `${job}import { "s" as s } from "@keel/schema"\n`)).length).toBe(1);
  expect(secrets(jobSrc("s.secret(s.string())", `${job}import s from "@keel/schema"\n`)).length).toBe(0);
  expect(secrets(jobSrc("s.secret(s.string())", `${job}import * as s from "other"\n`)).length).toBe(0);
  expect(secrets(jobSrc("s.secrets(s.string())", `${job}import { s } from "@keel/schema"\n`)).length).toBe(0);
  expect(secrets(jobSrc("s.secret", `${job}import { s } from "@keel/schema"\n`)).length).toBe(0);
  expect(secrets(jobSrc("t.secret(s.string())", `${job}import { s } from "@keel/schema"\n`)).length).toBe(0);
});

test("E2503 finds `job` through an alias and a namespace import, once per job, and only with an object that has an input", () => {
  const sch = `import { s } from "@keel/schema"\n`;
  const bad = "s.secret(s.string())";
  const two = `import * as j from "@keel/std-jobs"\n${sch}export const a = j.job({ input: ${bad} }, f)\nexport const b = j.job({ input: ${bad} }, f)\n`;
  expect(secrets(two).map((r) => r.line)).toEqual([3, 4]);
  expect(secrets(`import { job as w } from "@keel/std-jobs"\n${sch}w({ input: ${bad} }, f)\n`).length).toBe(1);
  expect(secrets(`import { job } from "other"\n${sch}job({ input: ${bad} }, f)\n`).length).toBe(0);
  expect(
    secrets(`import { job } from "@keel/std-jobs"\n${sch}job(opts, f)\njob({}, f)\njob({ ["input"]: ${bad} }, f)\n`)
      .length,
  ).toBe(0);
  expect(
    secrets(`import { job } from "@keel/std-jobs"\n${sch}job({ input: ${bad}, attempts: 2, timeoutMs: 5 }, f)\n`)
      .length,
  ).toBe(1);
  expect(secrets(`import { job } from "@keel/std-jobs"\n${sch}job({ attempts: 2, "input": ${bad} }, f)\n`).length).toBe(
    1,
  );
});

test("E2503 reads past nulls, regular expressions and functions in the input without failing", () => {
  const input = `s.object({ a: s.string().refine((x) => /a/.test(x) && x !== null, "m"), b: s.number().optional() })`;
  expect(secrets(jobSrc(input)).length).toBe(0);
  const input2 = "s.object({ a: s.string().refine((x) => x.length > 0, null), c: s.secret(s.string()) })";
  expect(secrets(jobSrc(input2)).length).toBe(1);
});

const runnersFiles = (runners: string | null, jobs = true, adapter = "node", extra: Files = []): Files => [
  { path: "modules/orders/module.ts", source: manifest() },
  ...(jobs ? [{ path: HOME, source: queueFile("export const jobs = queue({})") }] : []),
  ...(runners === null ? [] : [{ path: "modules/orders/runners.server.ts", source: runners }]),
  { path: "topology.ts", source: topo(adapter) },
  ...extra,
];
const E4 = (files: Files) => rows(files, "E2504");
const imp = `import { jobs } from "./jobs.server.ts"\n`;

test("E2504 flags a literal `runners` without `jobs`, at the array, with an edit that adds it", () => {
  const cases: [string, string, string[]][] = [
    ["export const runners = [a]", "export const runners = [a, jobs]", [`+${imp.trimEnd()}`]],
    ["export const runners = [a, b]", "export const runners = [a, b, jobs]", [`+${imp.trimEnd()}`]],
    ["export const runners = []", "export const runners = [jobs]", [`+${imp.trimEnd()}`]],
  ];
  for (const [line, after, head] of cases) {
    const src = `${line}\n`;
    const got = E4(runnersFiles(src));
    expect(got, line).toEqual([
      {
        code: "E2504",
        path: "modules/orders/runners.server.ts",
        ...at(src, "["),
        message: "runners lacks jobs; the module's queue never runs",
        edit: [`-${line}`, ...head, `+${after}`],
      },
    ]);
  }
});

test("E2504 adds no import when `jobs` is already imported under that name, and one when another name is", () => {
  const body = "export const runners = [a]\n";
  const withImport = (i: string) => E4(runnersFiles(`${i}${body}`)).map((r) => r.edit);
  expect(withImport(`import { jobs } from "./elsewhere.ts"\n`)).toEqual([
    [`-${body.trimEnd()}`, "+export const runners = [a, jobs]"],
  ]);
  expect(withImport(`import jobs from "./jobs.server.ts"\n`)).toEqual([
    [`-${body.trimEnd()}`, "+export const runners = [a, jobs]"],
  ]);
  expect(withImport(`import { other as jobs } from "./x.ts"\n`)).toEqual([
    [`-${body.trimEnd()}`, "+export const runners = [a, jobs]"],
  ]);
  expect(withImport(`import { jobs as other } from "./jobs.server.ts"\n`)).toEqual([
    [`+${imp.trimEnd()}`, `-${body.trimEnd()}`, "+export const runners = [a, jobs]"],
  ]);
  expect(withImport(`import { x, jobs } from "./x.ts"\nimport { y } from "./y.ts"\n`)).toEqual([
    [`-${body.trimEnd()}`, "+export const runners = [a, jobs]"],
  ]);
  expect(withImport(`import { x } from "./x.ts"\nexport const jobs = 1\n`)).toEqual([
    [`+${imp.trimEnd()}`, `-${body.trimEnd()}`, "+export const runners = [a, jobs]"],
  ]);
});

test("E2504 leaves a `runners` that lists `jobs`, and anything it cannot read as a literal list, alone", () => {
  for (const src of [
    "export const runners = [jobs]\n",
    "export const runners = [a, jobs, b]\n",
    "export const runners = [...more]\n".replace("[...more]", "make()"),
    "export const runners = make([a])\n",
    "const runners = [a]\n",
    "export const other = [a]\nexport const runners = [jobs]\n",
    "export function f() {}\nexport const runners = [jobs]\n",
    "export const { runners } = x\n",
    "export const a = 1, runners = [jobs]\n",
    "export const other = [a]\n",
    "export default [a]\n",
    "export const runners = [a, jobs.x]\n".replace("jobs.x", "jobs"),
  ])
    expect(E4(runnersFiles(src)), src).toEqual([]);
  expect(E4(runnersFiles(`export const runners = [x.jobs, "jobs", ...jobs]\n`)).length).toBe(1);
});

test("E2504 flags a module with jobs.server.ts and no runners.server.ts at the start of jobs.server.ts, with no fix", () => {
  expect(E4(runnersFiles(null))).toEqual([
    {
      code: "E2504",
      path: HOME,
      line: 1,
      col: 1,
      message: "runners lacks jobs; the module's queue never runs",
      edit: null,
    },
  ]);
  expect(E4(runnersFiles(null, false))).toEqual([]);
  expect(E4(runnersFiles("export const runners = []\n", false))).toEqual([]);
  expect(
    E4(
      runnersFiles(null, true, "node", [
        { path: "modules/billing/runners.server.ts", source: "export const runners = []\n" },
      ]),
    ),
  ).toEqual([
    {
      code: "E2504",
      path: HOME,
      line: 1,
      col: 1,
      message: "runners lacks jobs; the module's queue never runs",
      edit: null,
    },
  ]);
});

test("E2504 flags jobs.server.ts when a deployable that serves its module is not node, naming the deployable and its adapter", () => {
  fc.assert(
    fc.property(fc.constantFrom("static", "client"), (adapter) => {
      expect(E4(runnersFiles("export const runners = [jobs]\n", true, adapter))).toEqual([
        {
          code: "E2504",
          path: HOME,
          line: 1,
          col: 1,
          message: `jobs need a node deployable; 'web' is ${adapter}`,
          edit: null,
        },
      ]);
    }),
    { seed: 1337, numRuns: 6 },
  );
  const ok = "export const runners = [jobs]\n";
  expect(E4(runnersFiles(ok, true, "node"))).toEqual([]);
  const two = `import { topology } from "@keel/server"\nexport default topology({ api: { modules: ["orders"], adapter: "node" }, site: { modules: ["billing"], adapter: "static" } })\n`;
  const files: Files = [
    ...runnersFiles(ok).filter((f) => f.path !== "topology.ts"),
    { path: "topology.ts", source: two },
  ];
  expect(E4(files)).toEqual([]);
  const long = `import { topology } from "@keel/server"\nexport default topology({ ${"d".repeat(30)}: { modules: ["orders"], adapter: "static" } })\n`;
  const named: Files = [
    ...runnersFiles(ok).filter((f) => f.path !== "topology.ts"),
    { path: "topology.ts", source: long },
  ];
  expect(E4(named).map((r) => r.message)).toEqual([`jobs need a node deployable; '${"d".repeat(24)}' is static`]);
  const nested: Files = [
    ...runnersFiles(ok).filter((f) => f.path !== "topology.ts"),
    { path: "apps/web/modules/orders/jobs.server.ts", source: queueFile("export const jobs = queue({})") },
    { path: "apps/web/modules/orders/runners.server.ts", source: ok },
    { path: "apps/web/topology.ts", source: topo("static") },
  ];
  expect(E4(nested).map((r) => r.path)).toEqual(["apps/web/modules/orders/jobs.server.ts"]);
  const noTopology = runnersFiles(ok, true, "static").filter((f) => f.path !== "topology.ts");
  expect(E4(noTopology)).toEqual([]);
});

test("E2505 is a registered rule that no source triggers, whatever its job options", () => {
  const src = `import { job } from "@keel/std-jobs"\nimport { s } from "@keel/schema"\nexport const a = job({ input: s.object({}), attempts: 0, timeoutMs: 1.5 }, async () => null)\n`;
  expect(rows([{ path: "modules/orders/a.server.ts", source: src }], "E2505")).toEqual([]);
  expect(rows(runnersFiles("export const runners = [jobs]\n"), "E2505")).toEqual([]);
});
