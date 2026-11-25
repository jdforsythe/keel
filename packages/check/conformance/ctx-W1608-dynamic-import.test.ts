// Seed 1337 (every property below). Fixtures are source text over in-memory file maps, `{ types: false }`: check may not
// import a std package, so `@keel/std-messages` appears only as fixture text.
// k.ctx, Rules "W1608 an `import()` expression in app code, at `import`, whatever its specifier (a literal, a template, any expression) and however its result is used (`await`, `.then`, discarded): a module load is I/O no ctx owns, so a `simulate` run (k.sim) neither waits for it nor orders it by seed. Not reported: an `import()` that is E1603; a `Host`'s `code` written as its prop value in E1824's form, `() => import('<path>').then((m) => m.<export>)` (the harness never runs it, k.host-element); a message set's `load`, the arrow function whose body is the `import()`, written as the third argument of a call whose callee is the `messages` import of `@keel/std-messages` (E2401 fixes its form). Test code is not app code, so the harness's `routes: () => import(path)` (k.testing) is not judged; a type (`typeof import('./a.ts')`) holds no `import()` expression. W1608 is a warning: it never fails `keel check` (k.check Diagnostics). No fix."
// Spec: k.ctx, clause "In `modules/m/a.ts`, `import('./b.ts')`, `` import(`./${n}.ts`) ``, `import(name)`, `await import('./b.ts')`, `void import('./b.ts')` and `import('./b.ts').then((m) => m.b)` are each one W1608, at `import`; `import { b } from './b.ts'`, `export { b } from './b.ts'` and `type B = typeof import('./b.ts')` are none."
// Spec: k.ctx, clause "`import('data:text/javascript,' + s)` in `modules/m/a.ts` is one E1603 and no W1608; `import('./b.ts')` in `modules/m/a.test.ts`, in `test/h.ts` and in `vite.config.ts` is no W1608."
// Spec: k.ctx, clause "In `modules/m/C.tsx`, a `Host` imported from `@keel/ui` with `code={() => import('./c.ts').then((m) => m.c)}` gives no W1608; with `code={load}` after `const load = () => import('./c.ts').then((m) => m.c)` it gives one W1608, at that `import`."
// Spec: k.ctx, clause "In `modules/m/MText.schema.ts`, ``messages(Locale, keys, (locale) => import(`./MText/${locale}.ts`))`` with `messages` imported from `@keel/std-messages` gives no W1608; the same call with `messages` declared in the file, or with that arrow function held in a `const` passed as the third argument, gives one W1608."
// Spec: k.ctx, clause "In `modules/m/unsafe/a.ts`, `import('./b.ts')` inside the arrow function given to `unsafe('r', () => ...)` is no W1608, and inside a function declared at that file's top level is one W1608."
// k.check, App code "The rules "in app code" read a project's code files (`.d.ts` aside) that are not test code (`*.test.*`, `*.spec.*`, or under `test/`, `tests/`, `conformance/` or `__tests__/`), not `*.config.*` and not under `.keel/` or `node_modules/`. A file under `unsafe/` is app code but for its lifted ranges. A lifted range is the arrow function or function expression written as the second argument of an `unsafe(` call (callee the identifier `unsafe`) whose first argument is a justification string, a string literal or a template without substitutions holding a non-space character, in a file under `unsafe/`: the function from its first character to its last, parameters, return type, comments and nested functions included. A second argument of another form (a name, a call), a call without a justification string (E1754) and a call in a file outside `unsafe/` give no range. Inside a lifted range E1252, E1451, E1452, E1601, E1603, E1651, E1757, E1758, E1759 and W1608 are not reported; every other code reads the range as it reads the rest of the file. Outside its lifted ranges an `unsafe/` file's imports, type declarations, signatures and helpers are checked as `modules/<id>/a.ts` is. A cast, `!` or suppression is written inside the function; a type that holds `any` is declared there too (`() => { type L = Chart<any>; return c as L }`), and a signature takes `unknown` or a type parameter. A stdlib rule that reads app code reads an `unsafe/` file whole: `unsafe` lifts the kernel codes above only."
// Not asserted from spec text: the message is the RFC 0220 text (the spec does not print it).
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";

