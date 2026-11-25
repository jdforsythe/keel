// Spec: k.leave, E1107 "The check judges each `store` call of `@keel/store`, under any local name, as a namespace member, through a `const` alias or a project re-export, in a client-reachable file (k.boundary Reach) of a `node` or `static` module, or in a file outside every module that such a module's file imports, directly or not (k.boundary Following). It reports E1107 at the call when the state schema holds a `.pii(class)` node of a class the module manifest's `clientPii` (a list of `PiiClass`, default empty) does not list, for a file outside every module the `clientPii` of each module whose files import it: `store state reaching #k-state holds .pii('<classes>'), not in clientPii`, the classes cut to fit 89 units; the fix adds the classes, none when more than one manifest lacks them. Also E1107, no fix, in such a file: a state schema the static read (k.privacy-reads) answers `'unknown'` for, a `.pii()` whose class is not a string literal among them, `store state not readable statically; cannot show its .pii() classes`; a call of `stores()`, by which an island root puts every live request store, a loader's among them, in `#k-state`, `stores() in client code can send every request store to #k-state`; and `store` or `stores` of `@keel/store` used other than as a callee or through an alias above (passed as a value, destructured from a namespace, a computed member), `<name> of @keel/store used other than as a call; check cannot follow it`. A file of a module only `client` deployables list writes no `#k-state` and is not judged; a store a package creates is the package's."
// Spec: k.leave, Rules "E1107 a `.pii()` class reaching `#k-state` that `clientPii` does not list (fix adds it)"
// Spec: k.leave, Conformance "In a `node` module with no `clientPii`, `store(Contact, …)` (`email: s.string().pii('contact')`) in `modules/a/contacts.ts`, a file only `modules/a/load.server.ts` imports, is one E1107 whose fix adds `'contact'`; so is `k.store(Contact, …)` with `import * as k from '@keel/store'`, `mk(Contact, …)` with `const mk = store`, and `store(Contact, …)` with `store` imported from `lib/st.ts` holding `export { store } from '@keel/store'`; in `modules/a/contacts.server.ts` it is none, and in a module only a `client` deployable lists it is none."
// Spec: k.leave, Conformance "In that module, in `modules/a/Page.tsx`: `store(S, …)` with `const S = make()`, and `store(s.object({ e: s.string().pii(c) }), …)` with `c` a parameter, are each one E1107 with message `store state not readable statically; cannot show its .pii() classes`; `stores()` from `@keel/store` is one E1107 with message `stores() in client code can send every request store to #k-state`, also when `clientPii` lists every class; `register(store)` is one E1107 at `store` with message `store of @keel/store used other than as a call; check cannot follow it`; none has a fix."
// Spec: k.leave, Conformance "`store(Contact, …)` in `lib/contacts.ts`, outside every module, imported by `modules/a/Page.tsx` and `modules/b/Page.tsx` of `node` modules: one E1107 at the call with no fix when neither `a` nor `b` lists `contact`, and one whose fix adds `'contact'` to `b`'s `clientPii` when only `a` lists it."
// Seed 1337 (the properties below). The type pass is off: the fixtures name packages that resolve only on disk. `topology.ts` lists module `a` (and `b`) on a `node` deployable unless a case says otherwise.
// Reading: "at the call" is the diagnostic's path and line; `<classes>` is read as the unlisted classes, each named in the message.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { applyFix } from "./E1258-support.ts";
import { type Adapter, file, topologyOf } from "./boundary-support.ts";
import { freshDir, removeDir, rootOption, writeFileAt, writeTree } from "./security-support.ts";
import { type Files, SEED } from "./support.ts";

