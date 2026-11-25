// Spec: k.privacy-reads, Factories "A call of a package's export, by name or as a namespace member, other than `@keel/schema`'s own constructors, is read through the package's source when `keel check` resolves the specifier, as k.bundle Aliases does, to a `.ts` or `.tsx` file that is not a declaration file (a workspace package's `exports` give one; a package that ships only built code and types gives none): its arguments are read at the call, and each expression the function returns is read in the package's files, a parameter standing for its argument, the body's top-level `const`s and the package's own functions followed, eight calls deep at most. What it cannot read there makes the call `'unknown'`."
// Spec: k.leave, E1107 "The check judges each `store` call of `@keel/store`, under any local name, as a namespace member, through a `const` alias or a project re-export, in a client-reachable file (k.boundary Reach) of a `node` or `static` module, or in a file outside every module that such a module's file imports, directly or not (k.boundary Following). It reports E1107 at the call when the state schema holds a `.pii(class)` node of a class the module manifest's `clientPii` (a list of `PiiClass`, default empty) does not list, for a file outside every module the `clientPii` of each module whose files import it: `store state reaching #k-state holds .pii('<classes>'), not in clientPii`, the classes cut to fit 89 units; the fix adds the classes, none when more than one manifest lacks them. Also E1107, no fix, in such a file: a state schema the static read (k.privacy-reads) answers `'unknown'` for, a `.pii()` whose class is not a string literal among them, `store state not readable at <part>; cannot show its .pii() classes`, `<part>` the first part of the file the read could not take (a call as its callee and `()`), cut from its front to fit 89 units; a call of `stores()`, by which an island root puts every live request store, a loader's among them, in `#k-state`, `stores() in client code can send every request store to #k-state`; and `store` or `stores` of `@keel/store` used other than as a callee or through an alias above (passed as a value, destructured from a namespace, a computed member), `<name> of @keel/store used other than as a call; check cannot follow it`. A file of a module only `client` deployables list writes no `#k-state` and is not judged; a store a package creates is the package's."
// Spec: k.leave, Conformance "In `modules/a/Page.tsx` of a `node` module with no `clientPii`, `store(s.object({ v: line({ max: 40 }) }), …)` with `line` from `@keel/std-text`, and `store(tablePage(s.object({ n: s.string() })), …)` with `tablePage` from `@keel/std-tables`, report no E1107 (k.privacy-reads Factories); `store(tablePage(s.object({ e: s.string().pii('contact') })), …)` is one E1107 whose fix adds `'contact'`."
// Seed 1337. The real `@keel/std-text` and `@keel/std-tables` sources are linked into a temporary project's `node_modules` (a path on disk, no import of a std package, as the kernel's dependency order requires); the fixture is source text.
// Reading: the spec's E1107 and Factories paragraphs say a call of a package export is read through its source and a schema with no `.pii()` node is clean; a std schema factory (`line({ max: 40 })`, `tablePage(row)`) in a client store is therefore clean, and `tablePage` of a marked row names the row's class (the row is an argument, read at the call).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { applyFix } from "./E1258-support.ts";
import { CLASSES, e1107In, holds, pageFiles, workspacePackage } from "./factories-support.ts";
import { SEED } from "./support.ts";

const LINKS = {
  "node_modules/@keel/std-text": workspacePackage("std-text"),
  "node_modules/@keel/std-tables": workspacePackage("std-tables"),
  "node_modules/@keel/std-i18n": workspacePackage("std-i18n"),
  "node_modules/@keel/schema": workspacePackage("schema"),
};

describe("k.leave E1107 with k.privacy-reads Factories: a std schema factory in a client store", () => {
  test("`line({ max: 40 })` in a client store's state is clean, alone and among other fields", () => {
    const head = "import { line, para } from '@keel/std-text'";
    for (const expr of [
      "line({ max: 40 })",
      "s.object({ title: line({ max: 40 }) })",
      "s.object({ title: line({ max: 40 }), notes: para({ max: 2000 }).optional(), n: s.int() })",
    ]) {
      expect(e1107In(pageFiles(head, expr), {}, {}, LINKS), expr).toEqual([]);
    }
  });

  test("property: a `line` or `para` with any bounds beside a marked field is E1107 for the marked class only", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), fc.constantFrom(...CLASSES), (max, c) => {
        const head = "import { line } from '@keel/std-text'";
        const expr = `s.object({ t: line({ max: ${max} }), e: s.string().pii('${c}') })`;
        const ds = e1107In(pageFiles(head, expr), {}, {}, LINKS);
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message).toBe(holds(c));
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test("`tablePage(row)` of `@keel/std-tables` in a client store is clean for a row with no `.pii()` and names the class of a marked row", () => {
    const head = "import { tablePage } from '@keel/std-tables'";
    expect(e1107In(pageFiles(head, "tablePage(s.object({ id: s.string(), n: s.int() }))"), {}, {}, LINKS)).toEqual([]);
    const ds = e1107In(pageFiles(head, "tablePage(s.object({ e: s.string().pii('contact') }))"), {}, {}, LINKS);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(holds("contact"));
  });

  test("In `modules/a/Page.tsx` of a `node` module with no `clientPii`, `store(s.object({ v: line({ max: 40 }) }), …)` with `line` from `@keel/std-text`, and `store(tablePage(s.object({ n: s.string() })), …)` with `tablePage` from `@keel/std-tables`, report no E1107 (k.privacy-reads Factories); `store(tablePage(s.object({ e: s.string().pii('contact') })), …)` is one E1107 whose fix adds `'contact'`.", () => {
    const text = "import { line } from '@keel/std-text'";
    const table = "import { tablePage } from '@keel/std-tables'";
    expect(e1107In(pageFiles(text, "s.object({ v: line({ max: 40 }) })"), {}, {}, LINKS)).toEqual([]);
    expect(e1107In(pageFiles(table, "tablePage(s.object({ n: s.string() }))"), {}, {}, LINKS)).toEqual([]);
    const files = pageFiles(table, "tablePage(s.object({ e: s.string().pii('contact') }))");
    const ds = e1107In(files, {}, {}, LINKS);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("modules/a/Page.tsx");
    expect(ds[0]?.message).toBe(holds("contact"));
    const fix = ds[0]?.fix;
    expect(typeof fix).toBe("string");
    if (fix === undefined) return;
    const patched = applyFix(files, fix);
    expect(patched.find((x) => x.path === "modules/a/module.ts")?.source).toContain("clientPii: ['contact']");
    expect(e1107In(patched, {}, {}, LINKS)).toEqual([]);
  });
});
