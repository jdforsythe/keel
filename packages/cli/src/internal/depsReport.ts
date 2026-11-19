import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Infer } from "@keel/schema";
import type { DepsReport } from "../evidence/DepsReport.ts";
import { isRecord } from "./isRecord.ts";

type Report = Infer<typeof DepsReport>;
type Component = Report["components"][number];

/** One `name@version: resolution: {integrity: ...}` entry of `pnpm-lock.yaml`'s `packages`. */
const LOCKED = /^ {2}'?(@?[^@\s']+)@([^'(:\s]+)[^:\n]*'?:\n {4}resolution: \{integrity: ([^,}\s]+)/gm;

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
};

/** The nearest `pnpm-lock.yaml` at or above `cwd`, as `name@version` -> integrity. */
function integrities(cwd: string): Map<string, string> {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const file = join(dir, "pnpm-lock.yaml");
    if (existsSync(file)) {
      const out = new Map<string, string>();
      for (const m of readFileSync(file, "utf8").matchAll(LOCKED))
        if (m[1] !== undefined && m[2] !== undefined && m[3] !== undefined) out.set(`${m[1]}@${m[2]}`, m[3]);
      return out;
    }
    if (dirname(dir) === dir) return new Map();
  }
}

/** A CycloneDX hash from an SRI integrity (`sha512-<base64>` is `SHA-512` and the digest in hex). */
const hashOf = (integrity: string | undefined): Component["hashes"] => {
  const m = integrity === undefined ? null : /^sha(256|384|512)-(.+)$/.exec(integrity);
  return m?.[1] === undefined || m[2] === undefined
    ? []
    : [{ alg: `SHA-${m[1]}`, content: Buffer.from(m[2], "base64").toString("hex") }];
};

const purlOf = (name: string, version: string): string =>
  `pkg:npm/${name.startsWith("@") ? `%40${name.slice(1)}` : name}@${version}`;

/**
 * Binary only: `deps.json` (k.evidence) for the project at `cwd`: each production dependency `pnpm list --prod --json
 * --depth Infinity` reports, once per name and version, as a CycloneDX 1.5 component with its lockfile integrity and
 * the license its `package.json` states (a workspace link takes the version of the package it links); `advisories`
 * as given. No network request: `pnpm list` reads the install.
 */
export function depsReport(cwd: string, advisories: Report["advisories"]): Report {
  const r = spawnSync("pnpm", ["list", "--prod", "--json", "--depth", "Infinity"], {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
  });
  const parsed: unknown = r.status === 0 ? safeParse(r.stdout) : undefined;
  const locked = integrities(cwd);
  const found = new Map<string, Component>();
  const visit = (deps: unknown): void => {
    if (!isRecord(deps)) return;
    for (const [name, d] of Object.entries(deps)) {
      if (!isRecord(d)) continue;
      const pkg = typeof d.path === "string" ? readJson(join(d.path, "package.json")) : undefined;
      const declared = isRecord(pkg) && typeof pkg.version === "string" ? pkg.version : undefined;
      const listed = typeof d.version === "string" ? d.version : undefined;
      const version = listed === undefined || listed.startsWith("link:") ? declared : listed;
      if (version !== undefined && !found.has(`${name}@${version}`)) {
        const license = isRecord(pkg) && typeof pkg.license === "string" ? pkg.license : undefined;
        found.set(`${name}@${version}`, {
          type: "library",
          name,
          version,
          purl: purlOf(name, version),
          hashes: hashOf(locked.get(`${name}@${version}`)),
          licenses: license === undefined ? [] : [{ license: { name: license } }],
        });
      }
      visit(d.dependencies);
    }
  };
  for (const project of Array.isArray(parsed) ? parsed : []) if (isRecord(project)) visit(project.dependencies);
  const components = [...found.values()].sort((a, b) => (a.purl < b.purl ? -1 : a.purl > b.purl ? 1 : 0));
  return { bomFormat: "CycloneDX", specVersion: "1.5", components, advisories };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
