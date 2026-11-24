import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

let code: string | undefined;

/**
 * The SHA-256 of the bytes of the running TypeScript's `package.json` and `lib/typescript.js`, read once per process: a
 * part of the type cache's key (k.check-cache Key), so a patched TypeScript of one version is another key. The lib
 * `.d.ts` files the pass reads are probes.
 */
export function tsCode(): string {
  if (code !== undefined) return code;
  const main = ts.sys.getExecutingFilePath();
  const hash = createHash("sha256");
  for (const f of [path.join(path.dirname(path.dirname(main)), "package.json"), main]) {
    hash.update(`${path.basename(f)}\u0000`);
    try {
      hash.update(fs.readFileSync(f));
    } catch {
      hash.update("-");
    }
  }
  code = hash.digest("hex");
  return code;
}
