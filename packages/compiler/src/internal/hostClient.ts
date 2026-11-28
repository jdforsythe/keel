import fs from "node:fs";
import path from "node:path";
import { CLIENT_MANIFEST } from "../entry/CLIENT_MANIFEST.ts";

/** Every file under `dir`, relative to `base`, `/`-separated. */
const filesUnder = (dir: string, base: string): string[] =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? filesUnder(p, base) : [path.relative(base, p).split(path.sep).join("/")];
      })
    : [];

/**
 * Copy the built `client` deployable `name` (`from`, its `dist/<name>/`) into its host's build `to` (k.hosting Served by):
 * every file the host's own build has not written, and the copied `assets/*` recorded in the host's
 * `CLIENT_MANIFEST` under the key `keel:servedBy`, so the host serves them `immutable` as it does its own hashed files.
 * Throws when the client has not been built.
 */
export function hostClient(from: string, to: string, name: string): void {
  if (!fs.existsSync(path.join(from, "index.html")))
    throw new Error(`keel: dist/${name}/index.html is missing; build ${name} before its host`);
  fs.cpSync(from, to, { recursive: true, force: false });
  const at = path.join(to, CLIENT_MANIFEST);
  const manifest: unknown = JSON.parse(fs.readFileSync(at, "utf8"));
  const assets = filesUnder(path.join(from, "assets"), from).sort();
  fs.writeFileSync(
    at,
    JSON.stringify({ ...Object(manifest), "keel:servedBy": { file: "index.html", assets } }, null, 2),
  );
}
