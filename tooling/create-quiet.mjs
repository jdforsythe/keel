// S0019 (k.create Conformance): `create-app` starts no process and reaches no network, by what its code can name. The
// bin (`packages/create-app/src/bin.ts`) is bundled with esbuild, every `@keel/*` package it reaches followed into
// its source and every other package left external; each source file of that reach is judged. A finding is an import,
// static or dynamic, of a process or network module (`node:child_process`, `node:worker_threads`, `node:cluster`,
// `node:net`, `node:tls`, `node:dgram`, `node:dns`, `node:http`, `node:https`, `node:http2`, with or without `node:`),
// or a call of a network global (`fetch`, `new WebSocket`, `new EventSource`, `new XMLHttpRequest`) outside comments
// and strings. The reach imports no third-party package: `packages/create-app/build.mjs` refuses one, and the packed-kit smoke holds the tarball to no dependency. This is the
// proof on a Node whose permission model cannot refuse a connection (before 25); from 25 the permission-model run
// refuses one as well.
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { scrub } from "./scan.mjs";

const MODULES = new Set([
  "child_process",
  "worker_threads",
  "cluster",
  "net",
  "tls",
  "dgram",
  "dns",
  "http",
  "https",
  "http2",
]);
const GLOBALS = /(?<![\w$.])(?:fetch\s*\(|new\s+(?:WebSocket|EventSource|XMLHttpRequest)\b)/;

/** `{ diags, files }`: the S0019 findings over the bin's reach, and how many source files it judged. */
export async function createQuiet(root) {
  const entry = path.join(root, "packages", "create-app", "src", "bin.ts");
  const r = await build({
    entryPoints: [entry],
    absWorkingDir: root,
    bundle: true,
    write: false,
    metafile: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
    plugins: [
      {
        name: "outside",
        setup(b) {
          b.onResolve({ filter: /^[^./]/ }, (a) =>
            a.path.startsWith("@keel/") ? undefined : { path: a.path, external: true },
          );
        },
      },
    ],
  });
  const diags = [];
  const inputs = Object.entries(r.metafile.inputs).filter(([f]) => f.startsWith("packages/"));
  for (const [file, meta] of inputs) {
    for (const imp of meta.imports)
      if (imp.external && MODULES.has(imp.path.replace(/^node:/, "").split("/")[0] ?? ""))
        diags.push({
          kind: "diag",
          code: "S0019",
          path: file,
          line: 1,
          col: 1,
          message: `create-app's reach imports ${imp.path}; it starts no process and opens no connection`,
        });
    const { code } = scrub(fs.readFileSync(path.join(root, file), "utf8"));
    code.forEach((l, i) => {
      const m = GLOBALS.exec(l);
      if (m !== null)
        diags.push({
          kind: "diag",
          code: "S0019",
          path: file,
          line: i + 1,
          col: m.index + 1,
          message: `create-app's reach calls ${m[0].replace(/\s*\($/, "")}; it opens no connection`,
        });
    });
  }
  return { diags, files: inputs.length };
}
