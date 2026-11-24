import { isReverseDns } from "@keel/compiler/hosting/isReverseDns";
import type { Result } from "@keel/schema";
import type { Edit } from "../types/Edit.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import type { Writes } from "./Writes.ts";
import { badInput } from "./badInput.ts";
import { commit } from "./commit.ts";
import { declareShell } from "./declareShell.ts";
import { fail } from "./fail.ts";
import { inputs } from "./inputs.ts";
import { keyName } from "./keyName.ts";
import { lineCol } from "./lineCol.ts";
import { propertyValue } from "./propertyValue.ts";
import { shellManifest } from "./shellManifest.ts";
import { shellName } from "./shellName.ts";
import { topologyAst } from "./topologyAst.ts";

const SEE = "k.scaffold-shell";
const KINDS = ["tauri", "capacitor"] as const;
const AT = { line: 1, col: 1 };

const refuse = (code: string, path: string, message: string, at = AT): Result<never, ScaffoldError> =>
  fail(code, path, message, undefined, at, SEE);

/** `a`, `a and b`, `a, b and c`. */
const listed = (names: readonly string[]): string =>
  names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;

/**
 * `scaffold shell <tauri|capacitor>` (k.scaffold-shell): the deployable `to` (default: the topology's one `client`
 * deployable) declares the shell with `id` and `name` (default: the title-cased `package.json` `name`) in
 * `topology.ts`, and `package.json` lists the shell's std package and app packages. Changes those two files alone and
 * refreshes nothing. Refusals, in order: E1052 for the input, a missing `topology.ts` or a `package.json` that is not
 * a JSON object; E1353 naming E1573 for an `id` that is not reverse-DNS; E1359 with no one `client` deployable to
 * take the shell; E1351 when it already declares that shell; E1052 when it or its `shells` is not an object literal.
 */
export function opShell(input: unknown, files: ReadonlyMap<string, string>): Result<Edit, ScaffoldError> {
  const r = inputs.shell.parse(input);
  if (!r.ok) return badInput("shell", r.error);
  const { id, name, to } = r.value;
  const shell = KINDS.find((k) => k === r.value.shell);
  if (shell === undefined) return refuse("E1052", "topology.ts", "shell takes tauri or capacitor");
  if (id === undefined || id === "")
    return refuse("E1052", "topology.ts", "shell needs --id, a reverse-DNS app id such as com.acme.shop");
  const text = files.get("package.json");
  let pkg: unknown = null;
  try {
    pkg = text === undefined ? null : JSON.parse(text);
  } catch {
    pkg = null;
  }
  if (typeof pkg !== "object" || pkg === null || Array.isArray(pkg))
    return refuse("E1052", "package.json", "package.json is not a JSON object");
  const manifest: Record<string, unknown> = Object.fromEntries(Object.entries(pkg));
  const pkgName = manifest.name;
  const title = name !== undefined && name !== "" ? name : typeof pkgName === "string" ? shellName(pkgName) : "";
  if (title === "") return refuse("E1052", "package.json", "package.json has no name to title the shell; pass --name");
  const src = files.get("topology.ts");
  if (src === undefined) return refuse("E1052", "topology.ts", "shell needs topology.ts");
  const ast = topologyAst(src);
  if (ast === null) return refuse("E1052", "topology.ts", "topology.ts has no topology({ ... }) object to edit");
  const names = ast.obj.properties.map((p) => keyName(p)).filter((n) => n !== null);
  if (to !== undefined && !names.includes(to))
    return refuse("E1052", "topology.ts", "--to names no deployable of topology.ts");
  if (!isReverseDns(id))
    return fail(
      "E1353",
      "topology.ts",
      "operation aborted, would introduce E1573: id is not reverse-DNS; nothing written",
      { code: "E1573", path: "topology.ts", line: 1, message: `${shell} id ${JSON.stringify(id)} is not reverse-DNS` },
      AT,
      SEE,
    );
  const read = new Set(ast.deployables.map((d) => d.name));
  const unread = names.filter((n) => !read.has(n));
  const clients = ast.deployables.filter((d) => d.adapter === "client");
  const where = (offset: number): { line: number; col: number } => lineCol(src, offset);
  const literal = (n: string): string => `topology.ts deployable ${n} is not an object literal`;
  let target = ast.deployables.find((d) => d.name === to);
  if (to !== undefined && target === undefined) return refuse("E1052", "topology.ts", literal(to));
  if (target !== undefined && target.adapter !== "client")
    return refuse(
      "E1359",
      "topology.ts",
      `${target.name} is a ${target.adapter} deployable; a ${shell} shell needs a client one`,
      where(target.prop.start),
    );
  if (target === undefined) {
    const first = unread[0];
    if (first !== undefined) return refuse("E1052", "topology.ts", `${literal(first)}; pass --to`);
    const [one, two] = clients;
    if (one === undefined)
      return refuse("E1359", "topology.ts", `topology.ts has no client deployable for a ${shell} shell`);
    if (two !== undefined)
      return refuse(
        "E1359",
        "topology.ts",
        `${listed(clients.map((d) => d.name))} are client deployables; pass --to with one`,
        where(one.prop.start),
      );
    target = one;
  }
  const value = target.prop.type === "Property" ? target.prop.value : null;
  const shells = value?.type === "ObjectExpression" ? propertyValue(value, "shells") : null;
  if (shells?.type === "ObjectExpression" && propertyValue(shells, shell) !== null)
    return refuse("E1351", "topology.ts", `${target.name} already declares a ${shell} shell`, where(target.prop.start));
  const next = declareShell(src, target.name, shell, id, title);
  if (next === null) return refuse("E1052", "topology.ts", `the shells of ${target.name} are not an object literal`);
  const writes: Writes = new Map([
    ["topology.ts", next],
    ["package.json", shellManifest(manifest, shell, files.has("identity.ts"))],
  ]);
  return commit(files, writes);
}
