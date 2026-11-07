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

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;
const typeOf = (file: string): string => TYPES[file.slice(file.lastIndexOf(".") + 1)] ?? "application/octet-stream";

/**
 * Read the client build in `dir` (`dist/<deployable>`, k.server Build, RFC 0048) once, at startup: the entry chunk of
 * `CLIENT_MANIFEST` and every file under `assets/`, keyed by URL path. Throws E1555 when the manifest is missing or
 * unreadable, has no entry chunk, or its entry file is missing.
 */
export async function loadAssets(dir: string): Promise<BuiltClient> {
  const fs = await import("node:fs/promises");
  const fail = (why: string): Error => codedError("E1555", `assets: ${CLIENT_MANIFEST} ${why}; run \`keel build\``);
  const text = await fs.readFile(`${dir}/${CLIENT_MANIFEST}`, "utf8").catch(() => undefined);
  if (text === undefined) throw fail("is missing");
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw fail("is not JSON");
  }
  const chunk = isRecord(manifest)
    ? Object.values(manifest).find((c) => isRecord(c) && c.isEntry === true && typeof c.file === "string")
    : undefined;
  const entry = isRecord(chunk) && typeof chunk.file === "string" ? chunk.file : undefined;
  if (entry === undefined) throw fail("has no entry chunk");
  const names = await fs.readdir(`${dir}/assets`, { recursive: true }).catch(() => []);
  const files = new Map<string, { body: Uint8Array<ArrayBuffer>; type: string }>();
  for (const rel of [...names.map((n) => `assets/${n.split("\\").join("/")}`), entry]) {
    const body = await fs.readFile(`${dir}/${rel}`).catch(() => undefined);
    if (body !== undefined) files.set(`/${rel}`, { body: new Uint8Array(body), type: typeOf(rel) });
  }
  if (!files.has(`/${entry}`)) throw fail(`entry ${entry} is missing`);
  return { entry: `/${entry}`, files };
}
