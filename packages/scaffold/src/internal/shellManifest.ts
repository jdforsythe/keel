import { SHELL_PACKAGES } from "./SHELL_PACKAGES.ts";
import { jsonText } from "./jsonText.ts";

type Fields = Record<string, unknown>;

const strings = (v: unknown): Fields =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {};
const sorted = (o: Fields): Fields =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/**
 * `package.json` text (`pkg`, its parsed object) listing what a `shell` shell needs (k.scaffold-shell Edits):
 * `@keel/std-<shell>` in `dependencies` at `@keel/server`'s version text there (`^0.0.0` when it lists none), and the
 * shell's app packages (`SHELL_PACKAGES`, the plugins of `identity` too when `identity`) in their fields. A package
 * already in `dependencies` or `devDependencies` is kept as written, except a plugin at another version text, which
 * is set where it is listed. The keys of both fields are sorted.
 */
export function shellManifest(pkg: Readonly<Fields>, shell: "tauri" | "capacitor", identity: boolean): string {
  const deps = strings(pkg.dependencies);
  const dev = strings(pkg.devDependencies);
  const listed = (name: string): boolean => Object.hasOwn(deps, name) || Object.hasOwn(dev, name);
  const table = SHELL_PACKAGES[shell];
  const server = deps["@keel/server"];
  const std = `@keel/std-${shell}`;
  if (!listed(std)) deps[std] = typeof server === "string" ? server : "^0.0.0";
  for (const [name, version] of Object.entries(table.dependencies)) if (!listed(name)) deps[name] = version;
  const plugins = { ...table.plugins, ...(identity ? table.identity : {}) };
  for (const [name, version] of Object.entries(plugins)) {
    if (Object.hasOwn(dev, name) && !Object.hasOwn(deps, name)) dev[name] = version;
    else deps[name] = version;
  }
  for (const [name, version] of Object.entries(table.devDependencies)) if (!listed(name)) dev[name] = version;
  return `${jsonText({ ...pkg, dependencies: sorted(deps), devDependencies: sorted(dev) })}\n`;
}
