// Spec: k.gamut, clause "In that project, a `vite.config.ts` plugin whose `generateBundle` hook (order `post`, client environment only) deletes each `.css` asset and prepends its text to the entry chunk as a JavaScript string makes `keel build` exit 1 with one E1819 line whose message starts `--k-color-a is rgb(0 133 127) in assets/` and ends `; Keel's CSS ships in .css files`, and no `dist/<name>/`; one replacing each `--k-` in the `.css` assets by `--q-` prints `E1819 --k-color-a is missing from the built CSS, expected rgb(0 133 127)`."
// Spec: k.gamut, clause "In that project, a plugin whose `generateBundle` hook (order `post`, after Keel's plugin) emits `assets/extra.css` holding `:root{--k-color-a:#ff0000}` makes `keel build` print `E1819 --k-color-a is #ff0000 in the built CSS, expected rgb(0 133 127)`; one wrapping each `.css` asset's text in `@scope (.never){` and `}` prints `E1819 --k-color-a is rgb(0 133 127) under @scope in the built CSS, expected none`; one putting the first rule that declares `--k-color-b` inside `@container (min-width:1px)` prints `E1819 --k-color-a is rgb(0 133 127) under @container in the built CSS, expected none`."
// Spec: k.gamut, clause "Each failing build of these clauses gives its E1819 record `see` `k.gamut`, and its stderr holds no `error during build`."
// Spec: k.gamut, clause "In that project, a `styles` stylesheet holding `.x{--k-space-zz:4px}` makes `keel build` print `E1819 --k-space-zz is 4px in the built CSS where Keel declares none`; one holding `.n{color:red;user-select:none;&:hover{color:blue}}`, `@container (min-width:400px){.c{color:#123ABC}}` and `@layer app{.l{color:hsl(10 50% 50%)}}`, built with a `css.postcss` plugin that adds `-webkit-user-select:none` before each `user-select:none`, builds."
// Spec: k.gamut, clause "`keel build` of that project with `build: { target: ['chrome100'] }` exits 0 and its CSS file holds each block under `(color-gamut: p3)` inside `@supports (color: color(display-p3 0 0 0))`."
// k.bundle Rules E1819 "E1819 built output holding Keel's CSS other than as compiled, or outside `.css` files (k.gamut CSS)."
// Seed: 1337 (no generated input: spawned `keel build` runs over fixed fixtures).
// k.gamut #7 to #11 on a real `keel build` of #4's `static` project (compat-support's `staticTree`, adapter `static`, deployable `site`, module `s`; the clause's own `tokens.ts`). Each plugin is a plain object in the fixture's `vite.config.ts` after `keel()`, a `generateBundle` hook of order `post` that acts in the `client` environment only (`this.environment.name`), unless a case says otherwise.
// Beyond the bullets, these cases assert what the "Output check" paragraph states: a `node` and a `static` deployable's whole `dist/<name>/` is read (a `.mjs` file there holding a Keel color declaration is refused as in a client file), Keel's own documents link the stylesheet and inline nothing, after any E1819 no `dist/<name>/` remains, `keel build` prints the record alone, and an app with no color token has nothing to find.
// ASSUMPTIONS: the E1819 line is a `diag` record whose `message` is the text after the code and whose `see` is the string `k.gamut`; "no position" is `line` and `col` absent; "one line" is one `diag` record of E1819; Keel's documents are the `.html` files under `dist/site/`; a "Keel color declaration in JavaScript" is the text `:root{--k-color-a:rgb(0 133 127)}` inside a string of a chunk; a stylesheet inlined by `document.createElement('style')` carries the compiled CSS text whole.
// UNTESTABLE: "`keel dev` serves the same compiled CSS through Vite's dev pipeline ... and runs no output check." (no Conformance bullet states an outcome and a dev server's CSS is not a build output; nothing is asserted). "The first difference, in file and declaration order with a missing one last" when a plugin makes several (the property reported depends on file names Keel does not fix; the cases that make several assert the message the bullet gives, or its form). The `Fix:` sentence (a diag record's `fix` is a unified diff hunk, docs/OUTPUT.md; `keel explain E1819` prose is not specified beyond naming the cause).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it } from "vitest";
import { type Rec, type Run, type Tree, cleanup, diags, keel, materialize } from "./compat-support.ts";
import { staticTree } from "./static-support.ts";

