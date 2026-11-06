import fs from "node:fs";
import path from "node:path";
import { compile } from "./compile.ts";
import { canonicalJson } from "./internal/canonicalJson.ts";
import { hashOf } from "./internal/hashOf.ts";
import { mergeArtifacts } from "./internal/mergeArtifacts.ts";
import type { Artifacts } from "./types/Artifacts.ts";
import type { Output } from "./types/Output.ts";

const CODE = /\.[cm]?[jt]sx?$/;
const NAMES: readonly (keyof Artifacts)[] = ["a11y.json", "deps.json", "ids.json", "routes.json"];

type Entry = { source: string; output: Output | undefined; artifacts: Artifacts; failures: string[] };

/**
 * The Keel Vite plugin (k.compiler): no options. Each transform compiles only the changed module
 * (cached by source text), fails the module on diagnostics, and merges its artifacts with those of the
 * other modules seen so far. `.keel/<name>` (`{ data, hash }`, sorted keys, read-only) is rewritten
 * atomically (temp file + rename) and only when its content changed. Deleted modules are evicted.
 */
export default function (): {
  name: string;
  enforce: "pre";
  configResolved: (config: { root: string }) => void;
  transform: (code: string, id: string) => { code: string; map: null } | null;
  watchChange: (id: string, change: { event: "create" | "update" | "delete" }) => void;
} {
  let root = process.cwd();
  const modules = new Map<string, Entry>();
  const written = new Map<string, string>();
  const relOf = (id: string): string | null => {
    const file = id.split("?")[0] ?? id;
    if (!CODE.test(file) || file.includes("/node_modules/") || file.endsWith(".d.ts")) return null;
    return path.relative(root, file).split(path.sep).join("/");
  };
  const flush = (): { id: string; file: string }[] => {
    const keys = [...modules.keys()].sort();
    const parts: Artifacts[] = [];
    for (const k of keys) {
      const e = modules.get(k);
      if (e !== undefined) parts.push(e.artifacts);
    }
    const { artifacts, duplicates } = mergeArtifacts(parts);
    const dir = path.join(root, ".keel");
    fs.mkdirSync(dir, { recursive: true });
    for (const name of NAMES) {
      const text = `${canonicalJson({ data: artifacts[name], hash: hashOf(artifacts[name]) })}\n`;
      if (written.get(name) === text) continue;
      const file = path.join(dir, name);
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, text);
      fs.chmodSync(tmp, 0o444);
      fs.renameSync(tmp, file);
      written.set(name, text);
    }
    return duplicates;
  };
  return {
    name: "keel",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      const rel = relOf(id);
      if (rel === null) return null;
      let entry = modules.get(rel);
      if (entry === undefined || entry.source !== code) {
        const r = compile([{ path: rel, source: code }]);
        const failures = r.diagnostics
          .filter((d) => !/^[WI]/.test(d.code))
          .map((d) => `${d.code} ${d.path}:${d.line}:${d.col} ${d.message}`);
        entry = { source: code, output: r.outputs[0], artifacts: r.artifacts, failures };
        modules.set(rel, entry);
      }
      const dupes = flush()
        .filter((d) => d.file === rel)
        .map((d) => `E1404 ${rel} duplicate element id "${d.id.slice(0, 30)}" (also in another module)`);
      const failures = [...entry.failures, ...dupes];
      if (failures.length > 0) throw new Error(failures.join("\n"));
      return entry.output === undefined ? null : { code: entry.output.code, map: null };
    },
    watchChange(id, change) {
      if (change.event !== "delete") return;
      const rel = relOf(id);
      if (rel !== null && modules.delete(rel)) flush();
    },
  };
}
