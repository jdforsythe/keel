import { readManifest } from "./readManifest.ts";

/**
 * The environment variables a `node` deployable serving `modules` needs (k.server-deps Environment), sorted, each once:
 * the `env` of each module's `modules/<id>/module.ts` and of each library those manifests list in `deps` (an `@` entry,
 * its manifest at `node_modules/<name>/module.ts` of `files`), and transitively of each library a library lists.
 */
export function deployEnv(files: ReadonlyMap<string, string>, modules: readonly string[]): string[] {
  const read = (p: string) => readManifest(p, files.get(p) ?? "");
  const names = new Set<string>();
  const seen = new Set<string>();
  const todo = modules.map((m) => `modules/${m}/module.ts`);
  for (let p = todo.pop(); p !== undefined; p = todo.pop()) {
    if (seen.has(p)) continue;
    seen.add(p);
    const m = read(p);
    for (const n of m?.env ?? []) names.add(n);
    for (const d of m?.deps ?? []) if (d.startsWith("@")) todo.push(`node_modules/${d}/module.ts`);
  }
  return [...names].sort();
}