const CLASSES = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;
const manifest = (id: string, clientPii?: readonly string[]): Files[number] =>
  file(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] }${
      clientPii === undefined ? "" : `, clientPii: [${clientPii.map((c) => `'${c}'`).join(", ")}]`
    } })\n`,
  );
const CONTACT = file(
  "modules/a/Contact.schema.ts",
  "import { s } from '@keel/schema'\nexport const Contact = s.object({ email: s.string().pii('contact') })\n",
);
const STORE_HEAD = "import { store } from '@keel/store'\nimport { Contact } from './Contact.schema.ts'\n";
const CALL = "export const c = store(Contact, { email: '' })\n";
const node = (modules: string[] = ["a"]): Files[number] => topologyOf({ api: { modules, adapter: "node" } });
const e1107 = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E1107");
const NOT_READABLE = "store state not readable statically; cannot show its .pii() classes";
const STORES_MSG = "stores() in client code can send every request store to #k-state";

describe("k.leave E1107: every `store` call of `@keel/store` in a client-reachable file of a `node` module", () => {
  test("in a `node` module with no `clientPii`, `store(Contact, …)` in `modules/a/contacts.ts`, a file only `modules/a/load.server.ts` imports, is one E1107 whose fix adds `'contact'`", () => {
    const files = [
      node(),
      manifest("a"),
      CONTACT,
      file("modules/a/contacts.ts", STORE_HEAD + CALL),
      file("modules/a/load.server.ts", "import { c } from './contacts.ts'\nexport const load = () => c\n"),
    ];
    const ds = e1107(files);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("modules/a/contacts.ts");
    expect(ds[0]?.line).toBe(3);
    expect(ds[0]?.message).toBe("store state reaching #k-state holds .pii('contact'), not in clientPii");
    const fix = ds[0]?.fix;
    expect(typeof fix).toBe("string");
    if (fix === undefined) return;
    const patched = applyFix(files, fix);
    expect(patched.find((x) => x.path === "modules/a/module.ts")?.source).toContain("'contact'");
    expect(e1107(patched)).toEqual([]);
  });

  test("so is `k.store(Contact, …)` with `import * as k from '@keel/store'`, `mk(Contact, …)` with `const mk = store`, and `store(Contact, …)` with `store` imported from `lib/st.ts` holding `export { store } from '@keel/store'`", () => {
    const st = file("lib/st.ts", "export { store } from '@keel/store'\n");
    const variants: [string, Files[number][]][] = [
      [
        "import * as k from '@keel/store'\nimport { Contact } from './Contact.schema.ts'\nexport const c = k.store(Contact, { email: '' })\n",
        [],
      ],
      [`${STORE_HEAD}const mk = store\nexport const c = mk(Contact, { email: '' })\n`, []],
      [`import { store } from '../../lib/st.ts'\nimport { Contact } from './Contact.schema.ts'\n${CALL}`, [st]],
    ];
    for (const [source, extra] of variants) {
      const ds = e1107([node(), manifest("a"), CONTACT, file("modules/a/contacts.ts", source), ...extra]);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.path).toBe("modules/a/contacts.ts");
      expect(ds[0]?.fix).toContain("'contact'");
    }
  });

  test("in `modules/a/contacts.server.ts` it is none, and in a module only a `client` deployable lists it is none", () => {
    expect(e1107([node(), manifest("a"), CONTACT, file("modules/a/contacts.server.ts", STORE_HEAD + CALL)])).toEqual(
      [],
    );
    const client = [
      topologyOf({ web: { modules: ["a"], adapter: "client" } }),
      manifest("a"),
      CONTACT,
      file("modules/a/contacts.ts", STORE_HEAD + CALL),
    ];
    expect(e1107(client)).toEqual([]);
  });

  test("property: the call is judged under every spelling of the callee (a rename, a namespace member, a `const` alias, an alias of an alias, a project re-export under any name), and only in a `node` or `static` module's non-server-only file", () => {
    const st = file("lib/st.ts", "export { store as made } from '@keel/store'\n");
    const spelling = fc.constantFrom(
      { head: "import { store as mk } from '@keel/store'\n", use: "mk" },
      { head: "import * as k from '@keel/store'\n", use: "k.store" },
      { head: "import { store } from '@keel/store'\nconst a = store\n", use: "a" },
      { head: "import { store } from '@keel/store'\nconst a = store\nconst b = a\n", use: "b" },
      { head: "import { made } from '../../lib/st.ts'\n", use: "made" },
      { head: "import * as k from '@keel/store'\nconst mk = k.store\n", use: "mk" },
    );
    const adapter = fc.constantFrom<Adapter>("node", "static", "client");
    const fileName = fc.constantFrom("contacts.ts", "Card.tsx", "deep/contacts.ts", "x.server.ts", "x.guard.ts");
    fc.assert(
      fc.property(spelling, adapter, fileName, (sp, ad, name) => {
        const path = `modules/a/${name}`;
        const src = `${sp.head}import { Contact } from '${name.includes("/") ? "../" : "./"}Contact.schema.ts'\nexport const c = ${sp.use}(Contact, { email: '' })\n`;
        const ds = e1107([
          topologyOf({ api: { modules: ["a"], adapter: ad } }),
          manifest("a"),
          CONTACT,
          file(path, src),
          st,
        ]);
        const judged = ad !== "client" && !/\.(server|guard)\./.test(name);
        expect(ds).toHaveLength(judged ? 1 : 0);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("a file reached through the project's own name or a `node_modules` link is judged too", () => {
    const dir = freshDir("keel-e1107");
    try {
      const files = [
        node(),
        manifest("a"),
        CONTACT,
        file(
          "modules/a/Page.tsx",
          "import { c } from 'p/lib/contacts.ts'\nexport default function Page() {\n  return String(c)\n}\n",
        ),
        file(
          "lib/contacts.ts",
          "import { store } from '@keel/store'\nimport { s } from '@keel/schema'\nexport const c = store(s.object({ e: s.string().pii('contact') }), { e: '' })\n",
        ),
      ];
      writeTree(dir, files);
      writeFileAt(dir, "package.json", '{"name":"p","type":"module","exports":{"./*":"./*"}}\n');
      const ds = check(files, { root: rootOption(dir), types: false }).diagnostics.filter((d) => d.code === "E1107");
      expect(ds).toHaveLength(1);
      expect(ds[0]?.path).toBe("lib/contacts.ts");
    } finally {
      removeDir(dir);
    }
  });

  test("the classes in the message are cut to fit 89 units", () => {
    fc.assert(
      fc.property(fc.subarray([...CLASSES], { minLength: 1 }), (classes) => {
        const fields = classes.map((c, i) => `f${i}: s.string().pii('${c}')`).join(", ");
        const src = `import { s } from '@keel/schema'\nimport { store } from '@keel/store'\nexport const c = store(s.object({ ${fields} }), {})\n`;
        const ds = e1107([node(), manifest("a"), file("modules/a/c.ts", src)]);
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message.length).toBeLessThanOrEqual(89);
        expect(ds[0]?.message.startsWith("store state reaching #k-state holds .pii(")).toBe(true);
        if (classes.length === 1) expect(ds[0]?.message).toContain(`'${classes[0]}'`);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});

describe("k.leave E1107: what it cannot read, `stores()`, and `store` used other than as a call", () => {
  const PAGE = (body: string): Files[number] => file("modules/a/Page.tsx", body);
  const run = (body: string, clientPii?: readonly string[]) => e1107([node(), manifest("a", clientPii), PAGE(body)]);

  test("in `modules/a/Page.tsx`: `store(S, …)` with `const S = make()`, and `store(s.object({ e: s.string().pii(c) }), …)` with `c` a parameter, are each one E1107 with message `store state not readable statically; cannot show its .pii() classes`", () => {
    const factory =
      "import { store } from '@keel/store'\ndeclare const make: () => never\nconst S = make()\nexport const c = store(S, {})\n";
    const param =
      "import { s } from '@keel/schema'\nimport { store } from '@keel/store'\nexport const mk = (c: 'name') => store(s.object({ e: s.string().pii(c) }), { e: '' })\n";
    for (const body of [factory, param]) {
      const ds = run(body);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toBe(NOT_READABLE);
      expect(ds[0]?.fix).toBeUndefined();
    }
  });

  test("`stores()` from `@keel/store` is one E1107 with message `stores() in client code can send every request store to #k-state`, also when `clientPii` lists every class", () => {
    const body = "import { stores } from '@keel/store'\nexport const all = stores()\n";
    for (const listed of [undefined, [...CLASSES]] as const) {
      const ds = run(body, listed);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toBe(STORES_MSG);
      expect(ds[0]?.fix).toBeUndefined();
    }
  });

  test("`register(store)` is one E1107 at `store` with message `store of @keel/store used other than as a call; check cannot follow it`", () => {
    const body = "import { store } from '@keel/store'\ndeclare const register: (x: unknown) => void\nregister(store)\n";
    const ds = run(body);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.message).toBe("store of @keel/store used other than as a call; check cannot follow it");
    expect(ds[0]?.line).toBe(3);
    expect(ds[0]?.col).toBe((body.split("\n")[2] ?? "").indexOf("store") + 1);
    expect(ds[0]?.fix).toBeUndefined();
  });

  test("property: `store` or `stores` used as a value (passed, stored, destructured from a namespace, a computed member, returned) is one E1107, whatever the position", () => {
    const sink = fc.constantFrom(
      (n: string) => `import { ${n} } from '@keel/store'\ndeclare const use: (x: unknown) => void\nuse(${n})\n`,
      (n: string) => `import { ${n} } from '@keel/store'\nexport const held = [${n}]\n`,
      (n: string) => `import { ${n} } from '@keel/store'\nexport const held = { ${n} }\n`,
      (n: string) => `import { ${n} } from '@keel/store'\nexport const get = () => ${n}\n`,
      (n: string) => `import * as k from '@keel/store'\nexport const { ${n}: held } = k\n`,
      (n: string) => `import * as k from '@keel/store'\nexport const held = k['${n}']\n`,
      (n: string) => `import * as k from '@keel/store'\ndeclare const use: (x: unknown) => void\nuse(k.${n})\n`,
    );
    fc.assert(
      fc.property(sink, fc.constantFrom("store", "stores"), (make, name) => {
        const ds = run(make(name));
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message.endsWith("of @keel/store used other than as a call; check cannot follow it")).toBe(true);
        expect(ds[0]?.message).toContain(`${name} of @keel/store`);
        expect(ds[0]?.fix).toBeUndefined();
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("an unreadable schema, `stores()` and a non-call use are each E1107 in a `static` module, and none in a `client`-only module", () => {
    const body =
      "import { store, stores } from '@keel/store'\ndeclare const make: () => never\nexport const c = store(make(), {})\nexport const all = stores()\n";
    const inStatic = e1107([topologyOf({ s: { modules: ["a"], adapter: "static" } }), manifest("a"), PAGE(body)]);
    expect(inStatic.map((d) => d.message).sort()).toEqual([NOT_READABLE, STORES_MSG].sort());
    const inClient = e1107([topologyOf({ w: { modules: ["a"], adapter: "client" } }), manifest("a"), PAGE(body)]);
    expect(inClient).toEqual([]);
  });

  test("none of these is reported in a `*.server.ts` file, and a `store` call whose schema has no `.pii()` node is clean", () => {
    const body =
      "import { store, stores } from '@keel/store'\ndeclare const make: () => never\nexport const c = store(make(), {})\nexport const all = stores()\n";
    expect(e1107([node(), manifest("a"), file("modules/a/load.server.ts", body)])).toEqual([]);
    const plain =
      "import { s } from '@keel/schema'\nimport { store } from '@keel/store'\nexport const c = store(s.object({ t: s.string() }), { t: '' })\n";
    expect(run(plain)).toEqual([]);
  });
});

describe("k.leave E1107: a file outside every module is judged against the `clientPii` of each module whose files import it", () => {
  const LIB = file(
    "lib/contacts.ts",
    "import { s } from '@keel/schema'\nimport { store } from '@keel/store'\nexport const c = store(s.object({ e: s.string().pii('contact') }), { e: '' })\n",
  );
  const page = (id: string) =>
    file(
      `modules/${id}/Page.tsx`,
      "import { c } from '../../lib/contacts.ts'\nexport default function Page() {\n  return String(c)\n}\n",
    );
  const tree = (a?: readonly string[], b?: readonly string[]): Files => [
    node(["a", "b"]),
    manifest("a", a),
    manifest("b", b),
    page("a"),
    page("b"),
    LIB,
  ];

  test("`store(Contact, …)` in `lib/contacts.ts`, outside every module, imported by `modules/a/Page.tsx` and `modules/b/Page.tsx` of `node` modules: one E1107 at the call with no fix when neither `a` nor `b` lists `contact`, and one whose fix adds `'contact'` to `b`'s `clientPii` when only `a` lists it", () => {
    const neither = e1107(tree());
    expect(neither).toHaveLength(1);
    expect(neither[0]?.path).toBe("lib/contacts.ts");
    expect(neither[0]?.line).toBe(3);
    expect(neither[0]?.fix).toBeUndefined();

    const onlyA = tree(["contact"]);
    const ds = e1107(onlyA);
    expect(ds).toHaveLength(1);
    const fix = ds[0]?.fix;
    expect(typeof fix).toBe("string");
    if (fix === undefined) return;
    const patched = applyFix(onlyA, fix);
    expect(patched.find((x) => x.path === "modules/b/module.ts")?.source).toContain("'contact'");
    expect(patched.find((x) => x.path === "modules/a/module.ts")?.source).toBe(
      onlyA.find((x) => x.path === "modules/a/module.ts")?.source,
    );
    expect(e1107(patched)).toEqual([]);
  });

  test("property: the file is E1107 exactly when some importing module does not list the class, and its fix exists only when that is one module", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (listA, listB) => {
        const ds = e1107(tree(listA ? ["contact"] : undefined, listB ? ["contact"] : undefined));
        expect(ds).toHaveLength(listA && listB ? 0 : 1);
        if (ds[0] !== undefined) expect(ds[0].fix !== undefined).toBe(listA !== listB);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test("a file outside every module that no file of a `node` module imports is not judged", () => {
    expect(
      e1107([
        node(),
        manifest("a"),
        file("modules/a/Page.tsx", "export default function Page() {\n  return null\n}\n"),
        LIB,
      ]),
    ).toEqual([]);
  });
});
