// Spec: k.privacy-reads, Factories "A call of a package's export, by name or as a namespace member, other than `@keel/schema`'s own constructors, is read through the package's source when `keel check` resolves the specifier, as k.bundle Aliases does, to a `.ts` or `.tsx` file that is not a declaration file (a workspace package's `exports` give one; a package that ships only built code and types gives none): its arguments are read at the call, and each expression the function returns is read in the package's files, a parameter standing for its argument, the body's top-level `const`s and the package's own functions followed. At most eight package functions are read on one path, the project's own call not counted (a chain of eight is read, a ninth is not), and a function met again while its read is open (recursion, direct or mutual) is not read again. What it does not finish there, a function past the bound or met again among it, makes the call `'unknown'`."
// Spec: k.leave, E1107 "The check judges each `store` call of `@keel/store`, under any local name, as a namespace member, through a `const` alias or a project re-export, in a client-reachable file (k.boundary Reach) of a `node` or `static` module, or in a file outside every module that such a module's file imports, directly or not (k.boundary Following). It reports E1107 at the call when the state schema holds a `.pii(class)` node of a class the module manifest's `clientPii` (a list of `PiiClass`, default empty) does not list, for a file outside every module the `clientPii` of each module whose files import it: `store state reaching #k-state holds .pii('<classes>'), not in clientPii`, the classes cut to fit 89 units; the fix adds the classes, none when more than one manifest lacks them. Also E1107, no fix, in such a file: a state schema the static read (k.privacy-reads) answers `'unknown'` for, a `.pii()` whose class is not a string literal among them, `store state not readable at <part>; cannot show its .pii() classes`, `<part>` the first part of the file the read could not take (a call as its callee and `()`), cut from its front to fit 89 units; a call of `stores()`, by which an island root puts every live request store, a loader's among them, in `#k-state`, `stores() in client code can send every request store to #k-state`; and `store` or `stores` of `@keel/store` used other than as a callee or through an alias above (passed as a value, destructured from a namespace, a computed member), `<name> of @keel/store used other than as a call; check cannot follow it`. A file of a module only `client` deployables list writes no `#k-state` and is not judged; a store a package creates is the package's."
// Seed 1337. Each case is `keel check`'s E1107 (k.leave) over a `node` module `a` whose `modules/a/Page.tsx` makes a `store` over a call of a package `fpkg` written under `node_modules/` (a `.ts` entry named by its `exports`), so the answer of the read is seen as the message: a class named, `not readable at <part>`, or none.
// Reading: "At most eight package functions are read on one path, the project's own call not counted" counts the package functions called from the project's call, so a chain `f1 -> f2 -> ... -> fN` is read for N up to 8 and unknown from 9.
// Reading: a marked schema held in a function's local, a parameter, a default parameter, a destructured parameter, a closure variable or a returned object's field is "caught" when the `store` call is one E1107 and never clean: the message names the class or says the call is not readable; the spec leaves which to the read ("a binding it cannot follow" is `'unknown'`; the body's `const`s and parameters standing for arguments are followed).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CLASSES, e1107In, holds, notReadable, pageFiles } from "./factories-support.ts";
import { SEED } from "./support.ts";

const PII = (c: string): string => `s.string().pii('${c}')`;
const SCHEMA = "import { s } from '@keel/schema'\n";
const klass = fc.constantFrom(...CLASSES);
const named = (c: string) =>
  new RegExp(`^store state reaching #k-state holds \\.pii\\('[a-z', ]*${c}[a-z', ]*'\\), not in clientPii$`);
const caught = (c: string) => (m: string) =>
  named(c).test(m) || /^store state not readable at .+; cannot show its \.pii\(\) classes$/.test(m);

