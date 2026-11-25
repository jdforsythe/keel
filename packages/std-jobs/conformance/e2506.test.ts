// Spec: std.jobs, clause "In `modules/orders/pay.server.ts` with `jobs` imported from `./jobs.server.ts`, `jobs.enqueue(ctx, 'orders.mail', { t: reveal(p.k) })`, the same through a `const`, and `{ key: reveal(p.k) }` as the fourth argument are each one E2506; `{ t: hash(reveal(p.k)) }`, and `enqueue` on a name imported from `./mail.ts`, are none." (E2506)
// std.jobs, rule E2506: an argument of `<q>.enqueue(…)` that carries a value `reveal` returns (`carriesReveal`, k.privacy-reads), `<q>` a name imported from a relative path ending `jobs.server` (`.ts`, `.js` or none), `<ns>.<name>` of a namespace import of one, or a `const` of the file bound to `queue(…)` (no fix). Not followed: `enqueue` taken off the queue into a local, its `.call` or `.apply`, and a helper that enqueues.
// std.jobs, API "`input` holds no `s.secret` (E2503) and `enqueue` is given no revealed value (E2506): a job's input and `key` are stored."
// Seed 1337
// Not yet built: `test.skip` until `check()` reports E2506; remove the `.skip` in the build that adds it.
// Assumption: as for E2503, `check()` imports nothing, so the rule registers by importing `@keel/std-jobs/tools`; a module is the files under `modules/<id>/` with a `module.ts` listing `deps`.
// Assumption: a finding is asserted by code, path and the line of its `enqueue` statement; the spec gives no column. No fix.
// Assumption: "the same through a `const`" is `const q = queue({ ... })` in `pay.server.ts` with `q.enqueue(...)`.
// Assumption: one finding per `enqueue` call, however many of its arguments carry a revealed value.
import { check } from "@keel/check";
import "@keel/std-jobs/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
const PATH = "modules/orders/pay.server.ts";
const MANIFEST = {
  path: "modules/orders/module.ts",
  source: `import { module } from "@keel/compiler"\nexport default module({ id: "orders", deps: ["@keel/std-jobs"], capabilities: ["clock", "random", "storage"] })\n`,
};
const JOBS = {
  path: "modules/orders/jobs.server.ts",
  source: `import { queue } from "@keel/std-jobs"\nimport { mail } from "./mail.server.ts"\nexport const jobs = queue({ "orders.mail": mail })\n`,
};
const found = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E2506");
const key = fc.stringMatching(/^[a-z]{1,8}$/);

/** `pay.server.ts` with `imports` after the shared head and `body` lines inside an action; the 1-based line of body line `i`. */
function fixture(imports: string[], body: string[]): { files: Files; line: (i: number) => number } {
  const head = [
    `import { reveal } from "@keel/schema"`,
    `import { hash } from "./hash.ts"`,
    ...imports,
    `export async function pay(ctx, p) {`,
  ];
  const source = `${[...head, ...body.map((l) => `  ${l}`), "}"].join("\n")}\n`;
  return { files: [MANIFEST, JOBS, { path: PATH, source }], line: (i) => head.length + 1 + i };
}
const NAMED = [`import { jobs } from "./jobs.server.ts"`];

test("`jobs.enqueue(ctx, 'orders.mail', { t: reveal(p.k) })`, with `jobs` imported from `./jobs.server.ts`, is one E2506", () => {
  fc.assert(
    fc.property(key, fc.integer({ min: 0, max: 3 }), (k, pad) => {
      const body = [
        ...Array.from({ length: pad }, () => "const unused = 1"),
        `await jobs.enqueue(ctx, 'orders.mail', { t: reveal(p.${k}) })`,
      ];
      const f = fixture(NAMED, body);
      const ds = found(f.files);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.path).toBe(PATH);
      expect(ds[0]?.line).toBe(f.line(pad));
      expect(ds[0]?.fix).toBeUndefined();
    }),
    { seed: 1337, numRuns: 20 },
  );
}, 30_000);

test("the same through a `const` of the file bound to `queue(...)` is one E2506", () => {
  const f = fixture(
    [`import { queue } from "@keel/std-jobs"`, `import { mail } from "./mail.server.ts"`],
    [`const q = queue({ "orders.mail": mail })`, `await q.enqueue(ctx, 'orders.mail', { t: reveal(p.k) })`],
  );
  const ds = found(f.files);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.line).toBe(f.line(1));
}, 30_000);

test("`{ key: reveal(p.k) }` as the fourth argument is one E2506", () => {
  const f = fixture(NAMED, [`await jobs.enqueue(ctx, 'orders.mail', { t: 1 }, { key: reveal(p.k) })`]);
  const ds = found(f.files);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.line).toBe(f.line(0));
}, 30_000);

test("`<q>` as a name imported from a path ending `jobs.server` with `.ts`, `.js` or no extension, or `<ns>.<name>` of a namespace import, is one E2506", () => {
  const call = `await jobs.enqueue(ctx, 'orders.mail', { t: reveal(p.k) })`;
  for (const spec of ["./jobs.server.ts", "./jobs.server.js", "./jobs.server", "../orders/jobs.server.ts"]) {
    expect(found(fixture([`import { jobs } from "${spec}"`], [call]).files), spec).toHaveLength(1);
  }
  const ns = fixture(
    [`import * as J from "./jobs.server.ts"`],
    [`await J.jobs.enqueue(ctx, 'orders.mail', { t: reveal(p.k) })`],
  );
  expect(found(ns.files)).toHaveLength(1);
}, 30_000);

test("`{ t: hash(reveal(p.k)) }` is no E2506", () => {
  fc.assert(
    fc.property(key, (k) => {
      const f = fixture(NAMED, [`await jobs.enqueue(ctx, 'orders.mail', { t: hash(reveal(p.${k})) })`]);
      expect(found(f.files)).toHaveLength(0);
    }),
    { seed: 1337, numRuns: 20 },
  );
}, 30_000);

test("`enqueue` on a name imported from `./mail.ts` is no E2506", () => {
  const f = fixture(
    [`import { jobs } from "./mail.ts"`],
    [`await jobs.enqueue(ctx, 'orders.mail', { t: reveal(p.k) })`],
  );
  expect(found(f.files)).toHaveLength(0);
}, 30_000);

test("E2506 does not see `enqueue` taken off the queue into a local, its `.call` or `.apply`, or a helper that enqueues", () => {
  const cases = [
    [`const e = jobs.enqueue`, `await e(ctx, 'orders.mail', { t: reveal(p.k) })`],
    [`await jobs.enqueue.call(jobs, ctx, 'orders.mail', { t: reveal(p.k) })`],
    [`await jobs.enqueue.apply(jobs, [ctx, 'orders.mail', { t: reveal(p.k) }])`],
    [`await send(ctx, reveal(p.k))`],
  ];
  for (const body of cases) expect(found(fixture(NAMED, body).files), body.join(" ")).toHaveLength(0);
}, 30_000);

test("an argument that is a parameter, not a revealed value, is no E2506", () => {
  const f = fixture(NAMED, [`await jobs.enqueue(ctx, 'orders.mail', { t: p.k }, { key: p.id })`]);
  expect(found(f.files)).toHaveLength(0);
}, 30_000);
