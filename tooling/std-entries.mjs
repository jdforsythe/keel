// S0009 (k.module Std config): a stdlib package's runtime entries reach no CLI-time package. Every key of `exports`
// in each `packages/std-*` package, other than `./tools`, a key under `./tools/`, `./module` and `./package.json`, is
// bundled with esbuild (a `./*` pattern expands to its files), and the first import edge, static or dynamic, into
// `packages/cli/`, `packages/check/` or a bare `vite`, `vitest`, `typescript` or `oxc-*` specifier is reported.
// `@keel/testing` is not a CLI-time package, but the walk goes through it: its edges into a CLI-time package count.
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const TOOL = /^(vite|vitest|typescript|oxc-[^/]+)(?:\/|$)/;
const KEEL = /^@keel\/(cli|check)(?:\/|$)/;
const MARK = "cli-time:";
const EXEMPT = (key) =>
  key === "./tools" || key.startsWith("./tools/") || key === "./module" || key === "./package.json";

/** The file an `exports` value serves at run time: a string, or the `default` condition. */
const targetOf = (v) => (typeof v === "string" ? v : typeof v?.default === "string" ? v.default : undefined);

/** `[key, file]` pairs of one package's `exports`, a `*` pattern expanded to the files it matches. */
function entriesOf(dir, exports) {
  const out = [];
  for (const [key, v] of Object.entries(exports ?? {})) {
    const target = targetOf(v);
    if (target === undefined) continue;
    if (!key.includes("*")) {
      out.push([key, path.join(dir, target)]);
      continue;
    }
    const [head, tail] = target.split("*");
    const base = path.join(dir, path.dirname(`${head}x`));
    if (!fs.existsSync(base)) continue;
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      const file = path.join(base, e.name);
      const full = `./${path.relative(dir, file).split(path.sep).join("/")}`;
      const lead = head.startsWith("./") ? head : `./${head}`;
      if (!e.isFile() || !full.startsWith(lead) || !full.endsWith(tail)) continue;
      out.push([key.replace("*", full.slice(lead.length, full.length - tail.length)), file]);
    }
  }
  return out.filter(([key]) => !EXEMPT(key)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Marks an import of a CLI-time package external under `cli-time:<name>`, so the graph stops at the edge. */
const cliTime = (root) => ({
  name: "cli-time",
  setup(b) {
    const dirs = ["cli", "check"].map((p) => [`@keel/${p}`, path.join(root, "packages", p) + path.sep]);
    b.onResolve({ filter: /.*/ }, (a) => {
      const bare = TOOL.exec(a.path)?.[1] ?? (KEEL.test(a.path) ? `@keel/${KEEL.exec(a.path)?.[1]}` : undefined);
      if (bare !== undefined) return { path: MARK + bare, external: true };
      if (!a.path.startsWith(".")) return undefined;
      const abs = path.resolve(a.resolveDir, a.path);
      const hit = dirs.find(([, d]) => abs.startsWith(d));
      return hit ? { path: MARK + hit[0], external: true } : undefined;
    });
  },
});

/** Breadth-first from `entry` over the metafile: the chain of files to the first CLI-time edge, and its target. */
function firstEdge(inputs, entry) {
  const prev = new Map([[entry, undefined]]);
  const queue = [entry];
  for (let f = queue.shift(); f !== undefined; f = queue.shift()) {
    for (const i of inputs[f]?.imports ?? []) {
      if (i.external && i.path.startsWith(MARK)) {
        const chain = [];
        for (let x = f; x !== undefined; x = prev.get(x)) chain.unshift(x);
        return { chain, target: i.path.slice(MARK.length) };
      }
      if (i.external || prev.has(i.path)) continue;
      prev.set(i.path, f);
      queue.push(i.path);
    }
  }
  return undefined;
}

/**
 * S0009 diagnostics for the repository at `root`, and the number of entries bundled. One esbuild run holds every
 * entry, so a file many entries share is parsed once.
 */
export async function stdEntryDiags(root) {
  const pk = path.join(root, "packages");
  const entries = [];
  for (const p of fs.existsSync(pk) ? fs.readdirSync(pk).sort() : []) {
    const dir = path.join(pk, p);
    const manifest = path.join(dir, "package.json");
    if (!p.startsWith("std-") || !fs.existsSync(manifest)) continue;
    const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
    for (const [key, file] of entriesOf(dir, pkg.exports))
      entries.push({ dir, name: `${pkg.name ?? p}${key.slice(1)}`, file });
  }
  if (entries.length === 0) return { diags: [], entries: 0 };
  const diag = (file, message, line = 1, col = 1) => ({
    kind: "diag",
    code: "S0009",
    path: path.relative(root, file).split(path.sep).join("/"),
    line,
    col,
    message,
  });
  let metafile;
  try {
    ({ metafile } = await build({
      entryPoints: [...new Set(entries.map((e) => e.file))],
      absWorkingDir: root,
      outdir: path.join(root, ".s0009"),
      bundle: true,
      platform: "node",
      format: "esm",
      metafile: true,
      write: false,
      logLevel: "silent",
      loader: { ".node": "empty" },
      plugins: [cliTime(root)],
    }));
  } catch (e) {
    const errors = Array.isArray(e?.errors) ? e.errors : [];
    if (errors.length === 0) throw e;
    const diags = errors.map((x) =>
      diag(
        path.resolve(root, x.location?.file ?? "packages"),
        `a std entry does not bundle: ${x.text}`,
        x.location?.line ?? 1,
        (x.location?.column ?? 0) + 1,
      ),
    );
    return { diags, entries: entries.length };
  }
  const diags = [];
  const local = (dir, f) => {
    const abs = path.resolve(root, f);
    const base = abs.startsWith(dir + path.sep) ? dir : root;
    return path.relative(base, abs).split(path.sep).join("/");
  };
  for (const e of entries) {
    const hit = firstEdge(metafile.inputs, path.relative(root, e.file).split(path.sep).join("/"));
    if (hit === undefined) continue;
    const chain = hit.chain.map((f) => local(e.dir, f)).join(" > ");
    const last = hit.chain[hit.chain.length - 1] ?? e.file;
    diags.push(diag(path.resolve(root, last), `entry ${e.name} reaches ${hit.target}: ${chain}; register in ./tools`));
  }
  return { diags, entries: entries.length };
}
