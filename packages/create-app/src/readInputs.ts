import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ancestorKeys } from "@keel/scaffold/create";
import { realOf } from "./realOf.ts";

/** Folders whose contents no plan writes into, listed by name only. */
const OPAQUE = new Set(["node_modules", ".git"]);

/** Every entry under `abs`, relative and `/`-separated, a folder ending in `/`; `node_modules`, `.git` and links not entered. */
function listing(abs: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    let names: string[] = [];
    try {
      names = readdirSync(join(abs, rel)).sort();
    } catch {
      return;
    }
    for (const n of names) {
      const p = rel === "" ? n : `${rel}/${n}`;
      const st = lstatSync(join(abs, p), { throwIfNoEntry: false });
      // A link to a folder is listed as a folder and not entered: what is behind it is outside, and a write through it
      // is the links judgement's to refuse (E1357).
      const linkedDir =
        st?.isSymbolicLink() === true && statSync(join(abs, p), { throwIfNoEntry: false })?.isDirectory() === true;
      if (st?.isDirectory() === true || linkedDir) {
        out.push(`${p}/`);
        if (!OPAQUE.has(n) && !linkedDir) walk(p);
      } else out.push(p);
    }
  };
  walk("");
  return out;
}

/**
 * What `createPlan` reads from the disk for `folder` (k.create-folder Not done: inside the folder, and above it only the
 * files Workspace names): the folder's absolute and real paths, its listing, the Workspace files above it, and whether
 * a `.git` is at or above it.
 */
export function readInputs(
  cwd: string,
  folder: string,
): {
  readonly abs: string;
  readonly realPath: string;
  readonly listing: readonly string[];
  readonly ancestors: Readonly<Record<string, string>>;
  readonly gitAbove: boolean;
} {
  const abs = resolve(cwd, folder);
  const depth = resolve(cwd)
    .split(sep)
    .filter((s) => s !== "").length;
  const ancestors: Record<string, string> = {};
  for (const key of ancestorKeys(folder, depth)) {
    const path = isAbsolute(key) ? key : resolve(cwd, key);
    try {
      ancestors[key] = readFileSync(path, "utf8");
    } catch {
      // absent: not a workspace file here
    }
  }
  let gitAbove = false;
  for (let at = abs; ; at = dirname(at)) {
    if (existsSync(join(at, ".git"))) gitAbove = true;
    if (gitAbove || dirname(at) === at) break;
  }
  const here = existsSync(abs);
  // A folder that does not exist yet has no listing, and its name is the one typed: nothing above it is read for it.
  return { abs, realPath: here ? realOf(abs) : abs, listing: here ? listing(abs) : [], ancestors, gitAbove };
}
