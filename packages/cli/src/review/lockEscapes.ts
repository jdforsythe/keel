import type { Raw } from "./Raw.ts";

const PNPM_RESOLUTION = /^(\s+)resolution:\s*\{(.*)\}\s*$/;
const YARN_RESOLVED = /^\s+resolved\s+"?([^"\s]+)"?\s*$/;
const isBag = (v: unknown): v is { readonly [k: string]: unknown } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * R1101 in a lockfile (k.escapes): a `pnpm-lock.yaml` `resolution:` holding more than `integrity` (a tarball, a git
 * repository, a directory), or a `package-lock.json` or `yarn.lock` `resolved` that is not `https:`. Each finding's
 * text names the entry and its resolution.
 */
export function lockEscapes(name: string, source: string): Raw[] {
  const out: Raw[] = [];
  const lines = source.split("\n");
  if (name === "pnpm-lock.yaml")
    lines.forEach((line, i) => {
      const m = PNPM_RESOLUTION.exec(line);
      if (m === null) return;
      const keys = [...(m[2] ?? "").matchAll(/(?:^|,)\s*([\w-]+):/g)].map((k) => k[1]);
      if (keys.every((k) => k === "integrity")) return;
      const lead = (m[1] ?? "").length;
      let owner = "";
      for (let j = i - 1; j >= 0 && owner === ""; j--) {
        const l = lines[j] ?? "";
        if (l.trim() !== "" && l.length - l.trimStart().length < lead) owner = l.trim();
      }
      out.push({ code: "R1101", line: i + 1, col: lead + 1, text: `${owner} ${line.trim()}`, message: `${owner.replace(/:$/, "")} resolved outside the registry` });
    });
  if (name === "yarn.lock")
    lines.forEach((line, i) => {
      const m = YARN_RESOLVED.exec(line);
      if (m !== null && !(m[1] ?? "").startsWith("https:"))
        out.push({ code: "R1101", line: i + 1, col: 1, text: line.trim(), message: "a dependency resolved outside the registry" });
    });
  if (name === "package-lock.json") {
    let lock: unknown;
    try {
      lock = JSON.parse(source);
    } catch {
      return [];
    }
    const packages = isBag(lock) && isBag(lock.packages) ? lock.packages : {};
    for (const [key, entry] of Object.entries(packages)) {
      const resolved = isBag(entry) ? entry.resolved : undefined;
      if (typeof resolved !== "string" || resolved.startsWith("https:") || (isBag(entry) && entry.link === true)) continue;
      const i = source.indexOf(JSON.stringify(resolved));
      out.push({
        code: "R1101",
        line: i < 0 ? 1 : source.slice(0, i).split("\n").length,
        col: 1,
        text: `${JSON.stringify(key)}: ${JSON.stringify(resolved)}`,
        message: `${key.replace(/^.*node_modules\//, "")} resolved outside the registry`,
      });
    }
  }
  return out;
}
