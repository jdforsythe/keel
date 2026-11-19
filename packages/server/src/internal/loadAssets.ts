import { CLIENT_MANIFEST } from "@keel/compiler/internal/entry/CLIENT_MANIFEST";
import type { BuiltClient } from "./BuiltClient.ts";
import { codedError } from "./codedError.ts";
import { peersOfIndex } from "./peersOfIndex.ts";

const TYPES: Readonly<Record<string, string>> = {
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  woff2: "font/woff2",
};

/**
 * A content hash before the extension: Vite's `[hash]`, 8 base64url characters that are not
 * all lowercase letters (so `island-checkout.js` is a name, not a hash), or a hex run of 8 or more.
 */
const HASHED = /-((?![a-z]{8}\.)[\w-]{8}|[a-f0-9]{8,})\.\w+$/;

/** The Keel mark Vite copies from `public/` to the build's top level; served and linked as the icon. */
const MARK = "keel-mark.svg";
const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;
const typeOf = (file: string): string => TYPES[file.slice(file.lastIndexOf(".") + 1)] ?? "application/octet-stream";
/** Every output file a manifest chunk names: its `file`, `css` and `assets`. */
const namedBy = (chunk: unknown): unknown[] =>
  isRecord(chunk)
    ? [chunk.file, ...(Array.isArray(chunk.css) ? chunk.css : []), ...(Array.isArray(chunk.assets) ? chunk.assets : [])]
    : [];

/**
 * Read the client build in `dir` (`dist/<deployable>`, k.server Build) once, at startup: every regular file but `*.map` under the
 * real `assets/` (a symlinked `assets/` is followed) and the top-level `keel-mark.svg` when it is a regular file, keyed
 * by its decoded URL path, `immutable` when the manifest names it and its name carries a hash (`HASHED`), with a weak
 * `etag` from its bytes. The walk descends real directories only; a file (or symlink) under `assets/` is read only
 * when its real path is inside the real `assets/`, and none is when that real path is unknown, so no symlink and no
 * `..` in the manifest reaches outside. `css` lists the stylesheets the manifest's entry chunk names that are served
 * `.css` files, as URL paths; the mark is the only served file outside `/assets/`, so each is under it. With `hosted` (a `client` deployable names this one its host, k.hosting) it
 * also reads the top-level `index.html` and its `keel-peer` origins. Throws E1555 when the manifest is missing or unreadable, has no entry
 * chunk, or its entry file is not under `assets/`, or when `hosted` and `index.html` is missing.
 */
export async function loadAssets(dir: string, hosted = false): Promise<BuiltClient> {
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
  const add = async (at: string): Promise<void> => {
    const body = await fs.readFile(join(dir, at)).catch(() => undefined);
    if (body === undefined) return;
    const immutable = named.has(at) && HASHED.test(at);
    const etag = `W/"${createHash("sha256").update(body).digest("base64url").slice(0, 22)}"`;
    files.set(`/${at}`, { body: new Uint8Array(body), type: typeOf(at), immutable, etag });
  };
  const root = await real("assets");
  const walk = async (rel: string): Promise<void> => {
    for (const d of await fs.readdir(join(dir, rel), { withFileTypes: true }).catch(() => [])) {
      const at = `${rel}/${d.name}`;
      if (d.isDirectory()) await walk(at);
      else if (root !== "" && !/\.map$/i.test(d.name) && (await real(at)).startsWith(root + sep)) await add(at);
    }
  };
  await walk("assets");
  if (!files.has(`/${entry}`)) throw fail(`entry ${entry} is missing`);
  if ((await fs.lstat(join(dir, MARK)).catch(() => undefined))?.isFile()) await add(MARK);
  const css = (isRecord(chunk) && Array.isArray(chunk.css) ? chunk.css : []).map((f: unknown) => `/${f}`);
  const index = hosted ? await fs.readFile(join(dir, "index.html")).catch(() => undefined) : undefined;
  if (hosted && index === undefined)
    throw codedError("E1555", "assets: index.html of the hosted client is missing; run `keel build`");
  return {
    entry: `/${entry}`,
    css: css.filter((f) => f.endsWith(".css") && files.has(f)),
    files,
    index: index && new Uint8Array(index),
    peers: index === undefined ? [] : peersOfIndex(index.toString("utf8")),
  };
}
