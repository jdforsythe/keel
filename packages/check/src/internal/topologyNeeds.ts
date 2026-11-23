import type { Topology } from "@keel/compiler";
import { dependencyNeed } from "../dependencyNeed.ts";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { lineCol } from "./lineCol.ts";

const NEEDS: Readonly<Record<string, string>> = {
  sqlite: "@keel/std-db",
  postgres: "@keel/std-db",
  capacitor: "@keel/std-capacitor",
  tauri: "@keel/std-tauri",
};
const REVERSE_DNS = /^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+$/;

/**
 * E1572 (k.deploy) and E1573 (k.shell) of `keel check`, at `<dir>topology.ts` on the deployable's key: a `storage` or
 * `shells` whose package `pkg` (the project's `package.json` text; none, or not a JSON object: no E1572) lacks in `dependencies`, once per
 * package, with a fix that adds it; `shells` on a deployable that is not `client`, or a shell `id` that is not
 * reverse-DNS.
 */
export function topologyNeeds(dir: string, topology: Topology, source: string, pkg?: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const at = (name: string, message: string): void => {
    const i = Math.max(0, source.search(new RegExp(`(?<![\\w$-])${name.replace(/\W/g, "\\$&")}\\W?\\s*:`)));
    out.push({
      kind: "diag",
      code: "E1573",
      path: `${dir}topology.ts`,
      ...lineCol(source, i),
      message,
      see: "k.shell",
    });
  };
  const asked = new Set<string>();
  for (const [name, d] of Object.entries(topology)) {
    const shells = Object.entries(d.shells ?? {});
    if (shells.length > 0 && d.adapter !== "client")
      at(name, `${name}: shells need a client deployable, not ${d.adapter}`);
    for (const [shell, s] of shells)
      if (s !== undefined && !REVERSE_DNS.test(s.id))
        at(name, `${name}: ${shell} id ${JSON.stringify(s.id)} is not reverse-DNS (dev.example.app)`);
    for (const want of [d.storage ?? "file", ...shells.map(([k]) => k)]) {
      const dep = NEEDS[want];
      if (dep === undefined || pkg === undefined || asked.has(dep)) continue;
      asked.add(dep);
      const need = dependencyNeed({
        dir,
        source,
        pkg,
        deployable: name,
        dep,
        message: `${name}: ${want} needs ${dep}`,
      });
      if (need !== undefined) out.push(need);
    }
  }
  return out;
}
