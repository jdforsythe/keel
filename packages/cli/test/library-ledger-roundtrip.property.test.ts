// Seed 1337. k.library-pack Own folder and k.library Ledger: the `.keel/ledger.json` `keel ledger --write` writes in a
// library's own folder states the `unsafe` and `hostElements` an app counts over the same files once installed, and
// lists the library's exports with the module id as `pkg`, so the app's E1162 comparison agrees with what it ships.
import { cpSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterAll, expect, it } from "vitest";
import { ledgerCommand } from "../src/internal/ledgerCommand.ts";
import { libraryLedgers } from "../src/internal/libraryLedgers.ts";
import { readProject } from "../src/internal/readProject.ts";

const SEED = 1337;
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const PKG = JSON.stringify({ name: "@acme/charts", version: "1.0.0", type: "module", keel: "library" });
const MANIFEST =
  "import { module } from '@keel/compiler'\nexport default module({ id: 'charts', deps: [], capabilities: [], public: { exports: ['Badge'] } })\n";
const host = (i: number): string =>
  `<Host id={\`\${props.id}.c${i}\`} role="img" label="L" input={In} value={{ n: 1 }} code={() => import('./c.ts').then((m) => m.c)} />`;
const badge = (hosts: number): string =>
  `import { Host } from '@keel/ui'\nconst In = {}\nexport default function Badge(props: { id: string }) {\n  return <div>{${Array.from({ length: hosts }, (_, i) => host(i)).join("")}}</div>\n}\n`;
const unsafeFile = (n: number): string =>
  `declare function unsafe<T>(why: string, fn: () => T): T;\n${Array.from({ length: n }, (_, i) => `export const raw${i} = unsafe("counted", () => ${i});`).join("\n")}\nexport const none = 0\n`;

function write(dir: string, files: Record<string, string>): void {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
}

it("the ledger a library writes in its own folder states the counts an app makes over it installed", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }), (unsafeCalls, hosts) => {
      const lib = realpathSync(tempDir("keel-own-"));
      made.push(lib);
      write(lib, {
        "package.json": PKG,
        "module.ts": MANIFEST,
        "src/Badge.tsx": badge(hosts),
        "src/c.ts": "export const c = undefined\n",
        "unsafe/u.ts": unsafeFile(unsafeCalls),
      });
      const out = ledgerCommand({ write: ".keel/ledger.json" }, { cwd: lib, files: readProject(lib, "ledger") });
      const shipped: unknown = JSON.parse(String(out.writes[0]?.content));
      expect(shipped).toMatchObject({ unsafe: unsafeCalls, hostElements: hosts, libraries: {} });
      expect(Reflect.get(Object(shipped), "exports")).toContainEqual(
        expect.objectContaining({ pkg: "charts", name: "Badge", file: "src/Badge.tsx" }),
      );
      const app = realpathSync(tempDir("keel-app-"));
      made.push(app);
      write(app, {
        "modules/shop/module.ts":
          "import { module } from '@keel/compiler'\nexport default module({ id: 'shop', deps: ['@acme/charts'], capabilities: [], public: { exports: [] } })\n",
      });
      cpSync(lib, join(app, "node_modules/@acme/charts"), { recursive: true });
      const [counted] = libraryLedgers(app, readProject(app, "ledger"));
      expect(counted).toMatchObject({ name: "@acme/charts", unsafe: unsafeCalls, hostElements: hosts });
    }),
    { seed: SEED, numRuns: 8 },
  );
});
