// Spec: k.leave, Snapshots "The check reports E1107 at a `store` call in a `.tsx` or `.jsx` file not named `*.server.*`, or in a file one reaches by relative `import`, `export … from` and literal `import()` through no `*.server.*` file, whose state schema holds a `.pii(class)` node of a class its module manifest's `clientPii` (a list of `PiiClass`, default empty) does not list; the fix adds the class. That reach is narrower than k.boundary's: a plain `.ts` file no component file imports, say one only loaders use, is not in it, and a store an island finds only by `stores()` id or a package import is not reported."
// Spec: k.leave, Rules "E1107 a `.pii()` class reaching `#k-state` that `clientPii` does not list (fix adds it)"
// Spec: k.leave, Conformance "`store(Contact, …)` with `email: s.string().pii('contact')` in a component file is E1107 when the module has no `clientPii`, and with `clientPii: ['name']`; with `clientPii: ['contact']`, or in a `*.server.ts` file, it is not; the fix adds `'contact'`."
// Seed 1337 (the properties below). The type pass is off: the fixtures name packages that resolve only on disk.
// The negatives read the modules under fixtures/pii-server-only/ by realFiles.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { applyFix } from "./E1258-support.ts";
import { realFiles } from "./E1406-support.ts";
import { topologyOf } from "./boundary-support.ts";
import { type Files, SEED } from "./support.ts";

const NO_TYPES = { types: false } as const;
const PII_FIXTURE = "packages/check/conformance/fixtures/pii-server-only";
const f = (path: string, source: string): Files[number] => ({ path, source });
const CLASSES = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;

const module_ = (clientPii?: readonly string[]): Files[number] =>
  f(
    "modules/app/module.ts",
    `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [] }${
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

  test("negative: a module whose `.pii('contact')` and `.pii('identifier')` stores are reached only from `*.server.ts` files reports no E1107", () => {
    const files = realFiles(`${PII_FIXTURE}/modules/app`, "modules/app");
    expect(files.map((x) => x.path)).toContain("modules/app/contacts.server.ts");
    expect(e1107(files)).toEqual([]);
  });

  test("negative: a client module whose store schema holds no `.pii` node reports no E1107", () => {
    const files = realFiles(`${PII_FIXTURE}/modules/plain`, "modules/plain");
    expect(files.map((x) => x.path)).toContain("modules/plain/PlainCard.tsx");
    expect(e1107(files)).toEqual([]);
  });

  test("control: the same schema stored in a client component is E1107, so the fixture holds what E1107 reads", () => {
    const files = realFiles(`${PII_FIXTURE}/modules/app`, "modules/app");
    const client = f(
      "modules/app/Show.tsx",
      "import { store } from '@keel/store'\nimport { Contact } from './Contact.schema.ts'\nexport const shown = store(Contact, { email: '', userId: '' })\n",
    );
    expect(e1107([...files, client])).toHaveLength(1);
  });

  test("a profile store module with `contact` and `identifier` pii, made reachable from a client component, is E1107 for both classes, and clean once the module lists them", () => {
    const profile = f(
      "modules/accounts/Profile.schema.ts",
      "import { s } from '@keel/schema'\nexport const Profile = s.object({ userId: s.string().pii('identifier'), email: s.string().pii('contact') })\nexport const Profiles = s.object({ profiles: s.array(Profile) })\n",
    );
    const stores = f(
      "modules/accounts/profileStores.ts",
      "import { store } from '@keel/store'\nimport { Profiles } from './Profile.schema.ts'\nexport const profileStores = () => ({ profiles: store(Profiles, { profiles: [] }, { id: 'accounts.profiles' }) })\n",
    );
    const manifest = (clientPii: string): Files[number] =>
      f(
        "modules/accounts/module.ts",
        `import { module } from '@keel/compiler'\nexport default module({ id: 'accounts', deps: [], capabilities: [], public: { exports: [] }${clientPii} })\n`,
      );
    const panel = f(
      "modules/accounts/Panel.tsx",
      "import { profileStores } from './profileStores.ts'\nexport default function Panel() { return <p>{String(profileStores)}</p> }\n",
    );
    expect(e1107([manifest(""), profile, stores, panel]).length).toBeGreaterThan(0);
    expect(e1107([manifest(", clientPii: ['contact', 'identifier']"), profile, stores, panel])).toEqual([]);
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

describe("k.leave Snapshots: the reach of E1107 is narrower than k.boundary's", () => {
  const stores = f("modules/app/stores.ts", inline("contact"));
  const loadServer = f(
    "modules/app/load.server.ts",
    "import { card } from './stores.ts'\nexport const load = () => card\n",
  );
  const cardTsx = f(
    "modules/app/Card.tsx",
    "import { card } from './stores.ts'\nexport default function Card() { return <p>{String(card)}</p> }\n",
  );
  const topology = topologyOf({ api: { modules: ["app"], adapter: "node" } });

  test("a `.pii('contact')` store in `modules/app/stores.ts` that only `load.server.ts` imports is clean without a `topology.ts`", () => {
    expect(e1107([module_(), stores, loadServer])).toEqual([]);
  });

  test("the same file is clean with a `topology.ts` listing the module on a `node` deployable", () => {
    expect(e1107([topology, module_(), stores, loadServer])).toEqual([]);
  });

  test("the same file imported by `Card.tsx` is one E1107 at `stores.ts`, with and without a `topology.ts`", () => {
    for (const files of [
      [module_(), stores, loadServer, cardTsx],
      [topology, module_(), stores, loadServer, cardTsx],
    ]) {
      const ds = e1107(files);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.path).toBe("modules/app/stores.ts");
    }
  });
});
