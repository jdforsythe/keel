import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { peerOrigins } from "../hosting/peerOrigins.ts";
import type { Topology } from "../types/Topology.ts";
import { keelMark } from "./keelMark.ts";

/** A document `render` answered: the route id (undefined for the not-found document), path, status and HTML. */
type Doc = { readonly id: unknown; readonly path: unknown; readonly status: unknown; readonly html: unknown };
const isDoc = (v: unknown): v is Doc =>
  typeof v === "object" && v !== null && "path" in v && "status" in v && "html" in v && "id" in v;

/** The client build's Vite manifest folder: the server read it to script the documents; a file host has no use for it. */
const MANIFEST_DIR = ".vite";

/**
 * The last step of a `static` deployable's build (k.hosting Static): writes `keel-mark.svg` into its client build
 * `out` (`dist/<name>/`), imports the build entry `entry` (never shipped) and calls its `render(out, std)`, then writes
 * each route's document at `index.html` for `/` and `<path>/index.html` otherwise, and the not-found document at
 * `404.html`, each with a `keel-peer` tag per `KEEL_PEER_<NAME>` of `env` and no nonce (a file host serves no policy
 * header; `csp.txt` is the policy). A route answering other than 200 writes no document and is one `E1588` line, naming
 * the deployable, the route id and the status; the lines are returned, empty when every route answered 200. The
 * manifest folder and `entry`'s folder are removed either way. A Keel-coded throw of the app (E1553) rejects as a
 * `keel: <code> ...` line.
 */
export async function writeStatic(
  out: string,
  entry: string,
  name: string,
  topology: Topology,
  env: Readonly<Record<string, string | undefined>>,
  std: string | undefined,
): Promise<string[]> {
  if (!fs.existsSync(path.join(out, "keel-mark.svg"))) fs.writeFileSync(path.join(out, "keel-mark.svg"), keelMark());
  try {
    const mod: unknown = await import(pathToFileURL(entry).href);
    const render: unknown = typeof mod === "object" && mod !== null ? Reflect.get(mod, "render") : undefined;
    if (typeof render !== "function") throw new Error(`keel: build entry ${entry} exports no render`);
    // A Keel-coded throw of `createApp` (E1553, E1558) is a diagnostic line of the build.
    const docs: unknown = await Promise.resolve(render(out, std)).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      throw /^[EW]\d{4} /.test(message) ? new Error(`keel: ${message}`) : e;
    });
    const all = Array.isArray(docs) ? docs.filter(isDoc) : [];
    const tags = peerOrigins(topology, env)
      .origins.map(([n, o]) => `<meta name="keel-peer" data-deployable="${n}" content="${o}">`)
      .join("");
    const failed: string[] = [];
    for (const d of all) {
      if (d.id !== undefined && d.status !== 200) {
        failed.push(
          `E1588 static deployable ${name}: route ${String(d.id)} answers ${String(d.status)} at build; a static page needs 200 for caller ''`,
        );
        continue;
      }
      const html = String(d.html)
        .replace(/<meta property="csp-nonce"[^>]*>/, "")
        .replace(/ nonce="[^"]*"/g, "")
        .replace("</head>", `${tags}</head>`);
      const rel =
        d.id === undefined ? "404.html" : d.path === "/" ? "index.html" : `${String(d.path).slice(1)}/index.html`;
      fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
      fs.writeFileSync(path.join(out, rel), html);
    }
    return failed;
  } finally {
    fs.rmSync(path.join(out, MANIFEST_DIR), { recursive: true, force: true });
    fs.rmSync(path.dirname(entry), { recursive: true, force: true });
  }
}
