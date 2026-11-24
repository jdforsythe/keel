import { isRecord } from "./internal/compat/isRecord.ts";
import { lineCol } from "./internal/lineCol.ts";
import { unifiedDiff } from "./internal/unifiedDiff.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";

/** `text` parsed as JSON, `undefined` when it is not JSON. */
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * E1572 (k.deploy, k.shell Plugins) for one package the app's `package.json` must list: undefined when `pkg` (the
 * `package.json` text) is not a JSON object, or its `dependencies` hold `dep` (with `version`: at exactly that text).
 * Else the diagnostic at `<dir>topology.ts` on the key of `deployable` in `source` (the `topology.ts` text): `message`,
 * then ` <version>` when one is given, else ` in package.json dependencies`, and ` (<need>)` when one is given. Its fix is
 * `package.json` with `dep` added or set in `dependencies`, keys sorted, at `version`, else at the spec of the first
 * `@keel/` dependency (`*` with none).
 */
export function dependencyNeed(at: {
  readonly dir: string;
  readonly source: string;
  readonly pkg: string;
  readonly deployable: string;
  readonly dep: string;
  readonly message: string;
  readonly version?: string | undefined;
  readonly need?: string | undefined;
}): Diagnostic | undefined {
  const value = jsonOf(at.pkg);
  if (!isRecord(value)) return undefined;
  const deps = isRecord(value.dependencies) ? value.dependencies : {};
  if (at.dep in deps && (at.version === undefined || deps[at.dep] === at.version)) return undefined;
  const spec =
    at.version ?? Object.entries(deps).find(([k, v]) => k.startsWith("@keel/") && typeof v === "string")?.[1] ?? "*";
  const sorted = Object.fromEntries(Object.entries({ ...deps, [at.dep]: spec }).sort(([a], [b]) => (a < b ? -1 : 1)));
  const indent = /\n( +|\t)"/.exec(at.pkg)?.[1] ?? "";
  const next = `${JSON.stringify({ ...value, dependencies: sorted }, null, indent)}${at.pkg.endsWith("\n") ? "\n" : ""}`;
  const key = new RegExp(`(?<![\\w$-])${at.deployable.replace(/\W/g, "\\$&")}\\W?\\s*:`);
  return {
    kind: "diag",
    code: "E1572",
    path: `${at.dir}topology.ts`,
    ...lineCol(at.source, Math.max(0, at.source.search(key))),
    message:
      at.version === undefined
        ? `${at.message} in package.json dependencies${at.need === undefined ? "" : ` (${at.need})`}`
        : `${at.message} ${at.version}${at.need === undefined ? "" : ` (${at.need})`}`,
    see: "k.deploy",
    fix: unifiedDiff(`${at.dir}package.json`, at.pkg, next),
  };
}
