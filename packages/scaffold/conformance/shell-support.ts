// Shared by the k.scaffold-shell conformance files. Not a test file.
// ASSUMED API: the operation is `scaffold("shell", { shell, id, name?, to? }, files)` (RFC 0201), the same pure function as every other operation.
// `scaffold`'s `Op` type does not name `shell` until the operation is built, so the call goes through `Reflect.apply`, which keeps this file type-correct before and after.
// Project `p` is `keel scaffold project p`; `pw` is `keel scaffold project native-tauri --workspace` (k.scaffold-shell Conformance).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scaffold } from "@keel/scaffold";
import { type Files, apply, read } from "./fixtures.ts";
import { root } from "./keel-cli.ts";

export type ShellInput = { shell: string; id?: string; name?: string; to?: string };
export type ShellResult =
  | { ok: true; value: { files: Files; created: readonly string[]; changed: readonly string[] } }
  | { ok: false; error: unknown };

export function shell(input: ShellInput, files: Files): ShellResult {
  return Reflect.apply(scaffold, undefined, ["shell", input, files]);
}
export function shellApply(input: ShellInput, files: Files): Files {
  const r = shell(input, files);
  if (!r.ok) throw new Error(`shell failed: ${JSON.stringify(r.error)}`);
  return r.value.files;
}

export const p = (): Files => apply("project", { name: "p" }, new Map()).files;
export const pw = (): Files => apply("project", { name: "native-tauri", workspace: true }, new Map()).files;
export const pNode = (): Files => apply("project", { name: "q", adapter: "node" }, new Map()).files;

export function rec(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {};
}
export function manifest(files: Files): Record<string, unknown> {
  return rec(JSON.parse(read(files, "package.json")));
}
export function section(files: Files, key: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec(manifest(files)[key]))) if (typeof v === "string") out[k] = v;
  return out;
}
/** The entries of `after`'s `key` object that `before`'s lacks or holds at another text. */
export function added(before: Files, after: Files, key: string): Record<string, string> {
  const was = section(before, key);
  return Object.fromEntries(Object.entries(section(after, key)).filter(([k, v]) => was[k] !== v));
}
export const isSorted = (o: Record<string, unknown>): boolean =>
  JSON.stringify(Object.keys(o)) === JSON.stringify([...Object.keys(o)].sort());

/** `package.json` with `mutate` applied to its parsed object. */
export function editManifest(files: Files, mutate: (m: Record<string, unknown>) => void): Files {
  const m = manifest(files);
  mutate(m);
  const out = new Map(files);
  out.set("package.json", `${JSON.stringify(m, null, 2)}\n`);
  return out;
}
export const withIdentity = (files: Files): Files => new Map(files).set("identity.ts", "export {};\n");
export const withTopology = (files: Files, src: string): Files => new Map(files).set("topology.ts", src);

/** A topology with client deployables `web` and `admin` and a node deployable `api`, each on its own module. */
export function multiTopology(): Files {
  let files = p();
  files = apply("module", { id: "admin" }, files).files;
  files = apply("module", { id: "orders" }, files).files;
  return withTopology(
    files,
    [
      `import { topology } from "@keel/server";`,
      "",
      "export default topology({",
      `  web: { modules: ["app"], adapter: "client" },`,
      `  admin: { modules: ["admin"], adapter: "client" },`,
      `  api: { modules: ["orders"], adapter: "node" },`,
      "});",
      "",
    ].join("\n"),
  );
}

/** The source with whitespace outside strings dropped, quotes as `"` and trailing commas removed. */
export function squash(src: string): string {
  let out = "";
  let inStr = false;
  for (const ch of src.replaceAll("'", '"')) {
    if (ch === '"') inStr = !inStr;
    if (!inStr && /\s/.test(ch)) continue;
    out += ch;
  }
  return out.replace(/,(?=[}\])])/g, "");
}

/** What a shell package declares in its own `package.json` (the source of every version the operation writes). */
export function declared(pkg: "std-tauri" | "std-capacitor", fieldName: string, name: string): string {
  const file = join(resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", pkg), "package.json");
  const v = rec(rec(JSON.parse(readFileSync(file, "utf8")))[fieldName])[name];
  if (typeof v !== "string") throw new Error(`@keel/${pkg} declares no ${name} in ${fieldName}`);
  return v;
}

export function serverText(files: Files): string {
  const v = section(files, "dependencies")["@keel/server"];
  if (v === undefined) throw new Error("the project lists no @keel/server");
  return v;
}

/** The compact (default format) output of `keel`, line by line. */
export function keelText(dir: string, args: string[]): { status: number | null; lines: string[] } {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [join(root, "packages/cli/src/bin.ts"), ...args], {
    cwd: dir,
    encoding: "utf8",
    env,
    timeout: 110_000,
  });
  return { status: r.status, lines: r.stdout.split("\n").filter((l) => l.trim() !== "") };
}

export const BOUND = 120_000;
