import { compile } from "@keel/compiler";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { Outcome } from "./Outcome.ts";
import { TEST_FILE } from "./TEST_FILE.ts";
import { canonicalJson } from "./canonicalJson.ts";
import { codeFiles } from "./codeFiles.ts";
import { makeDiag } from "./makeDiag.ts";
import { summary } from "./summary.ts";

/** Artifacts `compile` derives on its own; `routes.json` needs `routes.ts` evaluated, which the Vite plugin does. */
const ARTIFACTS = ["a11y.json", "deps.json", "ids.json", "styles.json"] as const;

/**
 * `keel build`: compile every app source (no tests, no `*.config.*`) with `@keel/compiler`. Diagnostics flow
 * through unchanged; with no error, the `.keel/` artifacts (`{ data, hash }`, sorted keys, read-only) are
 * returned as writes. Bundling is Vite's: the binary runs `vite build` when `vite.config.ts` exists.
 */
export function buildCommand(io: Io): Outcome {
  const files = codeFiles(io, undefined).filter(
    (f) => !TEST_FILE.test(f.path) && !/(^|\/)[^/]*\.config\.[cm]?[jt]s$/.test(f.path) && !f.path.startsWith(".keel/"),
  );
  const r = compile(files);
  const diags: OutRecord[] = r.diagnostics.map((d) =>
    makeDiag(d.code, d.message, { path: d.path, line: d.line, col: d.col, see: d.see, fix: d.fix }),
  );
  const failed = diags.some((d) => typeof d.code === "string" && d.code.startsWith("E"));
  const writes = failed
    ? []
    : ARTIFACTS.map((name) => ({
        path: `.keel/${name}`,
        content: `${canonicalJson({ data: r.artifacts[name], hash: r.hashes[name] })}\n`,
        readonly: true,
      }));
  const errors = diags.filter((d) => typeof d.code === "string" && d.code.startsWith("E")).length;
  return {
    records: [...diags, summary("build", diags, { files: files.length, artifacts: writes.length, errors })],
    writes,
  };
}