const SLOW = testTime(300_000);
const TOKENS_TS = `import { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens({\n  color: { a: "color(display-p3 0 0.52 0.5)", b: "#000000", c: "oklch(70% 0.48 290)", d: "hsl(19deg 87% 39%)" },\n  overlay: { s: { value: "color(display-p3 0 0.66 0 / 0.95)", over: ["b"] } },\n});\n`;
const NO_COLOR_TOKENS_TS = `import { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens({ space: { zz: "4px" } });\n`;
const TOPOLOGY_STYLES = `import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['s'], adapter: 'static', styles: ['appcss/app.css'] } })\n`;

/** A `vite.config.ts` with `plugins: [keel(), ...<names>]`, `prelude` holding their definitions, `options` the rest of the config. */
const vite = (prelude: string, names: string[] = [], options = ""): string =>
  `import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\n${prelude}\nexport default defineConfig({ plugins: [keel(), ${names.join(", ")}], ${options} });\n`;

/** A `generateBundle` hook of order `post` acting in the client environment only, its body `body(bundle)`. */
const clientHook = (name: string, body: string): string =>
  `const ${name} = { name: ${JSON.stringify(name)}, generateBundle: { order: "post", handler(_o, bundle) {
  if (this.environment.name !== "client") return;
${body}
} } };\n`;

/** Deletes each `.css` asset and prepends its text to the entry chunk as a JavaScript string that injects a style element. */
const inlineCss = clientHook(
  "inlineCss",
  `  let text = "";
  for (const [key, file] of Object.entries(bundle)) {
    if (file.type === "asset" && file.fileName.endsWith(".css")) { text += String(file.source); delete bundle[key]; }
  }
  for (const file of Object.values(bundle)) {
    if (file.type === "chunk" && file.isEntry) {
      file.code = "(()=>{const s=document.createElement('style');s.textContent=" + JSON.stringify(text) + ";document.head.appendChild(s)})();" + file.code;
      break;
    }
  }`,
);
/** Each `--k-` in each `.css` asset becomes `--q-`. */
const renameProp = clientHook(
  "renameProp",
  `  for (const file of Object.values(bundle)) {
    if (file.type === "asset" && file.fileName.endsWith(".css")) file.source = String(file.source).split("--k-").join("--q-");
  }`,
);
/** Emits `assets/extra.css`. */
const extraCss = clientHook(
  "extraCss",
  `  this.emitFile({ type: "asset", fileName: "assets/extra.css", source: ":root{--k-color-a:#ff0000}" });`,
);
/** Wraps each `.css` asset's text in `@scope (.never){` and `}`. */
const scopeCss = clientHook(
  "scopeCss",
  `  for (const file of Object.values(bundle)) {
    if (file.type === "asset" && file.fileName.endsWith(".css")) file.source = "@scope (.never){" + String(file.source) + "}";
  }`,
);
/** The first `:root{...}` holding `--k-color-b` goes inside `@container (min-width:1px)`. */
const containerCss = clientHook(
  "containerCss",
  `  for (const file of Object.values(bundle)) {
    if (file.type !== "asset" || !file.fileName.endsWith(".css")) continue;
    const text = String(file.source);
    const hit = /:root\\s*\\{[^{}]*--k-color-b[^{}]*\\}/.exec(text);
    if (hit === null) continue;
    file.source = text.slice(0, hit.index) + "@container (min-width:1px){" + hit[0] + "}" + text.slice(hit.index + hit[0].length);
    break;
  }`,
);
/** An unknown at-rule around each `.css` asset's text. */
const unknownAt = clientHook(
  "unknownAt",
  `  for (const file of Object.values(bundle)) {
    if (file.type === "asset" && file.fileName.endsWith(".css")) file.source = "@keel-unknown (x){" + String(file.source) + "}";
  }`,
);
/** Emits a stylesheet holding a Keel property in a hook that runs after Keel's: no other `.css` file is touched. */
const extraProp = clientHook(
  "extraProp",
  `  this.emitFile({ type: "asset", fileName: "assets/late.css", source: ".late{--k-space-late:4px}" });`,
);
/** After every other hook, `closeBundle` writes the compiled CSS as a string into `dist/site/leak.mjs`, a file beside Keel's server files. */
const leakFile = `import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const leakFile = { name: "leakFile", enforce: "post", closeBundle: { order: "post", handler() {
  const dir = join(process.cwd(), "dist", "site");
  if (existsSync(dir)) writeFileSync(join(dir, "leak.mjs"), "export const keelCss = " + JSON.stringify(":root{--k-color-a:rgb(0 133 127)}") + ";\\n");
} } };\n`;
/** Clones each `user-select` declaration as `-webkit-user-select` before it (app rules only). */
const prefixSelect = `const prefixSelect = { postcssPlugin: "prefix-select", Declaration(decl) {
  if (decl.prop !== "user-select" || decl.prev()?.prop === "-webkit-user-select") return;
  decl.cloneBefore({ prop: "-webkit-user-select" });
} };\n`;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
type Built = { dir: string; run: Run };
type Fixture = { vite?: string; appCss?: string; tokens?: string; adapter?: string };
const build = (f: Fixture): Built => {
  const styles = f.appCss === undefined ? undefined : TOPOLOGY_STYLES;
  const tree: Tree = {
    ...staticTree("none", styles, f.adapter ?? "static"),
    "tokens.ts": f.tokens ?? TOKENS_TS,
    ...(f.vite === undefined ? {} : { "vite.config.ts": f.vite }),
    ...(f.appCss === undefined
      ? {}
      : {
          "node_modules/appcss/app.css": f.appCss,
          "node_modules/appcss/package.json": JSON.stringify({
            name: "appcss",
            version: "1.0.0",
            exports: { "./app.css": "./app.css" },
          }),
        }),
  };
  const dir = materialize(tree);
  dirs.push(dir);
  return { dir, run: keel(dir, ["build"]) };
};
const message = (r: Rec | undefined): string => String(r?.message);
const noDist = (b: Built): boolean => !existsSync(join(b.dir, "dist", "site"));
/** The one E1819 line of a failing build: exit 1, one record, no position, a message within 89 units, no `dist/site/`. */
const expectFails = (b: Built): Rec => {
  const d = diags(b.run, "E1819");
  expect(b.run.status).toBe(1);
  expect(d).toHaveLength(1);
  const first = d[0];
  expect(first?.line).toBeUndefined();
  expect(first?.col).toBeUndefined();
  expect(message(first).length).toBeLessThanOrEqual(89);
  expect(noDist(b)).toBe(true);
  return first ?? { kind: "diag" };
};
const expectBuilds = (b: Built): void => {
  expect(b.run.status).toBe(0);
  expect(diags(b.run, "E1819")).toEqual([]);
  expect(existsSync(join(b.dir, "dist", "site"))).toBe(true);
};
const filesUnder = (dir: string, ext: RegExp): string[] => {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p, ext));
    else if (ext.test(name)) out.push(p);
  }
  return out;
};
const SUFFIX = "; Keel's CSS ships in .css files";

