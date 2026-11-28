// Spec: k.gamut, clause "`keel build` of that project with `build: { cssMinify: 'lightningcss' }` in `vite.config.ts` exits 1 with one E1819 line and no `dist/<name>/`; with a `css.postcss` plugin writing each `rgb(<r> <g> <b>)` as lowercase 6-digit hex, it prints `E1819 --k-color-a is #00857f in the built CSS, expected rgb(0 133 127)`; with `build: { cssMinify: false }`, or none, it exits 0."
// Spec: k.gamut, clause "In that project, a `styles` stylesheet holding `.x{--k-color-b:#000000}` makes `keel build` print `E1819 --k-color-b is #000000 in the built CSS where Keel declares none`; one holding `.x{color:#123ABC}` and `@supports (display:grid){.g{display:grid}}` builds."
// k.bundle Rules E1819 "E1819 built output holding Keel's CSS other than as compiled, or outside `.css` files (k.gamut CSS)."
// Seed: 1337 (fc.sample below picks the colors of the `declares none` builds); every other input is fixed.
// k.gamut #5 and #6 on a real `keel build` of #4's `static` project (compat-support's `staticTree`, adapter `static`, deployable `site`, module `s`), its `tokens.ts` the clause's own. The `vite.config.ts` and the `styles` stylesheet (a package export that is a .css file, as E1587 requires: `appcss/app.css`, a package the fixture writes under `node_modules/`) vary; the PostCSS plugins are plain objects written in the fixture (no `postcss` import).
// What the spec's CSS paragraph says and these cases assert: each browser build reads its emitted `.css` files after every plugin has run; each `--k-*` declaration is verified (a `--k-color-*` or `--k-overlay-*` one, or one holding a hex color or a color function, against its compiled value; any other `--k-*` one, refused when Keel declares none at that place); the first difference fails the build with E1819, one line, no position, `see` k.gamut, no `dist/<name>/`, a message of one of seven forms within 89 units; a declaration of a property not starting `--k-` is not read.
// ASSUMPTIONS: the E1819 line is a `diag` record whose `message` is the text after the code (as every other file here reads E1818); "no position" is `line` and `col` absent; which declaration is first when a plugin changes many (lightningcss, a plugin hitting `:root` as a whole) is not fixed beyond file and declaration order, so those cases assert the form of the message, not its property; the P3 block is found as an `@media` rule whose conditions hold `color-gamut`.
// The sentence "Fix (`keel explain E1819`): unset the `build.cssMinify` (Lightning CSS rewrites colors and adds `@supports`), `css.transformer` or PostCSS plugin that rewrote it, or the plugin that moved Keel's CSS out of its file." has its carrier in `keel explain E1819`, asserted below to name each cause (a diag record's `fix` is a unified diff hunk, docs/OUTPUT.md, and prose has none).
// UNTESTABLE: Also: "each value cut to an equal share" when both a found and an expected value are long (no plugin can make the expected value long); only the one-value form is cut here.
// Split from one file by fixture so each file stays well under the 150 s collection bound (docs/TESTING.md, Wall-clock bounds); the other files: built-css-verified*.test.ts.
import { afterAll, describe, expect, it } from "vitest";
import {
  appOnly,
  build,
  cleanAll,
  expectBuilds,
  expectFails,
  message,
  postcss,
  vite,
} from "./built-css-verified-support.ts";
import { keel } from "./compat-support.ts";
import { SLOW } from "./static-support.ts";

afterAll(cleanAll);

describe("k.gamut #6: a `styles` stylesheet", () => {
  const b = build(vite(""), ".x{--k-color-b:#000000}");
  it(
    "a `styles` stylesheet holding `.x{--k-color-b:#000000}` makes `keel build` print `E1819 --k-color-b is #000000 in the built CSS where Keel declares none`",
    () => {
      const d = expectFails(b);
      expect(message(d)).toBe("--k-color-b is #000000 in the built CSS where Keel declares none");
    },
    SLOW,
  );

  const ok = build(vite(""), ".x{color:#123ABC}\n@supports (display:grid){.g{display:grid}}");
  it(
    "one holding `.x{color:#123ABC}` and `@supports (display:grid){.g{display:grid}}` builds",
    () => {
      expectBuilds(ok);
    },
    SLOW,
  );

  const app = build(vite(postcss("appOnly"), appOnly), ".x{color:rgb(1 2 3)}");
  it(
    "the app's own CSS is not judged: a plugin rewriting only an app rule's color builds",
    () => {
      expectBuilds(app);
    },
    SLOW,
  );

  it(
    "`keel explain E1819` names the causes: `build.cssMinify`, `css.transformer`, a PostCSS plugin, and a plugin that moved Keel's CSS out of its file",
    () => {
      const r = keel(b.dir, ["explain", "E1819"]);
      const text = `${r.stdout ?? ""}${r.stderr ?? ""}`;
      expect(r.status).toBe(0);
      for (const word of ["cssMinify", "css.transformer", "PostCSS"]) expect(text, word).toContain(word);
    },
    SLOW,
  );

  const long = `rgb(1 2 3) ${"rgb(4 5 6) ".repeat(20)}`.trim();
  const cut = build(vite(""), `.x{--k-color-b:${long}}`);
  it(
    "a value too long for the message is cut ending `...` to keep the message within 89 units",
    () => {
      const d = expectFails(cut);
      const m = message(d);
      expect(m.startsWith("--k-color-b is rgb(1 2 3)")).toBe(true);
      expect(m).toContain("...");
      expect(m.endsWith(" in the built CSS where Keel declares none")).toBe(true);
      expect(m.length).toBeLessThanOrEqual(89);
    },
    SLOW,
  );
});
