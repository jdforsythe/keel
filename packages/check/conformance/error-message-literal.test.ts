// Spec: k.expect, clause "There, `` E.make({}, `user ${email}`) ``, `E.make({}, text)` with `text` a `const` and `E.causedBy(c, {}, 'a' + b)` are one E1460 each at the message argument, message `error message is not a literal: pass values as data`; `E.make({}, 'sign in')` and `` E.make({}, `sign in`) `` are none."
// Seed 1337. Fixture source text, type pass on.
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import { manifestFile } from "./module-support.ts";

const M = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const HEAD =
  "import { s } from '@keel/schema'\nimport type { KeelError } from '@keel/schema'\nconst E = s.error('m.t', s.object({}))\nconst text = 'sign in'\ndeclare const email: string\ndeclare const b: string\ndeclare const c: KeelError<'m.c', null>\n";
const MESSAGE = "error message is not a literal: pass values as data";
const PREFIX = "export const r0 = ";

const e1460 = (form: string) => {
  const source = `${HEAD}${PREFIX}${form}\n`;
  const ds = check([M, { path: "modules/m/a.ts", source }], { types: true }).diagnostics.filter(
    (d) => d.path === "modules/m/a.ts" && d.code === "E1460",
  );
  return ds;
};

describe("k.expect Message: a make or causedBy message is a literal", { timeout: testTime(120_000) }, () => {
  const BAD: readonly (readonly [string, string])[] = [
    ["E.make({}, `user ${email}`)", "`user ${email}`"],
    ["E.make({}, text)", "text)"],
    ["E.causedBy(c, {}, 'a' + b)", "'a' + b"],
  ];
  for (const [form, arg] of BAD) {
    it(`\`${form}\` is one E1460 at the message argument, message \`${MESSAGE}\`, with no fix`, () => {
      const ds = e1460(form);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toBe(MESSAGE);
      expect(ds[0]?.fix).toBeUndefined();
      expect(ds[0]?.col).toBe(PREFIX.length + form.indexOf(arg) + 1);
    });
  }
  for (const form of ["E.make({}, 'sign in')", "E.make({}, `sign in`)", "E.causedBy(c, {}, 'sign in')"]) {
    it(`\`${form}\` is no E1460`, () => {
      expect(e1460(form)).toEqual([]);
    });
  }
});
