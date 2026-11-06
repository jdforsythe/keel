import fs from "node:fs";
import path from "node:path";
import { compile } from "./compile.ts";
import { canonicalJson } from "./internal/canonicalJson.ts";
import type { Artifacts } from "./types/Artifacts.ts";

const CODE = /\.[cm]?[jt]sx?$/;

/**
 * The Keel Vite plugin (k.compiler): no options. Lowers JSX in every app module through `compile`, fails
 * the module on diagnostics, and rewrites `.keel/*.json` (read-only, `{ data, hash }`, sorted keys)
 * from all modules seen so far after each transform.
 */
export default function (): {
  name: string;
  enforce: "pre";
  configResolved: (config: { root: string }) => void;
  transform: (code: string, id: string) => { code: string; map: null } | null;
} {
  let root = process.cwd();
  const sources = new Map<string, string>();
  const writeArtifacts = (): void => {
    const files = [...sources.keys()].sort().map((p) => ({ path: p, source: sources.get(p) ?? "" }));
    const r = compile(files);
    const dir = path.join(root, ".keel");
    fs.mkdirSync(dir, { recursive: true });
    const names: (keyof Artifacts)[] = ["a11y.json", "deps.json", "ids.json", "routes.json"];
    for (const name of names) {
      const file = path.join(dir, name);
      fs.rmSync(file, { force: true });
      fs.writeFileSync(file, `${canonicalJson({ data: r.artifacts[name], hash: r.hashes[name] })}\n`);
      fs.chmodSync(file, 0o444);
    }
  };
  return {
    name: "keel",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      const file = id.split("?")[0] ?? id;
      if (!CODE.test(file) || file.includes("/node_modules/") || file.endsWith(".d.ts")) return null;
      const rel = path.relative(root, file).split(path.sep).join("/");
      sources.set(rel, code);
      const r = compile([{ path: rel, source: code }]);
      writeArtifacts();
      const failures = r.diagnostics.filter((d) => !/^[WI]/.test(d.code));
      if (failures.length > 0) {
        throw new Error(failures.map((d) => `${d.code} ${d.path}:${d.line}:${d.col} ${d.message}`).join("\n"));
      }
      const out = r.outputs[0];
      return out === undefined ? null : { code: out.code, map: null };
    },
  };
}
