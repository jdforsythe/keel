import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseTopology } from "@keel/compiler";
import type { Deployable } from "./Deployable.ts";
import type { ProjectInfo } from "./ProjectInfo.ts";
import { composeRequired } from "./composeRequired.ts";
import { e2eError } from "./e2eError.ts";
import { idHeads } from "./idHeads.ts";

const SOURCE = /\.(?:ts|tsx)$/;
const SKIP = new Set(["node_modules", "dist", ".keel", ".keel-dev", "reports", "test"]);

function sources(dir: string, out: string[] = []): string[] {
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names) {
    if (SKIP.has(n) || n.startsWith(".")) continue;
    const full = join(dir, n);
    if (SOURCE.test(n)) out.push(readFileSync(full, "utf8"));
    else if (!n.includes(".")) sources(full, out);
  }
  return out;
}

/** The folders of the Keel libraries (`"keel": "library"`) the project's `package.json` lists. */
function libraries(dir: string): string[] {
  const pkg: unknown = JSON.parse(read(join(dir, "package.json")) ?? "{}");
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies"]) {
    const deps: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, field) : undefined;
    if (typeof deps === "object" && deps !== null) for (const n of Object.keys(deps)) names.add(n);
  }
  return [...names].flatMap((n) => {
    const at = join(dir, "node_modules", n);
    const own: unknown = JSON.parse(read(join(at, "package.json")) ?? "{}");
    return typeof own === "object" && own !== null && Reflect.get(own, "keel") === "library" ? [at] : [];
  });
}

const read = (path: string): string | undefined => (existsSync(path) ? readFileSync(path, "utf8") : undefined);

/**
 * A built project as `serve` needs it: its deployables from `topology.ts` (read, never run), the variables
 * `deploy/compose.yaml` marks required for each, and the ids its pages can show: `.keel/ids.json`'s, an id under one
 * of them, under the fixed head or tail of a template id its or its libraries' source writes (a keyed row, a
 * library component's own), and a form field's (`<formId>:<path>`). A project with no `topology.ts` is E1737.
 */
export function readProject(dir: string): ProjectInfo {
  const source = read(join(dir, "topology.ts"));
  if (source === undefined) throw e2eError("E1737", `no topology.ts in ${dir}: nothing to serve`, { dir });
  const { topology } = parseTopology(source);
  const required = composeRequired(read(join(dir, "deploy", "compose.yaml")) ?? "");
  const deployables: Deployable[] = Object.entries(topology).map(([name, d]) => ({
    name,
    adapter: d.adapter,
    modules: d.modules,
    ...(d.servedBy === undefined ? {} : { servedBy: d.servedBy }),
    storage: d.storage ?? "file",
    required: required.get(name) ?? [],
  }));
  const idsText = read(join(dir, ".keel", "ids.json"));
  const parsed: unknown = idsText === undefined ? {} : JSON.parse(idsText);
  const data = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "data") : undefined;
  const ids = new Set(typeof data === "object" && data !== null ? Object.keys(data) : []);
  const heads = idHeads([...sources(join(dir, "modules")), ...libraries(dir).flatMap((d) => sources(join(d, "src")))]);
  // A form's field is `<formId>:<path>`, its form id often a hash of its schema (k.forms Bindings): never in ids.json.
  const knows = (id: string): boolean =>
    ids.has(id) ||
    id.includes(":") ||
    heads.some((h) => (h.startsWith(".") ? id.endsWith(h) : id.startsWith(h))) ||
    [...ids].some((k) => id.startsWith(`${k}.`));
  return { dir, deployables, ids: [...ids].sort(), knows };
}