const MESSAGE = "import() in app code is a load simulate does not track; use a static import";
const U = "unsafe"; // built so this file's own source holds no literal call
const HELPER = `function ${U}<T>(reason: string, fn: () => T): T { return fn() }\n`;
const DECLS = "declare const n: string\ndeclare const name: string\ndeclare const s: string\n";

const w = (source: string, path = "modules/m/a.ts") =>
  check([{ path, source }], { types: false }).diagnostics.filter((d) => d.code === "W1608");
const codes = (source: string, path = "modules/m/a.ts") =>
  check([{ path, source }], { types: false }).diagnostics.map((d) => d.code);
const at = (source: string, needle: string) => {
  const i = source.indexOf(needle);
  const before = source.slice(0, i).split("\n");
  return { line: before.length, col: (before.at(-1)?.length ?? 0) + 1 };
};

// ---- Conformance #16 ----

const FORMS: readonly string[] = [
  "import('./b.ts')",
  "import(`./${n}.ts`)",
  "import(name)",
  "await import('./b.ts')",
  "void import('./b.ts')",
  "import('./b.ts').then((m) => m.b)",
];
for (const expr of FORMS) {
  test(`In \`modules/m/a.ts\`, \`${expr}\` is one W1608, at \`import\``, () => {
    const src = `${DECLS}export const a = async () => {\n  ${expr}\n}\n`;
    const found = w(src);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: "W1608", path: "modules/m/a.ts", ...at(src, "import(") });
  });
}

test("W1608 reads as the exact message, carries no fix, and is a W code", () => {
  const found = w(`export const a = () => import('./b.ts')\n`);
  expect(found).toHaveLength(1);
  expect(found[0]?.message).toBe(MESSAGE);
  expect(found[0]?.message.length).toBeLessThan(90);
  expect(found[0]?.fix).toBeUndefined();
  expect(found[0]?.see).toBe("k.ctx");
});

test("`import { b } from './b.ts'`, `export { b } from './b.ts'` and `type B = typeof import('./b.ts')` are none (and `import type`)", () => {
  for (const src of [
    "import { b } from './b.ts'\nexport const a = b\n",
    "export { b } from './b.ts'\n",
    "export type B = typeof import('./b.ts')\n",
    "import type { B } from './b.ts'\nexport type A = B\n",
  ]) {
    expect(w(src)).toEqual([]);
  }
});

