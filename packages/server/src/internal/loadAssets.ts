import { CLIENT_MANIFEST } from "@keel/compiler/entry/CLIENT_MANIFEST";
import type { BuiltClient } from "./BuiltClient.ts";
import { codedError } from "./codedError.ts";

const TYPES: Readonly<Record<string, string>> = {
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  map: "application/json",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  woff2: "font/woff2",
};

/**
 * A content hash before the extension (RFC 0057, backlog 0161): Vite's `[hash]`, 8 base64url characters that are not
 * all lowercase letters (so `island-checkout.js` is a name, not a hash), or a hex run of 8 or more.
 */
const HASHED = /-((?![a-z]{8}\.)[\w-]{8}|[a-f0-9]{8,})\.\w+$/;

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;
const typeOf = (file: string): string => TYPES[file.slice(file.lastIndexOf(".") + 1)] ?? "application/octet-stream";
/** Every output file a manifest chunk names: its `file`, `css` and `assets`. */
const namedBy = (chunk: unknown): unknown[] =>
  isRecord(chunk)
    ? [chunk.file, ...(Array.isArray(chunk.css) ? chunk.css : []), ...(Array.isArray(chunk.assets) ? chunk.assets : [])]
    : [];

/**
 * Read the client build in `dir` (`dist/<deployable>`, k.server Build) once, at startup: every regular file under
 * `assets/` and the top-level `keel-mark.svg` (Vite copies it from `public/`), keyed by its decoded URL path,
 * `immutable` when the manifest names it and its name carries a hash (`HASHED`), with a weak `etag` from its bytes.
 * The walk descends real directories only; a file under `assets/` (or a symlink there) is read only when its real path
 * is inside the real `assets/`, and the mark only when it is a regular file, so no symlink and no `..` in the manifest
 * reaches outside. `css` lists the served stylesheets the manifest's entry chunk names, as URL paths. Throws E1555 when
 * the manifest is missing or unreadable, has no entry chunk, or its entry file is not among those files.
 */
export async function loadAssets(dir: string): Promise<BuiltClient> {
  const fs = await import("node:fs/promises");
  const { join, sep } = await import("node:path");
  const { createHash } = await import("node:crypto");
  const fail = (why: string): Error => codedError("E1555", `assets: ${CLIENT_MANIFEST} ${why}; run \`keel build\``);
  const text = await fs.readFile(join(dir, CLIENT_MANIFEST), "utf8").catch(() => undefined);
  if (text === undefined) throw fail("is missing");
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw fail("is not JSON");
  }
  const chunks = isRecord(manifest) ? Object.values(manifest) : [];
  const chunk = chunks.find((c) => isRecord(c) && c.isEntry === true && typeof c.file === "string");
  const entry = isRecord(chunk) && typeof chunk.file === "string" ? chunk.file : undefined;
  if (entry === undefined) throw fail("has no entry chunk");
  const named = new Set(chunks.flatMap(namedBy));
  const real = (at: string): Promise<string> => fs.realpath(join(dir, at)).catch(() => "");
  const files = new Map<string, { body: Uint8Array<ArrayBuffer>; type: string; immutable: boolean; etag: string }>();
  const walk = async (rel: string, inside: string): Promise<void> => {
    for (const d of await fs.readdir(join(dir, rel), { withFileTypes: true }).catch(() => [])) {
      const at = rel + d.name;
      if (d.isDirectory()) {
        if (rel || at === "assets") await walk(`${at}/`, rel ? inside : await real(at));
      } else if (rel ? (await real(at)).startsWith(inside + sep) : d.isFile() && at === "keel-mark.svg") {
        const body = await fs.readFile(join(dir, at)).catch(() => undefined);
        if (body === undefined) continue;
        const immutable = named.has(at) && HASHED.test(at);
        const etag = `W/"${createHash("sha256").update(body).digest("base64url").slice(0, 22)}"`;
        files.set(`/${at}`, { body: new Uint8Array(body), type: typeOf(at), immutable, etag });
      }
    }
  };
  await walk("", "");
  if (!files.has(`/${entry}`)) throw fail(`entry ${entry} is missing`);
  const css = (isRecord(chunk) && Array.isArray(chunk.css) ? chunk.css : []).map((f: unknown) => `/${f}`);
  return { entry: `/${entry}`, css: css.filter((f) => files.has(f)), files };
}
