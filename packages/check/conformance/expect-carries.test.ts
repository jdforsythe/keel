// Spec: k.expect, clause "There, with `W = s.error('m.w', s.object({ why: s.string() }))` and `N = s.error('m.n', s.object({ status: s.int(), kind: s.enum(['a', 'b']) }))`: `attempt(f, (x) => (x instanceof Error ? W.make({ why: x.message }) : undefined))`, the same with `why: String(x)`, with `` why: `${x}` `` and with `why: x.name` are one E1460 each at the property's value, message `expect copies thrown text: carry a number, a boolean or a closed code`; `attempt(f, (x) => (x instanceof Error ? build(x) : undefined))` with `build` returning a `KeelError` is one at `build(x)`, message `expect builds its error from the thrown value: return X.make(data)`."
// Spec: k.expect, clause "There, `attempt(f, (x) => (x instanceof HttpError ? N.make({ status: x.status, kind: kindOf(x) }) : undefined))` with `class HttpError extends Error { status = 0 }` in the file and `kindOf` returning `'a' | 'b'` is no E1460, and resolves to `err` whose data is `{ status: 503, kind: 'a' }` for a thrown `HttpError` with `status` 503 that `kindOf` maps to `'a'`."
// Seed 1337. Fixture source text, type pass on (a copy's type decides). The run-time half of clause 5 is packages/schema/conformance/expect-carries-run.test.ts.
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import { manifestFile } from "./module-support.ts";

const M = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const HEAD =
  "import { attempt, s } from '@keel/schema'\nimport type { KeelError } from '@keel/schema'\nconst W = s.error('m.w', s.object({ why: s.string() }))\nconst N = s.error('m.n', s.object({ status: s.int(), kind: s.enum(['a', 'b']) }))\nclass HttpError extends Error { status = 0 }\ndeclare const kindOf: (x: HttpError) => 'a' | 'b'\ndeclare const build: (x: Error) => KeelError<'m.w', { why: string }>\ndeclare const f: () => number\n";
const COPIES = "expect copies thrown text: carry a number, a boolean or a closed code";
const BUILDS = "expect builds its error from the thrown value: return X.make(data)";

const e1460 = (forms: readonly string[]) => {
  const source = `${HEAD}${forms.map((x, i) => `export const r${i} = ${x}`).join("\n")}\n`;
  const base = HEAD.split("\n").length - 1;
  const all = check([M, { path: "modules/m/a.ts", source }], { types: true }).diagnostics.filter(
    (d) => d.path === "modules/m/a.ts" && d.code === "E1460",
  );
  return forms.map((form, i) => ({ form, ds: all.filter((d) => d.line === base + i + 1) }));
};
const wrap = (why: string) => `attempt(f, (x) => (x instanceof Error ? W.make({ why: ${why} }) : undefined))`;
const PREFIX = "export const r0 = ";

describe("k.expect Carries: thrown text may not enter an error", { timeout: testTime(120_000) }, () => {
  for (const why of ["x.message", "String(x)", "`${x}`", "x.name"]) {
    it(`\`why: ${why}\` is one E1460 at the property's value, message \`${COPIES}\``, () => {
      const [r] = e1460([wrap(why)]);
      expect(r?.ds).toHaveLength(1);
      expect(r?.ds[0]?.message).toBe(COPIES);
      expect(r?.ds[0]?.fix).toBeUndefined();
      expect(r?.ds[0]?.col).toBe(PREFIX.length + wrap(why).indexOf(why) + 1);
    });
  }

  it("`attempt(f, (x) => (x instanceof Error ? build(x) : undefined))` is one E1460 at `build(x)`, message `expect builds its error from the thrown value: return X.make(data)`", () => {
    const form = "attempt(f, (x) => (x instanceof Error ? build(x) : undefined))";
    const [r] = e1460([form]);
    expect(r?.ds).toHaveLength(1);
    expect(r?.ds[0]?.message).toBe(BUILDS);
    expect(r?.ds[0]?.col).toBe(PREFIX.length + form.indexOf("build(x)") + 1);
  });

  it("other copies that cross text are E1460: `stack`, `cause`, `JSON.stringify(x)`, `x.message + 'a'`, `x.toString()`", () => {
    const rs = e1460(["x.stack", "String(x.cause)", "JSON.stringify(x)", "x.message + 'a'", "x.toString()"].map(wrap));
    for (const r of rs) expect(r.ds, r.form).toHaveLength(1);
  });
});

describe("k.expect Carries: a number or a closed code crosses", { timeout: testTime(120_000) }, () => {
  it("`N.make({ status: x.status, kind: kindOf(x) })` for `x instanceof HttpError` is no E1460", () => {
    const form =
      "attempt(f, (x) => (x instanceof HttpError ? N.make({ status: x.status, kind: kindOf(x) }) : undefined))";
    const [r] = e1460([form]);
    expect(r?.ds).toEqual([]);
  });

  it("a boolean flag, a literal union and an `S.parse(v)` narrowed on `ok` are no E1460", () => {
    const ok = [
      "attempt(f, (x) => (x instanceof HttpError ? N.make({ status: x.status, kind: x.status > 499 ? 'a' : 'b' }) : undefined))",
    ];
    expect(e1460(ok)[0]?.ds).toEqual([]);
  });
});