// The builds of #7 and #8, shared with #9.
const inlined = build({ vite: vite(inlineCss, ["inlineCss"]) });
const renamed = build({ vite: vite(renameProp, ["renameProp"]) });
const extra = build({ vite: vite(extraCss, ["extraCss"]) });
const scoped = build({ vite: vite(scopeCss, ["scopeCss"]) });
const contained = build({ vite: vite(containerCss, ["containerCss"]) });

describe("k.gamut #7: the check reads what is on disk after everything is written", () => {
  it(
    "a plugin deleting each `.css` asset and prepending its text to the entry chunk as a JavaScript string makes `keel build` exit 1 with one E1819 line whose message starts `--k-color-a is rgb(0 133 127) in assets/` and ends `; Keel's CSS ships in .css files`, and no `dist/<name>/`",
    () => {
      const m = message(expectFails(inlined));
      expect(m.startsWith("--k-color-a is rgb(0 133 127) in assets/")).toBe(true);
      expect(m.endsWith(SUFFIX)).toBe(true);
    },
    SLOW,
  );

  it(
    "a plugin replacing each `--k-` in the `.css` assets by `--q-` prints `E1819 --k-color-a is missing from the built CSS, expected rgb(0 133 127)`",
    () => {
      expect(message(expectFails(renamed))).toBe("--k-color-a is missing from the built CSS, expected rgb(0 133 127)");
    },
    SLOW,
  );
});

