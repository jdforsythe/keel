import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isRecord } from "./compat/isRecord.ts";

let own: { readonly version: string; readonly hash: string } | undefined;

/**
 * `@keel/check`'s version and the SHA-256 of the bytes of each of its own code files (its `src` and `unsafe`
 * folders, or their built copies under `dist`), read once per process: a part of the type cache's key.
 */
export function ownCode(): { readonly version: string; readonly hash: string } {
  if (own !== undefined) return own;
  const src = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const codeRoot = path.dirname(src);
  const pkgRoot = path.basename(codeRoot) === "dist" ? path.dirname(codeRoot) : codeRoot;
  let version = "";
  try {
    const pkg: unknown = JSON.parse(fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"));
    if (isRecord(pkg) && typeof pkg.version === "string") version = pkg.version;
  } catch {
    // No version read: the code bytes still name this package.
  }
  const files: string[] = [];
  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files.push(p);
    }
  };
  walk(src);
  walk(path.join(codeRoot, "unsafe"));
  const hash = createHash("sha256");
  for (const f of files.sort()) hash.update(`${path.relative(codeRoot, f)}\u0000`).update(fs.readFileSync(f));
  own = { version, hash: hash.digest("hex") };
  return own;
}
