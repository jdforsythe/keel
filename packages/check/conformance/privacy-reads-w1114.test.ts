// k.privacy-reads, Rules "W1114 a password control bound to a field whose schema node is not `s.secret` (no fix)."
// k.privacy-reads, Password controls "W1114 is an `Input` (`@keel/ui`, JSX or a call with an object literal) with a literal `type` `password`, or a literal `autocomplete` holding the token `current-password` or `new-password`, whose `field` is `f.field('<path>')`, `f` a `const` of the file bound to a `form(<schema>, …)` call (`@keel/forms`), where the schema, followed as `schemaHolds` follows it and walked one path segment at a time through `s.object` fields, ends at a call `s.<name>(…)` of `@keel/schema` other than `s.secret`. Trailing method calls (`.optional()`, `.pii()`) are passed over at each step."
// k.privacy-reads, Password controls "Not reported: a step it cannot follow, a numeric segment, a computed path or `type`, and a `field` held in a variable."
// Spec: k.privacy-reads, clause "`<Input type=\"password\" field={f.field('pw')} label=\"P\" />` with `pw: s.string()` is one W1114, as are `autocomplete=\"new-password\"` without `type`, the schema imported from a `*.schema.ts`, and a nested path `a.pw`; `pw: s.secret(s.string()).optional()`, `f.field(p)`, `pw: make()` and `type={t}` are none."
// Seed: 1337.
// Not yet built: `test.skip` until `check()` reports W1114; remove the `.skip` in the build that adds it.
// Assumption: a finding is asserted by code, path and the line of the `Input` it stands at; the spec gives no column. No fix.
// Assumption: the second argument of `form` is `{}`; the rule reads only the first.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";

type Files = Parameters<typeof check>[0];
const PATH = "modules/a/Login.tsx";
const HEAD = `import { Input } from "@keel/ui"\nimport { form } from "@keel/forms"\nimport { s } from "@keel/schema"\nimport { Login } from "./login.schema.ts"\n`;
const SCHEMA_FILE = {
  path: "modules/a/login.schema.ts",
  source: `import { s } from "@keel/schema"\nexport const Login = s.object({ pw: s.string() })\n`,
};
/** A project whose `Login.tsx` binds `f` to `form(<schema>, {})` and holds `body` after it; the 1-based line of `body[0]` is 8. */
function project(schema: string, body: string[]): Files {
  const source = `${HEAD}const f = form(${schema}, {})\nconst p = "pw"\nconst t = "password"\n${body.join("\n")}\n`;
  return [{ path: PATH, source }, SCHEMA_FILE];
}
const BODY_LINE = 8;
const w1114 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "W1114");
const PLAIN = "s.object({ pw: s.string() })";
const jsx = (attrs: string) => `export const V = () => <Input ${attrs} label="P" />`;
const key = fc.stringMatching(/^[a-z]{1,8}$/);

test('`<Input type="password" field={f.field(\'pw\')} label="P" />` with `pw: s.string()` is one W1114', () => {
  fc.assert(
    fc.property(key, (k) => {
      const ds = w1114(project(`s.object({ ${k}: s.string() })`, [jsx(`type="password" field={f.field('${k}')}`)]));
      expect(ds).toHaveLength(1);
      expect(ds[0]?.path).toBe(PATH);
      expect(ds[0]?.line).toBe(BODY_LINE);
      expect(ds[0]?.fix).toBeUndefined();
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test('`autocomplete="new-password"` without `type`, and `current-password`, is one W1114', () => {
  for (const ac of ["new-password", "current-password", "section-a current-password"]) {
    expect(w1114(project(PLAIN, [jsx(`autocomplete="${ac}" field={f.field('pw')}`)]))).toHaveLength(1);
  }
});

test("a call `Input({ type: 'password', field: f.field('pw'), label: 'P' })` with an object literal is one W1114", () => {
  const ds = w1114(project(PLAIN, [`export const V = Input({ type: "password", field: f.field("pw"), label: "P" })`]));
  expect(ds).toHaveLength(1);
});

test("W1114 reads the schema imported from a `*.schema.ts`", () => {
  expect(w1114(project("Login", [jsx(`type="password" field={f.field('pw')}`)]))).toHaveLength(1);
});

test("W1114 reads a nested path `a.pw` and passes over trailing `.optional()` and `.pii()`", () => {
  const nested = "s.object({ a: s.object({ pw: s.string() }).optional() })";
  expect(w1114(project(nested, [jsx(`type="password" field={f.field('a.pw')}`)]))).toHaveLength(1);
  const pii = "s.object({ pw: s.string().pii().optional() })";
  expect(w1114(project(pii, [jsx(`type="password" field={f.field('pw')}`)]))).toHaveLength(1);
});

test("W1114 is none for `pw: s.secret(s.string()).optional()`", () => {
  fc.assert(
    fc.property(key, (k) => {
      const schema = `s.object({ ${k}: s.secret(s.string()).optional() })`;
      expect(w1114(project(schema, [jsx(`type="password" field={f.field('${k}')}`)]))).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("W1114 is none for `f.field(p)`, `pw: make()`, `type={t}`, a numeric segment, a computed path and a `field` held in a variable", () => {
  const none = (schema: string, body: string[]) => expect(w1114(project(schema, body))).toHaveLength(0);
  none(PLAIN, [jsx(`type="password" field={f.field(p)}`)]);
  none("s.object({ pw: make() })", [jsx(`type="password" field={f.field('pw')}`)]);
  none(PLAIN, [jsx(`type={t} field={f.field('pw')}`)]);
  none("s.object({ pw: s.array(s.string()) })", [jsx(`type="password" field={f.field('pw.0')}`)]);
  none(PLAIN, [jsx('type="password" field={f.field(`pw`)}'), jsx(`type="password" field={f.field("p" + "w")}`)]);
  none(PLAIN, [`const fld = f.field('pw')`, jsx(`type="password" field={fld}`)]);
});

test("W1114 is none for an `Input` of another type with no password autocomplete", () => {
  for (const attrs of [`type="text" field={f.field('pw')}`, `autocomplete="off" field={f.field('pw')}`]) {
    expect(w1114(project(PLAIN, [jsx(attrs)]))).toHaveLength(0);
  }
});