describe("k.gamut #8: a declaration outside what Keel wrote is refused", () => {
  it(
    "a plugin emitting `assets/extra.css` holding `:root{--k-color-a:#ff0000}` after Keel's plugin makes `keel build` print `E1819 --k-color-a is #ff0000 in the built CSS, expected rgb(0 133 127)`",
    () => {
      expect(message(expectFails(extra))).toBe("--k-color-a is #ff0000 in the built CSS, expected rgb(0 133 127)");
    },
    SLOW,
  );

  it(
    "a plugin wrapping each `.css` asset's text in `@scope (.never){` and `}` prints `E1819 --k-color-a is rgb(0 133 127) under @scope in the built CSS, expected none`",
    () => {
      expect(message(expectFails(scoped))).toBe(
        "--k-color-a is rgb(0 133 127) under @scope in the built CSS, expected none",
      );
    },
    SLOW,
  );

  it(
    "a plugin putting the first rule that declares `--k-color-b` inside `@container (min-width:1px)` prints `E1819 --k-color-a is rgb(0 133 127) under @container in the built CSS, expected none`",
    () => {
      expect(message(expectFails(contained))).toBe(
        "--k-color-a is rgb(0 133 127) under @container in the built CSS, expected none",
      );
    },
    SLOW,
  );

  const unknown = build({ vite: vite(unknownAt, ["unknownAt"]) });
  it(
    "a plugin wrapping each `.css` asset's text in an at-rule the reader does not know is refused as `<property> is <found> under @keel-unknown in the built CSS, expected none` (every other at-rule: none flattened)",
    () => {
      expect(message(expectFails(unknown))).toMatch(
        /^--k-[a-z0-9-]+ is .+ under @keel-unknown in the built CSS, expected none$/,
      );
    },
    SLOW,
  );

  const late = build({ vite: vite(extraProp, ["extraProp"]) });
  it(
    "any other `--k-*` declaration in a `.css` file is refused, including a stylesheet emitted by a later hook: `--k-space-late` is `E1819 --k-space-late is 4px in the built CSS where Keel declares none`",
    () => {
      expect(message(expectFails(late))).toBe("--k-space-late is 4px in the built CSS where Keel declares none");
    },
    SLOW,
  );

  const server = build({ vite: vite(leakFile, ["leakFile"]) });
  it(
    "a Keel color declaration in a non-CSS file of a `static` deployable's `dist/<name>/` (a `.mjs` written there by a `closeBundle` hook) is refused as `<property> is <found> in <file>; Keel's CSS ships in .css files`",
    () => {
      const m = message(expectFails(server));
      expect(m).toMatch(/^--k-color-a is rgb\(0 133 127\) in .+; Keel's CSS ships in \.css files$/);
      expect(/ in [^ ]+\.css;/.test(m)).toBe(false);
    },
    SLOW,
  );

  const serverNode = build({ vite: vite(leakFile, ["leakFile"]), adapter: "node" });
  it(
    "a Keel color declaration in a non-CSS file of a `node` deployable's `dist/<name>/` (a `.mjs` written there by a `closeBundle` hook) is refused as `<property> is <found> in <file>; Keel's CSS ships in .css files`",
    () => {
      const m = message(expectFails(serverNode));
      expect(m).toMatch(/^--k-color-a is rgb\(0 133 127\) in .+; Keel's CSS ships in \.css files$/);
    },
    SLOW,
  );
});

describe("k.gamut #9: the record and what keel build prints", () => {
  const failing: [string, Built][] = [
    ["#7's entry-chunk inlining", inlined],
    ["#7's `--q-` renaming", renamed],
    ["#8's emitted `assets/extra.css`", extra],
    ["#8's `@scope`", scoped],
    ["#8's `@container`", contained],
  ];
  for (const [what, b] of failing) {
    it(
      `${what}: the E1819 record has \`see\` \`k.gamut\` and its stderr holds no \`error during build\``,
      () => {
        const d = diags(b.run, "E1819");
        expect(d).toHaveLength(1);
        expect(d[0]?.see).toBe("k.gamut");
        expect(b.run.stderr ?? "").not.toContain("error during build");
        expect(b.run.stdout ?? "").not.toContain("error during build");
      },
      SLOW,
    );
  }
});

describe("k.gamut #10: ordinary app CSS", () => {
  const space = build({ vite: vite("", []), appCss: ".x{--k-space-zz:4px}" });
  it(
    "a `styles` stylesheet holding `.x{--k-space-zz:4px}` makes `keel build` print `E1819 --k-space-zz is 4px in the built CSS where Keel declares none`",
    () => {
      expect(message(expectFails(space))).toBe("--k-space-zz is 4px in the built CSS where Keel declares none");
    },
    SLOW,
  );

  const ordinary = build({
    vite: vite(prefixSelect, [], "css: { postcss: { plugins: [prefixSelect] } }"),
    appCss:
      ".n{color:red;user-select:none;&:hover{color:blue}}\n@container (min-width:400px){.c{color:#123ABC}}\n@layer app{.l{color:hsl(10 50% 50%)}}",
  });
  it(
    "one holding `.n{color:red;user-select:none;&:hover{color:blue}}`, `@container (min-width:400px){.c{color:#123ABC}}` and `@layer app{.l{color:hsl(10 50% 50%)}}`, built with a `css.postcss` plugin that adds `-webkit-user-select:none` before each `user-select:none`, builds",
    () => {
      expectBuilds(ordinary);
      const css = filesUnder(join(ordinary.dir, "dist", "site"), /\.css$/)
        .map((f) => readFileSync(f, "utf8"))
        .join("\n");
      expect(css).toContain("-webkit-user-select");
    },
    SLOW,
  );

  const withSupports = build({
    vite: vite("", []),
    appCss:
      ".x{color:#123ABC}\n@supports (display:grid){.g{display:grid}}\n@container (min-width:400px){.c{color:red}}",
  });
  it(
    "app CSS with its own colors, `@supports`, `@container`, `@layer` and nesting is not judged: it builds",
    () => {
      expectBuilds(withSupports);
    },
    SLOW,
  );
});

describe("k.gamut #11: a build target older than `color()`", () => {
  /** Each `@media` holding `color-gamut` with the at-rules around it, in order. */
  const gamutBlocks = (css: string): string[][] => {
    const out: string[][] = [];
    const stack: string[] = [];
    let buf = "";
    for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
      if (ch === "{") {
        const prelude = buf.trim();
        if (prelude.startsWith("@media") && prelude.includes("color-gamut")) out.push([...stack]);
        stack.push(prelude);
        buf = "";
      } else if (ch === "}") {
        stack.pop();
        buf = "";
      } else if (ch === ";") buf = "";
      else buf += ch;
    }
    return out;
  };
  const GUARD = "@supports(color:color(display-p3000))";
  const strip = (s: string): string => s.replace(/\s+/g, "");
  const cssOf = (b: Built): string =>
    filesUnder(join(b.dir, "dist", "site"), /\.css$/)
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");

  for (const options of ["build: { target: ['chrome100'] }", "build: { cssTarget: 'chrome100' }"]) {
    const b = build({ vite: vite("", [], options) });
    it(
      `\`keel build\` of that project with \`${options}\` exits 0 and its CSS file holds each block under \`(color-gamut: p3)\` inside \`@supports (color: color(display-p3 0 0 0))\``,
      () => {
        expectBuilds(b);
        const blocks = gamutBlocks(cssOf(b));
        expect(blocks.length).toBeGreaterThan(0);
        for (const chain of blocks) expect(chain.map(strip), chain.join(" > ")).toContain(GUARD);
      },
      SLOW,
    );
  }
});

describe("k.gamut Output check: documents, deployables and tokens", () => {
  for (const adapter of ["static", "node"]) {
    const b = build({ adapter });
    it(
      `a \`${adapter}\` deployable builds, and its documents link the stylesheet and inline nothing`,
      () => {
        expectBuilds(b);
        const docs = filesUnder(join(b.dir, "dist", "site"), /\.html$/);
        for (const f of docs) {
          const html = readFileSync(f, "utf8");
          expect(html, f).toContain("stylesheet");
          expect(html, f).not.toContain("<style");
          expect(html, f).not.toContain("--k-");
        }
        expect(filesUnder(join(b.dir, "dist", "site"), /\.css$/).length).toBeGreaterThan(0);
      },
      SLOW,
    );
  }

  const none = build({ tokens: NO_COLOR_TOKENS_TS });
  it(
    "an app with no color token has nothing to find and builds",
    () => {
      expectBuilds(none);
    },
    SLOW,
  );
});