describe("k.privacy-reads Factories: a call of a package's export is read through the package's source", () => {
  test("a package factory that marks its result (`.pii('contact')`) is read at the call and the class is named, by name or under another local name", () => {
    const pkg = `${SCHEMA}export const contactRow = () => s.object({ email: ${PII("contact")} })\n`;
    for (const head of [
      "import { contactRow } from 'fpkg'",
      "import { contactRow as cr } from 'fpkg'",
      "import { contactRow as cr } from 'fpkg'\nconst alias = cr",
    ]) {
      const call = head.includes("alias") ? "alias()" : head.includes(" as ") ? "cr()" : "contactRow()";
      const ds = e1107In(pageFiles(head, call), { fpkg: pkg });
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toBe(holds("contact"));
      expect(ds[0]?.path).toBe("modules/a/Page.tsx");
    }
    expect(e1107In(pageFiles("import { contactRow } from 'fpkg'", "contactRow()", ["contact"]), { fpkg: pkg })).toEqual(
      [],
    );
  });

  test("property: the class a package factory marks is the class the message names, and listing it in `clientPii` leaves no E1107", () => {
    fc.assert(
      fc.property(klass, klass, (c, other) => {
        const pkg = `${SCHEMA}export const row = () => s.object({ v: ${PII(c)} })\n`;
        const head = "import { row } from 'fpkg'";
        const ds = e1107In(pageFiles(head, "row()"), { fpkg: pkg });
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message).toBe(holds(c));
        expect(e1107In(pageFiles(head, "row()", [c]), { fpkg: pkg })).toEqual([]);
        if (other !== c) expect(e1107In(pageFiles(head, "row()", [other]), { fpkg: pkg })).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  test("a factory given a pii-marked argument row is read at the call: its arguments are read at the call, the parameter standing for the argument", () => {
    const wraps = [
      "export const page = (row) => s.object({ rows: s.array(row), total: s.int() })",
      "export const page = (row) => s.object({ item: row.optional() })",
      "export const page = (row) => { const out = s.object({ rows: s.array(row) }); return out }",
      "export const page = (row) => row",
    ];
    fc.assert(
      fc.property(klass, fc.constantFrom(...wraps), (c, wrap) => {
        const head = "import { page } from 'fpkg'";
        const pkg = `${SCHEMA}${wrap}\n`;
        const ds = e1107In(pageFiles(head, `page(s.object({ e: ${PII(c)} }))`), { fpkg: pkg });
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message).toBe(holds(c));
        expect(e1107In(pageFiles(head, `page(s.object({ e: s.string() }))`), { fpkg: pkg })).toEqual([]);
      }),
      { seed: SEED, numRuns: 16 },
    );
  });

  test("a package with no source in the read stays unreadable: E1107 naming the call, for a package that ships built code and types, one that does not resolve, and one whose entry is a declaration file", () => {
    const head = "import { rowOf } from 'fpkg'";
    const files = pageFiles(head, "rowOf(s.string())");
    const message = notReadable("rowOf()");
    const dts = e1107In(
      files,
      {},
      {
        "node_modules/fpkg/package.json":
          '{"name":"fpkg","type":"module","exports":{".":{"types":"./index.d.ts","default":"./index.js"}}}\n',
        "node_modules/fpkg/index.js": `export const rowOf = () => ({ pii: 'contact' })\n`,
        "node_modules/fpkg/index.d.ts": "export declare const rowOf: (x: unknown) => never\n",
      },
    );
    const missing = e1107In(files, {});
    const onlyDeclaration = e1107In(
      files,
      {},
      {
        "node_modules/fpkg/package.json": '{"name":"fpkg","type":"module","exports":{".":"./index.d.ts"}}\n',
        "node_modules/fpkg/index.d.ts": "export declare const rowOf: (x: unknown) => never\n",
      },
    );
    for (const ds of [dts, missing, onlyDeclaration]) {
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toBe(message);
      expect(ds[0]?.fix).toBeUndefined();
    }
    const allListed = e1107In(pageFiles(head, "rowOf(s.string())", [...CLASSES]), {});
    expect(allListed).toHaveLength(1);
    expect(allListed[0]?.message).toBe(message);
  });

  test("the depth bound at its edge: a chain of up to eight calls through the package's own functions is read, a chain of nine or more is not", () => {
    const chain = (n: number): string => {
      const fns = Array.from({ length: n }, (_, i) =>
        i === n - 1
          ? `const f${i + 1} = () => s.object({ e: ${PII("contact")} })`
          : `const f${i + 1} = () => f${i + 2}()`,
      );
      return `${SCHEMA}${fns.reverse().join("\n")}\nexport { f1 }\n`;
    };
    const head = "import { f1 } from 'fpkg'";
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 14 }), (n) => {
        const ds = e1107In(pageFiles(head, "f1()"), { fpkg: chain(n) });
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message).toBe(n <= 8 ? holds("contact") : notReadable("f1()"));
      }),
      { seed: SEED, numRuns: 14 },
    );
    expect(e1107In(pageFiles(head, "f1()"), { fpkg: chain(8) })[0]?.message).toBe(holds("contact"));
    expect(e1107In(pageFiles(head, "f1()"), { fpkg: chain(9) })[0]?.message).toBe(notReadable("f1()"));
  });

  test("a call of a package's export as a namespace member is read the same way, and one with no source is unreadable naming the call", () => {
    const pkg = `${SCHEMA}export const contactRow = () => s.object({ email: ${PII("contact")} })\n`;
    const head = "import * as p from 'fpkg'";
    const ds = e1107In(pageFiles(head, "p.contactRow()"), { fpkg: pkg });
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(holds("contact"));
    expect(e1107In(pageFiles(head, "p.contactRow()", ["contact"]), { fpkg: pkg })).toEqual([]);
    const none = e1107In(pageFiles(head, "p.rowOf()"), {});
    expect(none).toHaveLength(1);
    expect(none[0]?.message.startsWith("store state not readable at ")).toBe(true);
    expect(none[0]?.message).toContain("rowOf()");
    expect(none[0]?.message.endsWith("; cannot show its .pii() classes")).toBe(true);
  });

  const SHAPES: { name: string; pkg: (c: string) => string; head: string; expr: string }[] = [
    {
      name: "a local `const` of the function's body",
      pkg: (c) => `${SCHEMA}export const mk = () => { const e = ${PII(c)}; return s.object({ e }) }\n`,
      head: "import { mk } from 'fpkg'",
      expr: "mk()",
    },
    {
      name: "a parameter",
      pkg: () => `${SCHEMA}export const mk = (e) => s.object({ e })\n`,
      head: "import { mk } from 'fpkg'",
      expr: "mk(PII)",
    },
    {
      name: "a default parameter",
      pkg: (c) => `${SCHEMA}export const mk = (e = ${PII(c)}) => s.object({ e })\n`,
      head: "import { mk } from 'fpkg'",
      expr: "mk()",
    },
    {
      name: "a destructured parameter",
      pkg: () => `${SCHEMA}export const mk = ({ e }) => s.object({ e })\n`,
      head: "import { mk } from 'fpkg'",
      expr: "mk({ e: PII })",
    },
    {
      name: "a closure variable of the package",
      pkg: (c) => `${SCHEMA}const hidden = ${PII(c)}\nexport const mk = () => s.object({ hidden })\n`,
      head: "import { mk } from 'fpkg'",
      expr: "mk()",
    },
    {
      name: "a closure variable of an enclosing function",
      pkg: (c) =>
        `${SCHEMA}export const mk = () => { const hidden = ${PII(c)}; const inner = () => s.object({ hidden }); return inner() }\n`,
      head: "import { mk } from 'fpkg'",
      expr: "mk()",
    },
    {
      name: "a returned object's field",
      pkg: (c) => `${SCHEMA}export const mk = () => ({ e: ${PII(c)}, t: s.string() })\n`,
      head: "import { mk } from 'fpkg'",
      expr: "s.object({ e: mk().e })",
    },
    {
      name: "a returned object read whole",
      pkg: (c) => `${SCHEMA}export const mk = () => ({ e: ${PII(c)} })\n`,
      head: "import { mk } from 'fpkg'",
      expr: "s.object(mk())",
    },
    {
      name: "a project function's local `const`",
      pkg: () => "export const unused = 1\n",
      head: "const mk = () => { const e = PII; return s.object({ e }) }",
      expr: "mk()",
    },
    {
      name: "a project function's parameter, called with the marked schema",
      pkg: () => "export const unused = 1\n",
      head: "const mk = (e: unknown) => s.object({ e })",
      expr: "mk(PII)",
    },
    {
      name: "a project function's destructured parameter",
      pkg: () => "export const unused = 1\n",
      head: "const mk = ({ e }: { e: unknown }) => s.object({ e })",
      expr: "mk({ e: PII })",
    },
    {
      name: "a project function's default parameter",
      pkg: () => "export const unused = 1\n",
      head: "const mk = (e: unknown = PII) => s.object({ e })",
      expr: "mk()",
    },
    {
      name: "a project closure variable of an enclosing function",
      pkg: () => "export const unused = 1\n",
      head: "const mk = () => { const hidden = PII; return () => s.object({ hidden }) }",
      expr: "mk()()",
    },
    {
      name: "a project function's returned object's field",
      pkg: () => "export const unused = 1\n",
      head: "const mk = () => ({ e: PII })",
      expr: "s.object({ e: mk().e })",
    },
  ];

  test("property: a marked schema held in a function's local, a parameter, a default parameter, a destructured parameter, a closure variable or a returned object's field is caught: one E1107, never clean", () => {
    fc.assert(
      fc.property(klass, fc.constantFrom(...SHAPES), (c, shape) => {
        const marked = PII(c);
        const head = shape.head.replaceAll("PII", marked);
        const expr = shape.expr.replaceAll("PII", marked);
        const ds = e1107In(pageFiles(head, expr), { fpkg: shape.pkg(c) });
        expect(ds, shape.name).toHaveLength(1);
        expect(caught(c)(ds[0]?.message ?? ""), `${shape.name}: ${ds[0]?.message}`).toBe(true);
        expect(ds[0]?.path).toBe("modules/a/Page.tsx");
      }),
      { seed: SEED, numRuns: SHAPES.length * 4 },
    );
  });

  test("each shape on its own: a marked schema in a function's local, a parameter, a default, a destructured parameter, a closure variable or a returned object's field is one E1107 (the whole list, so a hole in one names itself)", () => {
    for (const shape of SHAPES) {
      const marked = PII("contact");
      const ds = e1107In(pageFiles(shape.head.replaceAll("PII", marked), shape.expr.replaceAll("PII", marked)), {
        fpkg: shape.pkg("contact"),
      });
      expect(ds, shape.name).toHaveLength(1);
      expect(caught("contact")(ds[0]?.message ?? ""), shape.name).toBe(true);
    }
  });

  test("a factory that returns different schemas on different branches is read on each: every class a branch marks is named", () => {
    const head = "import { pick } from 'fpkg'";
    const forms = [
      (a: string, b: string) =>
        `export const pick = (c) => c ? s.object({ a: ${PII(a)} }) : s.object({ b: ${PII(b)} })`,
      (a: string, b: string) =>
        `export const pick = (c) => { if (c) return s.object({ a: ${PII(a)} }); return s.object({ b: ${PII(b)} }) }`,
      (a: string, b: string) =>
        `export const pick = (c) => { if (c) { return s.object({ a: ${PII(a)} }) } else { return s.object({ b: ${PII(b)} }) } }`,
      (a: string, b: string) =>
        `export const pick = (c) => c === 1 ? s.object({ a: ${PII(a)} }) : c === 2 ? s.string() : s.object({ b: ${PII(b)} })`,
    ];
    fc.assert(
      fc.property(klass, klass, fc.constantFrom(...forms), (a, b, form) => {
        const ds = e1107In(pageFiles(head, "pick(true)"), { fpkg: `${SCHEMA}${form(a, b)}\n` });
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message).toContain(a);
        expect(ds[0]?.message).toContain(b);
        const listedA = e1107In(pageFiles(head, "pick(true)", [a]), { fpkg: `${SCHEMA}${form(a, b)}\n` });
        expect(listedA).toHaveLength(a === b ? 0 : 1);
        if (a !== b) expect(listedA[0]?.message).toContain(b);
      }),
      { seed: SEED, numRuns: 24 },
    );
  });

  test("a factory whose branches mark nothing is clean, and one whose one branch marks and the other cannot be read is one E1107", () => {
    const head = "import { pick } from 'fpkg'";
    const clean = `${SCHEMA}export const pick = (c) => c ? s.object({ a: s.string() }) : s.object({ b: s.int() })\n`;
    expect(e1107In(pageFiles(head, "pick(true)"), { fpkg: clean })).toEqual([]);
    const half = `${SCHEMA}import { gone } from 'no-such-pkg'\nexport const pick = (c) => c ? s.object({ a: ${PII("contact")} }) : gone()\n`;
    expect(e1107In(pageFiles(head, "pick(true)"), { fpkg: half })).toHaveLength(1);
  });

  test("a recursive factory with a base case marking a class is read once, the call met again is not read again: one E1107", () => {
    const head = "import { tree } from 'fpkg'";
    const based = `${SCHEMA}export const tree = (n) => n === 0 ? s.object({ e: ${PII("contact")} }) : tree(n - 1)\n`;
    const ds = e1107In(pageFiles(head, "tree(3)"), { fpkg: based });
    expect(ds).toHaveLength(1);
    expect(caught("contact")(ds[0]?.message ?? "")).toBe(true);
  });

  test("a recursive factory with no base case is met again while its read is open, so not read again and unreadable: one E1107 naming the call", () => {
    const head = "import { tree } from 'fpkg'";
    const ds = e1107In(pageFiles(head, "tree(3)"), { fpkg: `${SCHEMA}export const tree = (n) => tree(n)\n` });
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(notReadable("tree()"));
  });

  test("two package functions that call each other with no base case (mutual recursion) are met again while read, so unreadable: one E1107 naming the call", () => {
    const head = "import { tree } from 'fpkg'";
    const mutual = `${SCHEMA}const ping = (n) => pong(n)\nconst pong = (n) => ping(n)\nexport const tree = (n) => ping(n)\n`;
    const ds = e1107In(pageFiles(head, "tree(3)"), { fpkg: mutual });
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe(notReadable("tree()"));
  });

  test("property: a recursive factory of any depth in its argument terminates with one E1107 or none, never an error from the read", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), fc.boolean(), (n, marks) => {
        const base = marks ? PII("contact") : "s.string()";
        const pkg = `${SCHEMA}export const tree = (n) => n === 0 ? s.object({ e: ${base} }) : tree(n - 1)\n`;
        const ds = e1107In(pageFiles("import { tree } from 'fpkg'", `tree(${n})`), { fpkg: pkg });
        expect(ds.length).toBeLessThanOrEqual(1);
        if (marks) expect(ds).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 12 },
    );
  });
});