test("property: for any specifier form and any use of the result, an `import()` is one W1608, at `import`", () => {
  const specifier = fc.constantFrom(
    "'./b.ts'",
    '"./b.ts"',
    "`./b.ts`",
    "`./${n}.ts`",
    "name",
    "'./' + n",
    "n.toLowerCase()",
    "(n ? './a.ts' : './b.ts')",
    "'https://example.com/b.js'",
  );
  const use = fc.constantFrom(
    (e: string) => `await ${e}`,
    (e: string) => `void ${e}`,
    (e: string) => `${e}.then((m) => m)`,
    (e: string) => `${e}.catch(() => undefined)`,
    (e: string) => `const x = ${e}; return x`,
    (e: string) => `return ${e}`,
    (e: string) => e,
  );
  fc.assert(
    fc.property(specifier, use, fc.integer({ min: 0, max: 6 }), (spec, u, pad) => {
      const src = `${DECLS}export const a = async () => {\n${" ".repeat(pad)}${u(`import(${spec})`)}\n}\n`;
      const found = w(src);
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject(at(src, "import("));
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("one W1608 per `import()` expression, a nested one included", () => {
  const src = `export const a = () => import('./a.ts').then(() => import('./b.ts'))\n`;
  const found = w(src);
  expect(found).toHaveLength(2);
  expect(found.map((d) => d.col).sort((p, q) => p - q)).toEqual([
    src.indexOf("import('./a") + 1,
    src.indexOf("import('./b") + 1,
  ]);
});

// ---- Conformance #17 ----

test("`import('data:text/javascript,' + s)` in `modules/m/a.ts` is one E1603 and no W1608", () => {
  const src = `${DECLS}export const a = () => import('data:text/javascript,' + s)\n`;
  const cs = codes(src);
  expect(cs.filter((c) => c === "E1603")).toHaveLength(1);
  expect(cs.filter((c) => c === "W1608")).toEqual([]);
});

test("a `blob:` or `data:` URL `import()` is E1603 only, for any suffix", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("data:text/javascript,", "blob:https://x/", "DATA:,"),
      fc.stringMatching(/^[a-z]{0,8}$/),
      (p, rest) => {
        const cs = codes(`export const a = () => import('${p}${rest}')\n`);
        expect(cs.filter((c) => c === "E1603")).toHaveLength(1);
        expect(cs.filter((c) => c === "W1608")).toEqual([]);
      },
    ),
    { seed: SEED, numRuns: 30 },
  );
});

test("`import('./b.ts')` in `modules/m/a.test.ts`, in `test/h.ts` and in `vite.config.ts` is no W1608", () => {
  const src = "export const a = () => import('./b.ts')\n";
  for (const path of ["modules/m/a.test.ts", "test/h.ts", "vite.config.ts"]) expect(w(src, path)).toEqual([]);
});

test("property: test code, tool configs, `.keel/` and `node_modules/` files are not judged, any other code file is", () => {
  const not = fc.constantFrom(
    "modules/m/a.test.ts",
    "modules/m/a.spec.tsx",
    "modules/m/test/h.ts",
    "test/h.ts",
    "tests/h.ts",
    "conformance/h.ts",
    "modules/m/__tests__/h.ts",
    "vite.config.ts",
    "modules/m/a.config.ts",
    ".keel/a.ts",
    "node_modules/p/a.ts",
  );
  const judged = fc.constantFrom("modules/m/a.ts", "modules/m/B.tsx", "src/a.ts", "modules/m/a.mts");
  const src = "export const a = () => import('./b.ts')\n";
  fc.assert(
    fc.property(not, judged, (p, q) => {
      expect(w(src, p)).toEqual([]);
      expect(w(src, q)).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

// ---- Conformance #18 ----

const HOST = "import { Host } from '@keel/ui'\n";

test("In `modules/m/C.tsx`, a `Host` imported from `@keel/ui` with `code={() => import('./c.ts').then((m) => m.c)}` gives no W1608", () => {
  const src = `${HOST}export default function C() { return <Host code={() => import('./c.ts').then((m) => m.c)} /> }\n`;
  expect(w(src, "modules/m/C.tsx")).toEqual([]);
});

test("a `Host` with `code={load}` after `const load = () => import('./c.ts').then((m) => m.c)` gives one W1608, at that `import`", () => {
  const src = `${HOST}const load = () => import('./c.ts').then((m) => m.c)\nexport default function C() { return <Host code={load} /> }\n`;
  const found = w(src, "modules/m/C.tsx");
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject(at(src, "import("));
});

test("property: a `Host`'s `code` in E1824's form gives no W1608 for any path and export, held in a `const` it gives one", () => {
  const seg = fc.stringMatching(/^[a-z]{1,8}$/);
  fc.assert(
    fc.property(seg, seg, (file, exp) => {
      const arrow = `() => import('./${file}.ts').then((m) => m.${exp})`;
      const direct = `${HOST}export default function C() { return <Host code={${arrow}} /> }\n`;
      expect(w(direct, "modules/m/C.tsx")).toEqual([]);
      const held = `${HOST}const load = ${arrow}\nexport default function C() { return <Host code={load} /> }\n`;
      expect(w(held, "modules/m/C.tsx")).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

// ---- Conformance #19 ----

const MSG = "import { messages } from '@keel/std-messages'\nimport { Locale, keys } from './locale.ts'\n";
const LOAD = "(locale) => import(`./MText/${locale}.ts`)";
const MPATH = "modules/m/MText.schema.ts";

test("In `modules/m/MText.schema.ts`, `messages(Locale, keys, (locale) => import(`./MText/${locale}.ts`))` with `messages` imported from `@keel/std-messages` gives no W1608", () => {
  expect(w(`${MSG}export const MText = messages(Locale, keys, ${LOAD})\n`, MPATH)).toEqual([]);
});

test("the same call with `messages` declared in the file gives one W1608", () => {
  const src = `import { Locale, keys } from './locale.ts'\ndeclare function messages(...a: unknown[]): unknown\nexport const MText = messages(Locale, keys, ${LOAD})\n`;
  const found = w(src, MPATH);
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject(at(src, "import(`"));
  const local = `import { Locale, keys } from './locale.ts'\nconst messages = (...a: unknown[]) => a\nexport const MText = messages(Locale, keys, ${LOAD})\n`;
  expect(w(local, MPATH)).toHaveLength(1);
});

test("the same call with the arrow function held in a `const` passed as the third argument gives one W1608", () => {
  const src = `${MSG}const load = ${LOAD}\nexport const MText = messages(Locale, keys, load)\n`;
  const found = w(src, MPATH);
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject(at(src, "import(`"));
});

test("property: the third argument of `messages` from `@keel/std-messages` is not reported for any set name, an `import()` elsewhere in the call is", () => {
  const name = fc.stringMatching(/^[A-Z][a-z]{2,8}$/);
  fc.assert(
    fc.property(name, (n) => {
      const load = `(locale) => import(\`./${n}/\${locale}.ts\`)`;
      expect(
        w(`${MSG}export const ${n}Text = messages(Locale, keys, ${load})\n`, `modules/m/${n}Text.schema.ts`),
      ).toEqual([]);
      const second = `${MSG}export const ${n}Text = messages(Locale, import('./k.ts'), ${load})\n`;
      expect(w(second, `modules/m/${n}Text.schema.ts`)).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

// ---- Conformance #20 ----

test("In `modules/m/unsafe/a.ts`, `import('./b.ts')` inside the arrow function given to `unsafe('r', () => ...)` is no W1608", () => {
  const src = `${HELPER}export const a = ${U}('r', () => import('./b.ts'))\n`;
  expect(w(src, "modules/m/unsafe/a.ts")).toEqual([]);
});

test("`import('./b.ts')` inside a function declared at that file's top level is one W1608", () => {
  const src = `${HELPER}export function a() { return import('./b.ts') }\n`;
  const found = w(src, "modules/m/unsafe/a.ts");
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject(at(src, "import("));
});

test("property: an `import()` is lifted exactly inside the function given to a justified `unsafe(` call, in an `unsafe/` file", () => {
  const reason = fc.stringMatching(/^[a-z][a-z ]{2,16}$/);
  fc.assert(
    fc.property(reason, (why) => {
      const inside = `${HELPER}export const a = ${U}('${why}', () => { void import('./b.ts') })\n`;
      expect(w(inside, "modules/m/unsafe/a.ts")).toEqual([]);
      const blank = `${HELPER}export const a = ${U}('', () => { void import('./b.ts') })\n`;
      expect(w(blank, "modules/m/unsafe/a.ts")).toHaveLength(1);
      const outsideDir = `${HELPER}export const a = ${U}('${why}', () => { void import('./b.ts') })\n`;
      expect(w(outsideDir, "modules/m/a.ts")).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 30 },
  );
});
