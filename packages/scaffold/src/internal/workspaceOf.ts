import { posix } from "node:path";
import { folderAbove } from "./folderAbove.ts";

const parse = (text: string | undefined): unknown => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null;
  }
};
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** A `package.json`'s `workspaces` globs (an array, or `{ packages }`); undefined when it has none. */
function packageGlobs(text: string | undefined): string[] | undefined {
  const pkg = parse(text);
  const w: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "workspaces") : undefined;
  if (Array.isArray(w)) return strings(w);
  if (typeof w === "object" && w !== null) return strings(Reflect.get(w, "packages"));
  return undefined;
}

/** The `packages:` list of a `pnpm-workspace.yaml`: its `- <glob>` lines, unquoted. */
function pnpmGlobs(text: string): string[] {
  const out: string[] = [];
  let inside = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^packages:\s*$/.test(line)) inside = true;
    else if (/^\S/.test(line)) inside = false;
    else if (inside) {
      const m = /^\s+-\s+(.+?)\s*$/.exec(line);
      if (m?.[1] !== undefined) out.push(m[1].replace(/^(["'])(.*)\1$/, "$2"));
    }
  }
  return out;
}

/** A package glob (`*` one segment, `**` any) as a regular expression over a `/`-separated path. */
function globRegex(glob: string): RegExp {
  const g = glob.replace(/^\.\//, "").replace(/\/+$/, "");
  let src = "";
  for (let i = 0; i < g.length; i += 1) {
    const c = g[i] ?? "";
    if (c === "*" && g[i + 1] === "*") {
      src += ".*";
      i += 1;
    } else if (c === "*") src += "[^/]*";
    else src += /[\\^$.|?+()[\]{}]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${src}$`);
}

/** Whether `path` is one of `globs`' packages: matched by a glob and by no `!` glob. */
function inGlobs(path: string, globs: readonly string[]): boolean {
  const yes = globs.filter((g) => !g.startsWith("!")).some((g) => globRegex(g).test(path));
  return yes && !globs.filter((g) => g.startsWith("!")).some((g) => globRegex(g.slice(1)).test(path));
}

/**
 * k.create Workspace for `folder` over `ancestors` (`createPlan`'s keys): the nearest folder above it holding
 * `pnpm-workspace.yaml` or a `package.json` with `workspaces` (`root`, the path from the target to it; `member` whether
 * the root's globs take the target), and the version of the `@keel/cli` that resolves from the target's parent
 * (`node_modules/@keel/cli` in the nearest folder above that has one).
 */
export function workspaceOf(
  folder: string,
  ancestors: Readonly<Record<string, string>>,
): { readonly root: string | undefined; readonly member: boolean; readonly cli: string | undefined } {
  const { above, target, rel } = folderAbove(folder);
  let root: string | undefined;
  let member = false;
  let cli: string | undefined;
  for (const dir of above) {
    const at = (n: string): string | undefined => ancestors[posix.join(dir, n)];
    if (cli === undefined) {
      const pkg = parse(at("node_modules/@keel/cli/package.json"));
      const v: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "version") : undefined;
      if (typeof v === "string") cli = v;
    }
    if (root === undefined) {
      const yaml = at("pnpm-workspace.yaml");
      const globs = yaml === undefined ? packageGlobs(at("package.json")) : pnpmGlobs(yaml);
      if (globs !== undefined) {
        root = rel(target, dir);
        member = inGlobs(rel(dir, target), globs);
      }
    }
  }
  return { root, member, cli };
}
