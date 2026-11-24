// Not a test file. The on-disk project that E1013's cases resolve specifiers in (k.bundle Aliases): `package.json` with `imports` and
// `exports`, `node_modules` links into `modules/notes`, a `tsconfig.json` with `paths` (never read), and the files of `BASE`.
// `check(files, { root })` takes the same files in memory; the disk holds them so the links resolve to a real path under `modules/`.
import fs from "node:fs";
import path from "node:path";
import type { Files } from "./support.ts";

const f = (p: string, source: string): Files[number] => ({ path: p, source });
const manifest = (id: string, deps: string[], exports: string[]): Files[number] => {
  const q = (xs: string[]): string => `[${xs.map((x) => `'${x}'`).join(", ")}]`;
  return f(
    `modules/${id}/module.ts`,
    `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${q(deps)}, capabilities: [], public: { exports: ${q(exports)} } })\n`,
  );
};

/** The project's files: module `app` (deps `notes`) and `notes` (public `lib`, `T`), and `lib/x.ts` outside `modules/`. */
export const BASE: Files = [
  manifest("app", ["notes"], []),
  manifest("notes", [], ["lib", "T"]),
  f("modules/app/Page.tsx", "export const Page = 1\n"),
  f("modules/notes/lib.ts", "export const lib = 'x'\n"),
  f("modules/notes/T.ts", "export type T = string\n"),
  f("lib/x.ts", "export const x = 1\n"),
];

const PACKAGE = {
  name: "fx",
  private: true,
  type: "module",
  imports: { "#notes/*": "./modules/notes/*", "#app/*": "./modules/app/*", "#lib/*": "./lib/*" },
  exports: { "./notes/*": "./modules/notes/*" },
};
const TSCONFIG = { compilerOptions: { baseUrl: ".", paths: { "@/*": ["./modules/*"] } } };

/** Writes the project (the files of `files`, `package.json`, `tsconfig.json`, the links) to `root`, an existing empty folder. */
export function writeProject(root: string, files: Files): void {
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file.path)), { recursive: true });
    fs.writeFileSync(path.join(root, file.path), file.source);
  }
  fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify(PACKAGE)}\n`);
  fs.writeFileSync(path.join(root, "tsconfig.json"), `${JSON.stringify(TSCONFIG)}\n`);
  fs.mkdirSync(path.join(root, "node_modules", "@fx"), { recursive: true });
  // A symlink to the module's folder, and the relative link a workspace manager writes.
  fs.symlinkSync(path.join("..", "modules", "notes"), path.join(root, "node_modules", "linked-notes"));
  fs.symlinkSync(path.join("..", "..", "modules", "notes"), path.join(root, "node_modules", "@fx", "notes"));
}

/** A root holding `BASE`, written once to `conformance/.tmp-e1013/` (git-ignored) through a fresh folder renamed into place. */
export function sharedRoot(): string {
  const root = path.join(import.meta.dirname, ".tmp-e1013");
  if (fs.existsSync(path.join(root, "node_modules", "linked-notes"))) return path.join(fs.realpathSync(root), path.sep);
  const tmp = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-e1013-"));
  writeProject(tmp, BASE);
  try {
    fs.renameSync(tmp, root);
  } catch {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return path.join(fs.realpathSync(root), path.sep);
}
