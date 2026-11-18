import type { Topology } from "@keel/compiler";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { isRecord } from "./compat/isRecord.ts";
import { lineCol } from "./lineCol.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

const NEEDS: Readonly<Record<string, string>> = {
  sqlite: "@keel/std-db",
  postgres: "@keel/std-db",
  capacitor: "@keel/std-capacitor",
  tauri: "@keel/std-tauri",
};
const REVERSE_DNS = /^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+$/;

/** `text` parsed as JSON, `undefined` when it is not JSON. */
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** `pkg` (a `package.json` text) with `dep` added to `dependencies` (sorted), at the spec of its first `@keel/` one. */
function withDependency(pkg: string, value: Record<string, unknown>, dep: string): string {
  const deps = isRecord(value.dependencies) ? value.dependencies : {};
  const spec = Object.entries(deps).find(([k, v]) => k.startsWith("@keel/") && typeof v === "string")?.[1] ?? "*";
  const sorted = Object.fromEntries(Object.entries({ ...deps, [dep]: spec }).sort(([a], [b]) => (a < b ? -1 : 1)));
  const indent = /\n( +|\t)"/.exec(pkg)?.[1] ?? "";
  return `${JSON.stringify({ ...value, dependencies: sorted }, null, indent)}${pkg.endsWith("\n") ? "\n" : ""}`;
}

/**
 * E1572 (k.deploy) and E1573 (k.shell) of `keel check`, at `<dir>topology.ts` on the deployable's key: a `storage` or
 * `shells` whose package `pkg` (the project's `package.json` text; none, or not a JSON object: no E1572) lacks in `dependencies`, once per
 * package, with a fix that adds it; `shells` on a deployable that is not `client`, or a shell `id` that is not
 * reverse-DNS.
 */
export function topologyNeeds(dir: string, topology: Topology, source: string, pkg?: string): Diagnostic[] {
  const parsed = pkg === undefined ? undefined : jsonOf(pkg);
  const value: Record<string, unknown> | undefined = isRecord(parsed) ? parsed : undefined;
  const has = (dep: string): boolean => isRecord(value?.dependencies) && dep in value.dependencies;
  const out: Diagnostic[] = [];
  const at = (name: string, code: string, message: string, fix?: string): void => {
    const i = Math.max(0, source.search(new RegExp(`(?<![\\w$-])${name.replace(/\W/g, "\\$&")}\\W?\\s*:`)));
    const see = code === "E1572" ? "k.deploy" : "k.shell";
    out.push({
      kind: "diag",
      code,
      path: `${dir}topology.ts`,
      ...lineCol(source, i),
      message,
      see,
      ...(fix ? { fix } : {}),
    });
  };
  const asked = new Set<string>();
  for (const [name, d] of Object.entries(topology)) {
    const shells = Object.entries(d.shells ?? {});
    if (shells.length > 0 && d.adapter !== "client")
      at(name, "E1573", `${name}: shells need a client deployable, not ${d.adapter}`);
    for (const [shell, s] of shells)
      if (s !== undefined && !REVERSE_DNS.test(s.id))
        at(name, "E1573", `${name}: ${shell} id ${JSON.stringify(s.id)} is not reverse-DNS (dev.example.app)`);
    for (const want of [d.storage ?? "file", ...shells.map(([k]) => k)]) {
      const dep = NEEDS[want];
      if (dep === undefined || pkg === undefined || value === undefined || has(dep) || asked.has(dep)) continue;
      asked.add(dep);
      const fix = unifiedDiff(`${dir}package.json`, pkg, withDependency(pkg, value, dep));
      at(name, "E1572", `${name}: ${want} needs ${dep} in package.json dependencies`, fix);
    }
  }
  return out;
}
