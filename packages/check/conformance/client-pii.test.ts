// Spec: k.leave, Snapshots "`#k-state` `stores` holds a request store's snapshot only when an island needs it to resume: the store was created, looked up through `stores()` or read (`get`, `select`, `snapshot`, `log`, `head`) while a level's component rendered on the server, that level being an island root (k.runtime). A store only a guard, loader, action or static level touched is not in it, however much it holds; nor is a factory store (k.server). A document with no island has `stores` `{}`. `#k-state` is not a k.privacy sink: a snapshot holds the store's state and log as they are, so a `.pii()`-marked value in a store an island creates reaches the browser, as the island needs it to render. The check reports E1107 at a `store` call in a client-reachable file (E1004's reachability) whose state schema holds a `.pii(class)` node of a class its module manifest's `clientPii` (a list of `PiiClass`, default empty) does not list; the fix adds the class. No `s.secret` value reaches a snapshot: a state schema holding one throws E1303, and a snapshot folds every log entry up to the last secret payload (k.store)."
// Spec: k.leave, Rules "E1107 a `.pii()` class reaching `#k-state` that `clientPii` does not list (fix adds it)"
// Spec: k.leave, Conformance "`store(Contact, …)` with `email: s.string().pii('contact')` in a component file is E1107 when the module has no `clientPii`, and with `clientPii: ['name']`; with `clientPii: ['contact']`, or in a `*.server.ts` file, it is not; the fix adds `'contact'`."
// Seed 1337 (the properties below). The type pass is off: the fixtures name packages that resolve only on disk.
// The real files are read from apps/ by realFiles; a store reached from a client file is made by adding one component file.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { applyFix } from "./E1258-support.ts";
import { realFiles } from "./E1406-support.ts";
import { type Files, SEED } from "./support.ts";

const NO_TYPES = { types: false } as const;
const f = (path: string, source: string): Files[number] => ({ path, source });
const CLASSES = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;

const module_ = (clientPii?: readonly string[]): Files[number] =>
  f(
    "modules/app/module.ts",
    `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [], routes: [] }${
      clientPii === undefined ? "" : `, clientPii: [${clientPii.map((c) => `'${c}'`).join(", ")}]`
    } })\n`,
  );

const HEAD = "import { s } from '@keel/schema'\nimport { store } from '@keel/store'\n";
const inline = (cls: string): string =>
  `${HEAD}export const card = store(s.object({ field: s.string().pii('${cls}') }), { field: '' })\n`;
const e1107 = (files: Files) => check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1107");

