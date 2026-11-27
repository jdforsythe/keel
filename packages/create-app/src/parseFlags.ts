import type { Flags } from "./Flags.ts";

const VALUED = new Set(["adapter", "library", "name", "format", "limit"]);
const SWITCHES = new Set(["existing", "dry-run", "quiet"]);
const ADAPTERS = ["client", "node", "static"] as const;
const FORMATS = ["compact", "json", "pretty"] as const;

const pick = <T extends string>(options: readonly T[], v: string | undefined): T | undefined =>
  options.find((o) => o === v);

/**
 * `create-app`'s arguments (k.create Flags): one optional folder, the flags with a value (`--adapter node` or
 * `--adapter=node`) and the switches. A second folder, an unknown flag, a flag without its value or a value out of its
 * set is the message of k.cli E1052 (exit 2), returned as `{ usage }`.
 */
export function parseFlags(argv: readonly string[]): Flags | { readonly usage: string } {
  const values = new Map<string, string>();
  const on = new Set<string>();
  const folders: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (!arg.startsWith("--") || arg === "--") {
      if (arg !== "--") folders.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const key = arg.slice(2, eq < 0 ? undefined : eq);
    if (SWITCHES.has(key) && eq < 0) on.add(key);
    else if (VALUED.has(key)) {
      const v = eq < 0 ? argv[i + 1] : arg.slice(eq + 1);
      if (v === undefined || v === "" || (eq < 0 && v.startsWith("--"))) return { usage: `--${key} needs a value` };
      values.set(key, v);
      if (eq < 0) i += 1;
    } else return { usage: `unknown flag ${arg.slice(0, 32)}; see k.create Flags` };
  }
  if (folders.length > 1)
    return { usage: `one folder, not ${folders.length}: ${folders.slice(0, 2).join(", ").slice(0, 40)}` };
  const adapter = pick(ADAPTERS, values.get("adapter"));
  if (values.has("adapter") && adapter === undefined) return { usage: "--adapter is client, node or static" };
  const format = pick(FORMATS, values.get("format"));
  if (values.has("format") && format === undefined) return { usage: "--format is compact, json or pretty" };
  const limitText = values.get("limit");
  const limit = limitText === undefined ? undefined : Number(limitText);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
    return { usage: "--limit is a whole number above 0" };
  return {
    folder: folders[0] ?? ".",
    adapter,
    library: values.get("library"),
    name: values.get("name"),
    existing: on.has("existing"),
    dryRun: on.has("dry-run"),
    format,
    quiet: on.has("quiet"),
    limit,
  };
}