describe("k.leave Rules: E1107 a store call in a client-reachable file whose state schema holds a pii class its module does not list", () => {
  test("`store(Contact, ...)` with `email: s.string().pii('contact')` in a component file is E1107 when the module has no `clientPii`", () => {
    const ds = e1107([module_(), f("modules/app/Card.tsx", inline("contact"))]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("modules/app/Card.tsx");
    expect(ds[0]?.line).toBe(3);
  });

  test("it is E1107 with `clientPii: ['name']`", () => {
    expect(e1107([module_(["name"]), f("modules/app/Card.tsx", inline("contact"))])).toHaveLength(1);
  });

  test("it is E1107 for a schema imported from a schema file, and for a `.pii` node nested in an object and an array", () => {
    const schema = f(
      "modules/app/Contact.schema.ts",
      "import { s } from '@keel/schema'\nexport const Contact = s.object({ people: s.array(s.object({ email: s.string().pii('contact') })) })\n",
    );
    const card = f(
      "modules/app/Card.tsx",
      "import { store } from '@keel/store'\nimport { Contact } from './Contact.schema.ts'\nexport const card = store(Contact, { people: [] })\n",
    );
    expect(e1107([module_(), schema, card])).toHaveLength(1);
  });

  test("it is E1107 in a plain `.ts` file a client file imports, not only in a component file", () => {
    const card = f("modules/app/cards.ts", inline("contact"));
    const page = f(
      "modules/app/Page.tsx",
      "import { card } from './cards.ts'\nexport default function P() { return <p>{String(card)}</p> }\n",
    );
    expect(e1107([module_(), card, page])).toHaveLength(1);
  });

  test("with two classes and one listed, only the unlisted one is reported, once per store call", () => {
    const src = `${HEAD}export const a = store(s.object({ e: s.string().pii('contact') }), { e: '' })\nexport const b = store(s.object({ n: s.string().pii('name') }), { n: '' })\n`;
    expect(e1107([module_(["name"]), f("modules/app/Card.tsx", src)])).toHaveLength(1);
    expect(e1107([module_(), f("modules/app/Card.tsx", src)])).toHaveLength(2);
  });

  test("with `clientPii: ['contact']` it is not E1107; with a longer list holding it, neither", () => {
    const card = f("modules/app/Card.tsx", inline("contact"));
    expect(e1107([module_(["contact"]), card])).toEqual([]);
    expect(e1107([module_(["name", "contact", "location"]), card])).toEqual([]);
  });

  test("in a `*.server.ts` file it is not E1107, with no `clientPii`", () => {
    expect(e1107([module_(), f("modules/app/cards.server.ts", inline("contact"))])).toEqual([]);
  });

  test("negative: a state schema with no `.pii()` node is clean, and so is one with a `.string()` field only", () => {
    const src = `${HEAD}export const card = store(s.object({ title: s.string(), n: s.int() }), { title: '', n: 0 })\n`;
    expect(e1107([module_(), f("modules/app/Card.tsx", src)])).toEqual([]);
  });

  test("negative: a `.pii` node in a schema no `store` call takes (an action input) is clean", () => {
    const src =
      "import { s } from '@keel/schema'\nexport const Input = s.object({ email: s.string().pii('contact') })\n";
    expect(e1107([module_(), f("modules/app/Input.schema.ts", src)])).toEqual([]);
  });

  test("negative: a pii schema file beside a store whose own schema has no marked node is clean", () => {
    const marked = f(
      "modules/app/Contact.schema.ts",
      "import { s } from '@keel/schema'\nexport const Contact = s.object({ email: s.string().pii('contact') })\n",
    );
    const plain = `${HEAD}export const card = store(s.object({ title: s.string() }), { title: '' })\n`;
    expect(e1107([module_(), marked, f("modules/app/Card.tsx", plain)])).toEqual([]);
  });

  test("negative: an explicit empty `clientPii` with a plain store is clean", () => {
    const plain = `${HEAD}export const card = store(s.object({ title: s.string() }), { title: '' })\n`;
    expect(e1107([module_([]), f("modules/app/Card.tsx", plain)])).toEqual([]);
  });

  test("negative: every class listed in `clientPii` is clean for a store of that class", () => {
    for (const cls of CLASSES) expect(e1107([module_([cls]), f("modules/app/Card.tsx", inline(cls))])).toEqual([]);
  });

  test("negative: a `.pii` store made only in a `*.server.ts` file, beside a client file that does not import it, is clean", () => {
    const server = f("modules/app/cards.server.ts", inline("financial"));
    const page = f("modules/app/Page.tsx", "export default function P() { return <p>x</p> }\n");
    expect(e1107([module_(), server, page])).toEqual([]);
  });

  test("negative: the real accounts module of apps/golden-2 (its `.pii('contact')` stores are reached from server files only) reports no E1107", () => {
    expect(e1107(realFiles("apps/golden-2/modules/accounts", "modules/accounts"))).toEqual([]);
  });

  test("negative: the real todos and api modules of apps/golden-1 and the recipes module of apps/golden-2 report no E1107", () => {
    expect(e1107(realFiles("apps/golden-1/modules/todos", "modules/todos"))).toEqual([]);
    expect(e1107(realFiles("apps/golden-1/modules/api", "modules/api"))).toEqual([]);
    expect(e1107(realFiles("apps/golden-2/modules/recipes", "modules/recipes"))).toEqual([]);
  });

  test("the real accounts profile store made reachable from a client component is E1107 for `contact` and `identifier`, and clean once the module lists them", () => {
    const real = realFiles("apps/golden-2/modules/accounts", "modules/accounts");
    const panel = f(
      "modules/accounts/Panel.tsx",
      "import { profileStores } from './profileStores.ts'\nexport default function Panel() { return <p>{String(profileStores)}</p> }\n",
    );
    const listed = real.map((x) =>
      x.path === "modules/accounts/module.ts"
        ? { ...x, source: x.source.replace("capabilities:", "clientPii: ['contact', 'identifier'],\n  capabilities:") }
        : x,
    );
    expect(e1107([...real, panel]).length).toBeGreaterThan(0);
    expect(e1107([...listed, panel])).toEqual([]);
  });

  test("the fix adds 'contact' to the module's `clientPii`, applies with `git apply`, and re-checking reports no E1107", () => {
    for (const listed of [undefined, ["name"]] as const) {
      const files = [module_(listed), f("modules/app/Card.tsx", inline("contact"))];
      const fix = e1107(files)[0]?.fix;
      expect(typeof fix).toBe("string");
      if (fix === undefined) continue;
      const patched = applyFix(files, fix);
      const manifest = patched.find((x) => x.path === "modules/app/module.ts")?.source ?? "";
      expect(manifest).toContain("'contact'");
      if (listed !== undefined) expect(manifest).toContain("'name'");
      expect(e1107(patched)).toEqual([]);
    }
  });

  test("property: a store of class C is E1107 exactly when `clientPii` does not list C, and listing the class named by the fix clears it", () => {
    const cls = fc.constantFrom(...CLASSES);
    fc.assert(
      fc.property(cls, fc.subarray([...CLASSES]), (c, listed) => {
        const files = [module_(listed), f("modules/app/Card.tsx", inline(c))];
        const ds = e1107(files);
        expect(ds.length).toBe(listed.includes(c) ? 0 : 1);
        const fix = ds[0]?.fix;
        if (fix !== undefined) expect(e1107(applyFix(files, fix))).toEqual([]);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});
